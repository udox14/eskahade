import { requirePortalSession } from '@/lib/portal/session'
import { getParentWalletLimits, getGlobalDailyLimit } from '@/lib/finance/wallet'
import { getStudentPinStatus } from '@/lib/finance/pins'
import { queryOne } from '@/lib/db'
import { AkunClient } from './_akun-client'

export const dynamic = 'force-dynamic'

export default async function AkunPage() {
  const session = await requirePortalSession()

  const [parentLimits, globalDailyLimit, pinStatus, riwayatKelas] = await Promise.all([
    getParentWalletLimits(session.santri_id).catch(() => null),
    getGlobalDailyLimit().catch(() => 100000),
    getStudentPinStatus(session.santri_id).catch(() => null),
    queryOne<{ nama_kelas: string | null }>(`
      SELECT k.nama_kelas
      FROM riwayat_pendidikan rp
      LEFT JOIN kelas k ON k.id = rp.kelas_id
      WHERE rp.santri_id = ? AND rp.status_riwayat = 'aktif'
      LIMIT 1
    `, [session.santri_id]).catch(() => null),
  ])

  return (
    <div className="px-5 pt-5 pb-32 space-y-5">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Akun</h1>
      </div>

      <AkunClient
        mustChangePassword={session.must_change_password}
        nis={session.nis}
        session={session}
        namaKelas={riwayatKelas?.nama_kelas || null}
        parentLimits={parentLimits}
        globalDailyLimit={globalDailyLimit}
        pinStatus={pinStatus}
      />
    </div>
  )
}
