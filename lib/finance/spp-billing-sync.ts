// lib/finance/spp-billing-sync.ts
//
// Sinkron SPP ke finance_bills untuk SEMUA santri aktif sekaligus, dengan
// binding D1 eksplisit — dipakai oleh cron worker
// (workers/service-billing-auto.ts) supaya finance_bills tidak kosong untuk
// santri yang orang tuanya belum pernah buka Portal Ortu.
//
// syncPortalSppBills (portal-bills-sync.ts) TETAP ADA dan tidak diubah — itu
// tetap jalan tiap portal dibuka untuk refresh real-time satu santri. Fungsi
// di sini melakukan hal yang SAMA (period-key & bill_kind='SPP' identik,
// supaya konfirmasi-spp/alokasi/portal tetap kompatibel) tapi untuk seluruh
// santri aktif sekaligus, dipanggil dari cron harian — jadi finance_bills
// selalu punya baseline SPP terkini tanpa menunggu ortu login.
//
// Sengaja TIDAK memanggil getTunggakanSppSantri/syncPortalSppBills langsung
// karena keduanya bergantung getDB()/getFinanceDB() (getCloudflareContext),
// yang hanya tersedia dalam request Next.js/OpenNext — tidak jalan di
// standalone scheduled worker. Query tarif & billing-start diambil SEKALI di
// awal (bukan per-santri) supaya batch job ini tidak melakukan ratusan query
// berulang untuk hal yang sama.

import { generateId } from '@/lib/db'
import { getSppStudentBillingStart, periodKey as sppPeriodKey, monthLabel } from '@/lib/spp/tunggakan'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { BILLING_START_KEY, SPP_FALLBACK, parseBillingStart } from './service-tariffs'

const SYNC_ACTOR = 'CRON_SPP_AUTO'

type SantriRow = {
  id: string
  tanggal_masuk: string | null
  created_at: string | null
  bebas_spp: number | null
  asrama: string | null
}

type ExistingBillRow = {
  id: string
  status: string
  amount_rupiah: number
  paid_rupiah: number
  period_key: string
}

export type SppAutoSyncResult = {
  santriProcessed: number
  billsCreated: number
  billsUpdated: number
  billsVoided: number
}

export async function syncSppBillsAllSantriCore(
  db: D1Database,
  financeDb: D1Database,
  asOf = new Date(),
): Promise<SppAutoSyncResult> {
  const currentYear = asOf.getFullYear()
  const currentMonth = asOf.getMonth() + 1
  const endKey = sppPeriodKey(currentYear, currentMonth)

  const billingStartRow = await financeDb.prepare(
    `SELECT value FROM finance_settings WHERE key = ?`
  ).bind(BILLING_START_KEY.SPP).first<{ value: string }>()
  const billingStart = billingStartRow?.value ? parseBillingStart(billingStartRow.value) : parseBillingStart(SPP_FALLBACK)

  const tariffRows = (await financeDb.prepare(
    `SELECT effective_month, amount_rupiah FROM finance_service_tariffs WHERE service_kind = 'SPP' ORDER BY effective_month DESC, id DESC`
  ).all<{ effective_month: string; amount_rupiah: number }>()).results ?? []
  const pickTariff = (yyyymm: string) => {
    const row = tariffRows.find(r => r.effective_month <= yyyymm)
    return row ? Number(row.amount_rupiah) : 70000
  }

  const santriList = (await db.prepare(
    `SELECT id, tanggal_masuk, created_at, COALESCE(bebas_spp,0) AS bebas_spp, asrama FROM santri WHERE status_global = 'aktif'`
  ).all<SantriRow>()).results ?? []

  let billsCreated = 0
  let billsUpdated = 0
  let billsVoided = 0

  for (const santri of santriList) {
    const tampilkanSpp = !isAsramaTanpaKamar(santri.asrama)
    const studentBillingStart = getSppStudentBillingStart(santri, billingStart)
    const studentStartKey = sppPeriodKey(studentBillingStart.tahun, studentBillingStart.bulan)

    const items: { periodKeyStr: string; title: string; nominal: number }[] = []

    if (tampilkanSpp) {
      const paidRows = (await db.prepare(
        `SELECT tahun, bulan FROM spp_log WHERE santri_id = ? AND (tahun*100+bulan) BETWEEN ? AND ?`
      ).bind(santri.id, studentStartKey, endKey).all<{ tahun: number; bulan: number }>()).results ?? []
      const paidKeys = new Set(paidRows.map(r => sppPeriodKey(r.tahun, r.bulan)))

      const waivedRows = (await db.prepare(
        `SELECT tahun, bulan FROM spp_tagihan_ditiadakan WHERE santri_id = ? AND is_active = 1 AND (tahun*100+bulan) BETWEEN ? AND ?`
      ).bind(santri.id, studentStartKey, endKey).all<{ tahun: number; bulan: number }>()).results ?? []
      const waivedKeys = new Set(waivedRows.map(r => sppPeriodKey(r.tahun, r.bulan)))

      if (Number(santri.bebas_spp) !== 1) {
        for (let year = studentBillingStart.tahun; year <= currentYear; year++) {
          const fromMonth = year === studentBillingStart.tahun ? studentBillingStart.bulan : 1
          const toMonth = year === currentYear ? currentMonth : 12
          for (let month = fromMonth; month <= toMonth; month++) {
            const key = sppPeriodKey(year, month)
            if (paidKeys.has(key) || waivedKeys.has(key)) continue
            items.push({
              periodKeyStr: `PORTAL_SPP:B:${year}-${String(month).padStart(2, '0')}`,
              title: monthLabel(year, month),
              nominal: pickTariff(`${year}-${String(month).padStart(2, '0')}`),
            })
          }
        }
      }

      const historisRows = (await db.prepare(
        `SELECT id, tahun, bulan, nominal_tagihan FROM spp_tunggakan_historis
         WHERE santri_id = ? AND status = 'BELUM_LUNAS' AND (tahun*100+bulan) >= ?
         ORDER BY tahun, bulan`
      ).bind(santri.id, studentStartKey).all<{ id: string; tahun: number; bulan: number; nominal_tagihan: number }>()).results ?? []
      for (const row of historisRows) {
        items.push({
          periodKeyStr: `PORTAL_SPP:H:${row.id}`,
          title: monthLabel(row.tahun, row.bulan),
          nominal: Number(row.nominal_tagihan),
        })
      }
    }

    // Satu query untuk semua bill SPP santri ini — dipakai baik untuk
    // keputusan upsert maupun untuk cari bill basi yang perlu di-void,
    // supaya tidak query per-item seperti upsertOpenBill di portal-bills-sync.
    const existingRows = (await financeDb.prepare(
      `SELECT id,status,amount_rupiah,paid_rupiah,period_key FROM finance_bills WHERE santri_id=? AND bill_kind='SPP'`
    ).bind(santri.id).all<ExistingBillRow>()).results ?? []
    const existingByPeriod = new Map(existingRows.map(row => [row.period_key, row]))

    const statements = []
    const keep = new Set<string>()

    for (const item of items) {
      keep.add(item.periodKeyStr)
      const existing = existingByPeriod.get(item.periodKeyStr)
      if (!existing) {
        statements.push(financeDb.prepare(
          `INSERT INTO finance_bills(id,santri_id,bill_kind,title,period_key,amount_rupiah,created_by) VALUES(?,?,?,?,?,?,?)`
        ).bind(generateId(), santri.id, 'SPP', item.title, item.periodKeyStr, item.nominal, SYNC_ACTOR))
        billsCreated++
      } else if (existing.status === 'OPEN' && Number(existing.amount_rupiah) !== item.nominal) {
        statements.push(financeDb.prepare(
          `UPDATE finance_bills SET amount_rupiah=?,title=?,updated_at=datetime('now') WHERE id=? AND status='OPEN'`
        ).bind(item.nominal, item.title, existing.id))
        billsUpdated++
      }
    }

    // Bill lama yang tidak lagi tertagih di sisi legacy (lunas/waived) dan
    // belum dibayar sama sekali — void, sama seperti voidStaleBills di
    // portal-bills-sync.ts.
    for (const row of existingRows) {
      if (row.status !== 'OPEN' || Number(row.paid_rupiah) !== 0) continue
      if (!row.period_key.startsWith('PORTAL_SPP:')) continue
      if (keep.has(row.period_key)) continue
      statements.push(financeDb.prepare(
        `UPDATE finance_bills SET status='VOID',updated_at=datetime('now') WHERE id=? AND status='OPEN' AND paid_rupiah=0`
      ).bind(row.id))
      billsVoided++
    }

    if (statements.length) await financeDb.batch(statements)
  }

  return { santriProcessed: santriList.length, billsCreated, billsUpdated, billsVoided }
}
