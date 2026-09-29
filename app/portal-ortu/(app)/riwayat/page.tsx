import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPortalFinancialHistory, getPortalStudentBilling } from '@/lib/portal/finance'
import { getRiwayatSubmissions } from '@/lib/portal/data'
import { resolveDocumentLetterhead } from '@/lib/print/letterhead-server'
import { namaBulanId } from '@/lib/portal/format'
import { RiwayatClient, type LegacyRiwayatItem } from './_riwayat-client'

export const dynamic = 'force-dynamic'

const NON_SPP_LABEL: Record<string, string> = {
  BANGUNAN: 'Uang Bangunan',
  KESEHATAN: 'Kesehatan',
  EHB: 'EHB',
  EKSKUL: 'Ekstrakurikuler',
}

interface LegacyDetailItem {
  bulan?: number | string
  tahun?: number | string
  jenis_biaya?: string
}

function parseDetail(kategori: string, detailJson: string): string[] {
  try {
    const parsed = JSON.parse(detailJson) as LegacyDetailItem[]
    if (!Array.isArray(parsed)) return []
    if (kategori === 'SPP') {
      return parsed.map((item) => `${namaBulanId(Number(item.bulan))} ${item.tahun}`)
    }
    return parsed.map((item) => (item.jenis_biaya && NON_SPP_LABEL[item.jenis_biaya]) || String(item.jenis_biaya ?? ''))
  } catch {
    return []
  }
}

export default async function RiwayatPage() {
  const session = await requirePortalSessionStrict()

  const [history, billing, rows, letterhead] = await Promise.all([
    getPortalFinancialHistory(session.santri_id).catch(() => null),
    getPortalStudentBilling(session.santri_id),
    getRiwayatSubmissions(session.santri_id).catch(() => null),
    resolveDocumentLetterhead('receipt_pembayaran').catch(() => null),
  ])

  const legacyItems: LegacyRiwayatItem[] = (rows ?? []).map(row => ({
    id: row.id,
    kategori: row.kategori,
    rincian: parseDetail(row.kategori, row.detail_json),
    jumlah: row.jumlah,
    metode: row.metode,
    bank: (() => {
      try {
        const bank = row.bank_tujuan ? JSON.parse(row.bank_tujuan) : null
        return bank ? `${bank.bank} • ${bank.nomor}` : null
      } catch {
        return null
      }
    })(),
    buktiUrl: row.bukti_url,
    status: row.status,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
  }))

  return (
    <div className="px-5 pt-5 pb-32 space-y-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Riwayat</h1>
      </div>

      <RiwayatClient
        history={history ?? []}
        santri={billing.santri}
        letterheadProfile={letterhead?.profile ?? null}
        legacyItems={legacyItems}
        loadError={history === null || rows === null}
      />
    </div>
  )
}
