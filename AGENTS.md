# AGENTS

- All file changes are staged in client state (status pending) and only executed on "Save changes" — preserves the strict staging contract.
- Desktop shell is Tauri v2 (`src-tauri/`); the frontend talks to it only through `src/lib/native.ts`, which also supports the browser File System Access API and falls back to simulation — keeps UI runtime-agnostic.
- Folders added via the native picker are disk-backed (root ref kept in memory); demo/virtual folders are simulated — one save pipeline handles both.
- Native binaries (yt-dlp, ffmpeg, ffprobe) are Tauri sidecars and always spawned with `CREATE_NO_WINDOW` from Rust — no console window may ever appear.
- `TAURI_BUILD=1` switches TanStack Start to SPA mode; the static output lands in `.output/public` (Nitro) for the desktop bundle — web build stays SSR.
- Windows installers are built only in GitHub Actions (`build-windows.yml`), which downloads the latest sidecar binaries — binaries are never committed.
- UI strings live in `src/lib/i18n.ts`; non-core languages fall back to English per key — one source of truth for 20 languages.
- Layout uses logical properties (ms/me/ps/pe/start/end) and `rtl:` variants — RTL languages mirror automatically.
- Auto-update uses tauri-plugin-updater against the repo's GitHub Releases latest.json (repo injected by the workflow), quiet install + restart — no user prompt.
