'use server'

import { financeQuery } from '@/lib/db'
import { financeAsramaScope, requireFinanceAccess } from '@/lib/finance/access'
import { andExcludeAsramaSql } from '@/lib/finance/asrama'

/**
 * Rekap tagihan per item pembayaran. Pertanyaan yang dijawab halaman ini —
 * "siapa saja yang sudah lunas, baru nyicil, dan belum bayar untuk item ini" —
 * sebelumnya tidak punya layar sama sekali; yang ada hanya 30 tagihan terbaru
 * campur aduk di halaman Operasi.
 *
 * Satu "item" = satu kombinasi jenis + periode + judul tagihan, karena
 * NON_SPP tidak memakai period_key dan hanya dibedakan oleh judulnya.
 */
export type BillItem = {
  bill_kind: string
  period_key: string
  title: string
  total: number
  lunas: number
  nyicil: number
  belum: number
  ditiadakan: number
  amount_rupiah: number
  paid_rupiah: number
}

export type BillStudentRow = {
  id: string
  santri_id: string
  nis: string | null
  full_name: string | null
  asrama: string | null
  amount_rupiah: number
  paid_rupiah: number
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'VOID'
  due_date: string | null
}

/** Bendahara asrama hanya melihat santri binaannya; AL-BAGHORY selalu di luar. */
function scopeClause(scope: string | null) {
  return {
    sql: `${andExcludeAsramaSql('s.asrama')} ${scope ? 'AND s.asrama=?' : ''}`,
    params: scope ? [scope] : [],
  }
}

export async function getBillItems(): Promise<{ items: BillItem[]; scope: string | null }> {
  const session = await requireFinanceAccess('VIEW')
  const scope = financeAsramaScope(session)
  const clause = scopeClause(scope)
  const items = await financeQuery<BillItem>(`SELECT
      b.bill_kind,
      COALESCE(b.period_key,'') period_key,
      b.title,
      COUNT(*) total,
      SUM(CASE WHEN b.status='PAID' THEN 1 ELSE 0 END) lunas,
      SUM(CASE WHEN b.status='PARTIAL' THEN 1 ELSE 0 END) nyicil,
      SUM(CASE WHEN b.status='OPEN' THEN 1 ELSE 0 END) belum,
      SUM(CASE WHEN b.status='VOID' THEN 1 ELSE 0 END) ditiadakan,
      COALESCE(SUM(CASE WHEN b.status<>'VOID' THEN b.amount_rupiah ELSE 0 END),0) amount_rupiah,
      COALESCE(SUM(CASE WHEN b.status<>'VOID' THEN b.paid_rupiah ELSE 0 END),0) paid_rupiah
    FROM finance_bills b
    JOIN finance_student_snapshots s ON s.santri_id=b.santri_id
    WHERE 1=1 ${clause.sql}
    GROUP BY b.bill_kind, COALESCE(b.period_key,''), b.title
    ORDER BY COALESCE(b.period_key,'') DESC, b.bill_kind, b.title
    LIMIT 300`, clause.params)
  return { items, scope }
}

/**
 * Daftar santri satu item. Difilter dan dipaginasi di klien supaya bendahara
 * bisa berpindah antar status tanpa menunggu server tiap kali.
 */
export async function getBillItemStudents(input: {
  billKind: string
  periodKey: string
  title: string
}): Promise<{ rows: BillStudentRow[] } | { error: string }> {
  const session = await requireFinanceAccess('VIEW')
  const scope = financeAsramaScope(session)
  const clause = scopeClause(scope)
  const billKind = String(input.billKind || '').trim()
  const title = String(input.title || '').trim()
  if (!billKind || !title) return { error: 'Item tagihan belum dipilih.' }
  const rows = await financeQuery<BillStudentRow>(`SELECT
      b.id,b.santri_id,b.amount_rupiah,b.paid_rupiah,b.status,b.due_date,
      s.nis,s.full_name,s.asrama
    FROM finance_bills b
    JOIN finance_student_snapshots s ON s.santri_id=b.santri_id
    WHERE b.bill_kind=? AND COALESCE(b.period_key,'')=? AND b.title=? ${clause.sql}
    ORDER BY s.full_name,s.nis
    LIMIT 5000`, [billKind, String(input.periodKey || ''), title, ...clause.params])
  return { rows }
}
