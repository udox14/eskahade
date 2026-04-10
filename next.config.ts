import type { NextConfig } from "next";

if (process.env.NODE_ENV === 'development') {
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
    // Disable sharp/resvg untuk menghindari .wasm issue di Windows
    unoptimized: true,
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@tanstack/react-table",
      "date-fns",
    ],
  },

  turbopack: {},

  webpack: (config, { webpack, isServer }) => {
    if (isServer) {
        config.plugins.push(
          new webpack.IgnorePlugin({
            resourceRegExp: /resvg\.wasm$/,
          }),
          new webpack.IgnorePlugin({
            resourceRegExp: /yoga\.wasm$/,
          }),
          new webpack.IgnorePlugin({
            resourceRegExp: /@vercel\/og/,
          })
        );
    }
    return config;
  },
};

export default nextConfig;