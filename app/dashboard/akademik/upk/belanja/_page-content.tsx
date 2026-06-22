'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from '@/lib/pdf/client'
import {
  bayarHutangBelanja,
  getBelanjaList,
  getHutangBelanja,
  getKatalogBelanja,
  getRencanaList,
  getTokoBelanja,
  hitungRencanaBelanja,
  simpanBelanja,
  simpanRencanaBelanja,
  hapusBelanja,
  getMarhalahBelanja,
  getBelanjaItems,
  returBelanjaItem,
} from './actions'
import { CheckCircle, ChevronRight, ClipboardList, Loader2, Plus, Printer, RefreshCw, Save, ShoppingBag, Store, Trash, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useConfirm } from '@/components/ui/confirm-dialog'

type KatalogItem = {
  id: number
  nama_kitab: string
  marhalah_id: number | null
  marhalah_nama: string | null
  harga_beli: number
  stok_lama: number
  stok_baru: number
  jumlah_stok: number
  marhalah_ids: string
}

type RencanaItem = {
  katalog_id: number
  nama_kitab: string
  marhalah_id: number | null
  marhalah_nama: string | null
  toko_nama: string | null
  jumlah_santri: number
  stok_lama: number
  stok_baru: number
  persen_target: number
  saran_qty: number
  qty_rencana: number
  harga_beli: number
  subtotal: number
}

type BelanjaCartItem = KatalogItem & {
  qty: number
  harga_beli_input: number
}

type Toko = { id: number; nama: string }

type RencanaListItem = {
  id: string
  tanggal: string
  nama: string
  persen_target: number
  total_item: number
  total_estimasi: number
}

type BelanjaListItem = {
  id: string
  tanggal: string
  jenis: string
  toko_nama: string | null
  total: number
  dibayar: number
  sisa_hutang: number
  total_item: number
}

type HutangListItem = {
  id: string
  tanggal: string
  jenis: string
  toko_nama: string | null
  sisa_hutang: number
}

function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

export default function BelanjaUPKPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<'RENCANA' | 'BELANJA' | 'HUTANG'>('RENCANA')
  const [katalog, setKatalog] = useState<KatalogItem[]>([])
  const [tokoList, setTokoList] = useState<Toko[]>([])
  const [rencanaHitung, setRencanaHitung] = useState<RencanaItem[]>([])
  const [rencanaList, setRencanaList] = useState<RencanaListItem[]>([])
  const [belanjaList, setBelanjaList] = useState<BelanjaListItem[]>([])
  const [hutangList, setHutangList] = useState<HutangListItem[]>([])
  const [marhalahList, setMarhalahList] = useState<{ id: number; nama: string }[]>([])
  const [selectedMarhalahId, setSelectedMarhalahId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [persenTarget, setPersenTarget] = useState(75)
  const [groupRencanaByToko, setGroupRencanaByToko] = useState(true)
  const [namaRencana, setNamaRencana] = useState(`Rencana Belanja ${todayInput()}`)
  const [isBelanjaModalOpen, setIsBelanjaModalOpen] = useState(false)
  const [belanjaCart, setBelanjaCart] = useState<BelanjaCartItem[]>([])
  const [belanjaSearch, setBelanjaSearch] = useState('')
  const [jenisBelanja, setJenisBelanja] = useState<'AWAL' | 'TAMBAHAN'>('AWAL')
  const [tanggalBelanja, setTanggalBelanja] = useState(todayInput())
  const [tokoId, setTokoId] = useState('')
  const [dibayar, setDibayar] = useState('')
  const [catatanBelanja, setCatatanBelanja] = useState('')
  const [bayarHutangId, setBayarHutangId] = useState('')
  const [nominalHutang, setNominalHutang] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [belanjaItems, setBelanjaItems] = useState<Record<string, any[]>>({})
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({})
  const rencanaPrintRef = useRef<HTMLDivElement>(null)
  const belanjaPrintRef = useRef<HTMLDivElement>(null)

  const totalRencana = rencanaHitung.reduce((sum, item) => sum + item.qty_rencana * item.harga_beli, 0)
  const totalBelanja = belanjaCart.reduce((sum, item) => sum + item.qty * item.harga_beli_input, 0)
  const totalHutang = hutangList.reduce((sum, item) => sum + (item.sisa_hutang || 0), 0)

  const openBelanjaModal = () => {
    setBelanjaSearch('')
    setSelectedMarhalahId('')
    setIsBelanjaModalOpen(true)
  }

  const closeBelanjaModal = () => {
    setIsBelanjaModalOpen(false)
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!belanjaItems[id]) {
      setLoadingItems(prev => ({ ...prev, [id]: true }))
      try {
        const items = await getBelanjaItems(id)
        setBelanjaItems(prev => ({ ...prev, [id]: items }))
      } catch (err: any) {
        toast.error(err.message || 'Gagal memuat detail belanja')
      } finally {
        setLoadingItems(prev => ({ ...prev, [id]: false }))
      }
    }
  }

  const filteredKatalog = useMemo(() => {
    let result = katalog
    if (selectedMarhalahId) {
      result = result.filter(item => {
        const ids = (item.marhalah_ids || '').split(',').map(s => s.trim()).filter(Boolean)
        return ids.includes(selectedMarhalahId)
      })
    }
    const keyword = belanjaSearch.toLowerCase().trim()
    if (keyword) {
      result = result.filter(item => item.nama_kitab.toLowerCase().includes(keyword) || (item.marhalah_nama || '').toLowerCase().includes(keyword))
    }
    return result
  }, [belanjaSearch, selectedMarhalahId, katalog])

  const groupedRencana = useMemo(() => {
    if (!groupRencanaByToko) return [{ toko: 'Semua Toko', items: rencanaHitung }]
    const grouped = new Map<string, RencanaItem[]>()
    rencanaHitung.forEach(item => {
      const key = item.toko_nama || 'Toko belum ditentukan'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(item)
    })
    return Array.from(grouped.entries()).map(([toko, items]) => ({ toko, items }))
  }, [groupRencanaByToko, rencanaHitung])

  const pageStyle = `
    @page { size: A4; margin: 12mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
    th { background: #f1f5f9; font-weight: 700; }
  `

  const printRencana = useReactToPrint({
    contentRef: rencanaPrintRef,
    documentTitle: namaRencana || 'Rencana Belanja',
    pageStyle,
  })

  const printBelanja = useReactToPrint({
    contentRef: belanjaPrintRef,
    documentTitle: 'Daftar Belanja Kitab',
    pageStyle,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [k, t, r, b, h, m] = await Promise.all([
      getKatalogBelanja(),
      getTokoBelanja(),
      getRencanaList(),
      getBelanjaList(),
      getHutangBelanja(),
      getMarhalahBelanja(),
    ])
    setKatalog(k)
    setTokoList(t)
    setRencanaList(r)
    setBelanjaList(b)
    setHutangList(h)
    setMarhalahList(m)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  const hitungRencana = async () => {
    setLoading(true)
    const data = await hitungRencanaBelanja(persenTarget)
    setRencanaHitung(data)
    setLoading(false)
  }

  const updateQtyRencana = (id: number, qty: number) => {
    setRencanaHitung(prev => prev.map(item => item.katalog_id === id ? { ...item, qty_rencana: Math.max(0, qty), subtotal: Math.max(0, qty) * item.harga_beli } : item))
  }

  const saveRencana = async () => {
    const result = await simpanRencanaBelanja({
      nama: namaRencana,
      persenTarget,
      items: rencanaHitung.map(item => ({
        katalogId: item.katalog_id,
        namaKitab: item.nama_kitab,
        marhalahId: item.marhalah_id,
        marhalahNama: item.marhalah_nama,
        jumlahSantri: item.jumlah_santri,
        stokLama: item.stok_lama,
        stokBaru: item.stok_baru,
        persenTarget,
        saranQty: item.saran_qty,
        qtyRencana: item.qty_rencana,
        hargaBeli: item.harga_beli,
      })),
    })
    if ('error' in result) return toast.error(result.error)
    toast.success('Rencana belanja disimpan')
    setRencanaHitung([])
    loadData()
  }

  const toggleBelanjaItem = (item: KatalogItem) => {
    setBelanjaCart(prev => {
      if (prev.some(row => row.id === item.id)) return prev.filter(row => row.id !== item.id)
      return [...prev, { ...item, qty: 1, harga_beli_input: item.harga_beli || 0 }]
    })
  }

  const updateCart = (id: number, patch: Partial<BelanjaCartItem>) => {
    setBelanjaCart(prev => prev.map(item => item.id === id ? { ...item, ...patch, qty: Math.max(0, patch.qty ?? item.qty), harga_beli_input: Math.max(0, patch.harga_beli_input ?? item.harga_beli_input) } : item))
  }

  const saveBelanja = async () => {
    const result = await simpanBelanja({
      tanggal: tanggalBelanja,
      jenis: jenisBelanja,
      tokoId: tokoId ? parseInt(tokoId, 10) : null,
      dibayar: parseInt(dibayar || '0', 10) || 0,
      catatan: catatanBelanja,
      items: belanjaCart.map(item => ({
        katalogId: item.id,
        namaKitab: item.nama_kitab,
        marhalahId: item.marhalah_id,
        marhalahNama: item.marhalah_nama,
        qty: item.qty,
        hargaBeli: item.harga_beli_input,
      })),
    })
    if ('error' in result) return toast.error(result.error)
    toast.success('Belanja disimpan dan stok baru bertambah')
    closeBelanjaModal()
    setBelanjaCart([])
    setDibayar('')
    setCatatanBelanja('')
    loadData()
  }

  const bayarHutang = async () => {
    const result = await bayarHutangBelanja(bayarHutangId, parseInt(nominalHutang || '0', 10) || 0)
    if ('error' in result) return toast.error(result.error)
    toast.success('Pembayaran hutang dicatat')
    setBayarHutangId('')
    setNominalHutang('')
    loadData()
  }

  const handleDeleteBelanja = async (id: string) => {
    if (!await confirm('Apakah Anda yakin ingin menghapus riwayat belanja ini? Stok baru dari kitab-kitab yang dibeli akan dikurangi.')) return
    try {
      const result = await hapusBelanja(id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Riwayat belanja berhasil dihapus')
        loadData()
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus riwayat belanja')
    }
  }

  const handleRetur = async (belanjaId: string, item: any) => {
    const maxQty = item.qty - (item.qty_retur || 0)
    if (maxQty <= 0) {
      toast.error('Semua item telah diretur.')
      return
    }

    const input = window.prompt(`Masukkan jumlah kitab "${item.nama_kitab}" yang ingin dikembalikan (maksimal ${maxQty}):`, String(maxQty))
    if (input === null) return

    const qtyToReturn = parseInt(input, 10)
    if (isNaN(qtyToReturn) || qtyToReturn <= 0) {
      toast.error('Jumlah retur tidak valid.')
      return
    }

    if (qtyToReturn > maxQty) {
      toast.error(`Jumlah retur melebihi batas maksimal (${maxQty}).`)
      return
    }

    if (!await confirm(`Apakah Anda yakin ingin mengembalikan sebanyak ${qtyToReturn} kitab "${item.nama_kitab}" ke toko? Stok kitab di katalog akan berkurang.`)) return

    try {
      const res = await returBelanjaItem(item.id, qtyToReturn)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success(`Berhasil meretur ${qtyToReturn} kitab "${item.nama_kitab}"`)
        const updatedItems = await getBelanjaItems(belanjaId)
        setBelanjaItems(prev => ({ ...prev, [belanjaId]: updatedItems }))
        loadData()
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal melakukan retur.')
    }
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      <DashboardPageHeader
        title="Belanja"
        description="Rencana belanja, pembelian kitab, penambahan stok, dan hutang toko."
        className="border-b pb-4"
        action={(
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border rounded-lg px-4 py-2">
              <p className="text-[11px] font-bold uppercase text-slate-400">Belanja</p>
              <p className="font-extrabold text-slate-800">{belanjaList.length}</p>
            </div>
            <div className="bg-white border rounded-lg px-4 py-2">
              <p className="text-[11px] font-bold uppercase text-slate-400">Hutang</p>
              <p className="font-extrabold text-red-700">{rupiah(totalHutang)}</p>
            </div>
            <button onClick={loadData} className="bg-slate-100 rounded-lg px-4 py-2 font-bold text-sm flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Muat</button>
          </div>
        )}
      />

      <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-fit">
        <button onClick={() => setTab('RENCANA')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold ${tab === 'RENCANA' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Rencana</button>
        <button onClick={() => setTab('BELANJA')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold ${tab === 'BELANJA' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Belanja</button>
        <button onClick={() => setTab('HUTANG')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold ${tab === 'HUTANG' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>Hutang</button>
      </div>

      {tab === 'RENCANA' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4 flex flex-col lg:flex-row gap-3">
            <input value={namaRencana} onChange={e => setNamaRencana(e.target.value)} className="lg:w-72 px-3 py-2.5 border rounded-lg text-sm" placeholder="Nama rencana" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Target</span>
              <input type="number" min="1" max="100" value={persenTarget} onChange={e => setPersenTarget(parseInt(e.target.value || '75', 10))} className="w-20 px-3 py-2.5 border rounded-lg font-bold text-sm" />
              <span className="text-sm font-bold text-slate-500">%</span>
            </div>
            <label className="flex items-center gap-2 px-3 py-2.5 border rounded-lg text-sm font-bold text-slate-600">
              <input type="checkbox" checked={groupRencanaByToko} onChange={e => setGroupRencanaByToko(e.target.checked)} />
              Kelompokkan toko
            </label>
            <button onClick={hitungRencana} className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />} Hitung Rencana
            </button>
            <button onClick={saveRencana} disabled={!rencanaHitung.length} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> Simpan Rencana
            </button>
            <button onClick={printRencana} disabled={!rencanaHitung.length} className="px-4 py-2.5 bg-slate-800 text-white rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Cetak
            </button>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Kitab</th>
                    <th className="px-4 py-3 text-center">Santri</th>
                    <th className="px-4 py-3 text-center">Stok Lama</th>
                    <th className="px-4 py-3 text-center">Stok Baru</th>
                    <th className="px-4 py-3 text-center">Saran</th>
                    <th className="px-4 py-3 text-center">Rencana</th>
                    <th className="px-4 py-3 text-right">Harga Beli</th>
                    <th className="px-4 py-3 text-right">Estimasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rencanaHitung.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-14 text-slate-400">Klik Hitung Rencana untuk membuat saran belanja.</td></tr>
                  ) : groupedRencana.flatMap(group => [
                    ...(groupRencanaByToko ? [(
                      <tr key={`group-${group.toko}`} className="bg-emerald-50 font-bold text-emerald-900">
                        <td colSpan={8} className="px-4 py-2">{group.toko}</td>
                      </tr>
                    )] : []),
                    ...group.items.map(item => (
                      <tr key={item.katalog_id}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{item.nama_kitab}</p>
                          <p className="text-xs text-slate-500">{item.marhalah_nama || '-'}{!groupRencanaByToko && item.toko_nama ? ` - ${item.toko_nama}` : ''}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-bold">{item.jumlah_santri}</td>
                        <td className="px-4 py-3 text-center">{item.stok_lama}</td>
                        <td className="px-4 py-3 text-center">{item.stok_baru}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-700">{item.saran_qty}</td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" min="0" value={item.qty_rencana} onChange={e => updateQtyRencana(item.katalog_id, parseInt(e.target.value || '0', 10))} className="w-20 px-2 py-1.5 border rounded-lg text-center font-bold" />
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{rupiah(item.harga_beli)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{rupiah(item.qty_rencana * item.harga_beli)}</td>
                      </tr>
                    )),
                  ])}
                </tbody>
                {rencanaHitung.length > 0 && <tfoot><tr className="bg-slate-50 font-bold"><td colSpan={7} className="px-4 py-3 text-right">Total Estimasi</td><td className="px-4 py-3 text-right">{rupiah(totalRencana)}</td></tr></tfoot>}
              </table>
            </div>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b font-bold">Riwayat Rencana</div>
            <div className="divide-y">
              {rencanaList.map(row => (
                <div key={row.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{row.nama}</p>
                    <p className="text-xs text-slate-500">{row.tanggal} - target {row.persen_target}% - {row.total_item} item</p>
                  </div>
                  <p className="font-bold text-emerald-700">{rupiah(row.total_estimasi)}</p>
                </div>
              ))}
              {!rencanaList.length && <div className="p-8 text-center text-slate-400">Belum ada rencana tersimpan.</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'BELANJA' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openBelanjaModal} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Tambah Belanja</button>
          </div>
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr><th className="w-8 px-4 py-3"></th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Toko</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3 text-center">Item</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Dibayar</th><th className="px-4 py-3 text-right">Hutang</th><th className="px-4 py-3 text-right">Aksi</th></tr>
                </thead>
                <tbody className="divide-y">
                  {belanjaList.flatMap(row => [
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpand(row.id)}
                          className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                          title="Detail Item"
                        >
                          <ChevronRight className={`w-4 h-4 transition-transform ${expandedId === row.id ? 'rotate-90' : ''}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">{row.tanggal}</td>
                      <td className="px-4 py-3 font-bold">{row.toko_nama || '-'}</td>
                      <td className="px-4 py-3">{row.jenis}</td>
                      <td className="px-4 py-3 text-center">{row.total_item}</td>
                      <td className="px-4 py-3 text-right font-mono">{rupiah(row.total)}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700">{rupiah(row.dibayar)}</td>
                      <td className="px-4 py-3 text-right font-mono text-red-700">{rupiah(row.sisa_hutang)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteBelanja(row.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Belanja"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>,
                    ...(expandedId === row.id ? [(
                      <tr key={`expand-${row.id}`} className="bg-slate-50/50">
                        <td colSpan={9} className="px-8 py-4">
                          {loadingItems[row.id] ? (
                            <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat detail...
                            </div>
                          ) : (
                            <div className="border rounded-lg bg-white overflow-hidden max-w-4xl shadow-sm">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 border-b text-slate-600 font-bold">
                                  <tr>
                                    <th className="px-4 py-2">Nama Kitab</th>
                                    <th className="px-4 py-2">Marhalah</th>
                                    <th className="px-4 py-2 text-center">Qty</th>
                                    <th className="px-4 py-2 text-right">Harga Satuan</th>
                                    <th className="px-4 py-2 text-right">Subtotal</th>
                                    <th className="px-4 py-2 text-center w-24">Aksi</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {belanjaItems[row.id]?.map(item => (
                                    <tr key={item.id}>
                                      <td className="px-4 py-2 font-bold text-slate-800">
                                        {item.nama_kitab}
                                        {item.is_consignment === 1 && (
                                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                            Konsinyasi
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-slate-500">{item.marhalah_nama || '-'}</td>
                                      <td className="px-4 py-2 text-center font-bold">
                                        {item.qty}
                                        {item.qty_retur > 0 && (
                                          <span className="text-red-500 font-normal text-[10px] block">
                                            (Retur: {item.qty_retur})
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-right font-mono">{rupiah(item.harga_beli)}</td>
                                      <td className="px-4 py-2 text-right font-mono font-bold text-slate-700">{rupiah(item.subtotal)}</td>
                                      <td className="px-4 py-2 text-center">
                                        {item.is_consignment === 1 && item.qty - (item.qty_retur || 0) > 0 ? (
                                          <button
                                            onClick={() => handleRetur(row.id, item)}
                                            className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10px] font-bold border border-red-200 transition-colors"
                                          >
                                            Retur
                                          </button>
                                        ) : (
                                          <span className="text-slate-400 text-[10px]">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  {(!belanjaItems[row.id] || belanjaItems[row.id].length === 0) && (
                                    <tr><td colSpan={6} className="text-center py-4 text-slate-400">Tidak ada item.</td></tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )] : [])
                  ])}
                  {!belanjaList.length && <tr><td colSpan={9} className="text-center py-14 text-slate-400">Belum ada data belanja.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'HUTANG' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b font-bold">Hutang Belanja</div>
            <div className="divide-y">
              {hutangList.map(row => (
                <button key={row.id} onClick={() => { setBayarHutangId(row.id); setNominalHutang(String(row.sisa_hutang)) }} className={`w-full text-left p-4 hover:bg-slate-50 ${bayarHutangId === row.id ? 'bg-red-50' : ''}`}>
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">{row.toko_nama || 'Tanpa toko'}</p>
                      <p className="text-xs text-slate-500">{row.tanggal} - {row.jenis}</p>
                    </div>
                    <p className="font-bold text-red-700">{rupiah(row.sisa_hutang)}</p>
                  </div>
                </button>
              ))}
              {!hutangList.length && <div className="p-10 text-center text-slate-400">Tidak ada hutang belanja.</div>}
            </div>
          </div>

          <aside className="bg-white border rounded-xl p-4 space-y-3 h-fit">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-4 h-4 text-red-600" /> Bayar Hutang</h2>
            <select value={bayarHutangId} onChange={e => setBayarHutangId(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm bg-white">
              <option value="">Pilih hutang</option>
              {hutangList.map(row => <option key={row.id} value={row.id}>{row.toko_nama || 'Tanpa toko'} - {rupiah(row.sisa_hutang)}</option>)}
            </select>
            <input type="number" value={nominalHutang} onChange={e => setNominalHutang(e.target.value)} className="w-full px-3 py-3 border rounded-lg font-bold font-mono" placeholder="Nominal bayar" />
            <button onClick={bayarHutang} disabled={!bayarHutangId} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold disabled:opacity-50">Catat Pembayaran</button>
          </aside>
        </div>
      )}

      {isBelanjaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Store className="w-4 h-4 text-blue-600" /> Tambah Belanja</h2>
              <button onClick={closeBelanjaModal} className="p-2 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={belanjaSearch}
                    onChange={e => setBelanjaSearch(e.target.value)}
                    className="flex-1 px-3 py-2.5 border rounded-lg text-sm"
                    placeholder="Cari kitab..."
                  />
                  <select
                    value={selectedMarhalahId}
                    onChange={e => setSelectedMarhalahId(e.target.value)}
                    className="px-3 py-2.5 border rounded-lg text-sm bg-white sm:w-48"
                  >
                    <option value="">Semua Marhalah</option>
                    {marhalahList.map(m => (
                      <option key={m.id} value={m.id}>{m.nama}</option>
                    ))}
                  </select>
                </div>
                <div className="border rounded-lg overflow-hidden divide-y max-h-[58vh] overflow-y-auto">
                  {filteredKatalog.map(item => {
                    const inCart = belanjaCart.some(row => row.id === item.id)
                    return (
                      <button key={item.id} onClick={() => toggleBelanjaItem(item)} className={`w-full p-3 text-left flex justify-between gap-3 hover:bg-slate-50 ${inCart ? 'bg-blue-50' : ''}`}>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{item.nama_kitab}</p>
                          <p className="text-xs text-slate-500">{item.marhalah_nama || '-'} - stok {item.jumlah_stok}</p>
                        </div>
                        {inCart && <CheckCircle className="w-5 h-5 text-blue-600" />}
                      </button>
                    )
                  })}
                </div>
              </div>
              <aside className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={tanggalBelanja} onChange={e => setTanggalBelanja(e.target.value)} className="px-3 py-2.5 border rounded-lg text-sm" />
                  <select value={jenisBelanja} onChange={e => setJenisBelanja(e.target.value as 'AWAL' | 'TAMBAHAN')} className="px-3 py-2.5 border rounded-lg text-sm bg-white">
                    <option value="AWAL">Awal</option>
                    <option value="TAMBAHAN">Tambahan</option>
                  </select>
                </div>
                <select value={tokoId} onChange={e => setTokoId(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm bg-white">
                  <option value="">Pilih toko</option>
                  {tokoList.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
                </select>
                <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                  {belanjaCart.map(item => (
                    <div key={item.id} className="p-3 space-y-2">
                      <p className="font-bold text-sm text-slate-800">{item.nama_kitab}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" min="0" value={item.qty} onChange={e => updateCart(item.id, { qty: parseInt(e.target.value || '0', 10) })} className="px-2 py-2 border rounded-lg text-sm" placeholder="Qty" />
                        <input type="number" min="0" value={item.harga_beli_input} onChange={e => updateCart(item.id, { harga_beli_input: parseInt(e.target.value || '0', 10) })} className="px-2 py-2 border rounded-lg text-sm" placeholder="Harga beli" />
                      </div>
                    </div>
                  ))}
                  {!belanjaCart.length && <div className="p-6 text-center text-slate-400 text-sm">Pilih kitab di kiri.</div>}
                </div>
                <div className="flex justify-between font-bold"><span>Total</span><span>{rupiah(totalBelanja)}</span></div>
                <input type="number" value={dibayar} onChange={e => setDibayar(e.target.value)} className="w-full px-3 py-3 border rounded-lg font-bold font-mono" placeholder="Dibayar sekarang (0 jika hutang)" />
                <textarea value={catatanBelanja} onChange={e => setCatatanBelanja(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm min-h-20" placeholder="Catatan" />
                <button onClick={printBelanja} disabled={!belanjaCart.length} className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  <Printer className="w-4 h-4" /> Cetak Daftar
                </button>
                <button onClick={saveBelanja} disabled={!belanjaCart.length} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold disabled:opacity-50">Simpan Belanja</button>
              </aside>
            </div>
          </div>
        </div>
      )}

      <div className="fixed -left-[10000px] top-0 bg-white text-black">
        <div ref={rencanaPrintRef} className="w-[190mm] p-2 text-[11px]">
          <div className="mb-4 border-b border-slate-300 pb-3">
            <h2 className="text-xl font-bold text-slate-900">{namaRencana}</h2>
            <p className="text-sm text-slate-600">Target {persenTarget}% - Total estimasi {rupiah(totalRencana)}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Kitab</th>
                <th>Santri</th>
                <th>Stok Lama</th>
                <th>Stok Baru</th>
                <th>Saran</th>
                <th>Rencana</th>
                <th>Harga Beli</th>
                <th>Estimasi</th>
              </tr>
            </thead>
            <tbody>
              {groupedRencana.flatMap(group => [
                ...(groupRencanaByToko ? [(
                  <tr key={`print-group-${group.toko}`}>
                    <td colSpan={8} className="font-bold bg-emerald-50">{group.toko}</td>
                  </tr>
                )] : []),
                ...group.items.map(item => (
                  <tr key={`print-${item.katalog_id}`}>
                    <td>
                      <div className="font-bold">{item.nama_kitab}</div>
                      <div className="text-[10px] text-slate-500">{item.marhalah_nama || '-'}{!groupRencanaByToko && item.toko_nama ? ` - ${item.toko_nama}` : ''}</div>
                    </td>
                    <td className="text-center">{item.jumlah_santri}</td>
                    <td className="text-center">{item.stok_lama}</td>
                    <td className="text-center">{item.stok_baru}</td>
                    <td className="text-center font-bold">{item.saran_qty}</td>
                    <td className="text-center font-bold">{item.qty_rencana}</td>
                    <td className="text-right">{rupiah(item.harga_beli)}</td>
                    <td className="text-right font-bold">{rupiah(item.qty_rencana * item.harga_beli)}</td>
                  </tr>
                )),
              ])}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="text-right font-bold">Total Estimasi</td>
                <td className="text-right font-bold">{rupiah(totalRencana)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div ref={belanjaPrintRef} className="w-[190mm] p-2 text-[11px]">
          <div className="mb-4 border-b border-slate-300 pb-3">
            <h2 className="text-xl font-bold text-slate-900">Daftar Belanja Kitab</h2>
            <p className="text-sm text-slate-600">Tanggal {tanggalBelanja} - {jenisBelanja} - {tokoList.find(t => String(t.id) === tokoId)?.nama || 'Toko belum dipilih'}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Kitab</th>
                <th>Marhalah</th>
                <th>Qty</th>
                <th>Harga</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {belanjaCart.map(item => (
                <tr key={`belanja-print-${item.id}`}>
                  <td className="font-bold">{item.nama_kitab}</td>
                  <td>{item.marhalah_nama || '-'}</td>
                  <td className="text-center">{item.qty}</td>
                  <td className="text-right">{rupiah(item.harga_beli_input)}</td>
                  <td className="text-right font-bold">{rupiah(item.qty * item.harga_beli_input)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right font-bold">Total</td>
                <td className="text-right font-bold">{rupiah(totalBelanja)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
