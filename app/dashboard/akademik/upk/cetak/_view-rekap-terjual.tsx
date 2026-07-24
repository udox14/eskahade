'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, FileSpreadsheet, FileText, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { getRekapKitabTerjualData, type RekapTerjualItem, type UnitUPK } from './actions'
import { exportRekapTerjualExcel, exportRekapTerjualWord } from './_export-utils'

function formatRp(num: number) {
  return `Rp ${num.toLocaleString('id-ID')}`
}

export function RekapTerjualView({
  tipeStok,
  onBack,
}: {
  tipeStok: 'BARU' | 'LAMA'
  onBack: () => void
}) {
  const [unit, setUnit] = useState<'' | UnitUPK>('')
  const [tanggalDari, setTanggalDari] = useState('')
  const [tanggalSampai, setTanggalSampai] = useState('')
  const [items, setItems] = useState<RekapTerjualItem[]>([])
  const [loading, setLoading] = useState(true)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRekapKitabTerjualData({
        tipeStok,
        unit,
        tanggalDari,
        tanggalSampai,
      })
      setItems(data)
    } catch (err) {
      console.error('Gagal memuat rekap penjualan:', err)
      toast.error('Gagal mengambil data rekap penjualan kitab.')
    } finally {
      setLoading(false)
    }
  }, [tipeStok, unit, tanggalDari, tanggalSampai])

  useEffect(() => {
    loadData()
  }, [loadData])

  const getSubtitle = () => {
    const parts: string[] = []
    if (unit) parts.push(`Unit: ${unit}`)
    if (tanggalDari && tanggalSampai) parts.push(`Periode: ${tanggalDari} s.d ${tanggalSampai}`)
    else if (tanggalDari) parts.push(`Dari: ${tanggalDari}`)
    else if (tanggalSampai) parts.push(`Sampai: ${tanggalSampai}`)
    return parts.length ? parts.join(' | ') : 'Semua Periode Transaksi'
  }

  const handleExportExcel = async () => {
    if (!items.length || exportingExcel) return
    setExportingExcel(true)
    try {
      await exportRekapTerjualExcel(items, tipeStok, getSubtitle())
      toast.success(`File Excel Rekap Kitab Terjual (Stok ${tipeStok}) berhasil diunduh.`)
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
      exportRekapTerjualWord(items, tipeStok, getSubtitle())
      toast.success(`File Word Rekap Kitab Terjual (Stok ${tipeStok}) berhasil diunduh.`)
    } catch (err) {
      console.error('Gagal export Word:', err)
      toast.error('Gagal mengunduh file Word.')
    } finally {
      setExportingWord(false)
    }
  }

  const totalQty = items.reduce((acc, i) => acc + i.qty_terjual, 0)
  const totalModal = items.reduce((acc, i) => acc + i.modal, 0)
  const totalLabaKotor = items.reduce((acc, i) => acc + i.laba_kotor, 0)

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
              Rekap Kitab Terjual (Stok {tipeStok})
            </h1>
            <p className="text-xs text-slate-500">
              Dokumen rekapitulasi penjualan kitab khusus stok {tipeStok.toLowerCase()}.
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
          <label className="text-xs font-semibold text-slate-600">Unit:</label>
          <select
            value={unit}
            onChange={e => setUnit(e.target.value as any)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white font-medium"
          >
            <option value="">Semua Unit</option>
            <option value="PUTRA">Putra</option>
            <option value="PUTRI">Putri</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Dari:</label>
          <input
            type="date"
            value={tanggalDari}
            onChange={e => setTanggalDari(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Sampai:</label>
          <input
            type="date"
            value={tanggalSampai}
            onChange={e => setTanggalSampai(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white font-medium"
          />
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
            REKAP PENJUALAN KITAB STOK {tipeStok}
          </h2>
          <p className="text-xs text-slate-500 italic mt-0.5">{getSubtitle()}</p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
            <p className="text-xs font-medium">Memuat data rekap penjualan...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm font-semibold">Tidak ada data penjualan kitab stok {tipeStok.toLowerCase()}.</p>
            <p className="text-xs text-slate-400 mt-1">Coba sesuaikan filter unit atau rentang tanggal.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                  <th className="py-2.5 px-3 border-r border-slate-300 text-center w-12">NO</th>
                  <th className="py-2.5 px-4 border-r border-slate-300 text-left">NAMA KITAB</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 text-center w-24">TERJUAL</th>
                  <th className="py-2.5 px-4 border-r border-slate-300 text-right w-32">HARGA BELI</th>
                  <th className="py-2.5 px-4 border-r border-slate-300 text-right w-32">HARGA JUAL</th>
                  <th className="py-2.5 px-4 border-r border-slate-300 text-right w-36">MODAL</th>
                  <th className="py-2.5 px-4 text-right w-36">LABA KOTOR</th>
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
                    <td className="py-2 px-3 text-center border-r border-slate-200 font-bold text-slate-700">
                      {item.qty_terjual}
                    </td>
                    <td className="py-2 px-4 text-right border-r border-slate-200 font-medium text-slate-600">
                      {formatRp(item.harga_beli)}
                    </td>
                    <td className="py-2 px-4 text-right border-r border-slate-200 font-medium text-slate-600">
                      {formatRp(item.harga_jual)}
                    </td>
                    <td className="py-2 px-4 text-right border-r border-slate-200 font-medium text-slate-700">
                      {formatRp(item.modal)}
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-slate-800">
                      {formatRp(item.laba_kotor)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-slate-900">
                  <td colSpan={2} className="py-3 px-4 text-center border-r border-slate-300 tracking-wider">
                    JUMLAH TOTAL
                  </td>
                  <td className="py-3 px-3 text-center border-r border-slate-300 font-extrabold text-indigo-700">
                    {totalQty}
                  </td>
                  <td className="border-r border-slate-300"></td>
                  <td className="border-r border-slate-300"></td>
                  <td className="py-3 px-4 text-right border-r border-slate-300 font-extrabold">
                    {formatRp(totalModal)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                    {formatRp(totalLabaKotor)}
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
