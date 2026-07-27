'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, FileSpreadsheet, FileText, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { getRekapKitabTidakTerjualData, type RekapTidakTerjualItem } from './actions'
import { exportRekapTidakTerjualExcel, exportRekapTidakTerjualWord } from './_export-utils'

function formatRp(num: number) {
  return `Rp ${num.toLocaleString('id-ID')}`
}

export function RekapTidakTerjualView({ onBack }: { onBack: () => void }) {
  const [filterStok, setFilterStok] = useState<'SEMUA' | 'STOK_BARU' | 'STOK_LAMA'>('SEMUA')
  const [items, setItems] = useState<RekapTidakTerjualItem[]>([])
  const [loading, setLoading] = useState(true)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRekapKitabTidakTerjualData({ filterStok })
      setItems(data)
    } catch (err) {
      console.error('Gagal memuat rekap kitab tidak terjual:', err)
      toast.error('Gagal mengambil data sisa stok kitab.')
    } finally {
      setLoading(false)
    }
  }, [filterStok])

  useEffect(() => {
    loadData()
  }, [loadData])

  const getSubtitle = () => {
    if (filterStok === 'STOK_BARU') return 'Filter: Khusus Memiliki Sisa Stok Baru'
    if (filterStok === 'STOK_LAMA') return 'Filter: Khusus Memiliki Sisa Stok Lama'
    return 'Semua Kitab Yang Masih Memiliki Sisa Stok'
  }

  const handleExportExcel = async () => {
    if (!items.length || exportingExcel) return
    setExportingExcel(true)
    try {
      await exportRekapTidakTerjualExcel(items, getSubtitle())
      toast.success('File Excel Rekap Kitab Tidak Terjual berhasil diunduh.')
    } catch (err) {
      console.error('Gagal export Excel:', err)
      toast.error('Gagal mengunduh file Excel.')
    } finally {
      setExportingExcel(false)
    }
  }

  const handleExportWord = async () => {
    if (!items.length || exportingWord) return
    setExportingWord(true)
    try {
      exportRekapTidakTerjualWord(items, getSubtitle())
      toast.success('File Word Rekap Kitab Tidak Terjual berhasil diunduh.')
    } catch (err) {
      console.error('Gagal export Word:', err)
      toast.error('Gagal mengunduh file Word.')
    } finally {
      setExportingWord(false)
    }
  }

  const totalLama = items.reduce((acc, i) => acc + i.stok_lama, 0)
  const totalBaru = items.reduce((acc, i) => acc + i.stok_baru, 0)
  const totalStok = items.reduce((acc, i) => acc + i.stok_total, 0)
  const totalAssetModal = items.reduce((acc, i) => acc + i.nilai_asset_modal, 0)
  const totalAssetJual = items.reduce((acc, i) => acc + i.nilai_asset_jual, 0)

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
              Rekap Kitab Tidak / Belum Terjual
            </h1>
            <p className="text-xs text-slate-500">
              Rekapitulasi sisa persediaan stok kitab beserta total nilai aset modal dan jual.
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!items.length || loading || exportingExcel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportWord}
            disabled={!items.length || loading || exportingWord}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingWord ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Export Word
          </button>
        </div>
      </div>

      {/* Filter Options */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Filter Sisa Stok:</label>
          <select
            value={filterStok}
            onChange={e => setFilterStok(e.target.value as any)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white font-medium"
          >
            <option value="SEMUA">Ada Sisa Stok (Baru atau Lama)</option>
            <option value="STOK_BARU">Hanya Ada Stok Baru</option>
            <option value="STOK_LAMA">Hanya Ada Stok Lama</option>
          </select>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition text-slate-600 ml-auto"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table Preview */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-center">
          <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-800">
            REKAP KITAB TIDAK / BELUM TERJUAL
          </h2>
          <p className="text-xs text-slate-500 italic mt-0.5">{getSubtitle()}</p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
            <p className="text-xs font-medium">Memuat data sisa stok...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm font-semibold">Tidak ditemukan kitab dengan sisa stok sesuai filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                  <th className="py-2.5 px-3 border-r border-slate-300 text-center w-12">NO</th>
                  <th className="py-2.5 px-4 border-r border-slate-300 text-left">NAMA KITAB</th>
                  <th className="py-2.5 px-4 border-r border-slate-300 text-left w-32">TOKO</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 text-center w-20">STOK LAMA</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 text-center w-20">STOK BARU</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 text-center w-24">STOK TOTAL</th>
                  <th className="py-2.5 px-4 border-r border-slate-300 text-right w-28">HARGA BELI</th>
                  <th className="py-2.5 px-4 border-r border-slate-300 text-right w-28">HARGA JUAL</th>
                  <th className="py-2.5 px-4 border-r border-slate-300 text-right w-32">NILAI (MODAL)</th>
                  <th className="py-2.5 px-4 text-right w-32">NILAI (JUAL)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, idx) => (
                  <tr key={item.katalog_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-center border-r border-slate-200 font-medium text-slate-600">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-4 border-r border-slate-200 font-semibold text-slate-800">
                      {item.nama_kitab}
                    </td>
                    <td className="py-2 px-4 border-r border-slate-200 text-slate-700">
                      {item.toko_nama || '-'}
                    </td>
                    <td className="py-2 px-3 text-center border-r border-slate-200 text-slate-700">
                      {item.stok_lama}
                    </td>
                    <td className="py-2 px-3 text-center border-r border-slate-200 text-slate-700">
                      {item.stok_baru}
                    </td>
                    <td className="py-2 px-3 text-center border-r border-slate-200 font-bold text-slate-900">
                      {item.stok_total}
                    </td>
                    <td className="py-2 px-4 text-right border-r border-slate-200 font-medium text-slate-600">
                      {formatRp(item.harga_beli)}
                    </td>
                    <td className="py-2 px-4 text-right border-r border-slate-200 font-medium text-slate-600">
                      {formatRp(item.harga_jual)}
                    </td>
                    <td className="py-2 px-4 text-right border-r border-slate-200 font-medium text-slate-700">
                      {formatRp(item.nilai_asset_modal)}
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-slate-800">
                      {formatRp(item.nilai_asset_jual)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-slate-900">
                  <td colSpan={3} className="py-3 px-4 text-center border-r border-slate-300 tracking-wider">
                    JUMLAH TOTAL
                  </td>
                  <td className="py-3 px-3 text-center border-r border-slate-300 font-bold">
                    {totalLama}
                  </td>
                  <td className="py-3 px-3 text-center border-r border-slate-300 font-bold">
                    {totalBaru}
                  </td>
                  <td className="py-3 px-3 text-center border-r border-slate-300 font-extrabold text-indigo-700">
                    {totalStok}
                  </td>
                  <td className="border-r border-slate-300"></td>
                  <td className="border-r border-slate-300"></td>
                  <td className="py-3 px-4 text-right border-r border-slate-300 font-extrabold">
                    {formatRp(totalAssetModal)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                    {formatRp(totalAssetJual)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
