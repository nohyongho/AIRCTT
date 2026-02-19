import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack은 프로덕션 빌드에서 기본적으로 비활성화됨
  // 한글 경로 문제가 있어 worktree에서는 --no-turbopack 옵션 필요
  typescript: {
    ignoreBuildErrors: true,  // TODO: TypeScript 에러 수정 후 false로 복원
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.ALLOWED_ORIGINS || "https://airctt.com,https://petctt.com",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://petctt.com https://airctt.com",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { hostname: "images.pexels.com" },
      { hostname: "images.unsplash.com" },
      { hostname: "chat2db-cdn.oss-us-west-1.aliyuncs.com" },
      { hostname: "cdn.chat2db-ai.com" },
    ],
  },
};

export default nextConfig;
