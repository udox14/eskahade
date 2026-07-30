/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BadgeDollarSign, BriefcaseBusiness, History, Loader2, Plus, Search, Settings2, Stethoscope, Trash2, UserRoundCog, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { EmptyState, MetricCard, PoskestrenTabs } from '@/components/poskestren/poskestren-shell'
import { toWibDateInputValue } from '@/lib/date/wib'
import type { PoskestrenPageSize } from '@/lib/poskestren/types'

import { appendCompensation, deletePersonnel, getPersonnel, getPersonnelDetail, getUserOptions, savePersonnel } from './actions'

type Tab = 'medis' | 'karyawan'
const TABS = [
  { value: 'medis' as const, label: 'Tenaga Medis', icon: Stethoscope },
  { value: 'karyawan' as const, label: 'Karyawan', icon: BriefcaseBusiness },
]
const inputClass = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'
function rupiah(value: unknown) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0)) }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">{label}</span>{children}</label> }

export default function PoskestrenManajemenContent() {
  const params = useSearchParams()
  const router = useRouter()
  const initial = params.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(initial === 'karyawan' ? initial : 'medis')
  function changeTab(next: Tab) {
    setTab(next); const nextParams = new URLSearchParams(params.toString()); nextParams.set('tab', next)
    router.replace(`/dashboard/poskestren/manajemen?${nextParams}`, { scroll: false })
  }
  return <div className="mx-auto max-w-7xl space-y-6 pb-24">
    <DashboardPageHeader title="Manajemen" description="Personel, tautan akun, jabatan khusus, dan riwayat kompensasi append-only." className="border-b pb-4" />
    <PoskestrenTabs tabs={TABS} active={tab} onChange={changeTab} />
    <PersonnelTab type={tab === 'medis' ? 'MEDICAL' : 'EMPLOYEE'} />
  </div>
}

function PersonnelTab({ type }: { type: 'MEDICAL' | 'EMPLOYEE' }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('active')
  const [limit, setLimit] = useState<PoskestrenPageSize>(20)
  const [rows, setRows] = useState<any[]>([])
  const [truncated, setTruncated] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [detail, setDetail] = useState<any>(null)
  const [showRate, setShowRate] = useState<any>(null)
  const [userOptions, setUserOptions] = useState<any[]>([])
  const [confirmDelete, setConfirmDelete] = useState<any>(null)
  const [manageTarget, setManageTarget] = useState<any>(null)
  const [pending, startTransition] = useTransition()
  const load = useCallback(async () => {
    const result = await getPersonnel({ q, status, limit, personnelType: type })
    setRows(result.items)
    setTruncated(Boolean(result.truncated))
  }, [q, status, limit, type])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])
  async function openEdit(personnel: any) {
    const [info, users] = await Promise.all([personnel.id ? getPersonnelDetail(personnel.id) : Promise.resolve({ personnel }), getUserOptions()])
    setUserOptions(users); setEditing(info.personnel || personnel)
  }
  async function openDetail(personnel: any) { setDetail(await getPersonnelDetail(personnel.id)) }
  const active = rows.filter(row => row.is_active).length
  return <section className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard label={type === 'MEDICAL' ? 'Tenaga medis tampil' : 'Karyawan tampil'} value={rows.length} />
      <MetricCard label="Aktif" value={active} tone="blue" />
      <MetricCard label="Belum tertaut akun" value={rows.filter(row => !row.user_id).length} tone="amber" />
    </div>
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:flex-row">
      <div className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${inputClass} pl-9`} value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama, profesi, jabatan, kontak..." /></div>
      <select className={inputClass} value={status} onChange={e => setStatus(e.target.value)}><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="">Semua status</option></select>
      <select className={inputClass} value={limit} onChange={e => setLimit(e.target.value === 'all' ? 'all' : Number(e.target.value) as 20 | 50 | 100)}><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option><option value="all" disabled={!Boolean(q || status)}>Semua (maks. 1.000)</option></select>
      <button className={primary} onClick={() => openEdit({ personnel_type: type, is_active: 1 })}><Plus className="h-4 w-4" /> Tambah</button>
    </div>
    {truncated ? <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700">Hasil “Semua” dibatasi 1.000 baris. Gunakan filter yang lebih spesifik.</p> : null}
    {rows.length === 0 ? <EmptyState title="Belum ada personel" description="Tambah personel dan riwayat kompensasinya." /> : <>
      <div className="space-y-2 md:hidden">{rows.map(row => <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-black">{row.full_name}</h3><p className="truncate text-[11px] text-slate-500">{row.profession || row.position_name || 'Jabatan belum diisi'} · {row.poskestren_jabatan || 'tanpa jabatan POS'}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${row.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{row.is_active ? 'AKTIF' : 'NONAKTIF'}</span></div><p className="mt-1 truncate text-[11px] text-slate-500">{row.email || 'Belum tertaut akun'} · efektif {row.effective_from || '—'}</p><div className="mt-1 flex flex-wrap gap-1">{type === 'MEDICAL' ? <><span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{rupiah(row.session_rate_rupiah)}/sesi</span><span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">{rupiah(row.patient_rate_rupiah)}/pasien</span></> : <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{rupiah(row.monthly_salary_rupiah)}/bulan</span>}</div><div className="mt-3 flex gap-2"><button className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white hover:bg-slate-800" onClick={() => setManageTarget(row)}><Settings2 className="h-4 w-4" /> Kelola</button></div></article>)}</div>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3 font-bold">Nama</th><th className="px-4 py-3 font-bold">Profesi/Jabatan</th><th className="px-4 py-3 font-bold">Kontak/Akun</th><th className="px-4 py-3 font-bold">Jabatan POS</th><th className="px-4 py-3 font-bold">Kompensasi Aktif</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 text-center font-bold">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-bold">{row.full_name}</td><td className="px-4 py-3"><p>{row.profession || row.position_name || '—'}</p>{row.license_number ? <p className="text-xs text-slate-500">{row.license_number}</p> : null}</td><td className="px-4 py-3"><p>{row.phone || '—'}</p><p className="text-xs text-slate-500">{row.email || 'Belum tertaut akun'}</p></td><td className="px-4 py-3">{row.poskestren_jabatan || '—'}</td><td className="px-4 py-3"><div className="flex flex-col gap-1">{type === 'MEDICAL' ? <><span className="inline-flex w-fit items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{rupiah(row.session_rate_rupiah)} <span className="ml-1 text-[10px] font-normal opacity-75">/ sesi</span></span><span className="inline-flex w-fit items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">{rupiah(row.patient_rate_rupiah)} <span className="ml-1 text-[10px] font-normal opacity-75">/ pasien</span></span></> : <span className="inline-flex w-fit items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{rupiah(row.monthly_salary_rupiah)} <span className="ml-1 text-[10px] font-normal opacity-75">/ bulan</span></span>}<p className="text-[10px] text-slate-400">Efektif {row.effective_from || '—'}</p></div></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${row.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{row.is_active ? 'AKTIF' : 'NONAKTIF'}</span></td><td className="px-4 py-3 text-center"><button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200" onClick={() => setManageTarget(row)}><Settings className="h-3.5 w-3.5" /> Kelola</button></td></tr>)}</tbody></table></div>
    </>}
    {editing ? <PersonnelModal personnel={editing} users={userOptions} pending={pending} onClose={() => setEditing(null)} onSave={(data: any) => startTransition(async () => { try { const result = await savePersonnel(data); if (!result.success) { toast.error(result.error); return }; toast.success('Data personel disimpan.'); setEditing(null); await load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan personel.') } })} /> : null}
    {showRate ? <CompensationModal personnel={showRate} pending={pending} onClose={() => setShowRate(null)} onSave={(data: any) => startTransition(async () => { try { const result = await appendCompensation(data); if (!result.success) { toast.error(result.error); return }; toast.success('Riwayat kompensasi ditambahkan.'); setShowRate(null); await load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan kompensasi.') } })} /> : null}
    {detail ? <HistoryModal detail={detail} onClose={() => setDetail(null)} /> : null}
    {confirmDelete ? <ConfirmDeleteModal title={`Hapus ${confirmDelete.full_name}?`} description={`Data personel, jabatan, dan seluruh riwayat kompensasi akan dihapus permanen. Aksi ini tidak dapat dibatalkan. Pastikan personel tidak memiliki riwayat pemeriksaan.`} pending={pending} onClose={() => setConfirmDelete(null)} onConfirm={() => startTransition(async () => { try { const result = await deletePersonnel(confirmDelete.id); if (!result.success) { toast.error(result.error); return }; toast.success('Personel berhasil dihapus.'); setConfirmDelete(null); await load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menghapus personel.') } })} /> : null}
    {manageTarget ? <ManageActionModal row={manageTarget} onClose={() => setManageTarget(null)} onEdit={() => { setManageTarget(null); openEdit(manageTarget) }} onRate={() => { setManageTarget(null); setShowRate(manageTarget) }} onHistory={() => { setManageTarget(null); openDetail(manageTarget) }} onDelete={() => { setManageTarget(null); setConfirmDelete(manageTarget) }} /> : null}
  </section>
}

function PersonnelModal({ personnel, users, pending, onClose, onSave }: any) {
  const [userId, setUserId] = useState(personnel.user_id || '')
  return <Modal title={personnel.id ? 'Edit personel' : 'Tambah personel'} onClose={onClose} wide><form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ id: personnel.id, personnelType: personnel.personnel_type, fullName: f.get('name'), profession: f.get('profession'), positionName: f.get('position'), phone: f.get('phone'), licenseNumber: f.get('license'), employmentStart: f.get('start'), employmentEnd: f.get('end'), userId: userId || null, poskestrenJabatan: f.get('jabatan') || null, notes: f.get('notes'), isActive: f.get('active') === 'on' }) }}>
    <Field label="Nama lengkap *"><input name="name" className={inputClass} defaultValue={personnel.full_name} required /></Field>
    <Field label={personnel.personnel_type === 'MEDICAL' ? 'Profesi' : 'Bidang'}><input name="profession" className={inputClass} defaultValue={personnel.profession} placeholder={personnel.personnel_type === 'MEDICAL' ? 'Dokter, perawat...' : 'Administrasi...'} /></Field>
    <Field label="Jabatan"><input name="position" className={inputClass} defaultValue={personnel.position_name} /></Field>
    <Field label="Kontak"><input name="phone" className={inputClass} defaultValue={personnel.phone} /></Field>
    <Field label="Nomor izin profesi"><input name="license" className={inputClass} defaultValue={personnel.license_number} /></Field>
    <Field label="Akun pengguna"><select className={inputClass} value={userId} onChange={e => setUserId(e.target.value)}><option value="">Tidak ditautkan</option>{personnel.user_id ? <option value={personnel.user_id}>{personnel.email}</option> : null}{users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name} · {u.email}</option>)}</select></Field>
    <Field label="Jabatan khusus POSKESTREN"><select name="jabatan" className={inputClass} defaultValue={personnel.poskestren_jabatan || ''} disabled={!userId}><option value="">Tanpa jabatan</option><option value="ketua">Ketua</option><option value="bendahara">Bendahara</option><option value="sekretaris">Sekretaris</option></select></Field>
    <label className="flex items-center gap-2 pt-7 text-sm font-bold"><input name="active" type="checkbox" defaultChecked={personnel.is_active !== 0} /> Aktif</label>
    <Field label="Tanggal mulai"><input name="start" type="date" className={inputClass} defaultValue={personnel.employment_start} /></Field>
    <Field label="Tanggal berakhir"><input name="end" type="date" className={inputClass} defaultValue={personnel.employment_end} /></Field>
    <div className="sm:col-span-2"><Field label="Catatan"><textarea name="notes" className={inputClass} defaultValue={personnel.notes} /></Field></div>
    {personnel.personnel_type === 'MEDICAL' && !userId ? <p className="sm:col-span-2 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Tenaga medis dapat disimpan tanpa akun, tetapi tidak dapat menangani pemeriksaan sampai akun ditautkan.</p> : null}
    <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={secondary} onClick={onClose}>Batal</button><button className={primary} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan</button></div>
  </form></Modal>
}

function CompensationModal({ personnel, pending, onClose, onSave }: any) {
  const medical = personnel.personnel_type === 'MEDICAL'
  return <Modal title={`Tarif baru · ${personnel.full_name}`} onClose={onClose}><form className="space-y-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ personnelId: personnel.id, effectiveFrom: f.get('effective'), sessionRateRupiah: Number(f.get('session') || 0), patientRateRupiah: Number(f.get('patient') || 0), monthlySalaryRupiah: Number(f.get('monthly') || 0), notes: f.get('notes') }) }}>
    <p className="rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800">Nilai lama tidak ditimpa. Tarif ini berlaku mulai tanggal efektif dan akan dipakai laporan gaji sesuai tanggal layanan.</p>
    <Field label="Tanggal efektif"><input name="effective" type="date" className={inputClass} defaultValue={toWibDateInputValue()} required /></Field>
    {medical ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Tarif per sesi"><input name="session" type="number" min="0" className={inputClass} defaultValue={personnel.session_rate_rupiah || 0} /></Field><Field label="Tarif per pasien"><input name="patient" type="number" min="0" className={inputClass} defaultValue={personnel.patient_rate_rupiah || 0} /></Field></div> : <Field label="Gaji bulanan"><input name="monthly" type="number" min="1" className={inputClass} defaultValue={personnel.monthly_salary_rupiah || 0} required /></Field>}
    <Field label="Catatan perubahan"><textarea name="notes" className={inputClass} placeholder="Alasan kenaikan/penurunan..." /></Field>
    <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={onClose}>Batal</button><button className={primary} disabled={pending}>Tambahkan riwayat</button></div>
  </form></Modal>
}

function HistoryModal({ detail, onClose }: any) {
  return <Modal title={`Riwayat kompensasi · ${detail.personnel?.full_name}`} onClose={onClose}>{detail.compensationHistory.length === 0 ? <EmptyState title="Belum ada riwayat" description="Tambahkan tarif atau gaji efektif pertama." /> : <><div className="space-y-2 md:hidden">{detail.compensationHistory.map((row: any) => <article key={row.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-2"><strong className="text-sm">{row.effective_from}</strong><span className="text-[10px] text-slate-400">{row.creator_name || 'Sistem'}</span></div><p className="mt-1 text-xs font-bold">{detail.personnel.personnel_type === 'MEDICAL' ? `${rupiah(row.session_rate_rupiah)}/sesi + ${rupiah(row.patient_rate_rupiah)}/pasien` : `${rupiah(row.monthly_salary_rupiah)}/bulan`}</p>{row.notes ? <p className="mt-1 truncate text-[11px] text-slate-500">{row.notes}</p> : null}</article>)}</div><div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Efektif</th><th className="px-3 py-2">Tarif sesi</th><th className="px-3 py-2">Tarif pasien</th><th className="px-3 py-2">Gaji bulanan</th><th className="px-3 py-2">Pembuat</th><th className="px-3 py-2">Catatan</th></tr></thead><tbody className="divide-y">{detail.compensationHistory.map((row: any) => <tr key={row.id}><td className="px-3 py-2 font-bold">{row.effective_from}</td><td className="px-3 py-2">{row.session_rate_rupiah == null ? '—' : rupiah(row.session_rate_rupiah)}</td><td className="px-3 py-2">{row.patient_rate_rupiah == null ? '—' : rupiah(row.patient_rate_rupiah)}</td><td className="px-3 py-2">{row.monthly_salary_rupiah == null ? '—' : rupiah(row.monthly_salary_rupiah)}</td><td className="px-3 py-2">{row.creator_name || 'Sistem'}</td><td className="px-3 py-2 text-xs text-slate-500">{row.notes || '—'}</td></tr>)}</tbody></table></div></>}</Modal>
}

function ConfirmDeleteModal({ title, description, pending, onClose, onConfirm }: { title: string; description: string; pending: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Modal title={title} onClose={onClose}>
    <div className="space-y-4">
      <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
        <p className="font-black mb-1">⚠ Peringatan: Aksi ini tidak dapat dibatalkan!</p>
        <p>{description}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={secondary} onClick={onClose} disabled={pending}>Batal</button>
        <button type="button" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50" onClick={onConfirm} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Ya, Hapus Permanen</button>
      </div>
    </div>
  </Modal>
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"><div className={`max-h-[90vh] w-full flex flex-col overflow-hidden rounded-xl bg-white shadow-xl ${wide ? 'max-w-4xl' : 'max-w-xl'}`}><div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4"><h2 className="text-sm font-bold text-slate-800">{title}</h2><button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose}>Tutup</button></div><div className="flex-1 overflow-y-auto p-5">{children}</div></div></div>
}

function ManageActionModal({ row, onClose, onEdit, onRate, onHistory, onDelete }: { row: any; onClose: () => void; onEdit: () => void; onRate: () => void; onHistory: () => void; onDelete: () => void }) {
  return (
    <Modal title={`Kelola ${row.full_name}`} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={onEdit} className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 transition hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-sm">
          <UserRoundCog className="h-8 w-8 text-slate-400 group-hover:text-emerald-600" />
          <span className="font-bold text-slate-700 group-hover:text-emerald-700">Edit Profil</span>
          <span className="text-center text-xs text-slate-500">Ubah data diri, jabatan, profesi, dan akun.</span>
        </button>
        <button onClick={onRate} className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 transition hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm">
          <BadgeDollarSign className="h-8 w-8 text-slate-400 group-hover:text-blue-600" />
          <span className="font-bold text-slate-700 group-hover:text-blue-700">Tarif / Gaji Baru</span>
          <span className="text-center text-xs text-slate-500">Tentukan kompensasi baru yang mulai berlaku.</span>
        </button>
        <button onClick={onHistory} className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 transition hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-sm">
          <History className="h-8 w-8 text-slate-400 group-hover:text-indigo-600" />
          <span className="font-bold text-slate-700 group-hover:text-indigo-700">Riwayat Kompensasi</span>
          <span className="text-center text-xs text-slate-500">Lihat histori penyesuaian gaji atau tarif lama.</span>
        </button>
        <button onClick={onDelete} className="group flex flex-col items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-6 transition hover:bg-rose-100 hover:shadow-sm">
          <Trash2 className="h-8 w-8 text-rose-500 group-hover:text-rose-700" />
          <span className="font-bold text-rose-700">Hapus Permanen</span>
          <span className="text-center text-xs text-rose-600">Hapus data personel beserta kompensasinya.</span>
        </button>
      </div>
    </Modal>
  )
}
