use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Sidecars are bundled next to the executable (Tauri strips the target-triple suffix).
fn sidecar(name: &str) -> PathBuf {
    let dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_default();
    let file = if cfg!(windows) { format!("{name}.exe") } else { name.to_string() };
    dir.join(file)
}

/// Every external process goes through here: hidden window, piped output.
fn silent(name: &str) -> Command {
    let mut c = Command::new(sidecar(name));
    c.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    // Avoid cp1255/cp1252 console encoding crashes on non-ASCII titles.
    c.env("PYTHONIOENCODING", "utf-8").env("PYTHONUTF8", "1");
    #[cfg(windows)]
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

fn run_capture(mut c: Command) -> Result<String, String> {
    let out = c.output().map_err(|e| format!("failed to start: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// Fallback pipeline against YouTube 403 blocks:
/// 0 = Android player client, 1 = TV player client, 2/3 = cookies from a local browser.
const ATTEMPTS: usize = 4;

fn apply_attempt(c: &mut Command, attempt: usize) {
    match attempt {
        0 => { c.args(["--extractor-args", "youtube:player_client=android"]); }
        1 => { c.args(["--extractor-args", "youtube:player_client=tv"]); }
        2 => { c.args(["--cookies-from-browser", "chrome"]); }
        _ => { c.args(["--cookies-from-browser", "edge"]); }
    }
}

#[derive(Serialize)]
struct MediaInfo {
    id: String,
    title: String,
    duration: u64,
    thumbnail: String,
    url: String,
}

#[derive(Serialize)]
struct Metadata {
    is_playlist: bool,
    title: String,
    entries: Vec<MediaInfo>,
}

fn to_info(v: &serde_json::Value) -> MediaInfo {
    let id = v["id"].as_str().unwrap_or_default().to_string();
    let thumb = v["thumbnail"].as_str().map(String::from).unwrap_or_else(|| {
        v["thumbnails"].as_array().and_then(|a| a.last()).and_then(|t| t["url"].as_str())
            .map(String::from).unwrap_or_else(|| format!("https://i.ytimg.com/vi/{id}/mqdefault.jpg"))
    });
    MediaInfo {
        url: v["webpage_url"].as_str().or(v["url"].as_str()).map(String::from)
            .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={id}")),
        title: v["title"].as_str().unwrap_or("Untitled").to_string(),
        duration: v["duration"].as_f64().unwrap_or(0.0) as u64,
        thumbnail: thumb,
        id,
    }
}

#[tauri::command]
async fn fetch_metadata(url: String) -> Result<Metadata, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut last_err = String::new();
        let mut parsed: Option<serde_json::Value> = None;
        for attempt in 0..ATTEMPTS {
            let mut c = silent("yt-dlp");
            apply_attempt(&mut c, attempt);
            c.args(["-J", "--flat-playlist", "--no-warnings", &url]);
            match run_capture(c) {
                Ok(out) => match serde_json::from_str::<serde_json::Value>(&out) {
                    Ok(v) => { parsed = Some(v); break; }
                    Err(e) => last_err = e.to_string(),
                },
                Err(e) => last_err = e,
            }
        }
        let json = parsed.ok_or(last_err)?;
        if json["_type"] == "playlist" {
            let entries = json["entries"].as_array().map(|a| a.iter().map(to_info).collect()).unwrap_or_default();
            Ok(Metadata { is_playlist: true, title: json["title"].as_str().unwrap_or_default().into(), entries })
        } else {
            Ok(Metadata { is_playlist: false, title: json["title"].as_str().unwrap_or_default().into(), entries: vec![to_info(&json)] })
        }
    }).await.map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
struct DownloadJob {
    job_id: String,
    url: String,
    format: String,  // "mp3" | "mp4"
    quality: String, // 128k/192k/320k | 720p/1080p/4K
    dir: String,
    name: String,    // file name without extension
}

#[derive(Serialize, Clone)]
struct Progress {
    job_id: String,
    percent: f64,
}

/// Strip characters Windows forbids in file names (and control chars), trailing dots/spaces.
fn clean_name(s: &str) -> String {
    let mut out: String = s.chars()
        .map(|ch| if matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || ch.is_control() { '_' } else { ch })
        .collect();
    out = out.trim().trim_end_matches(['.', ' ']).to_string();
    if out.is_empty() { out = "download".into(); }
    if out.chars().count() > 180 { out = out.chars().take(180).collect(); }
    out
}

#[tauri::command]
async fn download(app: AppHandle, job: DownloadJob) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let name = clean_name(&job.name);
        let ffmpeg_dir = sidecar("ffmpeg").parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
        let out = PathBuf::from(&job.dir).join(format!("{}.%(ext)s", name));
        let mut c = silent("yt-dlp");
        c.env("PYTHONIOENCODING", "utf-8").env("PYTHONUTF8", "1");
        c.arg("--windows-filenames");
        c.args(["--newline", "--no-playlist", "--no-warnings", "--ffmpeg-location", &ffmpeg_dir,
            "--progress-template", "download:DTPROG %(progress._percent_str)s"]);
        if job.format == "mp3" {
            let q = job.quality.to_uppercase();
            c.args(["-x", "--audio-format", "mp3", "--audio-quality", &q, "--embed-thumbnail", "--add-metadata"]);
        } else {
            let h = match job.quality.as_str() { "4K" => "2160", "1080p" => "1080", _ => "720" };
            let f = format!("bv*[height<={h}]+ba/b[height<={h}]");
            c.args(["-f", &f, "--merge-output-format", "mp4"]);
        }
        c.arg("-o").arg(&out).arg(&job.url);

        let mut child = c.spawn().map_err(|e| format!("failed to start yt-dlp: {e}"))?;
        let stdout = child.stdout.take().ok_or("no stdout")?;
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(rest) = line.trim().strip_prefix("DTPROG") {
                if let Ok(p) = rest.trim().trim_end_matches('%').trim().parse::<f64>() {
                    // reserve the last 5% for ffmpeg post-processing
                    let _ = app.emit("download-progress", Progress { job_id: job.job_id.clone(), percent: p * 0.95 });
                }
            }
        }
        let status = child.wait().map_err(|e| e.to_string())?;
        if !status.success() {
            let mut err = String::new();
            if let Some(mut e) = child.stderr.take() { use std::io::Read; let _ = e.read_to_string(&mut err); }
            return Err(err.trim().to_string());
        }
        let _ = app.emit("download-progress", Progress { job_id: job.job_id.clone(), percent: 100.0 });
        Ok(PathBuf::from(&job.dir).join(format!("{}.{}", name, job.format)).to_string_lossy().to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn update_ytdlp() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut c = silent("yt-dlp");
        c.arg("-U");
        run_capture(c)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn tool_versions() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut c = silent("yt-dlp");
        c.arg("--version");
        Ok(run_capture(c)?.trim().to_string())
    }).await.map_err(|e| e.to_string())?
}

#[derive(Serialize)]
struct Entry {
    name: String,
    is_dir: bool,
    size: u64,
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<Entry>, String> {
    let mut v = vec![];
    for e in std::fs::read_dir(&path).map_err(|e| e.to_string())?.flatten() {
        let meta = match e.metadata() { Ok(m) => m, Err(_) => continue };
        let name = e.file_name().to_string_lossy().to_string();
        let lower = name.to_lowercase();
        if meta.is_dir() || lower.ends_with(".mp3") || lower.ends_with(".mp4") {
            v.push(Entry { name, is_dir: meta.is_dir(), size: meta.len() });
        }
    }
    Ok(v)
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_path(from: String, to: String) -> Result<(), String> {
    std::fs::rename(from, to).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() { std::fs::remove_dir_all(p) } else { std::fs::remove_file(p) }.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            fetch_metadata, download, update_ytdlp, tool_versions, list_dir, create_dir, rename_path, delete_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running DownTrack");
}
