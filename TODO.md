# FFmpeg-UI 開発 TODO

> 進捗管理リスト。完了したタスクは `- [x]` に変更してください。
> 各タスクの詳細プロンプトは `docs/06_claude_code_prompt.md` を参照。

---

## Phase 0: プロジェクト初期化

### Task 0-1: プロジェクト初期化 ✅
- [x] Tauri 2 + Next.js 15 プロジェクト構成
- [x] 追加パッケージインストール（framer-motion, zustand, next-intl, lucide-react 等）
- [x] Tauri プラグイン（shell, dialog, fs, store）
- [x] Rust クレート（serde, tokio, thiserror, uuid, chrono, dirs, reqwest, sha2）
- [x] Tailwind CSS 4 セットアップ（ダーク/ライトモード対応）
- [x] ESLint + Prettier 設定
- [x] tsconfig.json パスエイリアス（`@/` → `src/`）
- [x] next-intl セットアップ + ja.json / en.json 作成
- [x] 基本レイアウト（layout.tsx, page.tsx, globals.css）
- [x] Header.tsx（テーマトグル + 言語切替）
- [x] TabBar.tsx（8タブ）
- [x] JobQueueFooter.tsx（折りたたみ可能）
- [x] 各タブのプレースホルダーコンポーネント（8個）
- [x] tauri.conf.json（1280x800, 最小 1024x768）
- [x] capabilities/default.json
- [x] Cargo.toml + main.rs / lib.rs
- [x] TypeScript 型定義（src/types/ 全7ファイル）
- [x] Rust モデル（src-tauri/src/models/ 全7ファイル）
- [x] commands/ + services/ 骨格（mod.rs のみ）
- [x] Zustand ストア（job / settings / preset / media / ui）
- [x] Tauri ブリッジ（commands.ts / events.ts）
- [x] CLAUDE.md 作成
- [x] `npm run build` でビルド成功確認

### Task 0-2: デザインシステム構築 ✅
- [x] Google Fonts インポート（Noto Sans JP + Inter + JetBrains Mono）
- [x] globals.css 拡充（CSS変数・フォーカスリング・スクロールバー）
- [x] アニメーション定数（src/lib/animations.ts）
- [x] **共通UIコンポーネント（src/components/ui/）**
  - [x] Button.tsx（primary / secondary / ghost / danger、sm/md/lg）
  - [x] Input.tsx（テキスト・数値入力）
  - [x] Select.tsx（ドロップダウン）
  - [x] Slider.tsx（レンジスライダー + 値表示）
  - [x] Toggle.tsx（ON/OFFスイッチ）
  - [x] Card.tsx（コンテンツカード）
  - [x] Badge.tsx（ステータスバッジ）
  - [x] Tooltip.tsx
  - [x] Modal.tsx（Framer Motion アニメーション付き）
  - [x] ProgressBar.tsx（パーセンテージ + 色変化）
  - [x] DropZone.tsx（ファイルD&D、ドラッグ中ハイライト）
  - [x] SegmentedControl.tsx（映像+音声/映像のみ/音声のみ 等）
  - [x] Tabs.tsx（Framer Motion layoutId アニメーション）
- [x] ダーク/ライト両モードで全コンポーネント表示確認

---

## Phase 1: 基盤 + コア機能

### Task 1-1: FFmpeg / yt-dlp 自動セットアップ ✅
- [x] **Rust側**
  - [x] `src-tauri/src/error.rs`（統一エラー型）
  - [x] `src-tauri/src/config.rs`（アプリデータディレクトリ解決）
  - [x] `src-tauri/src/services/binary_manager.rs`
    - [x] OS検出（Windows / macOS）
    - [x] バイナリURL解決（FFmpeg / yt-dlp）
    - [x] reqwest でダウンロード（進捗イベント送信）
    - [x] ZIP / tar.xz 展開
    - [x] SHA256 チェックサム検証
    - [x] バージョン確認（ffmpeg -version, yt-dlp --version）
  - [x] `src-tauri/src/services/process_manager.rs`
    - [x] 非同期プロセス実行（tokio::process::Command）
    - [x] stderr リアルタイム読取
    - [x] プロセスキャンセル（kill）
    - [ ] プロセス一時停止/再開（スタブのみ）
  - [x] `src-tauri/src/commands/setup.rs`（check_binaries, download_binary, check_updates）
  - [x] lib.rs に新コマンドを登録
- [x] **フロントエンド側**
  - [x] `src/hooks/useSetup.ts`（バイナリチェック + イベントリスナー管理）
  - [x] `src/components/setup/SetupDialog.tsx`（初回起動時モーダル）
    - [x] FFmpeg / yt-dlp それぞれの進捗バー
    - [x] エラー時リトライボタン
    - [x] スキップボタン
  - [x] AppInitializer.tsx に起動時チェック追加

### Task 1-2: YouTube ダウンロード + プレビュー ✅
- [x] **Rust側**
  - [x] `src-tauri/src/services/ytdlp_service.rs`
    - [x] get_video_info（yt-dlp --dump-json → VideoInfo パース）
    - [x] get_formats（フォーマット分類）
    - [x] start_download（進捗パース + イベント送信）
    - [x] get_stream_url（yt-dlp -g）
  - [x] `src-tauri/src/commands/ytdlp.rs`（fetch_video_info, start_download, cancel_download, get_preview_url）
  - [x] lib.rs に新コマンドを登録
- [x] **フロントエンド側**
  - [x] `src/hooks/useYtDlp.ts`
  - [x] `src/components/tabs/YouTubeTab.tsx`（本実装）
    - [x] URL入力（ペースト検知で自動取得開始）
    - [x] ローディングスケルトンUI
    - [x] メディア情報カード（サムネイル + メタ情報）
    - [x] SegmentedControl（映像+音声 / 映像のみ / 音声のみ）
    - [x] 品質リスト（利用可能フォーマット動的表示）
    - [x] ダウンロードボタン + 進捗バー
    - [x] 出力先フォルダ選択

### Task 1-3: 音声/映像分離 + トリミング 🔄
- [x] **Rust側**
  - [x] `src-tauri/src/services/ffmpeg_service.rs`
    - [x] probe_file（ffprobe → MediaInfo パース）
    - [x] extract_streams
    - [x] trim_media（高速コピー / 精密再エンコード）
    - [x] generate_thumbnails
    - [x] generate_waveform
    - [x] FFmpeg stderr 進捗パース
  - [x] `src-tauri/src/services/job_queue.rs`
    - [x] ジョブ追加・キャンセル・状態管理
    - [x] Arc<Mutex<HashMap<Job>>> + JobStatus / JobType 管理（基本実装）
    - [x] emit_queue_updated（job:queue-updated イベント）
    - [ ] 並行数制御（max_parallel_jobs）
  - [x] `src-tauri/src/commands/ffmpeg.rs`（probe_media, extract_streams, trim_media, generate_thumbnails, generate_waveform）
  - [x] `src-tauri/src/commands/jobs.rs`（get_jobs, cancel_job, pause_job, resume_job, clear_completed_jobs, reorder_jobs）
  - [x] lib.rs に新コマンドを登録
- [x] **フロントエンド側**
  - [x] `src/components/shared/MediaPlayer.tsx`（HTML5 video/audio カスタムプレーヤー）
  - [x] `src/components/shared/Timeline.tsx`（TrimTab より抽出 + 波形オーバーレイ対応）
  - [x] `src/components/tabs/ExtractTab.tsx`（本実装）
    - [x] FileDropZone
    - [x] ストリーム一覧（チェックボックス + コーデック情報）
    - [x] 出力フォーマット選択
    - [x] 抽出実行ボタン
  - [x] `src/components/tabs/TrimTab.tsx`（本実装）
    - [x] FileDropZone
    - [x] Timeline コンポーネント（shared/Timeline を使用）
    - [x] HH:MM:SS.ms 精密入力
    - [x] カットモード選択
  - [x] `src/components/layout/JobQueueFooter.tsx`（job:queue-updated イベント連携・クリア・全キャンセル）
  - [x] `src/hooks/useFFmpeg.ts`（probe / thumbnails / waveform / trim / extract ユーティリティフック）
  - [x] jobStore に initListeners（job:queue-updated）/ clearCompleted 追加

---

## Phase 2: 変換 + エンコード

### Task 2-1: フォーマット変換 + コーデック設定
- [ ] **Rust側**
  - [ ] ffmpeg_service.rs に追加
    - [ ] build_command（FFmpegCommand → Vec<String>）
    - [ ] detect_hw_encoders
    - [ ] estimate_output_size
  - [ ] commands/ffmpeg.rs に追加（execute_ffmpeg, execute_raw_command, build_command_preview, estimate_output_size, detect_hw_encoders）
  - [ ] `src-tauri/src/commands/presets.rs`（get_presets, save_preset, delete_preset, export_presets, import_presets）
  - [ ] lib.rs に新コマンドを登録
- [ ] **フロントエンド側**
  - [ ] `src/lib/ffmpeg/commandBuilder.ts`
  - [ ] `src/lib/ffmpeg/presets.ts`（ビルトインプリセット定義）
  - [ ] `src/lib/ffmpeg/filters.ts`（フィルター定義カタログ）
  - [ ] `src/components/shared/PresetSelector.tsx`
  - [ ] `src/components/tabs/ConvertTab.tsx`（本実装）
    - [ ] FileDropZone + 入力ファイル情報パネル
    - [ ] プリセットセレクター
    - [ ] コンテナ / 映像コーデック / 音声コーデック選択
    - [ ] 解像度設定（プリセット + カスタム + 元を維持）
    - [ ] ビットレートモード（CRF/CBR/VBR）+ スライダー
    - [ ] FPS選択
    - [ ] HWエンコード選択
    - [ ] 2パスエンコードトグル
    - [ ] コマンドプレビュー（リアルタイム生成）
    - [ ] 出力サイズ推定
    - [ ] 変換ボタン
  - [ ] presetStore に Tauri 連携追加

### Task 2-2: コマンドタブ
- [ ] `src/components/tabs/CommandTab.tsx`（本実装）
  - [ ] FFmpegコマンドエディタ
  - [ ] シンタックスハイライト（正規表現ベース、外部ライブラリ不要）
  - [ ] 実行 / コピー / テンプレート保存 / テンプレート一覧ボタン
  - [ ] テンプレートパネル（ビルトイン + ユーザー）
  - [ ] コマンド履歴（直近N件、クリックで再利用）
  - [ ] 実行ログ表示（monospace、自動スクロール）
- [ ] コマンド履歴の永続化（tauri-plugin-store、最大100件）
- [ ] ユーザーテンプレートの保存/削除

---

## Phase 3: フィルター + バッチ

### Task 3-1: フィルターシステム
- [ ] `src/components/tabs/FilterTab.tsx`（本実装）
  - [ ] 3カラム構成（カタログ | プレビュー | パラメータ）
  - [ ] フィルターカタログ（カテゴリ分類 + 検索）
  - [ ] フィルターチェーンビルダー（Framer Motion reorder D&D）
  - [ ] 個別ON/OFF切り替え + 削除
  - [ ] パラメータ調整パネル（FilterParamDefinition に基づき動的生成）
  - [ ] Before/After Split View プレビュー
  - [ ] フィルタープリセット（保存/読み込み）
- [ ] Rust側: apply_filter_preview コマンド追加（1フレーム抽出 + フィルター適用）

### Task 3-2: バッチ処理
- [ ] `src/components/tabs/BatchTab.tsx`（本実装）
  - [ ] 複数ファイルD&D + フォルダ選択
  - [ ] ファイルリストテーブル（名前/サイズ/形式/状態/個別設定）
  - [ ] 共通処理設定パネル（ConvertTab UI 再利用）
  - [ ] ファイル名テンプレート（プレースホルダー + プレビュー）
  - [ ] 並列処理数スライダー
  - [ ] バッチ実行ボタン
- [ ] Rust側: batch_execute コマンド追加
- [ ] ファイル名テンプレートエンジン（{name}, {date}, {format} 等）
- [ ] 全ジョブ完了時 OS 通知

---

## Phase 4: 仕上げ

### Task 4-1: ストリーミング + 設定画面
- [ ] `src/components/tabs/StreamTab.tsx`（本実装）
  - [ ] URL入力 + プロトコル選択
  - [ ] 接続テスト + ストリーム情報表示
  - [ ] 録画設定（出力フォーマット、時間制限）
  - [ ] 録画開始/停止
- [ ] Rust側: probe_stream, start_recording, stop_recording
- [ ] `src/components/settings/SettingsModal.tsx`
  - [ ] 一般設定（テーマ・言語・通知）
  - [ ] 出力設定（デフォルト出力先・同名ファイル動作・ファイル名規則）
  - [ ] パフォーマンス（並列処理数）
  - [ ] ツール（FFmpeg/yt-dlp バージョン表示・アップデート確認）
  - [ ] データ（プリセット/設定のエクスポート・インポート・リセット）
- [x] Rust側: commands/settings.rs（get_settings, update_settings, reset_settings）
  - [ ] export_settings, import_settings
- [ ] Header.tsx の設定ボタンからモーダルを開く

### Task 4-2: 最終調整・ビルド
- [ ] **デザイン品質**
  - [ ] 全タブの UI がデザイントークンに準拠
  - [ ] アニメーション統一性チェック
  - [ ] ダーク/ライト両モード確認
  - [ ] フォントレンダリング確認
  - [ ] エラー状態・空状態のUI確認
- [ ] **i18n 完成**
  - [ ] 全UIテキストが i18n 経由になっているか確認
  - [ ] ja.json / en.json の全キー確認
- [ ] **キーボードショートカット**
  - [ ] Ctrl+1〜8: タブ切り替え
  - [ ] Ctrl+O: ファイルを開く
  - [ ] Ctrl+V: URLペースト（YouTubeタブ）
  - [ ] Space: 再生/一時停止
  - [ ] Escape: モーダルを閉じる
- [ ] **パフォーマンス最適化**
  - [ ] React.memo / useMemo / useCallback
  - [ ] サムネイル遅延読み込み
  - [ ] 大きなリストの仮想化
- [ ] **ビルド設定**
  - [ ] アプリアイコン作成（icons/ 配下、サイズ別 PNG + ICO + ICNS）
  - [ ] tauri.conf.json バンドル設定（NSIS / DMG）
  - [ ] `cargo tauri build` でWindows向けビルド確認
- [ ] README.md 作成

---

## 進捗サマリー

| フェーズ | タスク | 状態 |
|---------|--------|------|
| Phase 0 | 0-1: プロジェクト初期化 | ✅ 完了 |
| Phase 0 | 0-2: デザインシステム | ✅ 完了 |
| Phase 1 | 1-1: FFmpeg/yt-dlp セットアップ | ✅ 完了 |
| Phase 1 | 1-2: YouTubeダウンロード | ✅ 完了 |
| Phase 1 | 1-3: 分離 + トリミング | ✅ 完了 |
| Phase 2 | 2-1: フォーマット変換 | 🔲 未着手 |
| Phase 2 | 2-2: コマンドタブ | 🔲 未着手 |
| Phase 3 | 3-1: フィルターシステム | 🔲 未着手 |
| Phase 3 | 3-2: バッチ処理 | 🔲 未着手 |
| Phase 4 | 4-1: ストリーミング + 設定 | 🔲 未着手 |
| Phase 4 | 4-2: 最終調整・ビルド | 🔲 未着手 |
