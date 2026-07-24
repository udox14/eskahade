'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, FileSpreadsheet, FileText, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { getDaftarKitabPerMarhalah } from './actions'
import { PriceListExportButton } from '@/app/dashboard/akademik/upk/katalog/_price-list-export'
import { exportDaftarHargaWord } from './_export-utils'

type MarhalahData = Awaited<ReturnType<typeof getDaftarKitabPerMarhalah>>['marhalah']

function formatRp(num: number) {
  return `Rp ${num.toLocaleString('id-ID')}`
}

export function DaftarHargaView({ onBack }: { onBack: () => void }) {
  const [marhalahList, setMarhalahList] = useState<MarhalahData>([])
  const [loading, setLoading] = useState(true)
  const [exportingWord, setExportingWord] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getDaftarKitabPerMarhalah()
      setMarhalahList(res.marhalah)
    } catch (err) {
      console.error('Gagal memuat daftar harga:', err)
      toast.error('Gagal mengambil data daftar harga kitab.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleExportWord = async () => {
    if (!marhalahList.length || exportingWord) return
    setExportingWord(true)
    try {
      exportDaftarHargaWord(marhalahList)
      toast.success('Daftar harga berhasil diekspor ke Word.')
    } catch (err) {
      console.error('Gagal export Word daftar harga:', err)
      toast.error('Gagal mengunduh file Word daftar harga.')
    } finally {
      setExportingWord(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition text-slate-600"
            title="Kembali ke Menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Daftar Harga Kitab UPK
            </h1>
            <p className="text-xs text-slate-500">
              Dokumen daftar harga kitab lengkap per marhalah (Excel & Word).
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <PriceListExportButton marhalah={marhalahList} />
          <button
            type="button"
            onClick={handleExportWord}
            disabled={!marhalahList.length || loading || exportingWord}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingWord ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Export Word
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition text-slate-600 bg-white"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Preview Section */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs font-medium">Memuat data daftar harga...</p>
        </div>
      ) : marhalahList.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
          <p className="text-sm font-semibold">Tidak ada data daftar harga kitab.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {marhalahList.map(m => {
            if (!m.items.length) return null
            const items = [...m.items].sort((a, b) => Number(b.is_default) - Number(a.is_default))
            const defaultCount = items.filter(i => i.is_default).length
            const totalDefault = items.slice(0, defaultCount).reduce((acc, i) => acc + i.harga_jual, 0)

            return (
              <div key={m.id} className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="bg-emerald-700 text-white p-3 text-center font-bold text-sm tracking-wide uppercase">
                  MARHALAH {m.nama}
                </div>
                <div className="p-3 flex-1 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center w-8">NO</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-left">NAMA KITAB</th>
                        <th className="py-1.5 px-2 text-right w-24">HARGA (RP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={item.is_default ? 'bg-white font-medium' : 'bg-slate-50 italic text-slate-500'}
                        >
                          <td className="py-1.5 px-2 text-center border-r border-slate-200">{idx + 1}</td>
                          <td className="py-1.5 px-2 border-r border-slate-200">
                            {item.nama_kitab} {!item.is_default && '(Pilihan)'}
                          </td>
                          <td className="py-1.5 px-2 text-right">{formatRp(item.harga_jual)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                        <td colSpan={2} className="py-2 px-2 text-center border-r border-slate-300 text-slate-800">
                          TOTAL HARGA WAJIB
                        </td>
                        <td className="py-2 px-2 text-right text-red-600 font-extrabold">
                          {formatRp(totalDefault)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
