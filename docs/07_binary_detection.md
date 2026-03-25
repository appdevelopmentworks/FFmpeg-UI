# FFmpeg-UI バイナリ検出・管理 補足設計書

> **ドキュメント番号**: 07
> **作成日**: 2026-03-25
> **バージョン**: 1.0
> **目的**: 01_requirements.md のS-01、02_architecture.md を補足・上書き

---

## 1. 背景

開発者は Python パッケージマネージャー `uv` を使用している。
yt-dlp は Python パッケージであり、`uv tool install yt-dlp` でグローバルインストールすると
PATH にバイナリが配置される。FFmpeg-UI はこの既存インストールを優先的に利用すべきである。

---

## 2. バイナリ検出戦略（ハイブリッド方式）

01_requirements.md のS-01「初回起動時に自動ダウンロード」を以下のハイブリッド方式に変更する。

### 2.1 検出優先順位

```
1. ユーザー指定パス（設定画面で手動指定済みの場合）
      ↓ 未設定
2. PATH 上の既存バイナリ検出
   - Windows: `where ffmpeg` / `where yt-dlp`
   - macOS:   `which ffmpeg` / `which yt-dlp`
   - uv tool install、pip install、brew install、winget install 等で入れたものを検出
      ↓ 未検出
3. アプリデータディレクトリ内のバイナリ検出（前回ダウンロード済み）
   - Windows: %APPDATA%/ffmpeg-ui/bin/
   - macOS:   ~/Library/Application Support/ffmpeg-ui/bin/
      ↓ 未検出
4. セットアップダイアログ表示（自動ダウンロード提案）
   - GitHub Releases からスタンドアロンバイナリをダウンロード
```

### 2.2 各ツールのインストール方法対応表

#### yt-dlp

| 方法 | コマンド | バイナリ配置先 | PATH自動追加 |
|------|---------|---------------|-------------|
| uv tool install (推奨) | `uv tool install yt-dlp` | ~/.local/bin/yt-dlp | Yes |
| uv pip install | `uv pip install yt-dlp` | .venv/Scripts/yt-dlp | No (venv内) |
| pip install | `pip install yt-dlp` | Python Scripts/ | Usually Yes |
| brew install (macOS) | `brew install yt-dlp` | /opt/homebrew/bin/ | Yes |
| winget (Windows) | `winget install yt-dlp` | ProgramFiles/ | Yes |
| スタンドアロン | GitHub Releases | アプリ指定先 | No |

**推奨**: `uv tool install yt-dlp` — 仮想環境を汚さずグローバルにインストール。

#### FFmpeg

| 方法 | コマンド | バイナリ配置先 | PATH自動追加 |
|------|---------|---------------|-------------|
| winget (Windows, 推奨) | `winget install ffmpeg` | ProgramFiles/ | Yes |
| brew (macOS, 推奨) | `brew install ffmpeg` | /opt/homebrew/bin/ | Yes |
| choco (Windows) | `choco install ffmpeg` | C:\ProgramData\chocolatey\bin\ | Yes |
| スタンドアロン | GitHub Releases | アプリ指定先 | No |

**注意**: FFmpegはPythonパッケージではないため、uv/pipではインストール不可。
`python-ffmpeg` や `ffmpeg-python` はPythonバインディングであり、FFmpegバイナリ自体ではない。

---

## 3. Rust 実装詳細

### 3.1 BinaryManager の検出ロジック

```rust
// src-tauri/src/services/binary_manager.rs

use std::process::Command;
use std::path::{Path, PathBuf};

pub struct BinaryManager {
    app_data_dir: PathBuf,
}

impl BinaryManager {
    /// ハイブリッド検出: 設定 → PATH → アプリデータ → None
    pub async fn resolve_binary_path(
        &self,
        tool: &str,             // "ffmpeg" | "yt-dlp" | "ffprobe"
        user_path: Option<&str>, // 設定画面で指定されたパス
    ) -> Option<PathBuf> {
        // 1. ユーザー指定パス
        if let Some(path) = user_path {
            let p = PathBuf::from(path);
            if p.exists() {
                return Some(p);
            }
        }

        // 2. PATH 上の検索
        if let Some(path) = self.find_in_path(tool).await {
            return Some(path);
        }

        // 3. アプリデータディレクトリ内
        let app_binary = self.app_binary_path(tool);
        if app_binary.exists() {
            return Some(app_binary);
        }

        // 4. 見つからない
        None
    }

    /// PATH上のバイナリを検索
    async fn find_in_path(&self, tool: &str) -> Option<PathBuf> {
        let binary_name = if cfg!(target_os = "windows") {
            format!("{}.exe", tool)
        } else {
            tool.to_string()
        };

        // `which` (macOS/Linux) or `where` (Windows) コマンドで検索
        let result = if cfg!(target_os = "windows") {
            Command::new("where").arg(&binary_name).output()
        } else {
            Command::new("which").arg(&binary_name).output()
        };

        match result {
            Ok(output) if output.status.success() => {
                let path_str = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()?  // 最初の結果を使用
                    .trim()
                    .to_string();
                Some(PathBuf::from(path_str))
            }
            _ => None,
        }
    }

    /// バージョン取得
    pub async fn get_version(&self, binary_path: &Path, tool: &str) -> Option<String> {
        let arg = match tool {
            "ffmpeg" | "ffprobe" => "-version",
            "yt-dlp" => "--version",
            _ => return None,
        };

        let output = Command::new(binary_path).arg(arg).output().ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);

        match tool {
            "ffmpeg" => {
                // "ffmpeg version 7.1 Copyright..." → "7.1"
                stdout.split_whitespace().nth(2).map(|s| s.to_string())
            }
            "yt-dlp" => {
                // "2026.03.15" (1行目がそのままバージョン)
                stdout.lines().next().map(|s| s.trim().to_string())
            }
            _ => None,
        }
    }

    /// アプリデータ内のバイナリパス
    fn app_binary_path(&self, tool: &str) -> PathBuf {
        let binary_name = if cfg!(target_os = "windows") {
            format!("{}.exe", tool)
        } else {
            tool.to_string()
        };
        self.app_data_dir.join("bin").join(binary_name)
    }
}
```

### 3.2 check_binaries コマンド更新

```rust
#[tauri::command]
async fn check_binaries(
    state: State<'_, AppState>,
) -> Result<BinaryStatus, String> {
    let manager = &state.binary_manager;
    let settings = &state.settings;

    // FFmpeg
    let ffmpeg_path = manager.resolve_binary_path(
        "ffmpeg",
        settings.ffmpeg_path.as_deref(),
    ).await;

    let ffmpeg_version = match &ffmpeg_path {
        Some(p) => manager.get_version(p, "ffmpeg").await,
        None => None,
    };

    // ffprobe（FFmpegと同じディレクトリにあるはず）
    let ffprobe_path = manager.resolve_binary_path(
        "ffprobe",
        None,  // ffprobeは通常ffmpegと同じパスにある
    ).await;

    // yt-dlp
    let ytdlp_path = manager.resolve_binary_path(
        "yt-dlp",
        settings.ytdlp_path.as_deref(),
    ).await;

    let ytdlp_version = match &ytdlp_path {
        Some(p) => manager.get_version(p, "yt-dlp").await,
        None => None,
    };

    Ok(BinaryStatus {
        ffmpeg_installed: ffmpeg_path.is_some(),
        ffmpeg_version,
        ffmpeg_path: ffmpeg_path.map(|p| p.to_string_lossy().to_string()),
        ffmpeg_source: ffmpeg_path.as_ref().map(|p| detect_source(p)),
        ffprobe_installed: ffprobe_path.is_some(),
        ytdlp_installed: ytdlp_path.is_some(),
        ytdlp_version,
        ytdlp_path: ytdlp_path.map(|p| p.to_string_lossy().to_string()),
        ytdlp_source: ytdlp_path.as_ref().map(|p| detect_source(p)),
    })
}

/// バイナリのインストール元を推定
fn detect_source(path: &Path) -> String {
    let path_str = path.to_string_lossy().to_lowercase();

    if path_str.contains(".local/bin") || path_str.contains("uv") {
        "uv".to_string()
    } else if path_str.contains("homebrew") || path_str.contains("brew") {
        "brew".to_string()
    } else if path_str.contains("chocolatey") {
        "choco".to_string()
    } else if path_str.contains("pip") || path_str.contains("python") || path_str.contains("scripts") {
        "pip".to_string()
    } else if path_str.contains("ffmpeg-ui") {
        "app-download".to_string()
    } else {
        "system".to_string()
    }
}
```

### 3.3 BinaryStatus 型の拡張

```rust
// src-tauri/src/models/settings.rs に追加

#[derive(Debug, Serialize, Deserialize)]
pub struct BinaryStatus {
    pub ffmpeg_installed: bool,
    pub ffmpeg_version: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub ffmpeg_source: Option<String>,   // 追加: "uv", "brew", "pip", "system", "app-download"
    pub ffprobe_installed: bool,
    pub ytdlp_installed: bool,
    pub ytdlp_version: Option<String>,
    pub ytdlp_path: Option<String>,
    pub ytdlp_source: Option<String>,    // 追加
}
```

```typescript
// src/types/settings.ts の BinaryStatus を更新

export interface BinaryStatus {
  ffmpegInstalled: boolean;
  ffmpegVersion?: string;
  ffmpegPath?: string;
  ffmpegSource?: BinarySource;    // 追加
  ffprobeInstalled: boolean;
  ytdlpInstalled: boolean;
  ytdlpVersion?: string;
  ytdlpPath?: string;
  ytdlpSource?: BinarySource;    // 追加
}

export type BinarySource = 'uv' | 'brew' | 'pip' | 'choco' | 'system' | 'app-download';
```

---

## 4. セットアップダイアログの更新

### 4.1 検出済みの場合の表示

PATH上で既にバイナリが検出された場合、ダウンロードせずに確認表示のみ行う:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│            ◆ FFmpeg-UI セットアップ                               │
│                                                                  │
│   ┌────────────────────────────────────────────────────────────┐  │
│   │  FFmpeg                                           ✅ 検出  │  │
│   │  v7.1  ─  C:\ProgramData\chocolatey\bin\ffmpeg.exe        │  │
│   │  ソース: system (winget)                                   │  │
│   ├────────────────────────────────────────────────────────────┤  │
│   │  yt-dlp                                           ✅ 検出  │  │
│   │  v2026.03.15  ─  C:\Users\hartm\.local\bin\yt-dlp.exe    │  │
│   │  ソース: uv                                                │  │
│   └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│   ✅ 全てのツールが検出されました。                                │
│                                                                  │
│                                              [開始する]          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 一部未検出の場合

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│            ◆ FFmpeg-UI セットアップ                               │
│                                                                  │
│   ┌────────────────────────────────────────────────────────────┐  │
│   │  FFmpeg                                           ❌ 未検出 │  │
│   │  [自動ダウンロード]  or  [パスを手動指定...]               │  │
│   │                                                            │  │
│   │  💡 手動インストール方法:                                   │  │
│   │     Windows: winget install ffmpeg                         │  │
│   │     macOS:   brew install ffmpeg                           │  │
│   ├────────────────────────────────────────────────────────────┤  │
│   │  yt-dlp                                           ✅ 検出  │  │
│   │  v2026.03.15  ─  C:\Users\hartm\.local\bin\yt-dlp.exe    │  │
│   │  ソース: uv                                                │  │
│   └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. 設定画面のバイナリパス管理

### 5.1 設定モーダルのツールセクション更新

```
── ツール ─────────────────────────────────────────────────────

FFmpeg:  v7.1
  パス: C:\ProgramData\chocolatey\bin\ffmpeg.exe
  ソース: system
  [パス変更...]  [アップデート確認]  [PATH再検出]

yt-dlp:  v2026.03.15
  パス: C:\Users\hartm\.local\bin\yt-dlp.exe
  ソース: uv
  [パス変更...]  [アップデート確認]  [PATH再検出]
  💡 uv経由で更新: uv tool upgrade yt-dlp

ffprobe: v7.1
  パス: C:\ProgramData\chocolatey\bin\ffprobe.exe
  (ffmpegと同じディレクトリから自動検出)
```

### 5.2 アップデート方法の案内

uv経由でインストールされたyt-dlpの場合、アプリ内からの自動アップデートではなく
ユーザーのパッケージマネージャーを使ったアップデートを案内する:

```
yt-dlp の更新方法（ソース別）:
- uv:   uv tool upgrade yt-dlp
- pip:  pip install --upgrade yt-dlp
- brew: brew upgrade yt-dlp
- app-download: アプリ内の「アップデート確認」ボタンで自動更新
```

---

## 6. 開発者メモ

### 6.1 uv + yt-dlp の注意点

1. `uv tool install yt-dlp` は推奨方法。~/.local/bin/ にシムリンクが作成されPATHに追加される。
2. `uv pip install yt-dlp` は仮想環境内にインストールされるため、
   アプリからは直接見えない。この場合はユーザーが設定画面でパスを手動指定する必要がある。
3. yt-dlp は Python ランタイムが必要。uv tool install の場合は自動で管理されるので問題なし。
4. `uv tool upgrade yt-dlp` でアップデート可能。

### 6.2 FFmpegとuv

FFmpegはPythonパッケージではないため、uvでは管理できない。
Windows では winget、macOS では brew でのインストールを推奨する。
それ以外の場合はアプリ内自動ダウンロード機能を使用。

### 6.3 ffprobe

ffprobe は FFmpeg に同梱されている。FFmpeg のパスが見つかれば、
同じディレクトリに ffprobe も存在するはず。別途検出ロジックが必要。
