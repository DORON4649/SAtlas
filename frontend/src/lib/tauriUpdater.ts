// ---- Tauri v2 デスクトップ環境検出 ＆ GitHub Releases 自動アップデート ----

import type { Update } from '@tauri-apps/plugin-updater';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export interface UpdateCheckResult {
  available: boolean;
  version?: string;
  body?: string;
  update?: Update;
}

/** GitHub Releases の latest.json を確認し、新しいバージョンがあれば返す（Tauri 環境専用） */
export async function checkForDesktopUpdate(): Promise<UpdateCheckResult> {
  if (!isTauriDesktop()) {
    return { available: false };
  }
  const { check } = await import('@tauri-apps/plugin-updater');
  const update = await check();
  if (!update) {
    return { available: false };
  }
  return {
    available: true,
    version: update.version,
    body: update.body ?? undefined,
    update,
  };
}

/** アップデートをダウンロード・適用してアプリを再起動する */
export async function installDesktopUpdateAndRelaunch(
  update: Update,
  onProgress?: (percent: number | null) => void,
): Promise<void> {
  let totalBytes = 0;
  let downloadedBytes = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      totalBytes = event.data.contentLength ?? 0;
      downloadedBytes = 0;
      onProgress?.(0);
    } else if (event.event === 'Progress') {
      downloadedBytes += event.data.chunkLength;
      if (totalBytes > 0) {
        onProgress?.(Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)));
      } else {
        onProgress?.(null);
      }
    } else if (event.event === 'Finished') {
      onProgress?.(100);
    }
  });

  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
