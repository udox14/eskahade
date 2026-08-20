'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { financeQuery } from '@/lib/db'
import { financeAsramaScope, financeCapabilities, requireFinanceAccess } from '@/lib/finance/access'
import { returnUnusedAllocation } from '@/lib/finance/wallet'
import { andExcludeAsramaSql } from '@/lib/finance/asrama'

const PATH = '/dashboard/keuangan-terpusat/alokasi'

export async function returnAllocationAction(form: FormData) {
  const session = await requireFinanceAccess('CONFIGURE')
  const allocationId = String(form.get('allocationId') || '')
  const result = await returnUnusedAllocation({
    allocationId,
    idempotencyKey: `staff-return:${allocationId}`,
    actorType: 'STAFF',
    actorId: session.id,
  })
  if (result.success) {
    revalidatePath(PATH)
    revalidatePath('/dashboard/keuangan-terpusat')
  }
  return result
}

export async function getAllocationData() {
  const session = await requireFinanceAccess('VIEW')
  const scope = financeAsramaScope(session)
  const params = scope ? [scope] : []
  const allocations = await financeQuery<any>(`SELECT a.*,s.nis,s.full_name student_name,s.asrama,
    GROUP_CONCAT(b.title,' · ') bill_titles,
    COALESCE((SELECT w.balance_rupiah FROM finance_student_wallets w WHERE w.santri_id=a.santri_id AND w.wallet_kind=a.destination_kind),0) destination_balance_rupiah
    FROM finance_allocations a
    LEFT JOIN finance_student_snapshots s ON s.santri_id=a.santri_id
    LEFT JOIN finance_allocation_bill_items abi ON abi.allocation_id=a.id
    LEFT JOIN finance_bills b ON b.id=abi.bill_id
    WHERE 1=1 ${andExcludeAsramaSql('s.asrama')} ${scope ? 'AND s.asrama=?' : ''}
    GROUP BY a.id ORDER BY a.created_at DESC LIMIT 300`, params)
  const capabilities = await financeCapabilities(session)
  return {
    allocations,
    scope,
    // returnAllocationAction memakai izin EXECUTE; flag UI harus mengikuti,
    // bukan sekadar daftar role, agar tombol tidak tampil untuk yang pasti ditolak.
    canReturn: capabilities.configure,
    nowMs: Date.now(),
  }
}
