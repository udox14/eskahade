'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from 'next/cache'
import { financeQuery as query } from '@/lib/db'
import { requireFinanceAccess } from '@/lib/finance/access'
import { approvePayrollPeriod, calculatePayrollPeriod, createPayrollPeriod, lockPayrollAttendance } from '@/lib/finance/payroll'
export async function calculatePayrollAction(id:string){const s=await requireFinanceAccess('CONFIGURE');const r=await calculatePayrollPeriod(id,s.id);if(r.success)revalidatePath('/dashboard/keuangan-terpusat/payroll');return r}
export async function createPayrollPeriodAction(periodKey:string){await requireFinanceAccess('CONFIGURE');const r=await createPayrollPeriod(periodKey);if(r.success)revalidatePath('/dashboard/keuangan-terpusat/payroll');return r}
export async function lockPayrollAttendanceAction(id:string){const s=await requireFinanceAccess('CONFIGURE');const r=await lockPayrollAttendance(id,s.id);if(r.success)revalidatePath('/dashboard/keuangan-terpusat/payroll');return r}
export async function approvePayrollAction(id:string){const s=await requireFinanceAccess('CHECK');const r=await approvePayrollPeriod(id,s.id);if(r.success)revalidatePath('/dashboard/keuangan-terpusat/payroll');return r}
export async function getPayrollData(){await requireFinanceAccess('VIEW');return{periods:await query<any>(`SELECT * FROM finance_payroll_periods ORDER BY period_key DESC`),items:await query<any>(`SELECT i.*,g.full_name teacher_name FROM finance_payroll_items i LEFT JOIN finance_teacher_snapshots g ON g.teacher_id=i.teacher_id ORDER BY i.created_at DESC LIMIT 200`)}}
