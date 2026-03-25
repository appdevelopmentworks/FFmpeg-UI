import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'export',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  // Tauri uses file:// protocol
  trailingSlash: true,
};

export default withNextIntl(nextConfig);
