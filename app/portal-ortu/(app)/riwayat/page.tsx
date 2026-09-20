import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPortalFinancialHistory, getPortalStudentBilling } from '@/lib/portal/finance'
import { getRiwayatSubmissions } from '@/lib/portal/data'
import { namaBulanId } from '@/lib/portal/format'
import { PortalPageHeader } from '../../_components/page-header'
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

  const [history, billing, rows] = await Promise.all([
    getPortalFinancialHistory(session.santri_id).catch(() => []),
    getPortalStudentBilling(session.santri_id),
    getRiwayatSubmissions(session.santri_id).catch(() => []),
  ])

  const legacyItems: LegacyRiwayatItem[] = rows.map(row => ({
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
    <div>
      <PortalPageHeader
        kicker="Pembayaran"
        title="Riwayat Transaksi"
        subtitle="Riwayat pembayaran resmi tagihan, Uang Jajan & kuitansi sah"
      />
      <div className="px-4 pt-4 sm:px-5 pb-24 space-y-4">
        <RiwayatClient
          history={history}
          santri={billing.santri}
          legacyItems={legacyItems}
        />
      </div>
    </div>
  )
}
