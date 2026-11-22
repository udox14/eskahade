'use server'

// Menu Kas Bank: daftar Mutasi Kas Bank ↔ Tunai lintas sesi. Pencatatan & pembatalan memakai
// server action Loket Kasir (mutasi selalu terikat sesi kas terbuka milik pencatat).

import { authorizeLoketOperator, type LoketCashAccountOption } from '../loket/actions'
import { getActiveCashSession, recalculateCashSession } from '@/lib/finance/cash-session'
import { listTransferAccounts } from '@/lib/finance/transfer-config'
import { listCashTransfers, type CashTransferListFilter } from '@/lib/finance/cash-transfers'

/** Peran yang melihat mutasi semua petugas; Petugas Koperasi hanya melihat mutasinya sendiri. */
const ALL_SCOPE_ROLES = ['admin', 'bendahara', 'admin_koperasi', 'pimpinan', 'tester', 'demo']

export interface KasBankFilter {
  direction?: 'SEMUA' | 'BANK_TO_CASH' | 'CASH_TO_BANK'
  state?: 'SEMUA' | 'POSTED_UNMATCHED' | 'MATCHED' | 'VOIDED'
  fromDate?: string | null
  toDate?: string | null
  offset?: number
}

export async function getKasBankData(filter: KasBankFilter = {}) {
  const { userId, roles, operatorName, isViewOnly } = await authorizeLoketOperator()
  const seesAll = roles.some(role => ALL_SCOPE_ROLES.includes(role))
  const listFilter: CashTransferListFilter = {
    operatorId: seesAll ? null : userId,
    direction: filter.direction ?? 'SEMUA',
    state: filter.state ?? 'SEMUA',
    fromDate: filter.fromDate ?? null,
    toDate: filter.toDate ?? null,
    limit: 50,
    offset: filter.offset ?? 0,
  }
  const [list, session, accounts] = await Promise.all([
    listCashTransfers(listFilter),
    getActiveCashSession(userId),
    listTransferAccounts({ activeOnly: true }),
  ])
  const cash = session ? await recalculateCashSession(session.id) : null
  return {
    ...list,
    viewer: { id: userId, name: operatorName, roles, isViewOnly, seesAll },
    cashSession: cash ? { id: cash.id, code: cash.session_code, available: cash.available_balance ?? cash.expected_closing_balance } : null,
    accounts: accounts.map((account): LoketCashAccountOption => ({
      id: account.id,
      label: `${account.bank_name} · ${account.account_number} · a.n. ${account.account_holder}`,
    })),
  }
}
