use std::path::{Path, PathBuf};
use crate::config;
use crate::error::AppResult;

// ── バイナリファイル名 ────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
pub const FFMPEG_BIN: &str = "ffmpeg.exe";
#[cfg(not(target_os = "windows"))]
pub const FFMPEG_BIN: &str = "ffmpeg";

#[cfg(target_os = "windows")]
pub const FFPROBE_BIN: &str = "ffprobe.exe";
#[cfg(not(target_os = "windows"))]
pub const FFPROBE_BIN: &str = "ffprobe";

#[cfg(target_os = "windows")]
pub const YTDLP_BIN: &str = "yt-dlp.exe";
#[cfg(not(target_os = "windows"))]
pub const YTDLP_BIN: &str = "yt-dlp";

#[cfg(target_os = "windows")]
pub const REALESRGAN_BIN: &str = "realesrgan-ncnn-vulkan.exe";
#[cfg(not(target_os = "windows"))]
pub const REALESRGAN_BIN: &str = "realesrgan-ncnn-vulkan";

// ── バイナリパス ─────────────────────────────────────────────────────────────

/// システム PATH からバイナリを探す
fn find_in_system_path(name: &str) -> Option<PathBuf> {
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    None
}

/// バイナリパスを解決する。
/// 1. アプリ管理 bin ディレクトリ
/// 2. システム PATH
/// 3. フォールバック (アプリ bin パス, 未インストール状態)
fn resolve_binary(bin_name: &str) -> PathBuf {
    let app_path = config::binaries_dir().join(bin_name);
    if app_path.exists() {
        return app_path;
    }
    find_in_system_path(bin_name).unwrap_or(app_path)
}

pub fn ffmpeg_path() -> PathBuf {
    resolve_binary(FFMPEG_BIN)
}

pub fn ffprobe_path() -> PathBuf {
    resolve_binary(FFPROBE_BIN)
}

pub fn ytdlp_path() -> PathBuf {
    resolve_binary(YTDLP_BIN)
}

pub fn realesrgan_path() -> PathBuf {
    resolve_binary(REALESRGAN_BIN)
}

#[cfg(target_os = "windows")]
pub const DENO_BIN: &str = "deno.exe";
#[cfg(not(target_os = "windows"))]
pub const DENO_BIN: &str = "deno";

#[cfg(target_os = "windows")]
const JS_RUNTIMES: &[(&str, &str)] = &[("deno", DENO_BIN), ("node", "node.exe"), ("bun", "bun.exe")];
#[cfg(not(target_os = "windows"))]
const JS_RUNTIMES: &[(&str, &str)] = &[("deno", DENO_BIN), ("node", "node"), ("bun", "bun")];

/// yt-dlp の YouTube 抽出 (EJS) に使う JavaScript ランタイムを探す。
/// 優先順: deno → node → bun（それぞれ アプリ bin → PATH）
pub fn js_runtime() -> Option<(&'static str, PathBuf)> {
    JS_RUNTIMES.iter().find_map(|(name, bin)| {
        let path = resolve_binary(bin);
        path.exists().then(|| (*name, path))
    })
}

/// Real-ESRGAN モデルファイル (.bin/.param) を配置するディレクトリ
pub fn realesrgan_models_dir() -> PathBuf {
    config::binaries_dir().join("models")
}

// ── ダウンロードURL ──────────────────────────────────────────────────────────
//
// Windows FFmpeg: BtbN GPL static builds (ZIP)
//   内部: ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe
//
// macOS FFmpeg: evermeet.cx static binary (ZIP, 単体バイナリ)
//   内部: ffmpeg
//
// yt-dlp: GitHub Releases 単体バイナリ

#[cfg(target_os = "windows")]
pub const FFMPEG_DOWNLOAD_URL: &str =
    "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";

#[cfg(target_os = "macos")]
pub const FFMPEG_DOWNLOAD_URL: &str = "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip";

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub const FFMPEG_DOWNLOAD_URL: &str = "";

// macOS では ffprobe も個別 ZIP から取得。Windows は FFmpeg ZIP に同梱。
#[cfg(target_os = "macos")]
pub const FFPROBE_DOWNLOAD_URL: Option<&str> =
    Some("https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip");

#[cfg(not(target_os = "macos"))]
pub const FFPROBE_DOWNLOAD_URL: Option<&str> = None;

#[cfg(target_os = "windows")]
pub const YTDLP_DOWNLOAD_URL: &str =
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";

#[cfg(target_os = "macos")]
pub const YTDLP_DOWNLOAD_URL: &str =
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub const YTDLP_DOWNLOAD_URL: &str =
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

pub const YTDLP_SHA256SUMS_URL: &str =
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS";

// Real-ESRGAN ncnn-vulkan: GitHub Releases にOS別ZIPが用意されている。
// ZIP内にバイナリと models/ ディレクトリ (.bin/.param) が同梱。
// 参照: https://github.com/xinntao/Real-ESRGAN/releases/tag/v0.2.5.0
#[cfg(target_os = "windows")]
pub const REALESRGAN_DOWNLOAD_URL: &str =
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip";

#[cfg(target_os = "macos")]
pub const REALESRGAN_DOWNLOAD_URL: &str =
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip";

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub const REALESRGAN_DOWNLOAD_URL: &str =
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip";

// 追加の AI 超解像モデル (ncnn 形式 .param/.bin)。realesrgan-ncnn-vulkan の models/ に
// `<id>.param` / `<id>.bin` で置けば `-n <id>` でそのまま使える。いずれも 4x 専用。
// Upscayl が ncnn 変換・公開しているものを、内容が変わらないようコミット固定で取得する。
// ライセンスはモデルごとに異なるため UI 側で表示する (UltraSharp / Remacri は CC BY-NC-SA 4.0)。
pub const AI_MODEL_DOWNLOADS: &[(&str, &str)] = &[
    (
        "ultrasharp-4x",
        "https://raw.githubusercontent.com/upscayl/upscayl/6cfaf45b2aae2847cba4f2313b57ca20a0ddd79c/resources/models/ultrasharp-4x",
    ),
    (
        "remacri-4x",
        "https://raw.githubusercontent.com/upscayl/upscayl/6cfaf45b2aae2847cba4f2313b57ca20a0ddd79c/resources/models/remacri-4x",
    ),
    (
        "realesr-general-x4v3",
        "https://raw.githubusercontent.com/upscayl/custom-models/500e6a0e8d60b1bf89c685391ef464f3b909b786/models/RealESRGAN_General_x4_v3",
    ),
];

/// models/ に `<id>.param` と `<id>.bin` が揃っているか
pub fn ai_model_installed(id: &str) -> bool {
    let dir = realesrgan_models_dir();
    dir.join(format!("{id}.param")).exists() && dir.join(format!("{id}.bin")).exists()
}

// Deno: yt-dlp の YouTube 抽出 (EJS) 用 JS ランタイム。
// GitHub Releases の OS/アーキテクチャ別 ZIP。ZIP 直下に deno(.exe) 単体が入っている。
#[cfg(target_os = "windows")]
pub const DENO_DOWNLOAD_URL: &str =
    "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip";

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
pub const DENO_DOWNLOAD_URL: &str =
    "https://github.com/denoland/deno/releases/latest/download/deno-aarch64-apple-darwin.zip";

#[cfg(all(target_os = "macos", not(target_arch = "aarch64")))]
pub const DENO_DOWNLOAD_URL: &str =
    "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-apple-darwin.zip";

#[cfg(all(not(any(target_os = "windows", target_os = "macos")), target_arch = "aarch64"))]
pub const DENO_DOWNLOAD_URL: &str =
    "https://github.com/denoland/deno/releases/latest/download/deno-aarch64-unknown-linux-gnu.zip";

#[cfg(all(not(any(target_os = "windows", target_os = "macos")), not(target_arch = "aarch64")))]
pub const DENO_DOWNLOAD_URL: &str =
    "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip";

// ── ZIP内でのバイナリエントリサフィックス ─────────────────────────────────────

/// ffmpeg ZIP内エントリのサフィックス (OSごとに構造が異なる)
#[cfg(target_os = "windows")]
pub fn ffmpeg_entry_suffix() -> &'static str {
    "bin/ffmpeg.exe"
}
#[cfg(not(target_os = "windows"))]
pub fn ffmpeg_entry_suffix() -> &'static str {
    "ffmpeg"
}

#[cfg(target_os = "windows")]
pub fn ffprobe_entry_suffix() -> &'static str {
    "bin/ffprobe.exe"
}
#[cfg(not(target_os = "windows"))]
pub fn ffprobe_entry_suffix() -> &'static str {
    "ffprobe"
}

// ── ファイルシステム権限 ─────────────────────────────────────────────────────

/// バイナリに実行権限を付与する (macOS/Linux で必要)
pub fn set_executable(path: &Path) -> AppResult<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(path)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(path, perms)?;
    }
    let _ = path;
    Ok(())
}

// ── プロセス制御 ─────────────────────────────────────────────────────────────

/// プロセスを一時停止する (Phase 2 で完全実装)
pub fn suspend_process(_pid: u32) -> AppResult<()> {
    // macOS/Linux: SIGSTOP
    // Windows: SuspendThread API (Phase 2 で実装)
    Ok(())
}

/// プロセスを再開する (Phase 2 で完全実装)
pub fn resume_process(_pid: u32) -> AppResult<()> {
    // macOS/Linux: SIGCONT
    // Windows: ResumeThread API (Phase 2 で実装)
    Ok(())
}
