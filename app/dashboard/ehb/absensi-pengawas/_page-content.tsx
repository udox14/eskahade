'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Loader2, Save, UserMinus, Users, XCircle,
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
import { fullDateWib } from '../_date-utils'

type DraftAbsensi = {
  status: AbsensiStatus
  badal_source: BadalSource
  badal_pengawas_id: number | ''
  badal_panitia_id: number | ''
  badal_nama: string
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

export default function AbsensiPengawasPageContent() {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [tanggalList, setTanggalList] = useState<TanggalOption[]>([])
  const [sesiList, setSesiList] = useState<SesiOption[]>([])
  const [rows, setRows] = useState<AbsensiPengawasRow[]>([])
  const [badalOptions, setBadalOptions] = useState<BadalOptions>({ pengawas: [], panitia: [] })
  const [selectedTanggal, setSelectedTanggal] = useState('')
  const [selectedSesiId, setSelectedSesiId] = useState<number | ''>('')
  const [drafts, setDrafts] = useState<Record<number, DraftAbsensi>>({})
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
        const firstDate = dates[0]?.tanggal || ''
        setSelectedTanggal(firstDate)
        if (firstDate) {
          const sessions = await getSesiPengawasList(evt.id, firstDate)
          if (cancelled) return
          setSesiList(sessions)
          setSelectedSesiId(sessions[0]?.id || '')
        }
      }
      setLoading(false)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadSessions = async () => {
      if (!event || !selectedTanggal) return
      const sessions = await getSesiPengawasList(event.id, selectedTanggal)
      if (cancelled) return
      setSesiList(sessions)
      setSelectedSesiId(sessions[0]?.id || '')
      setRows([])
      setDrafts({})
    }
    void loadSessions()
    return () => {
      cancelled = true
    }
  }, [event, selectedTanggal])

  useEffect(() => {
    let cancelled = false
    const loadRows = async () => {
      if (!event || !selectedTanggal || !selectedSesiId) return
      setLoadingRows(true)
      const list = await getAbsensiPengawasRows(event.id, selectedTanggal, Number(selectedSesiId))
      if (cancelled) return
      setRows(list)
      setDrafts(Object.fromEntries(list.map(row => [row.jadwal_pengawas_id, makeDraft(row)])))
      setLoadingRows(false)
    }
    void loadRows()
    return () => {
      cancelled = true
    }
  }, [event, selectedTanggal, selectedSesiId])

  const selectedSesi = useMemo(
    () => sesiList.find(sesi => sesi.id === selectedSesiId),
    [sesiList, selectedSesiId]
  )

  const summary = useMemo(() => {
    const values = Object.values(drafts)
    return {
      hadir: values.filter(item => item.status === 'HADIR').length,
      tidak: values.filter(item => item.status === 'TIDAK_HADIR').length,
      badal: values.filter(item => item.status === 'BADAL').length,
    }
  }, [drafts])

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

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>

  if (!event) return (
    <div className="max-w-5xl mx-auto py-10">
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5" />
        <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <div className="border-b pb-5 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-3">
            <ClipboardCheck className="w-3.5 h-3.5" /> {event.nama}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Absensi Pengawas EHB</h1>
          <p className="text-sm text-slate-500 mt-1">Pilih hari dan sesi, lalu catat kehadiran pengawas per ruangan.</p>
        </div>
        <button
          onClick={save}
          disabled={saving || rows.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Absensi
        </button>
      </div>

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-4 md:items-end">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Hari / Tanggal</label>
            <select
              value={selectedTanggal}
              onChange={e => setSelectedTanggal(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            >
              {tanggalList.map(item => <option key={item.tanggal} value={item.tanggal}>{fullDateWib(item.tanggal)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Sesi</label>
            <select
              value={selectedSesiId}
              onChange={e => setSelectedSesiId(e.target.value ? Number(e.target.value) : '')}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            >
              {sesiList.map(item => (
                <option key={item.id} value={item.id}>{item.label} - {item.waktu_mulai || '--:--'} s.d. {item.waktu_selesai || '--:--'}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2 text-center">
              <p className="text-[11px] font-bold text-emerald-700 uppercase">Hadir</p>
              <p className="font-bold text-emerald-800">{summary.hadir}</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-2 text-center">
              <p className="text-[11px] font-bold text-red-700 uppercase">Tidak</p>
              <p className="font-bold text-red-800">{summary.tidak}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-2 text-center">
              <p className="text-[11px] font-bold text-amber-700 uppercase">Badal</p>
              <p className="font-bold text-amber-800">{summary.badal}</p>
            </div>
          </div>
        </div>
        {selectedSesi ? (
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            {fullDateWib(selectedTanggal)} - {selectedSesi.label} ({selectedSesi.jam_group})
          </div>
        ) : null}
      </section>

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-slate-50">
          <h2 className="font-bold text-slate-800">Daftar Pengawas</h2>
          <p className="text-sm text-slate-500">Diurutkan berdasarkan nomor ruangan.</p>
        </div>

        {loadingRows ? (
          <div className="flex justify-center p-16"><Loader2 className="w-7 h-7 animate-spin text-indigo-500" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-slate-500">Belum ada jadwal pengawas pada hari/sesi ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold w-28">Ruangan</th>
                  <th className="px-4 py-3 text-left font-bold min-w-[230px]">Pengawas</th>
                  <th className="px-4 py-3 text-left font-bold min-w-[260px]">Status</th>
                  <th className="px-4 py-3 text-left font-bold min-w-[320px]">Badal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(row => {
                  const draft = drafts[row.jadwal_pengawas_id] || makeDraft(row)
                  return (
                    <tr key={row.jadwal_pengawas_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 font-black text-lg flex items-center justify-center">
                          {row.nomor_ruangan}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{row.nama_pengawas}</p>
                        <p className="text-xs text-slate-400">{row.nama_ruangan || `Ruangan ${row.nomor_ruangan}`} - {row.tag}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { key: 'HADIR', label: 'Hadir', icon: CheckCircle2, activeClass: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
                            { key: 'TIDAK_HADIR', label: 'Tidak', icon: XCircle, activeClass: 'bg-red-50 border-red-300 text-red-700' },
                            { key: 'BADAL', label: 'Badal', icon: UserMinus, activeClass: 'bg-amber-50 border-amber-300 text-amber-700' },
                          ] as const).map(option => {
                            const Icon = option.icon
                            const active = draft.status === option.key
                            return (
                              <button
                                key={option.key}
                                onClick={() => updateDraft(row.jadwal_pengawas_id, { status: option.key })}
                                className={`border rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 ${active ? option.activeClass : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                              >
                                <Icon className="w-4 h-4" /> {option.label}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {draft.status === 'BADAL' ? (
                          <div className="grid md:grid-cols-[120px_1fr] gap-2">
                            <select
                              value={draft.badal_source}
                              onChange={e => updateDraft(row.jadwal_pengawas_id, { badal_source: e.target.value as BadalSource })}
                              className="border rounded-xl px-3 py-2 text-sm"
                            >
                              <option value="pengawas">Pengawas</option>
                              <option value="panitia">Panitia</option>
                              <option value="manual">Manual</option>
                            </select>
                            {draft.badal_source === 'pengawas' ? (
                              <select
                                value={draft.badal_pengawas_id}
                                onChange={e => {
                                  const id = e.target.value ? Number(e.target.value) : ''
                                  const selected = badalOptions.pengawas.find(item => item.id === id)
                                  updateDraft(row.jadwal_pengawas_id, { badal_pengawas_id: id, badal_nama: selected?.nama || '' })
                                }}
                                className="border rounded-xl px-3 py-2 text-sm"
                              >
                                <option value="">-- Pilih pengawas --</option>
                                {badalOptions.pengawas
                                  .filter(item => item.id !== row.pengawas_id)
                                  .map(item => <option key={item.id} value={item.id}>{item.nama}</option>)}
                              </select>
                            ) : draft.badal_source === 'panitia' ? (
                              <select
                                value={draft.badal_panitia_id}
                                onChange={e => {
                                  const id = e.target.value ? Number(e.target.value) : ''
                                  const selected = badalOptions.panitia.find(item => item.id === id)
                                  updateDraft(row.jadwal_pengawas_id, { badal_panitia_id: id, badal_nama: selected?.nama || '' })
                                }}
                                className="border rounded-xl px-3 py-2 text-sm"
                              >
                                <option value="">-- Pilih panitia --</option>
                                {badalOptions.panitia.map(item => <option key={item.id} value={item.id}>{item.nama}</option>)}
                              </select>
                            ) : (
                              <input
                                value={draft.badal_nama}
                                onChange={e => updateDraft(row.jadwal_pengawas_id, { badal_nama: e.target.value })}
                                placeholder="Nama badal"
                                className="border rounded-xl px-3 py-2 text-sm"
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
