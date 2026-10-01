'use server'

import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { assertFeature } from '@/lib/auth/feature'
import { actorFromSession, diffWhitelistedFields, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { resolveLetterIncidents, saveIncidentLetter } from '@/lib/discipline/data'
import { revalidateDiscipline } from '@/lib/discipline/revalidate'


const PAGE_SIZE = 30
const VALID_KATEGORI = new Set(['RINGAN', 'SEDANG', 'BERAT'])

type ImportMasterPelanggaranRow = {
  kategori?: unknown
  nama?: unknown
  nama_pelanggaran?: unknown
  poin?: unknown
  deskripsi?: unknown
  urutan?: unknown
}

export type ExportPelanggaranFilter = {
  santriIds?: string[]
  asramas?: string[]
  tanggalMulai?: string
  tanggalSelesai?: string
}

export type MasterPelanggaranItem = {
  id: number
  kategori: string
  nama_pelanggaran: string
  deskripsi: string | null
  urutan?: number | null
}

export type SantriSearchResult = {
  id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  nama_ayah?: string | null
  alamat?: string | null
  foto_url?: string | null
  nama_kelas?: string | null
}

export type DaftarPelanggarItem = {
  id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  foto_url: string | null
  nama_kelas: string | null
  jumlah_pelanggaran: number
  perlu_verifikasi: number
  terakhir: string | null
  sp_terakhir: string | null
}

export type ExportPelanggaranRow = {
  id: string
  tanggal: string | null
  created_at: string | null
  nis: string | null
  nama_lengkap: string | null
  asrama: string | null
  kamar: string | null
  jenis: string | null
  nama_pelanggaran: string | null
  deskripsi: string | null
  jumlah_kejadian: number | string | null
  perlu_verifikasi: boolean | number | null
  source: string | null
  source_id?: string | null
  sesi: string | null
  penindak_nama: string | null
  foto_url: string | null
}

export type DetailSantriResponse = {
  profil: {
    id: string
    nama_lengkap: string
    nis: string | null
    asrama: string | null
    kamar: string | null
    foto_url: string | null
    nama_ayah: string | null
    alamat: string | null
    nama_kelas: string | null
    status_global?: string | null
  } | null
  pelanggaran: Array<{
    id: string
    tanggal: string | null
    jenis: string | null
    deskripsi: string | null
    jumlah_kejadian: number | null
    perlu_verifikasi: number | boolean | null
    source: string | null
    source_id: string | null
    sesi: string | null
    foto_url: string | null
    penindak_nama: string | null
    nama_pelanggaran: string | null
  }>
  suratPernyataan: Array<{
    id: string
    tanggal: string | null
    pelanggaran_ids: string | null
    created_at: string | null
    dibuat_oleh_nama: string | null
  }>
  suratPerjanjian: Array<{
    id: string
    level: string
    tanggal: string | null
    catatan: string | null
    created_at: string | null
    dibuat_oleh_nama: string | null
  }>
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function cleanImportKey(kategori: string, nama: string) {
  return `${kategori}::${nama.trim().toLowerCase().replace(/\s+/g, ' ')}`
}

// ─── KAMUS PELANGGARAN ────────────────────────────────────────────────────────
export async function getMasterPelanggaran() {
  const access=await assertFeature('/dashboard/keamanan'); if('error' in access) throw new Error(access.error)
  return query<any>(
    `SELECT id, kategori, nama_pelanggaran, deskripsi, urutan
     FROM master_pelanggaran
     ORDER BY CASE kategori WHEN 'RINGAN' THEN 1 WHEN 'SEDANG' THEN 2 WHEN 'BERAT' THEN 3 ELSE 4 END,
              urutan, nama_pelanggaran`
  )
}

export async function tambahMasterPelanggaran(data: {
  kategori: string; nama: string; deskripsi?: string
}): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan', 'create')
  if ('error' in access) return access
  const session = access
  if(!VALID_KATEGORI.has(data.kategori)||!cleanText(data.nama)||cleanText(data.nama).length>120)return {error:'Kategori atau nama pelanggaran tidak valid.'}
  await execute(
    'INSERT INTO master_pelanggaran (kategori, nama_pelanggaran, poin, deskripsi) VALUES (?, ?, 0, ?)',
    [data.kategori, data.nama, data.deskripsi || null]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan',
    action: 'create',
    fiturHref: '/dashboard/keamanan',
    logKind: 'create',
    entityType: 'master_pelanggaran',
    entityLabel: data.nama,
    summary: `Menambahkan master pelanggaran ${data.nama}`,
    details: {
      kategori: data.kategori,

      deskripsi: data.deskripsi || null,
    },
  })
  
  revalidateDiscipline()
  return { success: true }
}

export async function editMasterPelanggaran(id: number, data: {
  kategori: string; nama: string; deskripsi?: string
}): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan', 'update')
  if ('error' in access) return access
  const session = access
  if(!VALID_KATEGORI.has(data.kategori)||!cleanText(data.nama)||cleanText(data.nama).length>120)return {error:'Kategori atau nama pelanggaran tidak valid.'}
  const beforeMaster = await queryOne<Record<string, unknown>>(
    'SELECT id, kategori, nama_pelanggaran, poin, deskripsi FROM master_pelanggaran WHERE id = ?',
    [id]
  )
  if (!beforeMaster) return { error: 'Master pelanggaran tidak ditemukan.' }
  await execute(
    'UPDATE master_pelanggaran SET kategori=?, nama_pelanggaran=?, deskripsi=? WHERE id=?',
    [data.kategori, data.nama, data.deskripsi || null, id]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan',
    action: 'update',
    fiturHref: '/dashboard/keamanan',
    logKind: 'update',
    entityType: 'master_pelanggaran',
    entityId: String(id),
    entityLabel: String(beforeMaster.nama_pelanggaran || data.nama),
    summary: `Memperbarui master pelanggaran ${String(beforeMaster.nama_pelanggaran || data.nama)}`,
    details: {
      changed_fields: diffWhitelistedFields(
        beforeMaster,
        {
          kategori: data.kategori,
          nama_pelanggaran: data.nama,

          deskripsi: data.deskripsi || null,
        },
        ['kategori', 'nama_pelanggaran', 'deskripsi']
      ),
    },
  })
  
  revalidateDiscipline()
  return { success: true }
}

export async function hapusMasterPelanggaran(id: number): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan', 'delete')
  if ('error' in access) return access
  const session = await getSession()
  const targetMaster = await queryOne<{
    id: number
    kategori: string | null
    nama_pelanggaran: string | null
    poin: number | null
    deskripsi: string | null
  }>('SELECT id, kategori, nama_pelanggaran, poin, deskripsi FROM master_pelanggaran WHERE id = ?', [id])
  if (!targetMaster) return { error: 'Master pelanggaran tidak ditemukan.' }
  const used = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM pelanggaran WHERE master_id=?', [id])
  if (used && used.n > 0) return { error: 'Tidak bisa dihapus — sudah dipakai di data pelanggaran' }
  await execute('DELETE FROM master_pelanggaran WHERE id=?', [id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan',
    action: 'delete',
    fiturHref: '/dashboard/keamanan',
    logKind: 'delete',
    entityType: 'master_pelanggaran',
    entityId: String(targetMaster.id),
    entityLabel: targetMaster.nama_pelanggaran || String(targetMaster.id),
    summary: `Menghapus master pelanggaran ${targetMaster.nama_pelanggaran || targetMaster.id}`,
    details: {
      kategori: targetMaster.kategori,
      poin: targetMaster.poin,
      deskripsi: targetMaster.deskripsi,
    },
  })
  
  return { success: true }
}

// ─── IMPORT KAMUS PELANGGARAN ────────────────────────────────────────────────
export async function importMasterPelanggaranMassal(
  rows: ImportMasterPelanggaranRow[]
): Promise<{ success: boolean; inserted: number; updated: number; skipped: number } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan', 'create')
  if ('error' in access) return access
  const session = await getSession()

  if (!Array.isArray(rows) || rows.length === 0) return { error: 'Data import kosong.' }

  const cleanRows = rows.map((row, index) => {
    const kategori = cleanText(row.kategori).toUpperCase()
    const nama = cleanText(row.nama_pelanggaran || row.nama)
    const deskripsi = cleanText(row.deskripsi)
    const urutanRaw = cleanText(row.urutan)
    const urutan = urutanRaw ? Number(urutanRaw) : 0

    if (!VALID_KATEGORI.has(kategori)) return { error: `Baris ${index + 2}: kategori harus RINGAN, SEDANG, atau BERAT.` }
    if (!nama) return { error: `Baris ${index + 2}: nama pelanggaran wajib diisi.` }
    if (!Number.isFinite(urutan)) return { error: `Baris ${index + 2}: urutan harus berupa angka.` }

    return {
      kategori,
      nama,
      deskripsi: deskripsi || null,
      urutan: Math.round(urutan),
      key: cleanImportKey(kategori, nama),
    }
  })

  const invalid = cleanRows.find((row): row is { error: string } => 'error' in row)
  if (invalid) return { error: invalid.error }

  const uniqueMap = new Map<string, Exclude<(typeof cleanRows)[number], { error: string }>>()
  for (const row of cleanRows) {
    if ('error' in row) continue
    uniqueMap.set(row.key, row)
  }
  const uniqueRows = Array.from(uniqueMap.values())
  if (uniqueRows.length === 0) return { error: 'Tidak ada baris valid untuk diimport.' }

  try {
    const existingRows = await query<{ id: number; kategori: string; nama_pelanggaran: string }>(
      'SELECT id, kategori, nama_pelanggaran FROM master_pelanggaran'
    )
    const existingMap = new Map(existingRows.map(row => [cleanImportKey(row.kategori, row.nama_pelanggaran), row.id]))

    const statements = uniqueRows.map(row => {
      const existingId = existingMap.get(row.key)
      if (existingId) {
        return {
          mode: 'update' as const,
          sql: 'UPDATE master_pelanggaran SET kategori=?, nama_pelanggaran=?, deskripsi=?, urutan=? WHERE id=?',
          params: [row.kategori, row.nama, row.deskripsi, row.urutan, existingId],
        }
      }
      return {
        mode: 'insert' as const,
        sql: 'INSERT INTO master_pelanggaran (kategori, nama_pelanggaran, poin, deskripsi, urutan) VALUES (?, ?, 0, ?, ?)',
        params: [row.kategori, row.nama, row.deskripsi, row.urutan],
      }
    })

    for (let i = 0; i < statements.length; i += 50) {
      await batch(statements.slice(i, i + 50).map(({ sql, params }) => ({ sql, params })))
    }

    const inserted = statements.filter(statement => statement.mode === 'insert').length
    const updated = statements.filter(statement => statement.mode === 'update').length
    const skipped = rows.length - uniqueRows.length

    await logActivity({
      actor: actorFromSession(session),
      module: 'keamanan',
      action: 'import',
      fiturHref: '/dashboard/keamanan',
      logKind: 'create',
      entityType: 'master_pelanggaran',
      summary: `Import kamus pelanggaran ${uniqueRows.length} baris`,
      details: { inserted, updated, skipped },
    })

    
    revalidateDiscipline()
    return { success: true, inserted, updated, skipped }
  } catch (error: any) {
    return { error: `Import gagal: ${error?.message || 'kesalahan tidak diketahui'}` }
  }
}

// ─── CARI SANTRI ──────────────────────────────────────────────────────────────
export async function cariSantri(keyword: string) {
  const access=await assertFeature('/dashboard/keamanan'); if('error' in access) throw new Error(access.error)
  return query<any>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.nama_ayah, s.alamat, s.foto_url,
            (SELECT k.nama_kelas FROM riwayat_pendidikan rp JOIN kelas k ON k.id=rp.kelas_id WHERE rp.santri_id=s.id AND lower(trim(COALESCE(rp.status_riwayat,'aktif'))) IN ('aktif','active','') LIMIT 1) AS nama_kelas
     FROM santri s
     WHERE s.status_global = 'aktif'
       AND (s.nama_lengkap LIKE ? OR s.nis = ?)
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
  const access = await assertFeature('/dashboard/keamanan', 'create')
  if ('error' in access) return access
  const session = access

  if(!/^\d{4}-\d{2}-\d{2}$/.test(data.tanggal)||!Number.isFinite(Date.parse(data.tanggal))||new Date(data.tanggal+'T00:00:00Z').toISOString().slice(0,10)!==data.tanggal)return {error:'Tanggal kejadian tidak valid.'}
  const student=await queryOne<{id:string}>("SELECT id FROM santri WHERE id=? AND status_global='aktif'",[data.santriId]);if(!student)return {error:'Santri aktif tidak ditemukan.'}
  const master = await queryOne<any>(
    'SELECT id, nama_pelanggaran, kategori FROM master_pelanggaran WHERE id=?',
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
     deskripsi, data.tanggal, 0, data.fotoUrl || null, session.id]
  )

  const actorSession = await getSession()
  const santri = await queryOne<{ nama_lengkap: string | null; nis: string | null }>(
    'SELECT nama_lengkap, nis FROM santri WHERE id = ?',
    [data.santriId]
  )
  await logActivity({
    actor: actorFromSession(actorSession),
    module: 'keamanan',
    action: 'create',
    fiturHref: '/dashboard/keamanan',
    logKind: 'create',
    entityType: 'pelanggaran',
    entityLabel: santri?.nama_lengkap || santri?.nis || data.santriId,
    summary: `Mencatat pelanggaran untuk ${santri?.nama_lengkap || santri?.nis || data.santriId}`,
    details: {
      jenis: master.kategori,
      nama_pelanggaran: master.nama_pelanggaran,
      jumlah_kejadian: 1,
      tanggal: data.tanggal,
    },
  })

  revalidateDiscipline()
  return { success: true }
}

export async function hapusPelanggaran(id: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan', 'delete')
  if ('error' in access) return access
  const session = access
  if(id.startsWith('pengajian:')||id.startsWith('sesi:'))return {error:'Koreksi catatan ini melalui modul asalnya.'}
  if(id.startsWith('umum:'))id=id.slice(5)
  const target = await queryOne<{
    id: string
    deskripsi: string | null
    jenis: string | null
    poin: number | null
    nama_lengkap: string | null
  }>(
    `SELECT p.id, p.deskripsi, p.jenis, p.poin, s.nama_lengkap
     FROM pelanggaran p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,
    [id]
  )
  if (!target) return { error: 'Data pelanggaran tidak ditemukan.' }

  if (id.startsWith('pengajian:') || id.startsWith('sesi:')) return { error: 'Koreksi catatan ini melalui modul asalnya.' }
  await execute("UPDATE pelanggaran SET status='cancelled',version=version+1,updated_by=?,updated_at=?,reason='Pembatalan oleh petugas keamanan' WHERE id=? AND status='active'",[session?.id??null,now(),id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan',
    action: 'delete',
    fiturHref: '/dashboard/keamanan',
    logKind: 'delete',
    entityType: 'pelanggaran',
    entityId: id,
    entityLabel: target.nama_lengkap || id,
    summary: `Membatalkan pelanggaran milik ${target.nama_lengkap || id}`,
    details: {
      deskripsi: target.deskripsi,
      jenis: target.jenis,
      poin: target.poin,
    },
  })
  revalidateDiscipline()
  revalidatePath('/dashboard/surat-santri')
  return { success: true }
}

// ─── DAFTAR PELANGGAR (unik per santri) ───────────────────────────────────────
// 1 query aggregate — tidak loop per santri
export async function getDaftarPelanggar(params: {
  search?: string; asrama?: string; page?: number
}) {
  const access=await assertFeature('/dashboard/keamanan'); if('error' in access) throw new Error(access.error)
  const { search, asrama, page = 1 } = params
  const offset = (page - 1) * PAGE_SIZE

  const clauses = ["s.status_global IN ('aktif','keluar')", "p.status='active'"]
  const baseParams: any[] = []
  if (search)  { clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)'); baseParams.push(`%${search}%`, `%${search}%`) }
  if (asrama)  { clauses.push('s.asrama = ?'); baseParams.push(asrama) }

  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(DISTINCT p.santri_id) AS total
     FROM discipline_incidents p JOIN santri s ON s.id = p.santri_id
     WHERE ${where}`,
    baseParams
  )
  const total = countRow?.total ?? 0

  const rows = await query<any>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
            (SELECT k.nama_kelas FROM riwayat_pendidikan rp JOIN kelas k ON k.id=rp.kelas_id WHERE rp.santri_id=s.id AND lower(trim(COALESCE(rp.status_riwayat,'aktif'))) IN ('aktif','active','') LIMIT 1) AS nama_kelas,
            SUM(p.jumlah_kejadian) AS jumlah_pelanggaran,
            SUM(p.perlu_verifikasi) AS perlu_verifikasi,
            MAX(p.tanggal) AS terakhir,
            -- Level SP terakhir (ringan: subquery kecil di tabel kecil)
            (SELECT sp.level FROM surat_perjanjian sp
             WHERE sp.santri_id = s.id
             ORDER BY sp.created_at DESC LIMIT 1) AS sp_terakhir
     FROM discipline_incidents p
     JOIN santri s ON s.id = p.santri_id
     WHERE ${where}
     GROUP BY p.santri_id
     ORDER BY jumlah_pelanggaran DESC, terakhir DESC,s.id
     LIMIT ? OFFSET ?`,
    [...baseParams, PAGE_SIZE, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / PAGE_SIZE) }
}

// ─── DETAIL SANTRI (lazy, dipanggil saat modal dibuka) ───────────────────────
// 3 query parallel — riwayat pelanggaran + surat pernyataan + surat perjanjian
export async function getOpsiExportPelanggaran() {
  const access = await assertFeature('/dashboard/keamanan')
  if ('error' in access) return access

  const [asramaRows, santriRows] = await Promise.all([
    query<{ asrama: string }>(
      `SELECT DISTINCT s.asrama
       FROM discipline_incidents p
       JOIN santri s ON s.id = p.santri_id
       WHERE p.status='active' AND s.asrama IS NOT NULL AND s.asrama <> ''
       ORDER BY s.asrama`
    ),
    query<{ id: string; nama_lengkap: string; nis: string | null; asrama: string | null; kamar: string | null }>(
      `SELECT DISTINCT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar
       FROM discipline_incidents p
       JOIN santri s ON s.id = p.santri_id
       WHERE p.status='active' AND s.status_global IN ('aktif','keluar')
       ORDER BY s.nama_lengkap`
    ),
  ])

  return {
    asramas: asramaRows.map(row => row.asrama),
    santri: santriRows,
  }
}

export async function getDataExportPelanggaran(filter: ExportPelanggaranFilter = {}) {
  const access = await assertFeature('/dashboard/keamanan')
  if ('error' in access) return access

  const clauses = ["s.status_global IN ('aktif','keluar')", "p.status='active'"]
  const params: any[] = []

  const santriIds = Array.isArray(filter.santriIds)
    ? filter.santriIds.map(cleanText).filter(Boolean)
    : []
  const asramas = Array.isArray(filter.asramas)
    ? filter.asramas.map(cleanText).filter(Boolean)
    : []

  if (santriIds.length > 0) {
    clauses.push('s.id IN (SELECT value FROM json_each(?))')
    params.push(JSON.stringify(santriIds))
  }
  if (asramas.length > 0) {
    clauses.push('s.asrama IN (SELECT value FROM json_each(?))')
    params.push(JSON.stringify(asramas))
  }
  if (filter.tanggalMulai) {
    clauses.push('substr(p.tanggal,1,10) >= ?')
    params.push(filter.tanggalMulai)
  }
  if (filter.tanggalSelesai) {
    clauses.push('substr(p.tanggal,1,10) <= ?')
    params.push(filter.tanggalSelesai)
  }

  const rows = await query<any>(
    `SELECT p.id, p.tanggal, p.created_at, p.jenis, p.deskripsi, p.jumlah_kejadian,p.perlu_verifikasi,p.source,p.source_id,p.sesi, p.foto_url,
            s.nama_lengkap, s.nis, s.asrama, s.kamar,
            mp.nama_pelanggaran,
            u.full_name AS penindak_nama
     FROM discipline_incidents p
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN master_pelanggaran mp ON mp.id = p.master_id
     LEFT JOIN users u ON u.id = p.penindak_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY p.tanggal DESC, p.created_at DESC, s.nama_lengkap`,
    params
  )

  return { rows }
}

export async function getDetailSantri(santriId: string) {
  const access=await assertFeature('/dashboard/keamanan'); if('error' in access) throw new Error(access.error)
  const [profil, pelanggaran, suratPernyataan, suratPerjanjian] = await Promise.all([
    queryOne<any>(
      `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
              s.nama_ayah, s.alamat, s.status_global,
              k.nama_kelas
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.id = ?`,
      [santriId]
    ),
    query<any>(
      `SELECT p.id, p.tanggal, p.jenis, p.deskripsi, p.jumlah_kejadian,p.perlu_verifikasi,p.source,p.source_id,p.sesi, p.foto_url,
              u.full_name AS penindak_nama,
              mp.nama_pelanggaran
       FROM discipline_incidents p
       LEFT JOIN users u ON u.id = p.penindak_id
       LEFT JOIN master_pelanggaran mp ON mp.id = p.master_id
       WHERE p.santri_id = ? AND p.status='active'
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
  const access = await assertFeature('/dashboard/keamanan', 'create')
  if ('error' in access) return access
  const session = access
  let id: string
  try { id=await saveIncidentLetter(santriId,pelanggaranIds,tanggal,session.id) }
  catch { return { error: 'Pilihan pelanggaran tidak valid atau sudah berubah. Muat ulang sebelum menyimpan.' } }
  const actorSession = await getSession()
  const santri = await queryOne<{ nama_lengkap: string | null }>(
    'SELECT nama_lengkap FROM santri WHERE id = ?',
    [santriId]
  )
  await logActivity({
    actor: actorFromSession(actorSession),
    module: 'keamanan',
    action: 'create',
    fiturHref: '/dashboard/keamanan',
    logKind: 'create',
    entityType: 'surat_pernyataan',
    entityId: id,
    entityLabel: santri?.nama_lengkap || santriId,
    summary: `Membuat surat pernyataan untuk ${santri?.nama_lengkap || santriId}`,
    details: {
      tanggal,
      jumlah_pelanggaran: pelanggaranIds.length,
    },
  })
  revalidateDiscipline()
  return { success: true, id }
}

// ─── SIMPAN SURAT PERJANJIAN (log) ───────────────────────────────────────────
export async function simpanSuratPerjanjian(
  santriId: string,
  level: 'SP1' | 'SP2' | 'SP3' | 'SK',
  tanggal: string,
  catatan?: string
): Promise<{ success: boolean; id: string } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan', 'create')
  if ('error' in access) return access
  const session = access
  const id = generateId()
  await execute(
    `INSERT INTO surat_perjanjian (id, santri_id, level, tanggal, catatan, dibuat_oleh, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, santriId, level, tanggal, catatan || null, session.id, now()]
  )
  const actorSession = await getSession()
  const santri = await queryOne<{ nama_lengkap: string | null }>(
    'SELECT nama_lengkap FROM santri WHERE id = ?',
    [santriId]
  )
  await logActivity({
    actor: actorFromSession(actorSession),
    module: 'keamanan',
    action: 'create',
    fiturHref: '/dashboard/keamanan',
    logKind: 'create',
    entityType: 'surat_perjanjian',
    entityId: id,
    entityLabel: santri?.nama_lengkap || santriId,
    summary: `Membuat surat perjanjian ${level} untuk ${santri?.nama_lengkap || santriId}`,
    details: {
      level,
      tanggal,
      catatan: catatan || null,
    },
  })
  revalidateDiscipline()
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
    pelanggaranIds.length ? resolveLetterIncidents(santriId,pelanggaranIds) : Promise.resolve([]),
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
