import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { TranslationsProvider } from '@/providers/TranslationsProvider';
import { AppInitializer } from '@/components/AppInitializer';

export const metadata: Metadata = {
  title: 'FFmpeg-UI',
  description: 'Modern GUI for FFmpeg and yt-dlp',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className="dark"
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <ThemeProvider>
          <TranslationsProvider>
            <AppInitializer />
            {children}
          </TranslationsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
