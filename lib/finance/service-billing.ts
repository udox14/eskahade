// lib/finance/service-billing.ts
//
// Tagihan bulanan Uang Makan & Laundry — beda dari SPP yang otomatis/live
// (syncPortalSppBills, dijalankan tiap portal dibuka). Makan/Laundry sengaja
// staff-initiated: klik tombol "Generate Tagihan Bulan X" di Keuangan
// Terpusat → Tarif Layanan, idempoten (aman diklik ulang, skip santri yang
// sudah punya tagihan bulan itu).

import { getFinanceDB as getDB, generateId, financeQuery, financeQueryOne, query as mainQuery } from '@/lib/db'
import { getSppStudentBillingStart, isSppBillablePeriod, BULAN_SPP } from '@/lib/spp/tunggakan'
import { getServiceBillingStart, getServiceTariffForMonth } from './service-tariffs'

export type MealServiceKind = 'MAKAN' | 'LAUNDRY'

const VENDOR_COLUMN: Record<MealServiceKind, string> = {
  MAKAN: 'tempat_makan_id',
  LAUNDRY: 'tempat_mencuci_id',
}

const SERVICE_LABEL: Record<MealServiceKind, string> = {
  MAKAN: 'Uang Makan',
  LAUNDRY: 'Uang Laundry',
}

export type GenerateServiceBillsResult = {
  success: true
  created: number
  skippedExisting: number
  skippedNotBillable: number
  skippedExemption: number
  skippedWaived: number
  totalEligible: number
} | {
  success: false
  error: string
}

export async function generateMonthlyServiceBills(
  serviceKind: MealServiceKind,
  yyyymm: string,
  actorId: string
): Promise<GenerateServiceBillsResult> {
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) return { success: false, error: 'Format bulan harus YYYY-MM.' }
  const [tahun, bulan] = yyyymm.split('-').map(Number)

  const billingStart = await getServiceBillingStart(serviceKind)
  if (!billingStart) return { success: false, error: `Tanggal awal tagihan ${SERVICE_LABEL[serviceKind]} belum diatur.` }

  const tarif = await getServiceTariffForMonth(serviceKind, yyyymm)
  if (!tarif) return { success: false, error: `Tarif ${SERVICE_LABEL[serviceKind]} untuk bulan ${yyyymm} belum diatur.` }

  const vendorColumn = VENDOR_COLUMN[serviceKind]
  const santriList = await mainQuery<{
    id: string
    tanggal_masuk: string | null
    created_at: string | null
  }>(
    `SELECT id, tanggal_masuk, created_at FROM santri
     WHERE status_global = 'aktif' AND ${vendorColumn} IS NOT NULL`
  )

  // Santri yang dibebaskan permanen (lib/finance/exemptions.ts, DB utama) —
  // tidak pernah ditagih sama sekali untuk layanan ini.
  const exemptedRows = await mainQuery<{ santri_id: string }>(
    `SELECT santri_id FROM santri_pembebasan_biaya WHERE service_kind = ? AND is_active = 1`,
    [serviceKind]
  )
  const exemptedSet = new Set(exemptedRows.map(row => row.santri_id))

  const periodKey = `SERVICE:${serviceKind}:${yyyymm}`
  const existingRows = await financeQuery<{ santri_id: string }>(
    `SELECT santri_id FROM finance_bills WHERE bill_kind = ? AND period_key = ?`,
    [serviceKind, periodKey]
  )
  const existingSet = new Set(existingRows.map(row => row.santri_id))

  // Skip individual bulan ini saja (finance_service_bill_skip, FINANCE_DB) —
  // beda dari exemption permanen, hanya berlaku untuk bulan yyyymm ini.
  const skipRows = await financeQuery<{ santri_id: string }>(
    `SELECT santri_id FROM finance_service_bill_skip
     WHERE service_kind = ? AND tahun = ? AND bulan = ? AND is_active = 1`,
    [serviceKind, tahun, bulan]
  )
  const skipSet = new Set(skipRows.map(row => row.santri_id))

  const title = `${SERVICE_LABEL[serviceKind]} ${BULAN_SPP[bulan - 1]} ${tahun}`
  const db = await getDB()
  const statements = []
  let created = 0
  let skippedExisting = 0
  let skippedNotBillable = 0
  let skippedExemption = 0
  let skippedWaived = 0

  for (const santri of santriList) {
    if (exemptedSet.has(santri.id)) {
      skippedExemption++
      continue
    }
    if (existingSet.has(santri.id)) {
      skippedExisting++
      continue
    }
    if (skipSet.has(santri.id)) {
      skippedWaived++
      continue
    }
    const studentStart = getSppStudentBillingStart(santri, billingStart)
    if (!isSppBillablePeriod(tahun, bulan, studentStart)) {
      skippedNotBillable++
      continue
    }
    statements.push(
      db.prepare(
        `INSERT INTO finance_bills(id,santri_id,bill_kind,title,period_key,amount_rupiah,created_by) VALUES(?,?,?,?,?,?,?)`
      ).bind(generateId(), santri.id, serviceKind, title, periodKey, tarif, actorId)
    )
    created++
  }

  if (statements.length) await db.batch(statements)

  return { success: true, created, skippedExisting, skippedNotBillable, skippedExemption, skippedWaived, totalEligible: santriList.length }
}

export type ServiceBillSkipRow = {
  id: string
  santri_id: string
  service_kind: MealServiceKind
  tahun: number
  bulan: number
  alasan: string | null
  nis: string
  full_name: string
}

export async function addServiceBillSkip(input: {
  santriId: string
  serviceKind: MealServiceKind
  tahun: number
  bulan: number
  alasan?: string | null
  actorId: string
}) {
  if (!Number.isInteger(input.tahun) || input.tahun < 2000) return { success: false as const, error: 'Tahun tidak valid.' }
  if (!Number.isInteger(input.bulan) || input.bulan < 1 || input.bulan > 12) return { success: false as const, error: 'Bulan tidak valid.' }
  const db = await getDB()
  await db.prepare(
    `INSERT INTO finance_service_bill_skip (id,santri_id,service_kind,tahun,bulan,alasan,is_active,created_by)
     VALUES (?,?,?,?,?,?,1,?)
     ON CONFLICT(santri_id,service_kind,tahun,bulan) DO UPDATE SET
       is_active = 1, alasan = excluded.alasan, created_by = excluded.created_by, created_at = datetime('now')`
  ).bind(generateId(), input.santriId, input.serviceKind, input.tahun, input.bulan, input.alasan?.trim() || null, input.actorId).run()
  return { success: true as const }
}

export async function cabutServiceBillSkip(id: string) {
  const db = await getDB()
  await db.prepare(`UPDATE finance_service_bill_skip SET is_active = 0 WHERE id = ?`).bind(id).run()
  return { success: true as const }
}

export async function listServiceBillSkip(serviceKind: MealServiceKind): Promise<ServiceBillSkipRow[]> {
  return financeQuery<ServiceBillSkipRow>(
    `SELECT k.id,k.santri_id,k.service_kind,k.tahun,k.bulan,k.alasan,s.nis,s.full_name
     FROM finance_service_bill_skip k
     JOIN finance_student_snapshots s ON s.santri_id = k.santri_id
     WHERE k.service_kind = ? AND k.is_active = 1
     ORDER BY k.tahun DESC, k.bulan DESC`,
    [serviceKind]
  )
}

export type OpenServiceBill = {
  id: string
  title: string
  amount_rupiah: number
  paid_rupiah: number
  status: 'OPEN' | 'PARTIAL'
  period_key: string
}

export async function getOpenServiceBills(santriId: string, serviceKind: MealServiceKind): Promise<OpenServiceBill[]> {
  return financeQuery<OpenServiceBill>(
    `SELECT id,title,amount_rupiah,paid_rupiah,status,period_key FROM finance_bills
     WHERE santri_id=? AND bill_kind=? AND status IN ('OPEN','PARTIAL')
     ORDER BY period_key DESC`,
    [santriId, serviceKind]
  )
}

export type ServiceArrearsRow = {
  id: string
  santri_id: string
  service_kind: MealServiceKind
  label: string
  amount_rupiah: number
  status: 'BELUM_LUNAS' | 'LUNAS'
  catatan: string | null
  created_at: string
}

export async function getServiceArrearsHistoris(santriId: string, serviceKind: MealServiceKind): Promise<ServiceArrearsRow[]> {
  return financeQuery<ServiceArrearsRow>(
    `SELECT id,santri_id,service_kind,label,amount_rupiah,status,catatan,created_at
     FROM finance_service_arrears_historis WHERE santri_id=? AND service_kind=? ORDER BY created_at DESC`,
    [santriId, serviceKind]
  )
}

export type ServiceArrearsWithStudent = ServiceArrearsRow & { nis: string; full_name: string }

// Ringkasan untuk staff (Keuangan Terpusat) — gabung ke finance_student_snapshots
// (satu DB yang sama, FINANCE_DB) supaya tidak perlu query lintas database ke
// tabel santri di DB utama.
export async function listAllServiceArrears(serviceKind: MealServiceKind): Promise<ServiceArrearsWithStudent[]> {
  return financeQuery<ServiceArrearsWithStudent>(
    `SELECT a.id,a.santri_id,a.service_kind,a.label,a.amount_rupiah,a.status,a.catatan,a.created_at,
            s.nis,s.full_name
     FROM finance_service_arrears_historis a
     JOIN finance_student_snapshots s ON s.santri_id = a.santri_id
     WHERE a.service_kind = ?
     ORDER BY a.status ASC, a.created_at DESC`,
    [serviceKind]
  )
}

export async function addServiceArrears(input: {
  santriId: string
  serviceKind: MealServiceKind
  label: string
  amountRupiah: number
  catatan?: string | null
  actorId: string
}) {
  if (!input.label.trim()) return { success: false as const, error: 'Label tunggakan wajib diisi.' }
  if (!Number.isSafeInteger(input.amountRupiah) || input.amountRupiah <= 0) return { success: false as const, error: 'Nominal tidak valid.' }
  const db = await getDB()
  const id = generateId()
  await db.prepare(
    `INSERT INTO finance_service_arrears_historis(id,santri_id,service_kind,label,amount_rupiah,catatan,created_by)
     VALUES(?,?,?,?,?,?,?)`
  ).bind(id, input.santriId, input.serviceKind, input.label.trim(), input.amountRupiah, input.catatan?.trim() || null, input.actorId).run()
  return { success: true as const, id }
}

export async function markServiceArrearsLunas(id: string) {
  const row = await financeQueryOne<{ id: string; status: string }>(
    `SELECT id,status FROM finance_service_arrears_historis WHERE id=?`, [id]
  )
  if (!row) return { success: false as const, error: 'Data tunggakan tidak ditemukan.' }
  if (row.status === 'LUNAS') return { success: false as const, error: 'Tunggakan ini sudah lunas.' }
  const db = await getDB()
  await db.prepare(
    `UPDATE finance_service_arrears_historis SET status='LUNAS',updated_at=datetime('now') WHERE id=?`
  ).bind(id).run()
  return { success: true as const }
}
