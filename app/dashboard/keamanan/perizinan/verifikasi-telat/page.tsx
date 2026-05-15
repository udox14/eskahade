import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LegacyVerifikasiTelatPage() {
  redirect('/dashboard/asrama/perpulangan/verifikasi-telat')
}
