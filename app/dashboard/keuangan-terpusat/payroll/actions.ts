'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { financeQuery, query, queryOne } from '@/lib/db'
import { financeCapabilities, requireFinanceAccess } from '@/lib/finance/access'
import {
  approvePayrollPeriod,
  calculatePayrollPeriod,
  createPayrollPeriod,
  setPayrollDays,
  setTeacherCompensation,
} from '@/lib/finance/payroll'
import { syncFinanceTeacherSnapshots } from '@/lib/finance/snapshots'
import { runBulk } from '@/lib/finance/bulk'

const PATH = '/dashboard/keuangan-terpusat/payroll'
const refresh = () => revalidatePath(PATH)

export async function createPayrollPeriodAction(periodKey: string) {
  const s = await requireFinanceAccess('CONFIGURE')
  const r = await createPayrollPeriod(periodKey, s.id)
  if (r.success) refresh()
  return r
}

export async function calculatePayrollAction(id: string) {
  const s = await requireFinanceAccess('CONFIGURE')
  const r = await calculatePayrollPeriod(id, s.id)
  if (r.success) refresh()
  return r
}

export async function approvePayrollAction(id: string) {
  const s = await requireFinanceAccess('CHECK')
  const r = await approvePayrollPeriod(id, s.id)
  if (r.success) refresh()
  return r
}

/** Dua angka per guru per bulan - ini satu-satunya input rutin payroll. */
export async function setPayrollDaysAction(input: { itemId: string; alfaDays: number; badalDays: number; note?: string | null }) {
  const s = await requireFinanceAccess('CONFIGURE')
  const r = await setPayrollDays({ ...input, actorId: s.id })
  if (r.success) refresh()
  return r
}

export async function setTeacherCompensationAction(form: FormData) {
  const s = await requireFinanceAccess('CONFIGURE')
  const teacherId = String(form.get('teacherId'))
  const teacher = await queryOne<{ id: number }>(`SELECT id FROM data_guru WHERE CAST(id AS TEXT)=?`, [teacherId])
  if (!teacher) return { success: false as const, error: 'Guru tidak ditemukan.' }
  await syncFinanceTeacherSnapshots([teacherId])
  const r = await setTeacherCompensation({
    teacherId,
    effectiveFrom: String(form.get('effectiveFrom')),
    monthlySalaryRupiah: Number(form.get('monthlySalaryRupiah')),
    alfaDeductionPerDayRupiah: Number(form.get('alfaDeductionPerDayRupiah') || 0),
    badalDeductionPerDayRupiah: Number(form.get('badalDeductionPerDayRupiah') || 0),
    actorId: s.id,
  })
  if (r.success) refresh()
  return r
}

export async function syncTeachersAction() {
  await requireFinanceAccess('CONFIGURE')
  const teachers = await query<{ id: number }>(`SELECT id FROM data_guru`)
  await syncFinanceTeacherSnapshots(teachers.map(row => String(row.id)))
  refresh()
  return { success: true as const, count: teachers.length }
}

export type CompensationImportRow = {
  row: number; teacherId: string; effectiveFrom: string
  monthlySalaryRupiah: number; alfaDeductionPerDayRupiah: number; badalDeductionPerDayRupiah: number
}

export async function importCompensationAction(rows: CompensationImportRow[]) {
  const session = await requireFinanceAccess('CONFIGURE')
  const unique = [...new Set(rows.map(item => item.teacherId).filter(Boolean))]
  const known = new Set(unique.length
    ? (await query<{ id: number }>(`SELECT id FROM data_guru WHERE CAST(id AS TEXT) IN (${unique.map(() => '?').join(',')})`, unique)).map(row => String(row.id))
    : [])
  await syncFinanceTeacherSnapshots([...known])
  const summary = await runBulk(rows, async item => {
    if (!known.has(item.teacherId)) return { success: false, error: `Guru dengan id ${item.teacherId} tidak ada di master guru.` }
    return setTeacherCompensation({ ...item, actorId: session.id })
  })
  if (summary.success && summary.created) refresh()
  return summary
}

export async function getPayrollData() {
  const session = await requireFinanceAccess('VIEW')
  const capabilities = await financeCapabilities(session)
  const teachers = await query<any>(`SELECT id,nama_lengkap,gelar,kode_guru FROM data_guru ORDER BY nama_lengkap`)
  const teacherNames = new Map(teachers.map(row => [String(row.id), row.nama_lengkap]))

  const periods = await financeQuery<any>(`SELECT p.*,
    COUNT(i.id) item_count,
    COALESCE(SUM(i.net_rupiah),0) total_net_rupiah,
    COALESCE(SUM(i.deduction_rupiah),0) total_deduction_rupiah
    FROM finance_payroll_periods p
    LEFT JOIN finance_payroll_items i ON i.payroll_period_id=p.id
    GROUP BY p.id ORDER BY p.period_key DESC`)

  const compensation = await financeQuery<any>(`SELECT c.*,s.full_name teacher_name
    FROM finance_teacher_compensation c
    LEFT JOIN finance_teacher_snapshots s ON s.teacher_id=c.teacher_id
    ORDER BY c.effective_from DESC,c.created_at DESC LIMIT 300`)

  const items = await financeQuery<any>(`SELECT i.*,p.period_key,p.status period_status,g.full_name teacher_name
    FROM finance_payroll_items i
    JOIN finance_payroll_periods p ON p.id=i.payroll_period_id
    LEFT JOIN finance_teacher_snapshots g ON g.teacher_id=i.teacher_id
    ORDER BY p.period_key DESC,g.full_name LIMIT 500`)

  const nama = (row: any, key = 'teacher_id') => row.teacher_name || teacherNames.get(String(row[key])) || row[key]
  return {
    periods,
    compensation: compensation.map(row => ({ ...row, teacher_name: nama(row) })),
    items: items.map(row => ({ ...row, teacher_name: nama(row) })),
    teachers,
    canConfigure: capabilities.configure,
    canCheck: capabilities.check,
  }
}
