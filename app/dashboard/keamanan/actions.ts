'use server'

import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'

const PAGE_SIZE = 30

// ─── KAMUS PELANGGARAN ────────────────────────────────────────────────────────
export async function getMasterPelanggaran() {
  return query<any>(
    `SELECT id, kategori, nama_pelanggaran, poin, deskripsi, urutan
     FROM master_pelanggaran
     ORDER BY CASE kategori WHEN 'RINGAN' THEN 1 WHEN 'SEDANG' THEN 2 WHEN 'BERAT' THEN 3 ELSE 4 END,
              urutan, nama_pelanggaran`
  )
}

export async function tambahMasterPelanggaran(data: {
  kategori: string; nama: string; poin: number; deskripsi?: string
}): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session || !['admin', 'keamanan', 'dewan_santri'].includes(session.role))
    return { error: 'Akses ditolak' }
  await execute(
    'INSERT INTO master_pelanggaran (kategori, nama_pelanggaran, poin, deskripsi) VALUES (?, ?, ?, ?)',
    [data.kategori, data.nama, data.poin, data.deskripsi || null]
  )
  revalidateTag('master-pelanggaran', 'everything')
  revalidatePath('/dashboard/keamanan')
  return { success: true }
}

export async function editMasterPelanggaran(id: number, data: {
  kategori: string; nama: string; poin: number; deskripsi?: string
}): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session || !['admin', 'keamanan', 'dewan_santri'].includes(session.role))
    return { error: 'Akses ditolak' }
  await execute(
    'UPDATE master_pelanggaran SET kategori=?, nama_pelanggaran=?, poin=?, deskripsi=? WHERE id=?',
    [data.kategori, data.nama, data.poin, data.deskripsi || null, id]
  )
  revalidateTag('master-pelanggaran', 'everything')
  revalidatePath('/dashboard/keamanan')
  return { success: true }
}

export async function hapusMasterPelanggaran(id: number): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session || !['admin'].includes(session.role)) return { error: 'Akses ditolak' }
  const used = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM pelanggaran WHERE master_id=?', [id])
  if (used && used.n > 0) return { error: 'Tidak bisa dihapus — sudah dipakai di data pelanggaran' }
  await execute('DELETE FROM master_pelanggaran WHERE id=?', [id])
  revalidateTag('master-pelanggaran', 'everything')
  return { success: true }
}

// ─── CARI SANTRI ──────────────────────────────────────────────────────────────
export async function cariSantri(keyword: string) {
  return query<any>(
    `SELECT id, nama_lengkap, nis, asrama, kamar, nama_ayah, alamat
     FROM santri
     WHERE status_global = 'aktif'
       AND (nama_lengkap LIKE ? OR nis = ?)
     LIMIT 8`,
    [`%${keyword}%`, keyword]
  )
}

// ─── INPUT PELANGGARAN ────────────────────────────────────────────────────────
export async function simpanPelanggaran(data: {
  santriId: string
  masterId: number
  deskripsiTambahan?: string
  tanggal: string
  fotoUrl?: string
}): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const master = await queryOne<any>(
    'SELECT id, nama_pelanggaran, kategori, poin FROM master_pelanggaran WHERE id=?',
    [data.masterId]
  )
  if (!master) return { error: 'Jenis pelanggaran tidak ditemukan' }

  const deskripsi = data.deskripsiTambahan
    ? `${master.nama_pelanggaran}. ${data.deskripsiTambahan}`
    : master.nama_pelanggaran

  await execute(
    `INSERT INTO pelanggaran (id, santri_id, master_id, jenis, deskripsi, tanggal, poin, foto_url, penindak_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), data.santriId, data.masterId, master.kategori,
     deskripsi, data.tanggal, master.poin, data.fotoUrl || null, session.id]
  )

  revalidatePath('/dashboard/keamanan')
  return { success: true }
}

export async function hapusPelanggaran(id: string): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session || !['admin', 'keamanan', 'dewan_santri'].includes(session.role))
    return { error: 'Akses ditolak' }

  // Cascade: hapus surat_pernyataan yang mencantumkan pelanggaran ini
  // pelanggaran_ids disimpan sebagai JSON array — cari yang mengandung ID ini
  const suratTerdampak = await query<{ id: string; pelanggaran_ids: string }>(
    `SELECT id, pelanggaran_ids FROM surat_pernyataan
     WHERE pelanggaran_ids LIKE ?`,
    [`%"${id}"%`]
  )
  for (const surat of suratTerdampak) {
    const ids: string[] = JSON.parse(surat.pelanggaran_ids || '[]')
    const idsBarу = ids.filter(i => i !== id)
    if (idsBarу.length === 0) {
      // Tidak ada pelanggaran tersisa — hapus suratnya
      await execute('DELETE FROM surat_pernyataan WHERE id=?', [surat.id])
    } else {
      // Masih ada pelanggaran lain — update array
      await execute('UPDATE surat_pernyataan SET pelanggaran_ids=? WHERE id=?',
        [JSON.stringify(idsBarу), surat.id])
    }
  }

  await execute('DELETE FROM pelanggaran WHERE id=?', [id])
  revalidatePath('/dashboard/keamanan')
  revalidatePath('/dashboard/surat-santri')
  return { success: true }
}

// ─── DAFTAR PELANGGAR (unik per santri) ───────────────────────────────────────
// 1 query aggregate — tidak loop per santri
export async function getDaftarPelanggar(params: {
  search?: string; asrama?: string; page?: number
}) {
  const { search, asrama, page = 1 } = params
  const offset = (page - 1) * PAGE_SIZE

  const clauses = ["s.status_global IN ('aktif','keluar')"]
  const baseParams: any[] = []
  if (search)  { clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)'); baseParams.push(`%${search}%`, `%${search}%`) }
  if (asrama)  { clauses.push('s.asrama = ?'); baseParams.push(asrama) }

  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(DISTINCT p.santri_id) AS total
     FROM pelanggaran p JOIN santri s ON s.id = p.santri_id
     WHERE ${where}`,
    baseParams
  )
  const total = countRow?.total ?? 0

  const rows = await query<any>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
            COUNT(p.id)    AS jumlah_pelanggaran,
            SUM(p.poin)    AS total_poin,
            MAX(p.tanggal) AS terakhir,
            -- Level SP terakhir (ringan: subquery kecil di tabel kecil)
            (SELECT sp.level FROM surat_perjanjian sp
             WHERE sp.santri_id = s.id
             ORDER BY sp.created_at DESC LIMIT 1) AS sp_terakhir
     FROM pelanggaran p
     JOIN santri s ON s.id = p.santri_id
     WHERE ${where}
     GROUP BY p.santri_id
     ORDER BY total_poin DESC, terakhir DESC
     LIMIT ? OFFSET ?`,
    [...baseParams, PAGE_SIZE, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / PAGE_SIZE) }
}

// ─── DETAIL SANTRI (lazy, dipanggil saat modal dibuka) ───────────────────────
// 3 query parallel — riwayat pelanggaran + surat pernyataan + surat perjanjian
export async function getDetailSantri(santriId: string) {
  const [profil, pelanggaran, suratPernyataan, suratPerjanjian] = await Promise.all([
    queryOne<any>(
      `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
              s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.id = ?`,
      [santriId]
    ),
    query<any>(
      `SELECT p.id, p.tanggal, p.jenis, p.deskripsi, p.poin, p.foto_url,
              u.full_name AS penindak_nama,
              mp.nama_pelanggaran
       FROM pelanggaran p
       LEFT JOIN users u ON u.id = p.penindak_id
       LEFT JOIN master_pelanggaran mp ON mp.id = p.master_id
       WHERE p.santri_id = ?
       ORDER BY p.tanggal DESC, p.created_at DESC`,
      [santriId]
    ),
    query<any>(
      `SELECT sp.id, sp.tanggal, sp.pelanggaran_ids, sp.created_at,
              u.full_name AS dibuat_oleh_nama
       FROM surat_pernyataan sp
       LEFT JOIN users u ON u.id = sp.dibuat_oleh
       WHERE sp.santri_id = ?
       ORDER BY sp.tanggal DESC`,
      [santriId]
    ),
    query<any>(
      `SELECT sp.id, sp.level, sp.tanggal, sp.catatan, sp.created_at,
              u.full_name AS dibuat_oleh_nama
       FROM surat_perjanjian sp
       LEFT JOIN users u ON u.id = sp.dibuat_oleh
       WHERE sp.santri_id = ?
       ORDER BY sp.tanggal DESC`,
      [santriId]
    ),
  ])

  return { profil, pelanggaran, suratPernyataan, suratPerjanjian }
}

// ─── SIMPAN SURAT PERNYATAAN (log) ───────────────────────────────────────────
export async function simpanSuratPernyataan(
  santriId: string,
  pelanggaranIds: string[],
  tanggal: string
): Promise<{ success: boolean; id: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  const id = generateId()
  await execute(
    `INSERT INTO surat_pernyataan (id, santri_id, pelanggaran_ids, tanggal, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, santriId, JSON.stringify(pelanggaranIds), tanggal, session.id, now()]
  )
  revalidatePath('/dashboard/keamanan')
  return { success: true, id }
}

// ─── SIMPAN SURAT PERJANJIAN (log) ───────────────────────────────────────────
export async function simpanSuratPerjanjian(
  santriId: string,
  level: 'SP1' | 'SP2' | 'SP3' | 'SK',
  tanggal: string,
  catatan?: string
): Promise<{ success: boolean; id: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  const id = generateId()
  await execute(
    `INSERT INTO surat_perjanjian (id, santri_id, level, tanggal, catatan, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, santriId, level, tanggal, catatan || null, session.id, now()]
  )
  revalidatePath('/dashboard/keamanan')
  return { success: true, id }
}

// ─── DATA UNTUK PREVIEW SURAT PERNYATAAN ─────────────────────────────────────
export async function getDataSuratPernyataan(santriId: string, pelanggaranIds: string[]) {
  const [profil, pelanggaran] = await Promise.all([
    queryOne<any>(
      `SELECT s.nama_lengkap, s.asrama, s.kamar, s.nama_ayah, s.alamat,
              k.nama_kelas
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.id = ?`,
      [santriId]
    ),
    // IN query — max ids terbatas, aman
    pelanggaranIds.length > 0
      ? query<any>(
          `SELECT id, tanggal, deskripsi, jenis, poin
           FROM pelanggaran
           WHERE id IN (${pelanggaranIds.map(() => '?').join(',')})
           ORDER BY tanggal ASC`,
          pelanggaranIds
        )
      : Promise.resolve([]),
  ])
  return { profil, pelanggaran }
}

// ─── SUGGEST LEVEL SP BERIKUTNYA ─────────────────────────────────────────────
export async function getSuggestLevelSP(santriId: string) {
  const last = await queryOne<{ level: string }>(
    `SELECT level FROM surat_perjanjian WHERE santri_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [santriId]
  )
  if (!last) return 'SP1'
  const next: Record<string, string> = { SP1: 'SP2', SP2: 'SP3', SP3: 'SK', SK: 'SK' }
  return next[last.level] ?? 'SP1'
}