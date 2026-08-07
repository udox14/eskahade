/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Pencil, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import { getDiagnosisOptions, saveDiagnosis } from './clinical-actions'

const input = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

export function DiagnosisManagerButton({ onChanged }: { onChanged?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await getDiagnosisOptions()) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal memuat diagnosis.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (open) void load() }, [load, open])

  return <>
    <button type="button" onClick={() => setOpen(true)} className={`${secondary} mt-2 w-full`}><Plus className="h-4 w-4" /> Kelola diagnosis</button>
    {open ? createPortal(<div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/45 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-2xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3"><h3 className="font-black">Master Diagnosis</h3><button onClick={() => setOpen(false)} className="p-2"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[calc(90vh-56px)] space-y-4 overflow-y-auto p-4">
          <form className="flex gap-2" onSubmit={event => {
            event.preventDefault()
            startTransition(async () => {
              try {
                const result = await saveDiagnosis({ id: editing?.id, name })
                if (!result.success) { toast.error(result.error); return }
                toast.success(editing ? 'Diagnosis diperbarui.' : 'Diagnosis ditambahkan.')
                setEditing(null); setName(''); await load(); await onChanged?.()
              } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan diagnosis.') }
            })
          }}>
            <input required value={name} onChange={event => setName(event.target.value)} placeholder="Nama diagnosis..." className={input} />
            <button disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 font-bold text-white disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan</button>
          </form>
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div> : rows.length ? <>
            <div className="space-y-2 md:hidden">{rows.map(row => <button key={row.id} onClick={() => { setEditing(row); setName(row.name) }} className="flex w-full items-center justify-between rounded-lg border p-3 text-left"><span className="font-bold">{row.name}</span><Pencil className="h-4 w-4 text-slate-400" /></button>)}</div>
            <div className="hidden overflow-hidden rounded-lg border md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase"><tr><th className="px-4 py-3">Diagnosis</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.id}><td className="px-4 py-3 font-bold">{row.name}</td><td className="px-4 py-3 text-right"><button onClick={() => { setEditing(row); setName(row.name) }} className={secondary}><Pencil className="h-4 w-4" /> Edit</button></td></tr>)}</tbody></table></div>
          </> : <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Master diagnosis masih kosong.</p>}
        </div>
      </div>
    </div>, document.body) : null}
  </>
}
