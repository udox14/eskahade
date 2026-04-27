'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import * as XLSX from 'xlsx'
import {
  AlertTriangle, BookOpenCheck, Copy, Crown, Download, FileSpreadsheet, Loader2, Plus, Printer, Save, Trash2, Upload, UserCog, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  copyPanitiaFromEvent,
  getActiveEventForKepanitiaan,
  getEventOptionsForCopy,
  getGuruOptionsForKepanitiaan,
  getPanitiaList,
  getPembuatSoalList,
  importPanitiaBatch,
  replacePanitiaBatch,
  savePembuatSoalBatch,
  type ActiveEvent,
  type EventOption,
  type GuruOption,
  type PanitiaBatchItem,
  type PanitiaInput,
  type PanitiaRow,
  type PembuatSoalRow,
} from './actions'
import { FONT } from '../cetak/_shared'

const INTI = [
  { key: 'ketua', label: 'Ketua' },
  { key: 'wakil_ketua', label: 'Wakil Ketua' },
  { key: 'sekretaris', label: 'Sekretaris' },
  { key: 'wakil_sekretaris', label: 'Wakil Sekretaris' },
  { key: 'bendahara', label: 'Bendahara' },
  { key: 'wakil_bendahara', label: 'Wakil Bendahara' },
]

const SEKSI = [
  { key: 'tim_editor', label: 'Tim Editor', hasKetua: false },
  { key: 'kesekretariatan', label: 'Kesekretariatan', hasKetua: true },
  { key: 'penggandaan_pengepakan', label: 'Penggandaan & Pengepakan', hasKetua: true },
  { key: 'humas', label: 'Humas', hasKetua: true },
  { key: 'konsumsi_kebersihan', label: 'Konsumsi & Kebersihan', hasKetua: true },
  { key: 'keamanan_ketertiban', label: 'Keamanan & Ketertiban', hasKetua: true },
]

type ImportRow = PanitiaInput & {
  rowNumber: number
}

type DraftPanitia = {
  id: string
  tipe: 'inti' | 'seksi'
  jabatan_key?: string
  seksi_key?: string
  peran?: 'ketua' | 'anggota' | null
  source: 'guru' | 'manual'
  guru_id: number | ''
  nama: string
}

type DraftPembuatSoal = PembuatSoalRow & {
  draft_guru_id: number | ''
}

function PrintHeader({ event }: { event: ActiveEvent }) {
  const semesterLabel = event.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const tahunAjaran = event.tahun_ajaran_nama.replace('/', '-')

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4mm', height: '30mm', marginBottom: '2mm' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logohitam.png" alt="" style={{ width: '26mm', height: '26mm', objectFit: 'contain' }} />
      <div style={{ width: '135mm' }}>
        <div style={{ fontSize: '21pt', fontWeight: 700, lineHeight: 0.95 }}>EVALUASI HASIL BELAJAR</div>
        <div style={{ fontSize: '17pt', lineHeight: 1 }}>{semesterLabel} T.A. {tahunAjaran}</div>
        <div style={{ fontSize: '9.5pt', lineHeight: 1.15, marginTop: '1mm' }}>LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG</div>
        <div style={{ borderBottom: '1.2pt solid #000', marginTop: '1.5mm' }} />
      </div>
    </div>
  )
}

function PersonBox({ title, name, subtle = false }: { title: string; name?: string; subtle?: boolean }) {
  return (
    <div style={{
      border: '1pt solid #000',
      backgroundColor: subtle ? '#f3f4f6' : '#fff',
      minHeight: '15mm',
      padding: '2mm',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      textAlign: 'center',
      breakInside: 'avoid',
    }}>
      <div style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', marginBottom: '1mm' }}>{title}</div>
      <div style={{ fontSize: '8.4pt', lineHeight: 1.15 }}>{name || '-'}</div>
    </div>
  )
}

function KepanitiaanPrint({ event, rows }: { event: ActiveEvent; rows: PanitiaRow[] }) {
  const inti = new Map(rows.filter(r => r.tipe === 'inti').map(r => [r.jabatan_key, r]))
  const seksiRows = rows.filter(r => r.tipe === 'seksi')

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
    }}>
      <PrintHeader event={event} />
      <div style={{ textAlign: 'center', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '16pt', fontWeight: 700, marginBottom: '4mm' }}>
        SUSUNAN PANITIA
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', justifyItems: 'center', gap: '2mm', marginBottom: '4mm' }}>
        <div style={{ width: '72mm' }}>
          <PersonBox title="Ketua" name={inti.get('ketua')?.nama} />
        </div>
        <div style={{ width: '72mm' }}>
          <PersonBox title="Wakil Ketua" name={inti.get('wakil_ketua')?.nama} subtle />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2mm', marginBottom: '5mm' }}>
        <PersonBox title="Sekretaris" name={inti.get('sekretaris')?.nama} />
        <PersonBox title="Wakil Sekretaris" name={inti.get('wakil_sekretaris')?.nama} subtle />
        <PersonBox title="Bendahara" name={inti.get('bendahara')?.nama} />
        <PersonBox title="Wakil Bendahara" name={inti.get('wakil_bendahara')?.nama} subtle />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3mm' }}>
        {SEKSI.map(seksi => {
          const members = seksiRows.filter(row => row.seksi_key === seksi.key)
          const ketua = members.find(row => row.peran === 'ketua')
          const anggota = members.filter(row => row.peran !== 'ketua')
          return (
            <div key={seksi.key} style={{ border: '1pt solid #000', minHeight: '39mm', breakInside: 'avoid' }}>
              <div style={{
                backgroundColor: '#111827',
                color: '#fff',
                textAlign: 'center',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '8pt',
                fontWeight: 700,
                padding: '1.5mm',
              }}>
                {seksi.label.toUpperCase()}
              </div>
              <div style={{ padding: '2mm', fontSize: '7.6pt', lineHeight: 1.25 }}>
                {seksi.hasKetua && (
                  <div style={{ marginBottom: '1.5mm' }}>
                    <span style={{ fontWeight: 700 }}>Ketua: </span>{ketua?.nama || '-'}
                  </div>
                )}
                <div style={{ fontWeight: 700, marginBottom: '1mm' }}>{seksi.hasKetua ? 'Anggota:' : 'Tim:'}</div>
                <div style={{ display: 'grid', gap: '0.6mm' }}>
                  {anggota.length > 0 ? anggota.slice(0, 8).map((row, index) => (
                    <div key={row.id}>{index + 1}. {row.nama}</div>
                  )) : <div>-</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function normalizeImportRow(raw: Record<string, unknown>, rowNumber: number, guruList: GuruOption[]): ImportRow | null {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = raw[key]
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim()
    }
    return ''
  }

  const tipeRaw = get('tipe', 'Tipe').toLowerCase()
  const tipe = tipeRaw === 'seksi' ? 'seksi' : tipeRaw === 'inti' ? 'inti' : null
  if (!tipe) return null

  const nama = get('nama', 'Nama', 'nama_panitia', 'Nama Panitia')
  const guruIdRaw = get('guru_id', 'Guru ID', 'guruId')
  const guruId = guruIdRaw ? Number(guruIdRaw) : null
  const guruName = guruId ? guruList.find(guru => guru.id === guruId)?.nama : ''
  const finalNama = guruName || nama
  if (!finalNama) return null

  if (tipe === 'inti') {
    const jabatanKey = get('jabatan_key', 'Jabatan Key', 'jabatan').toLowerCase()
    if (!INTI.some(item => item.key === jabatanKey)) return null
    return {
      rowNumber,
      tipe,
      jabatan_key: jabatanKey,
      guru_id: guruId,
      nama: finalNama,
    }
  }

  const seksiKey = get('seksi_key', 'Seksi Key', 'seksi').toLowerCase()
  if (!SEKSI.some(item => item.key === seksiKey)) return null
  const seksi = SEKSI.find(item => item.key === seksiKey)
  const peranRaw = get('peran', 'Peran').toLowerCase()
  const peran = seksi?.hasKetua && peranRaw === 'ketua' ? 'ketua' : 'anggota'

  return {
    rowNumber,
    tipe,
    seksi_key: seksiKey,
    peran,
    guru_id: guruId,
    nama: finalNama,
  }
}

function rowToDraft(row: PanitiaRow): DraftPanitia {
  return {
    id: `row-${row.id}`,
    tipe: row.tipe,
    jabatan_key: row.jabatan_key ?? undefined,
    seksi_key: row.seksi_key ?? undefined,
    peran: row.peran,
    source: row.guru_id ? 'guru' : 'manual',
    guru_id: row.guru_id ?? '',
    nama: row.nama,
  }
}

function makeEmptyDraft(tipe: 'inti' | 'seksi', key: string, peran: 'ketua' | 'anggota' | null = null): DraftPanitia {
  return {
    id: `new-${crypto.randomUUID()}`,
    tipe,
    jabatan_key: tipe === 'inti' ? key : undefined,
    seksi_key: tipe === 'seksi' ? key : undefined,
    peran,
    source: 'guru',
    guru_id: '',
    nama: '',
  }
}

function DraftPersonInput({
  draft,
  guruList,
  onChange,
  onRemove,
  removable = true,
}: {
  draft: DraftPanitia
  guruList: GuruOption[]
  onChange: (patch: Partial<DraftPanitia>) => void
  onRemove?: () => void
  removable?: boolean
}) {
  return (
    <div className="rounded-lg border bg-white p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(['guru', 'manual'] as const).map(source => (
          <button
            key={source}
            onClick={() => onChange({ source })}
            className={`px-2 py-1.5 rounded-md border text-xs font-bold ${draft.source === source ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            {source === 'guru' ? 'Guru' : 'Manual'}
          </button>
        ))}
      </div>
      {draft.source === 'guru' ? (
        <select
          value={draft.guru_id}
          onChange={e => onChange({ guru_id: e.target.value ? Number(e.target.value) : '' })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">-- Pilih Guru --</option>
          {guruList.map(guru => <option key={guru.id} value={guru.id}>{guru.nama}</option>)}
        </select>
      ) : (
        <input
          value={draft.nama}
          onChange={e => onChange({ nama: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Nama panitia"
        />
      )}
      {removable && (
        <button onClick={onRemove} className="text-xs font-bold text-red-600 flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Hapus baris
        </button>
      )}
    </div>
  )
}

export default function KepanitiaanPageContent() {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [guruList, setGuruList] = useState<GuruOption[]>([])
  const [eventOptions, setEventOptions] = useState<EventOption[]>([])
  const [rows, setRows] = useState<PanitiaRow[]>([])
  const [drafts, setDrafts] = useState<DraftPanitia[]>([])
  const [activeTab, setActiveTab] = useState<'panitia' | 'pembuat_soal'>('panitia')
  const [soalDrafts, setSoalDrafts] = useState<DraftPembuatSoal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSoal, setSavingSoal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [copying, setCopying] = useState(false)
  const [selectedCopyEvent, setSelectedCopyEvent] = useState<number | ''>('')
  const [importRows, setImportRows] = useState<ImportRow[]>([])

  const printRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Susunan Panitia EHB',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `,
  })

  const loadData = async () => {
    setLoading(true)
    const evt = await getActiveEventForKepanitiaan()
    setEvent(evt)
    if (evt) {
      const [gurus, panitia, events, pembuatSoal] = await Promise.all([
        getGuruOptionsForKepanitiaan(),
        getPanitiaList(evt.id),
        getEventOptionsForCopy(evt.id),
        getPembuatSoalList(evt.id),
      ])
      setGuruList(gurus)
      setRows(panitia)
      setDrafts(panitia.map(rowToDraft))
      setEventOptions(events)
      setSoalDrafts(pembuatSoal.map(row => ({ ...row, draft_guru_id: row.guru_id ?? '' })))
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setLoading(true)
      const evt = await getActiveEventForKepanitiaan()
      if (cancelled) return
      setEvent(evt)
      if (evt) {
        const [gurus, panitia, events, pembuatSoal] = await Promise.all([
          getGuruOptionsForKepanitiaan(),
          getPanitiaList(evt.id),
          getEventOptionsForCopy(evt.id),
          getPembuatSoalList(evt.id),
        ])
        if (cancelled) return
        setGuruList(gurus)
        setRows(panitia)
        setDrafts(panitia.map(rowToDraft))
        setEventOptions(events)
        setSoalDrafts(pembuatSoal.map(row => ({ ...row, draft_guru_id: row.guru_id ?? '' })))
      }
      setLoading(false)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  const draftIntiMap = useMemo(() => new Map(drafts.filter(d => d.tipe === 'inti').map(d => [d.jabatan_key, d])), [drafts])

  const updateDraft = (draftId: string, patch: Partial<DraftPanitia>) => {
    setDrafts(prev => prev.map(draft => {
      if (draft.id !== draftId) return draft
      const next = { ...draft, ...patch }
      if (patch.guru_id !== undefined) {
        next.nama = guruList.find(guru => guru.id === patch.guru_id)?.nama ?? ''
      }
      if (patch.source) {
        next.guru_id = ''
        next.nama = ''
      }
      return next
    }))
  }

  const getOrCreateIntiDraft = (jabatanKey: string) => {
    const existing = draftIntiMap.get(jabatanKey)
    if (existing) return existing
    return makeEmptyDraft('inti', jabatanKey)
  }

  const addSeksiDraft = (seksiKey: string, peran: 'ketua' | 'anggota') => {
    setDrafts(prev => [...prev, makeEmptyDraft('seksi', seksiKey, peran)])
  }

  const removeDraft = (draftId: string) => {
    setDrafts(prev => prev.filter(draft => draft.id !== draftId))
  }

  const submitBatchDrafts = async () => {
    if (!event) return
    const payload: PanitiaBatchItem[] = drafts
      .map(draft => {
        const nama = draft.source === 'guru'
          ? guruList.find(guru => guru.id === draft.guru_id)?.nama ?? ''
          : draft.nama
        return {
          tipe: draft.tipe,
          jabatan_key: draft.tipe === 'inti' ? draft.jabatan_key : undefined,
          seksi_key: draft.tipe === 'seksi' ? draft.seksi_key : undefined,
          peran: draft.tipe === 'seksi' ? draft.peran ?? 'anggota' : null,
          guru_id: draft.source === 'guru' && draft.guru_id ? Number(draft.guru_id) : null,
          nama,
        }
      })
      .filter(item => item.nama.trim())

    setSaving(true)
    const res = await replacePanitiaBatch(event.id, payload)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${res.saved} data panitia disimpan`)
    loadData()
  }

  const updatePembuatSoal = (marhalahId: number, mapelId: number, guruId: number | '') => {
    setSoalDrafts(prev => prev.map(row => {
      if (row.marhalah_id !== marhalahId || row.mapel_id !== mapelId) return row
      const guru = guruId ? guruList.find(item => item.id === guruId) : null
      return {
        ...row,
        draft_guru_id: guruId,
        guru_id: guruId || null,
        nama_guru: guru?.nama || null,
      }
    }))
  }

  const submitPembuatSoal = async () => {
    if (!event) return
    setSavingSoal(true)
    const res = await savePembuatSoalBatch(event.id, soalDrafts.map(row => ({
      marhalah_id: row.marhalah_id,
      mapel_id: row.mapel_id,
      guru_id: row.draft_guru_id ? Number(row.draft_guru_id) : null,
      nama_guru: row.nama_guru,
    })))
    setSavingSoal(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${res.saved} pembuat soal disimpan`)
    loadData()
  }

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['tipe', 'jabatan_key', 'seksi_key', 'peran', 'nama', 'guru_id'],
      ['inti', 'ketua', '', '', 'Contoh Ketua Panitia', ''],
      ['inti', 'sekretaris', '', '', 'Contoh Sekretaris', ''],
      ['seksi', '', 'tim_editor', 'anggota', 'Contoh Editor 1', ''],
      ['seksi', '', 'kesekretariatan', 'ketua', 'Contoh Ketua Seksi', ''],
      ['seksi', '', 'kesekretariatan', 'anggota', 'Contoh Anggota Seksi', ''],
      [],
      ['KODE JABATAN INTI'],
      ...INTI.map(item => [item.key, item.label]),
      [],
      ['KODE SEKSI'],
      ...SEKSI.map(item => [item.key, item.label]),
      [],
      ['CATATAN'],
      ['tipe: inti/seksi. peran: ketua/anggota. guru_id opsional; jika kosong nama dipakai sebagai input manual.'],
    ])
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 34 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Template Panitia')
    XLSX.writeFile(wb, 'template_kepanitiaan_ehb.xlsx')
  }

  const parseImportFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const parsed = rawRows
          .map((raw, index) => normalizeImportRow(raw, index + 2, guruList))
          .filter((row): row is ImportRow => Boolean(row))

        setImportRows(parsed)
        if (parsed.length === 0) {
          toast.error('Tidak ada baris valid yang bisa diimpor')
        } else {
          toast.success(`${parsed.length} baris siap diimpor`)
        }
      } catch {
        toast.error('Gagal membaca file Excel')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  const submitImport = async () => {
    if (!event || importRows.length === 0) return
    setImporting(true)
    const res = await importPanitiaBatch(event.id, importRows)
    setImporting(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${res.imported} data panitia berhasil diimpor`)
    setImportRows([])
    loadData()
  }

  const submitCopy = async () => {
    if (!event || !selectedCopyEvent) return toast.error('Pilih event sumber terlebih dahulu')
    if (!confirm('Salin seluruh panitia dari event sumber? Data panitia event aktif akan diganti.')) return
    setCopying(true)
    const res = await copyPanitiaFromEvent(event.id, selectedCopyEvent as number)
    setCopying(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${res.copied} data panitia berhasil disalin`)
    setSelectedCopyEvent('')
    loadData()
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (!event) return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><UserCog className="w-7 h-7 text-indigo-600" /> Kepanitiaan EHB</h1>
      </div>
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      <div className="border-b pb-4 flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCog className="w-7 h-7 text-indigo-600" /> Kepanitiaan EHB
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola susunan panitia, seksi pelaksana, dan pembuat soal EHB.</p>
        </div>
        {activeTab === 'panitia' ? (
          <button onClick={() => handlePrint()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg">
            <Printer className="w-4 h-4" /> Cetak Organigram
          </button>
        ) : (
          <button onClick={submitPembuatSoal} disabled={savingSoal} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg">
            {savingSoal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Pembuat Soal
          </button>
        )}
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="bg-white border rounded-xl p-1 flex flex-wrap gap-1 w-fit">
        {[
          { key: 'panitia', label: 'Kepanitiaan', icon: UserCog },
          { key: 'pembuat_soal', label: 'Pembuat Soal', icon: BookOpenCheck },
        ].map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'pembuat_soal' ? (
        <div className="space-y-5">
          <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Penetapan Pembuat Soal</h3>
              <p className="text-sm text-slate-500">Mapel EHB dipecah per marhalah. Pilih pembuat soal untuk tiap marhalah-mapel, lalu simpan sekaligus.</p>
            </div>
            <button onClick={submitPembuatSoal} disabled={savingSoal} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
              {savingSoal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Semua
            </button>
          </div>

          <section className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50">
              <h2 className="font-bold text-slate-800">Daftar Mapel EHB per Marhalah</h2>
              <p className="text-sm text-slate-500">Data ini dipakai otomatis oleh Keuangan untuk menghitung honor pembuatan soal.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold w-14">No</th>
                    <th className="px-4 py-3 text-left font-bold min-w-[180px]">Marhalah</th>
                    <th className="px-4 py-3 text-left font-bold min-w-[240px]">Mapel EHB</th>
                    <th className="px-4 py-3 text-left font-bold min-w-[220px]">Kelas</th>
                    <th className="px-4 py-3 text-left font-bold min-w-[280px]">Pembuat Soal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {soalDrafts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-400">Belum ada mapel EHB pada jadwal aktif.</td>
                    </tr>
                  ) : soalDrafts.map((row, index) => (
                    <tr key={`${row.marhalah_id}-${row.mapel_id}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400 font-bold">{index + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{row.marhalah_nama}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{row.mapel_nama}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.kelas || '-'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={row.draft_guru_id}
                          onChange={e => updatePembuatSoal(row.marhalah_id, row.mapel_id, e.target.value ? Number(e.target.value) : '')}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                        >
                          <option value="">-- Belum ditentukan --</option>
                          {guruList.map(guru => <option key={guru.id} value={guru.id}>{guru.nama}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="bg-slate-50 border-b px-5 py-3 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-700 text-sm">Import Batch Excel</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={downloadTemplate} className="flex-1 border border-slate-200 hover:border-indigo-300 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Unduh Template
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Pilih File Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) parseImportFile(file)
                }}
              />
            </div>
            {importRows.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800">
                  {importRows.length} baris siap diimpor
                </div>
                <div className="max-h-40 overflow-y-auto divide-y">
                  {importRows.slice(0, 8).map(row => (
                    <div key={row.rowNumber} className="px-3 py-2 text-xs flex items-center gap-2">
                      <span className="font-bold text-slate-400 w-8">#{row.rowNumber}</span>
                      <span className="font-bold text-slate-700">{row.nama}</span>
                      <span className="ml-auto text-slate-400">{row.tipe === 'inti' ? row.jabatan_key : `${row.seksi_key} / ${row.peran}`}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-slate-50 flex gap-2">
                  <button onClick={submitImport} disabled={importing} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import
                  </button>
                  <button onClick={() => setImportRows([])} className="border px-4 py-2 rounded-lg text-sm font-bold text-slate-600">Batal</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="bg-slate-50 border-b px-5 py-3 flex items-center gap-2">
            <Copy className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-700 text-sm">Salin dari Semester Sebelumnya</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Event Sumber</label>
              <select value={selectedCopyEvent} onChange={e => setSelectedCopyEvent(e.target.value ? Number(e.target.value) : '')} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">-- Pilih Event --</option>
                {eventOptions.map(evt => (
                  <option key={evt.id} value={evt.id}>{evt.nama} · T.A. {evt.tahun_ajaran_nama}</option>
                ))}
              </select>
            </div>
            <button onClick={submitCopy} disabled={copying || !selectedCopyEvent} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2">
              {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} Salin Semua Panitia
            </button>
            <p className="text-xs text-slate-400 leading-relaxed">
              Proses ini mengganti seluruh data panitia pada event aktif dengan data dari event sumber.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-800">Editor Cepat Kepanitiaan</h3>
          <p className="text-sm text-slate-500">Isi langsung di kotak masing-masing bidang, lalu simpan semuanya sekaligus.</p>
        </div>
        <button onClick={submitBatchDrafts} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Simpan Semua Perubahan
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="bg-slate-50 border-b px-5 py-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-700 text-sm">Panitia Inti</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
              {INTI.map(item => {
                const draft = getOrCreateIntiDraft(item.key)
                return (
                  <div key={item.key} className="border rounded-lg p-4 bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">{item.label}</p>
                    {!drafts.some(d => d.id === draft.id) && (
                      <button onClick={() => setDrafts(prev => [...prev, draft])} className="mb-2 text-xs font-bold text-indigo-600">Aktifkan input</button>
                    )}
                    {drafts.some(d => d.id === draft.id) && (
                      <DraftPersonInput
                        draft={draft}
                        guruList={guruList}
                        removable={false}
                        onChange={patch => updateDraft(draft.id, patch)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SEKSI.map(seksi => {
              const members = drafts.filter(row => row.tipe === 'seksi' && row.seksi_key === seksi.key)
              const ketuaDraft = members.find(row => row.peran === 'ketua')
              const anggotaDrafts = members.filter(row => row.peran !== 'ketua')
              return (
                <div key={seksi.key} className="bg-white border rounded-xl overflow-hidden">
                  <div className="bg-slate-50 border-b px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-500" />
                      <h3 className="font-bold text-slate-700 text-sm">{seksi.label}</h3>
                    </div>
                    <button onClick={() => addSeksiDraft(seksi.key, 'anggota')} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Anggota
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    {seksi.hasKetua && (
                      <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-amber-700 uppercase">Ketua Seksi</p>
                          {!ketuaDraft && <button onClick={() => addSeksiDraft(seksi.key, 'ketua')} className="text-xs font-bold text-amber-700">Tambah Ketua</button>}
                        </div>
                        {ketuaDraft && (
                          <DraftPersonInput
                            draft={ketuaDraft}
                            guruList={guruList}
                            onChange={patch => updateDraft(ketuaDraft.id, patch)}
                            onRemove={() => removeDraft(ketuaDraft.id)}
                          />
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase">{seksi.hasKetua ? 'Anggota' : 'Tim'}</p>
                      {anggotaDrafts.length === 0 ? (
                        <div className="text-sm text-slate-400 border rounded-lg p-3">Belum ada anggota.</div>
                      ) : anggotaDrafts.map(draft => (
                        <DraftPersonInput
                          key={draft.id}
                          draft={draft}
                          guruList={guruList}
                          onChange={patch => updateDraft(draft.id, patch)}
                          onRemove={() => removeDraft(draft.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="hidden">
        <div ref={printRef}>
          <KepanitiaanPrint event={event} rows={rows} />
        </div>
      </div>
      </>
      )}
    </div>
  )
}
