'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

async function getUserRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

// FIX #5: Hitung saldo langsung di SQL, ambil stats ringkasan juga di SQL
export async function getDashboardTabungan(asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Query santri + saldo masing-masing, dihitung langsung di SQL
  const [santriRows, statsRow] = await Promise.all([
    query<any>(`
      SELECT
        s.id, s.nama_lengkap, s.nis, s.kamar, s.asrama,
        CAST(s.kamar AS INTEGER) AS kamar_norm,
        COALESCE(SUM(CASE WHEN tl.jenis = 'MASUK' THEN tl.nominal ELSE -tl.nominal END), 0) AS saldo
      FROM santri s
      LEFT JOIN tabungan_log tl ON tl.santri_id = s.id
      WHERE s.asrama = ? AND s.status_global = 'aktif'
      GROUP BY s.id, s.nama_lengkap, s.nis, s.kamar, s.asrama
      ORDER BY CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
    `, [targetAsrama]),

    // Statistik bulan ini sekaligus
    queryOne<{ uang_fisik: number; masuk_bulan_ini: number; keluar_bulan_ini: number }>(`
      SELECT
        SUM(CASE WHEN tl.jenis = 'MASUK' THEN tl.nominal ELSE -tl.nominal END) AS uang_fisik,
        SUM(CASE WHEN tl.jenis = 'MASUK' AND tl.created_at >= ? THEN tl.nominal ELSE 0 END) AS masuk_bulan_ini,
        SUM(CASE WHEN tl.jenis = 'KELUAR' AND tl.created_at >= ? THEN tl.nominal ELSE 0 END) AS keluar_bulan_ini
      FROM tabungan_log tl
      INNER JOIN santri s ON s.id = tl.santri_id
      WHERE s.asrama = ? AND s.status_global = 'aktif'
    `, [startMonth, startMonth, targetAsrama]),
  ])

  if (!santriRows.length) return { santri: [], stats: null }

  return {
    santri: santriRows,
    stats: {
      uang_fisik: statsRow?.uang_fisik ?? 0,
      masuk_bulan_ini: statsRow?.masuk_bulan_ini ?? 0,
      keluar_bulan_ini: statsRow?.keluar_bulan_ini ?? 0,
    },
  }
}

export async function simpanTopup(santriId: string, nominal: number, keterangan: string): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()

  await execute(
    `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at)
     VALUES (?, ?, 'MASUK', ?, ?, ?, ?)`,
    [generateId(), santriId, nominal, keterangan || 'Topup Saldo', session?.id ?? null, new Date().toISOString()]
  )

  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true }
}

// FIX #7c: Ganti for...of await execute -> batch()
export async function simpanJajanMassal(listTransaksi: { santriId: string; nominal: number }[]): Promise<{ success: boolean; count: number } | { error: string }> {
  const session = await getSession()
  if (!listTransaksi.length) return { error: 'Tidak ada data.' }

  const now = new Date().toISOString()
  await batch(listTransaksi.map(item => ({
    sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at)
          VALUES (?, ?, 'KELUAR', ?, 'Jajan Harian', ?, ?)`,
    params: [generateId(), item.santriId, item.nominal, session?.id ?? null, now],
  })))

  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true, count: listTransaksi.length }
}

export async function getRiwayatTabunganSantri(santriId: string) {
  return query<any>(`
    SELECT tl.*, u.full_name AS admin_nama
    FROM tabungan_log tl
    LEFT JOIN users u ON u.id = tl.created_by
    WHERE tl.santri_id = ?
    ORDER BY tl.created_at DESC
    LIMIT 10
  `, [santriId])
}

export async function hapusTransaksi(id: string) {
  await execute('DELETE FROM tabungan_log WHERE id = ?', [id])
  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true }
}

export async function getClientRestriction() {
  return getUserRestriction()
}
