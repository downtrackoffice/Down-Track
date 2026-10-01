<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS

- All file changes are staged in client state (status pending) and only executed on "Save changes" — preserves the strict staging contract.
- Downloads in the web preview are simulated; the desktop build routes them through `electron/` IPC (`window.downtrack`) — keeps UI independent of the native runtime.
- Native binaries (yt-dlp, ffmpeg, ffprobe) are always spawned with `windowsHide: true` — no console window may ever appear.
- UI strings live in `src/lib/i18n.ts`; non-core languages fall back to English per key — one source of truth for 20 languages.
- Layout uses logical properties (ms/me/ps/pe/start/end) and `rtl:` variants — RTL languages mirror automatically.
