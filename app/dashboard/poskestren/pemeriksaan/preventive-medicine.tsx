'use client'

import { useMemo, useState, useTransition } from 'react'
import { Pill, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  addPreventiveMedicine,
  getPreventiveMedicineOptions,
  getPreventiveProgramMedicines,
} from './preventive-medicine-actions'

const inputClass = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const buttonPrimary = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50'
const buttonSecondary = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50'

type MedicineOption = {
  id: string
  name: string
  form: string
  strength: string | null
  total_stock_base: number
}

type ProgramMedicine = {
  id: string
  medicine_name: string
  form: string
  strength: string | null
  requested_quantity_base: number
  dispensed_quantity_base: number
  dosage: string | null
  notes: string | null
}

export function PreventiveMedicineButton({ programId }: { programId: string }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<MedicineOption[]>([])
  const [used, setUsed] = useState<ProgramMedicine[]>([])
  const [search, setSearch] = useState('')
  const [medicineId, setMedicineId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [dosage, setDosage] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()

  async function load() {
    try {
      const [medicineOptions, programMedicines] = await Promise.all([
        getPreventiveMedicineOptions(),
        getPreventiveProgramMedicines(programId),
      ])
      setOptions(medicineOptions)
      setUsed(programMedicines)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat stok obat.')
    }
  }

  const visibleOptions = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('id-ID')
    if (!needle) return options
    return options.filter(row => [row.name, row.form, row.strength || ''].join(' ').toLocaleLowerCase('id-ID').includes(needle))
  }, [options, search])

  function submit() {
    startTransition(async () => {
      const referenceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined
      const result = await addPreventiveMedicine({
        programId,
        medicineId,
        quantityBase: quantity,
        dosage,
        notes,
        referenceId,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Pemakaian obat preventif dicatat dan stok diperbarui.')
      setMedicineId('')
      setQuantity('1')
      setDosage('')
      setNotes('')
      await load()
    })
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); void load() }} className={buttonSecondary}>
        <Pill className="h-3.5 w-3.5" /> Catat obat
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
              <div><h2 className="text-sm font-bold text-slate-800">Pemakaian Obat Preventif</h2><p className="text-xs text-slate-500">Stok berkurang otomatis dan tercatat di kartu stok.</p></div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-800">Pemakaian disimpan sebagai transaksi PREVENTIVE. Sistem menolak jumlah yang melebihi stok tersedia.</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 sm:col-span-2"><span className="text-xs font-bold text-slate-600">Cari obat</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nama, bentuk, atau kekuatan" className={inputClass} /></label>
                <label className="space-y-1 sm:col-span-2"><span className="text-xs font-bold text-slate-600">Obat *</span><select value={medicineId} onChange={event => setMedicineId(event.target.value)} className={inputClass}><option value="">Pilih obat</option>{visibleOptions.map(row => <option key={row.id} value={row.id}>{row.name} · {row.form}{row.strength ? ` · ${row.strength}` : ''} (stok {row.total_stock_base})</option>)}</select></label>
                <label className="space-y-1"><span className="text-xs font-bold text-slate-600">Jumlah *</span><input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} className={inputClass} /></label>
                <label className="space-y-1"><span className="text-xs font-bold text-slate-600">Dosis</span><input value={dosage} onChange={event => setDosage(event.target.value)} placeholder="Contoh: 1 tablet" className={inputClass} /></label>
                <label className="space-y-1 sm:col-span-2"><span className="text-xs font-bold text-slate-600">Catatan</span><textarea value={notes} onChange={event => setNotes(event.target.value)} className={`${inputClass} min-h-20`} /></label>
              </div>
              <button type="button" disabled={pending || !medicineId} onClick={submit} className={`${buttonPrimary} w-full`}><Plus className="h-4 w-4" /> Simpan pemakaian</button>
              <div>
                <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Riwayat pemakaian program</h3>
                {used.length ? <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-left text-xs"><thead className="border-b bg-slate-50 uppercase text-slate-500"><tr><th className="px-3 py-2">Obat</th><th className="px-3 py-2">Jumlah</th><th className="px-3 py-2">Dosis</th><th className="px-3 py-2">Catatan</th></tr></thead><tbody className="divide-y divide-slate-100">{used.map(row => <tr key={row.id}><td className="px-3 py-2 font-bold">{row.medicine_name}<span className="block font-normal text-slate-500">{row.form}{row.strength ? ` · ${row.strength}` : ''}</span></td><td className="px-3 py-2">{row.dispensed_quantity_base}/{row.requested_quantity_base}</td><td className="px-3 py-2">{row.dosage || '—'}</td><td className="px-3 py-2">{row.notes || '—'}</td></tr>)}</tbody></table></div> : <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">Belum ada obat yang dicatat.</p>}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
