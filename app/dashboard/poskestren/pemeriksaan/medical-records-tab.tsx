/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  CalendarDays,
  ChevronRight,
  Edit3,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/poskestren/poskestren-shell'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { toWibDateInputValue } from '@/lib/date/wib'
import type { PoskestrenPageSize, PrescriptionDraftItem } from '@/lib/poskestren/types'

import { getMedicineOptions } from './actions'
import {
  getDiagnosisOptions,
  getDoctorsAndSessions,
  getMedicalRecordPatients,
  getPatientMedicalTimeline,
  reviseCompletedVisitFull,
} from './clinical-actions'
import {
  cleanupSampleVisits,
  getSampleCleanupCandidates,
  getSampleCleanupState,
  getVisitRevisionEditorData,
} from './revision-cleanup-actions'

const input = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

function Modal({ title, onClose, children, wide = false }: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 backdrop-blur-sm sm:items-center sm:p-4">
    <div className={`max-h-[94vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-xl ${wide ? 'sm:max-w-5xl' : 'sm:max-w-xl'}`}>
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3"><h2 className="font-black">{title}</h2><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200"><X className="h-4 w-4" /></button></div>
      <div className="max-h-[calc(94vh-56px)] overflow-y-auto p-4">{children}</div>
    </div>
  </div>
}

export function MedicalRecordsTab({ isFull }: { isFull: boolean }) {
  const today = toWibDateInputValue()
  const [filters, setFilters] = useState({
    q: '', from: `${today.slice(0, 7)}-01`, to: today, asrama: '',
    diagnosisId: '', personnelId: '', medicineId: '', status: '',
  })
  const [pageSize, setPageSize] = useState<PoskestrenPageSize>(50)
  const [result, setResult] = useState<any>({ items: [], nextCursor: null, hasMore: false })
  const [options, setOptions] = useState<any>({ diagnoses: [], doctors: [], medicines: [] })
  const [cleanupState, setCleanupState] = useState({ isAdmin: false, locked: true })
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)
  const [showCleanup, setShowCleanup] = useState(false)

  const load = useCallback(async (append = false) => {
    setLoading(true)
    try {
      const response = await getMedicalRecordPatients({
        ...filters,
        limit: pageSize,
        cursor: append ? result.nextCursor : undefined,
      })
      setResult((current: any) => ({
        ...response,
        items: append ? [...current.items, ...response.items] : response.items,
      }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat rekam kesehatan.')
    } finally { setLoading(false) }
  }, [filters, pageSize, result.nextCursor])

  useEffect(() => {
    const timer = setTimeout(() => void load(false), 250)
    return () => clearTimeout(timer)
    // result.nextCursor tidak boleh memicu reload awal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pageSize])

  useEffect(() => {
    if (!isFull) return
    void Promise.all([getDiagnosisOptions(), getDoctorsAndSessions(), getMedicineOptions(), getSampleCleanupState()])
      .then(([diagnoses, doctors, medicines, cleanup]) => {
        setOptions({ diagnoses, doctors: doctors.doctors, medicines })
        setCleanupState(cleanup)
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Gagal memuat filter rekam medis.'))
  }, [isFull])

  async function openDetail(patientId: string) {
    try { setDetail(await getPatientMedicalTimeline({ patientId, limit: 20 })) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal membuka rekam kesehatan.') }
  }

  const rows = result.items || []
  const hasFilter = Boolean(filters.q || filters.asrama || filters.diagnosisId || filters.personnelId || filters.medicineId || filters.status || filters.from || filters.to)
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="space-y-3 border-b bg-slate-50 p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_150px_150px_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={filters.q} onChange={event => setFilters(value => ({ ...value, q: event.target.value }))} placeholder="Nama, NIS, kode pasien, asrama..." className={`${input} pl-9`} /></div>
        <input type="date" value={filters.from} onChange={event => setFilters(value => ({ ...value, from: event.target.value }))} className={input} />
        <input type="date" value={filters.to} onChange={event => setFilters(value => ({ ...value, to: event.target.value }))} className={input} />
        <button onClick={() => setFilters(value => ({ ...value, from: today, to: today }))} className={filters.from === today && filters.to === today ? primary : secondary}><CalendarDays className="h-4 w-4" /> Hari Ini</button>
      </div>
      {isFull ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <input value={filters.asrama} onChange={event => setFilters(value => ({ ...value, asrama: event.target.value }))} placeholder="Asrama persis..." className={input} />
        <select value={filters.diagnosisId} onChange={event => setFilters(value => ({ ...value, diagnosisId: event.target.value }))} className={input}><option value="">Semua diagnosis</option>{options.diagnoses.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        <select value={filters.personnelId} onChange={event => setFilters(value => ({ ...value, personnelId: event.target.value }))} className={input}><option value="">Semua dokter</option>{options.doctors.map((row: any) => <option key={row.id} value={row.id}>{row.full_name}</option>)}</select>
        <select value={filters.medicineId} onChange={event => setFilters(value => ({ ...value, medicineId: event.target.value }))} className={input}><option value="">Semua obat</option>{options.medicines.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        <select value={filters.status} onChange={event => setFilters(value => ({ ...value, status: event.target.value }))} className={input}><option value="">Semua hasil</option><option value="SELESAI">Selesai/Sembuh</option><option value="DIRUJUK">Dirujuk</option></select>
      </div> : <p className="text-xs font-medium text-amber-700">Tampilan ringkas: resep, riwayat penyakit, dan catatan sensitif tidak dikirim oleh server.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select value={pageSize} onChange={event => setPageSize(event.target.value === 'all' ? 'all' : Number(event.target.value) as 20 | 50 | 100)} className="min-h-10 rounded-lg border bg-white px-3 text-sm font-bold"><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option><option value="all" disabled={!hasFilter}>Semua (maks. 1.000)</option></select>
        {cleanupState.isAdmin && !cleanupState.locked ? <button onClick={() => setShowCleanup(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-bold text-rose-700 hover:bg-rose-50"><ShieldAlert className="h-4 w-4" /> Cleanup data sampel</button> : null}
      </div>
    </div>
    {loading && rows.length === 0 ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : rows.length ? <>
      <div className="space-y-2 p-3 md:hidden">{rows.map((row: any) => <button key={row.patient_id} onClick={() => void openDetail(row.patient_id)} className="w-full rounded-lg border p-3 text-left"><div className="flex items-start gap-3"><SantriPhotoAvatar name={row.nama_lengkap} src={row.foto_url} size="sm" /><div className="min-w-0 flex-1"><p className="truncate font-bold">{row.nama_lengkap}</p><p className="text-[11px] text-slate-500">{row.poskestren_code} · {row.asrama || '—'} / {row.kamar || '—'}</p><p className="mt-1 line-clamp-1 text-xs">{row.last_complaint || '—'} · {row.last_result || row.last_status}</p><p className="mt-1 text-[10px] font-bold text-emerald-700">{row.event_count} rekaman</p></div><ChevronRight className="h-4 w-4 text-slate-400" /></div></button>)}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Santri</th><th className="px-4 py-3">Asrama / Kamar</th><th className="px-4 py-3">Terakhir</th><th className="px-4 py-3">Keluhan / Hasil</th><th className="px-4 py-3 text-center">Rekaman</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y">{rows.map((row: any) => <tr key={row.patient_id} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="flex items-center gap-3"><SantriPhotoAvatar name={row.nama_lengkap} src={row.foto_url} size="sm" /><div><p className="font-bold">{row.nama_lengkap}</p><p className="text-xs text-slate-500">{row.poskestren_code} · {row.nis}</p></div></div></td><td className="px-4 py-3">{row.asrama || '—'} / {row.kamar || '—'}</td><td className="px-4 py-3">{String(row.last_event_at).slice(0, 16).replace('T', ' ')}</td><td className="max-w-md px-4 py-3"><p>{row.last_complaint || '—'}</p><p className="text-xs text-slate-500">{row.last_result || row.last_status}</p></td><td className="px-4 py-3 text-center font-bold">{row.event_count}</td><td className="px-4 py-3 text-right"><button className={secondary} onClick={() => void openDetail(row.patient_id)}>Rekam medis</button></td></tr>)}</tbody></table></div>
      {result.hasMore && pageSize !== 'all' ? <div className="border-t p-3 text-center"><button disabled={loading} onClick={() => void load(true)} className={secondary}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Muat berikutnya</button></div> : null}
      {result.truncated ? <p className="border-t bg-amber-50 p-3 text-center text-xs font-bold text-amber-700">Hasil “Semua” dipotong pada 1.000 baris.</p> : null}
    </> : <div className="p-4"><EmptyState title="Tidak ada rekam kesehatan" description="Ubah filter atau rentang tanggal." /></div>}
    {detail ? <TimelineModal initial={detail} isFull={isFull} onClose={() => setDetail(null)} onChanged={() => void openDetail(detail.patient.patient_id)} /> : null}
    {showCleanup ? <CleanupModal onClose={() => setShowCleanup(false)} onDone={async () => { setShowCleanup(false); setCleanupState({ isAdmin: true, locked: true }); await load(false) }} /> : null}
  </section>
}

function TimelineModal({ initial, isFull, onClose, onChanged }: any) {
  const [timeline, setTimeline] = useState(initial)
  const [loadingMore, setLoadingMore] = useState(false)
  const [editor, setEditor] = useState<any>(null)
  const [loadingEditor, setLoadingEditor] = useState(false)
  const patient = timeline.patient

  async function editVisit(visitId: string) {
    setLoadingEditor(true)
    try { setEditor(await getVisitRevisionEditorData(visitId)) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal membuka editor pemeriksaan.') }
    finally { setLoadingEditor(false) }
  }
  async function loadMore() {
    setLoadingMore(true)
    try {
      const next = await getPatientMedicalTimeline({ patientId: patient.patient_id, cursor: timeline.nextCursor, limit: 20 })
      setTimeline((current: any) => ({ ...next, items: [...current.items, ...next.items] }))
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal memuat timeline berikutnya.') }
    finally { setLoadingMore(false) }
  }
  return <Modal title={`Rekam Kesehatan · ${patient.nama_lengkap}`} onClose={onClose} wide>
    <div className="space-y-4">
      <div className="flex gap-4 rounded-lg bg-slate-50 p-4"><SantriPhotoAvatar name={patient.nama_lengkap} src={patient.foto_url} size="md" /><div><p className="text-lg font-black">{patient.nama_lengkap}</p><p className="text-sm text-slate-500">{patient.poskestren_code || patient.medical_record_no} · {patient.nis}</p><p className="text-sm text-slate-500">{patient.asrama || '—'} / {patient.kamar || '—'}</p></div></div>
      {timeline.accessMode === 'FULL' ? <div className="grid gap-3 text-sm sm:grid-cols-3"><div className="rounded-lg border p-3"><b>Alergi Obat</b><p>{patient.allergies || 'Tidak ada catatan'}</p></div><div className="rounded-lg border p-3"><b>Riwayat Penyakit</b><p>{patient.special_conditions || 'Tidak ada catatan'}</p></div><div className="rounded-lg border p-3"><b>Obat Rutin</b><p>{patient.routine_medicines || 'Tidak ada catatan'}</p></div></div> : null}
      <div className="relative space-y-3 border-l-2 border-emerald-100 pl-5">{timeline.items.map((row: any) => <article key={`${row.event_type}-${row.event_id}`} className="relative rounded-lg border p-3 before:absolute before:-left-[27px] before:top-4 before:h-3 before:w-3 before:rounded-full before:bg-emerald-500"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-black">{row.event_type}</span>{isFull && row.event_type === 'PEMERIKSAAN' ? <button disabled={loadingEditor} onClick={() => void editVisit(row.event_id)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-black text-blue-700 hover:bg-blue-50"><Edit3 className="h-3 w-3" /> Edit</button> : null}</div><span className="text-xs text-slate-400">{String(row.event_at).slice(0, 16).replace('T', ' ')}</span></div><p className="mt-2 font-bold">{row.summary || '—'}</p><p className="text-sm text-slate-600">{row.result_text || row.status}</p>{row.referral_destination ? <p className="text-xs font-bold text-rose-600">Rujukan: {row.referral_destination}</p> : null}<p className="mt-1 text-xs text-slate-400">{row.personnel_name || '—'}</p></article>)}</div>
      {timeline.hasMore ? <button disabled={loadingMore} onClick={() => void loadMore()} className={`${secondary} w-full`}>{loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Muat timeline berikutnya</button> : null}
    </div>
    {editor ? <RevisionModal data={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await onChanged() }} /> : null}
  </Modal>
}

function RevisionModal({ data, onClose, onSaved }: any) {
  const [pending, startTransition] = useTransition()
  const [items, setItems] = useState<Array<PrescriptionDraftItem & { localId: string }>>(
    data.prescriptionItems.map((item: any) => ({
      localId: item.id,
      medicineId: item.medicine_id,
      requestedQuantityBase: Number(item.dispensed_quantity_base),
      dosage: item.dosage || '',
      notes: item.notes || '',
    }))
  )
  const visit = data.visit
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
    <div className="max-h-[94vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-4xl sm:rounded-xl">
      <div className="flex items-center justify-between border-b bg-blue-50 px-4 py-3"><div><h3 className="font-black">Revisi Pemeriksaan · {visit.nama_lengkap}</h3><p className="text-xs text-slate-500">{visit.queue_date} · revisi sebelumnya {visit.revision_no || 0}</p></div><button onClick={onClose} className="p-2"><X className="h-4 w-4" /></button></div>
      <form className="max-h-[calc(94vh-56px)] space-y-4 overflow-y-auto p-4" onSubmit={event => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        startTransition(async () => {
          try {
            const result = await reviseCompletedVisitFull({
              visitId: visit.id,
              reason: String(form.get('reason') || ''),
              practiceSessionId: String(form.get('practiceSessionId') || ''),
              complaint: String(form.get('complaint') || ''),
              diagnosisId: String(form.get('diagnosisId') || ''),
              treatment: String(form.get('treatment') || ''),
              followUp: String(form.get('followUp') || ''),
              referralDestination: String(form.get('referralDestination') || ''),
              referralNotes: String(form.get('referralNotes') || ''),
              prescriptionItems: items,
            })
            if (!result.success) { toast.error(result.error); return }
            toast.success('Pemeriksaan direvisi dan stok disinkronkan.')
            await onSaved()
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Revisi gagal.') }
        })
      }}>
        <label className="block text-xs font-bold text-rose-700">Alasan revisi *<textarea required name="reason" className={`${input} mt-1 min-h-20`} placeholder="Jelaskan alasan dan bagian yang dikoreksi." /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">Dokter / sesi pelayanan *<select required name="practiceSessionId" defaultValue={visit.practice_session_id || ''} className={`${input} mt-1`}><option value="">Pilih sesi</option>{data.sessions.map((row: any) => <option key={row.id} value={row.id}>{row.full_name} · {row.session_date} · {row.status}</option>)}</select></label>
          <label className="text-xs font-bold">Diagnosis *<select required name="diagnosisId" defaultValue={visit.diagnosis_id || ''} className={`${input} mt-1`}><option value="">Pilih diagnosis</option>{data.diagnoses.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="text-xs font-bold">Keluhan *<textarea required name="complaint" defaultValue={visit.complaint || ''} className={`${input} mt-1 min-h-24`} /></label>
          <label className="text-xs font-bold">Tindakan<textarea name="treatment" defaultValue={visit.treatment || ''} className={`${input} mt-1 min-h-24`} /></label>
          <label className="text-xs font-bold">Tindak lanjut<textarea name="followUp" defaultValue={visit.follow_up || ''} className={`${input} mt-1 min-h-20`} /></label>
          <div className="space-y-3"><label className="text-xs font-bold">Tujuan rujukan<input name="referralDestination" defaultValue={visit.referral_destination || ''} className={`${input} mt-1`} /></label><label className="text-xs font-bold">Catatan rujukan<input name="referralNotes" defaultValue={visit.referral_notes || ''} className={`${input} mt-1`} /></label></div>
        </div>
        <div className="rounded-lg border"><div className="flex items-center justify-between border-b bg-slate-50 p-3"><div><b>Obat yang benar-benar diberikan</b><p className="text-[11px] text-slate-500">Selisih otomatis menjadi pengeluaran atau reversal stok.</p></div><button type="button" onClick={() => setItems(rows => [...rows, { localId: crypto.randomUUID(), medicineId: '', requestedQuantityBase: 1, dosage: '' }])} className={secondary}><Plus className="h-4 w-4" /> Obat</button></div><div className="space-y-2 p-3">{items.map((item, index) => <div key={item.localId} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_120px_1fr_auto]"><select value={item.medicineId} onChange={event => setItems(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, medicineId: event.target.value } : row))} className={input}><option value="">Pilih obat</option>{data.medicines.map((medicine: any) => <option key={medicine.id} value={medicine.id}>{medicine.name} · stok {medicine.total_stock_base}</option>)}</select><input type="number" min={1} value={item.requestedQuantityBase} onChange={event => setItems(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, requestedQuantityBase: Number(event.target.value) } : row))} className={input} /><input value={item.dosage || ''} onChange={event => setItems(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, dosage: event.target.value } : row))} placeholder="Dosis" className={input} /><button type="button" onClick={() => setItems(rows => rows.filter((_, rowIndex) => rowIndex !== index))} className="rounded-lg p-3 text-rose-600"><Trash2 className="h-4 w-4" /></button></div>)}</div></div>
        {data.revisions.length ? <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-bold">Riwayat revisi ({data.revisions.length})</summary><div className="mt-2 space-y-2">{data.revisions.map((row: any) => <div key={row.revision_no} className="rounded bg-slate-50 p-2 text-xs"><b>Revisi {row.revision_no}</b> · {row.created_at} · {row.revised_by_name || '—'}<p>{row.reason}</p></div>)}</div></details> : null}
        <button disabled={pending} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />} Simpan revisi</button>
      </form>
    </div>
  </div>
}

function CleanupModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSampleCleanupCandidates(q)
      if (!result.isAdmin || result.locked) { toast.error('Cleanup tidak tersedia atau sudah dikunci.'); onClose(); return }
      setRows(result.items)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal memuat kandidat cleanup.') }
    finally { setLoading(false) }
  }, [onClose, q])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])
  return <Modal title="Cleanup Satu Kali Data Sampel" onClose={onClose} wide>
    <div className="space-y-4">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><b>Peringatan:</b> hanya pilih pemeriksaan percobaan. Obat yang pernah keluar akan direversal, lalu pemeriksaan dan resep dihapus. Setelah berhasil, fitur ini terkunci permanen.</div>
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={event => setQ(event.target.value)} placeholder="Cari nama, kode, keluhan, diagnosis..." className={`${input} pl-9`} /></div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div> : <div className="max-h-80 overflow-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100 uppercase"><tr><th className="p-2"></th><th className="p-2">Tanggal/Pasien</th><th className="p-2">Keluhan/Diagnosis</th><th className="p-2">Dokter</th><th className="p-2 text-right">Obat</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.id}><td className="p-2"><input type="checkbox" checked={selected.includes(row.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} /></td><td className="p-2"><b>{row.nama_lengkap}</b><p>{row.queue_date} · {row.poskestren_code}</p></td><td className="max-w-xs p-2">{row.complaint || '—'}<p className="text-slate-500">{row.diagnosis || row.status}</p></td><td className="p-2">{row.doctor_name || '—'}</td><td className="p-2 text-right">{row.dispensed_quantity}</td></tr>)}</tbody></table></div>}
      <textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Alasan cleanup wajib..." className={`${input} min-h-20`} />
      <label className="flex items-start gap-2 text-sm font-bold text-rose-700"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" /> Saya telah memeriksa pilihan dan memahami cleanup hanya dapat dijalankan satu kali.</label>
      <button disabled={pending || !confirmed || !reason.trim() || selected.length === 0} onClick={() => {
        if (!window.confirm(`Hapus permanen ${selected.length} data sampel dan kunci fitur cleanup?`)) return
        startTransition(async () => {
          try {
            const result = await cleanupSampleVisits({ visitIds: selected, reason })
            if (!result.success) { toast.error(result.error); return }
            toast.success(`${result.deleted} data sampel dibersihkan. Cleanup kini dikunci.`)
            await onDone()
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Cleanup gagal.') }
        })
      }} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 font-bold text-white hover:bg-rose-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} Cleanup dan kunci</button>
    </div>
  </Modal>
}
