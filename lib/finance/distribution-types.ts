// lib/finance/distribution-types.ts
// Tipe data Penyaluran Dana (Fase 7: Distribution Engine & Provider Accounts)
// Berdasarkan PRD Bab 24 s.d. 29 & Implementation Plan #3.4

export type FinanceDistributionRecipientType = 'BENDAHARA' | 'KATERING' | 'LAUNDRY'

export type FinanceDistributionMethod = 'TRANSFER' | 'CASH'

export interface FinanceDistribution {
  id: string
  distribution_number: string
  recipient_type: FinanceDistributionRecipientType
  recipient_id: string | null
  item_type: string
  period: string
  total_amount: number
  method: FinanceDistributionMethod
  destination_bank: string | null
  destination_account: string | null
  account_holder_name: string | null
  proof_attachment_url: string | null
  transferred_by: string
  transferred_by_name?: string | null
  transferred_at: string
  notes: string | null
  created_at: string
}

export interface FinanceDistributionItem {
  id: string
  distribution_id: string
  allocation_id: string
  amount: number
  created_at: string
}

export interface FinanceProviderAccount {
  id: string
  provider_id: string
  provider_name?: string | null
  provider_type?: string | null // 'Makan' | 'Cuci'
  bank_name: string
  account_number: string
  account_holder: string
  is_primary: number // 0 | 1
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DistributionKpiSummary {
  totalDanaMasuk: number
  totalSudahDisalurkan: number
  totalSiapDisalurkan: number
  totalSantriTerdaftar: number
  totalSantriSudahBayar: number
  totalSantriBelumBayar: number
  totalSantriBebas?: number
}

export interface ProviderDistributionSummaryRow {
  providerId: string
  providerName: string
  providerType: 'Makan' | 'Cuci'
  santriTerdaftar: number
  santriSudahBayar: number
  santriBelumBayar: number
  santriBebas?: number
  totalDanaMasuk: number
  sudahDisalurkan: number
  sisaSiapSalur: number
  primaryAccount: FinanceProviderAccount | null
  accountsCount: number
}

export interface BendaharaDistributionSummaryRow {
  itemType: string
  itemLabel: string
  period: string
  santriTerdaftar: number
  santriSudahBayar: number
  santriBelumBayar: number
  santriBebas?: number
  totalDanaMasuk: number
  sudahDisalurkan: number
  sisaSiapSalur: number
}

export interface CreateDistributionInput {
  recipientType: FinanceDistributionRecipientType
  recipientId?: string | null
  itemType: string
  period: string
  amount: number
  method: FinanceDistributionMethod
  destinationBank?: string | null
  destinationAccount?: string | null
  accountHolderName?: string | null
  proofAttachmentUrl?: string | null
  transferredBy: string
  transferredAt?: string
  notes?: string | null
}

export interface CreateProviderAccountInput {
  providerId: string
  bankName: string
  accountNumber: string
  accountHolder: string
  isPrimary?: boolean
  notes?: string | null
}

export interface UpdateProviderAccountInput {
  id: string
  bankName: string
  accountNumber: string
  accountHolder: string
  isPrimary?: boolean
  notes?: string | null
}

export interface DistributionDetailWithItems extends FinanceDistribution {
  recipient_name: string
  operator_name: string
  items: Array<{
    id: string
    allocation_id: string
    amount: number
    santri_id: string
    santri_name: string
    santri_nis: string
    created_at: string
  }>
}

// ─── POST-RELEASE PATCH C4: OPERATIONAL DETAIL & EXCEL IMPORT ────────────────

export type ProviderOperationalPaymentStatus = 'PAID' | 'UNPAID' | 'PARTIAL' | 'EXEMPTED'

export interface ProviderOperationalDetailRow {
  santriId: string
  nis: string
  namaLengkap: string
  asrama: string | null
  kamar: string | null
  period: string
  nominalKewajiban: number
  terbayar: number
  sisa: number
  statusPembayaran: ProviderOperationalPaymentStatus
  statusLabel: string
  danaMasuk: number
  danaDisalurkan: number
}

export interface ProviderOperationalDetailResult {
  provider: {
    id: string
    name: string
    type: 'Makan' | 'Cuci'
  }
  period: string
  stats: {
    totalAssigned: number
    totalPaid: number
    totalUnpaid: number
    totalExempted: number
    totalDanaMasuk: number
    totalSudahDisalurkan: number
    sisaSiapSalur: number
  }
  items: ProviderOperationalDetailRow[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface ProviderOperationalDetailParams {
  providerId: string
  period: string
  page?: number
  pageSize?: number
  search?: string
  statusFilter?: 'ALL' | ProviderOperationalPaymentStatus
}

export interface ProviderAccountTemplateRow {
  provider_id: string
  nama_penyedia: string
  jenis_layanan: string
  bank: string
  nomor_rekening: string
  nama_pemilik: string
  rekening_utama: string
  catatan: string
}

export interface ProviderAccountTemplatePayload {
  providers: ProviderAccountTemplateRow[]
  existingAccounts: Array<{
    provider_id: string
    bank_name: string
    account_number: string
  }>
}

export type ImportValidationStatus = 'VALID_NEW' | 'SKIPPED_DUPLICATE' | 'INVALID'

export interface ValidatedImportAccountRow {
  index: number
  provider_id: string
  nama_penyedia: string
  jenis_layanan: string
  bank: string
  nomor_rekening: string
  nama_pemilik: string
  is_primary: boolean
  catatan: string | null
  status: ImportValidationStatus
  message?: string
  warning?: string
}

export interface ProviderAccountsImportPreview {
  totalRows: number
  validNewCount: number
  skippedDuplicateCount: number
  invalidCount: number
  rows: ValidatedImportAccountRow[]
}

