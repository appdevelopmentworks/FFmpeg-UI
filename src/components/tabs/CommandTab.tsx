'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Play,
  Copy,
  Save,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Trash2,
  Clock,
  CheckCircle,
  X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CommandTemplate {
  id: string;
  name: string;
  command: string;
  isBuiltin: boolean;
}

interface HistoryEntry {
  id: string;
  command: string;
  timestamp: number;
  status: 'success' | 'error' | 'running';
}

// ── Builtin templates ─────────────────────────────────────────────────────────

const BUILTIN_TEMPLATES: CommandTemplate[] = [
  {
    id: 'basic-convert',
    name: '基本変換 (H.264)',
    command: 'ffmpeg -i "{input}" -c:v libx264 -crf 23 -c:a aac -b:a 192k "{output}.mp4"',
    isBuiltin: true,
  },
  {
    id: 'gif-create',
    name: 'GIF作成',
    command: 'ffmpeg -i "{input}" -vf "fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "{output}.gif"',
    isBuiltin: true,
  },
  {
    id: 'audio-extract',
    name: '音声抽出 (MP3)',
    command: 'ffmpeg -i "{input}" -vn -c:a libmp3lame -q:a 2 "{output}.mp3"',
    isBuiltin: true,
  },
  {
    id: 'resize-1080p',
    name: '1080pリサイズ',
    command: 'ffmpeg -i "{input}" -vf scale=1920:1080 -c:v libx264 -crf 23 -c:a copy "{output}.mp4"',
    isBuiltin: true,
  },
  {
    id: 'trim-copy',
    name: 'トリミング (高速)',
    command: 'ffmpeg -ss 00:00:10 -to 00:01:00 -i "{input}" -c copy "{output}.mp4"',
    isBuiltin: true,
  },
  {
    id: 'hls-create',
    name: 'HLS変換',
    command: 'ffmpeg -i "{input}" -c:v libx264 -crf 23 -hls_time 10 -hls_list_size 0 "{output}.m3u8"',
    isBuiltin: true,
  },
  {
    id: 'webm-vp9',
    name: 'WebM (VP9)',
    command: 'ffmpeg -i "{input}" -c:v libvpx-vp9 -crf 33 -b:v 0 -c:a libopus -b:a 128k "{output}.webm"',
    isBuiltin: true,
  },
  {
    id: 'concat',
    name: 'ファイル結合',
    command: 'ffmpeg -f concat -safe 0 -i filelist.txt -c copy "{output}.mp4"',
    isBuiltin: true,
  },
];

// ── Syntax highlighter ────────────────────────────────────────────────────────

function highlightCommand(text: string): string {
  if (!text) return '';
  // Escape HTML
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let result = '';
  let i = 0;
  const chars = text;

  while (i < chars.length) {
    // Quoted string
    if (chars[i] === '"' || chars[i] === "'") {
      const quote = chars[i];
      let j = i + 1;
      while (j < chars.length && chars[j] !== quote) {
        if (chars[j] === '\\') j++;
        j++;
      }
      const token = chars.slice(i, j + 1);
      result += `<span style="color:var(--status-warning)">${esc(token)}</span>`;
      i = j + 1;
      continue;
    }

    // Skip whitespace
    if (chars[i] === ' ' || chars[i] === '\t' || chars[i] === '\n') {
      result += chars[i] === '\n' ? '<br/>' : ' ';
      i++;
      continue;
    }

    // Read token
    let j = i;
    while (
      j < chars.length &&
      chars[j] !== ' ' &&
      chars[j] !== '\t' &&
      chars[j] !== '\n' &&
      chars[j] !== '"' &&
      chars[j] !== "'"
    ) {
      j++;
    }
    const token = chars.slice(i, j);
    i = j;

    if (!token) {
      i++;
      continue;
    }

    // ffmpeg / ffprobe command name
    if (/^ffm?peg$/i.test(token) || /^ffprobe$/i.test(token)) {
      result += `<span style="color:var(--accent-cyan);font-weight:600">${esc(token)}</span>`;
    }
    // Flag (-i, -c:v, -vf, etc.)
    else if (token.startsWith('-')) {
      result += `<span style="color:var(--accent-blue)">${esc(token)}</span>`;
    }
    // Pure number
    else if (/^[\d.]+$/.test(token)) {
      result += `<span style="color:#ffd166">${esc(token)}</span>`;
    }
    // Filter chain or codec name (contains = or comma)
    else if (token.includes('=') || token.includes(',')) {
      result += `<span style="color:var(--status-success)">${esc(token)}</span>`;
    }
    // Default
    else {
      result += `<span style="color:var(--text-primary)">${esc(token)}</span>`;
    }
  }

  return result;
}

// ── Storage helpers ────────────────────────────────────────────────────────────

const HISTORY_KEY = 'ffmpeg-ui:command-history';
const USER_TEMPLATES_KEY = 'ffmpeg-ui:command-templates';
const MAX_HISTORY = 100;

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

function loadUserTemplates(): CommandTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(USER_TEMPLATES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveUserTemplates(templates: CommandTemplate[]) {
  try {
    localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // ignore
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CommandTab() {
  const t = useTranslations('command');
  const tc = useTranslations('common');

  const [command, setCommand] = useState('');
  const [outputLog, setOutputLog] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [userTemplates, setUserTemplates] = useState<CommandTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [templateTab, setTemplateTab] = useState<'builtin' | 'user'>('builtin');
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Load persisted state
  useEffect(() => {
    setHistory(loadHistory());
    setUserTemplates(loadUserTemplates());
  }, []);

  // Sync scroll between textarea and highlight div
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [outputLog]);

  // Cleanup event listener on unmount
  useEffect(() => {
    return () => {
      unlistenRef.current?.();
    };
  }, []);

  const highlightedHtml = useMemo(() => highlightCommand(command), [command]);

  // Execute command
  const handleExecute = useCallback(async () => {
    const cmd = command.trim();
    if (!cmd || isRunning) return;

    setOutputLog([`$ ${cmd}`, '']);
    setIsRunning(true);

    try {
      const { executeRawCommand } = await import('@/lib/tauri/commands');
      const { listen } = await import('@tauri-apps/api/event');

      const jobId = await executeRawCommand(cmd);
      setCurrentJobId(jobId);

      // Add to history
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        command: cmd,
        timestamp: Date.now(),
        status: 'running',
      };
      const newHistory = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(newHistory);
      saveHistory(newHistory);

      // Listen for progress
      const unlistenProgress = await listen<{ percent: number; speed: string; eta?: string }>(
        `job:progress:${jobId}`,
        (e) => {
          const { percent, speed, eta } = e.payload;
          setOutputLog((prev) => {
            const lines = [...prev];
            const progressLine = `  [${Math.round(percent).toString().padStart(3)}%] speed=${speed}${eta ? ` eta=${eta}` : ''}`;
            // Replace last progress line or append
            let lastIdx = -1;
            for (let k = lines.length - 1; k >= 0; k--) {
              if (lines[k].startsWith('  [')) { lastIdx = k; break; }
            }
            if (lastIdx >= 0) {
              lines[lastIdx] = progressLine;
            } else {
              lines.push(progressLine);
            }
            return lines;
          });
        },
      );

      const unlistenComplete = await listen<{ outputPath: string; durationMs: number }>(
        `job:complete:${jobId}`,
        (e) => {
          setOutputLog((prev) => [
            ...prev,
            ``,
            `✓ ${t('logComplete')}: ${e.payload.outputPath}`,
          ]);
          setIsRunning(false);
          updateHistoryStatus(jobId, 'success');
          unlistenProgress();
          unlistenComplete();
          unlistenError();
        },
      );

      const unlistenError = await listen<{ message: string; stderr: string }>(
        `job:error:${jobId}`,
        (e) => {
          setOutputLog((prev) => [
            ...prev,
            ``,
            `✗ ${t('logError')}: ${e.payload.message}`,
            ...(e.payload.stderr ? e.payload.stderr.split('\n').slice(-5) : []),
          ]);
          setIsRunning(false);
          updateHistoryStatus(jobId, 'error');
          unlistenProgress();
          unlistenComplete();
          unlistenError();
        },
      );

      unlistenRef.current = () => {
        unlistenProgress();
        unlistenComplete();
        unlistenError();
      };
    } catch (e) {
      setOutputLog((prev) => [...prev, `✗ ${t('logError')}: ${e instanceof Error ? e.message : String(e)}`]);
      setIsRunning(false);
    }
  }, [command, isRunning, history]);

  function updateHistoryStatus(jobId: string, status: HistoryEntry['status']) {
    setHistory((prev) => {
      const updated = prev.map((h) =>
        h.status === 'running' ? { ...h, status } : h,
      );
      saveHistory(updated);
      return updated;
    });
  }

  // Copy command
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [command]);

  // Save template
  const handleSaveTemplate = useCallback(() => {
    const name = saveTemplateName.trim();
    if (!name || !command.trim()) return;
    const tmpl: CommandTemplate = {
      id: crypto.randomUUID(),
      name,
      command: command.trim(),
      isBuiltin: false,
    };
    const updated = [...userTemplates, tmpl];
    setUserTemplates(updated);
    saveUserTemplates(updated);
    setSaveTemplateName('');
    setShowSaveInput(false);
  }, [saveTemplateName, command, userTemplates]);

  // Delete user template
  const handleDeleteTemplate = useCallback(
    (id: string) => {
      const updated = userTemplates.filter((t) => t.id !== id);
      setUserTemplates(updated);
      saveUserTemplates(updated);
    },
    [userTemplates],
  );

  // Use template
  const handleUseTemplate = useCallback((tmpl: CommandTemplate) => {
    setCommand(tmpl.command);
    textareaRef.current?.focus();
  }, []);

  // Use history entry
  const handleUseHistory = useCallback((entry: HistoryEntry) => {
    setCommand(entry.command);
    textareaRef.current?.focus();
  }, []);

  // Clear history
  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const displayedTemplates =
    templateTab === 'builtin' ? BUILTIN_TEMPLATES : userTemplates;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* ── Command editor ───────────────────────────────────────────────── */}
      <div
        className="flex flex-col overflow-hidden rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
          flex: '0 0 auto',
          minHeight: 140,
        }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center justify-between p-3"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-2">
            <Terminal size={14} style={{ color: 'var(--text-tertiary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('editor')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExecute}
              disabled={!command.trim() || isRunning}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                backgroundColor:
                  !command.trim() || isRunning
                    ? 'var(--bg-tertiary)'
                    : 'var(--accent-cyan-dim)',
                color:
                  !command.trim() || isRunning
                    ? 'var(--text-tertiary)'
                    : 'var(--accent-cyan)',
                cursor: !command.trim() || isRunning ? 'not-allowed' : 'pointer',
              }}
            >
              <Play size={11} />
              {isRunning ? t('running') : t('execute')}
            </button>
            <button
              onClick={handleCopy}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ color: copied ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
              title={tc('copy')}
            >
              {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
            </button>
            <button
              onClick={() => setShowSaveInput((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title={t('saveTemplate')}
            >
              <Save size={13} />
            </button>
            <button
              onClick={() => {
                setShowTemplates((v) => !v);
                setShowHistory(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{
                color: showTemplates ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              }}
              title={t('templates')}
            >
              <FolderOpen size={13} />
            </button>
            <button
              onClick={() => {
                setShowHistory((v) => !v);
                setShowTemplates(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{
                color: showHistory ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              }}
              title={t('history')}
            >
              <Clock size={13} />
            </button>
          </div>
        </div>

        {/* Save template input */}
        <AnimatePresence>
          {showSaveInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
              style={{ borderBottom: '0.5px solid var(--border-default)' }}
            >
              <div className="flex items-center gap-2 p-3">
                <input
                  type="text"
                  className="flex-1 rounded-md px-2.5 py-1.5 text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '0.5px solid var(--border-default)',
                  }}
                  placeholder={t('templateNamePlaceholder')}
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                  autoFocus
                />
                <button
                  onClick={handleSaveTemplate}
                  className="rounded-md px-2.5 py-1.5 text-xs"
                  style={{
                    backgroundColor: 'var(--accent-cyan-dim)',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  {tc('add')}
                </button>
                <button
                  onClick={() => setShowSaveInput(false)}
                  className="flex h-6 w-6 items-center justify-center"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor area (syntax highlighting overlay) */}
        <div className="relative flex-1" style={{ minHeight: 100 }}>
          {/* Highlighted div */}
          <div
            ref={highlightRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-auto p-4 text-sm"
            style={{
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: '1.6',
            }}
            dangerouslySetInnerHTML={{ __html: highlightedHtml || `<span style="color:var(--text-tertiary)">ffmpeg -i "input.mp4" -c:v libx264 -crf 23 -c:a aac "output.mp4"</span>` }}
          />
          {/* Transparent textarea on top */}
          <textarea
            ref={textareaRef}
            className="absolute inset-0 w-full h-full resize-none bg-transparent p-4 text-sm outline-none"
            style={{
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: '1.6',
              color: 'transparent',
              caretColor: 'var(--text-primary)',
              overflow: 'auto',
            }}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onScroll={syncScroll}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>

      {/* ── Templates panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            {/* Tabs */}
            <div
              className="flex"
              style={{ borderBottom: '0.5px solid var(--border-default)' }}
            >
              {(['builtin', 'user'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTemplateTab(tab)}
                  className="flex-1 py-2 text-xs font-medium transition-colors"
                  style={{
                    color:
                      templateTab === tab ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    borderBottom:
                      templateTab === tab
                        ? '1.5px solid var(--accent-cyan)'
                        : '1.5px solid transparent',
                  }}
                >
                  {tab === 'builtin' ? t('builtinTemplates') : t('userTemplates')}
                  {tab === 'user' && userTemplates.length > 0 && (
                    <span
                      className="ml-1.5 rounded-full px-1.5 py-0.5 text-xs"
                      style={{ backgroundColor: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)' }}
                    >
                      {userTemplates.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="max-h-48 overflow-y-auto">
              {displayedTemplates.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('noTemplates')}
                  </span>
                </div>
              ) : (
                displayedTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="group flex items-center gap-2 px-4 py-2.5 transition-colors"
                    style={{ borderBottom: '0.5px solid var(--border-default)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor =
                        'var(--bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = '';
                    }}
                  >
                    <button
                      onClick={() => handleUseTemplate(tmpl)}
                      className="flex flex-1 flex-col items-start gap-0.5 text-left"
                    >
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        ▶ {tmpl.name}
                      </span>
                      <span
                        className="truncate text-xs"
                        style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', maxWidth: '100%' }}
                      >
                        {tmpl.command.length > 80
                          ? tmpl.command.slice(0, 80) + '…'
                          : tmpl.command}
                      </span>
                    </button>
                    {!tmpl.isBuiltin && (
                      <button
                        onClick={() => handleDeleteTemplate(tmpl.id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
                        style={{ color: 'var(--status-error)' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── History panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: '0.5px solid var(--border-default)' }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('history')}
              </span>
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <Trash2 size={11} />
                {t('clearHistory')}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {history.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('historyEmpty')}
                  </span>
                </div>
              ) : (
                history.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleUseHistory(entry)}
                    className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors"
                    style={{ borderBottom: '0.5px solid var(--border-default)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        'var(--bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '';
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs"
                        style={{
                          color:
                            entry.status === 'success'
                              ? 'var(--status-success)'
                              : entry.status === 'error'
                              ? 'var(--status-error)'
                              : 'var(--status-warning)',
                        }}
                      >
                        {entry.status === 'success' ? '✓' : entry.status === 'error' ? '✗' : '…'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <span
                      className="truncate text-xs"
                      style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}
                    >
                      {entry.command.length > 80
                        ? entry.command.slice(0, 80) + '…'
                        : entry.command}
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Output log ───────────────────────────────────────────────────── */}
      <div
        className="flex flex-1 flex-col overflow-hidden rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
          minHeight: 160,
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('outputLog')}
            </span>
            {isRunning && (
              <span
                className="animate-pulse rounded-full px-1.5 py-0.5 text-xs"
                style={{
                  backgroundColor: 'var(--accent-cyan-dim)',
                  color: 'var(--accent-cyan)',
                }}
              >
                {t('running')}
              </span>
            )}
          </div>
          {outputLog.length > 0 && (
            <button
              onClick={() => setOutputLog([])}
              className="text-xs"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {tc('delete')}
            </button>
          )}
        </div>
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto p-4 text-xs"
          style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}
        >
          {outputLog.length === 0 ? (
            <span style={{ color: 'var(--text-tertiary)' }}>
              # {t('outputLog')}...
            </span>
          ) : (
            outputLog.map((line, i) => (
              <div
                key={i}
                style={{
                  color: line.startsWith('✓')
                    ? 'var(--status-success)'
                    : line.startsWith('✗')
                    ? 'var(--status-error)'
                    : line.startsWith('$')
                    ? 'var(--accent-cyan)'
                    : 'var(--text-secondary)',
                  marginBottom: 1,
                }}
              >
                {line || '\u00A0'}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
