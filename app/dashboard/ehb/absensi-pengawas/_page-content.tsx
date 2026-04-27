'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Save,
  UserMinus,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getAbsensiPengawasRows,
  getActiveEventForAbsensiPengawas,
  getBadalOptions,
  getSesiPengawasList,
  getTanggalPengawasList,
  saveAbsensiPengawasBatch,
  type AbsensiPengawasRow,
  type AbsensiStatus,
  type ActiveEvent,
  type BadalOptions,
  type BadalSource,
  type SesiOption,
  type TanggalOption,
} from './actions'
import { fullDateWib, shortDateWib } from '../_date-utils'

type DraftAbsensi = {
  status: AbsensiStatus
  badal_source: BadalSource
  badal_pengawas_id: number | ''
  badal_panitia_id: number | ''
  badal_nama: string
}

type SelectedSchedule = {
  tanggal: string
  sesi: SesiOption
}

function makeDraft(row?: AbsensiPengawasRow): DraftAbsensi {
  return {
    status: row?.status || 'HADIR',
    badal_source: row?.badal_source || 'pengawas',
    badal_pengawas_id: row?.badal_pengawas_id ?? '',
    badal_panitia_id: row?.badal_panitia_id ?? '',
    badal_nama: row?.badal_nama || '',
  }
}

function statusStyle(status: AbsensiStatus) {
  if (status === 'HADIR') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'TIDAK_HADIR') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export default function AbsensiPengawasPageContent() {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [tanggalList, setTanggalList] = useState<TanggalOption[]>([])
  const [sesiByTanggal, setSesiByTanggal] = useState<Record<string, SesiOption[]>>({})
  const [rows, setRows] = useState<AbsensiPengawasRow[]>([])
  const [badalOptions, setBadalOptions] = useState<BadalOptions>({ pengawas: [], panitia: [] })
  const [selected, setSelected] = useState<SelectedSchedule | null>(null)
  const [drafts, setDrafts] = useState<Record<number, DraftAbsensi>>({})
  const [badalModalId, setBadalModalId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setLoading(true)
      const evt = await getActiveEventForAbsensiPengawas()
      if (cancelled) return
      setEvent(evt)

      if (evt) {
        const [dates, options] = await Promise.all([
          getTanggalPengawasList(evt.id),
          getBadalOptions(evt.id),
        ])
        if (cancelled) return

        setTanggalList(dates)
        setBadalOptions(options)

        const sessionEntries = await Promise.all(
          dates.map(async item => [item.tanggal, await getSesiPengawasList(evt.id, item.tanggal)] as const)
        )
        if (cancelled) return
        setSesiByTanggal(Object.fromEntries(sessionEntries))
      }

      setLoading(false)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  const loadRows = async (schedule: SelectedSchedule) => {
    if (!event) return
    setSelected(schedule)
    setRows([])
    setDrafts({})
    setLoadingRows(true)
    const list = await getAbsensiPengawasRows(event.id, schedule.tanggal, schedule.sesi.id)
    setRows(list)
    setDrafts(Object.fromEntries(list.map(row => [row.jadwal_pengawas_id, makeDraft(row)])))
    setLoadingRows(false)
  }

  const summary = useMemo(() => {
    const values = Object.values(drafts)
    return {
      hadir: values.filter(item => item.status === 'HADIR').length,
      tidak: values.filter(item => item.status === 'TIDAK_HADIR').length,
      badal: values.filter(item => item.status === 'BADAL').length,
    }
  }, [drafts])

  const selectedBadalRow = useMemo(
    () => rows.find(row => row.jadwal_pengawas_id === badalModalId) || null,
    [badalModalId, rows]
  )

  const selectedBadalDraft = selectedBadalRow
    ? drafts[selectedBadalRow.jadwal_pengawas_id] || makeDraft(selectedBadalRow)
    : null

  const updateDraft = (jadwalId: number, patch: Partial<DraftAbsensi>) => {
    setDrafts(prev => {
      const current = prev[jadwalId] || makeDraft()
      const next = { ...current, ...patch }

      if (patch.status && patch.status !== 'BADAL') {
        next.badal_pengawas_id = ''
        next.badal_panitia_id = ''
        next.badal_nama = ''
      }

      if (patch.badal_source) {
        next.badal_pengawas_id = ''
        next.badal_panitia_id = ''
        next.badal_nama = ''
      }

      return { ...prev, [jadwalId]: next }
    })
  }

  const setStatus = (row: AbsensiPengawasRow, status: AbsensiStatus) => {
    updateDraft(row.jadwal_pengawas_id, { status })
    if (status === 'BADAL') setBadalModalId(row.jadwal_pengawas_id)
  }

  const getBadalLabel = (draft: DraftAbsensi) => {
    if (draft.status !== 'BADAL') return null
    if (draft.badal_nama) return draft.badal_nama
    if (draft.badal_pengawas_id) {
      return badalOptions.pengawas.find(item => item.id === draft.badal_pengawas_id)?.nama || null
    }
    if (draft.badal_panitia_id) {
      return badalOptions.panitia.find(item => item.id === draft.badal_panitia_id)?.nama || null
    }
    return null
  }

  const save = async () => {
    if (!event) return
    const payload = rows.map(row => {
      const draft = drafts[row.jadwal_pengawas_id] || makeDraft(row)
      return {
        jadwal_pengawas_id: row.jadwal_pengawas_id,
        status: draft.status,
        badal_source: draft.status === 'BADAL' ? draft.badal_source : null,
        badal_pengawas_id: draft.status === 'BADAL' && draft.badal_source === 'pengawas' && draft.badal_pengawas_id ? Number(draft.badal_pengawas_id) : null,
        badal_panitia_id: draft.status === 'BADAL' && draft.badal_source === 'panitia' && draft.badal_panitia_id ? Number(draft.badal_panitia_id) : null,
        badal_nama: draft.status === 'BADAL' ? draft.badal_nama : null,
      }
    })

    setSaving(true)
    const res = await saveAbsensiPengawasBatch(event.id, payload)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${res.saved} absensi pengawas disimpan`)
  }

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="max-w-md mx-auto py-10 px-4">
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 border-x border-slate-200">
      {!selected ? (
        <div className="flex flex-col min-h-screen">
          <div className="bg-indigo-600 px-5 pt-10 pb-6 shadow-md rounded-b-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-100 bg-white/10 px-3 py-1 rounded-full mb-3">
              <ClipboardCheck className="w-3.5 h-3.5" />
              {event.nama}
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Absensi Pengawas</h1>
            <p className="text-indigo-100 text-sm">Pilih hari dan sesi untuk mencatat kehadiran.</p>
          </div>

          <div className="p-4 flex-1 space-y-6">
            {tanggalList.length === 0 ? (
              <div className="text-center py-20 bg-white border border-dashed rounded-2xl">
                <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-500">Belum ada jadwal pengawas</p>
                <p className="text-xs text-slate-400">Jadwal pengawas akan muncul di sini.</p>
              </div>
            ) : (
              tanggalList.map(item => {
                const sessions = sesiByTanggal[item.tanggal] || []
                return (
                  <div key={item.tanggal} className="space-y-3">
                    <h2 className="font-bold text-slate-700 flex items-center gap-2 px-1">
                      <CalendarDays className="w-4 h-4 text-indigo-500" />
                      {fullDateWib(item.tanggal)}
                    </h2>
                    {sessions.map(sesi => (
                      <button
                        key={sesi.id}
                        onClick={() => void loadRows({ tanggal: item.tanggal, sesi })}
                        className="w-full bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex items-center justify-between text-left active:scale-[0.98]"
                      >
                        <div>
                          <p className="font-bold text-slate-800 text-lg mb-0.5">{sesi.label}</p>
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{sesi.jam_group}</span>
                            <span className="text-slate-500">{sesi.waktu_mulai || '--:--'} - {sesi.waktu_selesai || '--:--'}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col min-h-screen pb-28">
          <div className="bg-white px-4 py-4 border-b sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelected(null)
                  setRows([])
                  setDrafts({})
                }}
                className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200"
                aria-label="Kembali"
              >
                <ChevronLeft className="w-6 h-6 text-slate-700" />
              </button>
              <div className="min-w-0">
                <h2 className="font-bold text-slate-800 text-lg leading-tight truncate">{selected.sesi.label}</h2>
                <p className="text-xs text-indigo-600 font-bold">
                  {shortDateWib(selected.tanggal, false)} - {selected.sesi.jam_group}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-center">
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Hadir</p>
                <p className="font-bold text-emerald-800">{summary.hadir}</p>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-center">
                <p className="text-[10px] font-bold text-red-700 uppercase">Tidak</p>
                <p className="font-bold text-red-800">{summary.tidak}</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-center">
                <p className="text-[10px] font-bold text-amber-700 uppercase">Badal</p>
                <p className="font-bold text-amber-800">{summary.badal}</p>
              </div>
            </div>
          </div>

          <div className="p-3">
            {loadingRows ? (
              <div className="flex justify-center p-16">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center bg-white border border-dashed rounded-2xl text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="font-bold text-slate-500">Belum ada pengawas</p>
                <p className="text-xs">Tidak ada jadwal pengawas pada sesi ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map(row => {
                  const draft = drafts[row.jadwal_pengawas_id] || makeDraft(row)
                  const badalLabel = getBadalLabel(draft)
                  return (
                    <div
                      key={row.jadwal_pengawas_id}
                      className={`bg-white border rounded-2xl p-3 shadow-sm transition-colors ${statusStyle(draft.status)}`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-white/70 border border-current/10 text-slate-800 font-black text-lg flex items-center justify-center flex-shrink-0">
                          {row.nomor_ruangan}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-slate-800 leading-tight truncate">{row.nama_pengawas}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {row.nama_ruangan || `Ruangan ${row.nomor_ruangan}`} - {row.tag}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold uppercase bg-white/75 border border-current/10 px-2 py-1 rounded-full flex-shrink-0">
                              {draft.status === 'TIDAK_HADIR' ? 'Tidak' : draft.status}
                            </span>
                          </div>
                          {draft.status === 'BADAL' ? (
                            <button
                              onClick={() => setBadalModalId(row.jadwal_pengawas_id)}
                              className="mt-2 text-xs font-bold text-amber-700 bg-white/80 border border-amber-200 rounded-lg px-2.5 py-1.5"
                            >
                              {badalLabel ? `Badal: ${badalLabel}` : 'Atur badal'}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 h-10">
                        <button
                          onClick={() => setStatus(row, 'HADIR')}
                          className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${draft.status === 'HADIR' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Hadir
                        </button>
                        <button
                          onClick={() => setStatus(row, 'TIDAK_HADIR')}
                          className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${draft.status === 'TIDAK_HADIR' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                        >
                          <XCircle className="w-4 h-4" />
                          Tidak
                        </button>
                        <button
                          onClick={() => setStatus(row, 'BADAL')}
                          className={`rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${draft.status === 'BADAL' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                        >
                          <UserMinus className="w-4 h-4" />
                          Badal
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/85 backdrop-blur-md border-t max-w-md mx-auto flex gap-3 z-20">
            <button
              onClick={save}
              disabled={saving || rows.length === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Simpan Absensi
            </button>
          </div>
        </div>
      )}

      {selectedBadalRow && selectedBadalDraft ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 px-0 sm:px-4">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase">Atur Badal</p>
                <h3 className="font-bold text-slate-800 leading-tight">{selectedBadalRow.nama_pengawas}</h3>
                <p className="text-xs text-slate-500">Ruangan {selectedBadalRow.nomor_ruangan}</p>
              </div>
              <button
                onClick={() => setBadalModalId(null)}
                className="p-2 rounded-full hover:bg-slate-100"
                aria-label="Tutup"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Sumber Badal</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([
                    ['pengawas', 'Pengawas'],
                    ['panitia', 'Panitia'],
                    ['manual', 'Manual'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => updateDraft(selectedBadalRow.jadwal_pengawas_id, { badal_source: key })}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold ${selectedBadalDraft.badal_source === key ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedBadalDraft.badal_source === 'pengawas' ? (
                <select
                  value={selectedBadalDraft.badal_pengawas_id}
                  onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : ''
                    const selectedOption = badalOptions.pengawas.find(item => item.id === id)
                    updateDraft(selectedBadalRow.jadwal_pengawas_id, { badal_pengawas_id: id, badal_nama: selectedOption?.nama || '' })
                  }}
                  className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400"
                >
                  <option value="">-- Pilih pengawas --</option>
                  {badalOptions.pengawas
                    .filter(item => item.id !== selectedBadalRow.pengawas_id)
                    .map(item => <option key={item.id} value={item.id}>{item.nama}</option>)}
                </select>
              ) : selectedBadalDraft.badal_source === 'panitia' ? (
                <select
                  value={selectedBadalDraft.badal_panitia_id}
                  onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : ''
                    const selectedOption = badalOptions.panitia.find(item => item.id === id)
                    updateDraft(selectedBadalRow.jadwal_pengawas_id, { badal_panitia_id: id, badal_nama: selectedOption?.nama || '' })
                  }}
                  className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400"
                >
                  <option value="">-- Pilih panitia --</option>
                  {badalOptions.panitia.map(item => (
                    <option key={item.id} value={item.id}>{item.nama} - {item.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={selectedBadalDraft.badal_nama}
                  onChange={e => updateDraft(selectedBadalRow.jadwal_pengawas_id, { badal_nama: e.target.value })}
                  placeholder="Nama badal"
                  className="w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400"
                />
              )}

              <button
                onClick={() => setBadalModalId(null)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl"
              >
                Simpan Badal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
