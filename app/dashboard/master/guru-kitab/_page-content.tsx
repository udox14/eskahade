'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarDays, Filter, Loader2, Plus, Save, Search, Settings2, Sparkles, Trash2, UsersRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { generateGuruKitabDefaults, getGuruKitabSetup, saveGuruKitabAssignments, type GuruKitabSaveRow } from './actions'

type SessionKey = 'shubuh' | 'ashar' | 'maghrib'
type DraftAssignment = {
  draft_id: string
  kelas_id: string
  sesi: SessionKey
  hari_index: number | null
  guru_id: string
  kitab_id: string
  source: 'auto' | 'manual'
  is_active: number
}

const SESSION_META: { key: SessionKey; label: string }[] = [
  { key: 'shubuh', label: 'Shubuh' },
  { key: 'ashar', label: 'Ashar' },
  { key: 'maghrib', label: 'Malam' },
]

const HARI_LIST = [
  { index: 1, label: 'Senin' },
  { index: 2, label: 'Selasa' },
  { index: 3, label: 'Rabu' },
  { index: 4, label: 'Kamis' },
  { index: 5, label: 'Jumat' },
  { index: 6, label: 'Sabtu' },
  { index: 0, label: 'Ahad' },
]

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function defaultGuruId(kelas: any, sesi: SessionKey) {
  if (sesi === 'shubuh') return kelas.guru_shubuh_id ? String(kelas.guru_shubuh_id) : ''
  if (sesi === 'ashar') return kelas.guru_ashar_id ? String(kelas.guru_ashar_id) : ''
  return kelas.guru_maghrib_id ? String(kelas.guru_maghrib_id) : ''
}

function defaultGuruName(kelas: any, sesi: SessionKey) {
  if (sesi === 'shubuh') return kelas.guru_shubuh_nama || '-'
  if (sesi === 'ashar') return kelas.guru_ashar_nama || '-'
  return kelas.guru_maghrib_nama || '-'
}

function normalizeAssignments(rows: any[]): DraftAssignment[] {
  return rows.map(row => ({
    draft_id: String(row.id || uid()),
    kelas_id: String(row.kelas_id),
    sesi: row.sesi,
    hari_index: row.hari_index == null ? null : Number(row.hari_index),
    guru_id: row.guru_id ? String(row.guru_id) : '',
    kitab_id: row.kitab_id ? String(row.kitab_id) : '',
    source: row.source === 'auto' ? 'auto' : 'manual',
    is_active: row.is_active === 0 ? 0 : 1,
  }))
}

export default function GuruKitabPageContent() {
  const confirm = useConfirm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([])
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [guruList, setGuruList] = useState<any[]>([])
  const [kelasList, setKelasList] = useState<any[]>([])
  const [kitabList, setKitabList] = useState<any[]>([])
  const [gabunganList, setGabunganList] = useState<any[]>([])
  const [assignments, setAssignments] = useState<DraftAssignment[]>([])
  const [tahunAjaranId, setTahunAjaranId] = useState('')
  const [marhalahId, setMarhalahId] = useState('')
  const [search, setSearch] = useState('')
  const [guruFilter, setGuruFilter] = useState('')
  const [overrideModal, setOverrideModal] = useState<{ kelasId: string; sesi: SessionKey } | null>(null)
  const [overrideHariIndex, setOverrideHariIndex] = useState(1)

  const loadData = async (tahunId?: string, mrhId?: string) => {
    setLoading(true)
    const selectedMarhalah = mrhId ?? marhalahId
    const res = await getGuruKitabSetup(Number(tahunId || tahunAjaranId || 0) || null, selectedMarhalah || null)
    setTahunAjaranList(res.tahunAjaranList)
    setMarhalahList(res.marhalahList)
    setGuruList(res.guruList)
    setKelasList(res.kelasList)
    setKitabList(res.kitabList)
    setGabunganList(res.gabunganList)
    setAssignments(normalizeAssignments(res.assignments))
    const selectedTahun = String(tahunId || tahunAjaranId || res.tahunAjaranAktif?.id || res.tahunAjaranList[0]?.id || '')
    setTahunAjaranId(selectedTahun)
    setLoading(false)
  }

  useEffect(() => {
    loadData('', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kitabById = useMemo(() => new Map(kitabList.map(kitab => [String(kitab.id), kitab])), [kitabList])
  const gabunganByKelasSesi = useMemo(() => {
    const map = new Map<string, any>()
    for (const item of gabunganList) map.set(`${item.kelas_id}|${item.sesi}`, item)
    return map
  }, [gabunganList])
  const gabunganMembers = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const item of gabunganList) {
      const key = `${item.tahun_ajaran_id}|${item.sesi}|${item.group_key}`
      map.set(key, [...(map.get(key) || []), item.kelas_id])
    }
    return map
  }, [gabunganList])

  const filteredKelas = useMemo(() => {
    const q = search.toLowerCase().trim()
    return kelasList.filter(kelas => {
      const matchSearch = !q ||
        String(kelas.nama_kelas || '').toLowerCase().includes(q) ||
        String(kelas.marhalah_nama || '').toLowerCase().includes(q)
      const matchGuru = !guruFilter || assignments.some(row => row.kelas_id === kelas.id && row.guru_id === guruFilter && row.is_active)
      return matchSearch && matchGuru
    })
  }, [kelasList, search, guruFilter, assignments])

  const assignmentsFor = (kelasId: string, sesi: SessionKey, hariIndex: number | null) =>
    assignments.filter(row => row.kelas_id === kelasId && row.sesi === sesi && row.hari_index === hariIndex && row.is_active)

  const kitabOptionsForKelas = (kelas: any) =>
    kitabList.filter(kitab => Number(kitab.marhalah_id) === Number(kelas.marhalah_id))

  const addAssignment = (kelas: any, sesi: SessionKey, hariIndex: number | null = null) => {
    const options = kitabOptionsForKelas(kelas)
    setAssignments(prev => [
      ...prev,
      {
        draft_id: uid(),
        kelas_id: kelas.id,
        sesi,
        hari_index: hariIndex,
        guru_id: defaultGuruId(kelas, sesi),
        kitab_id: options[0] ? String(options[0].id) : '',
        source: 'manual',
        is_active: 1,
      },
    ])
  }

  const updateAssignment = (draftId: string, patch: Partial<DraftAssignment>) => {
    setAssignments(prev => prev.map(row => row.draft_id === draftId ? { ...row, ...patch, source: 'manual' } : row))
  }

  const deleteAssignment = (draftId: string) => {
    setAssignments(prev => prev.filter(row => row.draft_id !== draftId))
  }

  const applyToGabunganMembers = async (kelas: any, sesi: SessionKey) => {
    const gabungan = gabunganByKelasSesi.get(`${kelas.id}|${sesi}`)
    if (!gabungan) return toast.info('Kelas ini belum punya kode gabungan untuk sesi tersebut.')
    const key = `${gabungan.tahun_ajaran_id}|${gabungan.sesi}|${gabungan.group_key}`
    const members = (gabunganMembers.get(key) || []).filter(id => id !== kelas.id)
    if (members.length === 0) return toast.info('Belum ada anggota gabungan lain.')
    if (!await confirm(`Terapkan pembagian ${SESSION_META.find(item => item.key === sesi)?.label} dari ${kelas.nama_kelas} ke ${members.length} kelas gabungan?`)) return

    const sourceRows = assignmentsFor(kelas.id, sesi, null)
    setAssignments(prev => [
      ...prev.filter(row => !(members.includes(row.kelas_id) && row.sesi === sesi && row.hari_index === null)),
      ...members.flatMap(kelasId => sourceRows.map(row => ({
        ...row,
        draft_id: uid(),
        kelas_id: kelasId,
        source: 'manual' as const,
      }))),
    ])
    toast.success('Pembagian diterapkan ke anggota gabungan.')
  }

  const handleGenerate = async () => {
    if (!tahunAjaranId) return toast.warning('Pilih tahun ajaran dulu.')
    if (!await confirm('Generate default akan mengisi data kosong dan memperbarui baris auto. Data manual tetap aman. Lanjut?')) return
    setGenerating(true)
    const res = await generateGuruKitabDefaults(Number(tahunAjaranId))
    setGenerating(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Default dibuat: ${res.inserted} tambah, ${res.updated} update.`)
    await loadData(tahunAjaranId, marhalahId)
  }

  const handleSave = async () => {
    if (!tahunAjaranId) return toast.warning('Pilih tahun ajaran dulu.')
    const visibleIds = new Set(kelasList.map(kelas => kelas.id))
    const rows: GuruKitabSaveRow[] = assignments
      .filter(row => visibleIds.has(row.kelas_id))
      .map(row => ({
        kelas_id: row.kelas_id,
        sesi: row.sesi,
        hari_index: row.hari_index,
        guru_id: Number(row.guru_id || 0) || null,
        kitab_id: Number(row.kitab_id || 0) || null,
        source: row.source,
        is_active: row.is_active,
      }))
    setSaving(true)
    const res = await saveGuruKitabAssignments(Number(tahunAjaranId), rows)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Tersimpan: ${res.saved} baris dari ${res.kelas} kelas.`)
    await loadData(tahunAjaranId, marhalahId)
  }

  const renderAssignmentRows = (kelas: any, sesi: SessionKey, hariIndex: number | null = null) => {
    const rows = assignmentsFor(kelas.id, sesi, hariIndex)
    const options = kitabOptionsForKelas(kelas)
    if (rows.length === 0) {
      return <p className="py-3 text-xs text-slate-400">Belum ada kitab.</p>
    }

    return rows.map(row => {
      const kitab = kitabById.get(row.kitab_id)
      return (
        <div key={row.draft_id} className="grid grid-cols-1 gap-2 py-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select
            value={row.kitab_id}
            onChange={e => updateAssignment(row.draft_id, { kitab_id: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Pilih kitab</option>
            {options.map(item => (
              <option key={item.id} value={item.id}>{item.mapel_nama} - {item.nama_kitab}</option>
            ))}
          </select>
          <select
            value={row.guru_id}
            onChange={e => updateAssignment(row.draft_id, { guru_id: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Pilih guru</option>
            {guruList.map(guru => <option key={guru.id} value={guru.id}>{guru.nama_lengkap}</option>)}
          </select>
          <button
            type="button"
            onClick={() => deleteAssignment(row.draft_id)}
            title={`Hapus ${kitab?.nama_kitab || 'baris'}`}
            className="inline-flex items-center justify-center rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-rose-600 hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    })
  }

  const activeOverrideClass = overrideModal ? kelasList.find(kelas => kelas.id === overrideModal.kelasId) : null

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <DashboardPageHeader
          title="Pembagian Kitab Guru"
          description="Atur guru pemegang kitab per tahun ajaran, kelas, sesi, dan override harian."
          className="flex-1"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={handleGenerate} disabled={generating || loading || !tahunAjaranId} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Default
          </button>
          <button onClick={handleSave} disabled={saving || loading || !tahunAjaranId} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select value={tahunAjaranId} onChange={async e => { setTahunAjaranId(e.target.value); await loadData(e.target.value, marhalahId) }} className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Pilih tahun ajaran</option>
            {tahunAjaranList.map(ta => <option key={ta.id} value={ta.id}>{ta.nama}</option>)}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select value={marhalahId} onChange={async e => { setMarhalahId(e.target.value); await loadData(tahunAjaranId, e.target.value) }} className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Pilih marhalah dulu</option>
            {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
          </select>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input disabled={!marhalahId} value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kelas..." className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400" />
        </div>
        <div className="relative">
          <UsersRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select disabled={!marhalahId} value={guruFilter} onChange={e => setGuruFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400">
            <option value="">Semua guru</option>
            {guruList.map(guru => <option key={guru.id} value={guru.id}>{guru.nama_lengkap}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white py-20 text-center text-slate-400">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
        </div>
      ) : !marhalahId ? (
        <div className="rounded-2xl border border-dashed bg-white py-20 text-center text-slate-400">
          <p className="font-bold text-slate-600">Pilih marhalah dulu</p>
          <p className="mt-1 text-sm">Data kelas dan kitab baru dimuat setelah filter marhalah dipilih.</p>
        </div>
      ) : filteredKelas.length === 0 ? (
        <div className="rounded-2xl border bg-white py-20 text-center text-slate-400">Tidak ada kelas untuk marhalah/filter ini.</div>
      ) : (
        <div className="space-y-4">
          {filteredKelas.map(kelas => (
            <section key={kelas.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-black text-slate-900">{kelas.nama_kelas}</p>
                  <p className="text-xs font-semibold text-slate-500">{kelas.marhalah_nama}</p>
                </div>
                <div className="flex max-w-full flex-wrap gap-2 text-[11px] font-bold text-slate-500 md:justify-end">
                  {SESSION_META.map(session => (
                    <span key={session.key} className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2.5 py-1">
                      {session.label}: {defaultGuruName(kelas, session.key)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 divide-y divide-slate-100 xl:grid-cols-3 xl:divide-x xl:divide-y-0">
                {SESSION_META.map(session => {
                  const gabungan = gabunganByKelasSesi.get(`${kelas.id}|${session.key}`)
                  return (
                    <div key={session.key} className="p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-indigo-600" />
                            <p className="font-bold text-slate-800">{session.label}</p>
                          </div>
                          {gabungan ? (
                            <p className="mt-1 text-[11px] font-semibold text-indigo-600">Gabungan: {gabungan.group_key}{gabungan.tempat ? ` - ${gabungan.tempat}` : ''}</p>
                          ) : (
                            <p className="mt-1 text-[11px] text-slate-400">Tidak digabung</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {gabungan ? (
                            <button type="button" onClick={() => applyToGabunganMembers(kelas, session.key)} title="Terapkan ke anggota gabungan" className="rounded-lg border border-indigo-100 bg-indigo-50 p-2 text-indigo-600 hover:bg-indigo-100">
                              <UsersRound className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button type="button" onClick={() => addAssignment(kelas, session.key)} title="Tambah kitab" className="rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100">
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOverrideHariIndex(1)
                              setOverrideModal({ kelasId: kelas.id, sesi: session.key })
                            }}
                            title="Override harian"
                            className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                          >
                            <Settings2 className="h-4 w-4" />
                            {HARI_LIST.reduce((total, day) => total + assignmentsFor(kelas.id, session.key, day.index).length, 0) > 0 ? (
                              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white">
                                {HARI_LIST.reduce((total, day) => total + assignmentsFor(kelas.id, session.key, day.index).length, 0)}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {renderAssignmentRows(kelas, session.key)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {overrideModal && activeOverrideClass ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase text-indigo-600">{activeOverrideClass.nama_kelas}</p>
                <h3 className="text-lg font-black text-slate-900">
                  Override Harian {SESSION_META.find(item => item.key === overrideModal.sesi)?.label}
                </h3>
              </div>
              <button onClick={() => setOverrideModal(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <p className="mb-3 text-sm text-slate-500">Pilih hari di bawah. Kosong berarti memakai pembagian default sesi.</p>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {HARI_LIST.map(day => {
                  const count = assignmentsFor(activeOverrideClass.id, overrideModal.sesi, day.index).length
                  return (
                    <button
                      key={day.index}
                      type="button"
                      onClick={() => setOverrideHariIndex(day.index)}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                        overrideHariIndex === day.index
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : count
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {day.label} {count ? `(${count})` : ''}
                    </button>
                  )
                })}
              </div>
              <div className="divide-y divide-slate-100">
                {renderAssignmentRows(activeOverrideClass, overrideModal.sesi, overrideHariIndex)}
              </div>
              <button type="button" onClick={() => addAssignment(activeOverrideClass, overrideModal.sesi, overrideHariIndex)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                <Plus className="h-4 w-4" />
                Tambah Override
              </button>
            </div>
            <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              <button onClick={() => setOverrideModal(null)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Tutup</button>
              <button onClick={() => setOverrideModal(null)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Selesai</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
