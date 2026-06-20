import { redirect } from 'next/navigation'

// Modul ini digabung ke /dashboard/akademik/penempatan (lihat migration 0092).
export default function AturKelasRedirect() {
  redirect('/dashboard/akademik/penempatan')
}
