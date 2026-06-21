'use client'

import { useMemo, useState } from 'react'
import {
  buatAntrianUPK,
  cariSantriUPK,
  getAntrianAktif,
  getAntrianDetail,
  getKatalogKasir,
  selesaikanAntrianUPK,
} from './actions'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  type Antrian,
  type AntrianDetail,
  type CartItem,
  type FinalItem,
  type KatalogItem,
  type SantriOption,
  type UnitUPK,
} from './_components/types'
import { ModeTabs } from './_components/mode-tabs'
import { UnitPicker } from './_components/unit-picker'
import { SantriStep } from './_components/santri-step'
import { KitabStep } from './_components/kitab-step'
import { ReviewStep } from './_components/review-step'
import { AntrianList } from './_components/antrian-list'
import { SerahStep } from './_components/serah-step'
import { BayarPanel, BayarSheet } from './_components/bayar-sheet'

type CatatStep = 'santri' | 'kitab' | 'review'
type KasirStep = 'list' | 'serah'

export default function KasirUPKPage() {
  const [unit, setUnit] = useState<UnitUPK | null>(null)
  const [mode, setMode] = useState<'CATAT' | 'KASIR'>('CATAT')
  const [loading, setLoading] = useState(false)

  // Pencatat
  const [searchSantri, setSearchSantri] = useState('')
  const [hasilSantri, setHasilSantri] = useState<SantriOption[]>([])
  const [selectedSantri, setSelectedSantri] = useState<SantriOption | null>(null)
  const [katalog, setKatalog] = useState<CartItem[]>([])
  const [katalogSearch, setKatalogSearch] = useState('')
  const [catatan, setCatatan] = useState('')
  const [lastNomor, setLastNomor] = useState<number | null>(null)
  const [catatStep, setCatatStep] = useState<CatatStep>('santri')

  // Kasir
  const [searchAntrian, setSearchAntrian] = useState('')
  const [antrianList, setAntrianList] = useState<Antrian[]>([])
  const [selectedAntrian, setSelectedAntrian] = useState<AntrianDetail | null>(null)
  const [finalItems, setFinalItems] = useState<FinalItem[]>([])
  const [uangBayar, setUangBayar] = useState('')
  const [kembalianDitahan, setKembalianDitahan] = useState(false)
  const [kasirStep, setKasirStep] = useState<KasirStep>('list')
  const [bayarOpen, setBayarOpen] = useState(false)

  const selectedItems = katalog.filter((item) => item.selected)
  const totalCatat = selectedItems.reduce((sum, item) => sum + item.qty * item.harga_jual, 0)
  const totalKasir = finalItems.reduce((sum, item) => {
    const row = selectedAntrian?.items.find((i) => i.id === item.itemId)
    return sum + (row ? item.qty * row.harga_jual : 0)
  }, 0)
  const bayar = parseInt(uangBayar || '0', 10) || 0

  const filteredKatalog = useMemo(() => {
    const keyword = katalogSearch.toLowerCase().trim()
    if (!keyword) return katalog
    return katalog.filter(
      (item) =>
        item.nama_kitab.toLowerCase().includes(keyword) || (item.marhalah_nama || '').toLowerCase().includes(keyword)
    )
  }, [katalog, katalogSearch])

  const pilihUnit = (nextUnit: UnitUPK) => {
    setUnit(nextUnit)
    setMode('CATAT')
    setCatatStep('santri')
    setKasirStep('list')
  }

  const resetCatat = () => {
    setSearchSantri('')
    setHasilSantri([])
    setSelectedSantri(null)
    setKatalog([])
    setKatalogSearch('')
    setCatatan('')
    setCatatStep('santri')
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
    setCatatStep('kitab')
    if (!santri.marhalah_id) toast.warning('Santri ini belum punya marhalah aktif.')
  }

  const toggleItem = (id: number) => {
    setKatalog((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)))
  }

  const ubahQty = (id: number, delta: number) => {
    setKatalog((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, item.qty + delta), selected: true } : item))
    )
  }

  const simpanAntrian = async () => {
    if (!unit || !selectedSantri) return toast.warning('Pilih santri dulu.')
    if (!selectedItems.length) return toast.warning('Pilih minimal satu kitab.')
    setLoading(true)
    const result = await buatAntrianUPK({
      unit,
      santri: selectedSantri,
      catatan,
      items: selectedItems.map((item) => ({
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
    setCatatStep('review')
    toast.success(`Antrian ${String(result.nomor).padStart(3, '0')} dibuat`)
  }

  const mulaiCatatBaru = () => {
    resetCatat()
    setLastNomor(null)
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
    setFinalItems(detail.items.map((item) => ({ itemId: item.id, qty: item.qty, diserahkan: true })))
    setUangBayar(String(detail.total_tagihan || detail.items.reduce((sum, item) => sum + item.subtotal, 0)))
    setKembalianDitahan(false)
    setKasirStep('serah')
  }

  const updateFinalItem = (itemId: string, patch: Partial<FinalItem>) => {
    setFinalItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, ...patch, qty: Math.max(1, patch.qty ?? item.qty) } : item
      )
    )
  }

  const toggleSerah = (itemId: string) => {
    const cur = finalItems.find((f) => f.itemId === itemId)
    updateFinalItem(itemId, { diserahkan: !(cur?.diserahkan ?? true) })
  }

  const qtySerah = (itemId: string, delta: number) => {
    const cur = finalItems.find((f) => f.itemId === itemId)
    updateFinalItem(itemId, { qty: (cur?.qty ?? 1) + delta })
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
    setBayarOpen(false)
    setKasirStep('list')
    loadAntrian()
  }

  const switchMode = (next: 'CATAT' | 'KASIR') => {
    setMode(next)
    if (next === 'KASIR') loadAntrian()
  }

  if (!unit) {
    return (
      <div className="pb-6">
        <UnitPicker onPick={pilihUnit} />
      </div>
    )
  }

  // tombol back per langkah (mobile)
  const mobileBack = () => {
    if (mode === 'CATAT') {
      if (catatStep === 'kitab') setCatatStep('santri')
      else if (catatStep === 'review') setCatatStep('kitab')
    } else {
      if (kasirStep === 'serah') {
        setKasirStep('list')
        setSelectedAntrian(null)
      }
    }
  }
  const showMobileBack =
    (mode === 'CATAT' && catatStep !== 'santri' && lastNomor === null) ||
    (mode === 'KASIR' && kasirStep !== 'list')

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setUnit(null)
            resetCatat()
            setLastNomor(null)
          }}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition active:scale-90 hover:bg-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-wide text-slate-400">
            Kasir UPK {unit === 'PUTRA' ? 'Putra' : 'Putri'}
          </p>
        </div>
        <div className="w-full max-w-[240px]">
          <ModeTabs mode={mode} onChange={switchMode} />
        </div>
      </div>

      {/* langkah-back mobile */}
      {showMobileBack && (
        <button
          onClick={mobileBack}
          className="flex items-center gap-1 text-sm font-bold text-slate-500 xl:hidden"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>
      )}

      {mode === 'CATAT' ? (
        <>
          {/* MOBILE wizard */}
          <div className="xl:hidden">
            <div key={catatStep} className="animate-in fade-in slide-in-from-right-4 duration-300">
              {catatStep === 'santri' && (
                <CatatPaneSantri
                  {...{ searchSantri, setSearchSantri, cariSantri, loading, hasilSantri, selectedSantri, pilihSantri, resetCatat }}
                  showNext
                  onNext={() => setCatatStep('kitab')}
                />
              )}
              {catatStep === 'kitab' && (
                <KitabStep
                  items={filteredKatalog}
                  search={katalogSearch}
                  onSearchChange={setKatalogSearch}
                  loading={loading}
                  hasSantri={!!selectedSantri}
                  onToggle={toggleItem}
                  onQty={ubahQty}
                  selectedCount={selectedItems.length}
                  total={totalCatat}
                  onNext={() => setCatatStep('review')}
                  showFooter
                />
              )}
              {catatStep === 'review' && (
                <ReviewStep
                  items={selectedItems}
                  total={totalCatat}
                  catatan={catatan}
                  onCatatanChange={setCatatan}
                  onSubmit={simpanAntrian}
                  loading={loading}
                  lastNomor={lastNomor}
                  onNewCatat={mulaiCatatBaru}
                />
              )}
            </div>
          </div>

          {/* DESKTOP panes */}
          <div className="hidden grid-cols-[360px_1fr_380px] gap-4 xl:grid">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <CatatPaneSantri
                {...{ searchSantri, setSearchSantri, cariSantri, loading, hasilSantri, selectedSantri, pilihSantri, resetCatat }}
                showNext={false}
                onNext={() => {}}
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <KitabStep
                items={filteredKatalog}
                search={katalogSearch}
                onSearchChange={setKatalogSearch}
                loading={loading}
                hasSantri={!!selectedSantri}
                onToggle={toggleItem}
                onQty={ubahQty}
                selectedCount={selectedItems.length}
                total={totalCatat}
                onNext={() => {}}
                showFooter={false}
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <ReviewStep
                items={selectedItems}
                total={totalCatat}
                catatan={catatan}
                onCatatanChange={setCatatan}
                onSubmit={simpanAntrian}
                loading={loading}
                lastNomor={lastNomor}
                onNewCatat={mulaiCatatBaru}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* MOBILE wizard */}
          <div className="xl:hidden">
            <div key={kasirStep} className="animate-in fade-in slide-in-from-right-4 duration-300">
              {kasirStep === 'list' && (
                <AntrianList
                  search={searchAntrian}
                  onSearchChange={setSearchAntrian}
                  onSearch={loadAntrian}
                  list={antrianList}
                  selectedId={selectedAntrian?.id ?? null}
                  onPick={pilihAntrian}
                  loading={loading}
                />
              )}
              {kasirStep === 'serah' && (
                <SerahStep
                  detail={selectedAntrian}
                  finalItems={finalItems}
                  onToggle={toggleSerah}
                  onQty={qtySerah}
                  total={totalKasir}
                  onPay={() => setBayarOpen(true)}
                  showPayButton
                />
              )}
            </div>
          </div>

          {/* DESKTOP panes */}
          <div className="hidden grid-cols-[380px_1fr_360px] gap-4 xl:grid">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <AntrianList
                search={searchAntrian}
                onSearchChange={setSearchAntrian}
                onSearch={loadAntrian}
                list={antrianList}
                selectedId={selectedAntrian?.id ?? null}
                onPick={pilihAntrian}
                loading={loading}
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SerahStep
                detail={selectedAntrian}
                finalItems={finalItems}
                onToggle={toggleSerah}
                onQty={qtySerah}
                total={totalKasir}
                onPay={() => {}}
                showPayButton={false}
              />
            </div>
            <BayarPanel
              hasAntrian={!!selectedAntrian}
              total={totalKasir}
              uangBayar={uangBayar}
              onUangChange={setUangBayar}
              kembalianDitahan={kembalianDitahan}
              onKembalianToggle={() => setKembalianDitahan((v) => !v)}
              onSubmit={prosesBayar}
              loading={loading}
            />
          </div>

          {/* Bottom sheet bayar (mobile) */}
          <BayarSheet
            open={bayarOpen}
            onClose={() => setBayarOpen(false)}
            total={totalKasir}
            uangBayar={uangBayar}
            onUangChange={setUangBayar}
            kembalianDitahan={kembalianDitahan}
            onKembalianToggle={() => setKembalianDitahan((v) => !v)}
            onSubmit={prosesBayar}
            loading={loading}
          />
        </>
      )}
    </div>
  )
}

/** Wrapper santri agar tidak duplikasi props panjang antara mobile & desktop. */
function CatatPaneSantri(props: {
  searchSantri: string
  setSearchSantri: (v: string) => void
  cariSantri: () => void
  loading: boolean
  hasilSantri: SantriOption[]
  selectedSantri: SantriOption | null
  pilihSantri: (s: SantriOption) => void
  resetCatat: () => void
  showNext: boolean
  onNext: () => void
}) {
  return (
    <SantriStep
      search={props.searchSantri}
      onSearchChange={props.setSearchSantri}
      onSearch={props.cariSantri}
      loading={props.loading}
      results={props.hasilSantri}
      selected={props.selectedSantri}
      onPick={props.pilihSantri}
      onReset={props.resetCatat}
      onNext={props.onNext}
      showNext={props.showNext}
    />
  )
}
