/**
 * Katalog resep jurnal — SATU-SATUNYA berkas di aplikasi ini yang boleh menyebut
 * kode akun. Semua modul lain (wallet, withdrawal, payments, settlement, payouts,
 * payroll, reversals) memanggil resep dari sini dengan bahasa bisnis.
 *
 * Aturan ini dijaga oleh uji T3 di scripts/test-finance-invariants.mjs: uji itu
 * mencari kode akun 4 digit di seluruh lib/, app/, dan workers/, lalu gagal bila
 * ada berkas selain berkas ini yang cocok. Kalau Anda tergoda menulis '2101' di
 * modul lain, tambahkan resep di sini sebagai gantinya.
 *
 * Kenapa resep berupa fungsi, bukan tabel data: sebagian kejadian punya baris
 * kondisional. Top-up gateway hanya membentuk baris biaya bila walinya memang
 * dikenai biaya; reversal provider memecah nominal menjadi bagian yang bisa
 * ditarik kembali dari dompet dan bagian yang menjadi piutang wali. Tabel data
 * datar tidak bisa menyatakan itu tanpa berbohong.
 */
import type { JournalEntryInput, WalletKind } from './types'

/** Bagan akun. Didefinisikan di sini supaya tidak ada berkas lain yang menulis kode akun. */
export type FinanceAccountCode =
  | '1101' | '1102' | '1103' | '1104' | '1201'
  | '2101' | '2102' | '2103' | '2104' | '2105'
  | '4101' | '4102' | '4103' | '4104'
  | '5101' | '5102' | '9999'

/** Pemetaan kode akun → id baris finance_accounts. Dipakai ledger.ts saat menyusun entry. */
export const ACCOUNT_IDS: Record<FinanceAccountCode, string> = {
  '1101': 'fa-main-bank', '1102': 'fa-gateway-clearing', '1103': 'fa-central-cash',
  '1104': 'fa-unit-cash', '1201': 'fa-parent-receivable', '2101': 'fa-guardian-float',
  '2102': 'fa-meal-payable', '2103': 'fa-laundry-payable', '2104': 'fa-payroll-payable',
  '2105': 'fa-jajan-liability', '4101': 'fa-spp-revenue', '4102': 'fa-uspp-revenue',
  '4103': 'fa-nonspp-revenue', '4104': 'fa-gateway-fee-revenue',
  '5101': 'fa-gateway-fee-expense', '5102': 'fa-payroll-expense', '9999': 'fa-suspense',
}

/** Akun yang dirujuk laporan/dashboard, supaya query tidak menulis kode mentah. */
export const AKUN_TITIPAN_WALI: FinanceAccountCode = '2101'
export const AKUN_KAS_MASUK: FinanceAccountCode[] = ['1101', '1102']

/** Bagan akun dengan label yang dipakai UI. Operator melihat label, bukan kode. */
export const AKUN: Record<FinanceAccountCode, { label: string; jenis: string }> = {
  '1101': { label: 'Rekening Utama', jenis: 'ASSET' },
  '1102': { label: 'Clearing Gateway', jenis: 'ASSET' },
  '1103': { label: 'Kas Pusat', jenis: 'ASSET' },
  '1104': { label: 'Kas Unit/Loket', jenis: 'ASSET' },
  '1201': { label: 'Piutang Wali', jenis: 'ASSET' },
  '2101': { label: 'Titipan Wali', jenis: 'LIABILITY' },
  '2102': { label: 'Utang Pengelola Makan', jenis: 'LIABILITY' },
  '2103': { label: 'Utang Pengelola Laundry', jenis: 'LIABILITY' },
  '2104': { label: 'Utang Payroll', jenis: 'LIABILITY' },
  '2105': { label: 'Titipan Uang Jajan', jenis: 'LIABILITY' },
  '4101': { label: 'Pendapatan SPP', jenis: 'REVENUE' },
  '4102': { label: 'Pendapatan USPP/Uang Bangunan', jenis: 'REVENUE' },
  '4103': { label: 'Pendapatan Non-SPP', jenis: 'REVENUE' },
  '4104': { label: 'Penerimaan Biaya Gateway dari Wali', jenis: 'REVENUE' },
  '5101': { label: 'Biaya Gateway', jenis: 'EXPENSE' },
  '5102': { label: 'Beban Payroll', jenis: 'EXPENSE' },
  '9999': { label: 'Suspense/Rekonsiliasi', jenis: 'ASSET' },
}

/** Tujuan alokasi dana wali → akun pendapatan/utang yang bersangkutan. */
const AKUN_TUJUAN: Record<Exclude<WalletKind, 'TITIPAN'>, FinanceAccountCode> = {
  SPP: '4101', USPP: '4102', NON_SPP: '4103',
  MAKAN: '2102', LAUNDRY: '2103', JAJAN: '2105',
}

/** Jenis pencairan → akun utang yang dilunasi. */
const AKUN_UTANG_PAYOUT: Record<string, FinanceAccountCode> = {
  MEAL: '2102', LAUNDRY: '2103', PAYROLL: '2104', REFUND: '2101',
}

type Baris = JournalEntryInput
type Resep = { entries: Baris[] }

const rupiah = (nilai: number): number => {
  if (!Number.isSafeInteger(nilai) || nilai <= 0) {
    throw new Error('Nominal resep jurnal harus rupiah bulat lebih dari nol.')
  }
  return nilai
}

/**
 * Wali mengisi saldo lewat payment gateway.
 * Uang masuk ke clearing gateway; yang menjadi hak wali adalah nominal bersih,
 * selisihnya diakui sebagai penerimaan biaya gateway.
 */
export function topupGateway(input: {
  santriId: string
  nominalRupiah: number
  biayaGatewayRupiah: number
  totalDibayarRupiah: number
}): Resep {
  return {
    entries: [
      { accountCode: '1102', side: 'DEBIT', amountRupiah: rupiah(input.totalDibayarRupiah), santriId: input.santriId },
      { accountCode: '2101', side: 'CREDIT', amountRupiah: rupiah(input.nominalRupiah), santriId: input.santriId },
      ...(input.biayaGatewayRupiah > 0
        ? [{ accountCode: '4104' as const, side: 'CREDIT' as const, amountRupiah: input.biayaGatewayRupiah, santriId: input.santriId }]
        : []),
    ],
  }
}

/** Wali transfer manual, lalu pengurus mengonfirmasi bukti transfernya. */
export function topupManual(input: { santriId: string; nominalRupiah: number }): Resep {
  return {
    entries: [
      { accountCode: '1102', side: 'DEBIT', amountRupiah: rupiah(input.nominalRupiah), santriId: input.santriId },
      { accountCode: '2101', side: 'CREDIT', amountRupiah: rupiah(input.nominalRupiah), santriId: input.santriId },
    ],
  }
}

/**
 * Provider membatalkan top-up yang sudah terlanjur diakui.
 * Bagian yang masih ada di dompet ditarik kembali; sisanya menjadi piutang wali.
 */
export function topupDibatalkanProvider(input: {
  santriId: string
  dapatDitarikRupiah: number
  piutangRupiah: number
  biayaGatewayRupiah: number
  totalDibayarRupiah: number
}): Resep {
  return {
    entries: [
      ...(input.dapatDitarikRupiah > 0
        ? [{ accountCode: '2101' as const, side: 'DEBIT' as const, amountRupiah: input.dapatDitarikRupiah, santriId: input.santriId }]
        : []),
      ...(input.piutangRupiah > 0
        ? [{ accountCode: '1201' as const, side: 'DEBIT' as const, amountRupiah: input.piutangRupiah, santriId: input.santriId }]
        : []),
      ...(input.biayaGatewayRupiah > 0
        ? [{ accountCode: '4104' as const, side: 'DEBIT' as const, amountRupiah: input.biayaGatewayRupiah, santriId: input.santriId }]
        : []),
      { accountCode: '1102', side: 'CREDIT', amountRupiah: rupiah(input.totalDibayarRupiah), santriId: input.santriId },
    ],
  }
}

/** Saldo titipan wali dipakai untuk membayar tagihan atau mengisi dompet jajan. */
export function alokasiDana(input: {
  santriId: string
  tujuan: Exclude<WalletKind, 'TITIPAN'>
  nominalRupiah: number
  asramaScope?: string | null
}): Resep {
  return {
    entries: [
      { accountCode: '2101', side: 'DEBIT', amountRupiah: rupiah(input.nominalRupiah), santriId: input.santriId, asramaScope: input.asramaScope },
      { accountCode: AKUN_TUJUAN[input.tujuan], side: 'CREDIT', amountRupiah: rupiah(input.nominalRupiah), santriId: input.santriId, asramaScope: input.asramaScope },
    ],
  }
}

/** Alokasi ditarik kembali sebelum cutoff — kebalikan persis dari alokasiDana. */
export function alokasiDikembalikan(input: {
  santriId: string
  tujuan: Exclude<WalletKind, 'TITIPAN'>
  nominalRupiah: number
  asramaScope?: string | null
}): Resep {
  return {
    entries: [
      { accountCode: AKUN_TUJUAN[input.tujuan], side: 'DEBIT', amountRupiah: rupiah(input.nominalRupiah), santriId: input.santriId, asramaScope: input.asramaScope },
      { accountCode: '2101', side: 'CREDIT', amountRupiah: rupiah(input.nominalRupiah), santriId: input.santriId, asramaScope: input.asramaScope },
    ],
  }
}

/** Santri mengambil uang jajan tunai di loket. */
export function tarikJajanDiLoket(input: { santriId: string; nominalRupiah: number }): Resep {
  return {
    entries: [
      { accountCode: '2105', side: 'DEBIT', amountRupiah: rupiah(input.nominalRupiah), santriId: input.santriId },
      { accountCode: '1104', side: 'CREDIT', amountRupiah: rupiah(input.nominalRupiah), santriId: input.santriId },
    ],
  }
}

/** Dana yang mengendap di gateway dicairkan ke rekening utama, dipotong biaya provider. */
export function settlementGateway(input: {
  brutoRupiah: number
  netoRupiah: number
  biayaProviderRupiah: number
}): Resep {
  return {
    entries: [
      { accountCode: '1101', side: 'DEBIT', amountRupiah: rupiah(input.netoRupiah) },
      ...(input.biayaProviderRupiah > 0
        ? [{ accountCode: '5101' as const, side: 'DEBIT' as const, amountRupiah: input.biayaProviderRupiah }]
        : []),
      { accountCode: '1102', side: 'CREDIT', amountRupiah: rupiah(input.brutoRupiah) },
    ],
  }
}

/**
 * Pencairan ke pengelola makan/laundry/guru.
 * `sumberDana` menentukan dari mana uangnya keluar: transfer bank dan tunai
 * mengurangi kas riil, sedangkan pencairan lewat API provider keluar dari
 * clearing gateway.
 */
export function pencairan(input: {
  jenis: string
  nominalRupiah: number
  biayaRupiah: number
  sumberDana: 'BANK' | 'TUNAI' | 'GATEWAY'
  asramaScope?: string | null
}): Resep {
  const akunUtang = AKUN_UTANG_PAYOUT[input.jenis] ?? '9999'
  const akunSumber: FinanceAccountCode =
    input.sumberDana === 'TUNAI' ? '1103' : input.sumberDana === 'GATEWAY' ? '1102' : '1101'
  const total = input.nominalRupiah + input.biayaRupiah
  return {
    entries: [
      { accountCode: akunUtang, side: 'DEBIT', amountRupiah: rupiah(input.nominalRupiah), asramaScope: input.asramaScope },
      ...(input.biayaRupiah > 0
        ? [{ accountCode: '5101' as const, side: 'DEBIT' as const, amountRupiah: input.biayaRupiah, asramaScope: input.asramaScope }]
        : []),
      { accountCode: akunSumber, side: 'CREDIT', amountRupiah: rupiah(total), asramaScope: input.asramaScope },
    ],
  }
}

/** Gaji guru diakui sebagai beban dan utang, sebelum benar-benar dicairkan. */
export function akrualGajiGuru(input: { guruId: string; nominalRupiah: number }): Resep {
  return {
    entries: [
      { accountCode: '5102', side: 'DEBIT', amountRupiah: rupiah(input.nominalRupiah), counterpartyType: 'TEACHER', counterpartyId: input.guruId },
      { accountCode: '2104', side: 'CREDIT', amountRupiah: rupiah(input.nominalRupiah), counterpartyType: 'TEACHER', counterpartyId: input.guruId },
    ],
  }
}

/** Daftar resep untuk layar jurnal manual: bendahara memilih label, bukan akun. */
export const RESEP_MANUAL = [
  { kunci: 'TOPUP_MANUAL', label: 'Wali transfer manual (konfirmasi bukti)' },
  { kunci: 'ALOKASI', label: 'Bayar tagihan dari saldo titipan' },
  { kunci: 'ALOKASI_KEMBALI', label: 'Kembalikan alokasi sebelum cutoff' },
  { kunci: 'SETTLEMENT', label: 'Dana gateway masuk rekening utama' },
  { kunci: 'PENCAIRAN', label: 'Cairkan ke pengelola/guru' },
] as const
