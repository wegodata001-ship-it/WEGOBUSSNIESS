import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async redirects() {
    return [
      { source: "/board", destination: "/work-board", permanent: false },
      { source: "/hours", destination: "/work-hours", permanent: false },
      { source: "/super-admin", destination: "/admin/businesses", permanent: false },
    ];
  },
};

export default nextConfig;
