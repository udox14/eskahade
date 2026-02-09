import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Membuat koneksi Supabase yang aman untuk dijalankan di browser
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}