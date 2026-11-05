import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A second instance (e.g. the real-data demo) sets DIST_DIR so it builds into its
  // own folder and does not clash with the test instance's default `.next`.
  ...(process.env.DIST_DIR ? { distDir: process.env.DIST_DIR } : {}),
};

export default nextConfig;
