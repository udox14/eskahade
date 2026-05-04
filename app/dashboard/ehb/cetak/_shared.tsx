'use client'

import { ChevronLeft, Construction } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export const FONT = '"Times New Roman", Times, serif'

export const ORDINAL: Record<string, string> = {
  '1': 'PERTAMA', '2': 'KEDUA', '3': 'KETIGA', '4': 'KEEMPAT',
  '5': 'KELIMA', '6': 'KEENAM', '7': 'KETUJUH', '8': 'KEDELAPAN',
}

export function parseJamGroup(jamGroup: string): string {
  const match = jamGroup.match(/(\d+)/)
  if (match) return ORDINAL[match[1]] ?? `KE-${match[1]}`
  return jamGroup.toUpperCase()
}

// ── Shared UI Components ──────────────────────────────────────────────────────

export function PageHeader({ title, onBack, subtitle = 'Cetak Administrasi EHB' }: { title: string; onBack: () => void; subtitle?: string }) {
  return (
    <DashboardPageHeader
      title={title}
      description={subtitle}
      className="border-b pb-4"
      action={(
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
    />
  )
}

export function PlaceholderView({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title={label} onBack={onBack} />
      <div className="bg-white border rounded-xl flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Construction className="w-8 h-8 text-indigo-400" />
        </div>
        <p className="font-bold text-slate-700">Format Sedang Disiapkan</p>
      </div>
    </div>
  )
}

// ── Shared Print Components ──────────────────────────────────────────────────

export function HeaderCetak({ semester, tahun_ajaran_nama }: { semester: number; tahun_ajaran_nama: string }) {
  const semLabel  = semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const ta        = tahun_ajaran_nama.replace('/', '-')

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '4mm', 
      flexShrink: 0, 
      marginBottom: '2mm',
      width: '100%'
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logohitam.png"
        alt=""
        style={{ width: '20mm', height: '20mm', objectFit: 'contain', flexShrink: 0 }}
      />
      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '18pt', fontWeight: 900, letterSpacing: '0.5px', lineHeight: 0.5, marginBottom: '4mm' }}>
          EVALUASI HASIL BELAJAR
        </div>
        <div style={{ fontSize: '15pt', fontWeight: 'normal', lineHeight: 0.5, marginBottom: '3mm' }}>
          {semLabel} T.A. {ta}
        </div>
        <div style={{ fontSize: '8.5pt', fontWeight: 'normal', lineHeight: 0.5, textTransform: 'uppercase' }}>
          LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
        </div>
        <div style={{ borderBottom: '1pt solid #000', marginTop: '3mm', width: '100%' }} />
      </div>
    </div>
  )
}

export function TataTertibCetak() {
  return (
    <div style={{
      marginTop: 'auto',
      border: '0.8pt solid #000',
      padding: '2mm 3mm',
      position: 'relative' as const,
    }}>
      <div style={{
        position: 'absolute' as const,
        top: '-1.5mm',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#fff',
        padding: '0 3mm',
        fontSize: '7.5pt',
        fontWeight: 'bold',
        whiteSpace: 'nowrap' as const,
      }}>
        TATA TERTIB PESERTA
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.9fr',
        gap: '0 6mm',
        fontSize: '6.5pt',
        lineHeight: '1.5',
        fontFamily: FONT,
        paddingTop: '1mm',
      }}>
        <div>
          <div>1. Seluruh santri wajib mengikuti kegiatan EHB</div>
          <div>2. Membawa kartu peserta ke dalam ruangan</div>
          <div>3. Mengikuti EHB sesuai ruangan dan jadwal</div>
          <div>4. Ketentuan pakaian peserta:</div>
          <div style={{ paddingLeft: '5mm' }}>a. Putra: seragam berjama&#39;ah</div>
          <div style={{ paddingLeft: '5mm' }}>b. Putri: maksi hitam, baju dan kerudung putih</div>
          <div>5. Dilarang membawa catatan dalam bentuk apapun</div>
        </div>
        <div>
          <div>6. Menempati tempat duduk sesuai nomor urut</div>
          <div>7. Hadir di ruangan 10 menit sebelum EHB dimulai</div>
          <div>8. Dilarang bekerja sama dalam pengerjaan soal</div>
          <div>9. Mengisi dan melengkapi identitas pada lembar jawaban</div>
          <div>10. Mengisi daftar hadir sesuai dengan urutan nomor tes</div>
          <div>11. Boleh menanyakan hal yang tidak dimengerti kepada pengawas selain kisi-kisi atau jawaban</div>
        </div>
      </div>
    </div>
  )
}
