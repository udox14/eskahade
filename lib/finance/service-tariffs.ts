// lib/finance/service-tariffs.ts
//
// Tarif effective-dated dipakai bareng oleh SPP, Uang Makan, dan Uang Laundry
// — satu sistem, satu tabel (finance_service_tariffs, FINANCE_DB), dikelola
// dari Keuangan Terpusat (bukan lagi spp_settings/app_settings di DB utama
// yang cuma granularitas per-tahun).
//
// Tarif untuk suatu bulan = baris terbaru dengan effective_month <= bulan itu.
// Mengganti tarif TIDAK PERNAH menimpa bill yang sudah dibuat — finance_bills
// menyimpan amount_rupiah sendiri per baris, cuma bill baru yang mengikuti
// tarif terbaru saat itu.

import { financeQuery, financeQueryOne, generateId, getFinanceDB as getDB } from '@/lib/db'
import type { SppBillingStart } from '@/lib/spp/tunggakan'

export type ServiceKind = 'SPP' | 'MAKAN' | 'LAUNDRY'

export type ServiceTariffRow = {
  id: string
  service_kind: ServiceKind
  effective_month: string
  amount_rupiah: number
  created_by: string
  created_at: string
}

const BILLING_START_KEY: Record<ServiceKind, string> = {
  SPP: 'finance_spp_tagihan_mulai',
  MAKAN: 'finance_meal_tagihan_mulai',
  LAUNDRY: 'finance_laundry_tagihan_mulai',
}

// Dipertahankan supaya SPP tidak tiba-tiba kehilangan tanggal awal tagihan
// kalau staff belum sempat pindahkan setting-nya ke halaman baru — sama
// seperti fallback lama di getSppBillingStartSetting (app_settings, sekarang
// digantikan tabel ini).
const SPP_FALLBACK = '2026-06'

function parseBillingStart(value: string): SppBillingStart {
  const [tahunStr, bulanStr] = value.split('-')
  const tahun = Number(tahunStr)
  const bulan = Number(bulanStr)
  return {
    tahun: Number.isFinite(tahun) ? tahun : 2026,
    bulan: Number.isFinite(bulan) ? bulan : 1,
    value,
  }
}

export async function getServiceBillingStart(serviceKind: ServiceKind): Promise<SppBillingStart | null> {
  const row = await financeQueryOne<{ value: string }>(
    `SELECT value FROM finance_settings WHERE key = ?`,
    [BILLING_START_KEY[serviceKind]]
  )
  if (row?.value) return parseBillingStart(row.value)
  if (serviceKind === 'SPP') return parseBillingStart(SPP_FALLBACK)
  return null
}

export async function setServiceBillingStart(serviceKind: ServiceKind, value: string, actorId: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return { success: false as const, error: 'Format tanggal awal tagihan harus YYYY-MM.' }
  const db = await getDB()
  await db.prepare(
    `INSERT INTO finance_settings(key,value,updated_at,updated_by) VALUES(?,?,datetime('now'),?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now'),updated_by=excluded.updated_by`
  ).bind(BILLING_START_KEY[serviceKind], value, actorId).run()
  return { success: true as const }
}

export async function getServiceTariffForMonth(serviceKind: ServiceKind, yyyymm: string): Promise<number | null> {
  const row = await financeQueryOne<{ amount_rupiah: number }>(
    `SELECT amount_rupiah FROM finance_service_tariffs
     WHERE service_kind = ? AND effective_month <= ?
     ORDER BY effective_month DESC, id DESC LIMIT 1`,
    [serviceKind, yyyymm]
  )
  return row ? Number(row.amount_rupiah) : null
}

export async function listServiceTariffs(serviceKind: ServiceKind): Promise<ServiceTariffRow[]> {
  return financeQuery<ServiceTariffRow>(
    `SELECT id,service_kind,effective_month,amount_rupiah,created_by,created_at
     FROM finance_service_tariffs WHERE service_kind = ? ORDER BY effective_month DESC, id DESC`,
    [serviceKind]
  )
}

export async function addServiceTariff(input: {
  serviceKind: ServiceKind
  effectiveMonth: string
  amountRupiah: number
  actorId: string
}) {
  if (!/^\d{4}-\d{2}$/.test(input.effectiveMonth)) return { success: false as const, error: 'Format bulan berlaku harus YYYY-MM.' }
  if (!Number.isSafeInteger(input.amountRupiah) || input.amountRupiah <= 0) return { success: false as const, error: 'Nominal tarif tidak valid.' }
  const db = await getDB()
  const id = generateId()
  await db.prepare(
    `INSERT INTO finance_service_tariffs(id,service_kind,effective_month,amount_rupiah,created_by) VALUES(?,?,?,?,?)`
  ).bind(id, input.serviceKind, input.effectiveMonth, input.amountRupiah, input.actorId).run()
  return { success: true as const, id }
}
