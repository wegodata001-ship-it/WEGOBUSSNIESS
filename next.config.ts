import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/board", destination: "/work-board", permanent: false },
      { source: "/hours", destination: "/work-hours", permanent: false },
      { source: "/super-admin", destination: "/admin/businesses", permanent: false },
    ];
  },
};

export default nextConfig;
