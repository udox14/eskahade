'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { financeQuery, financeQueryOne, generateId, getFinanceDB, queryOne } from '@/lib/db'
import { financeAsramaScope, financeCapabilities, requireFinanceAccess } from '@/lib/finance/access'
import { contentKey } from '@/lib/finance/idempotency'
import { postJournal, reverseJournal } from '@/lib/finance/ledger'
import { syncFinanceStudentSnapshot } from '@/lib/finance/snapshots'
import type { FinanceAccountCode, JournalEntryInput } from '@/lib/finance/types'

const PATH = '/dashboard/keuangan-terpusat/ledger'

async function audit(actorId: string, action: string, entityId: string, after: unknown) {
  await (await getFinanceDB()).prepare(`INSERT INTO finance_audit_log
    (id,actor_type,actor_id,action,entity_type,entity_id,after_json)
    VALUES(?,'STAFF',? ,?,'JOURNAL',?,?)`).bind(generateId(), actorId, action, entityId, JSON.stringify(after)).run()
}

export async function postManualJournalAction(form: FormData) {
  const session = await requireFinanceAccess('CONFIGURE')
  const accountCodes = form.getAll('accountCode').map(String)
  const sides = form.getAll('side').map(String)
  const amounts = form.getAll('amountRupiah').map(Number)
  const memos = form.getAll('memo').map(value => String(value || '').trim())
  const asramaScopes = form.getAll('asramaScope').map(value => String(value || '').trim())
  const studentNumbers = form.getAll('nis').map(value => String(value || '').trim())
  if (![sides.length, amounts.length, memos.length, asramaScopes.length, studentNumbers.length].every(length => length === accountCodes.length)) {
    return { success: false as const, error: 'Baris jurnal tidak lengkap.' }
  }

  const entries: JournalEntryInput[] = []
  for (let index = 0; index < accountCodes.length; index += 1) {
    let santriId: string | null = null
    let asramaScope = asramaScopes[index] || null
    if (studentNumbers[index]) {
      const student = await queryOne<{ id: string; asrama: string | null }>(`SELECT id,asrama FROM santri WHERE nis=? AND status_global='aktif'`, [studentNumbers[index]])
      if (!student) return { success: false as const, error: `Santri dengan NIS ${studentNumbers[index]} tidak ditemukan.` }
      if (asramaScope && student.asrama && asramaScope !== student.asrama) return { success: false as const, error: `Scope baris ${index + 1} tidak cocok dengan asrama santri.` }
      santriId = student.id
      asramaScope = asramaScope || student.asrama
      await syncFinanceStudentSnapshot(student.id)
    }
    entries.push({
      accountCode: accountCodes[index] as FinanceAccountCode,
      side: sides[index] as 'DEBIT' | 'CREDIT',
      amountRupiah: amounts[index],
      memo: memos[index] || null,
      asramaScope,
      santriId,
    })
  }

  const reference = String(form.get('externalReference') || '').trim()
  if (reference.length < 3) return { success: false as const, error: 'Referensi dokumen minimal 3 karakter.' }
  const description = String(form.get('description') || '').trim()
  if (description.length < 5) return { success: false as const, error: 'Keterangan jurnal minimal 5 karakter.' }
  const effectiveDate = String(form.get('effectiveDate') || '')
  // Nomor dokumen sering dipakai ulang untuk transaksi yang berbeda. Kunci
  // diikat ke isi jurnal supaya hanya pengiriman ganda yang benar-benar sama
  // yang ter-dedup, bukan jurnal berbeda yang kebetulan seferensi.
  const result = await postJournal({
    idempotencyKey: await contentKey('manual', reference, { effectiveDate, description, entries }),
    effectiveDate,
    description,
    sourceType: 'MANUAL',
    externalReference: reference,
    actorType: 'STAFF',
    actorId: session.id,
    entries,
  })
  if (!result.success) return result
  if (!result.duplicate) await audit(session.id, 'POST_MANUAL_JOURNAL', result.journalId, { reference, entryCount: entries.length })
  revalidatePath(PATH)
  revalidatePath('/dashboard/keuangan-terpusat')
  // Referensi yang dipakai ulang tetap diposting, tetapi bendahara perlu tahu
  // agar tidak menganggap satu dokumen mewakili satu jurnal saja.
  const reused = result.duplicate
    ? 0
    : Number((await financeQueryOne<{ count: number }>(
      `SELECT COUNT(*) count FROM finance_journals WHERE external_reference=? AND id<>?`,
      [reference, result.journalId]))?.count || 0)
  return { ...result, referenceReuseCount: reused }
}

export async function reverseManualJournalAction(form: FormData) {
  const session = await requireFinanceAccess('CONFIGURE')
  const journalId = String(form.get('journalId') || '')
  const reason = String(form.get('reason') || '').trim()
  const result = await reverseJournal({
    journalId,
    idempotencyKey: `manual-reversal:${journalId}`,
    actorType: 'STAFF',
    actorId: session.id,
    reason,
  })
  if (result.success) {
    if (!result.duplicate) await audit(session.id, 'REVERSE_MANUAL_JOURNAL', result.journalId, { originalJournalId: journalId, reason })
    revalidatePath(PATH)
    revalidatePath('/dashboard/keuangan-terpusat')
  }
  return result
}

export async function getLedgerData() {
  const session = await requireFinanceAccess('VIEW')
  const scope = financeAsramaScope(session)
  const params = scope ? [scope] : []
  const journals = await financeQuery<any>(`SELECT j.*,
    COALESCE(SUM(CASE WHEN e.side='DEBIT' THEN e.amount_rupiah ELSE 0 END),0) debit_rupiah,
    COALESCE(SUM(CASE WHEN e.side='CREDIT' THEN e.amount_rupiah ELSE 0 END),0) credit_rupiah,
    (SELECT r.id FROM finance_journals r WHERE r.reversal_of_id=j.id LIMIT 1) reversed_by_id
    FROM finance_journals j LEFT JOIN finance_journal_entries e ON e.journal_id=j.id
    WHERE 1=1 ${scope ? `AND EXISTS(SELECT 1 FROM finance_journal_entries se WHERE se.journal_id=j.id AND se.asrama_scope=?)` : ''}
    GROUP BY j.id ORDER BY j.effective_date DESC,j.created_at DESC LIMIT 250`, params)
  const ids = journals.map(row => row.id)
  const entryChunks = await Promise.all(Array.from({ length: Math.ceil(ids.length / 80) }, (_, index) => {
    const chunk = ids.slice(index * 80, index * 80 + 80)
    return financeQuery<any>(`SELECT e.*,a.code account_code,a.name account_name,s.nis,s.full_name student_name
      FROM finance_journal_entries e JOIN finance_accounts a ON a.id=e.account_id
      LEFT JOIN finance_student_snapshots s ON s.santri_id=e.santri_id
      WHERE e.journal_id IN (${chunk.map(() => '?').join(',')})
      ORDER BY e.journal_id,e.created_at,e.id`, chunk)
  }))
  const entries = entryChunks.flat()
  const accounts = await financeQuery<any>(`SELECT code,name,account_type,normal_balance FROM finance_accounts WHERE is_active=1 ORDER BY code`)
  const capabilities = await financeCapabilities(session)
  const countFilter = scope ? `WHERE EXISTS(SELECT 1 FROM finance_journal_entries se WHERE se.journal_id=j.id AND se.asrama_scope=?)` : ''
  return {
    journals,
    entries,
    accounts,
    canConfigure: capabilities.configure,
    scope,
    totals: {
      posted: await financeQueryOne<{ count: number }>(`SELECT COUNT(*) count FROM finance_journals j ${countFilter} ${countFilter ? 'AND' : 'WHERE'} j.status='POSTED'`, params),
      draft: await financeQueryOne<{ count: number }>(`SELECT COUNT(*) count FROM finance_journals j ${countFilter} ${countFilter ? 'AND' : 'WHERE'} j.status='DRAFT'`, params),
    },
  }
}
