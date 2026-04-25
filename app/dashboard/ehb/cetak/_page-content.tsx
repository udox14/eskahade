'use client'

import { useState } from 'react'
import {
  Printer, ChevronRight, ChevronLeft, CreditCard, Hash,
  ClipboardList, LayoutList, CalendarCheck, Calendar,
  Construction,
} from 'lucide-react'

type View =
  | 'menu'
  | 'kartu-peserta'
  | 'nomor-peserta'
  | 'daftar-hadir'
  | 'tempelan-ruangan'
  | 'jadwal-mengawas'
  | 'jadwal-ehb'

const MENU_ITEMS: {
  view: View
  label: string
  desc: string
  icon: React.ElementType
}[] = [
  {
    view: 'kartu-peserta',
    label: 'Kartu Peserta EHB',
    desc: 'Kartu identitas ujian untuk dipegang setiap peserta.',
    icon: CreditCard,
  },
  {
    view: 'nomor-peserta',
    label: 'Nomor Peserta',
    desc: 'Nomor ujian besar untuk ditempel di meja peserta.',
    icon: Hash,
  },
  {
    view: 'daftar-hadir',
    label: 'Blanko Daftar Hadir',
    desc: 'Lembar daftar hadir kosong untuk diisi peserta tiap sesi.',
    icon: ClipboardList,
  },
  {
    view: 'tempelan-ruangan',
    label: 'Tempelan Ruangan',
    desc: 'Nomor ruangan beserta daftar peserta di dalamnya.',
    icon: LayoutList,
  },
  {
    view: 'jadwal-mengawas',
    label: 'Jadwal Mengawas',
    desc: 'Jadwal tugas mengawas seluruh pengawas EHB.',
    icon: CalendarCheck,
  },
  {
    view: 'jadwal-ehb',
    label: 'Jadwal EHB',
    desc: 'Jadwal ujian keseluruhan untuk ditempel di mading.',
    icon: Calendar,
  },
]

function PlaceholderView({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b sticky top-0 z-10 flex items-center gap-3 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200"
        >
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <div>
          <h2 className="font-bold text-slate-800 text-lg leading-tight">{label}</h2>
          <p className="text-xs text-indigo-600 font-bold">Cetak EHB</p>
        </div>
      </div>

      {/* Content placeholder */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Construction className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <p className="font-bold text-slate-700 text-base mb-1">Format Sedang Disiapkan</p>
          <p className="text-sm text-slate-400 max-w-xs">
            Format cetak untuk <span className="font-semibold text-slate-500">{label}</span> akan segera ditambahkan.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function CetakEhbPage() {
  const [view, setView] = useState<View>('menu')

  const activeMenu = MENU_ITEMS.find(m => m.view === view)

  if (view !== 'menu' && activeMenu) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 border-x">
        <PlaceholderView label={activeMenu.label} onBack={() => setView('menu')} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 border-x">
      {/* Header */}
      <div className="bg-indigo-600 px-5 pt-10 pb-6 shadow-md rounded-b-3xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Printer className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Cetak EHB</h1>
        </div>
        <p className="text-indigo-100 text-sm">
          Pilih jenis administrasi yang ingin dicetak.
        </p>
      </div>

      {/* Menu Items */}
      <div className="p-4 space-y-3">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className="w-full bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex items-center gap-4 group active:scale-95 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                <Icon className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm mb-0.5">{item.label}</p>
                <p className="text-xs text-slate-400 leading-snug">{item.desc}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
