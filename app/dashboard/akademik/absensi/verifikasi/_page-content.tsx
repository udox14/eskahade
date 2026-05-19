'use client'

import FinalVonisPage from '@/app/dashboard/keamanan/verifikasi-panggilan/final-vonis-page'

export default function VerifikasiAbsenPage() {
  return (
    <FinalVonisPage
      source="pengajian"
      title="Vonis Final Pengajian"
      description="Proses status final hasil blanko eksekutor untuk alfa pengajian."
      allowLegacyAbsen
    />
  )
}
