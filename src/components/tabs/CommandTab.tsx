'use client';

import { useTranslations } from 'next-intl';
import { Terminal, Play, Copy, Save, FolderOpen } from 'lucide-react';

export function CommandTab() {
  const t = useTranslations('command');

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Command Editor */}
      <div
        className="flex flex-col overflow-hidden rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
          flex: '0 0 40%',
        }}
      >
        <div
          className="flex items-center justify-between p-3"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('editor')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--accent-cyan-dim)',
                color: 'var(--accent-cyan)',
              }}
            >
              <Play className="h-3 w-3" />
              {t('execute')}
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title={t('copy')}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title={t('saveTemplate')}
            >
              <Save className="h-3.5 w-3.5" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title={t('templates')}
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <textarea
          className="flex-1 resize-none bg-transparent p-4 text-sm outline-none"
          style={{
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            minHeight: 120,
          }}
          placeholder={`ffmpeg -i "input.mp4" -c:v libx264 -crf 23 -c:a aac "output.mp4"`}
          spellCheck={false}
        />
      </div>

      {/* Templates */}
      <div
        className="rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <div
          className="p-3"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('templates')}
          </p>
        </div>
        <div className="space-y-0">
          {[
            {
              name: '基本変換',
              cmd: 'ffmpeg -i {input} -c:v libx264 -crf 23 {output}',
            },
            {
              name: 'GIF作成',
              cmd: 'ffmpeg -i {input} -vf "fps=10,scale=320:-1" {output}.gif',
            },
            {
              name: '音声抽出',
              cmd: 'ffmpeg -i {input} -vn -c:a libmp3lame -q:a 2 {output}.mp3',
            },
          ].map((template) => (
            <button
              key={template.name}
              className="flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors"
              style={{ borderBottom: '0.5px solid var(--border-default)' }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                ▶ {template.name}
              </span>
              <span
                className="truncate text-xs"
                style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}
              >
                {template.cmd}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Output Log */}
      <div
        className="flex flex-1 flex-col rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <div
          className="p-3"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('outputLog')}
          </p>
        </div>
        <div
          className="flex-1 overflow-y-auto p-3 text-xs"
          style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}
        >
          <span style={{ color: 'var(--text-tertiary)' }}>
            # FFmpeg出力がここに表示されます
          </span>
        </div>
      </div>
    </div>
  );
}
