'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, Calculator, CloudArrowUp, Lock, LockOpen, Warning } from '@phosphor-icons/react'
import {
  approvePayrollAction, calculatePayrollAction, createPayrollPeriodAction,
  importCompensationAction, setTeacherCompensationAction, syncTeachersAction,
  type CompensationImportRow,
} from './actions'
import { BulkImport, asDateISO, asInteger, asText } from '../_components/bulk-import'
import { RupiahInput } from '../_components/finance-inputs'
import {
  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceModal, FinanceTabs, FormField, MetricCard,
  ResultBanner, SectionPanel, StatusBadge, type FinanceResult,
} from '../_components/finance-ui'

const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const TONE: Record<string, 'slate' | 'amber' | 'emerald' | 'blue'> = {
  DRAFT: 'slate', DIHITUNG: 'amber', DISETUJUI: 'emerald', DIBAYAR: 'blue',
}

export function PayrollClient({ data }: { data: any }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [periodKey, setPeriodKey] = useState(() => new Date().toISOString().slice(0, 7))
  const [selectedPeriod, setSelectedPeriod] = useState<string>(data.periods[0]?.id || '')
  const [confirmApprove, setConfirmApprove] = useState<any>(null)
  const [tab, setTab] = useState<'perhitungan' | 'kompensasi'>('perhitungan')
  const [modal, setModal] = useState<'kompensasi' | 'impor-kompensasi' | null>(null)

  const period = data.periods.find((row: any) => row.id === selectedPeriod)
  const items = useMemo(
    () => data.items.filter((row: any) => row.payroll_period_id === selectedPeriod),
    [data.items, selectedPeriod])

  const totalBersih = items.reduce((sum: number, row: any) => sum + Number(row.net_rupiah || 0), 0)
  const totalPotongan = items.reduce((sum: number, row: any) => sum + Number(row.deduction_rupiah || 0), 0)
  const adaPotongan = items.filter((row: any) => Number(row.deduction_rupiah) > 0).length

  const act = (work: () => Promise<any>, success: string) => startTransition(async () => {
    try {
      const outcome = await work()
      if (!outcome?.success) {
        const message = outcome?.error || 'Tindakan gagal.'
        setResult({ tone: 'error', message }); toast.error(message); return
      }
      setResult({ tone: 'success', message: success }); toast.success(success); router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tindakan gagal.'
      setResult({ tone: 'error', message }); toast.error(message)
    }
  })

  return <div className="space-y-4 sm:space-y-5">
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Guru pada periode" value={String(items.length)} detail={period?.period_key || 'Belum ada periode'} icon="listChecks" tone="blue" />
      <MetricCard label="Total gaji bersih" value={rupiah(totalBersih)} detail="Setelah potongan" icon="fileSpreadsheet" tone="emerald" />
      <MetricCard label="Total potongan" value={rupiah(totalPotongan)} detail={`${adaPotongan} guru kena potongan`} icon="listChecks" tone={totalPotongan ? 'amber' : 'emerald'} />
      <MetricCard label="Status periode" value={period?.status || '-'} detail={period?.approved_at ? `Disetujui ${period.approved_at.slice(0, 10)}` : 'Belum disetujui'} icon="checkCircle" tone={period?.status === 'DISETUJUI' ? 'emerald' : 'slate'} />
    </section>

    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <FinanceTabs
      label="Kelompok pekerjaan payroll"
      active={tab}
      onChange={id => setTab(id as typeof tab)}
      tabs={[
        { id: 'perhitungan', label: 'Perhitungan bulanan', hint: 'Pekerjaan bulanan: hitung dari rekap absensi, lalu setujui', badge: data.periods.filter((row: any) => row.status === 'DIHITUNG').length },
        { id: 'kompensasi', label: 'Kompensasi guru', hint: 'Data setup: gaji bulanan dan tarif potongan', badge: 0 },
      ]}
    />

    {tab === 'perhitungan' ? <>
    <SectionPanel title="Periode bulanan" description="Buat periode, hitung, lalu setujui. Jumlah sesi alfa dan badal ditarik dari rekap absensi guru yang sudah dikunci sekpen. Persetujuan mencatat kewajiban gaji di pembukuan — pencairan uangnya dilakukan dari halaman Payout.">
      <div className="flex flex-wrap items-end gap-3 p-4">
        <FormField label="Periode baru">
          <input type="month" value={periodKey} onChange={event => setPeriodKey(event.target.value)} className={FINANCE_FIELD_CLASS} />
        </FormField>
        <button disabled={pending || !data.canConfigure} onClick={() => act(() => createPayrollPeriodAction(periodKey), 'Periode payroll dibuat.')}
          className="min-h-11 rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-50">Buat periode</button>
        <button disabled={pending || !data.canConfigure} onClick={() => act(() => syncTeachersAction(), 'Data guru disinkronkan.')}
          className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50">Sinkronkan guru</button>
      </div>

      <div className="divide-y divide-slate-100 border-t">
        {data.periods.length ? data.periods.map((row: any) => <button key={row.id} onClick={() => setSelectedPeriod(row.id)}
          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm ${row.id === selectedPeriod ? 'bg-emerald-50' : ''}`}>
          <span className="flex items-center gap-2 font-bold">
            {row.absensi_terkunci
              ? <Lock className="h-4 w-4 text-emerald-600" weight="fill" />
              : <LockOpen className="h-4 w-4 text-amber-500" />}
            {row.period_key}
          </span>
          <span className="flex items-center gap-3">
            <span className="text-slate-500">{row.item_count} guru · {rupiah(row.total_net_rupiah)}</span>
            <StatusBadge tone={TONE[row.status] || 'slate'}>{row.status}</StatusBadge>
          </span>
        </button>) : <EmptyState title="Belum ada periode payroll" description="Buat periode bulan berjalan untuk mulai." />}
      </div>
    </SectionPanel>

    {period ? <SectionPanel
      title={`Perhitungan ${period.period_key}`}
      description="Jumlah sesi alfa dan badal ditarik dari rekap absensi guru dan tidak dapat diubah dari halaman ini. Bila ada yang keliru, minta sekpen memperbaikinya di Rekap Kinerja Guru, lalu tekan Hitung lagi."
      action={<div className="flex gap-2">
        <button disabled={pending || !data.canConfigure || period.status === 'DISETUJUI' || !period.absensi_terkunci}
          onClick={() => act(() => calculatePayrollAction(period.id), 'Payroll dihitung ulang dari rekap absensi.')}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-50">
          <Calculator className="h-4 w-4" />Hitung
        </button>
        <button disabled={pending || !data.canCheck || period.status !== 'DIHITUNG' || !items.length || period.absensi_basi}
          onClick={() => setConfirmApprove(period)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">
          <CheckCircle className="h-4 w-4" />Setujui
        </button>
      </div>}>
      <AbsensiBanner period={period} />
      {items.length
        ? <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Guru</th>
                <th className="px-4 py-2 text-right">Gaji bulanan</th>
                <th className="px-4 py-2 text-center">Sesi wajib</th>
                <th className="px-4 py-2 text-center">Sesi alfa</th>
                <th className="px-4 py-2 text-center">Sesi badal</th>
                <th className="px-4 py-2 text-right">Potongan</th>
                <th className="px-4 py-2 text-right">Bersih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row: any) => <PayrollRow key={row.id} row={row} />)}
            </tbody>
            <tfoot className="bg-slate-50 font-bold">
              <tr>
                <td className="px-4 py-2" colSpan={5}>Total</td>
                <td className="px-4 py-2 text-right">{rupiah(totalPotongan)}</td>
                <td className="px-4 py-2 text-right">{rupiah(totalBersih)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        : <EmptyState
          title={period.absensi_terkunci ? 'Belum dihitung' : 'Menunggu rekap absensi dikunci'}
          description={period.absensi_terkunci
            ? 'Tekan Hitung untuk menarik seluruh guru yang punya kompensasi berlaku beserta jumlah sesi alfa dan badalnya.'
            : 'Sekpen belum menyatakan rekap absensi bulan ini final, jadi angkanya masih bisa berubah. Payroll baru bisa dihitung setelah rekap dikunci.'} />}
    </SectionPanel> : null}
    </> : null}

    {tab === 'kompensasi' ? <>
    <SectionPanel
      title="Kompensasi guru"
      description="Gaji bulanan dan tarif potongan per sesi. Satu hari bisa berisi tiga sesi (shubuh, ashar, maghrib), sama seperti rekap absensinya. Tarif potongan 0 berarti guru dibayar penuh berapa pun sesi alfa/badalnya."
      action={data.canConfigure ? <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setModal('impor-kompensasi')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold"><CloudArrowUp className="h-4 w-4" />Impor Excel</button>
        <button type="button" onClick={() => setModal('kompensasi')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white">Tambah kompensasi</button>
      </div> : null}>
      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Guru</th>
              <th className="px-4 py-2">Berlaku dari</th>
              <th className="px-4 py-2 text-right">Gaji bulanan</th>
              <th className="px-4 py-2 text-right">Potongan alfa</th>
              <th className="px-4 py-2 text-right">Potongan badal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.compensation.length ? data.compensation.map((row: any) => <tr key={row.id}>
              <td className="px-4 py-2 font-bold">{row.teacher_name}</td>
              <td className="px-4 py-2">{row.effective_from}</td>
              <td className="px-4 py-2 text-right">{rupiah(row.monthly_salary_rupiah)}</td>
              <td className="px-4 py-2 text-right">{Number(row.alfa_deduction_per_sesi_rupiah) ? rupiah(row.alfa_deduction_per_sesi_rupiah) : <span className="text-slate-400">tidak dipotong</span>}</td>
              <td className="px-4 py-2 text-right">{Number(row.badal_deduction_per_sesi_rupiah) ? rupiah(row.badal_deduction_per_sesi_rupiah) : <span className="text-slate-400">tidak dipotong</span>}</td>
            </tr>) : <tr><td colSpan={5}><EmptyState title="Belum ada kompensasi" description="Isi minimal satu guru sebelum menghitung payroll." /></td></tr>}
          </tbody>
        </table>
      </div>
    </SectionPanel>

    <FinanceModal
      open={modal === 'kompensasi'}
      title="Kompensasi guru"
      description="Tarif potongan 0 berarti guru dibayar penuh berapa pun sesi alfa/badalnya."
      size="lg"
      onClose={() => setModal(null)}>
      <form action={form => { setModal(null); act(() => setTeacherCompensationAction(form), 'Kompensasi guru disimpan.') }} className="grid gap-3 sm:grid-cols-2">
        <FormField label="Guru" required>
          <select name="teacherId" required className={FINANCE_FIELD_CLASS}>
            <option value="">Pilih guru</option>
            {data.teachers.map((row: any) => <option key={row.id} value={String(row.id)}>{row.nama_lengkap}</option>)}
          </select>
        </FormField>
        <FormField label="Berlaku dari" required>
          <input type="date" name="effectiveFrom" required className={FINANCE_FIELD_CLASS} />
        </FormField>
        <FormField label="Gaji bulanan" required>
          <RupiahInput name="monthlySalaryRupiah" defaultValue={0} />
        </FormField>
        <FormField label="Potongan / sesi alfa" hint="Per sesi pengajian, bukan per hari. Kosongkan (0) bila tidak ada potongan">
          <RupiahInput name="alfaDeductionPerSesiRupiah" defaultValue={0} />
        </FormField>
        <FormField label="Potongan / sesi badal" hint="Per sesi pengajian, bukan per hari. Kosongkan (0) bila tidak ada potongan">
          <RupiahInput name="badalDeductionPerSesiRupiah" defaultValue={0} />
        </FormField>
        <div className="sm:col-span-2 xl:col-span-5">
          <button disabled={pending || !data.canConfigure} className="min-h-11 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-50">Simpan kompensasi</button>
        </div>
      </form>
    </FinanceModal>


    <FinanceModal
      open={modal === 'impor-kompensasi'}
      title="Impor massal kompensasi guru"
      size="xl"
      onClose={() => setModal(null)}>
      <div>
        <BulkImport<Omit<CompensationImportRow, 'row'>>
          title="Impor massal kompensasi guru"
          description="Isi gaji bulanan dan tarif potongan banyak guru sekaligus. Tarif potongan dihitung per sesi pengajian dan boleh dikosongkan bila guru dibayar penuh."
          templateName="Template_Kompensasi_Guru"
          sheetName="Kompensasi"
          disabled={!data.canConfigure}
          columns={[
            { key: 'idguru', label: 'ID Guru', example: '12' },
            { key: 'berlakudari', label: 'Berlaku dari', example: '2026-01-01' },
            { key: 'gaji', label: 'Gaji bulanan', example: 2000000 },
            { key: 'potonganalfa', label: 'Potongan per sesi alfa', example: 50000 },
            { key: 'potonganbadal', label: 'Potongan per sesi badal', example: 25000 },
          ]}
          note={<>
            <p className="font-bold text-slate-900">Yang perlu diperhatikan</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Tarif dihitung <strong>per sesi</strong>, bukan per hari. Satu hari bisa berisi tiga sesi (shubuh, ashar, maghrib), jadi tarif harian lama perlu dibagi dulu sebelum diimpor.</li>
              <li>Kolom potongan boleh dikosongkan atau diisi <strong>0</strong>; artinya guru itu dibayar penuh berapa pun sesi alfa/badalnya.</li>
              <li>Baris dengan ID guru yang tidak ada di master guru ditolak, tidak diam-diam dilewati.</li>
              <li>Mengimpor ulang tanggal berlaku yang sama akan menimpa angkanya, bukan membuat baris ganda.</li>
            </ul>
          </>}
          parseRow={get => {
            const teacherId = asText(get('idguru'))
            const effectiveFrom = asDateISO(get('berlakudari'))
            const monthlySalaryRupiah = asInteger(get('gaji'))
            const alfa = asInteger(get('potonganalfa'))
            const badal = asInteger(get('potonganbadal'))
            if (!teacherId) return { error: 'ID guru wajib diisi.' }
            if (!effectiveFrom) return { error: 'Tanggal berlaku tidak valid.' }
            if (monthlySalaryRupiah === null || monthlySalaryRupiah < 0) return { error: 'Gaji bulanan harus angka bulat tidak negatif.' }
            if (alfa !== null && alfa < 0) return { error: 'Potongan per sesi alfa tidak boleh negatif.' }
            if (badal !== null && badal < 0) return { error: 'Potongan per sesi badal tidak boleh negatif.' }
            return {
              value: {
                teacherId, effectiveFrom, monthlySalaryRupiah,
                alfaDeductionPerSesiRupiah: alfa ?? 0,
                badalDeductionPerSesiRupiah: badal ?? 0,
              },
            }
          }}
          onSubmit={importCompensationAction}
        />
      </div>
    </FinanceModal>
    </> : null}

    <ConfirmAction
      open={Boolean(confirmApprove)}
      title={`Setujui payroll ${confirmApprove?.period_key ?? ''}?`}
      description={`${items.length} guru, total bersih ${rupiah(totalBersih)}.`}
      impact={[
        'Kewajiban gaji dicatat di pembukuan sebagai akrual dan tidak dapat diubah lagi.',
        'Rekap absensi bulan ini ikut terkunci permanen — sekpen tidak bisa membukanya lagi untuk koreksi.',
        'Uangnya belum berpindah — pencairan dilakukan terpisah dari halaman Payout.',
      ]}
      confirmLabel="Setujui payroll"
      pending={pending}
      onCancel={() => setConfirmApprove(null)}
      onConfirm={() => {
        const target = confirmApprove
        setConfirmApprove(null)
        act(() => approvePayrollAction(target.id), 'Payroll disetujui dan diakrualkan.')
      }}
    />
  </div>
}

/**
 * Keadaan rekap absensi bulan ini. Bendahara tidak bisa berbuat apa-apa untuk
 * memperbaikinya sendiri, jadi yang ditampilkan adalah siapa yang harus
 * dihubungi, bukan tombol yang menggodanya untuk menimpa angka orang lain.
 */
function AbsensiBanner({ period }: { period: any }) {
  if (period.absensi_basi) {
    return <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Warning className="mt-0.5 h-5 w-5 flex-none" />
      <p>
        <span className="font-black">Rekap absensi sudah dikoreksi setelah payroll ini dihitung.</span>{' '}
        Angka di bawah sudah kedaluwarsa. Tekan <strong>Hitung</strong> untuk menariknya ulang sebelum menyetujui.
      </p>
    </div>
  }
  if (!period.absensi_terkunci) {
    return <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <LockOpen className="mt-0.5 h-5 w-5 flex-none" />
      <p>
        <span className="font-black">Rekap absensi {period.period_key} belum dikunci sekpen.</span>{' '}
        Angkanya masih bisa berubah, jadi payroll belum boleh dihitung. Mintakan penguncian di halaman Rekap Kinerja Guru.
      </p>
    </div>
  }
  return <div className="flex items-start gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
    <Lock className="mt-0.5 h-5 w-5 flex-none" weight="fill" />
    <p>
      Rekap absensi {period.period_key} final
      {period.absensi_locked_by_nama ? ` menurut ${period.absensi_locked_by_nama}` : ''}
      {period.absensi_locked_at ? ` sejak ${String(period.absensi_locked_at).slice(0, 16).replace('T', ' ')}` : ''}.
    </p>
  </div>
}

/** Satu baris guru. Seluruhnya hasil hitungan - tidak ada yang bisa diketik di sini. */
function PayrollRow({ row }: { row: any }) {
  const angka = (value: number, tone: string) => Number(value)
    ? <span className={`font-bold ${tone}`}>{Number(value)}</span>
    : <span className="text-slate-300">0</span>

  return <tr>
    <td className="px-4 py-2 font-bold">{row.teacher_name}</td>
    <td className="px-4 py-2 text-right">{rupiah(row.monthly_salary_rupiah)}</td>
    <td className="px-4 py-2 text-center text-slate-500">{Number(row.wajib_sesi) || 0}</td>
    <td className="px-4 py-2 text-center">{angka(row.alfa_sesi, 'text-red-700')}</td>
    <td className="px-4 py-2 text-center">{angka(row.badal_sesi, 'text-amber-700')}</td>
    <td className="px-4 py-2 text-right">{Number(row.deduction_rupiah) ? <span className="text-red-700">−{rupiah(row.deduction_rupiah)}</span> : <span className="text-slate-400">—</span>}</td>
    <td className="px-4 py-2 text-right font-bold">{rupiah(row.net_rupiah)}</td>
  </tr>
}
