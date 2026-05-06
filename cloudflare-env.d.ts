// cloudflare-env.d.ts
// TypeScript types untuk semua Cloudflare bindings

interface CloudflareEnv {
  // Static assets
  ASSETS: Fetcher

  // Self-reference untuk Workers
  WORKER_SELF_REFERENCE: Fetcher

  // KV Cache (OpenNext)
  NEXT_INC_CACHE_KV: KVNamespace

  // D1 Database (pengganti Supabase)
  DB: D1Database
  DEMO_DB?: D1Database

  // R2 Storage (pengganti Supabase Storage)
  R2_BUCKET: R2Bucket

  // Environment variables
  JWT_SECRET: string
  R2_PUBLIC_URL: string
  DEMO_LOGIN_ENABLED?: string
  DEMO_USER_ID?: string
  DEMO_USER_EMAIL?: string
  DEMO_USER_PASSWORD?: string
  DEMO_USER_NAME?: string
  DEMO_USER_ROLE?: string
  DEMO_USER_ROLES?: string
  DEMO_USER_ASRAMA_BINAAN?: string
  NEXT_PUBLIC_SUPABASE_URL?: string      // hapus setelah migrasi selesai
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string // hapus setelah migrasi selesai
}
