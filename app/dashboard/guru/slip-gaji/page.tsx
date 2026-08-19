import { guardPage } from '@/lib/auth/guard'
import { financeQuery as query, queryOne } from '@/lib/db'
import { PrintButton } from './_print-button'

export const dynamic = 'force-dynamic'

const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

type SlipRow = {
  id: string
  period_key: string
  monthly_salary_rupiah: number
  alfa_sesi: number
  badal_sesi: number
  wajib_sesi: number
  deduction_rupiah: number
  net_rupiah: number
  status: string
  note: string | null
}

export default async function TeacherPayslipPage() {
  const session = await guardPage('/dashboard/guru/slip-gaji')
  const user = await queryOne<{ guru_id: number | null }>(`SELECT guru_id FROM users WHERE id=?`, [session.id])

  // Gaji bulanan dikurangi potongan sesi alfa dan sesi badal. Jumlah sesinya
  // berasal dari rekap absensi guru, jadi angka di slip ini bisa dicocokkan
  // langsung dengan rekap yang sama - termasuk pembaginya, sesi wajib.
  const items = user?.guru_id
    ? await query<SlipRow>(`SELECT i.id,p.period_key,i.monthly_salary_rupiah,i.alfa_sesi,i.badal_sesi,i.wajib_sesi,
        i.deduction_rupiah,i.net_rupiah,i.status,i.note
        FROM finance_payroll_items i
        JOIN finance_payroll_periods p ON p.id=i.payroll_period_id
        WHERE i.teacher_id=? AND i.status IN ('DISETUJUI','DIBAYAR')
        ORDER BY p.period_key DESC`, [String(user.guru_id)])
    : []

  return <main className="space-y-5 p-4 md:p-8 print:p-0">
    <header className="flex items-start justify-between">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Portal Guru</p>
        <h1 className="text-2xl font-bold">Slip Gaji</h1>
      </div>
      <PrintButton />
    </header>

    {items.length ? items.map(item => <article key={item.id} className="break-inside-avoid rounded-2xl border bg-white p-5 print:mb-6 print:rounded-none">
      <div className="flex justify-between border-b pb-3">
        <strong>Periode {item.period_key}</strong>
        <span>{item.status === 'DIBAYAR' ? 'Sudah dibayar' : 'Disetujui'}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <dt>Gaji bulanan</dt>
        <dd className="text-right">{rupiah(item.monthly_salary_rupiah)}</dd>

        {Number(item.wajib_sesi) > 0 ? <>
          <dt>Sesi wajib</dt>
          <dd className="text-right">{item.wajib_sesi} sesi</dd>
        </> : null}

        {Number(item.alfa_sesi) > 0 ? <>
          <dt>Sesi alfa</dt>
          <dd className="text-right">{item.alfa_sesi} sesi</dd>
        </> : null}

        {Number(item.badal_sesi) > 0 ? <>
          <dt>Sesi badal</dt>
          <dd className="text-right">{item.badal_sesi} sesi</dd>
        </> : null}

        <dt>Potongan</dt>
        <dd className="text-right">
          {Number(item.deduction_rupiah) > 0 ? `− ${rupiah(item.deduction_rupiah)}` : 'Tidak ada potongan'}
        </dd>

        <dt className="border-t pt-2 font-bold">Bersih</dt>
        <dd className="border-t pt-2 text-right font-bold">{rupiah(item.net_rupiah)}</dd>
      </dl>
      {item.note ? <p className="mt-3 border-t pt-3 text-xs text-slate-500">Catatan: {item.note}</p> : null}
    </article>) : <p className="rounded-2xl border bg-white p-5 text-sm text-slate-500">Belum ada slip gaji yang disetujui.</p>}
  </main>
}
