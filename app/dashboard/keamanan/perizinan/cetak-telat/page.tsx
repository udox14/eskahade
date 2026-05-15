import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LegacyCetakTelatPage() {
  redirect('/dashboard/asrama/perpulangan/cetak-telat')
}
