import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@tanstack/react-table",
      "date-fns",
    ],
  },

  // Next.js 16 default pakai Turbopack, deklarasikan eksplisit
  turbopack: {},
};

export default nextConfig;