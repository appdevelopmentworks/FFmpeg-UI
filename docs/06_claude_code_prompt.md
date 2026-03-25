# FFmpeg-UI: Claude Code ハンドオフプロンプト

> このファイルは Claude Code でのバイブコーディング開始時に使用するプロンプトです。
> 各フェーズ・タスクごとにプロンプトをコピーして使用してください。
> **重要**: 各タスク開始時に必ず「共通指示」（本ファイル末尾）を追加してください。

---

## Phase 0 / Task 0-1: プロジェクト初期化

```
あなたはFFmpeg-UIプロジェクトの開発者です。
以下の仕様に基づいて、Tauri 2 + Next.js 15 のプロジェクトを初期化してください。

## プロジェクト概要
- プロジェクト名: FFmpeg-UI
- パス: C:\Users\hartm\Desktop\FFmpeg-UI
- docsフォルダに設計ドキュメントがあるので必ず先に全て読んでください:
  - docs/01_requirements.md (要求定義)
  - docs/02_architecture.md (アーキテクチャ設計)
  - docs/03_ui_wireframes.md (UIワイヤーフレーム)
  - docs/04_api_design.md (API設計)
  - docs/05_data_models.md (データモデル)

## 技術スタック
- Tauri 2.x (Rust バックエンド)
- Next.js 15 (App Router, SSG モード)
- React 19 + TypeScript 5.x
- Tailwind CSS 4
- Framer Motion
- Zustand (状態管理)
- next-intl (i18n: 日本語デフォルト + 英語)
- Lucide React (アイコン)

## このタスクで行うこと
1. `npm create tauri-app@latest` でTauri 2 + Next.js テンプレートからプロジェクト生成
   - すでに FFmpeg-UI ディレクトリに docs/ が存在するので、一時ディレクトリで生成してからマージするか、既存docsを退避してから初期化
2. 追加パッケージのインストール:
   - framer-motion, zustand, next-intl, lucide-react
   - @tauri-apps/plugin-shell, @tauri-apps/plugin-dialog, @tauri-apps/plugin-fs, @tauri-apps/plugin-store
   - Rust側: serde, serde_json, tokio (full features), thiserror, uuid, chrono, dirs, reqwest, sha2
3. Tailwind CSS 4 セットアップ（ダーク/ライトモード対応）
4. ESLint + Prettier 設定
5. tsconfig.json のパスエイリアス設定 (@/ → src/)
6. i18n 初期設定:
   - next-intl セットアップ
   - src/lib/i18n/ja.json と en.json を docs/05_data_models.md のセクション6の構造に基づいて作成
7. 基本レイアウト作成:
   - src/app/layout.tsx (テーマプロバイダー + i18nプロバイダー)
   - src/app/page.tsx (メインページ)
   - src/components/layout/Header.tsx (アプリ名 + テーマトグル + 言語切替)
   - src/components/layout/TabBar.tsx (8タブ: YouTube, 変換, カット, 分離, フィルター, バッチ, ストリーム, コマンド)
   - src/components/layout/JobQueueFooter.tsx (折りたたみ可能なジョブキュー)
   - src/components/tabs/ 配下に各タブの空プレースホルダーコンポーネント
8. Tauri設定:
   - tauri.conf.json: ウィンドウ 1280x800、最小 1024x768、タイトル "FFmpeg-UI"
   - docs/02_architecture.md のセクション6.1に従ったcapabilities設定
   - Cargo.toml に必要クレート追加
   - プラグイン登録（shell, dialog, fs, store）
   - main.rs にプラグイン初期化
9. ディレクトリ構成は docs/01_requirements.md のセクション7に従う
10. TypeScript型定義:
    - docs/05_data_models.md のセクション2に従い src/types/ 配下にファイル作成
    - media.ts, ffmpeg.ts, ytdlp.ts, job.ts, preset.ts, settings.ts, ui.ts
11. Rust モデル:
    - docs/05_data_models.md のセクション3に従い src-tauri/src/models/ 配下にファイル作成
    - mod.rs, media.rs, ffmpeg.rs, job.rs, ytdlp.rs, preset.rs, settings.rs
12. 空のcommands/とservices/ディレクトリ作成（mod.rs のみ）

## 注意事項
- 既存の docs/ フォルダは絶対に削除しないこと
- Windows環境で開発（パス区切りに注意）
- Next.js は SSG モード (output: 'export') で設定
```

---

## Phase 0 / Task 0-2: デザインシステム構築

```
FFmpeg-UIプロジェクトの続きです。
docs/03_ui_wireframes.md のセクション15（デザイントークン）を読んだ上で、
Awwwards級のデザインシステムを構築してください。

## タスク
1. Tailwind CSS 4 のカスタムテーマ設定:
   - docs/03_ui_wireframes.md セクション15のカラーパレットに基づく
   - ダークモード: メインBG #0a0a0f、アクセント #06d6a0 (Cyan)
   - ライトモード: メインBG #ffffff、アクセント #059669
   - フォント: Noto Sans JP + Inter + JetBrains Mono
   - Google Fonts のインポート設定

2. globals.css:
   - CSS変数でカラートークンを定義
   - ダーク/ライト切り替え用のメディアクエリとdata-theme属性
   - フォーカスリング、スクロールバー等のベーススタイル

3. 共通UIコンポーネント (src/components/ui/):
   - Button.tsx (primary / secondary / ghost / danger、サイズ sm/md/lg)
   - Input.tsx (テキスト入力、数値入力)
   - Select.tsx (ドロップダウン)
   - Slider.tsx (レンジスライダー + 値表示)
   - Toggle.tsx (ON/OFF スイッチ)
   - Card.tsx (コンテンツカード)
   - Badge.tsx (ステータスバッジ)
   - Tooltip.tsx
   - Modal.tsx (Framer Motion アニメーション付き)
   - ProgressBar.tsx (パーセンテージ + 色変化)
   - DropZone.tsx (ファイルD&D、ドラッグ中ハイライト)
   - SegmentedControl.tsx (映像+音声/映像のみ/音声のみ 等の切替)
   - Tabs.tsx (Framer Motion layoutId によるアニメーションインジケーター)

4. アニメーション定数 (src/lib/animations.ts):
   - docs/03_ui_wireframes.md セクション15のアニメーション定義に基づく
   - fadeIn, slideUp, tabSwitch, modalEnter, progressPulse 等

5. テーマ管理:
   - src/stores/uiStore.ts に theme 状態を追加
   - tauri-plugin-store で永続化
   - system 追従オプション (prefers-color-scheme)
   - Header.tsx のテーマトグルを実装

6. 全てのコンポーネントがダーク/ライト両モードで正しく表示されることを確認
```

---

## Phase 1 / Task 1-1: FFmpeg / yt-dlp 自動セットアップ

```
FFmpeg-UIプロジェクトの続きです。
docs/01_requirements.md のS-01、docs/04_api_design.md のセクション2に基づいて、
FFmpegとyt-dlpの自動ダウンロード・セットアップ機構を実装してください。

## Rust側 (src-tauri/src/)

1. services/binary_manager.rs:
   - アプリデータディレクトリにFFmpeg/yt-dlpを保存する仕組み
   - OS検出（Windows / macOS）と適切なバイナリURL解決
     - Windows FFmpeg: https://github.com/BtbN/FFmpeg-Builds/releases
       (ffmpeg-master-latest-win64-gpl.zip)
     - macOS FFmpeg: https://evermeet.cx/ffmpeg/ (静的バイナリ)
     - yt-dlp: https://github.com/yt-dlp/yt-dlp/releases/latest
   - reqwest でダウンロード（進捗はチャンク読みでイベント送信）
   - ZIP展開（Windows） / tar.xz展開（macOS）
   - SHA256チェックサム検証
   - バージョン確認 (ffmpeg -version, yt-dlp --version をパース)
   - バイナリのパス解決

2. services/process_manager.rs:
   - 外部プロセスの非同期実行（tokio::process::Command）
   - stderr リアルタイム読取
   - プロセスキャンセル（kill）
   - プロセス一時停止/再開（Windows: win32 API、macOS: SIGSTOP/SIGCONT）

3. commands/setup.rs:
   - docs/04_api_design.md セクション2の3コマンドを実装:
     - check_binaries, download_binary, check_updates
   - Tauriコマンドとしてregistration

4. config.rs:
   - アプリデータディレクトリの解決
   - バイナリ格納パスの定義
   - 設定ファイルパスの定義

5. error.rs:
   - docs/02_architecture.md セクション7.1の統一エラー型を実装

## フロントエンド側

6. src/components/setup/SetupDialog.tsx:
   - docs/03_ui_wireframes.md セクション14のデザインに基づく
   - 初回起動時（またはバイナリ未検出時）に表示されるモーダル
   - FFmpeg / yt-dlp それぞれのダウンロード状態表示
   - プログレスバー（ダウンロード進捗）
   - ダウンロード完了後に自動でダイアログを閉じる
   - エラー時のリトライボタン
   - スキップボタン

7. src/hooks/useSetup.ts:
   - アプリ起動時のバイナリチェック
   - ダウンロードイベントのリスナー管理
   - 状態: checking → downloading → ready / error

8. src/lib/tauri/commands.ts:
   - docs/04_api_design.md セクション11のSetup部分を実装

9. src/lib/tauri/events.ts:
   - docs/04_api_design.md セクション11のイベントリスナー部分を実装

## 注意事項
- Tauri 2 のイベントシステム（app.emit_to / listen）を使用
- ダウンロードは非同期でUIをブロックしない
- macOSの場合バイナリに実行権限を付与 (chmod +x)
- platform.rs でOS固有処理を抽象化（docs/02_architecture.md セクション9）
```

---

## Phase 1 / Task 1-2: YouTube ダウンロード + プレビュー

```
FFmpeg-UIプロジェクトの続きです。
docs/01_requirements.md のF-01、docs/04_api_design.md セクション4に基づいて、
YouTubeダウンロード + プレビュー機能を実装してください。

## Rust側

1. services/ytdlp_service.rs:
   - get_video_info: yt-dlp --dump-json でJSON取得 → VideoInfo にパース
   - get_formats: VideoInfoからフォーマット一覧抽出（映像+音声/映像のみ/音声のみに分類）
   - start_download: yt-dlp 実行（進捗パース → イベント送信）
     - yt-dlp の出力パターン: "[download]  45.2% of ~350.00MiB at 12.30MiB/s ETA 00:20"
     - 正規表現でパース
   - get_stream_url: yt-dlp -g でストリームURL取得

2. commands/ytdlp.rs:
   - docs/04_api_design.md セクション4の全コマンド:
     - fetch_video_info, start_download, cancel_download, get_preview_url
   - ジョブキューに登録してからダウンロード実行

## フロントエンド側

3. src/components/tabs/YouTubeTab.tsx:
   - docs/03_ui_wireframes.md セクション4のレイアウトに基づく
   - URL入力フィールド（ペースト検知で自動取得開始）
   - ローディングスケルトンUI
   - メディア情報カード: サムネイル + タイトル + チャンネル名 + 再生時間 + 投稿日
   - フォーマット選択:
     - SegmentedControl: 映像+音声 / 映像のみ / 音声のみ
     - 品質リスト（利用可能フォーマットを動的表示、サイズ推定付き）
   - ダウンロードボタン + 進捗バー
   - 出力先フォルダ選択（tauri-plugin-dialog）

4. src/hooks/useYtDlp.ts:
   - fetchVideoInfo(url): メタデータ取得
   - startDownload(params): ダウンロード開始 + 進捗リスナー
   - cancelDownload(jobId): キャンセル

5. Zustandストアにダウンロード状態を追加

## 注意事項
- エラーハンドリング: URL無効、地域制限、年齢制限
- プレイリストは将来対応（MVPでは単一動画のみ）
- yt-dlpのJSONパースはフィールドが大量にあるので、必要なものだけデシリアライズ
  (#[serde(default)] を活用)
```

---

## Phase 1 / Task 1-3: 音声/映像分離 + トリミング

```
FFmpeg-UIプロジェクトの続きです。
docs/01_requirements.md のF-02, F-03、docs/04_api_design.md セクション3, 5に基づいて、
音声/映像分離とトリミング機能を実装してください。

## Rust側

1. services/ffmpeg_service.rs:
   - probe_file: ffprobe -v quiet -print_format json -show_format -show_streams
     → JSON パース → MediaInfo
   - extract_streams: 指定ストリームの抽出 (ffmpeg -i input -map 0:N -c copy output)
   - trim_media: 時間範囲カット
     - 高速: ffmpeg -ss START -to END -i input -c copy output
     - 精密: ffmpeg -i input -ss START -to END output (再エンコード)
   - generate_thumbnails: ffmpeg -i input -vf "select='not(mod(n,N))'" -vsync vfr output_%03d.jpg
   - generate_waveform: ffmpeg -i input -ac 1 -filter:a aformat=sample_fmts=flt -f f32le pipe:1
     → f32サンプル読み取り → ダウンサンプリング
   - FFmpeg stderr パース:
     - 進捗行パターン: "frame= 1234 fps=89 q=23.0 size= 45678kB time=00:01:23.45 bitrate=..."
     - 正規表現で各値を抽出
     - duration と current_time から percent を計算

2. commands/ffmpeg.rs:
   - probe_media, extract_streams, trim_media
   - generate_thumbnails, generate_waveform
   - ジョブキューシステムとの連携

3. services/job_queue.rs (基本実装):
   - docs/02_architecture.md セクション3.3に基づく
   - ジョブの追加・キャンセル・状態管理
   - Arc<Mutex<VecDeque<Job>>> でキュー管理
   - tokio::spawn でワーカー実行
   - max_parallel_jobs 設定に基づく並行制御

4. commands/jobs.rs:
   - get_jobs, cancel_job, pause_job, resume_job, clear_completed_jobs

## フロントエンド側

5. src/components/tabs/ExtractTab.tsx:
   - docs/03_ui_wireframes.md セクション7のレイアウト
   - FileDropZone
   - ストリーム一覧（チェックボックス + コーデック情報 + 出力フォーマット選択）
   - 抽出実行ボタン

6. src/components/tabs/TrimTab.tsx:
   - docs/03_ui_wireframes.md セクション6のレイアウト
   - FileDropZone
   - Timeline コンポーネント:
     - サムネイルストリップ表示
     - 開始/終了マーカー（ドラッグ可能）
     - 選択範囲ハイライト
   - HH:MM:SS.ms 精密入力
   - カットモード選択（高速/精密）
   - MediaPlayer（選択範囲プレビュー）

7. src/components/shared/FileDropZone.tsx:
   - ドラッグ&ドロップ + クリックファイル選択
   - tauri-plugin-dialog でファイルダイアログ
   - 対応フォーマットのフィルタリング
   - ドラッグ中のシアンハイライトアニメーション

8. src/components/shared/MediaPlayer.tsx:
   - HTML5 <video> / <audio> ベースのカスタムプレーヤー
   - 再生/一時停止/シーク/音量
   - Tailwind + Framer Motionでカスタムコントロール

9. src/components/shared/Timeline.tsx:
   - サムネイルストリップ表示
   - 時間軸目盛り
   - ドラッグ可能なマーカー（useRef + onPointerDown/Move/Up）
   - 波形オーバーレイ（オプション）

10. src/hooks/useFFmpeg.ts:
    - probeMedia, extractStreams, trimMedia
    - generateThumbnails, generateWaveform

11. src/stores/jobStore.ts:
    - docs/02_architecture.md セクション5.1に基づく
    - ジョブキューの状態管理
    - イベントリスナー経由の進捗更新

12. src/components/layout/JobQueueFooter.tsx を実装:
    - docs/03_ui_wireframes.md セクション12のレイアウト
    - 折りたたみ/展開
    - アクティブジョブの進捗表示
    - 個別ジョブの操作（キャンセル、一時停止、優先度変更）
```

---

## Phase 2 / Task 2-1: フォーマット変換 + コーデック設定

```
FFmpeg-UIプロジェクトの続きです。
docs/01_requirements.md のF-04, F-05に基づいて、
フォーマット変換と詳細エンコード設定を実装してください。

## Rust側

1. ffmpeg_service.rs に追加:
   - build_command: FFmpegCommand → Vec<String>（コマンド引数配列生成）
   - detect_hw_encoders: ffmpeg -encoders 出力をパースしてHW対応検出
   - estimate_output_size: duration × bitrate で推定

2. commands/ffmpeg.rs に追加:
   - execute_ffmpeg, execute_raw_command
   - build_command_preview, estimate_output_size
   - detect_hw_encoders

## フロントエンド側

3. src/components/tabs/ConvertTab.tsx:
   - docs/03_ui_wireframes.md セクション5のレイアウト
   - FileDropZone + 入力ファイル情報パネル
   - 出力設定パネル:
     - プリセットセレクター
     - コンテナ選択（MP4, WebM, MKV, MOV, AVI, GIF...）
     - 映像コーデック選択（H.264, H.265, VP9, AV1, ProRes + HW変種）
     - 音声コーデック選択（AAC, MP3, OPUS, FLAC...）
     - 解像度設定（プリセット + カスタム + 「元を維持」）
     - ビットレートモード（CRF/CBR/VBR）+ 値スライダー
     - FPS選択
     - HWエンコード選択（自動検出結果を表示）
     - 2パスエンコードトグル
   - コマンドプレビュー表示（リアルタイム生成）
   - 出力サイズ推定
   - 変換ボタン

4. src/lib/ffmpeg/commandBuilder.ts:
   - FFmpegCommand → コマンド文字列の生成ロジック
   - フロントエンド側でのプレビュー用（実行はRust側）

5. src/lib/ffmpeg/presets.ts:
   - docs/05_data_models.md セクション4のビルトインプリセット定義

6. src/components/shared/PresetSelector.tsx:
   - プリセット一覧（カテゴリ分類）
   - ビルトイン / ユーザー切り替え
   - 選択時にConvertTabの設定を自動反映

7. プリセット管理:
   - commands/presets.rs (Rust)
   - src/stores/presetStore.ts (Zustand)
   - tauri-plugin-store でユーザープリセット永続化
```

---

## Phase 2 / Task 2-2: コマンドタブ

```
FFmpeg-UIプロジェクトの続きです。
docs/01_requirements.md セクション3.2とdocs/03_ui_wireframes.md セクション11に基づいて、
コマンド直接編集タブを実装してください。

## タスク

1. src/components/tabs/CommandTab.tsx:
   - FFmpegコマンドエディタ（テキストエリア + シンタックスハイライト）
   - シンタックスハイライト:
     - ffmpeg/ffprobe コマンド名: アクセントカラー
     - オプション (-i, -c:v, -vf 等): セカンダリカラー
     - 値/数値: テキストカラー
     - 文字列（クォート内）: 別カラー
     - 正規表現ベースの軽量ハイライト（外部ライブラリ不要）
   - ボタン: 実行 / コピー / テンプレート保存 / テンプレート一覧
   - テンプレートパネル（折りたたみ式、よく使うコマンドスニペット）
   - コマンド履歴（直近N件、クリックで再利用）
   - 実行ログ表示（monospaceフォント、スクロール可能、自動スクロール）

2. コマンド履歴管理:
   - tauri-plugin-store で永続化
   - 最大100件保持、古いものから削除

3. テンプレート管理:
   - ビルトインテンプレート（基本変換、GIF作成、音声抽出等）
   - ユーザーテンプレート保存/削除
```

---

## Phase 3 / Task 3-1: フィルターシステム

```
FFmpeg-UIプロジェクトの続きです。
docs/01_requirements.md のF-06、docs/05_data_models.md セクション5に基づいて、
フィルターシステムを実装してください。

## タスク

1. src/components/tabs/FilterTab.tsx:
   - docs/03_ui_wireframes.md セクション8のレイアウト
   - 3カラム構成: フィルターカタログ | プレビュー | パラメータ

2. フィルターカタログ (左パネル):
   - docs/05_data_models.md セクション5の FILTER_CATALOG を使用
   - カテゴリ分類（映像/音声、折りたたみ式）
   - 検索フィルター
   - クリックでフィルターチェーンに追加

3. フィルターチェーンビルダー (下部):
   - 適用済みフィルターのリスト表示
   - ドラッグ&ドロップで順序変更 (framer-motion reorder)
   - 個別ON/OFF切り替え
   - 削除ボタン
   - チェーンからFFmpegの -vf / -af 文字列を生成

4. パラメータ調整パネル:
   - 選択中フィルターのパラメータをFilterParamDefinitionに基づいて動的生成
   - number → Input, range → Slider, select → Select, boolean → Toggle
   - リアルタイムでコマンドプレビュー更新

5. Before/After プレビュー:
   - Split View（ドラッグで境界移動）
   - フィルター適用前と適用後の1フレーム比較
   - Rust側で ffmpeg -i input -vf "filters" -frames:v 1 -f image2 output.jpg を実行
   - フロントでBefore/After画像を並べて表示

6. フィルタープリセット:
   - フィルターチェーン全体をプリセットとして保存/読み込み
   - presetStore に統合

7. Rust側:
   - commands/ffmpeg.rs に apply_filter_preview コマンド追加
   - 1フレーム抽出 + フィルター適用のプレビュー画像生成
```

---

## Phase 3 / Task 3-2: バッチ処理

```
FFmpeg-UIプロジェクトの続きです。
docs/01_requirements.md のF-07に基づいて、バッチ処理機能を実装してください。

## タスク

1. src/components/tabs/BatchTab.tsx:
   - docs/03_ui_wireframes.md セクション9のレイアウト
   - 複数ファイルD&D + フォルダ選択
   - ファイルリストテーブル（ファイル名、サイズ、形式、状態、個別設定/削除）
   - 共通処理設定パネル（ConvertTabの設定UIを再利用）
   - ファイル名テンプレート（{name}, {format}, {date}, {resolution} 等のプレースホルダー）
   - 並列処理数スライダー
   - バッチ実行ボタン

2. Rust側:
   - commands/jobs.rs に batch_execute コマンド追加
   - 各ファイルを個別ジョブとしてキューに追加
   - ジョブキューの並行制御が自動で並列数を管理

3. ファイル名テンプレートエンジン:
   - {name}: 元のファイル名（拡張子なし）
   - {ext}: 元の拡張子
   - {format}: 出力フォーマット
   - {date}: 処理日時 (YYYYMMDD)
   - {datetime}: 処理日時 (YYYYMMDD_HHmmss)
   - {resolution}: 出力解像度 (1920x1080)
   - {n}: 連番
   - プレビュー表示

4. 完了通知:
   - 全ジョブ完了時にOS通知 (Tauri notification API)
```

---

## Phase 4 / Task 4-1: ストリーミング + 設定画面

```
FFmpeg-UIプロジェクトの続きです。
docs/01_requirements.md のF-08, S-04に基づいて、
ストリーミング機能と設定画面を実装してください。

## ストリーミング

1. src/components/tabs/StreamTab.tsx:
   - docs/03_ui_wireframes.md セクション10のレイアウト
   - URL入力 + プロトコル選択
   - 接続テスト + ストリーム情報表示
   - 録画設定（出力フォーマット、時間制限）
   - 録画開始/停止ボタン

2. Rust側:
   - services/ffmpeg_service.rs にストリーム関連メソッド追加
   - commands/ffmpeg.rs に probe_stream, start_recording, stop_recording 追加

## 設定画面

3. src/components/settings/SettingsModal.tsx:
   - docs/03_ui_wireframes.md セクション13のレイアウト
   - 一般設定: テーマ、言語、通知
   - 出力設定: デフォルト出力先、同名ファイル動作、ファイル名規則
   - パフォーマンス: 並列処理数
   - ツール: FFmpeg/yt-dlp バージョン表示、アップデート確認ボタン
   - データ: プリセット/設定のエクスポート・インポート・リセット

4. Rust側:
   - commands/settings.rs: get_settings, update_settings, reset_settings,
     export_settings, import_settings
   - tauri-plugin-store で永続化

5. src/stores/settingsStore.ts:
   - docs/02_architecture.md セクション5.1に基づく
   - 起動時にRust側から設定読み込み
   - 変更時にRust側に保存
```

---

## Phase 4 / Task 4-2: 最終調整・ビルド

```
FFmpeg-UIプロジェクトの最終フェーズです。
デザイン品質の最終調整とクロスプラットフォームビルドを行ってください。

## タスク

1. デザイン品質の最終調整:
   - 全タブのUIがdocs/03_ui_wireframes.mdのデザイントークンに準拠しているか確認
   - アニメーションの統一性チェック（タブ遷移、モーダル、ホバー）
   - ダーク/ライト両モードでの表示確認
   - フォントのレンダリング確認（Noto Sans JP + Inter）
   - アイコン統一性確認（全てLucide React）
   - エラー状態のUI確認（全タブ）
   - 空状態のUI確認（データなし時の表示）

2. i18n の完成:
   - 全UIテキストがi18n経由になっているか確認
   - ja.json / en.json の全キーが揃っているか確認
   - 英語翻訳の品質確認

3. キーボードショートカット:
   - Ctrl+1〜8: タブ切り替え
   - Ctrl+O: ファイルを開く
   - Ctrl+V: URLペースト（YouTubeタブ）
   - Space: 再生/一時停止
   - Escape: モーダルを閉じる

4. パフォーマンス最適化:
   - React.memo / useMemo / useCallback の適切な使用
   - サムネイルの遅延読み込み
   - 大きなリストの仮想化（ファイルリスト等）

5. ビルド設定:
   - next.config.ts: output: 'export', images: { unoptimized: true }
   - tauri.conf.json: バンドル設定（NSIS for Windows, DMG for macOS）
   - アプリアイコン作成（icons/配下にサイズ別PNG + ICO + ICNS）

6. README.md 作成:
   - プロジェクト概要
   - スクリーンショット
   - ビルド手順
   - 使い方

7. テストビルド:
   - npm run tauri build でWindows向けビルド確認
   - (macOS環境があれば) macOS向けビルド確認
```

---

## 共通指示（全タスクの末尾に追加）

```
## 共通ルール（必ず遵守）

### コーディング規約
- TypeScript strict モード
- 全UIテキストは next-intl を通す（ハードコードNG）
- コンポーネントは関数コンポーネント + React Hooks
- Tailwind CSS でスタイリング（インラインstyleは最小限）
- Framer Motion でアニメーション
- エラーハンドリングは必ず行う（try-catch + ユーザー通知トースト）
- console.log は開発時のみ（本番では除去前提）
- Rust側のエラーは Result<T, String> で返しフロントで処理
- 型定義は docs/05_data_models.md に従う

### Tauri 2 固有のルール
- invoke() の型パラメータは必ず指定
- イベント名は docs/02_architecture.md セクション4.2の命名規則に従う
- プラグインのAPIは @tauri-apps/plugin-xxx からインポート
- ファイルパスは Rust 側で正規化（OS差異を吸収）

### デザインルール
- docs/03_ui_wireframes.md セクション15のデザイントークンに準拠
- ダークモードをデフォルトとしてデザイン
- 0.5px ボーダー、8-12px radius
- アニメーション: 150-300ms, cubic-bezier(0.4, 0, 0.2, 1)
- Lucide React アイコン統一

### ファイル管理
- 既存の docs/ フォルダは絶対に変更・削除しないこと
- ファイルは docs/01_requirements.md セクション7のディレクトリ構成に従う
- 新規ファイル追加時はmod.rsやindex.tsのエクスポートも更新

### 参照ドキュメント
- 要求定義: docs/01_requirements.md
- アーキテクチャ: docs/02_architecture.md
- UIワイヤーフレーム: docs/03_ui_wireframes.md
- API設計: docs/04_api_design.md
- データモデル: docs/05_data_models.md
```
