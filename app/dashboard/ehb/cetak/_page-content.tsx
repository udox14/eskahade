'use client'

import { useState } from 'react'
import {
  Printer, ChevronLeft, CreditCard, Hash,
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
    <div className="space-y-6">
      <div className="border-b pb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-7 h-7 text-indigo-600" /> {label}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Cetak EHB</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Construction className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <p className="font-bold text-slate-700 text-base mb-1">Format Sedang Disiapkan</p>
          <p className="text-sm text-slate-400 max-w-sm">
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
      <div className="max-w-6xl mx-auto pb-20 space-y-6">
        <PlaceholderView label={activeMenu.label} onBack={() => setView('menu')} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Printer className="w-7 h-7 text-indigo-600" /> Cetak Administrasi EHB
        </h1>
        <p className="text-sm text-slate-500 mt-1">Pilih jenis administrasi yang ingin dicetak.</p>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MENU_ITEMS.map((item) => {
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
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <span className="text-xs font-bold text-indigo-500 group-hover:text-indigo-700 flex items-center gap-1 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Buka
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
