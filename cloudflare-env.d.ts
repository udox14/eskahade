// File ini di-generate otomatis oleh: npm run cf-typegen
// Tapi kita buat manual untuk memastikan TypeScript tidak error

interface CloudflareEnv {
  ASSETS: Fetcher;
  WORKER_SELF_REFERENCE: Fetcher;
  // Tambahkan binding Cloudflare lainnya di sini jika ada (R2, KV, D1, dll)
}