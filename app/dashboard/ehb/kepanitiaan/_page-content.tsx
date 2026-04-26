'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  AlertTriangle, Crown, Edit2, Loader2, Plus, Printer, Trash2, UserCog, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  deletePanitia,
  getActiveEventForKepanitiaan,
  getGuruOptionsForKepanitiaan,
  getPanitiaList,
  savePanitia,
  type ActiveEvent,
  type GuruOption,
  type PanitiaInput,
  type PanitiaRow,
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

type FormState = {
  id?: number
  tipe: 'inti' | 'seksi'
  jabatan_key: string
  seksi_key: string
  peran: 'ketua' | 'anggota'
  source: 'guru' | 'manual'
  guru_id: number | ''
  nama: string
}

const EMPTY_FORM: FormState = {
  tipe: 'inti',
  jabatan_key: 'ketua',
  seksi_key: 'tim_editor',
  peran: 'anggota',
  source: 'guru',
  guru_id: '',
  nama: '',
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

export default function KepanitiaanPageContent() {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [guruList, setGuruList] = useState<GuruOption[]>([])
  const [rows, setRows] = useState<PanitiaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const printRef = useRef<HTMLDivElement>(null)
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
      const [gurus, panitia] = await Promise.all([
        getGuruOptionsForKepanitiaan(),
        getPanitiaList(evt.id),
      ])
      setGuruList(gurus)
      setRows(panitia)
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
        const [gurus, panitia] = await Promise.all([
          getGuruOptionsForKepanitiaan(),
          getPanitiaList(evt.id),
        ])
        if (cancelled) return
        setGuruList(gurus)
        setRows(panitia)
      }
      setLoading(false)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  const intiMap = useMemo(() => new Map(rows.filter(r => r.tipe === 'inti').map(r => [r.jabatan_key, r])), [rows])
  const selectedGuru = guruList.find(guru => guru.id === form.guru_id)

  const resetForm = () => setForm(EMPTY_FORM)

  const editRow = (row: PanitiaRow) => {
    setForm({
      id: row.id,
      tipe: row.tipe,
      jabatan_key: row.jabatan_key ?? 'ketua',
      seksi_key: row.seksi_key ?? 'tim_editor',
      peran: row.peran === 'ketua' ? 'ketua' : 'anggota',
      source: row.guru_id ? 'guru' : 'manual',
      guru_id: row.guru_id ?? '',
      nama: row.nama,
    })
  }

  const submit = async () => {
    if (!event) return
    const nama = form.source === 'guru' ? selectedGuru?.nama ?? '' : form.nama
    const payload: PanitiaInput = {
      tipe: form.tipe,
      jabatan_key: form.tipe === 'inti' ? form.jabatan_key : undefined,
      seksi_key: form.tipe === 'seksi' ? form.seksi_key : undefined,
      peran: form.tipe === 'seksi' ? form.peran : null,
      guru_id: form.source === 'guru' && form.guru_id ? Number(form.guru_id) : null,
      nama,
    }
    setSaving(true)
    const res = await savePanitia(event.id, payload, form.id)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success('Data panitia disimpan')
    resetForm()
    loadData()
  }

  const remove = async (row: PanitiaRow) => {
    if (!event) return
    if (!confirm(`Hapus ${row.nama} dari kepanitiaan?`)) return
    const res = await deletePanitia(row.id, event.id)
    if ('error' in res) return toast.error(res.error)
    toast.success('Panitia dihapus')
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
          <p className="text-sm text-slate-500 mt-1">Kelola susunan panitia inti dan seksi pelaksana EHB.</p>
        </div>
        <button onClick={() => handlePrint()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg">
          <Printer className="w-4 h-4" /> Cetak Organigram
        </button>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
        <p className="text-sm font-bold text-indigo-800">{event.nama}</p>
        <span className="text-xs text-indigo-500 ml-auto">T.A. {event.tahun_ajaran_nama}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <div className="bg-white border rounded-xl overflow-hidden h-fit">
          <div className="bg-slate-50 border-b px-5 py-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-700 text-sm">{form.id ? 'Edit Panitia' : 'Tambah Panitia'}</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(['inti', 'seksi'] as const).map(tipe => (
                <button key={tipe} onClick={() => setForm(prev => ({ ...prev, tipe }))} className={`px-3 py-2 rounded-lg border text-sm font-bold ${form.tipe === tipe ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {tipe === 'inti' ? 'Panitia Inti' : 'Seksi'}
                </button>
              ))}
            </div>

            {form.tipe === 'inti' ? (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Jabatan</label>
                <select value={form.jabatan_key} onChange={e => setForm(prev => ({ ...prev, jabatan_key: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {INTI.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Seksi</label>
                  <select value={form.seksi_key} onChange={e => {
                    const seksi = SEKSI.find(item => item.key === e.target.value)
                    setForm(prev => ({ ...prev, seksi_key: e.target.value, peran: seksi?.hasKetua ? prev.peran : 'anggota' }))
                  }} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {SEKSI.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </div>
                {SEKSI.find(item => item.key === form.seksi_key)?.hasKetua && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Peran</label>
                    <select value={form.peran} onChange={e => setForm(prev => ({ ...prev, peran: e.target.value as 'ketua' | 'anggota' }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="ketua">Ketua Seksi</option>
                      <option value="anggota">Anggota</option>
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              {(['guru', 'manual'] as const).map(source => (
                <button key={source} onClick={() => setForm(prev => ({ ...prev, source, guru_id: '', nama: '' }))} className={`px-3 py-2 rounded-lg border text-sm font-bold ${form.source === source ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {source === 'guru' ? 'Dari Guru' : 'Manual'}
                </button>
              ))}
            </div>

            {form.source === 'guru' ? (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Pilih Guru</label>
                <select value={form.guru_id} onChange={e => setForm(prev => ({ ...prev, guru_id: e.target.value ? Number(e.target.value) : '', nama: guruList.find(g => g.id === Number(e.target.value))?.nama ?? '' }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">-- Pilih Guru --</option>
                  {guruList.map(guru => <option key={guru.id} value={guru.id}>{guru.nama}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Nama Manual</label>
                <input value={form.nama} onChange={e => setForm(prev => ({ ...prev, nama: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nama panitia" />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={submit} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Simpan
              </button>
              {form.id && <button onClick={resetForm} className="px-4 py-2.5 border rounded-lg text-sm font-bold text-slate-600">Batal</button>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="bg-slate-50 border-b px-5 py-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-700 text-sm">Panitia Inti</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
              {INTI.map(item => {
                const row = intiMap.get(item.key)
                return (
                  <div key={item.key} className="border rounded-lg p-4 bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">{item.label}</p>
                    <p className="font-bold text-slate-800 min-h-6">{row?.nama ?? '-'}</p>
                    {row && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => editRow(row)} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Edit2 className="w-3 h-3" /> Edit</button>
                        <button onClick={() => remove(row)} className="text-xs font-bold text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Hapus</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SEKSI.map(seksi => {
              const members = rows.filter(row => row.tipe === 'seksi' && row.seksi_key === seksi.key)
              return (
                <div key={seksi.key} className="bg-white border rounded-xl overflow-hidden">
                  <div className="bg-slate-50 border-b px-4 py-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    <h3 className="font-bold text-slate-700 text-sm">{seksi.label}</h3>
                  </div>
                  <div className="divide-y">
                    {members.length === 0 ? (
                      <div className="p-4 text-sm text-slate-400">Belum ada anggota.</div>
                    ) : members.map(row => (
                      <div key={row.id} className="p-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{row.nama}</p>
                          <p className="text-xs text-slate-400">{row.peran === 'ketua' ? 'Ketua Seksi' : 'Anggota'}</p>
                        </div>
                        <button onClick={() => editRow(row)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => remove(row)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
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
    </div>
  )
}
