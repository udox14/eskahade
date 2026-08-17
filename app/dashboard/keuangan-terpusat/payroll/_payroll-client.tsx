'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, CloudArrowUp, FileXls, Trash, Warning } from '@phosphor-icons/react'
import {
  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceTour, MetricCard, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'
import {
  approvePayrollAction,
  calculatePayrollAction,
  createPayrollPeriodAction,
  createPayrollPolicyAction,
  createTeacherCompensationAction,
  deleteTeachingAttendanceAction,
  importAttendanceAction,
  importCompensationAction,
  lockPayrollAttendanceAction,
  saveTeachingAttendanceAction,
  syncTeachersAction,
  verifyAttendanceBatchAction,
  verifyTeachingAttendanceAction,
} from './actions'
import type { AttendanceImportRow, CompensationImportRow } from './actions'
import { BulkImport, asDateISO, asInteger, asText } from '../_components/bulk-import'
import { BulkActionBar, RupiahInput } from '../_components/finance-inputs'
import { useDraft } from '../_components/use-draft'

const field = FINANCE_FIELD_CLASS
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

/** Istilah yang biasa ditulis di lembar absensi, dipetakan ke status yang diterima database. */
const ATTENDANCE_STATUS: Record<string, 'PRESENT' | 'ABSENT' | 'HOLIDAY' | 'SUBSTITUTE'> = {
  'hadir': 'PRESENT', 'present': 'PRESENT', 'h': 'PRESENT',
  'absen': 'ABSENT', 'absent': 'ABSENT', 'alpa': 'ABSENT', 'a': 'ABSENT',
  'libur': 'HOLIDAY', 'holiday': 'HOLIDAY', 'l': 'HOLIDAY',
  'digantikan': 'SUBSTITUTE', 'substitute': 'SUBSTITUTE', 'pengganti': 'SUBSTITUTE', 's': 'SUBSTITUTE',
}

type PolicyDraft = {
  effectiveFrom: string
  mode: 'UNCHANGED' | 'DEDUCT_ABSENCE' | 'ATTENDANCE_THRESHOLD'
  substitutePercent: string
  defaultSessionRate: number
  thresholdPercent: string
}
const emptyPolicy: PolicyDraft = { effectiveFrom: '', mode: 'UNCHANGED', substitutePercent: '100', defaultSessionRate: 0, thresholdPercent: '' }

const TOUR: TourStep[] = [
  { target: '[data-tour="workflow"]', title: 'Payroll berjalan berurutan', body: 'Buat periode, catat absensi, verifikasi, kunci, hitung, lalu setujui. Setiap langkah mengunci langkah sebelumnya — tidak bisa dilompati.' },
  { target: '[data-tour="policy"]', title: 'Kebijakan menentukan cara hitung', body: 'Versi kebijakan tidak dapat diubah setelah dibuat. Periode memakai kebijakan yang berlaku saat periodenya dibuat, sehingga perhitungan lama tetap bisa ditelusuri.' },
  { target: '[data-tour="compensation"]', title: 'Kompensasi bersifat berjenjang waktu', body: 'Menaikkan gaji berarti menambah baris efektif baru, bukan menimpa yang lama. Periode lama tetap memakai angka yang berlaku saat itu.' },
  { target: '[data-tour="attendance"]', title: 'Absensi harus diverifikasi', body: 'Semua baris wajib terverifikasi sebelum periode bisa dikunci. Setelah terverifikasi, barisnya tidak dapat diubah atau dihapus.' },
  { target: '[data-tour="items"]', title: 'Hasil perhitungan', body: 'Periksa angka bersih tiap guru sebelum checker menyetujui. Persetujuan memposting akrual ke ledger dan tidak dapat dibatalkan.' },
]

export function PayrollClient({ data }: { data: any }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [confirmApprove, setConfirmApprove] = useState<any>(null)
  const [confirmLock, setConfirmLock] = useState<any>(null)
  const tour = useFinanceTour('payroll')
  // Kebijakan tidak dapat diubah setelah dibuat, jadi isian yang hilang karena
  // halaman tersegarkan berarti seluruh angkanya harus dikumpulkan ulang.
  const policyDraft = useDraft<PolicyDraft>('payroll-policy', emptyPolicy)
  const policy = policyDraft.value
  const patchPolicy = (changes: Partial<PolicyDraft>) => policyDraft.setValue(current => ({ ...current, ...changes }))
  const [attendanceStatus, setAttendanceStatus] = useState<'PRESENT' | 'ABSENT' | 'HOLIDAY' | 'SUBSTITUTE'>('PRESENT')
  const openPeriods = data.periods.filter((row: any) => row.attendance_status === 'OPEN')
  const [attendancePeriod, setAttendancePeriod] = useState(openPeriods[0]?.id || data.periods[0]?.id || '')
  const [importMode, setImportMode] = useState<'compensation' | 'attendance' | null>(null)
  const [selectedAttendance, setSelectedAttendance] = useState<Set<string>>(new Set())
  const visibleAttendance = useMemo(() => data.attendance.filter((row: any) => !attendancePeriod || row.payroll_period_id === attendancePeriod), [attendancePeriod, data.attendance])
  const unverified = data.attendance.filter((row: any) => !row.verified_at).length
  const latestPolicy = data.policies[0]

  function act(work: () => Promise<any>, success: string | ((outcome: any) => string), onSuccess?: () => void) {
    startTransition(async () => {
      try {
        const outcome = await work()
        if (!outcome?.success) {
          const message = outcome?.error || 'Tindakan payroll gagal.'
          setResult({ tone: 'error', message })
          toast.error(message)
          return
        }
        const message = typeof success === 'function' ? success(outcome) : success
        setResult({ tone: 'success', message })
        toast.success(message)
        onSuccess?.()
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tindakan payroll gagal.'
        setResult({ tone: 'error', message })
        toast.error(message)
      }
    })
  }

  /**
   * Guru dicocokkan dari kode guru atau nama lengkap. Kode diutamakan karena
   * unik; nama kembar ditolak dengan menyebut jumlah kecocokannya, supaya gaji
   * tidak pernah masuk ke orang yang mirip namanya.
   */
  function resolveTeacher(text: string): { id: string } | { error: string } {
    const needle = text.trim().toLowerCase()
    if (!needle) return { error: 'Guru wajib diisi (kode guru atau nama lengkap).' }
    const byCode = data.teachers.filter((teacher: any) => String(teacher.kode_guru || '').toLowerCase() === needle)
    const matches = byCode.length ? byCode : data.teachers.filter((teacher: any) => String(teacher.nama_lengkap || '').toLowerCase() === needle)
    if (!matches.length) return { error: `Guru "${text.trim()}" tidak ada di master guru.` }
    if (matches.length > 1) return { error: `Ada ${matches.length} guru bernama "${text.trim()}". Pakai kode guru agar tidak ambigu.` }
    return { id: String(matches[0].id) }
  }

  const unverifiedVisible = visibleAttendance.filter((row: any) => !row.verified_at)
  const chosenAttendance = unverifiedVisible.filter((row: any) => selectedAttendance.has(row.id))

  function runBatch(work: () => Promise<any>, verb: string) {
    startTransition(async () => {
      const outcome = await work()
      setSelectedAttendance(new Set())
      if (!outcome?.success) {
        const message = outcome?.error || 'Tindakan massal tidak dapat diproses.'
        setResult({ tone: 'error', message })
        toast.error(message)
        return
      }
      const failed = outcome.rejected?.length ?? 0
      setResult({
        tone: outcome.created ? 'success' : 'error',
        message: outcome.created ? `${outcome.created} baris ${verb}.` : `Tidak ada baris yang ${verb}.`,
        detail: failed ? `${failed} ditolak: ${outcome.rejected.map((item: any) => item.reason).join(' · ')}` : undefined,
      })
      if (outcome.created) toast.success(`${outcome.created} baris ${verb}.`)
      router.refresh()
    })
  }

  return <div className="space-y-4 sm:space-y-5">
    <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish} />
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Periode payroll" value={String(data.periods.length)} detail="Seluruh periode yang tersedia" icon="receipt" tone="blue" />
      <MetricCard label="Guru bertarif" value={String(new Set(data.compensation.map((row: any) => row.teacher_id)).size)} detail={`${data.teachers.length} guru di master utama`} icon="wallet" tone="slate" />
      <MetricCard label="Absensi belum verifikasi" value={String(unverified)} detail="Harus nol sebelum lock" icon="listChecks" tone={unverified ? 'amber' : 'emerald'} />
      <MetricCard label="Kebijakan aktif" value={latestPolicy ? `v${latestPolicy.version}` : '—'} detail={latestPolicy ? `${latestPolicy.fixed_salary_mode} · ${latestPolicy.effective_from}` : 'Belum ada kebijakan'} icon="checkCircle" tone="emerald" />
    </section>

    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <SectionPanel title="Alur periode payroll" description="Buat periode, lengkapi dan verifikasi absensi, kunci, hitung, lalu minta checker menyetujui batch.">
      {data.canConfigure ? <form className="grid gap-2 border-b border-slate-100 p-4 sm:flex sm:items-end" action={form => act(() => createPayrollPeriodAction(String(form.get('period'))), 'Periode payroll dibuat.')}>
        <label className="text-xs font-bold text-slate-800 sm:w-auto">Periode baru<input name="period" type="month" required className={`mt-1 ${field} sm:w-auto`} /></label>
        <button disabled={pending} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">Buat periode</button>
        <p className="text-[11px] leading-4 text-slate-500 sm:ml-2 sm:max-w-sm">Kebijakan yang berlaku pada tanggal 1 bulan tersebut akan dipakai dan dikunci ke periode ini.</p>
      </form> : null}
      <div data-tour="workflow" className="divide-y divide-slate-100">{data.periods.length ? data.periods.map((period: any) => <article key={period.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2"><strong>{period.period_key}</strong><StatusBadge tone={period.attendance_status === 'LOCKED' ? 'slate' : 'amber'}>Absensi {period.attendance_status === 'LOCKED' ? 'terkunci' : 'terbuka'}</StatusBadge><StatusBadge tone={period.payroll_status === 'APPROVED' || period.payroll_status === 'COMPLETED' ? 'emerald' : period.payroll_status === 'CALCULATED' ? 'blue' : 'slate'}>Payroll {period.payroll_status}</StatusBadge></div>
          <p className="mt-1 text-xs text-slate-500">Kebijakan v{period.policy_version} · {period.attendance_count} sesi · {period.unverified_count || 0} belum diverifikasi</p>
          {/* Langkah berikutnya ditulis eksplisit supaya urutannya tidak perlu dihafal. */}
          <p className="mt-1 text-[11px] leading-4 text-slate-600">{
            period.attendance_status === 'OPEN'
              ? Number(period.unverified_count) > 0
                ? `Berikutnya: verifikasi ${period.unverified_count} absensi yang tersisa, baru periode bisa dikunci.`
                : Number(period.attendance_count) === 0
                  ? 'Berikutnya: catat absensi mengajar untuk periode ini.'
                  : 'Berikutnya: kunci absensi agar payroll dapat dihitung.'
              : period.payroll_status === 'DRAFT' ? 'Berikutnya: hitung payroll berdasarkan absensi yang sudah dikunci.'
                : period.payroll_status === 'CALCULATED' ? 'Berikutnya: checker memeriksa rincian lalu menyetujui batch.'
                  : 'Batch sudah disetujui dan akrualnya terposting ke ledger.'
          }</p>
        </div>
        <div className="grid gap-2 sm:flex">
          {data.canConfigure && period.attendance_status === 'OPEN' ? <button disabled={pending || Number(period.unverified_count) > 0 || Number(period.attendance_count) === 0} onClick={() => setConfirmLock(period)} className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-bold disabled:opacity-50">Kunci absensi</button> : null}
          {data.canConfigure && period.attendance_status === 'LOCKED' && ['DRAFT', 'CALCULATED'].includes(period.payroll_status) ? <button disabled={pending} onClick={() => act(() => calculatePayrollAction(period.id), outcome => `${outcome.itemCount} item payroll dihitung.`)} className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 disabled:opacity-50">{period.payroll_status === 'CALCULATED' ? 'Hitung ulang' : 'Hitung payroll'}</button> : null}
          {data.canCheck && period.payroll_status === 'CALCULATED' ? <button disabled={pending} onClick={() => setConfirmApprove(period)} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50">Setujui batch</button> : null}
        </div>
      </article>) : <EmptyState icon={CheckCircle} title="Belum ada periode payroll" description="Buat periode bulanan lebih dulu; absensi mengajar dicatat di dalam periode tersebut." />}</div>
    </SectionPanel>

    <section className="grid gap-4 xl:grid-cols-2">
      <SectionPanel title="Kebijakan payroll" description="Versi baru tidak dapat diubah lagi setelah dibuat, dan dikunci ke periode saat periodenya dibuat.">
        {data.canConfigure ? <form action={form => act(() => createPayrollPolicyAction(form), result => `Kebijakan payroll v${result.version} dibuat.`, () => policyDraft.clear())} className="grid gap-3 border-b border-slate-100 p-4">
          {policyDraft.restored ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
            <span>Draf kebijakan yang belum disimpan dipulihkan.</span>
            <div className="flex gap-2">
              <button type="button" onClick={policyDraft.dismissRestored} className="font-bold underline">Lanjutkan</button>
              <button type="button" onClick={policyDraft.clear} className="font-bold underline">Kosongkan</button>
            </div>
          </div> : null}
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Tanggal efektif<input name="effectiveFrom" type="date" required value={policy.effectiveFrom} onChange={event => patchPolicy({ effectiveFrom: event.target.value })} className={`mt-1.5 ${field}`} /></label><label className="text-xs font-bold">Mode gaji tetap<select name="fixedSalaryMode" value={policy.mode} onChange={event => patchPolicy({ mode: event.target.value as PolicyDraft['mode'] })} className={`mt-1.5 ${field}`}><option value="UNCHANGED">Tidak berubah</option><option value="DEDUCT_ABSENCE">Potong proporsional absen</option><option value="ATTENDANCE_THRESHOLD">Threshold kehadiran</option></select></label></div>
          <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold">Honor substitusi (%)<input name="substitutePercent" type="number" min={0} max={100} required value={policy.substitutePercent} onChange={event => patchPolicy({ substitutePercent: event.target.value })} className={`mt-1.5 ${field}`} /></label><label className="text-xs font-bold">Tarif sesi default<div className="mt-1.5"><RupiahInput name="defaultSessionRateRupiah" value={policy.defaultSessionRate} onValueChange={next => patchPolicy({ defaultSessionRate: next })} min={0} /></div></label>{policy.mode === 'ATTENDANCE_THRESHOLD' ? <label className="text-xs font-bold">Threshold (%)<input name="thresholdPercent" type="number" min={1} max={100} required value={policy.thresholdPercent} onChange={event => patchPolicy({ thresholdPercent: event.target.value })} className={`mt-1.5 ${field}`} /></label> : <input type="hidden" name="thresholdPercent" value="" />}</div>
          <button disabled={pending} className="min-h-11 rounded-lg bg-slate-900 text-sm font-bold text-white disabled:opacity-50">Simpan versi kebijakan</button>
        </form> : null}
        <div data-tour="policy" className="max-h-72 divide-y divide-slate-100 overflow-y-auto">{data.policies.map((policy: any) => <article key={policy.id} className="flex items-start justify-between gap-3 px-4 py-3 text-xs"><div><strong>Versi {policy.version} · {policy.fixed_salary_mode}</strong><p className="mt-1 text-slate-500">Efektif {policy.effective_from} · substitusi {policy.substitute_percent}%</p></div><strong className="tabular-nums">{rupiah(policy.default_session_rate_rupiah)}<small className="block font-normal text-slate-400">tarif default</small></strong></article>)}</div>
      </SectionPanel>

      <SectionPanel title="Kompensasi guru" description="Kenaikan gaji dicatat sebagai baris efektif baru; angka lama tetap utuh agar periode lampau tetap dapat ditelusuri." action={data.canConfigure ? <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => act(syncTeachersAction, result => `${result.count} snapshot guru disinkronkan.`)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold"><CloudArrowUp />Sinkron guru</button>
        <button type="button" onClick={() => setImportMode(mode => mode === 'compensation' ? null : 'compensation')} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold"><FileXls />{importMode === 'compensation' ? 'Tutup impor' : 'Impor Excel'}</button>
      </div> : null}>
        {data.canConfigure ? <form action={form => act(() => createTeacherCompensationAction(form), 'Kompensasi guru disimpan.')} className="grid gap-3 border-b border-slate-100 p-4">
          <label className="text-xs font-bold">Guru<select name="teacherId" required defaultValue="" className={`mt-1.5 ${field}`}><option value="" disabled>Pilih guru</option>{data.teachers.map((teacher: any) => <option key={teacher.id} value={teacher.id}>{teacher.nama_lengkap}{teacher.kode_guru ? ` · ${teacher.kode_guru}` : ''}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold">Efektif mulai<input name="effectiveFrom" type="date" required className={`mt-1.5 ${field}`} /></label><label className="text-xs font-bold">Gaji tetap<div className="mt-1.5"><RupiahInput name="fixedSalaryRupiah" min={0} /></div></label><label className="text-xs font-bold">Tarif sesi opsional<div className="mt-1.5"><RupiahInput name="sessionRateRupiah" min={0} hint="Kosongkan untuk memakai tarif default kebijakan." /></div></label></div>
          <button disabled={pending} className="min-h-11 rounded-lg bg-emerald-700 text-sm font-bold text-white disabled:opacity-50">Tambah kompensasi efektif</button>
        </form> : null}
        <div data-tour="compensation" className="max-h-72 divide-y divide-slate-100 overflow-y-auto">{data.compensation.length ? data.compensation.map((row: any) => <article key={row.id} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-xs"><div><strong>{row.teacher_name}</strong><p className="text-slate-500">Efektif {row.effective_from}</p></div><div className="text-right"><strong>{rupiah(row.fixed_salary_rupiah)}</strong><p className="text-slate-500">Sesi {row.session_rate_rupiah == null ? 'default' : rupiah(row.session_rate_rupiah)}</p></div></article>) : <EmptyState icon={CloudArrowUp} title="Belum ada kompensasi guru" description="Tambahkan gaji tetap dan tarif sesi tiap guru sebelum payroll dapat dihitung." />}</div>
      </SectionPanel>
    </section>

    {importMode === 'compensation' ? <BulkImport<Omit<CompensationImportRow, 'row'>>
      title="Impor massal kompensasi guru"
      description="Satu baris per guru per tanggal efektif. Baris baru menambah riwayat, tidak menimpa angka lama."
      templateName="Template_Kompensasi_Guru"
      sheetName="Kompensasi"
      disabled={!data.canConfigure}
      columns={[
        { key: 'guru', label: 'Kode guru atau nama lengkap', example: data.teachers[0]?.kode_guru || data.teachers[0]?.nama_lengkap || 'G-001' },
        { key: 'efektif', label: 'Efektif mulai (YYYY-MM-DD)', example: '2026-09-01' },
        { key: 'gajitetap', label: 'Gaji tetap', example: 1_500_000 },
        { key: 'tarifsesi', label: 'Tarif sesi (kosongkan = default)', example: '' },
      ]}
      note={<>
        <p className="font-bold text-slate-900">Yang perlu diperhatikan</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>Isi <strong>kode guru</strong> bila ada nama yang kembar — nama ganda ditolak agar gaji tidak masuk ke orang yang salah.</li>
          <li>Menaikkan gaji berarti menambah baris efektif baru, bukan mengubah baris lama. Periode yang sudah dihitung tetap memakai angka lamanya.</li>
          <li>Kolom tarif sesi boleh dikosongkan; artinya memakai tarif default dari kebijakan yang berlaku.</li>
        </ul>
      </>}
      parseRow={get => {
        const teacher = resolveTeacher(asText(get('guru')))
        if ('error' in teacher) return { error: teacher.error }
        const effectiveFrom = asDateISO(get('efektif'))
        if (!effectiveFrom) return { error: 'Tanggal efektif harus berformat YYYY-MM-DD.' }
        const fixedSalaryRupiah = asInteger(get('gajitetap'))
        if (fixedSalaryRupiah === null || fixedSalaryRupiah < 0) return { error: 'Gaji tetap harus angka bulat non-negatif.' }
        const rateText = asText(get('tarifsesi'))
        const sessionRateRupiah = rateText ? asInteger(rateText) : null
        if (rateText && (sessionRateRupiah === null || sessionRateRupiah < 0)) return { error: 'Tarif sesi harus angka bulat non-negatif, atau dikosongkan.' }
        return { value: { teacherId: teacher.id, effectiveFrom, fixedSalaryRupiah, sessionRateRupiah } }
      }}
      onSubmit={values => importCompensationAction(values)}
    /> : null}

    <SectionPanel title="Absensi mengajar" description="Petugas mencatat tiap sesi; checker memverifikasi setiap baris sebelum periode dapat dikunci."
      action={data.canConfigure && openPeriods.length ? <button type="button" onClick={() => setImportMode(mode => mode === 'attendance' ? null : 'attendance')} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold"><FileXls />{importMode === 'attendance' ? 'Tutup impor' : 'Impor Excel'}</button> : null}>
      <div className="border-b border-slate-100 p-3"><select value={attendancePeriod} onChange={event => setAttendancePeriod(event.target.value)} className={`${field} sm:w-64`}><option value="">Semua periode</option>{data.periods.map((period: any) => <option key={period.id} value={period.id}>{period.period_key} · {period.attendance_status}</option>)}</select></div>
      {data.canConfigure && openPeriods.length ? <form action={form => act(() => saveTeachingAttendanceAction(form), 'Absensi mengajar disimpan dan menunggu verifikasi.')} className="grid gap-3 border-b border-slate-100 bg-slate-50/50 p-4">
        <div className="grid gap-3 lg:grid-cols-4"><label className="text-xs font-bold">Periode<select name="payrollPeriodId" required value={openPeriods.some((row: any) => row.id === attendancePeriod) ? attendancePeriod : ''} onChange={event => setAttendancePeriod(event.target.value)} className={`mt-1.5 ${field}`}><option value="" disabled>Pilih periode terbuka</option>{openPeriods.map((period: any) => <option key={period.id} value={period.id}>{period.period_key}</option>)}</select></label><label className="text-xs font-bold">Tanggal sesi<input name="sessionDate" type="date" required className={`mt-1.5 ${field}`} /></label><label className="text-xs font-bold">Referensi jadwal<input name="scheduleReference" required minLength={3} placeholder="Kelas/mapel/jam" className={`mt-1.5 ${field}`} /></label><label className="text-xs font-bold">Status<select name="status" value={attendanceStatus} onChange={event => setAttendanceStatus(event.target.value as typeof attendanceStatus)} className={`mt-1.5 ${field}`}><option value="PRESENT">Hadir</option><option value="ABSENT">Absen</option><option value="HOLIDAY">Libur</option><option value="SUBSTITUTE">Digantikan</option></select></label></div>
        <div className="grid gap-3 lg:grid-cols-3"><label className="text-xs font-bold">Guru terjadwal<select name="scheduledTeacherId" required defaultValue="" className={`mt-1.5 ${field}`}><option value="" disabled>Pilih guru</option>{data.teachers.map((teacher: any) => <option key={teacher.id} value={teacher.id}>{teacher.nama_lengkap}</option>)}</select></label>{attendanceStatus === 'SUBSTITUTE' ? <label className="text-xs font-bold">Guru aktual / pengganti<select name="actualTeacherId" required defaultValue="" className={`mt-1.5 ${field}`}><option value="" disabled>Pilih guru pengganti</option>{data.teachers.map((teacher: any) => <option key={teacher.id} value={teacher.id}>{teacher.nama_lengkap}</option>)}</select></label> : <input type="hidden" name="actualTeacherId" value="" />}<label className="text-xs font-bold">Catatan<input name="notes" placeholder="Opsional" className={`mt-1.5 ${field}`} /></label></div>
        <button disabled={pending} className="min-h-11 rounded-lg bg-emerald-700 text-sm font-bold text-white disabled:opacity-50">Simpan absensi</button>
      </form> : null}
      {data.canCheck && unverifiedVisible.length > 1 ? <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
        <button type="button" onClick={() => setSelectedAttendance(new Set(unverifiedVisible.map((row: any) => row.id)))} className="font-bold text-blue-700 underline">Pilih semua {unverifiedVisible.length} yang belum diverifikasi</button>
        <span>Periode baru bisa dikunci setelah seluruh barisnya terverifikasi.</span>
      </div> : null}
      <div data-tour="attendance" className="divide-y divide-slate-100">{visibleAttendance.length ? visibleAttendance.map((row: any) => <article key={row.id} className="grid gap-3 p-4 text-xs lg:grid-cols-[auto_130px_1fr_150px_150px_auto] lg:items-center">
        {data.canCheck && !row.verified_at
          ? <input type="checkbox" aria-label={`Pilih absensi ${row.session_date} ${row.schedule_reference}`} checked={selectedAttendance.has(row.id)} onChange={() => setSelectedAttendance(current => {
            const next = new Set(current)
            if (next.has(row.id)) next.delete(row.id); else next.add(row.id)
            return next
          })} className="h-5 w-5 shrink-0 accent-emerald-700" />
          : <span aria-hidden className="hidden h-5 w-5 lg:block" />}
        <div><strong>{row.session_date}</strong><span className="block text-slate-500">{row.period_key}</span></div>
        <div><strong>{row.schedule_reference}</strong><span className="block text-slate-500">{row.scheduled_teacher_name}{row.status === 'SUBSTITUTE' ? ` → ${row.actual_teacher_name}` : ''}</span></div>
        <StatusBadge tone={row.status === 'PRESENT' ? 'emerald' : row.status === 'SUBSTITUTE' ? 'blue' : row.status === 'ABSENT' ? 'red' : 'slate'}>{row.status}</StatusBadge>
        <div>{row.verified_at ? <span className="flex items-center gap-1 font-bold text-emerald-700"><CheckCircle />Terverifikasi</span> : <span className="flex items-center gap-1 font-bold text-amber-700"><Warning />Menunggu</span>}<span className="block text-slate-400">{row.notes || 'Tanpa catatan'}</span></div>
        <div className="flex gap-2">{data.canCheck && !row.verified_at ? <button disabled={pending} onClick={() => act(() => verifyTeachingAttendanceAction(row.id), 'Absensi diverifikasi.')} className="min-h-10 rounded-lg bg-slate-900 px-3 font-bold text-white disabled:opacity-50">Verifikasi</button> : null}{data.canConfigure && !row.verified_at ? <button aria-label="Hapus absensi" disabled={pending} onClick={() => act(() => deleteTeachingAttendanceAction(row.id), 'Absensi dihapus.')} className="grid min-h-10 w-10 place-items-center rounded-lg border border-red-200 text-red-700 disabled:opacity-50"><Trash /></button> : null}</div>
      </article>) : <EmptyState icon={CheckCircle} title="Belum ada absensi pada periode ini" description="Catat sesi mengajar lewat formulir di atas. Periode tanpa absensi tidak dapat dikunci." />}</div>
    </SectionPanel>

    <BulkActionBar count={chosenAttendance.length} noun="absensi" onClear={() => setSelectedAttendance(new Set())}>
      <button type="button" disabled={pending} onClick={() => runBatch(() => verifyAttendanceBatchAction(chosenAttendance.map((row: any) => row.id)), 'diverifikasi')}
        className="min-h-9 rounded-lg bg-white px-3 text-xs font-bold text-slate-900 disabled:opacity-50">Verifikasi {chosenAttendance.length}</button>
    </BulkActionBar>

    {importMode === 'attendance' ? <BulkImport<Omit<AttendanceImportRow, 'row'>>
      title="Impor massal absensi mengajar"
      description="Satu baris per sesi mengajar. Hanya periode yang absensinya masih terbuka yang dapat diisi."
      templateName="Template_Absensi_Mengajar"
      sheetName="Absensi"
      disabled={!data.canConfigure || !openPeriods.length}
      disabledReason={!openPeriods.length ? 'Tidak ada periode dengan absensi terbuka. Buat periode baru lebih dulu.' : undefined}
      columns={[
        { key: 'periode', label: 'Periode (YYYY-MM)', example: openPeriods[0]?.period_key || '2026-09' },
        { key: 'tanggal', label: 'Tanggal sesi (YYYY-MM-DD)', example: '2026-09-03' },
        { key: 'jadwal', label: 'Referensi jadwal', example: 'Kelas 1A / Nahwu / Jam 2' },
        { key: 'guru', label: 'Guru terjadwal', example: data.teachers[0]?.kode_guru || data.teachers[0]?.nama_lengkap || 'G-001' },
        { key: 'status', label: 'Status', example: 'Hadir' },
        { key: 'pengganti', label: 'Guru pengganti (jika digantikan)', example: '' },
        { key: 'catatan', label: 'Catatan', example: '' },
      ]}
      note={<>
        <p className="font-bold text-slate-900">Yang perlu diperhatikan</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>Status boleh ditulis <strong>Hadir</strong>, <strong>Absen</strong>, <strong>Libur</strong>, atau <strong>Digantikan</strong>.</li>
          <li>Guru pengganti hanya wajib untuk status Digantikan; pada status lain kolom itu diabaikan.</li>
          <li>Baris masuk sebagai <strong>belum diverifikasi</strong>. Periode tidak bisa dikunci sampai seluruhnya diverifikasi checker — verifikasi juga bisa dilakukan massal dari daftar di bawah.</li>
        </ul>
      </>}
      parseRow={get => {
        const periodKey = asText(get('periode'))
        const period = openPeriods.find((item: any) => item.period_key === periodKey)
        if (!period) {
          const locked = data.periods.find((item: any) => item.period_key === periodKey)
          return { error: locked ? `Periode ${periodKey} absensinya sudah dikunci.` : `Periode ${periodKey || '(kosong)'} belum dibuat.` }
        }
        const sessionDate = asDateISO(get('tanggal'))
        if (!sessionDate) return { error: 'Tanggal sesi harus berformat YYYY-MM-DD.' }
        if (!sessionDate.startsWith(periodKey)) return { error: `Tanggal ${sessionDate} berada di luar periode ${periodKey}.` }
        const scheduleReference = asText(get('jadwal'))
        if (scheduleReference.length < 3) return { error: 'Referensi jadwal minimal 3 karakter (kelas/mapel/jam).' }
        const teacher = resolveTeacher(asText(get('guru')))
        if ('error' in teacher) return { error: teacher.error }
        const statusText = asText(get('status')).toLowerCase()
        const status = ATTENDANCE_STATUS[statusText]
        if (!status) return { error: `Status "${asText(get('status')) || '(kosong)'}" tidak dikenal. Pakai Hadir, Absen, Libur, atau Digantikan.` }
        let actualTeacherId: string | null = null
        if (status === 'SUBSTITUTE') {
          const substitute = resolveTeacher(asText(get('pengganti')))
          if ('error' in substitute) return { error: `Guru pengganti: ${substitute.error}` }
          if (substitute.id === teacher.id) return { error: 'Guru pengganti tidak boleh sama dengan guru terjadwal.' }
          actualTeacherId = substitute.id
        }
        return {
          value: {
            payrollPeriodId: String(period.id), sessionDate, scheduleReference,
            scheduledTeacherId: teacher.id, actualTeacherId, status, notes: asText(get('catatan')) || null,
          },
        }
      }}
      onSubmit={values => importAttendanceAction(values)}
    /> : null}

    <SectionPanel title="Rincian payroll per guru" description="Komponen gaji, honor sesi, potongan, nilai bersih, dan status akrual.">
      {/* Versi kartu untuk layar sempit; tabel lebar hanya dipakai dari sm ke atas
          supaya angka gaji tidak perlu digeser-geser untuk dibaca. */}
      <div className="divide-y divide-slate-100 sm:hidden">{data.items.length ? data.items.map((item: any) => <article key={item.id} className="space-y-2 px-4 py-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <div><strong>{item.teacher_name}</strong><p className="text-slate-500">{item.period_key}</p></div>
          <StatusBadge tone={item.status === 'PAID' ? 'emerald' : item.status === 'APPROVED' ? 'blue' : item.status === 'FAILED' ? 'red' : 'amber'}>{item.status}</StatusBadge>
        </div>
        <dl className="grid grid-cols-2 gap-1 tabular-nums">
          <dt className="text-slate-500">Gaji tetap</dt><dd className="text-right">{rupiah(item.fixed_salary_rupiah)}</dd>
          <dt className="text-slate-500">Honor sesi</dt><dd className="text-right">{rupiah(item.session_honor_rupiah)}</dd>
          <dt className="text-slate-500">Potongan</dt><dd className="text-right text-red-700">{rupiah(item.deduction_rupiah)}</dd>
          <dt className="font-bold text-slate-700">Bersih</dt><dd className="text-right font-bold">{rupiah(item.net_rupiah)}</dd>
        </dl>
      </article>) : <EmptyState icon={CheckCircle} title="Belum ada payroll yang dihitung" description="Kunci absensi sebuah periode lalu tekan Hitung payroll untuk melihat rinciannya." />}</div>
      <div data-tour="items" className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Periode / guru</th><th className="px-4 py-2.5 text-right">Gaji tetap</th><th className="px-4 py-2.5 text-right">Honor sesi</th><th className="px-4 py-2.5 text-right">Potongan</th><th className="px-4 py-2.5 text-right">Bersih</th><th className="px-4 py-2.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data.items.length ? data.items.map((item: any) => <tr key={item.id}><td className="px-4 py-3"><strong>{item.teacher_name}</strong><span className="block text-slate-500">{item.period_key}</span></td><td className="px-4 py-3 text-right tabular-nums">{rupiah(item.fixed_salary_rupiah)}</td><td className="px-4 py-3 text-right tabular-nums">{rupiah(item.session_honor_rupiah)}</td><td className="px-4 py-3 text-right tabular-nums text-red-700">{rupiah(item.deduction_rupiah)}</td><td className="px-4 py-3 text-right font-bold tabular-nums">{rupiah(item.net_rupiah)}</td><td className="px-4 py-3"><StatusBadge tone={item.status === 'PAID' ? 'emerald' : item.status === 'APPROVED' ? 'blue' : item.status === 'FAILED' ? 'red' : 'amber'}>{item.status}</StatusBadge></td></tr>) : <tr><td colSpan={6}><EmptyState icon={CheckCircle} title="Belum ada payroll yang dihitung" description="Kunci absensi sebuah periode lalu tekan Hitung payroll untuk melihat rinciannya." /></td></tr>}</tbody></table></div>
    </SectionPanel>

    <ConfirmAction
      open={Boolean(confirmLock)}
      title={`Kunci absensi periode ${confirmLock?.period_key ?? ''}?`}
      description="Setelah dikunci, tidak ada absensi yang bisa ditambah, diubah, atau dihapus pada periode ini."
      impact={[
        `${confirmLock?.attendance_count ?? 0} sesi akan menjadi dasar perhitungan payroll.`,
        'Perhitungan payroll baru dapat dijalankan setelah penguncian.',
        'Membatalkan penguncian tidak tersedia dari halaman ini.',
      ]}
      confirmLabel="Kunci absensi"
      pending={pending}
      onCancel={() => setConfirmLock(null)}
      onConfirm={() => {
        const target = confirmLock
        setConfirmLock(null)
        act(() => lockPayrollAttendanceAction(target.id), `Absensi periode ${target.period_key} dikunci.`)
      }}
    />

    <ConfirmAction
      open={Boolean(confirmApprove)}
      title={`Setujui batch payroll ${confirmApprove?.period_key ?? ''}?`}
      description="Persetujuan memposting akrual gaji ke ledger untuk seluruh guru pada periode ini."
      impact={[
        'Jurnal akrual diposting dan tidak dapat dihapus — koreksi hanya lewat reversal.',
        'Kewajiban gaji tercatat, tetapi uangnya belum berpindah. Pencairan dilakukan dari halaman Payout.',
        'Periksa dulu rincian bersih tiap guru di tabel bawah.',
      ]}
      confirmPhrase="SETUJUI"
      confirmLabel="Setujui batch"
      pending={pending}
      onCancel={() => setConfirmApprove(null)}
      onConfirm={() => {
        const target = confirmApprove
        setConfirmApprove(null)
        act(() => approvePayrollAction(target.id), `Batch payroll ${target.period_key} disetujui dan akrualnya diposting.`)
      }}
    />
  </div>
}
