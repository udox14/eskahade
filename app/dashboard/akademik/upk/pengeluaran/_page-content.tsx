'use client'

import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays,
  CheckCircle,
  CreditCard,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
  Trash2,
  Utensils,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  getHutangTokoOptions,
  getKatalogRoyaltiOptions,
  getPengeluaranUPK,
  getPinjamanModalOptions,
  getRingkasanPengeluaranUPK,
  hapusPengeluaranUPK,
  simpanPengeluaranUPK,
} from './actions'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

type KategoriPengeluaran =
  | 'KONSUMSI'
  | 'TRANSPORT'
  | 'BAYAR_HUTANG_TOKO'
  | 'BAYAR_PINJAMAN_MODAL'
  | 'ROYALTI_PENULIS'
  | 'OPERASIONAL'
  | 'LAINNYA'

type Ringkasan = {
  tanggal: string
  total: number
  konsumsi: number
  transport: number
  hutang_toko: number
  hutang_modal: number
  royalti: number
  sisa_hutang_toko: number
  sisa_hutang_modal: number
}

type PengeluaranItem = {
  id: string
  tanggal: string
  waktu_catat: string
  kategori: KategoriPengeluaran
  penerima: string | null
  nominal: number
  belanja_id: string | null
  katalog_id: number | null
  nama_kitab: string | null
  catatan: string | null
  user_name: string | null
}

type HutangToko = {
  id: string
  tanggal: string
  jenis: string
  toko_nama: string | null
  total: number
  dibayar: number
  sisa_hutang: number
}

type PinjamanModal = {
  sumber: string
  total_pinjaman: number
  total_dibayar: number
  sisa: number
}

type KatalogOption = {
  id: number
  nama_kitab: string
  marhalah_nama: string | null
}

type FormState = {
  id: string
  kategori: KategoriPengeluaran
  penerima: string
  nominal: string
  belanjaId: string
  katalogId: string
  namaKitab: string
  catatan: string
}

const emptyForm: FormState = {
  id: '',
  kategori: 'KONSUMSI',
  penerima: '',
  nominal: '0',
  belanjaId: '',
  katalogId: '',
  namaKitab: '',
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

function kategoriLabel(kategori: KategoriPengeluaran) {
  const labels: Record<KategoriPengeluaran, string> = {
    KONSUMSI: 'Konsumsi',
    TRANSPORT: 'Transport',
    BAYAR_HUTANG_TOKO: 'Bayar Hutang Toko',
    BAYAR_PINJAMAN_MODAL: 'Bayar Pinjaman Modal',
    ROYALTI_PENULIS: 'Royalti Penulis',
    OPERASIONAL: 'Operasional',
    LAINNYA: 'Lainnya',
  }
  return labels[kategori]
}

export default function PengeluaranUPKPage() {
  const confirm = useConfirm()
  const [tanggal, setTanggal] = useState(todayInput())
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null)
  const [pengeluaran, setPengeluaran] = useState<PengeluaranItem[]>([])
  const [hutangToko, setHutangToko] = useState<HutangToko[]>([])
  const [pinjamanModal, setPinjamanModal] = useState<PinjamanModal[]>([])
  const [katalog, setKatalog] = useState<KatalogOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const loadData = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    const [summary, rows, debts, loans, books] = await Promise.all([
      getRingkasanPengeluaranUPK(tanggal),
      getPengeluaranUPK(tanggal),
      getHutangTokoOptions(),
      getPinjamanModalOptions(),
      getKatalogRoyaltiOptions(),
    ])
    setRingkasan(summary)
    setPengeluaran(rows)
    setHutangToko(debts)
    setPinjamanModal(loans)
    setKatalog(books)
    setLoading(false)
  }, [tanggal])

  useEffect(() => {
    let ignore = false
    async function run() {
      const [summary, rows, debts, loans, books] = await Promise.all([
        getRingkasanPengeluaranUPK(tanggal),
        getPengeluaranUPK(tanggal),
        getHutangTokoOptions(),
        getPinjamanModalOptions(),
        getKatalogRoyaltiOptions(),
      ])
      if (ignore) return
      setRingkasan(summary)
      setPengeluaran(rows)
      setHutangToko(debts)
      setPinjamanModal(loans)
      setKatalog(books)
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

  const openTambah = (kategori: KategoriPengeluaran = 'KONSUMSI') => {
    setForm({ ...emptyForm, kategori })
    setIsModalOpen(true)
  }

  const handleEdit = (item: PengeluaranItem) => {
    setForm({
      id: item.id,
      kategori: item.kategori,
      penerima: item.penerima ?? '',
      nominal: String(item.nominal ?? 0),
      belanjaId: item.belanja_id ?? '',
      katalogId: item.katalog_id ? String(item.katalog_id) : '',
      namaKitab: item.nama_kitab ?? '',
      catatan: item.catatan ?? '',
    })
    setIsModalOpen(true)
  }

  const handlePilihHutangToko = (id: string) => {
    const selected = hutangToko.find(item => item.id === id)
    setForm(prev => ({
      ...prev,
      belanjaId: id,
      penerima: selected?.toko_nama ?? prev.penerima,
      nominal: selected ? String(selected.sisa_hutang) : prev.nominal,
    }))
  }

  const handlePilihPinjaman = (sumber: string) => {
    const selected = pinjamanModal.find(item => item.sumber === sumber)
    setForm(prev => ({
      ...prev,
      penerima: sumber,
      nominal: selected ? String(selected.sisa) : prev.nominal,
    }))
  }

  const handlePilihKitab = (id: string) => {
    const selected = katalog.find(item => String(item.id) === id)
    setForm(prev => ({
      ...prev,
      katalogId: id,
      namaKitab: selected?.nama_kitab ?? '',
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const result = await simpanPengeluaranUPK({
      id: form.id || undefined,
      tanggal,
      kategori: form.kategori,
      penerima: form.penerima,
      nominal: toInt(form.nominal),
      belanjaId: form.belanjaId || undefined,
      katalogId: form.katalogId ? toInt(form.katalogId) : null,
      namaKitab: form.namaKitab,
      catatan: form.catatan,
    })
    setSaving(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    toast.success(form.id ? 'Pengeluaran diperbarui' : 'Pengeluaran dicatat')
    setIsModalOpen(false)
    setForm(emptyForm)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!await confirm('Hapus catatan pengeluaran ini?')) return
    const result = await hapusPengeluaranUPK(id)
    if ('error' in result) toast.error(result.error)
    else {
      toast.success('Pengeluaran dihapus')
      loadData()
    }
  }

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-24">
      <DashboardPageHeader
        title="Pengeluaran"
        description="Catat kas keluar, bayar hutang toko, bayar pinjaman modal, dan royalti penulis."
        className="border-b pb-4"
        action={(
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
            <button onClick={() => openTambah('KONSUMSI')} className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-bold">
              <Plus className="w-4 h-4" /> Catat Pengeluaran
            </button>
          </div>
        )}
      />

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Pengeluaran Hari Ini</p>
          <p className="text-lg font-extrabold text-red-700">{rupiah(ringkasan?.total ?? 0)}</p>
          <p className="text-xs text-slate-500">{pengeluaran.length} catatan</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Bayar Hutang Toko</p>
          <p className="text-lg font-extrabold text-blue-700">{rupiah(ringkasan?.hutang_toko ?? 0)}</p>
          <p className="text-xs text-slate-500">sisa {rupiah(ringkasan?.sisa_hutang_toko ?? 0)}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Bayar Pinjaman</p>
          <p className="text-lg font-extrabold text-emerald-700">{rupiah(ringkasan?.hutang_modal ?? 0)}</p>
          <p className="text-xs text-slate-500">sisa {rupiah(ringkasan?.sisa_hutang_modal ?? 0)}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Royalti Penulis</p>
          <p className="text-lg font-extrabold text-purple-700">{rupiah(ringkasan?.royalti ?? 0)}</p>
          <p className="text-xs text-slate-500">bagian laba kitab tertentu</p>
        </div>
        <div className="bg-white border rounded-lg p-4 col-span-2 xl:col-span-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Operasional</p>
          <p className="text-sm font-bold text-slate-700">Konsumsi {rupiah(ringkasan?.konsumsi ?? 0)}</p>
          <p className="text-xs text-slate-500">Transport {rupiah(ringkasan?.transport ?? 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <button onClick={() => openTambah('KONSUMSI')} className="bg-red-50 border border-red-200 rounded-lg p-4 text-left hover:bg-red-100">
          <Utensils className="w-5 h-5 text-red-700 mb-2" />
          <p className="font-extrabold text-red-900">Konsumsi/Operasional</p>
          <p className="text-xs text-red-700">Makan, minum, kebutuhan acara, dan biaya kecil lain.</p>
        </button>
        <button onClick={() => openTambah('BAYAR_HUTANG_TOKO')} className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left hover:bg-blue-100">
          <CreditCard className="w-5 h-5 text-blue-700 mb-2" />
          <p className="font-extrabold text-blue-900">Bayar Hutang Toko</p>
          <p className="text-xs text-blue-700">Mengurangi sisa hutang dari transaksi Belanja.</p>
        </button>
        <button onClick={() => openTambah('BAYAR_PINJAMAN_MODAL')} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-left hover:bg-emerald-100">
          <Wallet className="w-5 h-5 text-emerald-700 mb-2" />
          <p className="font-extrabold text-emerald-900">Bayar Pinjaman Modal</p>
          <p className="text-xs text-emerald-700">Pelunasan modal yang sebelumnya dicatat di Pemasukan.</p>
        </button>
        <button onClick={() => openTambah('ROYALTI_PENULIS')} className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-left hover:bg-purple-100">
          <ScrollText className="w-5 h-5 text-purple-700 mb-2" />
          <p className="font-extrabold text-purple-900">Royalti Penulis</p>
          <p className="text-xs text-purple-700">Bagian laba kitab tertentu untuk penulis.</p>
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between gap-2">
          <p className="font-bold text-slate-800">Riwayat Pengeluaran</p>
          <p className="text-xs font-semibold text-slate-500">{pengeluaran.length} catatan</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Penerima</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-red-600" /></td></tr>
              ) : pengeluaran.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-slate-400">Belum ada pengeluaran pada tanggal ini.</td></tr>
              ) : pengeluaran.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-700">{tanggalWaktu(item.waktu_catat)}</p>
                    <p className="text-[11px] text-slate-400">{item.user_name || '-'}</p>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800">{kategoriLabel(item.kategori)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <p className="font-semibold">{item.penerima || '-'}</p>
                    {item.nama_kitab && <p className="text-xs text-slate-500">{item.nama_kitab}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-extrabold text-red-700">{rupiah(item.nominal)}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-sm">
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
                <CreditCard className="w-4 h-4 text-red-600" />
                {form.id ? 'Edit Pengeluaran' : 'Catat Pengeluaran'}
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
                    onChange={e => setForm(prev => ({ ...prev, kategori: e.target.value as KategoriPengeluaran, belanjaId: '', katalogId: '', namaKitab: '' }))}
                    className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="KONSUMSI">Konsumsi</option>
                    <option value="TRANSPORT">Transport</option>
                    <option value="BAYAR_HUTANG_TOKO">Bayar Hutang Toko</option>
                    <option value="BAYAR_PINJAMAN_MODAL">Bayar Pinjaman Modal</option>
                    <option value="ROYALTI_PENULIS">Royalti Penulis</option>
                    <option value="OPERASIONAL">Operasional</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Nominal</label>
                  <input type="number" min="0" value={form.nominal} onChange={e => setField('nominal', e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>

              {form.kategori === 'BAYAR_HUTANG_TOKO' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Hutang Toko</label>
                  <select value={form.belanjaId} onChange={e => handlePilihHutangToko(e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="">Pilih hutang toko</option>
                    {hutangToko.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.tanggal} - {item.toko_nama || 'Tanpa toko'} - sisa {rupiah(item.sisa_hutang)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.kategori === 'BAYAR_PINJAMAN_MODAL' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Pemberi Pinjaman</label>
                  <select value={form.penerima} onChange={e => handlePilihPinjaman(e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="">Pilih pemberi pinjaman</option>
                    {pinjamanModal.map(item => (
                      <option key={item.sumber} value={item.sumber}>
                        {item.sumber} - sisa {rupiah(item.sisa)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.kategori === 'ROYALTI_PENULIS' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Kitab Terkait</label>
                  <select value={form.katalogId} onChange={e => handlePilihKitab(e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="">Pilih kitab jika ada</option>
                    {katalog.map(item => (
                      <option key={item.id} value={item.id}>{item.nama_kitab} - {item.marhalah_nama || '-'}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">
                  {form.kategori === 'ROYALTI_PENULIS' ? 'Penulis/Penerima' : form.kategori === 'BAYAR_PINJAMAN_MODAL' ? 'Pemberi Pinjaman' : 'Penerima/Sumber'}
                </label>
                <input
                  value={form.penerima}
                  onChange={e => setField('penerima', e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
                  placeholder="Nama penerima atau tujuan pengeluaran"
                />
              </div>

              <div className="bg-slate-50 border rounded-lg p-3">
                <p className="text-xs font-bold text-slate-400 uppercase">Total Keluar</p>
                <p className="text-xl font-extrabold text-red-700">{rupiah(toInt(form.nominal))}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Catatan</label>
                <textarea value={form.catatan} onChange={e => setField('catatan', e.target.value)} className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm min-h-20" placeholder="Catatan pembayaran, bukti, atau rincian pengeluaran" />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => { setIsModalOpen(false); setForm(emptyForm) }} className="px-4 py-2.5 border border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50">
                  Batal
                </button>
                <button disabled={saving} className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
