import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getRiwayatSubmissions } from '@/lib/portal/data'
import { namaBulanId } from '@/lib/portal/format'
import { PortalPageHeader } from '../../_components/page-header'
import { RiwayatClient, type RiwayatItem } from './_riwayat-client'

export const dynamic = 'force-dynamic'

const NON_SPP_LABEL: Record<string, string> = {
  BANGUNAN: 'Uang Bangunan',
  KESEHATAN: 'Kesehatan',
  EHB: 'EHB',
  EKSKUL: 'Ekstrakurikuler',
}

function parseDetail(kategori: string, detailJson: string): string[] {
  try {
    const parsed = JSON.parse(detailJson)
    if (!Array.isArray(parsed)) return []
    if (kategori === 'SPP') {
      return parsed.map((item: any) => `${namaBulanId(Number(item.bulan))} ${item.tahun}`)
    }
    return parsed.map((item: any) => NON_SPP_LABEL[item.jenis_biaya] || String(item.jenis_biaya))
  } catch {
    return []
  }
}

export default async function RiwayatPage() {
  const session = await requirePortalSessionStrict()
  const rows = await getRiwayatSubmissions(session.santri_id)

  const items: RiwayatItem[] = rows.map(row => ({
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
        title="Riwayat Pengajuan"
        subtitle="Pantau status pembayaran transfer & QRIS Anda"
      />
      <div className="px-5 -mt-9">
        <RiwayatClient items={items} />
      </div>
    </div>
  )
}
