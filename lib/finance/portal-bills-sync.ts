// lib/finance/portal-bills-sync.ts
//
// Jembatan satu arah dari legacy ke Keuangan Terpusat, khusus Portal Ortu.
//
// Mesin hitung tunggakan tetap punya SATU sumber kebenaran yang sudah ada:
// getTunggakanSppSantri (spp_log/spp_tunggakan_historis, dipakai "Keuangan
// Santri" di app/dashboard/asrama/spp) dan getNonSppOutstandingSantri
// (pembayaran_tahunan, dipakai "Keuangan Pusat" di app/dashboard/keuangan/non-spp).
// Berkas ini HANYA MEMBACA keduanya — tidak pernah menulis ke spp_log,
// spp_tunggakan_historis, pembayaran_tahunan, atau biaya_settings — supaya
// kedua modul itu tidak terganggu sama sekali.
//
// Portal Ortu sendiri sepenuhnya bicara ke Keuangan Terpusat: setiap kali
// portal dibuka, hasil hitung legacy dicerminkan (idempotent) ke finance_bills
// (DB finance) berkode period_key `PORTAL_SPP:*` / `PORTAL_NONSPP:*`.
//
// Konsekuensi yang disadari sepenuhnya: begitu satu bill LUNAS lewat portal,
// layar legacy (Keuangan Santri / Keuangan Pusat) tidak tahu-menahu karena
// spp_log/pembayaran_tahunan memang sengaja tidak ditulis dari sini. Santri
// yang membayar lewat portal harus dicek statusnya lewat Keuangan Terpusat.
// Portal belum pernah dilaunching ke orang tua, jadi belum ada histori nyata
// yang perlu direkonsiliasi — keputusan ini diambil sadar oleh pemilik produk.

import { getFinanceDB as getDB, generateId, financeQuery, financeQueryOne } from '@/lib/db'
import { getTunggakanSppSantri } from '@/lib/spp/tunggakan'
import { getNonSppOutstandingSantri } from '@/lib/keuangan/non-spp-outstanding'
import { syncFinanceStudentSnapshot } from './snapshots'

const SYNC_ACTOR = 'PORTAL_SYNC'

export const NON_SPP_LABEL: Record<string, string> = {
  BANGUNAN: 'Uang Bangunan',
  KESEHATAN: 'Kesehatan',
  EHB: 'EHB (Evaluasi Hasil Belajar)',
  EKSKUL: 'Ekstrakurikuler',
}

export type PortalOpenBill = {
  id: string
  title: string
  amount_rupiah: number
  period_key: string | null
}

type ExistingBillRow = { id: string; status: string; amount_rupiah: number; paid_rupiah: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertOpenBill(db: any, statements: any[], santriId: string, billKind: 'SPP' | 'NON_SPP', periodKey: string, title: string, amountRupiah: number) {
  const existing = await financeQueryOne<ExistingBillRow>(
    `SELECT id,status,amount_rupiah,paid_rupiah FROM finance_bills WHERE santri_id=? AND bill_kind=? AND period_key=?`,
    [santriId, billKind, periodKey],
  )
  if (!existing) {
    statements.push(db.prepare(`INSERT INTO finance_bills(id,santri_id,bill_kind,title,period_key,amount_rupiah,created_by) VALUES(?,?,?,?,?,?,?)`)
      .bind(generateId(), santriId, billKind, title, periodKey, amountRupiah, SYNC_ACTOR))
    return
  }
  // Bill yang sudah PAID/VOID (atau sedang direview lewat pengajuan portal)
  // tidak boleh ditimpa — hanya bill yang masih OPEN & belum ada progres yang
  // nominalnya disegarkan mengikuti tarif/tunggakan terbaru.
  if (existing.status === 'OPEN' && Number(existing.amount_rupiah) !== amountRupiah) {
    statements.push(db.prepare(`UPDATE finance_bills SET amount_rupiah=?,title=?,updated_at=datetime('now') WHERE id=? AND status='OPEN'`)
      .bind(amountRupiah, title, existing.id))
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function voidStaleBills(db: any, statements: any[], santriId: string, billKind: 'SPP' | 'NON_SPP', prefix: string, keepPeriodKeys: Set<string>) {
  const stale = await financeQuery<{ id: string; period_key: string }>(
    `SELECT id,period_key FROM finance_bills WHERE santri_id=? AND bill_kind=? AND status='OPEN' AND paid_rupiah=0 AND period_key LIKE ?`,
    [santriId, billKind, `${prefix}%`],
  )
  for (const row of stale) {
    if (keepPeriodKeys.has(row.period_key)) continue
    // Sudah tidak tertagih lagi di sisi legacy (lunas/waived lewat jalur lama,
    // atau santri berubah status) — void, aman karena syarat paid_rupiah=0
    // sama seperti voidFinanceBill di lib/finance/billing.ts.
    statements.push(db.prepare(`UPDATE finance_bills SET status='VOID',updated_at=datetime('now') WHERE id=? AND status='OPEN' AND paid_rupiah=0`).bind(row.id))
  }
}

export async function syncPortalSppBills(santriId: string, tampilkanSpp: boolean): Promise<void> {
  await syncFinanceStudentSnapshot(santriId)
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statements: any[] = []
  const keep = new Set<string>()

  if (tampilkanSpp) {
    const tunggakan = await getTunggakanSppSantri(santriId)
    for (const item of tunggakan.items) {
      const periodKey = item.source === 'HISTORIS'
        ? `PORTAL_SPP:H:${item.id}`
        : `PORTAL_SPP:B:${item.tahun}-${String(item.bulan).padStart(2, '0')}`
      keep.add(periodKey)
      await upsertOpenBill(db, statements, santriId, 'SPP', periodKey, item.label, item.nominal)
    }
  }
  await voidStaleBills(db, statements, santriId, 'SPP', 'PORTAL_SPP:', keep)
  if (statements.length) await db.batch(statements)
}

export async function syncPortalNonSppBills(santriId: string): Promise<void> {
  await syncFinanceStudentSnapshot(santriId)
  const outstanding = await getNonSppOutstandingSantri(santriId)
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statements: any[] = []
  const keep = new Set<string>()

  if (outstanding) {
    for (const item of outstanding.items) {
      if (item.sisa <= 0) continue
      const periodKey = `PORTAL_NONSPP:${item.jenis}:${item.tahun_ajaran_id}`
      keep.add(periodKey)
      await upsertOpenBill(db, statements, santriId, 'NON_SPP', periodKey, NON_SPP_LABEL[item.jenis] || item.jenis, item.sisa)
    }
  }
  await voidStaleBills(db, statements, santriId, 'NON_SPP', 'PORTAL_NONSPP:', keep)
  if (statements.length) await db.batch(statements)
}

export async function getPortalOpenBills(santriId: string, billKind: 'SPP' | 'NON_SPP'): Promise<PortalOpenBill[]> {
  return financeQuery<PortalOpenBill>(
    `SELECT id,title,amount_rupiah,period_key FROM finance_bills
     WHERE santri_id=? AND bill_kind=? AND status='OPEN' AND period_key LIKE ?
     ORDER BY period_key`,
    [santriId, billKind, billKind === 'SPP' ? 'PORTAL_SPP:%' : 'PORTAL_NONSPP:%'],
  )
}

export function sppBillSublabel(periodKey: string | null) {
  return periodKey?.startsWith('PORTAL_SPP:H:') ? 'Tunggakan lama' : null
}

export function nonSppBillSublabel(periodKey: string | null) {
  return periodKey?.startsWith('PORTAL_NONSPP:BANGUNAN:') ? 'Sekali selama mondok' : null
}
