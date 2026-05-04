'use client'

import { useState } from 'react'
import {
  Printer, CreditCard, Hash,
  ClipboardList, LayoutList, CalendarCheck, Calendar,
} from 'lucide-react'
import { KartuPesertaView } from './_view-kartu'
import { NomorPesertaView } from './_view-nomor'
import { DaftarHadirView } from './_view-daftar-hadir'
import { TempelanRuanganView } from './_view-tempelan-ruangan'
import { JadwalMengawasView } from './_view-jadwal-mengawas'
import { JadwalEhbView } from './_view-jadwal-ehb'
import { PlaceholderView } from './_shared'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

// ── Types ─────────────────────────────────────────────────────────────────────

type View =
  | 'menu'
  | 'kartu-peserta'
  | 'nomor-peserta'
  | 'daftar-hadir'
  | 'tempelan-ruangan'
  | 'jadwal-mengawas'
  | 'jadwal-ehb'

// ── Menu items ────────────────────────────────────────────────────────────────

const MENU_ITEMS: { view: View; label: string; desc: string; icon: React.ElementType }[] = [
  { view: 'kartu-peserta',    label: 'Kartu Peserta EHB',   desc: 'Kartu identitas ujian untuk dipegang setiap peserta.',      icon: CreditCard },
  { view: 'nomor-peserta',    label: 'Nomor Peserta',        desc: 'Nomor ujian besar untuk ditempel di meja peserta.',         icon: Hash },
  { view: 'daftar-hadir',     label: 'Blanko Daftar Hadir',  desc: 'Lembar daftar hadir kosong untuk diisi peserta tiap sesi.',  icon: ClipboardList },
  { view: 'tempelan-ruangan', label: 'Tempelan Ruangan',     desc: 'Nomor ruangan beserta daftar peserta di dalamnya.',         icon: LayoutList },
  { view: 'jadwal-mengawas',  label: 'Jadwal Mengawas',      desc: 'Jadwal tugas mengawas seluruh pengawas EHB.',               icon: CalendarCheck },
  { view: 'jadwal-ehb',       label: 'Jadwal EHB',           desc: 'Jadwal ujian keseluruhan untuk ditempel di mading.',        icon: Calendar },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function CetakEhbPage() {
  const [view, setView] = useState<View>('menu')

  if (view === 'kartu-peserta') return <div className="max-w-6xl mx-auto pb-20 space-y-6"><KartuPesertaView onBack={() => setView('menu')} /></div>
  if (view === 'nomor-peserta') return <div className="max-w-6xl mx-auto pb-20 space-y-6"><NomorPesertaView onBack={() => setView('menu')} /></div>
  if (view === 'daftar-hadir')  return <div className="max-w-6xl mx-auto pb-20 space-y-6"><DaftarHadirView onBack={() => setView('menu')} /></div>
  if (view === 'tempelan-ruangan') return <div className="max-w-6xl mx-auto pb-20 space-y-6"><TempelanRuanganView onBack={() => setView('menu')} /></div>
  if (view === 'jadwal-mengawas') return <div className="max-w-6xl mx-auto pb-20 space-y-6"><JadwalMengawasView onBack={() => setView('menu')} /></div>
  if (view === 'jadwal-ehb') return <div className="max-w-6xl mx-auto pb-20 space-y-6"><JadwalEhbView onBack={() => setView('menu')} /></div>

  const activeMenu = MENU_ITEMS.find(m => m.view === view)
  if (view !== 'menu' && activeMenu) return <div className="max-w-6xl mx-auto pb-20 space-y-6"><PlaceholderView label={activeMenu.label} onBack={() => setView('menu')} /></div>

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <DashboardPageHeader
        title="Cetak Administrasi EHB"
        description="Pilih dokumen administrasi yang akan dicetak."
        className="border-b pb-4"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MENU_ITEMS.map(item => {
          const Icon = item.icon
          return (
            <button 
              key={item.view} 
              onClick={() => setView(item.view)} 
              className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-indigo-300 hover:shadow-md transition-all group active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                  <Icon className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm mb-1">{item.label}</p>
                  <p className="text-xs text-slate-400 leading-snug">{item.desc}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
