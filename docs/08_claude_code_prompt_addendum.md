# FFmpeg-UI: Claude Code プロンプト 追補 (uv/ハイブリッド検出対応)

> **作成日**: 2026-03-25
> **目的**: 06_claude_code_prompt.md の補足。全タスクでこの内容も参照すること。

---

## 追加ドキュメント参照

全タスクの「docsフォルダに設計ドキュメントがあるので必ず先に全て読んでください」リストに以下を追加:

```
- docs/07_binary_detection.md (バイナリ検出・管理 ハイブリッド方式)
```

---

## Task 0-1 への追記

TypeScript型定義の BinaryStatus を 07_binary_detection.md セクション3.3 に従って更新すること。
`ffmpegSource` / `ytdlpSource` / `ffprobeInstalled` フィールドを追加。

---

## Task 1-1 の変更点（FFmpeg / yt-dlp セットアップ）

06_claude_code_prompt.md の Phase 1 / Task 1-1 を以下の方針に変更する。

### 変更前の方針
「初回起動時にGitHub Releasesからバイナリを自動ダウンロード」

### 変更後の方針（ハイブリッド検出）
docs/07_binary_detection.md に基づき、以下の優先順位で検出:
1. ユーザー指定パス（設定画面）
2. PATH上の既存バイナリ（uv, pip, brew, winget等）
3. アプリデータディレクトリ内（前回ダウンロード済み）
4. セットアップダイアログで自動ダウンロード提案

### Rust側の具体的な変更

1. services/binary_manager.rs:
   - docs/07_binary_detection.md セクション3.1 の `resolve_binary_path` を実装
   - `find_in_path`: `where`(Win) / `which`(macOS) でPATH検索
   - `get_version`: ffmpeg -version / yt-dlp --version をパース
   - `detect_source`: バイナリパスからインストール元を推定
   - ダウンロード機能は「PATH検出に失敗した場合のフォールバック」として実装

2. commands/setup.rs:
   - `check_binaries`: docs/07_binary_detection.md セクション3.2 に従い
     BinaryStatus に source フィールドを含める
   - `download_binary`: フォールバック用。PATH検出済みの場合はスキップ

### フロントエンド側の変更

3. SetupDialog.tsx:
   - docs/07_binary_detection.md セクション4 のUI設計に従う
   - PATH検出済みの場合: バージョンとソースを表示、「開始する」ボタン
   - 未検出の場合: 「自動ダウンロード」と「パスを手動指定」の選択肢
   - 手動インストールコマンドのヒント表示

4. 設定モーダルのツールセクション:
   - バイナリのパス、バージョン、ソースを表示
   - 「パス変更」「PATH再検出」ボタン
   - uv経由の場合はアップデートコマンドを案内

### 開発者環境情報
- 開発者は Python パッケージマネージャー `uv` を使用中
- yt-dlp は `uv tool install yt-dlp` でインストール済みの可能性が高い
- FFmpeg は winget または手動インストール
- Windows 環境で開発

---

## 共通指示への追記

```
### バイナリ検出ルール
- FFmpeg/yt-dlp のパス解決は docs/07_binary_detection.md のハイブリッド方式に従う
- PATH上の既存バイナリを最優先で使用する（自動ダウンロードは最終手段）
- BinaryStatus にはソース情報（uv/brew/pip/system/app-download）を含める
- uv経由でインストールされたyt-dlpのアップデートは、アプリ内ではなく
  uv tool upgrade コマンドの案内を表示する
```
