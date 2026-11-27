use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

const EXEC_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_OUTPUT_CHARS: usize = 50_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeRunResult {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

/// 終了時に一時ディレクトリを確実に削除する RAII ガード。
struct TempDirGuard {
    path: PathBuf,
}

impl TempDirGuard {
    fn new() -> Result<Self, String> {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("satlas_run_{}_{}", std::process::id(), nanos));
        fs::create_dir_all(&dir).map_err(|e| format!("一時ディレクトリの作成に失敗しました: {e}"))?;
        Ok(Self { path: dir })
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempDirGuard {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn truncate_output(s: String) -> String {
    if s.chars().count() <= MAX_OUTPUT_CHARS {
        return s;
    }
    let truncated: String = s.chars().take(MAX_OUTPUT_CHARS).collect();
    format!("{truncated}\n... (出力が長いため省略されました)")
}

/// Java ソースから public class 名（なければ class 名、既定 Main）を抽出する。
fn detect_java_class_name(code: &str) -> String {
    for keyword in ["public class ", "class "] {
        if let Some(pos) = code.find(keyword) {
            let rest = code[pos + keyword.len()..].trim_start();
            let name: String = rest
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
                .collect();
            if !name.is_empty() {
                return name;
            }
        }
    }
    "Main".to_string()
}

struct CmdOutput {
    exit_code: i32,
    stdout: String,
    stderr: String,
    timed_out: bool,
}

/// 子プロセスをタイムアウト付きで実行し、標準出力・標準エラーをデッドロックなく回収する。
fn run_with_timeout(cmd: &mut Command, timeout: Duration) -> Result<CmdOutput, std::io::Error> {
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: コンソールウィンドウの点滅を抑止
        cmd.creation_flags(0x0800_0000);
    }

    let mut child = cmd.spawn()?;
    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();

    let out_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(ref mut p) = stdout_pipe {
            let _ = p.read_to_end(&mut buf);
        }
        String::from_utf8_lossy(&buf).into_owned()
    });

    let err_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(ref mut p) = stderr_pipe {
            let _ = p.read_to_end(&mut buf);
        }
        String::from_utf8_lossy(&buf).into_owned()
    });

    let start = Instant::now();
    let mut timed_out = false;
    let status = loop {
        match child.try_wait()? {
            Some(s) => break Some(s),
            None => {
                if start.elapsed() >= timeout {
                    timed_out = true;
                    let _ = child.kill();
                    let _ = child.wait();
                    break None;
                }
                thread::sleep(Duration::from_millis(20));
            }
        }
    };

    let stdout = out_handle.join().unwrap_or_default();
    let stderr = err_handle.join().unwrap_or_default();
    let exit_code = if timed_out {
        124
    } else {
        status.and_then(|s| s.code()).unwrap_or(1)
    };

    Ok(CmdOutput {
        exit_code,
        stdout,
        stderr,
        timed_out,
    })
}

fn execute_code_blocking(language: &str, code: &str) -> Result<CodeRunResult, String> {
    let lang = language.trim().to_lowercase();
    let started = Instant::now();
    let elapsed_ms = || started.elapsed().as_millis() as u64;

    let tmp = TempDirGuard::new()?;

    match lang.as_str() {
        "python" => {
            let src = tmp.path().join("main.py");
            fs::write(&src, code).map_err(|e| format!("ソース書き込みエラー: {e}"))?;

            let candidates: &[(&str, &[&str])] = &[("python", &[]), ("py", &["-3"]), ("python3", &[])];
            for (bin, extra) in candidates {
                let mut cmd = Command::new(bin);
                cmd.args(*extra)
                    .arg(&src)
                    .current_dir(tmp.path())
                    .env("PYTHONIOENCODING", "utf-8");
                match run_with_timeout(&mut cmd, EXEC_TIMEOUT) {
                    Ok(out) => {
                        let stderr = if out.timed_out {
                            format!("実行がタイムアウトしました（上限 {} 秒）", EXEC_TIMEOUT.as_secs())
                        } else {
                            truncate_output(out.stderr)
                        };
                        return Ok(CodeRunResult {
                            ok: !out.timed_out && out.exit_code == 0,
                            stdout: truncate_output(out.stdout),
                            stderr,
                            exit_code: out.exit_code,
                            duration_ms: elapsed_ms(),
                        });
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
                    Err(e) => return Err(format!("Python 実行エラー: {e}")),
                }
            }
            Ok(CodeRunResult {
                ok: false,
                stdout: String::new(),
                stderr: "python / py / python3 が PATH に見つかりません。Python をインストールしてください。".to_string(),
                exit_code: 127,
                duration_ms: elapsed_ms(),
            })
        }

        "java" => {
            let class_name = detect_java_class_name(code);
            let src = tmp.path().join(format!("{class_name}.java"));
            fs::write(&src, code).map_err(|e| format!("ソース書き込みエラー: {e}"))?;

            let mut javac = Command::new("javac");
            javac
                .args(["-encoding", "UTF-8"])
                .arg(&src)
                .current_dir(tmp.path());
            let comp = match run_with_timeout(&mut javac, EXEC_TIMEOUT) {
                Ok(out) => out,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                    return Ok(CodeRunResult {
                        ok: false,
                        stdout: String::new(),
                        stderr: "javac が PATH に見つかりません。JDK をインストールしてください。".to_string(),
                        exit_code: 127,
                        duration_ms: elapsed_ms(),
                    });
                }
                Err(e) => return Err(format!("javac 起動エラー: {e}")),
            };

            if comp.timed_out || comp.exit_code != 0 {
                return Ok(CodeRunResult {
                    ok: false,
                    stdout: truncate_output(comp.stdout),
                    stderr: if comp.timed_out {
                        "Java のコンパイルがタイムアウトしました".to_string()
                    } else {
                        truncate_output(comp.stderr)
                    },
                    exit_code: comp.exit_code,
                    duration_ms: elapsed_ms(),
                });
            }

            let mut java = Command::new("java");
            java.arg("-Dfile.encoding=UTF-8")
                .arg("-cp")
                .arg(tmp.path())
                .arg(&class_name)
                .current_dir(tmp.path());
            let run = match run_with_timeout(&mut java, EXEC_TIMEOUT) {
                Ok(out) => out,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                    return Ok(CodeRunResult {
                        ok: false,
                        stdout: String::new(),
                        stderr: "java が PATH に見つかりません。JDK をインストールしてください。".to_string(),
                        exit_code: 127,
                        duration_ms: elapsed_ms(),
                    });
                }
                Err(e) => return Err(format!("java 実行エラー: {e}")),
            };

            Ok(CodeRunResult {
                ok: !run.timed_out && run.exit_code == 0,
                stdout: truncate_output(run.stdout),
                stderr: if run.timed_out {
                    format!("実行がタイムアウトしました（上限 {} 秒）", EXEC_TIMEOUT.as_secs())
                } else {
                    truncate_output(run.stderr)
                },
                exit_code: run.exit_code,
                duration_ms: elapsed_ms(),
            })
        }

        "c" => {
            let src = tmp.path().join("main.c");
            let exe = tmp.path().join(if cfg!(target_os = "windows") { "main.exe" } else { "main" });
            fs::write(&src, code).map_err(|e| format!("ソース書き込みエラー: {e}"))?;

            let mut comp_opt = None;
            for compiler in ["gcc", "clang"] {
                let mut cc = Command::new(compiler);
                cc.arg(&src).arg("-o").arg(&exe).arg("-lm").current_dir(tmp.path());
                match run_with_timeout(&mut cc, EXEC_TIMEOUT) {
                    Ok(out) => {
                        comp_opt = Some(out);
                        break;
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
                    Err(e) => return Err(format!("C コンパイラ起動エラー: {e}")),
                }
            }

            let Some(comp) = comp_opt else {
                return Ok(CodeRunResult {
                    ok: false,
                    stdout: String::new(),
                    stderr: "gcc / clang が PATH に見つかりません。C コンパイラをインストールしてください。".to_string(),
                    exit_code: 127,
                    duration_ms: elapsed_ms(),
                });
            };

            if comp.timed_out || comp.exit_code != 0 {
                return Ok(CodeRunResult {
                    ok: false,
                    stdout: truncate_output(comp.stdout),
                    stderr: if comp.timed_out {
                        "C のコンパイルがタイムアウトしました".to_string()
                    } else {
                        truncate_output(comp.stderr)
                    },
                    exit_code: comp.exit_code,
                    duration_ms: elapsed_ms(),
                });
            }

            let mut bin = Command::new(&exe);
            bin.current_dir(tmp.path());
            let run = run_with_timeout(&mut bin, EXEC_TIMEOUT)
                .map_err(|e| format!("C バイナリ実行エラー: {e}"))?;

            Ok(CodeRunResult {
                ok: !run.timed_out && run.exit_code == 0,
                stdout: truncate_output(run.stdout),
                stderr: if run.timed_out {
                    format!("実行がタイムアウトしました（上限 {} 秒）", EXEC_TIMEOUT.as_secs())
                } else {
                    truncate_output(run.stderr)
                },
                exit_code: run.exit_code,
                duration_ms: elapsed_ms(),
            })
        }

        _ => Ok(CodeRunResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("未対応の言語です: {language}（対応: python / java / c）"),
            exit_code: 2,
            duration_ms: elapsed_ms(),
        }),
    }
}

#[tauri::command]
async fn run_local_code(language: String, code: String) -> Result<CodeRunResult, String> {
    tauri::async_runtime::spawn_blocking(move || execute_code_blocking(&language, &code))
        .await
        .map_err(|e| format!("実行スレッドエラー: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    let _ = handle.emit("satlas://auth-callback", url.as_str().to_string());
                }
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![run_local_code])
        .run(tauri::generate_context!())
        .expect("error while running SAtlas Tauri application");
}
