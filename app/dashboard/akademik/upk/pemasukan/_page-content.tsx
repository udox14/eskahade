'use client'

import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  Banknote,
  CalendarDays,
  CheckCircle,
  Edit,
  HandCoins,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  getPemasukanUPK,
  getRingkasanPenjualanUPK,
  hapusPemasukanUPK,
  simpanPemasukanUPK,
} from './actions'

type KategoriPemasukan = 'SETORAN_PENJUALAN' | 'PINJAMAN_MODAL' | 'LAINNYA'

type Ringkasan = {
  tanggal: string
  total_transaksi: number
  total_tagihan: number
  total_bayar: number
  total_tunggakan: number
  total_kembalian_ditahan: number
  total_setoran: number
  total_pinjaman: number
  total_lainnya: number
  sisa_belum_direkap: number
  selisih: number
}

type PemasukanItem = {
  id: string
  tanggal: string
  waktu_catat: string
  kategori: KategoriPemasukan
  sumber: string | null
  nominal: number
  penjualan_seharusnya: number
  selisih: number
  catatan: string | null
  user_name: string | null
}

type FormState = {
  id: string
  kategori: KategoriPemasukan
  sumber: string
  nominal: string
  penjualanSeharusnya: string
  catatan: string
}

const emptyForm: FormState = {
  id: '',
  kategori: 'SETORAN_PENJUALAN',
  sumber: '',
  nominal: '0',
  penjualanSeharusnya: '0',
  catatan: '',
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function toInt(value: string) {
  const parsed = parseInt(value || '0', 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function tanggalWaktu(value: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function kategoriLabel(kategori: KategoriPemasukan) {
  if (kategori === 'PINJAMAN_MODAL') return 'Pinjaman Modal'
  if (kategori === 'LAINNYA') return 'Lainnya'
  return 'Setoran Penjualan'
}

export default function PemasukanUPKPage() {
  const confirm = useConfirm()
  const [tanggal, setTanggal] = useState(todayInput())
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null)
  const [pemasukan, setPemasukan] = useState<PemasukanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const nominalForm = toInt(form.nominal)
  const selisihForm = nominalForm - toInt(form.penjualanSeharusnya)

  const loadData = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    const [summary, rows] = await Promise.all([
      getRingkasanPenjualanUPK(tanggal),
      getPemasukanUPK(tanggal),
    ])
    setRingkasan(summary)
    setPemasukan(rows)
    setLoading(false)
  }, [tanggal])

  useEffect(() => {
    let ignore = false
    async function run() {
      const [summary, rows] = await Promise.all([
        getRingkasanPenjualanUPK(tanggal),
        getPemasukanUPK(tanggal),
      ])
      if (ignore) return
      setRingkasan(summary)
      setPemasukan(rows)
      setLoading(false)
    }
    run()
    return () => {
      ignore = true
    }
  }, [tanggal])

  const setField = (key: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const openTambah = (kategori: KategoriPemasukan = 'SETORAN_PENJUALAN') => {
    setForm({
      ...emptyForm,
      kategori,
      penjualanSeharusnya: kategori === 'SETORAN_PENJUALAN' ? String(ringkasan?.total_bayar ?? 0) : '0',
    })
    setIsModalOpen(true)
  }

  const handleEdit = (item: PemasukanItem) => {
    setForm({
      id: item.id,
      kategori: item.kategori,
      sumber: item.sumber ?? '',
      nominal: String(item.nominal ?? 0),
      penjualanSeharusnya: String(item.penjualan_seharusnya ?? 0),
      catatan: item.catatan ?? '',
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const result = await simpanPemasukanUPK({
      id: form.id || undefined,
      tanggal,
      kategori: form.kategori,
      sumber: form.sumber,
      nominal: toInt(form.nominal),
      penjualanSeharusnya: toInt(form.penjualanSeharusnya),
      catatan: form.catatan,
    })
    setSaving(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    toast.success(form.id ? 'Pemasukan diperbarui' : 'Pemasukan dicatat')
    setIsModalOpen(false)
    setForm(emptyForm)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!await confirm('Hapus catatan pemasukan ini?')) return
    const result = await hapusPemasukanUPK(id)
    if ('error' in result) toast.error(result.error)
    else {
      toast.success('Pemasukan dihapus')
      loadData()
    }
  }

  const tarikPenjualan = () => {
    setField('penjualanSeharusnya', String(ringkasan?.total_bayar ?? 0))
    toast.success('Nominal penjualan ditarik dari Kasir')
  }

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-24">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-600" /> Pemasukan
          </h1>
          <p className="text-slate-500 text-sm">Catatan uang fisik, setoran harian, dan pinjaman modal UPK.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
              className="pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm font-bold bg-white"
            />
          </div>
          <button onClick={loadData} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-2 text-sm font-bold text-slate-700">
            <RefreshCw className="w-4 h-4" /> Muat
          </button>
          <button onClick={() => openTambah('SETORAN_PENJUALAN')} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold">
            <Plus className="w-4 h-4" /> Catat Pemasukan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Penjualan Diterima</p>
          <p className="text-lg font-extrabold text-slate-800">{rupiah(ringkasan?.total_bayar ?? 0)}</p>
          <p className="text-xs text-slate-500">{ringkasan?.total_transaksi ?? 0} transaksi selesai</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Setoran Dicatat</p>
          <p className="text-lg font-extrabold text-emerald-700">{rupiah(ringkasan?.total_setoran ?? 0)}</p>
          <p className="text-xs text-slate-500">uang fisik yang dicatat</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Belum Direkap</p>
          <p className="text-lg font-extrabold text-amber-700">{rupiah(ringkasan?.sisa_belum_direkap ?? 0)}</p>
          <p className="text-xs text-slate-500">biasanya uang kecil/kembalian</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Pinjaman Modal</p>
          <p className="text-lg font-extrabold text-blue-700">{rupiah(ringkasan?.total_pinjaman ?? 0)}</p>
          <p className="text-xs text-slate-500">masuk kas, tetap hutang modal</p>
        </div>
        <div className="bg-white border rounded-lg p-4 col-span-2 xl:col-span-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Info Kasir</p>
          <p className="text-sm font-bold text-slate-700">Tunggakan {rupiah(ringkasan?.total_tunggakan ?? 0)}</p>
          <p className="text-xs text-slate-500">Kembalian ditahan {rupiah(ringkasan?.total_kembalian_ditahan ?? 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <button onClick={() => openTambah('SETORAN_PENJUALAN')} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-left hover:bg-emerald-100">
          <Banknote className="w-5 h-5 text-emerald-700 mb-2" />
          <p className="font-extrabold text-emerald-900">Setoran Penjualan</p>
          <p className="text-xs text-emerald-700">Catat total uang fisik dari hasil kasir.</p>
        </button>
        <button onClick={() => openTambah('PINJAMAN_MODAL')} className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left hover:bg-blue-100">
          <HandCoins className="w-5 h-5 text-blue-700 mb-2" />
          <p className="font-extrabold text-blue-900">Pinjaman Modal</p>
          <p className="text-xs text-blue-700">Uang masuk untuk modal, terpisah dari omzet dan hutang toko.</p>
        </button>
        <button onClick={() => openTambah('LAINNYA')} className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left hover:bg-slate-100">
          <Plus className="w-5 h-5 text-slate-700 mb-2" />
          <p className="font-extrabold text-slate-900">Pemasukan Lain</p>
          <p className="text-xs text-slate-600">Untuk koreksi atau sumber lain yang bukan penjualan/pinjaman.</p>
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between gap-2">
          <p className="font-bold text-slate-800">Riwayat Pemasukan</p>
          <p className="text-xs font-semibold text-slate-500">{pemasukan.length} catatan</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3 text-right">Penjualan</th>
                <th className="px-4 py-3 text-right">Selisih</th>
                <th className="px-4 py-3">Catatan</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-600" /></td></tr>
              ) : pemasukan.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400">Belum ada pemasukan pada tanggal ini.</td></tr>
              ) : pemasukan.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-700">{tanggalWaktu(item.waktu_catat)}</p>
                    <p className="text-[11px] text-slate-400">{item.user_name || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800">{kategoriLabel(item.kategori)}</p>
                    {item.sumber && <p className="text-xs text-slate-500">{item.sumber}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-700">{rupiah(item.nominal)}</td>
                  <td className="px-4 py-3 text-right font-mono">{item.kategori === 'SETORAN_PENJUALAN' ? rupiah(item.penjualan_seharusnya) : '-'}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${item.selisih < 0 ? 'text-amber-700' : item.selisih > 0 ? 'text-blue-700' : 'text-emerald-700'}`}>
                    {item.kategori === 'SETORAN_PENJUALAN' ? rupiah(item.selisih) : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs">
                    <p className="line-clamp-2">{item.catatan || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                {form.id ? 'Edit Pemasukan' : 'Catat Pemasukan'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setForm(emptyForm) }} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Kategori</label>
                  <select
                    value={form.kategori}
                    onChange={e => {
                      const kategori = e.target.value as KategoriPemasukan
                      setForm(prev => ({
                        ...prev,
                        kategori,
                        penjualanSeharusnya: kategori === 'SETORAN_PENJUALAN' ? String(ringkasan?.total_bayar ?? 0) : '0',
                      }))
                    }}
                    className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="SETORAN_PENJUALAN">Setoran Penjualan</option>
                    <option value="PINJAMAN_MODAL">Pinjaman Modal</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Sumber/Pemberi</label>
                  <input value={form.sumber} onChange={e => setField('sumber', e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm" placeholder="Kasir, nama pemberi pinjaman, dll." />
                </div>
              </div>

              {form.kategori === 'SETORAN_PENJUALAN' && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-emerald-700">Penjualan diterima dari Kasir</p>
                    <p className="text-lg font-extrabold text-emerald-900">{rupiah(toInt(form.penjualanSeharusnya))}</p>
                  </div>
                  <button type="button" onClick={tarikPenjualan} className="px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                    Tarik dari Penjualan
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Nominal Uang Dicatat</label>
                <input
                  type="number"
                  min="0"
                  value={form.nominal}
                  onChange={e => setField('nominal', e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
                  placeholder="Masukkan total uang fisik"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 border rounded-lg p-3 text-xs">
                <div>
                  <p className="font-bold text-slate-400 uppercase">Nominal</p>
                  <p className="font-extrabold text-emerald-700">{rupiah(nominalForm)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase">Penjualan</p>
                  <p className="font-extrabold text-slate-800">{form.kategori === 'SETORAN_PENJUALAN' ? rupiah(toInt(form.penjualanSeharusnya)) : '-'}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 uppercase">Selisih</p>
                  <p className={`font-extrabold ${selisihForm < 0 ? 'text-amber-700' : selisihForm > 0 ? 'text-blue-700' : 'text-emerald-700'}`}>
                    {form.kategori === 'SETORAN_PENJUALAN' ? rupiah(selisihForm) : '-'}
                  </p>
                </div>
              </div>

              {form.kategori === 'SETORAN_PENJUALAN' && selisihForm < 0 && (
                <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Selisih minus dianggap sisa belum direkap, biasanya pecahan kecil yang masih dipakai kembalian.
                </p>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Catatan</label>
                <textarea value={form.catatan} onChange={e => setField('catatan', e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm min-h-20" placeholder="Catatan setoran, pinjaman, atau kondisi uang kecil" />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => { setIsModalOpen(false); setForm(emptyForm) }} className="px-4 py-2.5 border border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50">
                  Batal
                </button>
                <button disabled={saving} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Simpan Pemasukan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
