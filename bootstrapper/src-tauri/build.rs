// Embeds the updater public key (from the main app config) and the GitHub
// repository (from the CI env) so the online installer verifies exactly the
// same signed setup file the in-app auto-updater uses.
fn main() {
    let conf = std::fs::read_to_string("../../src-tauri/tauri.conf.json")
        .expect("main app tauri.conf.json not found");
    let v: serde_json::Value = serde_json::from_str(&conf).expect("invalid tauri.conf.json");
    let pubkey = v["plugins"]["updater"]["pubkey"].as_str().expect("updater pubkey missing");
    println!("cargo:rustc-env=DT_PUBKEY={pubkey}");
    let repo = std::env::var("DT_REPO").unwrap_or_default();
    println!("cargo:rustc-env=DT_REPO={repo}");
    println!("cargo:rerun-if-env-changed=DT_REPO");
    println!("cargo:rerun-if-changed=../../src-tauri/tauri.conf.json");
    tauri_build::build()
}
