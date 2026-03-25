'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import jaMessages from '@/lib/i18n/ja.json';
import enMessages from '@/lib/i18n/en.json';

const messages = {
  ja: jaMessages,
  en: enMessages,
} as const;

interface TranslationsProviderProps {
  children: React.ReactNode;
}

export function TranslationsProvider({ children }: TranslationsProviderProps) {
  const locale = useSettingsStore((s) => s.locale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <NextIntlClientProvider locale="ja" messages={messages.ja}>
        {children}
      </NextIntlClientProvider>
    );
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}
