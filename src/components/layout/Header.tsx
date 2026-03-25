'use client';

import { useTranslations } from 'next-intl';
import { Moon, Sun, Settings, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ThemeMode, AppLocale } from '@/types/settings';

const LANGUAGES: { value: AppLocale; label: string }[] = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
];

export function Header() {
  const t = useTranslations();
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setLocale = useSettingsStore((s) => s.setLocale);

  const isDark = theme === 'dark';

  const handleThemeToggle = () => {
    const nextTheme: ThemeMode = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between px-4"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--accent-cyan-dim)' }}
        >
          <Zap className="h-4 w-4" style={{ color: 'var(--accent-cyan)' }} />
        </div>
        <span
          className="text-base font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('app.name')}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {/* Theme Toggle */}
        <motion.button
          onClick={handleThemeToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          whileHover={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
          }}
          whileTap={{ scale: 0.92 }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <AnimatePresence mode="wait">
            {isDark ? (
              <motion.div
                key="moon"
                initial={{ rotate: -30, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 30, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Moon className="h-4 w-4" />
              </motion.div>
            ) : (
              <motion.div
                key="sun"
                initial={{ rotate: 30, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -30, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Sun className="h-4 w-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Language Selector */}
        <div className="relative">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as AppLocale)}
            className="h-8 cursor-pointer appearance-none rounded-md px-2 pr-6 text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            {LANGUAGES.map((lang) => (
              <option
                key={lang.value}
                value={lang.value}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              >
                {lang.label}
              </option>
            ))}
          </select>
          <div
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ▾
          </div>
        </div>

        {/* Settings Button */}
        <motion.button
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          whileHover={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
          }}
          whileTap={{ scale: 0.92 }}
          title={t('app.settings')}
        >
          <Settings className="h-4 w-4" />
        </motion.button>
      </div>
    </header>
  );
}
