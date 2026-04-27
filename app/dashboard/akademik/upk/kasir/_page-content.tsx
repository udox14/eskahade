'use client'

import type React from 'react'
import { useMemo, useState } from 'react'
import {
  buatAntrianUPK,
  cariSantriUPK,
  getAntrianAktif,
  getAntrianDetail,
  getKatalogKasir,
  selesaikanAntrianUPK,
} from './actions'
import { ArrowLeft, Check, CheckCircle, Loader2, Minus, Package, Plus, Search, ShoppingCart, Ticket, User, X } from 'lucide-react'
import { toast } from 'sonner'

type UnitUPK = 'PUTRA' | 'PUTRI'

type SantriOption = {
  id: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  kelas_id: string | null
  nama_kelas: string | null
  marhalah_id: number | null
  marhalah_nama: string | null
}

type KatalogItem = {
  id: number
  nama_kitab: string
  marhalah_id: number | null
  marhalah_nama: string | null
  harga_jual: number
  jumlah_stok: number
  is_default: boolean
}

type CartItem = KatalogItem & {
  qty: number
  selected: boolean
}

type Antrian = {
  id: string
  nomor: number
  nama_santri: string
  nis: string | null
  kelas_nama: string | null
  marhalah_nama: string | null
  total_tagihan: number
  total_item?: number
}

type AntrianDetail = Antrian & {
  items: Array<{
    id: string
    katalog_id: number | null
    nama_kitab: string
    qty: number
    harga_jual: number
    subtotal: number
    jumlah_stok: number
  }>
}

type FinalItem = {
  itemId: string
  qty: number
  diserahkan: boolean
}

function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function nomor(value: number) {
  return String(value || 0).padStart(3, '0')
}

export default function KasirUPKPage() {
  const [unit, setUnit] = useState<UnitUPK | null>(null)
  const [mode, setMode] = useState<'CATAT' | 'KASIR'>('CATAT')
  const [searchSantri, setSearchSantri] = useState('')
  const [hasilSantri, setHasilSantri] = useState<SantriOption[]>([])
  const [selectedSantri, setSelectedSantri] = useState<SantriOption | null>(null)
  const [katalog, setKatalog] = useState<CartItem[]>([])
  const [katalogSearch, setKatalogSearch] = useState('')
  const [catatan, setCatatan] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastNomor, setLastNomor] = useState<number | null>(null)

  const [searchAntrian, setSearchAntrian] = useState('')
  const [antrianList, setAntrianList] = useState<Antrian[]>([])
  const [selectedAntrian, setSelectedAntrian] = useState<AntrianDetail | null>(null)
  const [finalItems, setFinalItems] = useState<FinalItem[]>([])
  const [uangBayar, setUangBayar] = useState('')
  const [kembalianDitahan, setKembalianDitahan] = useState(false)

  const selectedItems = katalog.filter(item => item.selected)
  const totalCatat = selectedItems.reduce((sum, item) => sum + item.qty * item.harga_jual, 0)
  const totalKasir = finalItems.reduce((sum, item) => {
    const row = selectedAntrian?.items.find(i => i.id === item.itemId)
    return sum + (row ? item.qty * row.harga_jual : 0)
  }, 0)
  const bayar = parseInt(uangBayar || '0', 10) || 0
  const diff = bayar - totalKasir

  const filteredKatalog = useMemo(() => {
    const keyword = katalogSearch.toLowerCase().trim()
    if (!keyword) return katalog
    return katalog.filter(item => item.nama_kitab.toLowerCase().includes(keyword) || (item.marhalah_nama || '').toLowerCase().includes(keyword))
  }, [katalog, katalogSearch])

  const pilihUnit = (nextUnit: UnitUPK) => {
    setUnit(nextUnit)
    setMode('CATAT')
  }

  const resetCatat = () => {
    setSearchSantri('')
    setHasilSantri([])
    setSelectedSantri(null)
    setKatalog([])
    setKatalogSearch('')
    setCatatan('')
  }

  const cariSantri = async () => {
    if (!unit) return
    if (searchSantri.trim().length < 2) return toast.warning('Ketik minimal 2 huruf.')
    setLoading(true)
    const data = await cariSantriUPK(unit, searchSantri)
    setHasilSantri(data)
    setLoading(false)
    if (!data.length) toast.info('Santri tidak ditemukan.')
  }

  const pilihSantri = async (santri: SantriOption) => {
    setSelectedSantri(santri)
    setHasilSantri([])
    setSearchSantri('')
    setLoading(true)
    const data = await getKatalogKasir(santri.marhalah_id)
    setKatalog(data.map((item: KatalogItem) => ({ ...item, qty: 1, selected: item.is_default })))
    setLoading(false)
    if (!santri.marhalah_id) toast.warning('Santri ini belum punya marhalah aktif.')
  }

  const toggleItem = (id: number) => {
    setKatalog(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item))
  }

  const ubahQty = (id: number, delta: number) => {
    setKatalog(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(1, item.qty + delta), selected: true } : item))
  }

  const simpanAntrian = async () => {
    if (!unit || !selectedSantri) return toast.warning('Pilih santri dulu.')
    if (!selectedItems.length) return toast.warning('Pilih minimal satu kitab.')
    setLoading(true)
    const result = await buatAntrianUPK({
      unit,
      santri: selectedSantri,
      catatan,
      items: selectedItems.map(item => ({
        katalogId: item.id,
        namaKitab: item.nama_kitab,
        marhalahId: item.marhalah_id,
        marhalahNama: item.marhalah_nama,
        qty: item.qty,
        hargaJual: item.harga_jual,
      })),
    })
    setLoading(false)
    if ('error' in result) return toast.error(result.error)
    setLastNomor(result.nomor)
    toast.success(`Antrian ${nomor(result.nomor)} dibuat`)
    resetCatat()
  }

  const loadAntrian = async () => {
    if (!unit) return
    setLoading(true)
    const data = await getAntrianAktif(unit, searchAntrian)
    setAntrianList(data)
    setLoading(false)
  }

  const pilihAntrian = async (id: string) => {
    setLoading(true)
    const detail = await getAntrianDetail(id)
    setLoading(false)
    if (!detail) return toast.error('Antrian tidak ditemukan.')
    setSelectedAntrian(detail)
    setFinalItems(detail.items.map(item => ({ itemId: item.id, qty: item.qty, diserahkan: true })))
    setUangBayar(String(detail.total_tagihan || detail.items.reduce((sum, item) => sum + item.subtotal, 0)))
    setKembalianDitahan(false)
  }

  const updateFinalItem = (itemId: string, patch: Partial<FinalItem>) => {
    setFinalItems(prev => prev.map(item => item.itemId === itemId ? { ...item, ...patch, qty: Math.max(1, patch.qty ?? item.qty) } : item))
  }

  const prosesBayar = async () => {
    if (!unit || !selectedAntrian) return
    setLoading(true)
    const result = await selesaikanAntrianUPK({
      antrianId: selectedAntrian.id,
      unit,
      totalBayar: bayar,
      kembalianDitahan,
      items: finalItems,
    })
    setLoading(false)
    if ('error' in result) return toast.error(result.error)
    toast.success('Transaksi selesai')
    setSelectedAntrian(null)
    setFinalItems([])
    setUangBayar('')
    setKembalianDitahan(false)
    loadAntrian()
  }

  if (!unit) {
    return (
      <div className="max-w-5xl mx-auto pb-20 space-y-6">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><ShoppingCart className="w-6 h-6 text-blue-600" /> Kasir UPK</h1>
          <p className="text-sm text-slate-500">Pilih unit untuk memulai pencatatan dan pembayaran.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => pilihUnit('PUTRA')} className="bg-white border rounded-xl p-8 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors">
            <p className="text-3xl font-extrabold text-blue-700">UPK Putra</p>
            <p className="text-sm text-slate-500 mt-2">Menampilkan santri putra saja.</p>
          </button>
          <button onClick={() => pilihUnit('PUTRI')} className="bg-white border rounded-xl p-8 text-left hover:border-rose-300 hover:bg-rose-50 transition-colors">
            <p className="text-3xl font-extrabold text-rose-700">UPK Putri</p>
            <p className="text-sm text-slate-500 mt-2">Menampilkan santri putri saja.</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1500px] mx-auto pb-28 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setUnit(null); resetCatat() }} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kasir UPK {unit === 'PUTRA' ? 'Putra' : 'Putri'}</h1>
            <p className="text-sm text-slate-500">Nomor antrian harian, pencatatan pesanan, dan pembayaran.</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setMode('CATAT')} className={`px-4 py-2 rounded-md text-sm font-bold ${mode === 'CATAT' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Pencatat</button>
          <button onClick={() => { setMode('KASIR'); loadAntrian() }} className={`px-4 py-2 rounded-md text-sm font-bold ${mode === 'KASIR' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Kasir</button>
        </div>
      </div>

      {lastNomor && mode === 'CATAT' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase">Nomor Antrian Terakhir</p>
            <p className="text-4xl font-extrabold text-amber-900">{nomor(lastNomor)}</p>
          </div>
          <button onClick={() => setLastNomor(null)} className="p-2 hover:bg-amber-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}

      {mode === 'CATAT' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_320px] gap-4">
          <section className="bg-white border rounded-xl p-4 space-y-3">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><User className="w-4 h-4 text-blue-600" /> Santri</h2>
            {selectedSantri ? (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="font-bold text-blue-900">{selectedSantri.nama_lengkap}</p>
                <p className="text-xs text-blue-700">{selectedSantri.nis} - {selectedSantri.nama_kelas || '-'} - {selectedSantri.marhalah_nama || '-'}</p>
                <button onClick={resetCatat} className="mt-3 text-xs font-bold text-blue-700">Ganti santri</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={searchSantri} onChange={e => setSearchSantri(e.target.value)} onKeyDown={e => e.key === 'Enter' && cariSantri()} className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm" placeholder="Nama / NIS" />
                </div>
                <button onClick={cariSantri} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm">Cari Santri</button>
                <div className="divide-y border rounded-lg overflow-hidden max-h-[360px] overflow-y-auto">
                  {hasilSantri.map(s => (
                    <button key={s.id} onClick={() => pilihSantri(s)} className="w-full text-left p-3 hover:bg-slate-50">
                      <p className="font-bold text-slate-800 text-sm">{s.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{s.nis} - {s.nama_kelas || '-'} - {s.marhalah_nama || '-'}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="bg-white border rounded-xl overflow-hidden">
            <div className="p-4 border-b flex flex-col md:flex-row gap-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2 flex-shrink-0"><Package className="w-4 h-4 text-amber-600" /> Kitab</h2>
              <input value={katalogSearch} onChange={e => setKatalogSearch(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Cari kitab tambahan..." />
            </div>
            <div className="divide-y max-h-[62vh] overflow-y-auto">
              {!selectedSantri && <div className="p-10 text-center text-slate-400">Pilih santri dulu.</div>}
              {selectedSantri && filteredKatalog.map(item => (
                <div key={item.id} className={`p-3 flex items-center gap-3 ${item.selected ? 'bg-blue-50/40' : 'bg-white'}`}>
                  <button onClick={() => toggleItem(item.id)} className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${item.selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>
                    {item.selected && <Check className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800 truncate">{item.nama_kitab}</p>
                    <p className="text-xs text-slate-500">{item.marhalah_nama || '-'} - stok {item.jumlah_stok}</p>
                  </div>
                  <p className="font-mono font-bold text-sm text-emerald-700">{rupiah(item.harga_jual)}</p>
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <button onClick={() => ubahQty(item.id, -1)} className="p-2 hover:bg-slate-50"><Minus className="w-3 h-3" /></button>
                    <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                    <button onClick={() => ubahQty(item.id, 1)} className="p-2 hover:bg-slate-50"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="bg-white border rounded-xl p-4 space-y-3 h-fit xl:sticky xl:top-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><Ticket className="w-4 h-4 text-amber-600" /> Ringkasan</h2>
            <div className="flex justify-between text-sm"><span>Item</span><b>{selectedItems.length}</b></div>
            <div className="flex justify-between text-sm"><span>Total</span><b>{rupiah(totalCatat)}</b></div>
            <textarea value={catatan} onChange={e => setCatatan(e.target.value)} className="w-full p-3 border rounded-lg text-sm min-h-20" placeholder="Catatan opsional" />
            <button onClick={simpanAntrian} disabled={loading || !selectedItems.length} className="w-full bg-amber-600 text-white py-3 rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
              Buat Antrian
            </button>
          </aside>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr_320px] gap-4">
          <section className="bg-white border rounded-xl p-4 space-y-3">
            <h2 className="font-bold text-slate-800">Antrian Hari Ini</h2>
            <div className="flex gap-2">
              <input value={searchAntrian} onChange={e => setSearchAntrian(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadAntrian()} className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Nomor / nama / NIS" />
              <button onClick={loadAntrian} className="px-3 bg-slate-100 rounded-lg"><Search className="w-4 h-4" /></button>
            </div>
            <div className="divide-y border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
              {antrianList.map(a => (
                <button key={a.id} onClick={() => pilihAntrian(a.id)} className={`w-full text-left p-3 hover:bg-slate-50 ${selectedAntrian?.id === a.id ? 'bg-emerald-50' : ''}`}>
                  <div className="flex justify-between gap-3">
                    <p className="text-2xl font-extrabold text-slate-800">{nomor(a.nomor)}</p>
                    <p className="font-bold text-emerald-700 text-sm">{rupiah(a.total_tagihan)}</p>
                  </div>
                  <p className="font-bold text-sm text-slate-800">{a.nama_santri}</p>
                  <p className="text-xs text-slate-500">{a.nis || '-'} - {a.marhalah_nama || '-'}</p>
                </button>
              ))}
              {!antrianList.length && <div className="p-8 text-center text-slate-400 text-sm">Belum ada antrian.</div>}
            </div>
          </section>

          <section className="bg-white border rounded-xl overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-bold text-slate-800">Serah Barang</h2>
              {selectedAntrian && <p className="text-sm text-slate-500">{nomor(selectedAntrian.nomor)} - {selectedAntrian.nama_santri}</p>}
            </div>
            <div className="divide-y max-h-[65vh] overflow-y-auto">
              {!selectedAntrian && <div className="p-10 text-center text-slate-400">Pilih antrian dulu.</div>}
              {selectedAntrian?.items.map(row => {
                const final = finalItems.find(item => item.itemId === row.id)
                return (
                  <div key={row.id} className="p-3 flex items-center gap-3">
                    <button onClick={() => updateFinalItem(row.id, { diserahkan: !final?.diserahkan })} className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${final?.diserahkan ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-red-50 text-red-600 border-red-200'}`}>
                      {final?.diserahkan ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-800 truncate">{row.nama_kitab}</p>
                      <p className="text-xs text-slate-500">stok {row.jumlah_stok} - {final?.diserahkan ? 'diserahkan' : 'masuk pesanan'}</p>
                    </div>
                    <p className="font-mono font-bold text-sm">{rupiah(row.harga_jual)}</p>
                    <div className="flex items-center border rounded-lg overflow-hidden">
                      <button onClick={() => updateFinalItem(row.id, { qty: (final?.qty || row.qty) - 1 })} className="p-2 hover:bg-slate-50"><Minus className="w-3 h-3" /></button>
                      <span className="w-8 text-center text-sm font-bold">{final?.qty || row.qty}</span>
                      <button onClick={() => updateFinalItem(row.id, { qty: (final?.qty || row.qty) + 1 })} className="p-2 hover:bg-slate-50"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <aside className="bg-white border rounded-xl p-4 space-y-3 h-fit xl:sticky xl:top-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" /> Pembayaran</h2>
            <div className="flex justify-between text-sm"><span>Total</span><b>{rupiah(totalKasir)}</b></div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Uang diterima</label>
              <input value={uangBayar} onChange={e => setUangBayar(e.target.value)} type="number" className="w-full mt-1 px-3 py-3 border rounded-lg text-lg font-bold font-mono" />
            </div>
            {diff > 0 && <div className="text-sm font-bold text-green-700 bg-green-50 p-2 rounded-lg">Kembalian: {rupiah(diff)}</div>}
            {diff < 0 && <div className="text-sm font-bold text-red-700 bg-red-50 p-2 rounded-lg">Tunggakan: {rupiah(Math.abs(diff))}</div>}
            {diff > 0 && (
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={kembalianDitahan} onChange={e => setKembalianDitahan(e.target.checked)} />
                Kembalian belum diserahkan
              </label>
            )}
            <button onClick={prosesBayar} disabled={loading || !selectedAntrian} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Selesaikan
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}
