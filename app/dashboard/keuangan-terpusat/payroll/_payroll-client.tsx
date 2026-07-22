'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTransition } from 'react'
import { toast } from 'sonner'
import { approvePayrollAction, calculatePayrollAction, createPayrollPeriodAction, lockPayrollAttendanceAction } from './actions'

export function PayrollClient({ periods }: { periods: any[] }) {
  const [pending, start] = useTransition()
  const act = (fn: () => Promise<any>) => start(async () => {
    const result = await fn()
    if ('error' in result) toast.error(result.error)
    else toast.success('Payroll diperbarui.')
  })

  return <section className="rounded-xl border bg-white sm:rounded-2xl">
    <form className="grid gap-2 border-b p-4 sm:flex" action={form => act(() => createPayrollPeriodAction(String(form.get('period'))))}>
      <input name="period" type="month" required className="min-h-11 w-full rounded-lg border px-3 py-2 sm:min-h-0 sm:w-auto" />
      <button disabled={pending} className="min-h-11 w-full rounded-lg bg-emerald-700 px-3 py-2 text-white sm:min-h-0 sm:w-auto">Buat periode</button>
    </form>
    {periods.length ? periods.map(period => <div key={period.id} className="grid gap-3 border-b p-4 last:border-0 md:grid-cols-[1fr_auto] md:gap-2">
      <span className="font-semibold">{period.period_key}<small className="mt-1 block break-words font-normal text-slate-500">Absensi {period.attendance_status} · Payroll {period.payroll_status}</small></span>
      <div className="grid gap-2 sm:flex">
        {period.attendance_status === 'OPEN' && <button disabled={pending} onClick={() => act(() => lockPayrollAttendanceAction(period.id))} className="min-h-11 w-full rounded border px-3 text-sm sm:min-h-0 sm:w-auto sm:px-2">Kunci absensi</button>}
        {period.attendance_status === 'LOCKED' && period.payroll_status === 'DRAFT' && <button disabled={pending} onClick={() => act(() => calculatePayrollAction(period.id))} className="min-h-11 w-full rounded border px-3 text-sm sm:min-h-0 sm:w-auto sm:px-2">Hitung</button>}
        {period.payroll_status === 'CALCULATED' && <button disabled={pending} onClick={() => act(() => approvePayrollAction(period.id))} className="min-h-11 w-full rounded bg-emerald-700 px-3 text-sm text-white sm:min-h-0 sm:w-auto sm:px-2">Setujui batch</button>}
      </div>
    </div>) : <p className="p-4 text-sm text-slate-500">Belum ada periode payroll.</p>}
  </section>
}
