// DownTrack — Electron main process (Windows packaging).
// Binaries (yt-dlp.exe, ffmpeg.exe, ffprobe.exe) are shipped in resources/bin and
// always spawned with windowsHide so no CMD window ever flashes.
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const binDir = app.isPackaged ? path.join(process.resourcesPath, "bin") : path.join(__dirname, "..", "bin");
const bin = (name) => path.join(binDir, process.platform === "win32" ? `${name}.exe` : name);

function run(tool, args, onLine) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin(tool), args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", (d) => onLine && String(d).split(/\r?\n/).forEach((l) => l && onLine(l)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${tool} exited ${code}`))));
  });
}

ipcMain.handle("dt:download", (e, { url, format, quality, outFile }) => {
  const args = format === "mp3"
    ? ["-x", "--audio-format", "mp3", "--audio-quality", quality.replace("k", "K"), "--ffmpeg-location", binDir]
    : ["-f", `bv*[height<=${quality === "4K" ? 2160 : parseInt(quality)}]+ba/b`, "--merge-output-format", "mp4", "--ffmpeg-location", binDir];
  return run("yt-dlp", [...args, "--newline", "-o", outFile, url], (line) => {
    const m = line.match(/(\d+(?:\.\d+)?)%/);
    if (m) e.sender.send("dt:progress", { outFile, progress: parseFloat(m[1]) });
  });
});
ipcMain.handle("dt:update", () => run("yt-dlp", ["-U"]));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 980, minHeight: 620,
    titleBarStyle: "hidden", titleBarOverlay: { height: 36, color: "#00000000" },
    backgroundMaterial: "mica",
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.cjs") },
  });
  win.loadFile(path.join(__dirname, "..", "dist", "client", "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
