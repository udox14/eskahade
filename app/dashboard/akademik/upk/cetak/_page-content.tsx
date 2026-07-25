'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ShoppingBag,
  PackageCheck,
  Boxes,
  FileSpreadsheet,
  Wallet,
  CreditCard,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { RekapTerjualView } from './_view-rekap-terjual'
import { RekapTidakTerjualView } from './_view-rekap-tidak-terjual'
import { DaftarHargaView } from './_view-daftar-harga'
import { RekapPemasukanView } from './_view-rekap-pemasukan'
import { RekapPengeluaranView } from './_view-rekap-pengeluaran'

type View =
  | 'menu'
  | 'rekap-pemasukan'
  | 'rekap-pengeluaran'
  | 'rekap-terjual-baru'
  | 'rekap-terjual-lama'
  | 'rekap-tidak-terjual'
  | 'daftar-harga'

const MENU_ITEMS: {
  view: View
  label: string
  desc: string
  icon: React.ElementType
  badge?: string
}[] = [
  {
    view: 'rekap-pemasukan',
    label: 'Laporan Pemasukan UPK',
    desc: 'Dokumen rekapitulasi setoran kasir, pinjaman modal, dan kas masuk UPK.',
    icon: Wallet,
    badge: 'Baru',
  },
  {
    view: 'rekap-pengeluaran',
    label: 'Laporan Pengeluaran UPK',
    desc: 'Dokumen rekapitulasi kas keluar, operasional, hutang toko, dan royalti.',
    icon: CreditCard,
    badge: 'Baru',
  },
  {
    view: 'rekap-terjual-baru',
    label: 'Rekap Kitab Terjual (Stok Baru)',
    desc: 'Dokumen rekapitulasi penjualan kitab khusus persediaan stok baru.',
    icon: ShoppingBag,
    badge: 'Stok Baru',
  },
  {
    view: 'rekap-terjual-lama',
    label: 'Rekap Kitab Terjual (Stok Lama)',
    desc: 'Dokumen rekapitulasi penjualan kitab khusus persediaan stok lama.',
    icon: PackageCheck,
    badge: 'Stok Lama',
  },
  {
    view: 'rekap-tidak-terjual',
    label: 'Rekap Kitab Tidak Terjual',
    desc: 'Rekapitulasi sisa persediaan stok kitab yang belum / tidak terjual.',
    icon: Boxes,
  },
  {
    view: 'daftar-harga',
    label: 'Daftar Harga Kitab',
    desc: 'Dokumen daftar harga kitab UPK per marhalah lengkap (Excel & Word).',
    icon: FileSpreadsheet,
  },
]

export default function CetakUpkPageContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') as View | null
  const [view, setView] = useState<View>(
    initialTab && MENU_ITEMS.some(i => i.view === initialTab) ? initialTab : 'menu'
  )

  useEffect(() => {
    const tab = searchParams.get('tab') as View | null
    if (tab && MENU_ITEMS.some(i => i.view === tab)) {
      setView(tab)
    }
  }, [searchParams])

  if (view === 'rekap-pemasukan') {
    return (
      <div className="max-w-7xl mx-auto pb-20 space-y-6">
        <RekapPemasukanView onBack={() => setView('menu')} />
      </div>
    )
  }

  if (view === 'rekap-pengeluaran') {
    return (
      <div className="max-w-7xl mx-auto pb-20 space-y-6">
        <RekapPengeluaranView onBack={() => setView('menu')} />
      </div>
    )
  }

  if (view === 'rekap-terjual-baru') {
    return (
      <div className="max-w-7xl mx-auto pb-20 space-y-6">
        <RekapTerjualView tipeStok="BARU" onBack={() => setView('menu')} />
      </div>
    )
  }

  if (view === 'rekap-terjual-lama') {
    return (
      <div className="max-w-7xl mx-auto pb-20 space-y-6">
        <RekapTerjualView tipeStok="LAMA" onBack={() => setView('menu')} />
      </div>
    )
  }

  if (view === 'rekap-tidak-terjual') {
    return (
      <div className="max-w-7xl mx-auto pb-20 space-y-6">
        <RekapTidakTerjualView onBack={() => setView('menu')} />
      </div>
    )
  }

  if (view === 'daftar-harga') {
    return (
      <div className="max-w-7xl mx-auto pb-20 space-y-6">
        <DaftarHargaView onBack={() => setView('menu')} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <DashboardPageHeader
        title="Cetak Administrasi UPK"
        description="Pilih dokumen laporan dan administrasi Unit Penerbitan Kitab yang akan dicetak."
        className="border-b border-slate-200 pb-4"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {MENU_ITEMS.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => setView(item.view)}
              className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-emerald-500 hover:shadow-md transition-all group active:scale-[0.98] relative overflow-hidden"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                  <Icon className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                    {item.badge && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

