import type { NextConfig } from "next";

if (process.env.NODE_ENV === 'development') {
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev(process.env.ESKAHADE_LOCAL_TEST === '1'
    ? { configPath: 'wrangler.local-test.jsonc', persist: { path: '.wrangler/stabilization-local/v3' } }
    : undefined);
}

const nextConfig: NextConfig = {
  output: "standalone",

  // Inject BUILD_TIMESTAMP ke dalam bundle saat build (tersedia di server & edge runtime)
  env: {
    BUILD_TIMESTAMP: String(Date.now()),
  },
  webpack: (config, { webpack, isServer }) => {
    if (isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /resvg\.wasm$/ }),
        new webpack.IgnorePlugin({ resourceRegExp: /yoga\.wasm$/ }),
        new webpack.IgnorePlugin({ resourceRegExp: /@vercel\/og/ })
      );
    }
    return config;
  },
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
};

export default nextConfig;
