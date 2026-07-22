// cloudflare-env.d.ts
// TypeScript types untuk semua Cloudflare bindings

interface D1Result<T = unknown> {
  results?: T[]
  success: boolean
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  all<T = unknown>(): Promise<D1Result<T>>
  first<T = unknown>(): Promise<T | null>
  run(): Promise<D1Result>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

interface ScheduledController {
  scheduledTime: number
  cron: string
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

interface R2Bucket {
  get(key: string): Promise<unknown>
  put(key: string, value: ArrayBuffer | ArrayBufferView | string, options?: unknown): Promise<unknown>
  delete(key: string): Promise<void>
}

interface CloudflareEnv {
  // Static assets
  ASSETS: Fetcher

  // Self-reference untuk Workers
  WORKER_SELF_REFERENCE: Fetcher

  // KV Cache (OpenNext)
  NEXT_INC_CACHE_KV: KVNamespace

  // D1 Database (pengganti Supabase)
  DB: D1Database

  // D1 Database sandbox untuk role AKUN DEMO (data dummy, terpisah dari DB asli)
  DEMO_DB: D1Database

  // D1 khusus ledger dan seluruh data keuangan produksi
  FINANCE_DB: D1Database

  // D1 khusus data keuangan akun demo
  DEMO_FINANCE_DB: D1Database

  // R2 Storage (pengganti Supabase Storage)
  R2_BUCKET: R2Bucket

  // Environment variables
  JWT_SECRET: string
  FINANCE_ENCRYPTION_KEY: string
  CLOUDFLARE_BROWSER_RENDERING_API_TOKEN: string
  R2_PUBLIC_URL: string
  NEXT_PUBLIC_SUPABASE_URL?: string      // hapus setelah migrasi selesai
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string // hapus setelah migrasi selesai
}
