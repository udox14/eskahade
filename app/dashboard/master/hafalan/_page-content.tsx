'use client'

import { useEffect, useState } from 'react'
import { BookOpenCheck, Loader2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getMasterHafalanInitialData,
  getMasterHafalanList,
  setHafalanActive,
  tambahHafalanBab,
  tambahHafalanBlok,
} from './actions'

export default function MasterHafalanContent() {
  const [types, setTypes] = useState<any[]>([])
  const [marhalah, setMarhalah] = useState<any[]>([])
  const [jenis, setJenis] = useState('quran')
  const [marhalahId, setMarhalahId] = useState('')
  const [bab, setBab] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newBab, setNewBab] = useState({ judul: '', urutan: 0 })
  const [newBlok, setNewBlok] = useState<Record<number, { label: string; deskripsi: string; urutan: number }>>({})

  useEffect(() => {
    getMasterHafalanInitialData().then(data => {
      setTypes([...data.types])
      setMarhalah(data.marhalah)
      if (data.marhalah[0]) setMarhalahId(String(data.marhalah[0].id))
      setLoading(false)
    })
  }, [])

  const load = async () => {
    if (!jenis || !marhalahId) return
    setBab(await getMasterHafalanList(jenis, Number(marhalahId)))
  }

  useEffect(() => { load() }, [jenis, marhalahId])

  const addBab = async () => {
    const res = await tambahHafalanBab({ jenis, marhalahId: Number(marhalahId), judul: newBab.judul, urutan: newBab.urutan })
    if ('error' in res) return toast.error(res.error)
    toast.success('Bab ditambahkan')
    setNewBab({ judul: '', urutan: 0 })
    load()
  }

  const addBlok = async (babId: number) => {
    const input = newBlok[babId] || { label: '', deskripsi: '', urutan: 0 }
    const res = await tambahHafalanBlok({ babId, ...input })
    if ('error' in res) return toast.error(res.error)
    toast.success('Blok ditambahkan')
    setNewBlok(prev => ({ ...prev, [babId]: { label: '', deskripsi: '', urutan: 0 } }))
    load()
  }

  const toggleActive = async (target: 'bab' | 'blok', id: number, active: boolean) => {
    const res = await setHafalanActive(target, id, active)
    if ('error' in res) return toast.error(res.error)
    load()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-20">
      <DashboardPageHeader
        title="Master Hafalan"
        description="Atur bab dan blok hafalan per jenis dan marhalah."
      />

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Jenis Hafalan</label>
            <select value={jenis} onChange={e => setJenis(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">
              {types.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Marhalah</label>
            <select value={marhalahId} onChange={e => setMarhalahId(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">
              {marhalah.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-800"><Plus className="h-4 w-4 text-emerald-600" /> Tambah Bab</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
          <input value={newBab.judul} onChange={e => setNewBab(prev => ({ ...prev, judul: e.target.value }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Contoh: Juz 30 / Bab Kalam" />
          <input type="number" value={newBab.urutan} onChange={e => setNewBab(prev => ({ ...prev, urutan: Number(e.target.value || 0) }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Urutan" />
          <button onClick={addBab} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Simpan Bab</button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {bab.map(item => (
            <div key={item.id} className="rounded-xl border bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 font-bold text-slate-900"><BookOpenCheck className="h-4 w-4 text-emerald-600" /> {item.judul}</h2>
                  <p className="text-xs text-slate-500">Urutan {item.urutan}</p>
                </div>
                <button onClick={() => toggleActive('bab', item.id, !item.is_active)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {item.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {item.is_active ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>
              <div className="p-4">
                <div className="mb-4 grid gap-2 md:grid-cols-[1fr_1fr_100px_auto]">
                  <input value={newBlok[item.id]?.label || ''} onChange={e => setNewBlok(prev => ({ ...prev, [item.id]: { label: e.target.value, deskripsi: prev[item.id]?.deskripsi || '', urutan: prev[item.id]?.urutan || 0 } }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Label blok" />
                  <input value={newBlok[item.id]?.deskripsi || ''} onChange={e => setNewBlok(prev => ({ ...prev, [item.id]: { label: prev[item.id]?.label || '', deskripsi: e.target.value, urutan: prev[item.id]?.urutan || 0 } }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Deskripsi opsional" />
                  <input type="number" value={newBlok[item.id]?.urutan || 0} onChange={e => setNewBlok(prev => ({ ...prev, [item.id]: { label: prev[item.id]?.label || '', deskripsi: prev[item.id]?.deskripsi || '', urutan: Number(e.target.value || 0) } }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                  <button onClick={() => addBlok(item.id)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Tambah Blok</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.blok.map((blok: any) => (
                    <button key={blok.id} onClick={() => toggleActive('blok', blok.id, !blok.is_active)} title={blok.deskripsi || blok.label} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${blok.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                      {blok.label}
                    </button>
                  ))}
                  {item.blok.length === 0 && <p className="text-sm text-slate-400">Belum ada blok.</p>}
                </div>
              </div>
            </div>
          ))}
          {bab.length === 0 && <div className="rounded-xl border bg-white p-12 text-center text-slate-400">Belum ada bab untuk filter ini.</div>}
        </div>
      )}
    </div>
  )
}
