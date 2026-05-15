/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Корень / отдаёт public/index.html. Так наш SPA становится "точкой входа",
  // а /api/* остаются за Next.js.
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
    ];
  },
};

export default nextConfig;
