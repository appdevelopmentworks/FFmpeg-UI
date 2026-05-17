use std::io::Read;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

use crate::config;
use crate::error::{AppError, AppResult};
use crate::models::settings::{BinaryStatus, UpdateInfo};
use crate::platform;
use crate::services::process_manager;

// ── イベントペイロード ────────────────────────────────────────────────────────

#[derive(serde::Serialize, Clone)]
pub struct DownloadProgressPayload {
    pub tool:       String,
    pub percent:    f64,
    pub downloaded: u64,
    pub total:      u64,
}

#[derive(serde::Serialize, Clone)]
pub struct DownloadCompletePayload {
    pub tool:    String,
    pub version: String,
    pub path:    String,
}

#[derive(serde::Serialize, Clone)]
pub struct DownloadErrorPayload {
    pub tool:  String,
    pub error: String,
}

// ── バージョン文字列パース ────────────────────────────────────────────────────

/// `ffmpeg -version` 出力からバージョン文字列を抽出する
/// 例: "ffmpeg version 7.1-essentials_build Copyright..." → "7.1"
pub fn parse_ffmpeg_version(output: &str) -> Option<String> {
    let first = output.lines().next()?;
    let parts: Vec<&str> = first.split_whitespace().collect();
    if parts.len() >= 3 && parts[1] == "version" {
        let raw = parts[2];
        let version = raw.split('-').next().unwrap_or(raw);
        return Some(version.to_string());
    }
    None
}

/// `yt-dlp --version` 出力からバージョン文字列を抽出する
/// 例: "2026.03.15\n" → "2026.03.15"
pub fn parse_ytdlp_version(output: &str) -> Option<String> {
    let v = output.trim().to_string();
    if v.is_empty() { None } else { Some(v) }
}

/// バイナリが存在する場合のみバージョンを返す
pub async fn check_binary_version(
    path: &Path,
    args: &[&str],
    parse: fn(&str) -> Option<String>,
) -> Option<String> {
    if !path.exists() {
        return None;
    }
    let result = process_manager::run_command(&path.to_string_lossy(), args)
        .await
        .ok()?;
    // ffmpeg はバージョン情報を stderr に出力する
    let output = if result.stdout.is_empty() { &result.stderr } else { &result.stdout };
    parse(output)
}

// ── ダウンロード ──────────────────────────────────────────────────────────────

/// HTTP GET でファイルをダウンロードし、チャンク単位で進捗イベントを発行する
pub async fn download_file(
    url:  &str,
    dest: &Path,
    app:  &AppHandle,
    tool: &str,
) -> AppResult<()> {
    let client = reqwest::Client::builder()
        .user_agent("FFmpeg-UI/0.1")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()?;

    let resp = client
        .get(url)
        .send()
        .await?
        .error_for_status()
        .map_err(|e| AppError::DownloadFailed { message: e.to_string() })?;

    let total       = resp.content_length().unwrap_or(0);
    let mut fetched: u64 = 0;

    // 一時パスにまず書き込む
    let tmp = dest.with_extension("part");
    let mut file = tokio::fs::File::create(&tmp).await?;

    let mut response = resp;
    while let Some(chunk) = response.chunk().await.map_err(|e| AppError::DownloadFailed {
        message: e.to_string(),
    })? {
        file.write_all(&chunk).await?;
        fetched += chunk.len() as u64;

        let percent = if total > 0 {
            (fetched as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        let _ = app.emit(
            "setup:download-progress",
            DownloadProgressPayload {
                tool: tool.to_string(),
                percent,
                downloaded: fetched,
                total,
            },
        );
    }

    file.flush().await?;
    drop(file);

    tokio::fs::rename(&tmp, dest).await?;
    Ok(())
}

// ── SHA256 検証 ───────────────────────────────────────────────────────────────

pub fn compute_sha256(path: &Path) -> AppResult<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// yt-dlp の SHA256SUMS ファイルを取得してチェックサムを検証する
pub async fn verify_ytdlp_checksum(
    binary_path: &Path,
    client:      &reqwest::Client,
) -> AppResult<()> {
    let sums = client
        .get(platform::YTDLP_SHA256SUMS_URL)
        .send()
        .await?
        .text()
        .await?;

    let binary_name = platform::YTDLP_BIN;
    let expected = sums
        .lines()
        .find_map(|line| {
            let mut parts = line.split_whitespace();
            let hash = parts.next()?;
            let name = parts.next()?;
            if name == binary_name { Some(hash.to_string()) } else { None }
        })
        .ok_or_else(|| AppError::DownloadFailed {
            message: format!("SHA256 entry for '{binary_name}' not found in SUMS file"),
        })?;

    let actual = compute_sha256(binary_path)?;
    if actual != expected {
        return Err(AppError::ChecksumMismatch { expected, actual });
    }
    Ok(())
}

// ── ZIP 展開 ─────────────────────────────────────────────────────────────────

/// ZIP から指定サフィックスにマッチするエントリを dest_dir に展開する
/// `entries`: (ZIPエントリのサフィックス, 出力ファイル名)
pub fn extract_binaries_from_zip(
    archive_path: &Path,
    dest_dir:     &Path,
    entries:      &[(&str, &str)],
) -> AppResult<Vec<PathBuf>> {
    let file = std::fs::File::open(archive_path)?;
    let mut zip = zip::ZipArchive::new(file)?;
    let mut extracted: Vec<PathBuf> = Vec::new();

    for i in 0..zip.len() {
        let mut entry      = zip.by_index(i)?;
        let entry_name     = entry.name().replace('\\', "/");

        for &(suffix, out_name) in entries {
            if entry_name.ends_with(suffix) {
                let dest_path = dest_dir.join(out_name);
                let mut out   = std::fs::File::create(&dest_path)?;
                std::io::copy(&mut entry, &mut out)?;
                extracted.push(dest_path);
                break;
            }
        }
    }

    Ok(extracted)
}

// ── yt-dlp の最新バージョンを GitHub API で確認 ───────────────────────────────

pub async fn fetch_ytdlp_latest_version(client: &reqwest::Client) -> AppResult<String> {
    #[derive(serde::Deserialize)]
    struct GhRelease { tag_name: String }

    let release: GhRelease = client
        .get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
        .header("User-Agent", "FFmpeg-UI/0.1")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await?
        .json()
        .await?;

    Ok(release.tag_name)
}

// ── 高レベル: FFmpeg インストール ─────────────────────────────────────────────

pub async fn install_ffmpeg(app: &AppHandle) -> AppResult<String> {
    let bin_dir = config::binaries_dir();
    std::fs::create_dir_all(&bin_dir)?;

    let tmp_dir = config::temp_dir();
    std::fs::create_dir_all(&tmp_dir)?;

    let archive = tmp_dir.join("ffmpeg.zip");

    download_file(platform::FFMPEG_DOWNLOAD_URL, &archive, app, "ffmpeg").await?;

    // ZIPから ffmpeg と ffprobe を展開
    let zip_entries: &[(&str, &str)] = &[
        (platform::ffmpeg_entry_suffix(),  platform::FFMPEG_BIN),
        (platform::ffprobe_entry_suffix(), platform::FFPROBE_BIN),
    ];
    let extracted = extract_binaries_from_zip(&archive, &bin_dir, zip_entries)?;
    let _ = std::fs::remove_file(&archive);

    if extracted.is_empty() {
        return Err(AppError::DownloadFailed {
            message: "ffmpeg binary not found inside archive".to_string(),
        });
    }

    for path in &extracted {
        platform::set_executable(path)?;
    }

    // macOS では ffprobe を別 ZIP から追加取得
    if let Some(ffprobe_url) = platform::FFPROBE_DOWNLOAD_URL {
        let ffprobe_archive = tmp_dir.join("ffprobe.zip");
        download_file(ffprobe_url, &ffprobe_archive, app, "ffprobe").await?;
        let ffprobe_entries: &[(&str, &str)] = &[
            (platform::ffprobe_entry_suffix(), platform::FFPROBE_BIN),
        ];
        let extra = extract_binaries_from_zip(&ffprobe_archive, &bin_dir, ffprobe_entries)?;
        let _ = std::fs::remove_file(&ffprobe_archive);
        for path in extra {
            platform::set_executable(&path)?;
        }
    }

    let version = check_binary_version(
        &platform::ffmpeg_path(),
        &["-version"],
        parse_ffmpeg_version,
    )
    .await
    .unwrap_or_else(|| "unknown".to_string());

    Ok(version)
}

// ── 高レベル: yt-dlp インストール ────────────────────────────────────────────

pub async fn install_ytdlp(app: &AppHandle) -> AppResult<String> {
    let bin_dir = config::binaries_dir();
    std::fs::create_dir_all(&bin_dir)?;

    let dest = platform::ytdlp_path();
    download_file(platform::YTDLP_DOWNLOAD_URL, &dest, app, "ytdlp").await?;
    platform::set_executable(&dest)?;

    // SHA256 検証 (失敗しても継続)
    let client = reqwest::Client::builder().user_agent("FFmpeg-UI/0.1").build()?;
    if let Err(e) = verify_ytdlp_checksum(&dest, &client).await {
        eprintln!("[binary_manager] checksum warning: {e}");
    }

    let version = check_binary_version(
        &dest,
        &["--version"],
        parse_ytdlp_version,
    )
    .await
    .unwrap_or_else(|| "unknown".to_string());

    Ok(version)
}

// ── Real-ESRGAN インストール ──────────────────────────────────────────────────

/// Real-ESRGAN-ncnn-vulkan のZIPから、バイナリ + models/ をまるごと展開する
pub fn extract_realesrgan_zip(
    archive_path: &Path,
    bin_dir:      &Path,
) -> AppResult<PathBuf> {
    let file = std::fs::File::open(archive_path)?;
    let mut zip = zip::ZipArchive::new(file)?;

    let bin_name = platform::REALESRGAN_BIN;
    let mut bin_path: Option<PathBuf> = None;

    let models_dir = platform::realesrgan_models_dir();
    std::fs::create_dir_all(&models_dir)?;

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let entry_name = entry.name().replace('\\', "/");

        if entry.is_dir() {
            continue;
        }

        // バイナリ (任意のサブディレクトリ下に置かれていてもファイル名で判定)
        if entry_name.ends_with(bin_name) {
            let dest = bin_dir.join(bin_name);
            let mut out = std::fs::File::create(&dest)?;
            std::io::copy(&mut entry, &mut out)?;
            bin_path = Some(dest);
            continue;
        }

        // models/xxx.bin / models/xxx.param
        if let Some(idx) = entry_name.find("models/") {
            let rel = &entry_name[idx + "models/".len()..];
            if rel.is_empty() { continue; }
            let dest = models_dir.join(rel);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut out = std::fs::File::create(&dest)?;
            std::io::copy(&mut entry, &mut out)?;
        }
    }

    bin_path.ok_or_else(|| AppError::DownloadFailed {
        message: format!("'{bin_name}' not found inside Real-ESRGAN archive"),
    })
}

pub async fn install_realesrgan(app: &AppHandle) -> AppResult<String> {
    let bin_dir = config::binaries_dir();
    std::fs::create_dir_all(&bin_dir)?;

    let tmp_dir = config::temp_dir();
    std::fs::create_dir_all(&tmp_dir)?;

    let archive = tmp_dir.join("realesrgan.zip");

    download_file(platform::REALESRGAN_DOWNLOAD_URL, &archive, app, "realesrgan").await?;

    let bin_path = extract_realesrgan_zip(&archive, &bin_dir)?;
    let _ = std::fs::remove_file(&archive);

    platform::set_executable(&bin_path)?;

    // バージョンは取得できないリリースもあるので version 文字列は固定で返す
    Ok("v0.2.0".to_string())
}

// ── 全バイナリステータス確認 ──────────────────────────────────────────────────

pub async fn check_all_binaries() -> BinaryStatus {
    let ffmpeg_ver = check_binary_version(
        &platform::ffmpeg_path(),
        &["-version"],
        parse_ffmpeg_version,
    )
    .await;

    let ytdlp_ver = check_binary_version(
        &platform::ytdlp_path(),
        &["--version"],
        parse_ytdlp_version,
    )
    .await;

    let ffmpeg_path = platform::ffmpeg_path();
    let ytdlp_path  = platform::ytdlp_path();
    let realesrgan_path = platform::realesrgan_path();
    let realesrgan_models_dir = platform::realesrgan_models_dir();

    // Real-ESRGAN はバージョン取得APIを持たないので、バイナリ存在＋modelsディレクトリ存在で判定
    let realesrgan_installed = realesrgan_path.exists() && realesrgan_models_dir.exists();

    BinaryStatus {
        ffmpeg_installed: ffmpeg_ver.is_some(),
        ffmpeg_version:   ffmpeg_ver,
        ffmpeg_path:      if ffmpeg_path.exists() {
            Some(ffmpeg_path.to_string_lossy().to_string())
        } else {
            None
        },
        ytdlp_installed:  ytdlp_ver.is_some(),
        ytdlp_version:    ytdlp_ver,
        ytdlp_path:       if ytdlp_path.exists() {
            Some(ytdlp_path.to_string_lossy().to_string())
        } else {
            None
        },
        realesrgan_installed,
        realesrgan_version: if realesrgan_installed { Some("v0.2.0".to_string()) } else { None },
        realesrgan_path: if realesrgan_path.exists() {
            Some(realesrgan_path.to_string_lossy().to_string())
        } else {
            None
        },
    }
}

// ── アップデート確認 ──────────────────────────────────────────────────────────

pub async fn check_for_updates(
    _current_ffmpeg: Option<&str>,
    current_ytdlp:   Option<&str>,
) -> AppResult<UpdateInfo> {
    let client = reqwest::Client::builder().user_agent("FFmpeg-UI/0.1").build()?;

    let ytdlp_latest = fetch_ytdlp_latest_version(&client).await.ok();
    let ytdlp_update = match (&ytdlp_latest, current_ytdlp) {
        (Some(latest), Some(current)) => latest != current,
        (Some(_), None) => true,
        _ => false,
    };

    Ok(UpdateInfo {
        ffmpeg_update_available:  false, // 将来実装
        ffmpeg_latest_version:    None,
        ytdlp_update_available:   ytdlp_update,
        ytdlp_latest_version:     ytdlp_latest,
    })
}
