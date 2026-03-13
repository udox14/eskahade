'use server'

import { query, queryOne, batch, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

async function getUserRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

// Baca saldo langsung dari kolom cached santri.saldo_tabungan
// Stats bulan ini tetap dari tabungan_log, tapi filter created_at >= startMonth
// sehingga hanya baca baris bulan ini saja (jauh lebih sedikit)
export async function getDashboardTabungan(asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [santriRows, statsRow] = await Promise.all([
    // Saldo langsung dari cached column — tidak perlu JOIN tabungan_log
    query<any>(`
      SELECT
        s.id, s.nama_lengkap, s.nis, s.kamar, s.asrama,
        CAST(s.kamar AS INTEGER) AS kamar_norm,
        s.saldo_tabungan AS saldo
      FROM santri s
      WHERE s.asrama = ? AND s.status_global = 'aktif'
      ORDER BY CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
    `, [targetAsrama]),

    // Stats bulan ini — hanya baris created_at >= awal bulan (index idx_tabungan_santri_created)
    queryOne<{ uang_fisik: number; masuk_bulan_ini: number; keluar_bulan_ini: number }>(`
      SELECT
        SUM(s.saldo_tabungan)                                                            AS uang_fisik,
        SUM(CASE WHEN tl.jenis = 'MASUK'  AND tl.created_at >= ? THEN tl.nominal ELSE 0 END) AS masuk_bulan_ini,
        SUM(CASE WHEN tl.jenis = 'KELUAR' AND tl.created_at >= ? THEN tl.nominal ELSE 0 END) AS keluar_bulan_ini
      FROM santri s
      LEFT JOIN tabungan_log tl ON tl.santri_id = s.id AND tl.created_at >= ?
      WHERE s.asrama = ? AND s.status_global = 'aktif'
    `, [startMonth, startMonth, startMonth, targetAsrama]),
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
  const now = new Date().toISOString()

  // Atomik: insert log + update saldo cached dalam 1 batch
  await batch([
    {
      sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at)
            VALUES (?, ?, 'MASUK', ?, ?, ?, ?)`,
      params: [generateId(), santriId, nominal, keterangan || 'Topup Saldo', session?.id ?? null, now],
    },
    {
      sql: `UPDATE santri SET saldo_tabungan = saldo_tabungan + ? WHERE id = ?`,
      params: [nominal, santriId],
    },
  ])

  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true }
}

// Atomik: batch INSERT log + batch UPDATE saldo_tabungan sekaligus
export async function simpanJajanMassal(listTransaksi: { santriId: string; nominal: number }[]): Promise<{ success: boolean; count: number } | { error: string }> {
  const session = await getSession()
  if (!listTransaksi.length) return { error: 'Tidak ada data.' }

  const now = new Date().toISOString()

  await batch([
    // INSERT ke tabungan_log untuk semua santri
    ...listTransaksi.map(item => ({
      sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at)
            VALUES (?, ?, 'KELUAR', ?, 'Jajan Harian', ?, ?)`,
      params: [generateId(), item.santriId, item.nominal, session?.id ?? null, now],
    })),
    // UPDATE saldo_tabungan per santri
    ...listTransaksi.map(item => ({
      sql: `UPDATE santri SET saldo_tabungan = saldo_tabungan - ? WHERE id = ?`,
      params: [item.nominal, item.santriId],
    })),
  ])

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
  // Baca dulu jenis & nominal sebelum hapus, untuk koreksi saldo_tabungan
  const trx = await queryOne<{ santri_id: string; jenis: string; nominal: number }>(
    'SELECT santri_id, jenis, nominal FROM tabungan_log WHERE id = ?',
    [id]
  )
  if (!trx) return { error: 'Transaksi tidak ditemukan.' }

  // Koreksi saldo: jika MASUK dihapus → kurangi; jika KELUAR dihapus → tambah
  const delta = trx.jenis === 'MASUK' ? -trx.nominal : trx.nominal

  await batch([
    {
      sql: 'DELETE FROM tabungan_log WHERE id = ?',
      params: [id],
    },
    {
      sql: 'UPDATE santri SET saldo_tabungan = saldo_tabungan + ? WHERE id = ?',
      params: [delta, trx.santri_id],
    },
  ])

  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true }
}

export async function getClientRestriction() {
  return getUserRestriction()
}