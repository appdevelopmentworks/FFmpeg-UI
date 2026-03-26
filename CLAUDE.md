# FFmpeg-UI — Claude Code ガイド

## プロジェクト概要

FFmpegとyt-dlpのモダンGUIデスクトップアプリ。
**Tauri 2 (Rust) + Next.js 15 (App Router, SSG)** 構成。

## よく使うコマンド

```bash
npm run dev          # Next.js 開発サーバー (http://localhost:3000)
npm run build        # 静的エクスポート → out/ に出力
cargo tauri dev      # Tauriデスクトップアプリ起動（必ずこちらで動作確認）
cargo tauri build    # 配布用バイナリビルド
npm run lint         # ESLint チェック
cargo check          # Rustコンパイルチェック（高速）
```

> **重要**: `npm run dev` だけではTauriのバックエンドが起動しない。
> 動作確認は必ず `cargo tauri dev` で行うこと。

## ディレクトリ構成

```
FFmpeg-UI/
├── docs/                     ← 設計ドキュメント（絶対に変更・削除しない）
├── src/                      ← Next.js フロントエンド
│   ├── app/                  ← App Router (layout.tsx, page.tsx, globals.css)
│   ├── components/
│   │   ├── layout/           ← Header, TabBar, JobQueueFooter
│   │   ├── tabs/             ← 8タブコンポーネント（全実装済み）
│   │   ├── setup/            ← SetupDialog.tsx
│   │   ├── settings/         ← SettingsModal.tsx
│   │   ├── shared/           ← Timeline, MediaPlayer, PresetSelector
│   │   └── ui/               ← Button, Select, Slider, DropZone 等
│   ├── hooks/                ← useYtDlp, useFFmpeg, useSetup, useTrim, useExtract
│   ├── stores/               ← Zustand ストア (12ストア)
│   │   └── ytdlpStore, settingsStore, setupStore, jobStore, mediaStore,
│   │       filterStore, batchStore, streamStore, trimStore, extractStore,
│   │       presetStore, uiStore
│   ├── types/                ← TypeScript型定義 (docs/05に準拠)
│   ├── lib/
│   │   ├── tauri/            ← commands.ts, events.ts (Tauriブリッジ)
│   │   └── i18n/             ← ja.json, en.json
│   ├── providers/            ← ThemeProvider, TranslationsProvider
│   └── i18n/request.ts       ← next-intl SSG設定
└── src-tauri/                ← Rust バックエンド
    ├── src/
    │   ├── main.rs / lib.rs
    │   ├── config.rs         ← アプリデータディレクトリ設定
    │   ├── platform.rs       ← バイナリパス解決・OS差異吸収
    │   ├── error.rs          ← AppError 型定義
    │   ├── models/           ← データ構造
    │   ├── commands/         ← setup, ytdlp, ffmpeg, jobs, presets,
    │   │                        settings, streaming, utility
    │   └── services/         ← binary_manager, ytdlp_service, ffmpeg_service,
    │                            job_queue, process_manager
    ├── capabilities/default.json
    └── tauri.conf.json
```

## 参照ドキュメント（必要な仕様が不明なときだけ参照）

| ドキュメント | 内容 |
|------------|------|
| `docs/01_requirements.md` | 機能要求・ディレクトリ構成 |
| `docs/02_architecture.md` | アーキテクチャ・イベント命名規則・Tauri capabilities |
| `docs/03_ui_wireframes.md` | UIレイアウト・デザイントークン (セクション15) |
| `docs/04_api_design.md` | Tauri コマンドAPI全定義 |
| `docs/05_data_models.md` | TypeScript/Rust型定義・i18nキー構造 |
| `docs/07_binary_detection.md` | バイナリ検出ハイブリッド方式（uv/PATH対応） |

## 技術スタック詳細

### フロントエンド
- **Next.js 15** — `output: 'export'` (SSG), App Router
- **React 19** — 関数コンポーネント + Hooks のみ
- **TypeScript 5** — `strict: true`, パスエイリアス `@/` → `src/`
- **Tailwind CSS 4** — `postcss.config.mjs` で設定、configファイル不要
  - ダークモード: `@custom-variant dark (&:is(.dark *))` (class-based)
  - デザイントークン: CSS変数 (`var(--bg-primary)` 等) で管理
- **Framer Motion** — アニメーション (150-300ms, cubic-bezier(0.4, 0, 0.2, 1))
- **Zustand** — 状態管理 (stores/ 配下)
- **next-intl** — i18n (ja/en、ロケール切替はZustandで管理)
- **Lucide React** — アイコン統一

### バックエンド (Rust)
- **Tauri 2** — IPC: `invoke()` / `listen()` / `emit()`
- **tokio** — 非同期ランタイム (full features)
- **serde/serde_json** — JSON シリアライズ
- **thiserror** — エラー型定義
- **reqwest** — HTTPクライアント（バイナリダウンロード）
- **uuid** — ジョブID生成

## コーディング規約

### TypeScript/React
- 全コンポーネント `'use client'` (SSGのためサーバーコンポーネントは最小限)
- UIテキストは必ず `useTranslations()` を通す（ハードコード禁止）
- スタイルは Tailwind CSS クラス優先。動的な色は `style={{ color: 'var(--xxx)' }}`
- `console.log` 禁止（`console.warn` / `console.error` は可）
- エラーハンドリング必須 (try-catch + ユーザー通知)

### Tauri / Rust
- `invoke<T>()` の型パラメータは必ず指定
- イベント名は `docs/02_architecture.md` セクション4.2の命名規則に従う
  - 例: `job:progress:{id}`, `download:complete:{id}`, `setup:check-result`
- Rustエラーは `Result<T, String>` で返す
- ファイルパスは Rust側で正規化（OS差異吸収）
- 新規コマンド追加時は `lib.rs` の `generate_handler![]` にも追加

### ファイル追加時のルール
- 新しいRustモジュール → `commands/mod.rs` または `services/mod.rs` に `pub mod xxx;` 追加
- 新しいTauriコマンド → `src-tauri/src/commands/` に追加 + `lib.rs` に登録
- 新しいサービス → `src-tauri/src/services/` に追加 + `lib.rs` の mod に追加

## デザインシステム

```css
/* ダークモード（デフォルト）カラー */
--bg-primary:    #0a0a0f    /* メインBG */
--bg-secondary:  #12121a    /* パネル・カード */
--bg-tertiary:   #1a1a25    /* ホバー・選択 */
--text-primary:  #e8e8ed    /* メインテキスト */
--text-secondary:#8888a0    /* 補助テキスト */
--text-tertiary: #55556a    /* 薄いテキスト */
--accent-cyan:   #06d6a0    /* プライマリアクション */
--accent-blue:   #4895ef    /* セカンダリアクション */
--border-default: rgba(255,255,255,0.08)  /* 0.5px ボーダー */
--status-success: #06d6a0
--status-warning: #ffd166
--status-error:   #ef476f
```

- ボーダー: `0.5px solid var(--border-default)`
- 角丸: `rounded-lg` (8px) または `rounded-xl` (12px)
- シャドウ: `var(--shadow-sm/md/lg)`

## 既知のバグ・課題（要対応）

### 1. ダウンロード完了イベントのフィールド名不一致（未修正）
- **場所**: `src-tauri/src/services/ytdlp_service.rs` の `DlCompletePayload`
- **問題**: Rustは `output_path`, `file_size`（snake_case）でemitするが、
  TypeScript側の `onDownloadComplete` は `outputPath`, `fileSize`（camelCase）を期待
- **影響**: ダウンロード完了後に出力パスが表示されない
- **修正方針**: Rust構造体に `#[serde(rename_all = "camelCase")]` を追加

### 2. YouTubeタブ「取得」ボタンのローディング表示バグ（修正済み 2026-03-26）
- `src/hooks/useYtDlp.ts` の `fetchInfo` で `setVideoInfo(null)` が `fetchState` を
  `'idle'` に戻してしまい、ローディングスピナーが表示されなかった
- `setVideoInfo(null)` → `setFetchState('loading')` の順に変更して修正済み

## 開発フェーズと実装状況

- **Phase 0** ✅ プロジェクト初期化・デザインシステム
- **Phase 1** ✅ FFmpeg/yt-dlp自動セットアップ + YouTube・分離・トリミング
- **Phase 2** ✅ フォーマット変換 + エンコード設定 + フィルター + バッチ処理
- **Phase 3** ✅ ストリーミング + 設定画面（プリセット・ジョブ管理含む）
- **Phase 4** 🔲 **現在のフォーカス**: バグ修正・最終調整・ビルド

### 実装済み機能一覧
| タブ | コンポーネント | 状態 |
|------|--------------|------|
| YouTube | YouTubeTab.tsx | ✅ |
| 変換 | ConvertTab.tsx | ✅ |
| カット | TrimTab.tsx | ✅ |
| 分離 | ExtractTab.tsx | ✅ |
| フィルター | FilterTab.tsx | ✅ |
| バッチ | BatchTab.tsx | ✅ |
| ストリーム | StreamTab.tsx | ✅ |
| コマンド | CommandTab.tsx | ✅ |
| 設定モーダル | SettingsModal.tsx | ✅ |
| セットアップダイアログ | SetupDialog.tsx | ✅ |

### 未コミットの変更（要コミット）
以下のファイルがワーキングツリーで変更中（`git status` で確認可能）:
- `src-tauri/src/commands/streaming.rs` (新規)
- `src-tauri/src/commands/utility.rs` (新規)
- `src-tauri/src/commands/mod.rs, presets.rs, settings.rs`
- `src-tauri/src/lib.rs`
- `src/components/tabs/FilterTab.tsx`
- `src/hooks/useYtDlp.ts` (2026-03-26のバグ修正)
- `src/lib/i18n/en.json, ja.json`

## 既知の制約・注意事項

1. **next-intl SSGの警告**: ビルド時に `ENVIRONMENT_FALLBACK` が出るが非致命的。
2. **Tauriコマンド引数**: `invoke()` の第2引数は `{ ...params }` でスプレッド推奨。
3. **`output: 'export'`**: middleware.ts は使用不可。Zustandでロケール管理。
4. **icons/**: `cargo tauri build` には `src-tauri/icons/` が必要。`cargo tauri icon` で生成。
5. **バイナリ検出**: yt-dlp/FFmpegは `%LOCALAPPDATA%\ffmpeg-ui\bin\` → PATH の順で探索。
   開発者環境では `uv tool install yt-dlp` でインストール済み（`C:\Users\hartm\.local\bin\`）。

## Claude Codeへの開発ルール（重要）

### コンテキスト節約のための運用ルール

1. **セッション開始時にdocs/を全読みしない**
   - CLAUDE.md に必要な情報は集約済み。毎回 docs/ を読むのは禁止。
   - 特定の仕様が必要なときだけ、該当ドキュメントの該当セクションだけを読む。

2. **タスクを自分で小さく分割して進める**
   - 1回のメッセージで実装するのは「1ファイル〜3ファイル程度」に留める。
   - 大きな機能は自分でサブタスクに分解し、1つずつ完了させる。

3. **ファイルを書く前に読みすぎない**
   - 参照すべきファイルは最大2〜3ファイルに絞る。
   - 似たコンポーネントのパターンを1つ読めば十分（全タブを読まない）。

4. **定期的に /compact を使う**
   - 実装が一区切りついたら /compact で圧縮してから次のタスクへ。

5. **サブエージェントは独立タスクにのみ使う**
   - 並列で書けるファイルはサブエージェントに委譲可。
   - 重要なファイルは親で直接書く。
