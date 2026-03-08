'use server'

import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getSantriBaru(search: string = '') {
  let sql = `
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.asrama, s.kamar,
      h.id as hasil_id, h.rekomendasi_marhalah, h.catatan_grade, h.hari_tes, h.sesi_tes,
      (SELECT COUNT(*) FROM riwayat_pendidikan rp WHERE rp.santri_id = s.id) as jumlah_riwayat
    FROM santri s
    LEFT JOIN hasil_tes_klasifikasi h ON h.santri_id = s.id
    WHERE s.status_global = 'aktif'
  `
  const params: any[] = []

  if (search) { sql += ' AND s.nama_lengkap LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY s.nama_lengkap'

  const data = await query<any>(sql, params)

  return data
    .filter((s: any) => s.jumlah_riwayat === 0)
    .map((s: any) => ({
      id: s.id,
      nis: s.nis,
      nama: s.nama_lengkap,
      jk: s.jenis_kelamin,
      asrama: s.asrama,
      kamar: s.kamar,
      status_tes: s.hasil_id ? 'SUDAH' : 'BELUM',
      hasil: s.hasil_id ? {
        id: s.hasil_id,
        rekomendasi_marhalah: s.rekomendasi_marhalah,
        catatan_grade: s.catatan_grade,
        hari_tes: s.hari_tes,
        sesi_tes: s.sesi_tes,
      } : null
    }))
}

export async function simpanTes(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const santriId = formData.get('santri_id') as string
  const hari = formData.get('hari_tes') as string
  const sesi = formData.get('sesi_tes') as string
  const tulis = formData.get('tulis_arab') as string
  const kelancaran = formData.get('baca_kelancaran') as string
  const tajwid = formData.get('baca_tajwid') as string
  const hafalan = Number(formData.get('hafalan_juz') || 0)
  const nahwu = formData.get('nahwu_pengalaman') === 'on'

  // Algoritma penentuan marhalah
  let rekomendasi = 'Ibtidaiyyah 1'
  let grade = 'Grade B/C'

  if (tulis === 'TIDAK_BISA' && kelancaran === 'TIDAK_BISA') {
    rekomendasi = 'Tamhidiyyah 1'; grade = '-'
  } else if (
    (tulis === 'BAIK' || tulis === 'KURANG') &&
    kelancaran === 'TIDAK_LANCAR' &&
    (tajwid === 'KURANG' || tajwid === 'BURUK')
  ) {
    rekomendasi = 'Tamhidiyyah 2'; grade = 'Grade A/B'
  } else if (
    (tulis === 'BAIK' || tulis === 'KURANG') &&
    kelancaran === 'LANCAR' &&
    tajwid === 'BAIK'
  ) {
    rekomendasi = 'Ibtidaiyyah 1'; grade = 'Grade A'
  }

  if (nahwu) grade += ' (REKOMENDASI TES NAHWU LANJUTAN)'

  const user = await getSession()
  const testerId = user?.id || null
  const now = new Date().toISOString()

  // Upsert: update jika ada, insert jika belum
  const existing = await queryOne('SELECT id FROM hasil_tes_klasifikasi WHERE santri_id = ?', [santriId])

  if (existing) {
    await query(
      `UPDATE hasil_tes_klasifikasi SET
        hari_tes = ?, sesi_tes = ?, tulis_arab = ?, baca_kelancaran = ?, baca_tajwid = ?,
        hafalan_juz = ?, nahwu_pengalaman = ?, rekomendasi_marhalah = ?, catatan_grade = ?,
        tester_id = ?, updated_at = ?
       WHERE santri_id = ?`,
      [hari, sesi, tulis, kelancaran, tajwid, hafalan, nahwu ? 1 : 0,
       rekomendasi, grade, testerId, now, santriId]
    )
  } else {
    await query(
      `INSERT INTO hasil_tes_klasifikasi
        (id, santri_id, hari_tes, sesi_tes, tulis_arab, baca_kelancaran, baca_tajwid,
         hafalan_juz, nahwu_pengalaman, rekomendasi_marhalah, catatan_grade, tester_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), santriId, hari, sesi, tulis, kelancaran, tajwid,
       hafalan, nahwu ? 1 : 0, rekomendasi, grade, testerId, now, now]
    )
  }

  revalidatePath('/dashboard/santri/tes-klasifikasi')
  return { success: true }
}