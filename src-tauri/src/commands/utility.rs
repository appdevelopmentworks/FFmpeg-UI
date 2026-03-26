use crate::models::settings::SystemInfo;

/// ファイルを開くダイアログ
#[tauri::command]
pub async fn open_file_dialog(
    app: tauri::AppHandle,
    title: Option<String>,
    filters: Option<Vec<serde_json::Value>>,
    multiple: Option<bool>,
    directory: Option<bool>,
) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let mut builder = app.dialog().file();

    if let Some(t) = title {
        builder = builder.set_title(&t);
    }

    if let Some(fts) = filters {
        for f in &fts {
            if let (Some(name), Some(exts)) = (f["name"].as_str(), f["extensions"].as_array()) {
                let ext_vec: Vec<&str> = exts.iter().filter_map(|e| e.as_str()).collect();
                builder = builder.add_filter(name, &ext_vec);
            }
        }
    }

    let is_multiple = multiple.unwrap_or(false);
    let is_directory = directory.unwrap_or(false);

    if is_directory {
        let (tx, rx) = tokio::sync::oneshot::channel();
        builder.pick_folder(move |path| {
            let _ = tx.send(path);
        });
        match rx.await {
            Ok(Some(path)) => Ok(vec![path.to_string()]),
            _ => Ok(vec![]),
        }
    } else if is_multiple {
        let (tx, rx) = tokio::sync::oneshot::channel();
        builder.pick_files(move |paths| {
            let _ = tx.send(paths);
        });
        match rx.await {
            Ok(Some(paths)) => Ok(paths.iter().map(|p| p.to_string()).collect()),
            _ => Ok(vec![]),
        }
    } else {
        let (tx, rx) = tokio::sync::oneshot::channel();
        builder.pick_file(move |path| {
            let _ = tx.send(path);
        });
        match rx.await {
            Ok(Some(path)) => Ok(vec![path.to_string()]),
            _ => Ok(vec![]),
        }
    }
}

/// 保存ダイアログ
#[tauri::command]
pub async fn open_save_dialog(
    app: tauri::AppHandle,
    title: Option<String>,
    default_path: Option<String>,
    filters: Option<Vec<serde_json::Value>>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let mut builder = app.dialog().file();

    if let Some(t) = title {
        builder = builder.set_title(&t);
    }

    if let Some(dp) = default_path {
        builder = builder.set_file_name(&dp);
    }

    if let Some(fts) = filters {
        for f in &fts {
            if let (Some(name), Some(exts)) = (f["name"].as_str(), f["extensions"].as_array()) {
                let ext_vec: Vec<&str> = exts.iter().filter_map(|e| e.as_str()).collect();
                builder = builder.add_filter(name, &ext_vec);
            }
        }
    }

    let (tx, rx) = tokio::sync::oneshot::channel();
    builder.save_file(move |path| {
        let _ = tx.send(path);
    });

    match rx.await {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        _ => Ok(None),
    }
}

/// エクスプローラー/Finderでファイルを表示
#[tauri::command]
pub async fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        tokio::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        tokio::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let parent = std::path::Path::new(&path)
            .parent()
            .unwrap_or(std::path::Path::new("/"));
        tokio::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// システム情報を取得
#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    let cpu_cores = std::thread::available_parallelism()
        .map(|n| n.get() as u32)
        .unwrap_or(1);

    Ok(SystemInfo {
        os,
        arch,
        cpu_cores,
        total_memory: 0,
        gpu: None,
    })
}
