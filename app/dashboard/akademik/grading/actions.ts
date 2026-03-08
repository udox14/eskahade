'use server'

import { query, execute } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getKelasList() {
  const session = await getSession()
  const isWaliKelas = session?.role === 'wali_kelas'

  let sql = `
    SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
  `
  const params: any[] = []

  if (isWaliKelas && session?.id) {
    sql += ' WHERE k.wali_kelas_id = ?'
    params.push(session.id)
  }

  sql += ' ORDER BY k.nama_kelas'
  return query<any>(sql, params)
}

export async function getDataGrading(kelasId: string) {
  const listSantri = await query<any>(`
    SELECT rp.id, rp.grade_lanjutan, s.nama_lengkap, s.nis
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])

  if (!listSantri.length) return []

  const riwayatIds = listSantri.map((s: any) => s.id)
  const ph = riwayatIds.map(() => '?').join(',')

  const mapelRef = await query<any>('SELECT id, nama FROM mapel', [])
  const mapelIlmuAlatIds = mapelRef
    .filter((m: any) => m.nama.toLowerCase().includes('nahwu') || m.nama.toLowerCase().includes('sharaf'))
    .map((m: any) => m.id)

  let listNilai: any[] = []
  if (mapelIlmuAlatIds.length > 0) {
    const phm = mapelIlmuAlatIds.map(() => '?').join(',')
    listNilai = await query<any>(`
      SELECT riwayat_pendidikan_id, mapel_id, nilai, semester
      FROM nilai_akademik
      WHERE riwayat_pendidikan_id IN (${ph})
        AND mapel_id IN (${phm})
    `, [...riwayatIds, ...mapelIlmuAlatIds])
  }

  return listSantri.map((s: any) => {
    const myGrades = listNilai.filter((n: any) => n.riwayat_pendidikan_id === s.id)
    let totalNilai = 0, countNilai = 0
    myGrades.forEach((n: any) => {
      if (n.nilai !== null && n.nilai !== undefined) { totalNilai += Number(n.nilai); countNilai++ }
    })
    const rata = countNilai > 0 ? totalNilai / countNilai : 0
    let rekomendasi = rata >= 70 ? 'Grade A' : rata >= 50 ? 'Grade B' : countNilai === 0 ? '-' : 'Grade C'

    return {
      riwayat_id: s.id,
      nis: s.nis,
      nama: s.nama_lengkap,
      rata_rata: Number(rata.toFixed(1)),
      jumlah_komponen_nilai: countNilai,
      rekomendasi,
      grade_final: s.grade_lanjutan || (rekomendasi !== '-' ? rekomendasi : 'Grade C'),
    }
  })
}

export async function simpanGradingBatch(payload: { riwayat_id: string; grade: string }[]) {
  if (payload.length === 0) return { success: true }

  for (const item of payload) {
    await execute(
      'UPDATE riwayat_pendidikan SET grade_lanjutan = ? WHERE id = ?',
      [item.grade, item.riwayat_id]
    )
  }

  revalidatePath('/dashboard/akademik/grading')
  return { success: true, count: payload.length }
}