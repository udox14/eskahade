/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Activity,
  CalendarDays,
  Check,
  ClipboardList,
  History,
  Hospital,
  Loader2,
  Plus,
  Search,
  Stethoscope,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { EmptyState, MetricCard, PoskestrenTabs } from '@/components/poskestren/poskestren-shell'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { toWibDateInputValue } from '@/lib/date/wib'
import type { PoskestrenPageSize, PrescriptionDraftItem } from '@/lib/poskestren/types'

import {
  beginVisit,
  cancelVisit,
  closePracticeSession,
  completeVisit,
  createPatient,
  createPreventiveProgram,
  createPreventiveType,
  getExaminationHistory,
  getMedicineOptions,
  getMyPracticeSession,
  getPatients,
  getPreventiveData,
  getPreventiveParticipants,
  getSickCandidates,
  getVisits,
  importSickEpisode,
  registerManualVisit,
  reviseCompletedVisit,
  searchActiveSantri,
  searchPreventiveTargets,
  startPracticeSession,
  updatePatient,
  updatePreventiveParticipant,
  updatePreventiveStatus,
} from './actions'

type Tab = 'pasien' | 'hari-ini' | 'pemeriksaan' | 'preventif'

const TABS = [
  { value: 'pasien' as const, label: 'Daftar Pasien', icon: UserPlus },
  { value: 'hari-ini' as const, label: 'Pasien Hari Ini', icon: CalendarDays },
  { value: 'pemeriksaan' as const, label: 'Data Pemeriksaan', icon: History },
  { value: 'preventif' as const, label: 'Preventif', icon: Activity },
]

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`))
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const buttonPrimary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
const buttonSecondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50'

function PageSizeSelect({
  value,
  onChange,
  hasFilter,
}: {
  value: PoskestrenPageSize
  onChange: (value: PoskestrenPageSize) => void
  hasFilter: boolean
}) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value === 'all' ? 'all' : Number(event.target.value) as 20 | 50 | 100)}
      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600"
    >
      <option value={20}>20</option>
      <option value={50}>50</option>
      <option value={100}>100</option>
      <option value="all" disabled={!hasFilter}>Semua (maks. 1.000)</option>
    </select>
  )
}

export default function PoskestrenPemeriksaanContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get('tab') as Tab | null
  const [activeTab, setActiveTab] = useState<Tab>(TABS.some(tab => tab.value === initialTab) ? initialTab! : 'pasien')

  function changeTab(tab: Tab) {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`/dashboard/poskestren/pemeriksaan?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <DashboardPageHeader
        title="Pemeriksaan"
        description="Registrasi profil medis, antrean harian, pemeriksaan, dan program preventif santri."
        className="border-b pb-4"
      />
      <PoskestrenTabs tabs={TABS} active={activeTab} onChange={changeTab} />
      {activeTab === 'pasien' ? <PatientTab /> : null}
      {activeTab === 'hari-ini' ? <TodayTab /> : null}
      {activeTab === 'pemeriksaan' ? <HistoryTab /> : null}
      {activeTab === 'preventif' ? <PreventiveTab /> : null}
    </div>
  )
}

function PatientTab() {
  const [queryText, setQueryText] = useState('')
  const [pageSize, setPageSize] = useState<PoskestrenPageSize>(20)
  const [patientResult, setPatientResult] = useState<any>({ items: [], nextCursor: null, hasMore: false, truncated: false })
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showSick, setShowSick] = useState(false)
  const [santriQuery, setSantriQuery] = useState('')
  const [santriRows, setSantriRows] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [editingPatient, setEditingPatient] = useState<any>(null)
  const [pending, startTransition] = useTransition()

  const load = useCallback(async (cursor = '') => {
    setLoading(true)
    try {
      const patients = await getPatients({ q: queryText, limit: pageSize, cursor })
      setPatientResult((previous: any) => cursor
        ? { ...patients, items: [...previous.items, ...patients.items] }
        : patients
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat pasien.')
    } finally {
      setLoading(false)
    }
  }, [pageSize, queryText])

  function openSickModal() {
    setShowSick(true)
  }

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (santriQuery.trim().length < 2) {
      setSantriRows([])
      return
    }
    const timer = setTimeout(async () => setSantriRows(await searchActiveSantri(santriQuery)), 250)
    return () => clearTimeout(timer)
  }, [santriQuery])

  function submitPatient(formData: FormData) {
    if (!selectedSantri) { toast.error('Pilih santri terlebih dahulu.'); return }
    startTransition(async () => {
      const result = await createPatient({
        santriId: selectedSantri.id,
        bloodType: String(formData.get('bloodType') || ''),
        allergies: String(formData.get('allergies') || ''),
        specialConditions: String(formData.get('specialConditions') || ''),
        routineMedicines: String(formData.get('routineMedicines') || ''),
        emergencyContact: String(formData.get('emergencyContact') || ''),
        notes: String(formData.get('notes') || ''),
      })
      if (!result.success) { toast.error(result.error); return }
      toast.success('Profil pasien dibuat.')
      setShowAdd(false)
      setSelectedSantri(null)
      setSantriQuery('')
      await load()
    })
  }

  function addVisit(patient: any) {
    startTransition(async () => {
      const result = await registerManualVisit({ patientId: patient.id })
      if (!result.success) { toast.error(result.error); return }
      toast.success(`${patient.nama_lengkap} masuk antrean hari ini.`)
    })
  }

  function submitPatientUpdate(formData: FormData) {
    if (!editingPatient) return
    startTransition(async () => {
      const result = await updatePatient({
        id: editingPatient.id,
        bloodType: String(formData.get('bloodType') || ''),
        allergies: String(formData.get('allergies') || ''),
        specialConditions: String(formData.get('specialConditions') || ''),
        routineMedicines: String(formData.get('routineMedicines') || ''),
        emergencyContact: String(formData.get('emergencyContact') || ''),
        notes: String(formData.get('notes') || ''),
      })
      if (!result.success) { toast.error(result.error); return }
      toast.success('Profil medis diperbarui.')
      setEditingPatient(null)
      await load()
    })
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Profil Pasien</h2>
            <p className="text-xs text-slate-500">Satu profil medis untuk setiap santri.</p>
          </div>
          <div className="flex gap-2">
            <button className={buttonSecondary} onClick={() => void openSickModal()}>
              <Hospital className="h-4 w-4" /> Data Sakit
            </button>
            <button className={buttonPrimary} onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> Daftar pasien
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 bg-slate-50/70 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={queryText} onChange={event => setQueryText(event.target.value)} placeholder="Nama, NIS, nomor RM, asrama, kamar..." className={`${inputClass} pl-9`} />
          </div>
          <PageSizeSelect value={pageSize} onChange={setPageSize} hasFilter={Boolean(queryText)} />
        </div>
        {patientResult.truncated ? <p className="border-t bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700">Hasil “Semua” dibatasi 1.000 baris. Gunakan filter yang lebih spesifik.</p> : null}
        {loading && !patientResult.items.length ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : patientResult.items.length ? (
          <>
            <div className="grid gap-3 p-3 md:hidden">
              {patientResult.items.map((patient: any) => (
                <article key={patient.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex gap-3">
                    <SantriPhotoAvatar name={patient.nama_lengkap} src={patient.foto_url} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{patient.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{patient.medical_record_no} · {patient.nis}</p>
                      <p className="text-xs text-slate-500">{patient.asrama || '—'} / {patient.kamar || '—'}</p>
                    </div>
                  </div>
                  <button disabled={pending || patient.status_global !== 'aktif'} onClick={() => addVisit(patient)} className={`${buttonSecondary} mt-3 w-full`}>
                    <ClipboardList className="h-4 w-4" /> Masuk antrean
                  </button>
                  <button onClick={() => setEditingPatient(patient)} className={`${buttonSecondary} mt-2 w-full`}>
                    Edit profil medis
                  </button>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <tr><th className="px-4 py-3 font-bold">Pasien</th><th className="px-4 py-3 font-bold">Asrama</th><th className="px-4 py-3 font-bold">Alergi/Kondisi</th><th className="px-4 py-3 text-right font-bold">Aksi</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patientResult.items.map((patient: any) => (
                    <tr key={patient.id}>
                      <td className="px-4 py-3"><p className="font-bold">{patient.nama_lengkap}</p><p className="text-xs text-slate-500">{patient.medical_record_no} · {patient.nis}</p></td>
                      <td className="px-4 py-3 text-slate-600">{patient.asrama || '—'} / {patient.kamar || '—'}</td>
                      <td className="max-w-sm px-4 py-3 text-xs text-slate-600">{patient.allergies || patient.special_conditions || 'Tidak ada catatan'}</td>
                      <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => setEditingPatient(patient)} className={buttonSecondary}>Edit medis</button><button disabled={pending || patient.status_global !== 'aktif'} onClick={() => addVisit(patient)} className={buttonSecondary}>Masuk antrean</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      {patientResult.hasMore ? <div className="border-t p-3 text-center"><button onClick={() => void load(patientResult.nextCursor)} className={buttonSecondary}>Muat berikutnya</button></div> : null}
        </>
        ) : <EmptyState title="Belum ada profil pasien" description="Daftarkan santri aktif sebagai pasien POSKESTREN." />}
      </section>

      {showSick ? (
        <SickCandidatesModal
          pending={pending}
          onClose={() => setShowSick(false)}
          onImport={(row) => startTransition(async () => {
            try {
              const result = await importSickEpisode({ episodeId: row.episode_id, absenSakitId: row.absen_sakit_id })
              if (!result.success) { toast.error(result.error); return }
              toast.success(`${row.nama_lengkap} berhasil diimpor ke antrean POSKESTREN.`)
              setShowSick(false)
              await load()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Gagal mengimpor episode.')
            }
          })}
        />
      ) : null}

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-slate-50 px-5 py-4">
              <div><h2 className="text-sm font-bold text-slate-800">Daftar Pasien Baru</h2><p className="text-xs text-slate-500">Identitas diambil dari master santri aktif.</p></div>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700">Tutup</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <form action={submitPatient} className="space-y-4">
              <Field label="Cari santri">
                <input value={santriQuery} onChange={event => { setSantriQuery(event.target.value); setSelectedSantri(null) }} placeholder="Minimal 2 karakter..." className={inputClass} />
              </Field>
              {santriRows.length && !selectedSantri ? (
                <div className="max-h-52 overflow-y-auto rounded-xl border">
                  {santriRows.map(row => (
                    <button type="button" key={row.id} disabled={row.has_patient === 1} onClick={() => { setSelectedSantri(row); setSantriQuery(row.nama_lengkap) }} className="flex w-full items-center justify-between border-b px-3 py-3 text-left last:border-0 hover:bg-emerald-50 disabled:bg-slate-50 disabled:text-slate-400">
                      <span><strong className="block text-sm">{row.nama_lengkap}</strong><span className="text-xs">{row.nis} · {row.asrama || '—'} / {row.kamar || '—'}</span></span>
                      {row.has_patient ? <span className="text-xs font-bold">Sudah terdaftar</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedSantri ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm"><strong>{selectedSantri.nama_lengkap}</strong><p className="text-xs text-emerald-700">{selectedSantri.nis} · {selectedSantri.asrama || '—'} / {selectedSantri.kamar || '—'}</p></div> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Golongan darah"><input name="bloodType" maxLength={4} className={inputClass} /></Field>
                <Field label="Kontak darurat"><input name="emergencyContact" className={inputClass} /></Field>
                <Field label="Alergi"><textarea name="allergies" className={`${inputClass} min-h-24`} /></Field>
                <Field label="Kondisi khusus"><textarea name="specialConditions" className={`${inputClass} min-h-24`} /></Field>
                <Field label="Obat rutin"><textarea name="routineMedicines" className={`${inputClass} min-h-24`} /></Field>
                <Field label="Catatan"><textarea name="notes" className={`${inputClass} min-h-24`} /></Field>
              </div>
              <button disabled={pending || !selectedSantri} className={`${buttonPrimary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan profil</button>
            </form>
            </div>
          </div>
        </div>
      ) : null}

      {editingPatient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-slate-50 px-5 py-4">
              <div><h2 className="text-sm font-bold text-slate-800">Edit Profil Medis</h2><p className="text-xs text-slate-500">{editingPatient.nama_lengkap} · {editingPatient.medical_record_no}</p></div>
              <button onClick={() => setEditingPatient(null)} className="text-slate-400 hover:text-slate-700">Tutup</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <form action={submitPatientUpdate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Golongan darah"><input name="bloodType" maxLength={4} defaultValue={editingPatient.blood_type || ''} className={inputClass} /></Field>
                <Field label="Kontak darurat"><input name="emergencyContact" defaultValue={editingPatient.emergency_contact || ''} className={inputClass} /></Field>
                <Field label="Alergi"><textarea name="allergies" defaultValue={editingPatient.allergies || ''} className={`${inputClass} min-h-24`} /></Field>
                <Field label="Kondisi khusus"><textarea name="specialConditions" defaultValue={editingPatient.special_conditions || ''} className={`${inputClass} min-h-24`} /></Field>
                <Field label="Obat rutin"><textarea name="routineMedicines" defaultValue={editingPatient.routine_medicines || ''} className={`${inputClass} min-h-24`} /></Field>
                <Field label="Catatan"><textarea name="notes" defaultValue={editingPatient.notes || ''} className={`${inputClass} min-h-24`} /></Field>
              </div>
              <button disabled={pending} className={`${buttonPrimary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan perubahan</button>
            </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SickCandidatesModal({
  pending,
  onClose,
  onImport,
}: {
  pending: boolean
  onClose: () => void
  onImport: (row: any) => void
}) {
  const [filters, setFilters] = useState({ q: '', gender: '', asrama: '', dateFrom: '', dateTo: '' })
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sick = await getSickCandidates(filters)
      setRows(sick)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat data sakit.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
  }, [load])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-slate-50 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-rose-900">Kandidat dari Data Sakit Asrama</h2>
            <p className="text-xs text-rose-600">Impor satu arah; status Data Sakit tidak akan berubah.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">Tutup</button>
        </div>
        <div className="flex flex-col gap-3 border-b bg-slate-50/70 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filters.q} onChange={event => setFilters(v => ({ ...v, q: event.target.value }))} placeholder="Nama, NIS, keluhan..." className={`${inputClass} pl-9`} />
          </div>
          <select className={inputClass} value={filters.gender} onChange={e => setFilters(v => ({ ...v, gender: e.target.value }))}>
            <option value="">Semua gender</option><option value="L">Putra</option><option value="P">Putri</option>
          </select>
          <input className={inputClass} value={filters.asrama} onChange={e => setFilters(v => ({ ...v, asrama: e.target.value }))} placeholder="Asrama..." />
          <input type="date" className={inputClass} value={filters.dateFrom} onChange={e => setFilters(v => ({ ...v, dateFrom: e.target.value }))} />
          <input type="date" className={inputClass} value={filters.dateTo} onChange={e => setFilters(v => ({ ...v, dateTo: e.target.value }))} />
        </div>
        <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Hospital className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-bold text-slate-500">Tidak ada episode aktif</p>
            <p className="mt-1 text-xs text-slate-400">Semua santri sakit sudah diimpor atau belum ada yang sakit saat ini.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map(row => (
                <div key={row.episode_id} className="flex flex-col gap-3 p-4">
                  <div className="flex-1">
                    <p className="font-bold">{row.nama_lengkap}</p>
                    <p className="text-xs text-slate-500">{row.nis} · {row.asrama || '—'} / {row.kamar || '—'}</p>
                    <p className="mt-1 text-sm font-medium text-rose-700">{row.sakit_apa || 'Keluhan belum dirinci'}</p>
                    {row.mulai_at ? <p className="text-xs text-slate-400">Sejak: {row.mulai_at.slice(0, 10)}</p> : null}
                  </div>
                  <button
                    disabled={pending}
                    onClick={() => onImport(row)}
                    className={buttonPrimary}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Impor ke antrean
                  </button>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Santri</th>
                    <th className="px-4 py-3 font-bold">Asrama / Kamar</th>
                    <th className="px-4 py-3 font-bold">Keluhan</th>
                    <th className="px-4 py-3 font-bold">Sejak</th>
                    <th className="px-4 py-3 text-right font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => (
                    <tr key={row.episode_id} className="hover:bg-rose-50/40">
                      <td className="px-4 py-3"><p className="font-bold">{row.nama_lengkap}</p><p className="text-xs text-slate-500">{row.nis}</p></td>
                      <td className="px-4 py-3 text-slate-600">{row.asrama || '—'} / {row.kamar || '—'}</td>
                      <td className="max-w-xs px-4 py-3 font-medium text-rose-700">{row.sakit_apa || 'Keluhan belum dirinci'}</td>
                      <td className="px-4 py-3 text-slate-500">{row.mulai_at ? row.mulai_at.slice(0, 10) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          disabled={pending}
                          onClick={() => onImport(row)}
                          className={buttonPrimary}
                        >
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Impor
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t bg-rose-50/50 px-4 py-3">
              <p className="text-xs text-rose-700">{rows.length} episode sakit aktif belum diimpor. Impor akan otomatis mendaftarkan profil pasien jika belum ada.</p>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}

function TodayTab() {
  const [date, setDate] = useState(toWibDateInputValue())
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [pageSize, setPageSize] = useState<PoskestrenPageSize>(50)
  const [result, setResult] = useState<any>({ items: [] })
  const [practice, setPractice] = useState<any>({ personnel: null, practice: null })
  const [medicines, setMedicines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [examVisit, setExamVisit] = useState<any>(null)
  const [prescription, setPrescription] = useState<Array<PrescriptionDraftItem & { localId: string }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [visits, currentPractice, medicineRows] = await Promise.all([
        getVisits({ date, q, status, limit: pageSize }),
        getMyPracticeSession(),
        getMedicineOptions(),
      ])
      setResult(visits)
      setPractice(currentPractice)
      setMedicines(medicineRows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat antrean.')
    } finally {
      setLoading(false)
    }
  }, [date, pageSize, q, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  function run(action: () => Promise<any>, success: string) {
    startTransition(async () => {
      const response = await action()
      if (!response.success) { toast.error(response.error); return }
      toast.success(success)
      await load()
    })
  }

  const counts = useMemo(() => {
    const items = result.items || []
    return {
      total: items.length,
      waiting: items.filter((item: any) => item.status === 'MENUNGGU').length,
      active: items.filter((item: any) => item.status === 'DIPERIKSA').length,
      done: items.filter((item: any) => item.status === 'SELESAI' || item.status === 'DIRUJUK').length,
    }
  }, [result.items])

  function submitExam(formData: FormData) {
    if (!examVisit) return
    run(
      () => completeVisit({
        visitId: examVisit.id,
        complaint: String(formData.get('complaint') || ''),
        diagnosis: String(formData.get('diagnosis') || ''),
        treatment: String(formData.get('treatment') || ''),
        followUp: String(formData.get('followUp') || ''),
        referralDestination: String(formData.get('referralDestination') || ''),
        referralNotes: String(formData.get('referralNotes') || ''),
        prescriptionItems: prescription,
      }),
      'Pemeriksaan diselesaikan.'
    )
    setExamVisit(null)
    setPrescription([])
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Antrean tampil" value={counts.total} detail={date} />
        <MetricCard label="Menunggu" value={counts.waiting} tone="amber" />
        <MetricCard label="Diperiksa" value={counts.active} tone="blue" />
        <MetricCard label="Selesai/rujuk" value={counts.done} tone="slate" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        {practice.personnel ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">{practice.personnel.full_name}</p>
              <p className="text-xs text-slate-500">{practice.practice ? `Sesi dibuka ${formatDateTime(practice.practice.started_at)}` : 'Belum ada sesi praktik aktif.'}</p>
            </div>
            {practice.practice
              ? <button disabled={pending} onClick={() => run(() => closePracticeSession(practice.practice.id), 'Sesi praktik ditutup.')} className={buttonSecondary}>Tutup sesi</button>
              : <button disabled={pending} onClick={() => run(() => startPracticeSession(), 'Sesi praktik dibuka.')} className={buttonPrimary}><Stethoscope className="h-4 w-4" /> Mulai praktik</button>}
          </div>
        ) : <p className="text-sm text-amber-700">Akun ini belum ditautkan ke tenaga medis. Pendaftaran antrean tetap tersedia, tetapi pemeriksaan membutuhkan tautan pada menu Manajemen.</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b bg-slate-50/50 p-4 md:grid-cols-[160px_1fr_180px_auto]">
          <input type="date" value={date} onChange={event => setDate(event.target.value)} className={inputClass} />
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={event => setQ(event.target.value)} placeholder="Pasien, NIS, asrama, diagnosis..." className={`${inputClass} pl-9`} /></div>
          <select value={status} onChange={event => setStatus(event.target.value)} className={inputClass}><option value="">Semua status</option>{['MENUNGGU','DIPERIKSA','SELESAI','DIRUJUK','BATAL'].map(value => <option key={value}>{value}</option>)}</select>
          <PageSizeSelect value={pageSize} onChange={setPageSize} hasFilter={Boolean(q || status || date)} />
        </div>
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : result.items.length ? (
          <>
          <div className="divide-y divide-slate-100 md:hidden">
            {result.items.map((visit: any) => (
              <article key={visit.id} className="flex flex-col gap-2 p-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-black text-emerald-700">{visit.queue_number}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{visit.nama_lengkap}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${visit.status === 'MENUNGGU' ? 'bg-amber-100 text-amber-700' : visit.status === 'DIPERIKSA' ? 'bg-blue-100 text-blue-700' : visit.status === 'BATAL' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{visit.status}</span>{visit.source_type === 'DATA_SAKIT' ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">DATA SAKIT</span> : null}</div>
                  <p className="text-xs text-slate-500">{visit.nis} · {visit.asrama || '—'} / {visit.kamar || '—'} · {visit.medical_record_no}</p>
                  <p className="mt-1 text-sm text-slate-700">{visit.diagnosis || visit.complaint || 'Belum ada keluhan'}</p>
                  {visit.allergies ? <p className="mt-1 text-xs font-bold text-rose-600">Alergi: {visit.allergies}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {visit.status === 'MENUNGGU' && practice.practice ? <button disabled={pending} onClick={() => run(() => beginVisit(visit.id), 'Pemeriksaan dimulai.')} className={buttonPrimary}>Periksa</button> : null}
                  {visit.status === 'DIPERIKSA' ? <button onClick={() => { setExamVisit(visit); setPrescription([]) }} className={buttonPrimary}>Isi pemeriksaan</button> : null}
                  {['MENUNGGU','DIPERIKSA'].includes(visit.status) ? <button disabled={pending} onClick={() => { const reason = window.prompt('Alasan pembatalan:'); if (reason) run(() => cancelVisit(visit.id, reason), 'Kunjungan dibatalkan.') }} className={buttonSecondary}>Batal</button> : null}
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">Antrean</th>
                  <th className="px-4 py-3 font-bold">Pasien</th>
                  <th className="px-4 py-3 font-bold">Status / Sumber</th>
                  <th className="px-4 py-3 font-bold">Keluhan / Diagnosis</th>
                  <th className="px-4 py-3 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((visit: any) => (
                  <tr key={visit.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3"><span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-emerald-100 px-2 font-black text-emerald-700">{visit.queue_number}</span></td>
                    <td className="px-4 py-3"><p className="font-bold">{visit.nama_lengkap}</p><p className="text-xs text-slate-500">{visit.nis} · {visit.asrama || '—'} / {visit.kamar || '—'}</p>{visit.allergies ? <p className="text-xs font-bold text-rose-600">Alergi: {visit.allergies}</p> : null}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${visit.status === 'MENUNGGU' ? 'bg-amber-100 text-amber-700' : visit.status === 'DIPERIKSA' ? 'bg-blue-100 text-blue-700' : visit.status === 'BATAL' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{visit.status}</span>{visit.source_type === 'DATA_SAKIT' ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">DATA SAKIT</span> : null}</div></td>
                    <td className="max-w-md px-4 py-3 text-slate-700">{visit.diagnosis || visit.complaint || 'Belum ada keluhan'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {visit.status === 'MENUNGGU' && practice.practice ? <button disabled={pending} onClick={() => run(() => beginVisit(visit.id), 'Pemeriksaan dimulai.')} className={buttonPrimary}>Periksa</button> : null}
                        {visit.status === 'DIPERIKSA' ? <button onClick={() => { setExamVisit(visit); setPrescription([]) }} className={buttonPrimary}>Isi pemeriksaan</button> : null}
                        {['MENUNGGU','DIPERIKSA'].includes(visit.status) ? <button disabled={pending} onClick={() => { const reason = window.prompt('Alasan pembatalan:'); if (reason) run(() => cancelVisit(visit.id, reason), 'Kunjungan dibatalkan.') }} className={buttonSecondary}>Batal</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : <EmptyState title="Antrean kosong" description="Belum ada pasien pada tanggal dan filter ini." />}
      </section>

      {examVisit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-slate-50 px-5 py-4">
              <div><h2 className="text-sm font-bold text-slate-800">{examVisit.nama_lengkap}</h2><p className="text-xs text-slate-500">Antrean {examVisit.queue_number} · {examVisit.medical_record_no}</p></div>
              <button onClick={() => setExamVisit(null)} className="text-slate-400 hover:text-slate-700">Tutup</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <form action={submitExam} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Keluhan *"><textarea required name="complaint" defaultValue={examVisit.complaint || ''} className={`${inputClass} min-h-24`} /></Field>
                <Field label="Diagnosis *"><textarea required name="diagnosis" className={`${inputClass} min-h-24`} /></Field>
                <Field label="Tindakan"><textarea name="treatment" className={`${inputClass} min-h-24`} /></Field>
                <Field label="Tindak lanjut"><textarea name="followUp" className={`${inputClass} min-h-24`} /></Field>
                <Field label="Tujuan rujukan"><input name="referralDestination" className={inputClass} /></Field>
                <Field label="Catatan rujukan"><input name="referralNotes" className={inputClass} /></Field>
              </div>
              <div className="rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between border-b bg-slate-50 p-3"><div><p className="font-bold">Resep</p><p className="text-xs text-slate-500">Jumlah menggunakan satuan dasar obat.</p></div><button type="button" onClick={() => setPrescription(rows => [...rows, { localId: crypto.randomUUID(), medicineId: '', requestedQuantityBase: 1, dosage: '' }])} className={buttonSecondary}><Plus className="h-4 w-4" /> Obat</button></div>
                {prescription.length ? <div className="space-y-3 p-3">{prescription.map((item, index) => (
                  <div key={item.localId} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_120px_1fr_auto]">
                    <select value={item.medicineId} onChange={event => setPrescription(rows => rows.map(row => row.localId === item.localId ? { ...row, medicineId: event.target.value } : row))} className={inputClass}><option value="">Pilih obat</option>{medicines.map(medicine => <option key={medicine.id} value={medicine.id}>{medicine.name} · stok {medicine.total_stock_base} {medicine.base_unit}</option>)}</select>
                    <input type="number" min={1} value={item.requestedQuantityBase} onChange={event => setPrescription(rows => rows.map(row => row.localId === item.localId ? { ...row, requestedQuantityBase: Number(event.target.value) } : row))} className={inputClass} />
                    <input placeholder="Dosis, mis. 3×1" value={item.dosage || ''} onChange={event => setPrescription(rows => rows.map(row => row.localId === item.localId ? { ...row, dosage: event.target.value } : row))} className={inputClass} />
                    <button type="button" title={`Hapus obat ${index + 1}`} onClick={() => setPrescription(rows => rows.filter(row => row.localId !== item.localId))} className="rounded-xl p-3 text-rose-600 hover:bg-rose-50"><X className="h-4 w-4" /></button>
                  </div>
                ))}</div> : <p className="p-5 text-center text-sm text-slate-500">Tidak ada obat.</p>}
              </div>
              <button disabled={pending} className={`${buttonPrimary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Selesaikan pemeriksaan</button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function HistoryTab() {
  const today = toWibDateInputValue()
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const [q, setQ] = useState('')
  const [pageSize, setPageSize] = useState<PoskestrenPageSize>(20)
  const [result, setResult] = useState<any>({ items: [] })
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    try { setResult(await getExaminationHistory({ from, to, q, limit: pageSize })) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal memuat pemeriksaan.') }
    finally { setLoading(false) }
  }, [from, pageSize, q, to])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b bg-slate-50/70 p-4 md:grid-cols-[160px_160px_1fr_auto]">
        <input type="date" value={from} onChange={event => setFrom(event.target.value)} className={inputClass} />
        <input type="date" value={to} onChange={event => setTo(event.target.value)} className={inputClass} />
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={event => setQ(event.target.value)} placeholder="Pasien, NIS, diagnosis, tindakan, obat..." className={`${inputClass} pl-9`} /></div>
        <PageSizeSelect value={pageSize} onChange={setPageSize} hasFilter={Boolean(q || from || to)} />
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : result.items.length ? (
        <>
        <div className="divide-y divide-slate-100 md:hidden">
          {result.items.map((row: any) => (
            <article key={row.id} className="p-3">
              <div className="flex flex-col gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{row.nama_lengkap}</p><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">{row.status}</span>{row.revision_no ? <span className="text-[10px] font-bold text-amber-700">Revisi {row.revision_no}</span> : null}</div>
                  <p className="text-xs text-slate-500">{formatDate(row.queue_date)} · {row.nis} · {row.asrama || '—'} / {row.kamar || '—'} · {row.personnel_name || '—'}</p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs font-bold text-slate-400">Keluhan</dt><dd>{row.complaint || '—'}</dd></div>
                    <div><dt className="text-xs font-bold text-slate-400">Diagnosis</dt><dd>{row.diagnosis || '—'}</dd></div>
                    <div><dt className="text-xs font-bold text-slate-400">Tindakan</dt><dd>{row.treatment || '—'}</dd></div>
                    <div><dt className="text-xs font-bold text-slate-400">Obat</dt><dd>{row.medicine_names || '—'}</dd></div>
                  </dl>
                </div>
                <button disabled={pending} onClick={() => {
                  const reason = window.prompt('Alasan revisi:')
                  if (!reason) return
                  const diagnosis = window.prompt('Diagnosis koreksi:', row.diagnosis || '')
                  if (!diagnosis) return
                  startTransition(async () => {
                    const response = await reviseCompletedVisit({ visitId: row.id, reason, diagnosis, treatment: row.treatment, followUp: row.follow_up, referralDestination: row.referral_destination, referralNotes: row.referral_notes })
                    if (!response.success) { toast.error(response.error); return }
                    toast.success('Pemeriksaan direvisi dan riwayat disimpan.')
                    await load()
                  })
                }} className={buttonSecondary}>Revisi</button>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">Tanggal / Pasien</th>
                <th className="px-4 py-3 font-bold">Keluhan</th>
                <th className="px-4 py-3 font-bold">Diagnosis / Tindakan</th>
                <th className="px-4 py-3 font-bold">Obat</th>
                <th className="px-4 py-3 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.items.map((row: any) => (
                <tr key={row.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3"><p className="font-bold">{row.nama_lengkap}</p><p className="text-xs text-slate-500">{formatDate(row.queue_date)} · {row.nis}</p><p className="text-xs text-slate-500">{row.asrama || '—'} / {row.kamar || '—'} · {row.personnel_name || '—'}</p></td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">{row.complaint || '—'}</td>
                  <td className="max-w-xs px-4 py-3"><p className="font-semibold">{row.diagnosis || '—'}</p><p className="mt-1 text-xs text-slate-500">{row.treatment || 'Tanpa tindakan'}</p>{row.revision_no ? <span className="mt-1 inline-block text-[10px] font-bold text-amber-700">Revisi {row.revision_no}</span> : null}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">{row.medicine_names || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button disabled={pending} onClick={() => {
                      const reason = window.prompt('Alasan revisi:')
                      if (!reason) return
                      const diagnosis = window.prompt('Diagnosis koreksi:', row.diagnosis || '')
                      if (!diagnosis) return
                      startTransition(async () => {
                        const response = await reviseCompletedVisit({ visitId: row.id, reason, diagnosis, treatment: row.treatment, followUp: row.follow_up, referralDestination: row.referral_destination, referralNotes: row.referral_notes })
                        if (!response.success) { toast.error(response.error); return }
                        toast.success('Pemeriksaan direvisi dan riwayat disimpan.')
                        await load()
                      })
                    }} className={buttonSecondary}>Revisi</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : <EmptyState title="Tidak ada pemeriksaan" description="Ubah rentang tanggal atau kata pencarian." />}
    </section>
  )
}

function PreventiveTab() {
  const today = toWibDateInputValue()
  const [q, setQ] = useState('')
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const [data, setData] = useState<any>({ types: [], programs: [] })
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [participantSearch, setParticipantSearch] = useState('')
  const [santriOptions, setSantriOptions] = useState<any[]>([])
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([])
  const [bulkTarget, setBulkTarget] = useState({ asrama: '', kamar: '', kelas: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getPreventiveData({ q, from, to, limit: 100 })) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal memuat preventif.') }
    finally { setLoading(false) }
  }, [from, q, to])

  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])
  useEffect(() => {
    if (participantSearch.trim().length < 2) { setSantriOptions([]); return }
    const timer = setTimeout(async () => setSantriOptions(await searchActiveSantri(participantSearch)), 250)
    return () => clearTimeout(timer)
  }, [participantSearch])

  async function openProgram(program: any) {
    setSelectedProgram(program)
    setParticipants(await getPreventiveParticipants(program.id))
  }

  function submitProgram(formData: FormData) {
    startTransition(async () => {
      const result = await createPreventiveProgram({
        typeId: String(formData.get('typeId') || ''),
        title: String(formData.get('title') || ''),
        programDate: String(formData.get('programDate') || ''),
        targetSummary: String(formData.get('targetSummary') || ''),
        description: String(formData.get('description') || ''),
        attachmentUrl: String(formData.get('attachmentUrl') || ''),
        participantIds: selectedParticipantIds,
      })
      if (!result.success) { toast.error(result.error); return }
      toast.success('Program preventif dibuat.')
      setShowCreate(false)
      setSelectedParticipantIds([])
      await load()
    })
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold">Program Preventif</h2><p className="text-xs text-slate-500">Program fleksibel dengan hasil dan tindak lanjut per santri.</p></div>
          <div className="flex gap-2">
            <button onClick={() => { const name = window.prompt('Nama jenis program baru:'); if (name) startTransition(async () => { const result = await createPreventiveType(name); if (!result.success) toast.error(result.error); else { toast.success('Jenis program ditambahkan.'); await load() } }) }} className={buttonSecondary}>Jenis program</button>
            <button onClick={() => setShowCreate(true)} className={buttonPrimary}><Plus className="h-4 w-4" /> Program</button>
          </div>
        </div>
        <div className="grid gap-3 border-b bg-slate-50/70 p-4 sm:grid-cols-[160px_160px_1fr]">
          <input type="date" value={from} onChange={event => setFrom(event.target.value)} className={inputClass} />
          <input type="date" value={to} onChange={event => setTo(event.target.value)} className={inputClass} />
          <input value={q} onChange={event => setQ(event.target.value)} placeholder="Judul, sasaran, atau deskripsi..." className={inputClass} />
        </div>
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : data.programs.length ? (
          <>
          <div className="grid gap-2 p-3 md:hidden">
            {data.programs.map((program: any) => (
              <button key={program.id} onClick={() => void openProgram(program)} className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/30">
                <div className="flex items-start justify-between gap-2"><div><p className="font-bold">{program.title}</p><p className="text-xs text-slate-500">{program.type_name || 'Tanpa jenis'} · {formatDate(program.program_date)}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{program.status}</span></div>
                <p className="mt-2 text-sm text-slate-600">{program.target_summary || program.description || 'Tanpa deskripsi'}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded-lg bg-slate-100 p-2"><strong className="block text-base">{program.participant_count || 0}</strong>Peserta</span><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><strong className="block text-base">{program.present_count || 0}</strong>Hadir</span><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><strong className="block text-base">{program.follow_up_count || 0}</strong>Tindak lanjut</span></div>
              </button>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">Program</th>
                  <th className="px-4 py-3 font-bold">Tanggal / Jenis</th>
                  <th className="px-4 py-3 font-bold">Sasaran</th>
                  <th className="px-4 py-3 text-center font-bold">Peserta</th>
                  <th className="px-4 py-3 text-center font-bold">Hadir</th>
                  <th className="px-4 py-3 text-center font-bold">Tindak lanjut</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.programs.map((program: any) => (
                  <tr key={program.id} onClick={() => void openProgram(program)} className="cursor-pointer hover:bg-emerald-50/40">
                    <td className="px-4 py-3 font-bold">{program.title}</td>
                    <td className="px-4 py-3"><p>{formatDate(program.program_date)}</p><p className="text-xs text-slate-500">{program.type_name || 'Tanpa jenis'}</p></td>
                    <td className="max-w-sm px-4 py-3 text-slate-600">{program.target_summary || program.description || 'Tanpa deskripsi'}</td>
                    <td className="px-4 py-3 text-center font-bold">{program.participant_count || 0}</td><td className="px-4 py-3 text-center font-bold text-emerald-700">{program.present_count || 0}</td><td className="px-4 py-3 text-center font-bold text-amber-700">{program.follow_up_count || 0}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{program.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : <EmptyState title="Belum ada program" description="Buat program skrining, imunisasi, penyuluhan, atau kegiatan lain." />}
      </section>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-slate-50 px-5 py-4"><h2 className="text-sm font-bold text-slate-800">Program Preventif Baru</h2><button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700">Tutup</button></div>
            <div className="flex-1 overflow-y-auto p-5">
              <form action={submitProgram} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Judul *"><input required name="title" className={inputClass} /></Field>
                <Field label="Tanggal *"><input required type="date" name="programDate" defaultValue={today} className={inputClass} /></Field>
                <Field label="Jenis"><select name="typeId" className={inputClass}><option value="">Tanpa jenis</option>{data.types.map((type: any) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
                <Field label="Sasaran"><input name="targetSummary" placeholder="Contoh: Santri Asrama Al-Falah" className={inputClass} /></Field>
              </div>
              <Field label="Deskripsi"><textarea name="description" className={`${inputClass} min-h-24`} /></Field>
              <Field label="URL lampiran"><input name="attachmentUrl" placeholder="Opsional" className={inputClass} /></Field>
              <Field label="Tambah peserta">
                <input value={participantSearch} onChange={event => setParticipantSearch(event.target.value)} placeholder="Cari nama/NIS/asrama..." className={inputClass} />
              </Field>
              {santriOptions.length ? <div className="max-h-48 overflow-y-auto rounded-xl border">{santriOptions.map(row => <button type="button" key={row.id} disabled={selectedParticipantIds.includes(row.id)} onClick={() => setSelectedParticipantIds(ids => [...ids, row.id])} className="flex w-full justify-between border-b p-3 text-left text-sm hover:bg-emerald-50 disabled:text-slate-400"><span><strong>{row.nama_lengkap}</strong><small className="block">{row.nis} · {row.asrama || '—'}</small></span>{selectedParticipantIds.includes(row.id) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</button>)}</div> : null}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-600">Pilih massal berdasarkan sasaran</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input value={bulkTarget.asrama} onChange={event => setBulkTarget(value => ({ ...value, asrama: event.target.value }))} placeholder="Asrama (persis)" className={inputClass} />
                  <input value={bulkTarget.kamar} onChange={event => setBulkTarget(value => ({ ...value, kamar: event.target.value }))} placeholder="Kamar (persis)" className={inputClass} />
                  <input value={bulkTarget.kelas} onChange={event => setBulkTarget(value => ({ ...value, kelas: event.target.value }))} placeholder="Kelas (persis)" className={inputClass} />
                </div>
                <button type="button" className={buttonSecondary} onClick={() => startTransition(async () => {
                  const result = await searchPreventiveTargets(bulkTarget)
                  if (result.error) { toast.error(result.error); return }
                  setSelectedParticipantIds(ids => [...new Set([...ids, ...result.items.map(row => row.id)])])
                  toast.success(`${result.items.length} santri ditambahkan${result.truncated ? ' (dibatasi 500)' : ''}.`)
                })}>Pilih semua hasil filter</button>
              </div>
              <p className="text-xs font-bold text-emerald-700">{selectedParticipantIds.length} peserta dipilih</p>
              <button disabled={pending} className={`${buttonPrimary} w-full`}>Simpan program</button>
            </form>
            </div>
          </div>
        </div>
      ) : null}

      {selectedProgram ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-slate-50 px-5 py-4"><div><h2 className="text-sm font-bold text-slate-800">{selectedProgram.title}</h2><p className="text-xs text-slate-500">{formatDate(selectedProgram.program_date)} · {selectedProgram.status}</p></div><button onClick={() => setSelectedProgram(null)} className="text-slate-400 hover:text-slate-700">Tutup</button></div>
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-wrap gap-2 border-b p-4">{['DRAFT','ACTIVE','COMPLETED','CANCELLED'].map(value => <button key={value} disabled={pending} onClick={() => startTransition(async () => { const response = await updatePreventiveStatus(selectedProgram.id, value as any); if (!response.success) toast.error(response.error); else { toast.success('Status diperbarui.'); setSelectedProgram({ ...selectedProgram, status: value }); await load() } })} className={value === selectedProgram.status ? buttonPrimary : buttonSecondary}>{value}</button>)}</div>
            {participants.length ? <>
            <div className="divide-y md:hidden">{participants.map(row => (
              <div key={row.id} className="grid gap-2 p-3">
                <div><p className="font-bold">{row.nama_lengkap}</p><p className="text-xs text-slate-500">{row.nis} · {row.asrama || '—'} / {row.kamar || '—'}</p></div>
                <select defaultValue={row.attendance} id={`attendance-${row.id}`} className={inputClass}><option>PENDING</option><option>PRESENT</option><option>ABSENT</option></select>
                <input defaultValue={row.result || ''} id={`result-${row.id}`} placeholder="Hasil" className={inputClass} />
                <input defaultValue={row.follow_up || ''} id={`follow-${row.id}`} placeholder="Tindak lanjut" className={inputClass} />
                <button disabled={pending} onClick={() => startTransition(async () => {
                  const response = await updatePreventiveParticipant({
                    id: row.id,
                    attendance: (document.getElementById(`attendance-${row.id}`) as HTMLSelectElement).value as any,
                    result: (document.getElementById(`result-${row.id}`) as HTMLInputElement).value,
                    followUp: (document.getElementById(`follow-${row.id}`) as HTMLInputElement).value,
                  })
                  if (!response.success) toast.error(response.error); else toast.success('Peserta diperbarui.')
                })} className={buttonSecondary}>Simpan</button>
              </div>
            ))}</div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
                  <tr><th className="px-4 py-3 font-bold">Peserta</th><th className="px-4 py-3 font-bold">Kehadiran</th><th className="px-4 py-3 font-bold">Hasil</th><th className="px-4 py-3 font-bold">Tindak lanjut</th><th className="px-4 py-3 text-right font-bold">Aksi</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {participants.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3"><p className="font-bold">{row.nama_lengkap}</p><p className="text-xs text-slate-500">{row.nis} · {row.asrama || '—'} / {row.kamar || '—'}</p></td>
                      <td className="px-4 py-3"><select defaultValue={row.attendance} id={`attendance-desktop-${row.id}`} className={inputClass}><option>PENDING</option><option>PRESENT</option><option>ABSENT</option></select></td>
                      <td className="px-4 py-3"><input defaultValue={row.result || ''} id={`result-desktop-${row.id}`} placeholder="Hasil" className={inputClass} /></td>
                      <td className="px-4 py-3"><input defaultValue={row.follow_up || ''} id={`follow-desktop-${row.id}`} placeholder="Tindak lanjut" className={inputClass} /></td>
                      <td className="px-4 py-3 text-right">
                        <button disabled={pending} onClick={() => startTransition(async () => {
                          const response = await updatePreventiveParticipant({
                            id: row.id,
                            attendance: (document.getElementById(`attendance-desktop-${row.id}`) as HTMLSelectElement).value as any,
                            result: (document.getElementById(`result-desktop-${row.id}`) as HTMLInputElement).value,
                            followUp: (document.getElementById(`follow-desktop-${row.id}`) as HTMLInputElement).value,
                          })
                          if (!response.success) toast.error(response.error); else toast.success('Peserta diperbarui.')
                        })} className={buttonSecondary}>Simpan</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </> : <EmptyState title="Belum ada peserta" description="Program dibuat tanpa peserta individual." />}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

