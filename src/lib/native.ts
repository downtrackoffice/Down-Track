// Native bridge: real disk + yt-dlp in Tauri, File System Access API in the browser,
// and a graceful "unsupported" result elsewhere (the UI then falls back to simulation).

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const hasFsAccess = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

/** A real folder on disk: absolute path (Tauri) or directory handle (browser). */
export interface RootRef { path?: string; handle?: FileSystemDirectoryHandle }

export interface ScanEntry { parts: string[]; name: string; isDir: boolean; size: number }

export interface RemoteMedia { id: string; title: string; duration: number; thumbnail: string; url: string }

const invoke = async <T,>(cmd: string, args?: Record<string, unknown>) => {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
};

const sep = () => (typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent) ? "\\" : "/");
const join = (base: string, parts: string[]) => [base.replace(/[\\/]+$/, ""), ...parts].join(sep());

export const sanitize = (s: string) => s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, "").slice(0, 180) || "untitled";

export async function pickFolder(): Promise<{ name: string; ref: RootRef } | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ directory: true, multiple: false });
    if (!path || Array.isArray(path)) return null;
    return { name: path.split(/[\\/]/).filter(Boolean).pop() ?? path, ref: { path } };
  }
  if (hasFsAccess()) {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (o: object) => Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker({ mode: "readwrite" });
      return { name: handle.name, ref: { handle } };
    } catch { return null; }
  }
  return null;
}

async function dirHandle(root: FileSystemDirectoryHandle, parts: string[], create = false) {
  let h = root;
  for (const p of parts) h = await h.getDirectoryHandle(p, { create });
  return h;
}

/** Recursively lists folders and .mp3/.mp4 files (max depth 4). */
export async function scan(ref: RootRef, depth = 0, parts: string[] = []): Promise<ScanEntry[]> {
  if (depth > 4) return [];
  const out: ScanEntry[] = [];
  if (ref.path && isTauri()) {
    const list = await invoke<{ name: string; is_dir: boolean; size: number }[]>("list_dir", { path: join(ref.path, parts) });
    for (const e of list) {
      out.push({ parts, name: e.name, isDir: e.is_dir, size: e.size });
      if (e.is_dir) out.push(...(await scan(ref, depth + 1, [...parts, e.name])));
    }
  } else if (ref.handle) {
    const dir = await dirHandle(ref.handle, parts);
    for await (const [name, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      if (h.kind === "directory") {
        out.push({ parts, name, isDir: true, size: 0 });
        out.push(...(await scan(ref, depth + 1, [...parts, name])));
      } else if (/\.(mp3|mp4)$/i.test(name)) {
        const f = await (h as FileSystemFileHandle).getFile();
        out.push({ parts, name, isDir: false, size: f.size });
      }
    }
  }
  return out;
}

export async function mkdir(ref: RootRef, parts: string[]) {
  if (ref.path && isTauri()) return invoke("create_dir", { path: join(ref.path, parts) });
  if (ref.handle) await dirHandle(ref.handle, parts, true);
}

export async function remove(ref: RootRef, parts: string[]) {
  if (ref.path && isTauri()) return invoke("delete_path", { path: join(ref.path, parts) });
  if (ref.handle) {
    const parent = await dirHandle(ref.handle, parts.slice(0, -1));
    await parent.removeEntry(parts[parts.length - 1]!, { recursive: true });
  }
}

export async function rename(ref: RootRef, parentParts: string[], from: string, to: string) {
  if (ref.path && isTauri()) {
    return invoke("rename_path", { from: join(ref.path, [...parentParts, from]), to: join(ref.path, [...parentParts, to]) });
  }
  if (ref.handle) {
    const parent = await dirHandle(ref.handle, parentParts);
    const h = await parent.getFileHandle(from).catch(() => parent.getDirectoryHandle(from));
    const movable = h as unknown as { move?: (name: string) => Promise<void> };
    if (!movable.move) throw new Error("Rename is not supported by this browser");
    await movable.move(to);
  }
}

export async function fetchMetadata(url: string): Promise<{ isPlaylist: boolean; entries: RemoteMedia[] } | null> {
  if (!isTauri()) return null;
  const m = await invoke<{ is_playlist: boolean; entries: RemoteMedia[] }>("fetch_metadata", { url });
  return { isPlaylist: m.is_playlist, entries: m.entries };
}

export interface DownloadJob { jobId: string; url: string; format: "mp3" | "mp4"; quality: string; dir: string; name: string }

/** Real download via yt-dlp sidecar (Tauri only). */
export async function download(job: DownloadJob, onProgress: (p: number) => void) {
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen<{ job_id: string; percent: number }>("download-progress", (e) => {
    if (e.payload.job_id === job.jobId) onProgress(e.payload.percent);
  });
  try {
    return await invoke<string>("download", {
      job: { job_id: job.jobId, url: job.url, format: job.format, quality: job.quality, dir: job.dir, name: job.name },
    });
  } finally { un(); }
}

export const diskPath = (ref: RootRef, parts: string[]) => (ref.path ? join(ref.path, parts) : "");

export const updateEngine = () => invoke<string>("update_ytdlp");
export const engineVersion = () => (isTauri() ? invoke<string>("tool_versions") : Promise.resolve(null));

export async function windowAction(a: "minimize" | "maximize" | "close") {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  if (a === "minimize") await w.minimize();
  else if (a === "maximize") await w.toggleMaximize();
  else await w.close();
}
