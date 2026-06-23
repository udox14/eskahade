'use server'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'

import { assertFeature } from '@/lib/auth/feature'
import { execute, generateId, getDB, query, queryOne, today } from '@/lib/db'

const PATH = '/dashboard/pendaftar'

export type PendaftarRow = Record<string, any>

function jamak<T>(v: T | undefined | null, fallback: T): T {
  return v === undefined || v === null ? fallback : v
}

// Generate NIS sementara unik (sama pola dengan modul PSB).
async function nextTempNis() {
  const prefix = `PSB-${today().replace(/-/g, '')}`
  for (let i = 1; i <= 9999; i += 1) {
    const nis = `${prefix}-${String(i).padStart(4, '0')}`
    const exists = await queryOne<{ id: string }>('SELECT id FROM santri WHERE nis = ?', [nis])
    if (!exists) return nis
  }
  return `${prefix}-${generateId().slice(0, 8).toUpperCase()}`
}

export async function getPendaftarList(filters?: { q?: string; status?: string }) {
  const access = await assertFeature(PATH, 'read')
  if ('error' in access) return { error: access.error }

  const where: string[] = []
  const binds: any[] = []
  if (filters?.q) {
    where.push('(nama_lengkap LIKE ? OR no_reg LIKE ?)')
    binds.push(`%${filters.q}%`, `%${filters.q}%`)
  }
  if (filters?.status) {
    where.push('status = ?')
    binds.push(filters.status)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const rows = await query<PendaftarRow>(
    `SELECT id, no_reg, nama_lengkap, jenis_kelamin, sekolah_santri, kelas, status,
            berkas_verified, bayar_verified, santri_id, created_at
     FROM pendaftar ${clause} ORDER BY created_at DESC`,
    binds,
  )

  const stats = await queryOne<{ total: number; berkas: number; bayar: number; diterima: number }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN berkas_verified = 1 THEN 1 ELSE 0 END) AS berkas,
            SUM(CASE WHEN bayar_verified = 1 THEN 1 ELSE 0 END) AS bayar,
            SUM(CASE WHEN status = 'diterima' THEN 1 ELSE 0 END) AS diterima
     FROM pendaftar`,
  )

  return {
    rows,
    stats: {
      total: stats?.total ?? 0,
      berkas: stats?.berkas ?? 0,
      bayar: stats?.bayar ?? 0,
      diterima: stats?.diterima ?? 0,
    },
  }
}

export async function getPendaftarDetail(id: string) {
  const access = await assertFeature(PATH, 'read')
  if ('error' in access) return { error: access.error }

  const row = await queryOne<PendaftarRow>('SELECT * FROM pendaftar WHERE id = ?', [id])
  if (!row) return { error: 'Pendaftar tidak ditemukan' }
  const berkas = await query<{ jenis: string; url: string }>(
    'SELECT jenis, url FROM pendaftar_berkas WHERE pendaftar_id = ?',
    [id],
  )
  return { pendaftar: row, berkas }
}

export async function setVerifikasiPendaftar(id: string, kind: 'berkas' | 'bayar', value: boolean) {
  const access = await assertFeature(PATH, 'update')
  if ('error' in access) return { error: access.error }

  const col = kind === 'berkas' ? 'berkas_verified' : 'bayar_verified'
  await execute(`UPDATE pendaftar SET ${col} = ?, updated_at = datetime('now') WHERE id = ?`, [
    value ? 1 : 0,
    id,
  ])
  revalidatePath(PATH)
  return { ok: true }
}

export async function setFlagsPendaftar(
  id: string,
  flags: { editAllowed?: boolean; uploadAllowed?: boolean },
) {
  const access = await assertFeature(PATH, 'update')
  if ('error' in access) return { error: access.error }

  const sets: string[] = []
  const binds: any[] = []
  if (flags.editAllowed !== undefined) { sets.push('edit_allowed = ?'); binds.push(flags.editAllowed ? 1 : 0) }
  if (flags.uploadAllowed !== undefined) { sets.push('upload_allowed = ?'); binds.push(flags.uploadAllowed ? 1 : 0) }
  if (!sets.length) return { ok: true }
  sets.push("updated_at = datetime('now')")
  binds.push(id)
  await execute(`UPDATE pendaftar SET ${sets.join(', ')} WHERE id = ?`, binds)
  revalidatePath(PATH)
  return { ok: true }
}

export async function tolakPendaftar(id: string, alasan?: string) {
  const access = await assertFeature(PATH, 'update')
  if ('error' in access) return { error: access.error }

  await execute(
    "UPDATE pendaftar SET status = 'ditolak', catatan_admin = ?, updated_at = datetime('now') WHERE id = ?",
    [alasan ?? null, id],
  )
  revalidatePath(PATH)
  return { ok: true }
}

// Terima pendaftar → buat santri aktif (auto-tag "BARU"), tautkan kembali.
export async function terimaPendaftar(id: string) {
  const access = await assertFeature(PATH, 'create')
  if ('error' in access) return { error: access.error }

  const p = await queryOne<PendaftarRow>('SELECT * FROM pendaftar WHERE id = ?', [id])
  if (!p) return { error: 'Pendaftar tidak ditemukan' }
  if (p.santri_id) return { error: 'Pendaftar ini sudah diterima sebelumnya' }

  const santriId = generateId()
  const nis = await nextTempNis()
  const tanggalMasuk = today()
  const tahunMasuk = Number(tanggalMasuk.slice(0, 4))
  const jk = p.jenis_kelamin === 'Perempuan' ? 'P' : 'L'
  const gol = ['A', 'B', 'AB', 'O'].includes(String(p.golongan_darah)) ? p.golongan_darah : null
  const waOrtu = p.wa_ayah || p.wa_ibu || null

  const db = await getDB()
  await db.batch([
    db
      .prepare(
        `INSERT INTO santri (
          id, nis, nama_lengkap, nik, tempat_lahir, tanggal_lahir, jenis_kelamin,
          nama_ayah, nama_ibu, alamat, alamat_lengkap, provinsi, kab_kota, kecamatan,
          no_wa_ortu, gol_darah, sekolah, kelas_sekolah, tahun_masuk, tanggal_masuk,
          status_global, kategori_santri, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', 'REGULER', datetime('now'), datetime('now'))`,
      )
      .bind(
        santriId,
        nis,
        jamak(p.nama_lengkap, ''),
        p.nik ?? null,
        p.tempat_lahir ?? null,
        p.tanggal_lahir ?? null,
        jk,
        p.nama_ayah ?? null,
        p.nama_ibu ?? null,
        p.alamat_lengkap ?? null,
        p.alamat_lengkap ?? null,
        p.provinsi ?? null,
        p.kabupaten ?? null,
        p.kecamatan ?? null,
        waOrtu,
        gol,
        p.sekolah_santri ?? null,
        p.kelas ?? null,
        tahunMasuk,
        tanggalMasuk,
      ),
    db
      .prepare(
        "UPDATE pendaftar SET santri_id = ?, status = 'diterima', updated_at = datetime('now') WHERE id = ?",
      )
      .bind(santriId, id),
  ])

  revalidatePath(PATH)
  return { ok: true, santriId, nis }
}
