'use server'

import { query, queryOne, batch, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

async function getUserRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

export async function getKamarsTabungan(asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest
  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar FROM santri
     WHERE asrama = ? AND status_global = 'aktif'
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [targetAsrama]
  )
  return { kamars: rows.map(r => r.kamar), asrama: targetAsrama }
}

// FIX BUG 1: Pisah query saldo dan query transaksi — jangan JOIN
// JOIN antara santri dan tabungan_log menyebabkan row multiplication
// sehingga SUM(saldo_tabungan) dihitung berkali-kali per santri
export async function getStatsTabungan(asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  const now = new Date()
  const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // 1 query, 2 subquery independen — tidak ada JOIN, tidak ada row multiplication
  const row = await queryOne<{ uang_fisik: number; masuk: number; keluar: number }>(
    `SELECT
       (SELECT COALESCE(SUM(saldo_tabungan), 0)
        FROM santri
        WHERE asrama = ? AND status_global = 'aktif') AS uang_fisik,
       COALESCE(SUM(CASE WHEN jenis = 'MASUK'  THEN nominal ELSE 0 END), 0) AS masuk,
       COALESCE(SUM(CASE WHEN jenis = 'KELUAR' THEN nominal ELSE 0 END), 0) AS keluar
     FROM tabungan_log
     WHERE created_at >= ?
       AND santri_id IN (
         SELECT id FROM santri WHERE asrama = ? AND status_global = 'aktif'
       )`,
    [targetAsrama, startMonth, targetAsrama]
  )

  return {
    uang_fisik:       row?.uang_fisik ?? 0,
    masuk_bulan_ini:  row?.masuk      ?? 0,
    keluar_bulan_ini: row?.keluar     ?? 0,
  }
}

export async function getSantriKamarTabungan(asramaRequest: string, kamar: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest
  return query<any>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.kamar, s.asrama,
            COALESCE(s.saldo_tabungan, 0) AS saldo
     FROM santri s
     WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
     ORDER BY s.nama_lengkap`,
    [targetAsrama, kamar]
  )
}

export async function simpanTopup(
  santriId: string,
  nominal: number,
  keterangan: string
): Promise<{ success: boolean } | { error: string }> {
  if (!nominal || nominal <= 0) return { error: 'Nominal tidak valid' }
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const now = new Date().toISOString()
  await batch([
    {
      sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at)
            VALUES (?, ?, 'MASUK', ?, ?, ?, ?)`,
      params: [generateId(), santriId, nominal, keterangan || 'Topup Saldo', session.id, now],
    },
    {
      sql: `UPDATE santri SET saldo_tabungan = COALESCE(saldo_tabungan, 0) + ? WHERE id = ?`,
      params: [nominal, santriId],
    },
  ])
  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true }
}

export async function simpanJajanMassal(
  listTransaksi: { santriId: string; nominal: number }[]
): Promise<{ success: boolean; count: number } | { error: string }> {
  if (!listTransaksi.length) return { error: 'Tidak ada data.' }
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  // Validasi: cek saldo cukup untuk setiap santri
  for (const item of listTransaksi) {
    const row = await queryOne<{ saldo: number }>(
      'SELECT COALESCE(saldo_tabungan, 0) AS saldo FROM santri WHERE id = ?',
      [item.santriId]
    )
    if (!row || row.saldo < item.nominal) {
      return { error: `Saldo tidak cukup untuk sebagian santri. Batalkan dan periksa ulang.` }
    }
  }

  const now = new Date().toISOString()
  await batch([
    ...listTransaksi.map(item => ({
      sql: `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at)
            VALUES (?, ?, 'KELUAR', ?, 'Jajan Harian', ?, ?)`,
      params: [generateId(), item.santriId, item.nominal, session.id, now],
    })),
    ...listTransaksi.map(item => ({
      sql: `UPDATE santri SET saldo_tabungan = COALESCE(saldo_tabungan, 0) - ? WHERE id = ?`,
      params: [item.nominal, item.santriId],
    })),
  ])
  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true, count: listTransaksi.length }
}

export async function getRiwayatTabunganSantri(santriId: string) {
  return query<any>(
    `SELECT tl.*, u.full_name AS admin_nama
     FROM tabungan_log tl
     LEFT JOIN users u ON u.id = tl.created_by
     WHERE tl.santri_id = ?
     ORDER BY tl.created_at DESC
     LIMIT 20`,
    [santriId]
  )
}

export async function hapusTransaksi(id: string) {
  const trx = await queryOne<{ santri_id: string; jenis: string; nominal: number }>(
    'SELECT santri_id, jenis, nominal FROM tabungan_log WHERE id = ?', [id]
  )
  if (!trx) return { error: 'Transaksi tidak ditemukan.' }

  // MASUK dihapus → saldo berkurang; KELUAR dihapus → saldo bertambah
  const delta = trx.jenis === 'MASUK' ? -trx.nominal : trx.nominal
  await batch([
    { sql: 'DELETE FROM tabungan_log WHERE id = ?', params: [id] },
    {
      sql: 'UPDATE santri SET saldo_tabungan = COALESCE(saldo_tabungan, 0) + ? WHERE id = ?',
      params: [delta, trx.santri_id]
    },
  ])
  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true }
}

export async function getClientRestriction() {
  return getUserRestriction()
}
