'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { assertFeature } from '@/lib/auth/feature'
import { revalidatePath } from 'next/cache'

// ── Helper: ekstrak angka kelas dari string bebas ─────────────────────────
// "7" → 7, "7A" → 7, "8B" → 8, "12 IPA" → 12, null → null
function parseKelas(raw: string | null): number | null {
  if (!raw) return null
  const match = raw.trim().match(/^(\d+)/)
  if (!match) return null
  const n = parseInt(match[1])
  return n >= 1 && n <= 13 ? n : null
}

// ── Preview naik kelas — tidak mengubah data ──────────────────────────────
export async function previewNaikKelas(filter: {
  asrama?: string
  sekolah?: string
  kelasSekolah?: string
}) {
  const access = await assertFeature('/dashboard/master/santri-tools')
  if ('error' in access) return { error: access.error }

  let where = "s.status_global = 'aktif' AND s.kelas_sekolah IS NOT NULL AND s.kelas_sekolah != ''"
  const params: any[] = []

  if (filter.asrama) { where += ' AND s.asrama = ?'; params.push(filter.asrama) }
  if (filter.sekolah) { where += ' AND s.sekolah LIKE ?'; params.push(`%${filter.sekolah}%`) }
  if (filter.kelasSekolah) { where += ' AND s.kelas_sekolah LIKE ?'; params.push(`%${filter.kelasSekolah}%`) }

  const rows = await query<{ id: string; nama_lengkap: string; nis: string; asrama: string; sekolah: string | null; kelas_sekolah: string }>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.sekolah, s.kelas_sekolah
     FROM santri s WHERE ${where}
     ORDER BY s.asrama, CAST(s.kelas_sekolah AS INTEGER), s.kelas_sekolah, s.nama_lengkap`,
    params
  )

  return rows.map(s => {
    const angka = parseKelas(s.kelas_sekolah)
    const suffix = s.kelas_sekolah.trim().replace(/^\d+/, '') // ambil suffix huruf, misal "A" dari "7A"
    let kelasBaruStr: string | null = null
    let status: 'naik' | 'lulus_sltp' | 'lulus_slta' | 'tidak_diketahui' = 'tidak_diketahui'

    if (angka === null) {
      status = 'tidak_diketahui'
    } else if (angka === 9) {
      status = 'lulus_sltp'
      kelasBaruStr = '10' + suffix
    } else if (angka === 12) {
      status = 'lulus_slta'
      kelasBaruStr = null // lulus, kelas_sekolah dikosongkan
    } else {
      status = 'naik'
      kelasBaruStr = String(angka + 1) + suffix
    }

    return { ...s, angka_kelas: angka, kelas_baru: kelasBaruStr, status }
  })
}

// ── Eksekusi naik kelas massal ────────────────────────────────────────────
export async function eksekusiNaikKelas(santriIds: string[]): Promise<{ success: boolean; updated: number } | { error: string }> {
  const access = await assertFeature('/dashboard/master/santri-tools')
  if ('error' in access) return { error: access.error }
  if (!santriIds.length) return { error: 'Tidak ada santri dipilih.' }

  // Ambil data kelas_sekolah santri yang dipilih
  const ph = santriIds.map(() => '?').join(',')
  const rows = await query<{ id: string; kelas_sekolah: string }>(
    `SELECT id, kelas_sekolah FROM santri WHERE id IN (${ph})`,
    santriIds
  )

  const updates = rows
    .map(s => {
      const angka = parseKelas(s.kelas_sekolah)
      const suffix = s.kelas_sekolah.trim().replace(/^\d+/, '')
      if (angka === null) return null
      if (angka === 12) return { id: s.id, kelas_baru: null } // lulus SLTA → kosongkan
      return { id: s.id, kelas_baru: String(angka + 1) + suffix }
    })
    .filter(Boolean) as { id: string; kelas_baru: string | null }[]

  if (!updates.length) return { error: 'Tidak ada kelas yang bisa dinaikkan.' }

  const now = new Date().toISOString()
  await batch(updates.map(u => ({
    sql: `UPDATE santri SET kelas_sekolah = ?, updated_at = ? WHERE id = ?`,
    params: [u.kelas_baru, now, u.id],
  })))

  revalidatePath('/dashboard/santri')
  revalidatePath('/dashboard/master/santri-tools')
  return { success: true, updated: updates.length }
}

// ── Ambil daftar santri untuk manajemen pembebasan ───────────────────────
export async function getSantriPembebasan(filter: {
  asrama?: string
  search?: string
  hanyaBebasSpp?: boolean
}) {
  const access = await assertFeature('/dashboard/master/santri-tools')
  if ('error' in access) return []

  let where = "s.status_global = 'aktif'"
  const params: any[] = []

  if (filter.asrama) { where += ' AND s.asrama = ?'; params.push(filter.asrama) }
  if (filter.search) { where += ' AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)'; params.push(`%${filter.search}%`, `%${filter.search}%`) }
  if (filter.hanyaBebasSpp) { where += ' AND s.bebas_spp = 1' }

  const rows = await query<any>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.bebas_spp
     FROM santri s
     WHERE ${where}
     ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
     LIMIT 200`,
    params
  )

  // Ambil pembayaran tahunan yang sudah lunas per santri (untuk tahu mana yang sudah bebas)
  if (!rows.length) return []
  const ids = rows.map((r: any) => r.id)
  const idPh = ids.map(() => '?').join(',')
  const tahun = new Date().getFullYear()

  const bayarList = await query<{ santri_id: string; jenis_biaya: string; tahun_tagihan: number }>(
    `SELECT santri_id, jenis_biaya, tahun_tagihan FROM pembayaran_tahunan
     WHERE santri_id IN (${idPh}) AND tahun_tagihan = ?`,
    [...ids, tahun]
  )

  const bayarMap: Record<string, Set<string>> = {}
  bayarList.forEach((b: any) => {
    if (!bayarMap[b.santri_id]) bayarMap[b.santri_id] = new Set()
    bayarMap[b.santri_id].add(b.jenis_biaya)
  })

  return rows.map((s: any) => ({
    ...s,
    bebas_spp: s.bebas_spp === 1,
    sudah_bayar: bayarMap[s.id] ? [...bayarMap[s.id]] : [],
  }))
}

// ── Toggle bebas_spp satu atau banyak santri ─────────────────────────────
export async function setBebas(
  santriIds: string[],
  bebas: boolean
): Promise<{ success: boolean; updated: number } | { error: string }> {
  const access = await assertFeature('/dashboard/master/santri-tools')
  if ('error' in access) return { error: access.error }
  if (!santriIds.length) return { error: 'Tidak ada santri dipilih.' }

  const now = new Date().toISOString()
  await batch(santriIds.map(id => ({
    sql: `UPDATE santri SET bebas_spp = ?, updated_at = ? WHERE id = ?`,
    params: [bebas ? 1 : 0, now, id],
  })))

  revalidatePath('/dashboard/santri')
  revalidatePath('/dashboard/master/santri-tools')
  return { success: true, updated: santriIds.length }
}

// ── Catat pembebasan pembayaran tahunan (insert ke pembayaran_tahunan nominal 0) ──
export async function catatBebasPembayaran(
  santriId: string,
  jenisBiaya: string,
  tahun: number,
  keterangan: string
): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/master/santri-tools')
  if ('error' in access) return { error: access.error }
  const session = access

  // Cek apakah sudah ada record
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = ? AND tahun_tagihan = ?`,
    [santriId, jenisBiaya, tahun]
  )
  if (existing) return { error: `${jenisBiaya} tahun ${tahun} sudah tercatat.` }

  await execute(
    `INSERT INTO pembayaran_tahunan (id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, tanggal_bayar, penerima_id, keterangan)
     VALUES (?, ?, ?, ?, 0, datetime('now'), ?, ?)`,
    [generateId(), santriId, jenisBiaya, tahun, session.id, keterangan || `Dibebaskan oleh ${session.email}`]
  )

  revalidatePath('/dashboard/master/santri-tools')
  return { success: true }
}

// ── Hapus pembebasan pembayaran tahunan ───────────────────────────────────
export async function hapusBebasPembayaran(
  santriId: string,
  jenisBiaya: string,
  tahun: number
): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/master/santri-tools')
  if ('error' in access) return { error: access.error }

  await execute(
    `DELETE FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = ? AND tahun_tagihan = ? AND nominal_bayar = 0`,
    [santriId, jenisBiaya, tahun]
  )

  revalidatePath('/dashboard/master/santri-tools')
  return { success: true }
}

// ── Daftar sekolah unik untuk filter ─────────────────────────────────────
export async function getSekolahList() {
  const rows = await query<{ sekolah: string }>(
    `SELECT DISTINCT sekolah FROM santri WHERE status_global = 'aktif' AND sekolah IS NOT NULL AND sekolah != ''
     ORDER BY sekolah`,
    []
  )
  return rows.map(r => r.sekolah)
}
