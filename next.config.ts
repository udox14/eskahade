import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supaya gambar dari Supabase muncul
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  // Vercel otomatis support ini, tidak perlu config runtime 'edge'
};

export default nextConfig;