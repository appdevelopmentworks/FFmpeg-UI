# FFmpeg-UI

FFmpeg と yt-dlp のモダン GUI デスクトップアプリ。

**Tauri 2 (Rust) + Next.js 15** 構成。

---

## 機能

| タブ | 機能 |
|------|------|
| **YouTube** | URL入力でサムネイルプレビュー・メタ情報取得・ダウンロード（ベスト画質/映像+音声/映像のみ/音声のみ） |
| **変換** | フォーマット変換・コーデック設定・プリセット管理・HWエンコード対応 |
| **カット** | タイムライン付きトリミング（高速コピー / フレーム精度） |
| **分離** | 音声/映像ストリームの個別抽出 |
| **フィルター** | 映像・音声フィルターチェーン（映像13種・音声6種） |
| **バッチ** | 複数ファイル一括処理（並列実行対応） |
| **ストリーム** | RTMP/HLS/DASHストリームの録画 |
| **コマンド** | FFmpegコマンド直接編集・シンタックスハイライト・履歴管理 |

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

```powershell
cargo tauri build
```

生成物は `src-tauri/target/release/bundle/` に出力されます。

> アイコンを差し替える場合は `cargo tauri icon your-image.png` で再生成してください。

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

## キーボードショートカット

| ショートカット | 動作 |
|--------------|------|
| `Ctrl+1〜8` | タブ切り替え |
| `Ctrl+Tab` | 次のタブへ |
| `Ctrl+Shift+Tab` | 前のタブへ |
| `Ctrl+O` | ファイルを開く（変換・カット・分離・フィルター・バッチ） |
| `Escape` | 設定モーダルを閉じる |

---

## FFmpeg / yt-dlp について

アプリ起動時に自動的に存在確認を行います。

- システムの PATH に FFmpeg / yt-dlp がインストール済みの場合 → **そのまま使用**（ダウンロード不要）
- インストールされていない場合 → セットアップダイアログから自動ダウンロード

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js 15 (App Router, SSG), React 19, TypeScript 5 |
| スタイリング | Tailwind CSS 4, Framer Motion |
| フォント | システムフォント (Segoe UI / Meiryo) — 外部ダウンロード不要 |
| 状態管理 | Zustand |
| i18n | next-intl（日本語/英語） |
| デスクトップ | Tauri 2 (Rust), tokio |
| アイコン | Lucide React |
| 外部ツール | FFmpeg, yt-dlp（初回起動時に自動ダウンロード） |
