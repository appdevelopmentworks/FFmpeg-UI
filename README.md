# FFmpeg-UI

FFmpeg と yt-dlp のモダン GUI デスクトップアプリ。

**Tauri 2 (Rust) + Next.js 15** 構成。

---

## 機能

- YouTube 動画ダウンロード（フォーマット・画質選択）
- 音声 / 映像ストリーム分離
- 動画トリミング（高速コピー / 精密再エンコード）
- フォーマット変換（Phase 2 以降）
- バッチ処理（Phase 3 以降）

---

## 開発環境のセットアップ

### 1. 前提条件

| ツール | バージョン | インストール方法 |
|--------|-----------|----------------|
| Node.js | 20 以上 | https://nodejs.org |
| Rust / Cargo | 最新安定版 | 下記参照 |
| Visual Studio | 2019 以上 | 下記参照 |

---

### 2. Rust のインストール（Windows）

PowerShell で以下を実行：

```powershell
winget install Rustlang.Rustup
```

インストール後、**PowerShell を再起動**してから確認：

```powershell
cargo --version
```

> **注意:** `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` は Linux/macOS 用です。Windows では使用しないでください。

---

### 3. Visual Studio C++ ビルドツール

Rust のコンパイルに MSVC ツールチェーンが必要です。

1. **Visual Studio Installer** を開く
2. インストール済みの Visual Studio の「**変更**」をクリック
3. 「**C++ によるデスクトップ開発**」にチェックを入れてインストール

Visual Studio がない場合は [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) から単体でインストールできます。

---

### 4. Tauri CLI のインストール

```powershell
cargo install tauri-cli --version "^2"
```

---

### 5. Node.js 依存パッケージのインストール

```powershell
npm install
```

---

### 6. 開発サーバーの起動

```powershell
cargo tauri dev
```

初回は Rust クレートのコンパイルに **5〜15 分**かかります。

---

## ビルド（配布用）

アイコンの準備（初回のみ）：

```powershell
cargo tauri icon src-tauri/icons/icon.ico
```

ビルド：

```powershell
cargo tauri build
```

生成物は `src-tauri/target/release/bundle/` に出力されます。

---

## よく使うコマンド

```powershell
npm run dev        # Next.js 開発サーバーのみ起動
npm run build      # 静的エクスポート（out/ に出力）
npm run lint       # ESLint チェック
cargo tauri dev    # デスクトップアプリ起動（推奨）
cargo tauri build  # 配布用バイナリビルド
```

---

## FFmpeg / yt-dlp について

アプリ起動時に自動的に存在確認を行います。

- システムの PATH に FFmpeg / yt-dlp がインストール済みの場合 → **そのまま使用**（ダウンロード不要）
- インストールされていない場合 → セットアップダイアログから自動ダウンロード

---

## 技術スタック

- **フロントエンド:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, Framer Motion, Zustand
- **バックエンド:** Tauri 2, Rust, tokio
- **i18n:** next-intl（日本語 / English）
