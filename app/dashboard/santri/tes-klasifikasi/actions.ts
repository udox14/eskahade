'use server'

import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { assertCrud } from '@/lib/auth/crud'
import { hitungRekomendasiTesKlasifikasi } from '@/lib/akademik/tes-klasifikasi'
import { revalidatePath } from 'next/cache'

const FITUR_HREF = '/dashboard/santri/tes-klasifikasi'

const PAGE_SIZE = 30

// ─── Daftar santri baru (belum punya riwayat pendidikan) ─────────────────
// Fix query: filter jumlah_riwayat = 0 langsung di SQL (NOT EXISTS),
// tidak fetch semua lalu filter di JavaScript.
// Tambah pagination + filter status tes.
export async function getSantriBaru(params: {
  search?: string
  page?: number
  filterStatus?: 'SEMUA' | 'SUDAH' | 'BELUM'
  asrama?: string
}) {
  const { search = '', page = 1, filterStatus = 'SEMUA', asrama } = params
  const offset = (page - 1) * PAGE_SIZE

  const clauses: string[] = [
    "s.status_global = 'aktif'",
    // Hanya santri yang belum punya riwayat pendidikan (santri baru)
    "NOT EXISTS (SELECT 1 FROM riwayat_pendidikan rp WHERE rp.santri_id = s.id AND rp.status_riwayat = 'aktif')"
  ]
  const baseParams: any[] = []

  if (search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    baseParams.push(`%${search}%`, `%${search}%`)
  }
  if (filterStatus === 'SUDAH') clauses.push('h.id IS NOT NULL')
  if (filterStatus === 'BELUM') clauses.push('h.id IS NULL')
  if (asrama) { clauses.push('s.asrama = ?'); baseParams.push(asrama) }

  const where = clauses.join(' AND ')

  // Count dulu
  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM santri s
     LEFT JOIN hasil_tes_klasifikasi h ON h.santri_id = s.id
     WHERE ${where}`,
    baseParams
  )
  const total = countRow?.total ?? 0

  // Data dengan pagination
  const rows = await query<any>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.asrama, s.kamar,
            h.id AS hasil_id, h.rekomendasi_marhalah, h.catatan_grade,
            h.hari_tes, h.sesi_tes, h.tulis_arab, h.baca_kelancaran,
            h.baca_tajwid, h.hafalan_juz, h.nahwu_pengalaman
     FROM santri s
     LEFT JOIN hasil_tes_klasifikasi h ON h.santri_id = s.id
     WHERE ${where}
     ORDER BY h.id IS NULL DESC, s.nama_lengkap
     LIMIT ? OFFSET ?`,
    [...baseParams, PAGE_SIZE, offset]
  )

  return {
    rows: rows.map((s: any) => ({
      id:    s.id,
      nis:   s.nis,
      nama:  s.nama_lengkap,
      jk:    s.jenis_kelamin,
      asrama: s.asrama,
      kamar:  s.kamar,
      status_tes: s.hasil_id ? 'SUDAH' : 'BELUM',
      hasil: s.hasil_id ? {
        id:                   s.hasil_id,
        rekomendasi_marhalah: s.rekomendasi_marhalah,
        catatan_grade:        s.catatan_grade,
        hari_tes:             s.hari_tes,
        sesi_tes:             s.sesi_tes,
        tulis_arab:           s.tulis_arab,
        baca_kelancaran:      s.baca_kelancaran,
        baca_tajwid:          s.baca_tajwid,
        hafalan_juz:          s.hafalan_juz,
        nahwu_pengalaman:     s.nahwu_pengalaman,
      } : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    pageSize:   PAGE_SIZE,
  }
}


// ─── Daftar asrama ────────────────────────────────────────────────────────
export async function getAsramaList() {
  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama FROM santri
     WHERE status_global = 'aktif' AND asrama IS NOT NULL
     ORDER BY asrama`
  )
  return rows.map(r => r.asrama)
}

// ─── Simpan/update hasil tes ──────────────────────────────────────────────
export async function simpanTes(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const santriId    = formData.get('santri_id') as string
  const hari        = formData.get('hari_tes') as string
  const sesi        = formData.get('sesi_tes') as string
  const tulis       = formData.get('tulis_arab') as string
  const kelancaran  = formData.get('baca_kelancaran') as string
  const tajwid      = formData.get('baca_tajwid') as string
  const hafalan     = Number(formData.get('hafalan_juz') || 0)
  const nahwu       = formData.get('nahwu_pengalaman') === 'on'

  const { rekomendasi_marhalah: rekomendasi, catatan_grade: grade } = hitungRekomendasiTesKlasifikasi({
    baca_kelancaran: kelancaran,
    baca_tajwid: tajwid,
    nahwu_pengalaman: nahwu,
  })

  const user = await getSession()
  const testerId = user?.id || null
  const now = new Date().toISOString()

  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM hasil_tes_klasifikasi WHERE santri_id = ?', [santriId]
  )

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

  const santri = await queryOne<{ nama_lengkap: string | null }>('SELECT nama_lengkap FROM santri WHERE id = ?', [santriId])
  await logActivity({
    actor: actorFromSession(user),
    module: 'santri_tes_klasifikasi',
    action: existing ? 'update' : 'create',
    fiturHref: '/dashboard/santri/tes-klasifikasi',
    logKind: existing ? 'update' : 'create',
    entityType: 'hasil_tes_klasifikasi',
    entityId: santriId,
    entityLabel: santri?.nama_lengkap || santriId,
    summary: `${existing ? 'Memperbarui' : 'Mencatat'} tes klasifikasi ${santri?.nama_lengkap || santriId}`,
    details: {
      rekomendasi_marhalah: rekomendasi,
      catatan_grade: grade,
      hari_tes: hari,
      sesi_tes: sesi,
    },
  })

  revalidatePath('/dashboard/santri/tes-klasifikasi')
  return { success: true }
}

// ─── Hitung ulang semua hasil tes ─────────────────────────────────────────
// Untuk data lama yang rekomendasi/grade-nya tersimpan pakai versi algoritma
// sebelum diubah. Jawaban mentah (baca_kelancaran, baca_tajwid, nahwu_pengalaman)
// tetap tersimpan, jadi tinggal dihitung ulang pakai algoritma sekarang —
// tidak perlu input ulang. Sebelum-sesudah tiap perubahan dicatat di activity
// log biar bisa diaudit/rollback manual kalau perlu.
export async function recomputeSemuaTesKlasifikasi(): Promise<
  { success: true; totalDiperiksa: number; totalDiubah: number } | { error: string }
> {
  const session = await assertCrud(FITUR_HREF, 'update')
  if ('error' in session) return { error: session.error }

  const rows = await query<{
    id: string
    santri_id: string
    baca_kelancaran: string | null
    baca_tajwid: string | null
    nahwu_pengalaman: number
    rekomendasi_marhalah: string | null
    catatan_grade: string | null
  }>(
    `SELECT id, santri_id, baca_kelancaran, baca_tajwid, nahwu_pengalaman,
            rekomendasi_marhalah, catatan_grade
     FROM hasil_tes_klasifikasi`
  )

  const waktu = new Date().toISOString()
  const changes: Array<{ santri_id: string; before: { rekomendasi: string | null; grade: string | null }; after: { rekomendasi: string; grade: string } }> = []

  for (const r of rows) {
    const { rekomendasi_marhalah: rekomendasi, catatan_grade: grade } = hitungRekomendasiTesKlasifikasi({
      baca_kelancaran: r.baca_kelancaran,
      baca_tajwid: r.baca_tajwid,
      nahwu_pengalaman: !!r.nahwu_pengalaman,
    })

    if (rekomendasi === r.rekomendasi_marhalah && grade === r.catatan_grade) continue

    await query(
      `UPDATE hasil_tes_klasifikasi SET rekomendasi_marhalah = ?, catatan_grade = ?, updated_at = ? WHERE id = ?`,
      [rekomendasi, grade, waktu, r.id]
    )
    changes.push({
      santri_id: r.santri_id,
      before: { rekomendasi: r.rekomendasi_marhalah, grade: r.catatan_grade },
      after: { rekomendasi, grade },
    })
  }

  if (changes.length > 0) {
    await logActivity({
      actor: actorFromSession(session),
      module: 'santri_tes_klasifikasi',
      action: 'update',
      fiturHref: FITUR_HREF,
      logKind: 'update',
      entityType: 'hasil_tes_klasifikasi_batch',
      entityId: 'recompute',
      entityLabel: 'Hitung ulang hasil tes klasifikasi',
      summary: `Menghitung ulang rekomendasi ${changes.length} dari ${rows.length} santri (algoritma diperbarui)`,
      details: { total_diperiksa: rows.length, total_diubah: changes.length, perubahan: changes.slice(0, 200) },
    })
  }

  revalidatePath('/dashboard/santri/tes-klasifikasi')
  revalidatePath('/dashboard/akademik/penempatan')
  return { success: true, totalDiperiksa: rows.length, totalDiubah: changes.length }
}
