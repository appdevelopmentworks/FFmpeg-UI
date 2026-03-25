use std::path::PathBuf;

const APP_NAME: &str = "ffmpeg-ui";

/// アプリのデータディレクトリを返す
/// Windows: %LOCALAPPDATA%\ffmpeg-ui
/// macOS:   ~/Library/Application Support/ffmpeg-ui
pub fn app_data_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    let base = dirs::data_local_dir();
    #[cfg(target_os = "macos")]
    let base = dirs::data_dir();
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let base = dirs::data_dir();

    base.unwrap_or_else(|| PathBuf::from(".")).join(APP_NAME)
}

/// バイナリ保存ディレクトリ
pub fn binaries_dir() -> PathBuf {
    app_data_dir().join("bin")
}

/// ダウンロード中間ファイル用の一時ディレクトリ
pub fn temp_dir() -> PathBuf {
    app_data_dir().join("tmp")
}

/// 設定ファイルパス
pub fn settings_file() -> PathBuf {
    app_data_dir().join("settings.json")
}

/// プリセットファイルパス
pub fn presets_file() -> PathBuf {
    app_data_dir().join("presets.json")
}
