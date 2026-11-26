#!/usr/bin/env python3
"""
SAtlas ローカルコード実行ブリッジ (runner/satlas_runner.py)

- Python 標準ライブラリのみで動作（追加パッケージ不要）
- 127.0.0.1:9123 で RFC 6455 WebSocket サーバーを待機
- 起動時に生成したワンタイムトークンを検証した上で python / java / c を一時ディレクトリで実行し、
  stdout / stderr / exitCode / durationMs を JSON で返却する。

使い方:
  python runner/satlas_runner.py
  python runner/satlas_runner.py --port 9123 --timeout 10
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import struct
import subprocess
import sys
import tempfile
import time
from typing import Any

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 9123
DEFAULT_TIMEOUT_SEC = 10.0
MAX_OUTPUT_CHARS = 50_000
MAX_FRAME_BYTES = 2 * 1024 * 1024


def truncate_output(text: str) -> str:
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    return text[:MAX_OUTPUT_CHARS] + "\n... (出力が長いため省略されました)"


def detect_java_class_name(code: str) -> str:
    match = re.search(r"\bpublic\s+class\s+([A-Za-z_][A-Za-z0-9_]*)", code)
    if match:
        return match.group(1)
    match = re.search(r"\bclass\s+([A-Za-z_][A-Za-z0-9_]*)", code)
    if match:
        return match.group(1)
    return "Main"


def execute_code_sync(language: str, code: str, timeout_sec: float) -> dict[str, Any]:
    lang = (language or "").strip().lower()
    started = time.perf_counter()

    def elapsed_ms() -> int:
        return int(round((time.perf_counter() - started) * 1000))

    if lang not in ("python", "java", "c"):
        return {
            "ok": False,
            "stdout": "",
            "stderr": f"未対応の言語です: {language}（対応: python / java / c）",
            "exitCode": 2,
            "durationMs": elapsed_ms(),
        }

    with tempfile.TemporaryDirectory(prefix="satlas_run_") as tmpdir:
        try:
            if lang == "python":
                src = os.path.join(tmpdir, "main.py")
                with open(src, "w", encoding="utf-8") as f:
                    f.write(code)
                env = os.environ.copy()
                env["PYTHONIOENCODING"] = "utf-8"
                proc = subprocess.run(
                    [sys.executable, src],
                    cwd=tmpdir,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=timeout_sec,
                    env=env,
                )
                return {
                    "ok": proc.returncode == 0,
                    "stdout": truncate_output(proc.stdout),
                    "stderr": truncate_output(proc.stderr),
                    "exitCode": proc.returncode,
                    "durationMs": elapsed_ms(),
                }

            if lang == "java":
                javac = shutil.which("javac")
                java = shutil.which("java")
                if not javac or not java:
                    return {
                        "ok": False,
                        "stdout": "",
                        "stderr": "javac または java が PATH に見つかりません。JDK をインストールしてください。",
                        "exitCode": 127,
                        "durationMs": elapsed_ms(),
                    }
                class_name = detect_java_class_name(code)
                src = os.path.join(tmpdir, f"{class_name}.java")
                with open(src, "w", encoding="utf-8") as f:
                    f.write(code)

                comp = subprocess.run(
                    [javac, "-encoding", "UTF-8", src],
                    cwd=tmpdir,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=timeout_sec,
                )
                if comp.returncode != 0:
                    return {
                        "ok": False,
                        "stdout": truncate_output(comp.stdout),
                        "stderr": truncate_output(comp.stderr or "Java のコンパイルに失敗しました"),
                        "exitCode": comp.returncode,
                        "durationMs": elapsed_ms(),
                    }

                proc = subprocess.run(
                    [java, "-Dfile.encoding=UTF-8", "-cp", tmpdir, class_name],
                    cwd=tmpdir,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=timeout_sec,
                )
                return {
                    "ok": proc.returncode == 0,
                    "stdout": truncate_output(proc.stdout),
                    "stderr": truncate_output(proc.stderr),
                    "exitCode": proc.returncode,
                    "durationMs": elapsed_ms(),
                }

            # C
            compiler = shutil.which("gcc") or shutil.which("clang")
            if not compiler:
                return {
                    "ok": False,
                    "stdout": "",
                    "stderr": "gcc または clang が PATH に見つかりません。C コンパイラをインストールしてください。",
                    "exitCode": 127,
                    "durationMs": elapsed_ms(),
                }
            src = os.path.join(tmpdir, "main.c")
            exe_name = "main.exe" if os.name == "nt" else "main"
            exe_path = os.path.join(tmpdir, exe_name)
            with open(src, "w", encoding="utf-8") as f:
                f.write(code)

            comp = subprocess.run(
                [compiler, src, "-o", exe_path, "-lm"],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_sec,
            )
            if comp.returncode != 0:
                return {
                    "ok": False,
                    "stdout": truncate_output(comp.stdout),
                    "stderr": truncate_output(comp.stderr or "C のコンパイルに失敗しました"),
                    "exitCode": comp.returncode,
                    "durationMs": elapsed_ms(),
                }

            proc = subprocess.run(
                [exe_path],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_sec,
            )
            return {
                "ok": proc.returncode == 0,
                "stdout": truncate_output(proc.stdout),
                "stderr": truncate_output(proc.stderr),
                "exitCode": proc.returncode,
                "durationMs": elapsed_ms(),
            }

        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "stdout": "",
                "stderr": f"実行がタイムアウトしました（上限 {timeout_sec:.1f} 秒）",
                "exitCode": 124,
                "durationMs": elapsed_ms(),
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "ok": False,
                "stdout": "",
                "stderr": f"実行エラー: {exc}",
                "exitCode": 1,
                "durationMs": elapsed_ms(),
            }


async def read_ws_frame(reader: asyncio.StreamReader) -> tuple[int, bytes] | None:
    try:
        header = await reader.readexactly(2)
    except asyncio.IncompleteReadError:
        return None

    b1, b2 = header[0], header[1]
    opcode = b1 & 0x0F
    masked = (b2 & 0x80) != 0
    length = b2 & 0x7F

    if length == 126:
        ext = await reader.readexactly(2)
        length = struct.unpack("!H", ext)[0]
    elif length == 127:
        ext = await reader.readexactly(8)
        length = struct.unpack("!Q", ext)[0]

    if length > MAX_FRAME_BYTES:
        raise ValueError("WebSocket フレームサイズ上限を超えています")

    mask_key = await reader.readexactly(4) if masked else b""
    payload = await reader.readexactly(length) if length > 0 else b""
    if masked:
        payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))

    return opcode, payload


def build_ws_frame(opcode: int, payload: bytes) -> bytes:
    length = len(payload)
    first_byte = 0x80 | (opcode & 0x0F)
    if length < 126:
        header = struct.pack("!BB", first_byte, length)
    elif length < 65536:
        header = struct.pack("!BBH", first_byte, 126, length)
    else:
        header = struct.pack("!BBQ", first_byte, 127, length)
    return header + payload


async def send_ws_json(writer: asyncio.StreamWriter, data: dict[str, Any]) -> None:
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    writer.write(build_ws_frame(0x1, payload))
    await writer.drain()


async def handle_client(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    token: str,
    timeout_sec: float,
) -> None:
    try:
        raw_req = await reader.readuntil(b"\r\n\r\n")
    except Exception:
        writer.close()
        await writer.wait_closed()
        return

    lines = raw_req.decode("utf-8", errors="ignore").split("\r\n")
    headers: dict[str, str] = {}
    for line in lines[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()

    ws_key = headers.get("sec-websocket-key")
    if not ws_key:
        writer.write(b"HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n")
        await writer.drain()
        writer.close()
        await writer.wait_closed()
        return

    accept_val = base64.b64encode(hashlib.sha1((ws_key + WS_GUID).encode("utf-8")).digest()).decode("ascii")
    response = (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept_val}\r\n\r\n"
    )
    writer.write(response.encode("ascii"))
    await writer.drain()

    try:
        while True:
            frame = await read_ws_frame(reader)
            if frame is None:
                break
            opcode, payload = frame

            if opcode == 0x8:  # Close
                writer.write(build_ws_frame(0x8, b""))
                await writer.drain()
                break
            if opcode == 0x9:  # Ping
                writer.write(build_ws_frame(0xA, payload))
                await writer.drain()
                continue
            if opcode != 0x1:  # Only handle text frames
                continue

            try:
                msg = json.loads(payload.decode("utf-8"))
            except json.JSONDecodeError:
                await send_ws_json(
                    writer,
                    {
                        "ok": False,
                        "stdout": "",
                        "stderr": "不正な JSON リクエストです",
                        "exitCode": 400,
                        "durationMs": 0,
                    },
                )
                continue

            req_id = msg.get("id")
            provided_token = str(msg.get("token") or "")
            if not hmac.compare_digest(provided_token, token):
                await send_ws_json(
                    writer,
                    {
                        "id": req_id,
                        "ok": False,
                        "stdout": "",
                        "stderr": "トークン認証に失敗しました。runner 起動時に表示されたトークンを設定してください。",
                        "exitCode": 401,
                        "durationMs": 0,
                    },
                )
                continue

            action = msg.get("type") or "run"
            if action == "ping":
                await send_ws_json(
                    writer,
                    {
                        "id": req_id,
                        "type": "pong",
                        "ok": True,
                        "stdout": "connected",
                        "stderr": "",
                        "exitCode": 0,
                        "durationMs": 0,
                    },
                )
                continue

            language = str(msg.get("language") or "")
            code = str(msg.get("code") or "")
            result = await asyncio.to_thread(execute_code_sync, language, code, timeout_sec)
            result["id"] = req_id
            await send_ws_json(writer, result)
    except Exception:
        pass
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass


async def run_server(host: str, port: int, token: str, timeout_sec: float) -> None:
    server = await asyncio.start_server(
        lambda r, w: handle_client(r, w, token, timeout_sec),
        host=host,
        port=port,
    )
    print("=" * 64)
    print(" SAtlas ローカルコード実行ブリッジ (satlas_runner.py)")
    print("=" * 64)
    print(f" WebSocket URL : ws://{host}:{port}")
    print(f" ワンタイムトークン: {token}")
    print(f" 実行タイムアウト  : {timeout_sec:.1f} 秒")
    print("-" * 64)
    print(" ノートブックの「表示・ツール」→「ランナー接続設定」に上記トークンを貼り付けてください。")
    print(" 終了するには Ctrl+C を押してください。")
    print("=" * 64, flush=True)

    async with server:
        await server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="SAtlas ローカルコード実行 WebSocket ブリッジ")
    parser.add_argument("--host", default=DEFAULT_HOST, help="バインドホスト (既定: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="待機ポート (既定: 9123)")
    parser.add_argument("--token", default="", help="任意の固定トークン（省略時は自動生成）")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_SEC, help="実行タイムアウト秒 (既定: 10)")
    args = parser.parse_args()

    token = args.token.strip() or secrets.token_urlsafe(24)
    try:
        asyncio.run(run_server(args.host, args.port, token, args.timeout))
    except KeyboardInterrupt:
        print("\nSAtlas ローカルランナーを終了しました。")


if __name__ == "__main__":
    main()
