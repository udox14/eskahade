import { redirect } from 'next/navigation'

// WAJIB: Matikan fitur Pre-render (Static Generation) untuk halaman ini
// agar Next.js tidak error saat mencoba menjalankannya di waktu build.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  // Redirect server-side langsung ke Home
  redirect('/')
}