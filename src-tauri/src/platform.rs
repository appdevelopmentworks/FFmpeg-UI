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
