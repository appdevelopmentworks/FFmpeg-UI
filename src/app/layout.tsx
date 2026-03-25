import type { Metadata } from 'next';
import { Inter, Noto_Sans_JP, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { TranslationsProvider } from '@/providers/TranslationsProvider';
import { AppInitializer } from '@/components/AppInitializer';

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
});

const notoSansJP = Noto_Sans_JP({
  subsets:  ['latin'],
  variable: '--font-noto-jp',
  weight:   ['400', '500', '600'],
  display:  'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-jetbrains',
  weight:   ['400', '500'],
  display:  'swap',
});

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
      className={`dark ${inter.variable} ${notoSansJP.variable} ${jetbrainsMono.variable}`}
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
