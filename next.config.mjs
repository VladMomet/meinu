/** @type {import('next').NextConfig} */

// SITE_TIER определяет, какой из трёх index-*.html будет отдан на "/".
// Задаётся в .env каждого инстанса. По умолчанию — standard (для локальной разработки).
const tier = process.env.SITE_TIER || 'standard';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/', destination: `/index-${tier}.html` },
    ];
  },
};

export default nextConfig;
