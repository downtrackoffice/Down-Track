#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use futures_util::StreamExt;
use serde::Serialize;
use std::io::Write;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct Progress {
    phase: &'static str,
    received: u64,
    total: Option<u64>,
}

fn emit(app: &AppHandle, phase: &'static str, received: u64, total: Option<u64>) {
    let _ = app.emit("setup-progress", Progress { phase, received, total });
}

fn b64(s: &str) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(s.trim())
        .map_err(|e| format!("bad base64: {e}"))?;
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn silent(c: &mut std::process::Command) {
    use std::os::windows::process::CommandExt;
    c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
}
#[cfg(not(windows))]
fn silent(_: &mut std::process::Command) {}

#[tauri::command]
async fn install(app: AppHandle) -> Result<(), String> {
    let repo = env!("DT_REPO");
    if repo.is_empty() {
        return Err("Installer was built without a release source.".into());
    }
    let client = reqwest::Client::builder()
        .user_agent("DownTrack-Setup")
        .build()
        .map_err(|e| e.to_string())?;

    // 1. Latest release manifest (same file the in-app updater reads).
    emit(&app, "fetch", 0, None);
    let manifest: serde_json::Value = client
        .get(format!("https://github.com/{repo}/releases/latest/download/latest.json"))
        .send().await.map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let plat = manifest["platforms"]
        .get("windows-x86_64-nsis")
        .or_else(|| manifest["platforms"].get("windows-x86_64"))
        .ok_or("No Windows build in the latest release.")?;
    let url = plat["url"].as_str().ok_or("Missing download URL.")?.to_string();
    let sig = plat["signature"].as_str().ok_or("Missing signature.")?.to_string();
    if !url.to_lowercase().ends_with(".exe") {
        return Err("Latest release has no setup .exe.".into());
    }

    // 2. Download with real byte progress.
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?;
    let total = resp.content_length();
    let mut data: Vec<u8> = Vec::with_capacity(total.unwrap_or(0) as usize);
    let mut stream = resp.bytes_stream();
    let mut last = 0u64;
    emit(&app, "download", 0, total);
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        data.extend_from_slice(&chunk);
        let n = data.len() as u64;
        if n - last > 256 * 1024 { last = n; emit(&app, "download", n, total); }
    }
    if let Some(t) = total {
        if data.len() as u64 != t { return Err("Download was incomplete.".into()); }
    }
    emit(&app, "download", data.len() as u64, Some(data.len() as u64));

    // 3. Verify minisign signature with the embedded public key.
    emit(&app, "verify", 0, None);
    let pk = minisign_verify::PublicKey::decode(&b64(env!("DT_PUBKEY"))?).map_err(|e| e.to_string())?;
    let sg = minisign_verify::Signature::decode(&b64(&sig)?).map_err(|e| e.to_string())?;
    pk.verify(&data, &sg, true).map_err(|_| "Signature check failed — file was not installed.".to_string())?;

    // 4. Run the official NSIS setup silently.
    emit(&app, "install", 0, None);
    let path = std::env::temp_dir().join("DownTrack-latest-setup.exe");
    {
        let mut f = std::fs::File::create(&path).map_err(|e| e.to_string())?;
        f.write_all(&data).map_err(|e| e.to_string())?;
    }
    drop(data);
    let p2 = path.clone();
    let status = tauri::async_runtime::spawn_blocking(move || {
        let mut c = std::process::Command::new(&p2);
        c.arg("/S");
        silent(&mut c);
        c.status()
    }).await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&path);
    if !status.success() {
        return Err(format!("Setup exited with code {:?}.", status.code()));
    }

    // 5. Launch the installed app (per-user install dir of the NSIS bundle).
    emit(&app, "done", 0, None);
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let dir = std::path::Path::new(&local).join("DownTrack");
        for exe in ["DownTrack.exe", "downtrack.exe"] {
            let p = dir.join(exe);
            if p.exists() {
                let _ = std::process::Command::new(p).spawn();
                break;
            }
        }
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![install])
        .run(tauri::generate_context!())
        .expect("error while running DownTrack Setup");
}
