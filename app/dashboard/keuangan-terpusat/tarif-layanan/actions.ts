'use server'

import { revalidatePath } from 'next/cache'
import { query, queryOne, execute, generateId } from '@/lib/db'
import { requireFinanceAccess } from '@/lib/finance/access'
import { searchSantriByName as searchSantri } from '@/lib/finance/santri-search'
import { syncFinanceStudentSnapshot } from '@/lib/finance/snapshots'
import {
  addServiceTariff, listServiceTariffs, getServiceBillingStart, setServiceBillingStart, type ServiceKind,
} from '@/lib/finance/service-tariffs'
import {
  generateMonthlyServiceBills, addServiceArrears, markServiceArrearsLunas, listAllServiceArrears,
  addServiceBillSkip, cabutServiceBillSkip, listServiceBillSkip, type MealServiceKind,
} from '@/lib/finance/service-billing'
import {
  setExemption, listExempted, type PermanentExemptionKind,
} from '@/lib/finance/exemptions'
import { NON_SPP_JENIS_ALL, type NonSppJenis } from '@/lib/keuangan/non-spp-outstanding'

const PATH = '/dashboard/keuangan-terpusat/tarif-layanan'

export async function getTarifLayananData(serviceKind: ServiceKind) {
  await requireFinanceAccess('VIEW')
  const [tariffs, billingStart, arrears] = await Promise.all([
    listServiceTariffs(serviceKind),
    getServiceBillingStart(serviceKind),
    serviceKind === 'SPP' ? Promise.resolve([]) : listAllServiceArrears(serviceKind as MealServiceKind),
  ])
  return { tariffs, billingStart, arrears }
}

export async function addTariffAction(input: { serviceKind: ServiceKind; effectiveMonth: string; amountRupiah: number }) {
  const session = await requireFinanceAccess('CONFIGURE')
  const result = await addServiceTariff({ ...input, actorId: session.id })
  if (result.success) revalidatePath(PATH)
  return result
}

export async function saveBillingStartAction(input: { serviceKind: ServiceKind; value: string }) {
  const session = await requireFinanceAccess('CONFIGURE')
  const result = await setServiceBillingStart(input.serviceKind, input.value, session.id)
  if (result.success) revalidatePath(PATH)
  return result
}

export async function generateBillsAction(input: { serviceKind: MealServiceKind; yyyymm: string }) {
  const session = await requireFinanceAccess('CONFIGURE')
  const result = await generateMonthlyServiceBills(input.serviceKind, input.yyyymm, session.id)
  if (result.success) revalidatePath(PATH)
  return result
}

// Pencarian santri kini tinggal di `lib/finance/santri-search.ts` supaya halaman
// keuangan lain memakainya tanpa mengimpor server action milik halaman ini.
export type { SantriSearchRow } from '@/lib/finance/santri-search'

export async function searchSantriByName(keyword: string) {
  return searchSantri(keyword)
}

export async function addArrearsAction(input: {
  serviceKind: MealServiceKind
  santriId: string
  label: string
  amountRupiah: number
  catatan?: string
}): Promise<{ error: string } | { success: true; id: string }> {
  const session = await requireFinanceAccess('CONFIGURE')
  const student = await queryOne<{ id: string }>(
    `SELECT id FROM santri WHERE id=? AND status_global='aktif'`,
    [input.santriId]
  )
  if (!student) return { error: 'Santri tidak ditemukan atau tidak aktif.' }
  await syncFinanceStudentSnapshot(student.id)
  const result = await addServiceArrears({
    santriId: student.id,
    serviceKind: input.serviceKind,
    label: input.label,
    amountRupiah: input.amountRupiah,
    catatan: input.catatan,
    actorId: session.id,
  })
  if (!result.success) return { error: result.error }
  revalidatePath(PATH)
  return { success: true as const, id: result.id }
}

export async function markArrearsLunasAction(id: string) {
  await requireFinanceAccess('CONFIGURE')
  const result = await markServiceArrearsLunas(id)
  if (result.success) revalidatePath(PATH)
  return result
}

// ── Pembebasan permanen (SPP/Makan/Laundry/USPP) ──────────────────────────

export async function getExemptionData() {
  await requireFinanceAccess('VIEW')
  return listExempted()
}

export async function setExemptionAction(input: {
  santriId: string
  serviceKind: PermanentExemptionKind
  isActive: boolean
  alasan?: string
}) {
  const session = await requireFinanceAccess('CONFIGURE')
  const result = await setExemption({ ...input, actorId: session.id })
  if (result.success) revalidatePath(PATH)
  return result
}

// ── Skip tagihan Makan/Laundry per santri per bulan ───────────────────────

export async function getSkipData(serviceKind: MealServiceKind) {
  await requireFinanceAccess('VIEW')
  return listServiceBillSkip(serviceKind)
}

export async function addSkipAction(input: {
  serviceKind: MealServiceKind
  santriId: string
  tahun: number
  bulan: number
  alasan?: string
}) {
  const session = await requireFinanceAccess('CONFIGURE')
  await syncFinanceStudentSnapshot(input.santriId)
  const result = await addServiceBillSkip({ ...input, actorId: session.id })
  if (result.success) revalidatePath(PATH)
  return result
}

export async function cabutSkipAction(id: string) {
  await requireFinanceAccess('CONFIGURE')
  const result = await cabutServiceBillSkip(id)
  if (result.success) revalidatePath(PATH)
  return result
}

// ── Pembebasan tahunan (Bangunan/Kesehatan/EHB/Ekskul) ────────────────────
// Duplikat tipis dari catatBebasPembayaran/hapusBebasPembayaran di
// app/dashboard/master/santri-tools/actions.ts (tabel pembayaran_tahunan
// yang sama) — sengaja tidak reuse langsung karena fungsi itu digerbangi
// assertFeature('/dashboard/master/santri-tools', ...), bukan izin Keuangan
// Terpusat, sehingga staf yang cuma punya akses Keuangan Terpusat akan
// ditolak walau harusnya boleh.

export type BebasTahunanRow = {
  santri_id: string
  nama_lengkap: string
  nis: string | null
  jenis_biaya: NonSppJenis
  tahun_tagihan: number
  keterangan: string | null
}

export async function getBebasTahunanData(): Promise<BebasTahunanRow[]> {
  await requireFinanceAccess('VIEW')
  return query<BebasTahunanRow>(
    `SELECT p.santri_id, s.nama_lengkap, s.nis, p.jenis_biaya, p.tahun_tagihan, p.keterangan
     FROM pembayaran_tahunan p
     JOIN santri s ON s.id = p.santri_id
     WHERE p.nominal_bayar = 0 AND COALESCE(p.status,'AKTIF') != 'VOID'
     ORDER BY s.nama_lengkap, p.jenis_biaya`
  )
}

export async function catatBebasTahunanAction(input: {
  santriId: string
  jenis: NonSppJenis
  tahun: number
  keterangan?: string
}): Promise<{ error: string } | { success: true }> {
  const session = await requireFinanceAccess('CONFIGURE')
  if (!NON_SPP_JENIS_ALL.includes(input.jenis)) return { error: 'Jenis biaya tidak valid.' }
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = ? AND tahun_tagihan = ?`,
    [input.santriId, input.jenis, input.tahun]
  )
  if (existing) return { error: `${input.jenis} tahun ${input.tahun} sudah tercatat.` }

  await execute(
    `INSERT INTO pembayaran_tahunan (id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, tanggal_bayar, penerima_id, keterangan)
     VALUES (?, ?, ?, ?, 0, datetime('now'), ?, ?)`,
    [generateId(), input.santriId, input.jenis, input.tahun, session.id, input.keterangan?.trim() || `Dibebaskan lewat Keuangan Terpusat`]
  )
  revalidatePath(PATH)
  return { success: true as const }
}

export async function hapusBebasTahunanAction(input: { santriId: string; jenis: NonSppJenis; tahun: number }) {
  await requireFinanceAccess('CONFIGURE')
  await execute(
    `DELETE FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = ? AND tahun_tagihan = ? AND nominal_bayar = 0`,
    [input.santriId, input.jenis, input.tahun]
  )
  revalidatePath(PATH)
  return { success: true as const }
}
