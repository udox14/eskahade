/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Check, Loader2, Package, Search } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/poskestren/poskestren-shell'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { toWibDateInputValue } from '@/lib/date/wib'
import type { PoskestrenPageSize } from '@/lib/poskestren/types'

import { deliverVisitMedicines, getDeliveryQueue, getVisitPrescriptionForDelivery } from './actions'

const input = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50'

export function MedicineDeliveryTab() {
  const today = toWibDateInputValue()
  const [date, setDate] = useState(today)
  const [q, setQ] = useState('')
  const [pageSize, setPageSize] = useState<PoskestrenPageSize>(50)
  const [result, setResult] = useState<any>({ items: [], nextCursor: null, hasMore: false })
  const [loading, setLoading] = useState(true)
  const [deliverVisit, setDeliverVisit] = useState<any>(null)

  const load = useCallback(async (append = false) => {
    setLoading(true)
    try {
      const response = await getDeliveryQueue({
        date,
        q,
        limit: pageSize,
        cursor: append ? result.nextCursor : undefined,
      })
      setResult((current: any) => ({
        ...response,
        items: append ? [...current.items, ...response.items] : response.items,
      }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat antrean penyerahan obat.')
    } finally {
      setLoading(false)
    }
  }, [date, pageSize, q, result.nextCursor])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
    // result.nextCursor tidak boleh memicu reload awal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, pageSize, q])

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-slate-50/50 p-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-bold text-slate-900">Penyerahan Obat</h2>
          <p className="text-xs text-slate-500">Obat hanya keluar (mengurangi stok) setelah diserahkan petugas di sini.</p>
        </div>
      </div>
      <div className="grid gap-3 border-b bg-slate-50/70 p-4 md:grid-cols-[160px_1fr_auto]">
        <input type="date" value={date} onChange={event => setDate(event.target.value)} className={input} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={event => setQ(event.target.value)} placeholder="Pasien, NIS, asrama, diagnosis, keluhan..." className={`${input} pl-9`} />
        </div>
        <select value={pageSize} onChange={event => setPageSize(event.target.value === 'all' ? 'all' : Number(event.target.value) as 20 | 50 | 100)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600">
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value="all" disabled={!q}>Semua (maks. 1.000)</option>
        </select>
      </div>
      {loading && !result.items.length ? (
        <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : result.items.length ? (
        <>
          <div className="divide-y divide-slate-100 md:hidden">
            {result.items.map((visit: any) => (
              <article key={visit.id} className="p-3">
                <div className="flex gap-3">
                  <SantriPhotoAvatar name={visit.nama_lengkap} src={visit.foto_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{visit.nama_lengkap}</p>
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-amber-100 px-1.5 text-xs font-black text-amber-700">{visit.queue_number}</span>
                    </div>
                    <p className="text-xs text-slate-500">{visit.nis} · {visit.asrama || '—'} / {visit.kamar || '—'}</p>
                    {visit.allergies ? <p className="text-xs font-bold text-rose-600">Alergi Obat: {visit.allergies}</p> : null}
                    <p className="mt-1 text-xs text-slate-700">{visit.diagnosis || visit.complaint || 'Belum ada keluhan'}</p>
                    {visit.prescription_summary ? <p className="mt-1 text-[11px] text-emerald-700">Resep: {visit.prescription_summary}</p> : <p className="mt-1 text-[11px] text-slate-400">Tanpa resep obat</p>}
                  </div>
                </div>
                <button onClick={() => setDeliverVisit(visit)} className={`${primary} mt-3 w-full`}><Package className="h-4 w-4" /> Serahkan obat</button>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">Antrean</th>
                  <th className="px-4 py-3 font-bold">Pasien</th>
                  <th className="px-4 py-3 font-bold">Dokter</th>
                  <th className="px-4 py-3 font-bold">Keluhan / Diagnosis</th>
                  <th className="px-4 py-3 font-bold">Resep</th>
                  <th className="px-4 py-3 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((visit: any) => (
                  <tr key={visit.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3"><span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-amber-100 px-2 font-black text-amber-700">{visit.queue_number}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <SantriPhotoAvatar name={visit.nama_lengkap} src={visit.foto_url} size="sm" />
                        <div>
                          <p className="font-bold">{visit.nama_lengkap}</p>
                          <p className="text-xs text-slate-500">{visit.nis} · {visit.asrama || '—'} / {visit.kamar || '—'}</p>
                          {visit.allergies ? <p className="text-xs font-bold text-rose-600">Alergi Obat: {visit.allergies}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{visit.doctor_name || '—'}</td>
                    <td className="max-w-sm px-4 py-3 text-slate-700">{visit.diagnosis || visit.complaint || 'Belum ada keluhan'}</td>
                    <td className="max-w-xs px-4 py-3 text-xs text-emerald-700">{visit.prescription_summary || 'Tanpa resep obat'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDeliverVisit(visit)} className={primary}><Package className="h-4 w-4" /> Serahkan obat</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.hasMore && pageSize !== 'all' ? <div className="border-t p-3 text-center"><button disabled={loading} onClick={() => void load(true)} className={secondary}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Muat berikutnya</button></div> : null}
          {result.truncated ? <p className="border-t bg-amber-50 p-3 text-center text-xs font-bold text-amber-700">Hasil “Semua” dipotong pada 1.000 baris.</p> : null}
        </>
      ) : (
        <div className="p-4"><EmptyState title="Tidak ada obat menunggu penyerahan" description="Resep dokter yang belum diserahkan akan muncul di sini." /></div>
      )}
      {deliverVisit ? <DeliveryModal visit={deliverVisit} onClose={() => setDeliverVisit(null)} onSaved={() => { setDeliverVisit(null); void load() }} /> : null}
    </section>
  )
}

function DeliveryModal({ visit, onClose, onSaved }: { visit: any; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    void getVisitPrescriptionForDelivery(visit.id)
      .then(response => {
        setData(response)
        if (response) {
          setQty(Object.fromEntries(response.items.map((item: any) => [item.medicine_id, Number(item.requested_quantity_base)])))
        }
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Gagal memuat resep.'))
      .finally(() => setLoading(false))
  }, [visit.id])

  function submit() {
    if (!data) return
    startTransition(async () => {
      try {
        const result = await deliverVisitMedicines({
          visitId: data.visit.id,
          items: data.items.map((item: any) => ({ medicineId: item.medicine_id, quantity: Number(qty[item.medicine_id] ?? 0) })),
        })
        if (!result.success) { toast.error(result.error); return }
        toast.success('Obat diserahkan. Stok otomatis terpotong.')
        onSaved()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Penyerahan obat gagal.')
      }
    })
  }

  const items = data?.items || []
  const total = items.reduce((sum: number, item: any) => sum + (Number(qty[item.medicine_id] ?? 0) || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-slate-50 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Penyerahan Obat · {visit.nama_lengkap}</h2>
            <p className="text-xs text-slate-500">Antrean {visit.queue_number} · {visit.medical_record_no} · Dokter {visit.doctor_name || '—'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">Tutup</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !data ? (
            <p className="py-8 text-center text-sm text-slate-500">Resep tidak ditemukan atau kunjungan sudah tidak menunggu obat.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div><span className="text-xs font-bold text-slate-400">Keluhan</span><p className="font-semibold">{data.visit.complaint || '—'}</p></div>
                  <div><span className="text-xs font-bold text-slate-400">Diagnosis</span><p className="font-semibold">{data.visit.diagnosis || '—'}</p></div>
                  <div><span className="text-xs font-bold text-slate-400">Tanda vital</span><p className="font-semibold">Suhu {data.visit.temperature_celsius ?? '—'}°C · TD {data.visit.systolic_pressure ?? '—'}/{data.visit.diastolic_pressure ?? '—'} · BB {data.visit.weight_kg ?? '—'} kg</p></div>
                </div>
                {data.visit.referral_destination ? <p className="text-xs font-bold text-rose-600">Rujukan: {data.visit.referral_destination}</p> : null}
              </div>
              {items.length ? (
                <div className="space-y-3">
                  {items.map((item: any) => {
                    const stock = Number(item.total_stock_base)
                    const value = Number(qty[item.medicine_id] ?? 0)
                    return (
                      <div key={item.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_130px]">
                        <div>
                          <p className="font-bold">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.dosage || 'Tanpa dosis'} · resep {item.requested_quantity_base} {item.base_unit} · stok {stock} {item.base_unit}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={value}
                            onChange={event => setQty(rows => ({ ...rows, [item.medicine_id]: Number(event.target.value) }))}
                            className={input}
                          />
                          <span className="text-xs font-bold text-slate-500">{item.base_unit}</span>
                        </div>
                        {value > stock ? <p className="text-xs font-bold text-rose-600 sm:col-span-2">Melebihi stok tersedia ({stock}).</p> : null}
                      </div>
                    )
                  })}
                  <p className="text-right text-xs text-slate-500">Total diserahkan: <b>{total} {items[0]?.base_unit || 'unit'}</b></p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                  <Package className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-bold text-slate-600">Tanpa resep obat</p>
                  <p className="text-xs text-slate-400">Dokter tidak meresepkan obat untuk kunjungan ini.</p>
                </div>
              )}
              <button disabled={pending} onClick={submit} className={`${primary} w-full`}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {items.length ? 'Serahkan obat & selesaikan' : 'Serahkan tanpa obat'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
