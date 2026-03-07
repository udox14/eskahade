import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wajib untuk Cloudflare Workers (OpenNext)
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },

  // Paksa Webpack (bukan Turbopack) agar tree-shaking bekerja optimal
  // dan bundle size tetap kecil di Cloudflare Workers
  experimental: {
    // Optimalkan import heavy packages agar tree-shaking lebih agresif
    optimizePackageImports: [
      "lucide-react",
      "@tanstack/react-table",
      "date-fns",
    ],
  },

  webpack: (config, { isServer }) => {
    // Aktifkan minifikasi untuk server bundle (penting untuk Workers size limit)
    if (isServer) {
      config.optimization.minimize = true;
    }

    // Paksa xlsx dan react-to-print hanya di-bundle di sisi client
    // supaya tidak memperbesar server bundle
    config.resolve.alias = {
      ...config.resolve.alias,
    };

    return config;
  },
};

export default nextConfig;