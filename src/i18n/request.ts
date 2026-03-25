import { getRequestConfig } from 'next-intl/server';

// For static export (Tauri), locale is handled client-side
// This file is required by next-intl plugin but won't be called in SSG mode
export default getRequestConfig(async () => {
  // Default to Japanese for static build
  const locale = 'ja';

  return {
    locale,
    timeZone: 'Asia/Tokyo',
    messages: (await import(`@/lib/i18n/${locale}.json`)).default,
  };
});
