import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  reactStrictMode: true,
  // Cloudflare Pages deploy: static HTML export drops into apps/anchor-admin/out
  // which wrangler pages deploy uploads directly. Images cannot be Next-optimized
  // under static export — unoptimized bypasses the loader.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
