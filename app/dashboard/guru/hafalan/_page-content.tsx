'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpenCheck, Check, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getAvailableHafalanTypes,
  getHafalanInitialData,
  getHafalanInputData,
  toggleHafalanProgress,
} from './actions'

export default function HafalanPageContent() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [kelasId, setKelasId] = useState('')
  const [types, setTypes] = useState<any[]>([])
  const [selectedType, setSelectedType] = useState<any>(null)
  const [data, setData] = useState<any>({ santri: [], bab: [], progress: {} })
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')

  useEffect(() => {
    getHafalanInitialData().then(res => {
      setKelasList(res.kelas)
      if (res.kelas.length === 1) setKelasId(res.kelas[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!kelasId) return
    setSelectedType(null)
    getAvailableHafalanTypes(kelasId).then(setTypes)
  }, [kelasId])

  useEffect(() => {
    if (!kelasId || !selectedType) return
    getHafalanInputData(kelasId, selectedType.key).then(setData)
  }, [kelasId, selectedType])

  const totalBlok = useMemo(() => data.bab.reduce((sum: number, bab: any) => sum + bab.blok.length, 0), [data.bab])

  const toggle = async (riwayatId: string, blokId: number) => {
    const key = `${riwayatId}:${blokId}`
    setBusyKey(key)
    const res = await toggleHafalanProgress({ kelasId, jenis: selectedType.key, riwayatId, blokId })
    setBusyKey('')
    if ('error' in res) return toast.error(res.error)
    setData((prev: any) => ({ ...prev, progress: { ...prev.progress, [key]: res.checked } }))
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <DashboardPageHeader
        title="Hafalan"
        description="Pilih jenis hafalan yang tersedia untuk marhalah kelas, lalu tandai blok yang sudah dihafal santri."
      />

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        {kelasList.length > 1 ? (
          <div className="max-w-sm">
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Kelas</label>
            <select value={kelasId} onChange={e => setKelasId(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Pilih kelas</option>
              {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas} - {k.marhalah_nama || '-'}</option>)}
            </select>
          </div>
        ) : kelasList.length === 1 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-xs font-bold uppercase text-emerald-600">Kelas</p>
            <p className="font-semibold text-emerald-900">{kelasList[0].nama_kelas} - {kelasList[0].marhalah_nama || '-'}</p>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : !kelasId ? (
        <div className="rounded-xl border bg-white p-12 text-center text-slate-400">Belum ada kelas yang bisa diakses.</div>
      ) : !selectedType ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {types.map(type => (
            <button key={type.key} onClick={() => setSelectedType(type)} className="group rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600"><BookOpenCheck className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{type.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{type.total_bab} bab, {type.total_blok} blok tersedia</p>
            </button>
          ))}
          {types.length === 0 && <div className="col-span-full rounded-xl border bg-white p-12 text-center text-slate-400">Belum ada konten hafalan aktif untuk marhalah kelas ini.</div>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <button onClick={() => setSelectedType(null)} className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><ArrowLeft className="h-4 w-4" /> Jenis Hafalan</button>
            <div className="text-left md:text-right">
              <h2 className="text-lg font-bold text-slate-900">{selectedType.label}</h2>
              <p className="text-sm text-slate-500">{data.bab.length} bab, {totalBlok} blok</p>
            </div>
          </div>

          <div className="space-y-4">
            {data.santri.map((santri: any) => {
              const done = Object.keys(data.progress).filter(key => key.startsWith(`${santri.riwayat_id}:`) && data.progress[key]).length
              return (
                <div key={santri.riwayat_id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{santri.nama}</h3>
                      <p className="text-xs text-slate-400">{santri.nis || '-'}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-700">{done}/{totalBlok} blok</p>
                  </div>
                  <div className="space-y-3">
                    {data.bab.map((bab: any) => (
                      <div key={bab.id}>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{bab.judul}</p>
                        <div className="flex flex-wrap gap-2">
                          {bab.blok.map((blok: any) => {
                            const key = `${santri.riwayat_id}:${blok.id}`
                            const checked = !!data.progress[key]
                            return (
                              <button
                                key={blok.id}
                                onClick={() => toggle(santri.riwayat_id, blok.id)}
                                disabled={busyKey === key}
                                title={blok.deskripsi || blok.label}
                                className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${checked ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'}`}
                              >
                                {busyKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : checked ? <Check className="h-4 w-4" /> : null}
                                {blok.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
