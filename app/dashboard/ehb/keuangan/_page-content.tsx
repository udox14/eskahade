'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  AlertTriangle, Calculator, FileText, Loader2, Plus, Printer, ReceiptText, Save, Trash2, Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getActiveEventForKeuangan,
  getKetuaPelaksanaName,
  getRabAutoBasis,
  getRabItems,
  saveRabItems,
  type ActiveEvent,
  type RabAutoBasis,
  type RabItem,
  type RabItemInput,
  type RabKategori,
} from './actions'
import { FONT } from '../cetak/_shared'

type DraftRabItem = RabItemInput & {
  draft_id: string
}

const KATEGORI: { key: RabKategori; title: string; desc: string }[] = [
  {
    key: 'atk_administrasi',
    title: 'ATK dan Administrasi',
    desc: 'Kebutuhan kertas, alat tulis, penggandaan, dan administrasi EHB.',
  },
  {
    key: 'konsumsi',
    title: 'Konsumsi',
    desc: 'Konsumsi panitia, pengawas, guru, dan kebutuhan pendukung lain.',
  },
  {
    key: 'honorarium',
    title: 'Honorarium',
    desc: 'Insentif pembuatan soal, pemeriksaan, rapor, pengawasan, dan panitia.',
  },
]

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function parseMoney(value: string) {
  return Number(value.replace(/[^\d]/g, '')) || 0
}

function lineTotal(item: Pick<DraftRabItem, 'qty' | 'harga' | 'system_key'>) {
  if (item.system_key === 'honor_panitia') return Number(item.harga || 0)
  return Number(item.qty || 0) * Number(item.harga || 0)
}

function buildSystemDrafts(basis: RabAutoBasis): DraftRabItem[] {
  const drafts: DraftRabItem[] = [
    {
      draft_id: uid(),
      kategori: 'atk_administrasi',
      nama_barang: 'Kertas HVS',
      qty: basis.rekomendasiRim,
      harga: 0,
      keterangan: `Rekomendasi sistem: ${basis.totalHasilUjian.toLocaleString('id-ID')} lembar hasil ujian / 500 = ${basis.rekomendasiRim} rim`,
      is_system: 1,
      system_key: 'atk_hvs',
      urutan: 1,
    },
    {
      draft_id: uid(),
      kategori: 'atk_administrasi',
      nama_barang: 'Kertas Buram',
      qty: basis.rekomendasiRim,
      harga: 0,
      keterangan: `Rekomendasi sistem: ${basis.totalHasilUjian.toLocaleString('id-ID')} lembar hasil ujian / 500 = ${basis.rekomendasiRim} rim`,
      is_system: 1,
      system_key: 'atk_buram',
      urutan: 2,
    },
    {
      draft_id: uid(),
      kategori: 'honorarium',
      nama_barang: 'Insentif Pembuatan Soal',
      qty: basis.pembuatanSoal,
      harga: 0,
      keterangan: 'Qty sistem dihitung dari jumlah paket kelas-mapel pada jadwal EHB.',
      is_system: 1,
      system_key: 'honor_pembuatan_soal',
      urutan: 1,
    },
    ...basis.pemeriksaan.map((item, index) => ({
      draft_id: uid(),
      kategori: 'honorarium' as RabKategori,
      nama_barang: `Insentif Pemeriksaan Hasil EHB - ${item.marhalah_nama}`,
      qty: item.jumlah_hasil,
      harga: 0,
      keterangan: `${item.jumlah_santri.toLocaleString('id-ID')} santri x ${item.jumlah_mapel.toLocaleString('id-ID')} mapel`,
      is_system: 1,
      system_key: `honor_pemeriksaan_${item.marhalah_id ?? index}`,
      urutan: 10 + index,
    })),
    {
      draft_id: uid(),
      kategori: 'honorarium',
      nama_barang: 'Insentif Pengisian Rapor',
      qty: basis.raporSantri,
      harga: 0,
      keterangan: 'Jumlah santri selain Mutawassithah.',
      is_system: 1,
      system_key: 'honor_pengisian_rapor',
      urutan: 50,
    },
    {
      draft_id: uid(),
      kategori: 'honorarium',
      nama_barang: 'Insentif Pengawasan',
      qty: basis.totalSesiEhb,
      harga: 0,
      keterangan: `Total sesi aktif EHB. Pengawas terdaftar: ${basis.jumlahPengawas.toLocaleString('id-ID')} orang.`,
      is_system: 1,
      system_key: 'honor_pengawasan',
      urutan: 60,
    },
    {
      draft_id: uid(),
      kategori: 'honorarium',
      nama_barang: 'Insentif Panitia',
      qty: basis.jumlahPanitia,
      harga: 0,
      keterangan: `Jumlah panitia: ${basis.jumlahPanitia.toLocaleString('id-ID')} orang. Kolom harga diisi total insentif panitia.`,
      is_system: 1,
      system_key: 'honor_panitia',
      urutan: 70,
    },
  ]

  return drafts
}

function rowsToDrafts(rows: RabItem[]) {
  return rows.map(row => ({
    draft_id: String(row.id),
    kategori: row.kategori,
    nama_barang: row.nama_barang,
    qty: Number(row.qty || 0),
    harga: Number(row.harga || 0),
    keterangan: row.keterangan || '',
    is_system: row.is_system,
    system_key: row.system_key,
    urutan: row.urutan,
  }))
}

function PrintHeader({ event }: { event: ActiveEvent }) {
  const semesterLabel = event.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const tahunAjaran = event.tahun_ajaran_nama.replace('/', '-')

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4mm', height: '28mm', marginBottom: '2mm' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logohitam.png" alt="" style={{ width: '24mm', height: '24mm', objectFit: 'contain' }} />
      <div style={{ width: '132mm' }}>
        <div style={{ fontSize: '20pt', fontWeight: 700, lineHeight: 0.95 }}>EVALUASI HASIL BELAJAR</div>
        <div style={{ fontSize: '16pt', lineHeight: 1 }}>{semesterLabel} T.A. {tahunAjaran}</div>
        <div style={{ fontSize: '9pt', lineHeight: 1.15, marginTop: '1mm' }}>LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG</div>
        <div style={{ borderBottom: '1.1pt solid #000', marginTop: '1.5mm' }} />
      </div>
    </div>
  )
}

function RabPrint({
  event,
  items,
  ketuaPelaksana,
  wakilAkademik,
  wakilKeuangan,
}: {
  event: ActiveEvent
  items: DraftRabItem[]
  ketuaPelaksana: string
  wakilAkademik: string
  wakilKeuangan: string
}) {
  const categoryRows = KATEGORI.map(kategori => ({
    ...kategori,
    items: items.filter(item => item.kategori === kategori.key),
  }))
  const rowCount = items.length + KATEGORI.length
  const fontSize = rowCount > 32 ? '6.2pt' : rowCount > 24 ? '6.8pt' : '7.4pt'
  const lineHeight = rowCount > 32 ? 1.03 : 1.12
  const grandTotal = items.reduce((sum, item) => sum + lineTotal(item), 0)

  return (
    <div style={{
      width: '210mm',
      height: '330mm',
      padding: '8mm',
      boxSizing: 'border-box',
      fontFamily: FONT,
      backgroundColor: '#fff',
      color: '#000',
      overflow: 'hidden',
      breakAfter: 'page',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <PrintHeader event={event} />
      <div style={{
        textAlign: 'center',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '15pt',
        fontWeight: 700,
        lineHeight: 1,
        marginBottom: '3mm',
      }}>
        RENCANA ANGGARAN BELANJA
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: 'Arial, Helvetica, sans-serif', fontSize, lineHeight }}>
        <colgroup>
          <col style={{ width: '8mm' }} />
          <col style={{ width: '58mm' }} />
          <col style={{ width: '17mm' }} />
          <col style={{ width: '30mm' }} />
          <col style={{ width: '31mm' }} />
          <col style={{ width: '32mm' }} />
        </colgroup>
        <thead>
          <tr>
            {['NO', 'URAIAN', 'QTY', 'HARGA', 'JUMLAH', 'KETERANGAN'].map(label => (
              <th key={label} style={{ border: '0.8pt solid #000', padding: '1.3mm 1.2mm', textAlign: 'center', fontWeight: 700, backgroundColor: '#e5e7eb' }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categoryRows.map(category => {
            const subtotal = category.items.reduce((sum, item) => sum + lineTotal(item), 0)
            return (
              <Fragment key={category.key}>
                <tr>
                  <td colSpan={6} style={{ border: '0.8pt solid #000', padding: '1.2mm 1.4mm', fontWeight: 700, backgroundColor: '#f3f4f6' }}>
                    {category.title.toUpperCase()}
                  </td>
                </tr>
                {category.items.length === 0 ? (
                  <tr key={`${category.key}-empty`}>
                    <td style={printTdCenter}>-</td>
                    <td style={printTd}>-</td>
                    <td style={printTdCenter}>-</td>
                    <td style={printTdRight}>-</td>
                    <td style={printTdRight}>-</td>
                    <td style={printTd}>-</td>
                  </tr>
                ) : category.items.map((item, index) => (
                  <tr key={item.draft_id}>
                    <td style={printTdCenter}>{index + 1}</td>
                    <td style={printTd}>{item.nama_barang}</td>
                    <td style={printTdCenter}>{Number(item.qty || 0).toLocaleString('id-ID')}</td>
                    <td style={printTdRight}>{rupiah(Number(item.harga || 0))}</td>
                    <td style={printTdRight}>{rupiah(lineTotal(item))}</td>
                    <td style={printTd}>{item.keterangan || '-'}</td>
                  </tr>
                ))}
                <tr key={`${category.key}-subtotal`}>
                  <td colSpan={4} style={{ ...printTdRight, fontWeight: 700, backgroundColor: '#f8fafc' }}>Subtotal {category.title}</td>
                  <td style={{ ...printTdRight, fontWeight: 700, backgroundColor: '#f8fafc' }}>{rupiah(subtotal)}</td>
                  <td style={{ ...printTd, backgroundColor: '#f8fafc' }} />
                </tr>
              </Fragment>
            )
          })}
          <tr>
            <td colSpan={4} style={{ ...printTdRight, fontWeight: 700, fontSize: '8pt', backgroundColor: '#111827', color: '#fff' }}>TOTAL RAB</td>
            <td style={{ ...printTdRight, fontWeight: 700, fontSize: '8pt', backgroundColor: '#111827', color: '#fff' }}>{rupiah(grandTotal)}</td>
            <td style={{ ...printTd, backgroundColor: '#111827' }} />
          </tr>
        </tbody>
      </table>

      <div style={{
        marginTop: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '6mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '8.2pt',
        textAlign: 'center',
        paddingTop: '6mm',
      }}>
        <SignatureBox title="Ketua Pelaksana EHB" name={ketuaPelaksana} />
        <SignatureBox title="Menyetujui: Wakil Pimpinan Bid. Akademik" name={wakilAkademik} />
        <SignatureBox title="Wakil Pimpinan Bid. Administrasi dan Keuangan" name={wakilKeuangan} />
      </div>
    </div>
  )
}

const printTd: CSSProperties = {
  border: '0.8pt solid #000',
  padding: '1mm 1.2mm',
  verticalAlign: 'top',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const printTdCenter: CSSProperties = {
  ...printTd,
  textAlign: 'center',
}

const printTdRight: CSSProperties = {
  ...printTd,
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

function SignatureBox({ title, name }: { title: string; name: string }) {
  return (
    <div>
      <div style={{ fontWeight: 700, minHeight: '10mm' }}>{title}</div>
      <div style={{ height: '19mm' }} />
      <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{name || '................................'}</div>
    </div>
  )
}

export default function KeuanganEhbPageContent() {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [basis, setBasis] = useState<RabAutoBasis | null>(null)
  const [drafts, setDrafts] = useState<DraftRabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'rab' | 'transaksi' | 'honor_detail'>('rab')
  const [ketuaPelaksana, setKetuaPelaksana] = useState('')
  const [wakilAkademik, setWakilAkademik] = useState('')
  const [wakilKeuangan, setWakilKeuangan] = useState('')
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'RAB EHB',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const evt = await getActiveEventForKeuangan()
    setEvent(evt || null)
    if (evt) {
      const [savedRows, autoBasis, ketuaName] = await Promise.all([
        getRabItems(evt.id),
        getRabAutoBasis(evt.id),
        getKetuaPelaksanaName(evt.id),
      ])
      setBasis(autoBasis)
      setDrafts(savedRows.length > 0 ? rowsToDrafts(savedRows) : buildSystemDrafts(autoBasis))
      setKetuaPelaksana(ketuaName)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  const summary = useMemo(() => {
    const byCategory = new Map<RabKategori, number>()
    for (const item of drafts) {
      byCategory.set(item.kategori, (byCategory.get(item.kategori) || 0) + lineTotal(item))
    }
    const total = Array.from(byCategory.values()).reduce((sum, value) => sum + value, 0)
    return { byCategory, total }
  }, [drafts])

  const updateDraft = (draftId: string, patch: Partial<DraftRabItem>) => {
    setDrafts(prev => prev.map(item => item.draft_id === draftId ? { ...item, ...patch } : item))
  }

  const addItem = (kategori: RabKategori) => {
    const nextOrder = drafts.filter(item => item.kategori === kategori).length + 100
    setDrafts(prev => [
      ...prev,
      {
        draft_id: uid(),
        kategori,
        nama_barang: '',
        qty: 1,
        harga: 0,
        keterangan: '',
        is_system: 0,
        system_key: null,
        urutan: nextOrder,
      },
    ])
  }

  const deleteItem = (draftId: string) => {
    setDrafts(prev => prev.filter(item => item.draft_id !== draftId))
  }

  const resetRecommendation = () => {
    if (!basis) return
    setDrafts(buildSystemDrafts(basis))
    toast.success('RAB dikembalikan ke rekomendasi sistem')
  }

  const submit = async () => {
    if (!event) return
    const invalid = drafts.find(item => !item.nama_barang.trim())
    if (invalid) return toast.error('Nama barang/honor tidak boleh kosong')

    setSaving(true)
    const res = await saveRabItems(event.id, drafts)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${res.saved} item RAB disimpan`)
    loadData()
  }

  if (loading) {
    return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm font-medium">Belum ada event EHB yang aktif. Silakan aktifkan event dulu di menu Jadwal.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-3">
            <Wallet className="w-3.5 h-3.5" /> {event.nama}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Keuangan EHB</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola rencana anggaran, transaksi, dan honorarium EHB.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white border rounded-xl px-4 py-3">
            <p className="text-[11px] text-slate-500 font-bold uppercase">ATK</p>
            <p className="text-sm font-bold text-slate-800">{rupiah(summary.byCategory.get('atk_administrasi') || 0)}</p>
          </div>
          <div className="bg-white border rounded-xl px-4 py-3">
            <p className="text-[11px] text-slate-500 font-bold uppercase">Konsumsi</p>
            <p className="text-sm font-bold text-slate-800">{rupiah(summary.byCategory.get('konsumsi') || 0)}</p>
          </div>
          <div className="bg-white border rounded-xl px-4 py-3">
            <p className="text-[11px] text-slate-500 font-bold uppercase">Honor</p>
            <p className="text-sm font-bold text-slate-800">{rupiah(summary.byCategory.get('honorarium') || 0)}</p>
          </div>
          <div className="bg-slate-900 text-white rounded-xl px-4 py-3">
            <p className="text-[11px] text-white/50 font-bold uppercase">Total RAB</p>
            <p className="text-sm font-bold">{rupiah(summary.total)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-1 flex flex-wrap gap-1 w-fit">
        {[
          { key: 'rab', label: 'RAB', icon: FileText },
          { key: 'transaksi', label: 'Transaksi', icon: ReceiptText },
          { key: 'honor_detail', label: 'Rincian Honor', icon: Calculator },
        ].map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab !== 'rab' ? (
        <div className="bg-white border border-dashed rounded-2xl p-10 text-center">
          <p className="font-bold text-slate-700">Tab ini disiapkan untuk tahap berikutnya.</p>
          <p className="text-sm text-slate-500 mt-1">Sekarang kita fokus merapikan RAB dulu, bos.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
            <div>
              <p className="font-bold text-indigo-900">RAB disimpan batch</p>
              <p className="text-sm text-indigo-700">Ubah semua item dulu, lalu klik Simpan Semua Perubahan.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={resetRecommendation} className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Reset Rekomendasi
              </button>
              <button onClick={submit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Semua Perubahan
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-800">Cetak RAB</h2>
                <p className="text-sm text-slate-500">Format F4 Portrait, margin narrow, dengan kop dan tanda tangan.</p>
              </div>
              <button
                onClick={() => handlePrint()}
                disabled={drafts.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Printer className="w-4 h-4" /> Cetak RAB
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Ketua Pelaksana EHB</label>
                <input
                  value={ketuaPelaksana}
                  onChange={e => setKetuaPelaksana(e.target.value)}
                  placeholder="Nama ketua pelaksana"
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Wakil Pimpinan Bid. Akademik</label>
                <input
                  value={wakilAkademik}
                  onChange={e => setWakilAkademik(e.target.value)}
                  placeholder="Nama wakil pimpinan"
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Wakil Pimpinan Bid. Administrasi dan Keuangan</label>
                <input
                  value={wakilKeuangan}
                  onChange={e => setWakilKeuangan(e.target.value)}
                  placeholder="Nama wakil pimpinan"
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {KATEGORI.map(kategori => {
            const items = drafts.filter(item => item.kategori === kategori.key)
            const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0)
            return (
              <section key={kategori.key} className="bg-white border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-800">{kategori.title}</h2>
                    <p className="text-sm text-slate-500">{kategori.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Subtotal</p>
                      <p className="font-bold text-slate-800">{rupiah(subtotal)}</p>
                    </div>
                    <button onClick={() => addItem(kategori.key)} className="bg-white border hover:bg-slate-50 text-slate-700 font-bold px-3 py-2 rounded-xl text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Tambah
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold min-w-[230px]">Nama barang/honor</th>
                        <th className="px-4 py-3 text-left font-bold w-28">Qty</th>
                        <th className="px-4 py-3 text-left font-bold w-40">{kategori.key === 'honorarium' ? 'Nominal' : 'Harga'}</th>
                        <th className="px-4 py-3 text-left font-bold min-w-[260px]">Merek/keterangan</th>
                        <th className="px-4 py-3 text-right font-bold w-36">Total</th>
                        <th className="px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Belum ada item</td>
                        </tr>
                      ) : items.map(item => (
                        <tr key={item.draft_id} className={item.is_system ? 'bg-indigo-50/30' : 'bg-white'}>
                          <td className="px-4 py-3 align-top">
                            <input
                              value={item.nama_barang}
                              onChange={e => updateDraft(item.draft_id, { nama_barang: e.target.value })}
                              className="w-full border rounded-lg px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                            />
                            {item.is_system ? <p className="text-[11px] text-indigo-600 font-bold mt-1">Rekomendasi sistem, boleh diedit.</p> : null}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.qty}
                              onChange={e => updateDraft(item.draft_id, { qty: Number(e.target.value) })}
                              className="w-full border rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                            />
                            {item.system_key === 'honor_panitia' ? <p className="text-[11px] text-slate-400 mt-1">orang</p> : null}
                            {item.system_key === 'atk_hvs' || item.system_key === 'atk_buram' ? <p className="text-[11px] text-slate-400 mt-1">rim</p> : null}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              value={item.harga ? item.harga.toLocaleString('id-ID') : ''}
                              onChange={e => updateDraft(item.draft_id, { harga: parseMoney(e.target.value) })}
                              placeholder="0"
                              className="w-full border rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                            />
                            {item.system_key === 'honor_panitia' ? <p className="text-[11px] text-slate-400 mt-1">total panitia</p> : null}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              value={item.keterangan || ''}
                              onChange={e => updateDraft(item.draft_id, { keterangan: e.target.value })}
                              className="w-full border rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                            />
                          </td>
                          <td className="px-4 py-3 align-top text-right font-bold text-slate-800 whitespace-nowrap">
                            {rupiah(lineTotal(item))}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <button onClick={() => deleteItem(item.draft_id)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}

          <div className="hidden">
            <div ref={printRef}>
              <RabPrint
                event={event}
                items={drafts}
                ketuaPelaksana={ketuaPelaksana}
                wakilAkademik={wakilAkademik}
                wakilKeuangan={wakilKeuangan}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
