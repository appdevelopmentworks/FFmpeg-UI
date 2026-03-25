use crate::models::settings::AppSettings;

/// 設定を取得する（ファイルから読み込み、存在しなければデフォルト値）
#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, String> {
    let path = crate::config::settings_file();

    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())?;

    serde_json::from_str(&content).map_err(|e| e.to_string())
}

/// 設定を保存する
#[tauri::command]
pub async fn update_settings(settings: AppSettings) -> Result<(), String> {
    let path = crate::config::settings_file();

    // 親ディレクトリが存在することを確認
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    tokio::fs::write(&path, json)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 設定をデフォルト値にリセットする
#[tauri::command]
pub async fn reset_settings() -> Result<AppSettings, String> {
    let defaults = AppSettings::default();
    update_settings(defaults.clone()).await?;
    Ok(defaults)
}
