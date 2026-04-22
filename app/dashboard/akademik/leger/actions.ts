'use server'

import { query, execute, generateId } from '@/lib/db'
import { getCachedMapelList } from '@/lib/cache/master'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getKelasListForLeger() {
  const session = await getSession()
  if (!session) return []

  let sql = `
    SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
  `
  const params: any[] = []

  // Admin/Sekpen/Akademik = akses semua kelas, 
  // Wali kelas = hanya kelas binaannya
  if (!hasAnyRole(session, ['admin', 'sekpen', 'akademik']) && hasRole(session, 'wali_kelas')) {
    sql += ' WHERE k.wali_kelas_id = ?'
    params.push(session.id)
  }

  const data = await query<any>(sql, params)
  return data.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function getLegerData(kelasId: string, semester: number) {
  const mapelList = await getCachedMapelList()
  if (!mapelList.length) return { mapel: [], siswa: [] }

  const santriList = await query<any>(`
    SELECT rp.id,
           s.id AS santri_id, s.nama_lengkap, s.nis,
           r.jumlah_nilai, r.rata_rata, r.ranking_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
    LIMIT 1000
  `, [semester, kelasId])

  if (!santriList.length) return { mapel: mapelList, siswa: [] }

  const riwayatIds = santriList.map((s: any) => s.id)
  const ph = riwayatIds.map(() => '?').join(',')

  const nilaiList = await query<any>(`
    SELECT riwayat_pendidikan_id, mapel_id, nilai
    FROM nilai_akademik
    WHERE riwayat_pendidikan_id IN (${ph}) AND semester = ?
    LIMIT 5000
  `, [...riwayatIds, semester])

  const legerSiswa = santriList.map((s: any) => {
    const nilaiPerMapel: Record<string, number | string> = {}
    mapelList.forEach((m: any) => {
      const n = nilaiList.find((item: any) => item.riwayat_pendidikan_id === s.id && item.mapel_id === m.id)
      nilaiPerMapel[m.id] = n ? n.nilai : 0
    })
    return {
      id: s.id,
      riwayat_id: s.id,
      nis: s.nis || '-',
      nama: s.nama_lengkap || 'Tanpa Nama',
      nilai: nilaiPerMapel,
      jumlah: s.jumlah_nilai || 0,
      rata: s.rata_rata || 0,
      rank: s.ranking_kelas || '-',
    }
  })

  legerSiswa.sort((a: any, b: any) => a.nama.localeCompare(b.nama))
  return { mapel: mapelList, siswa: legerSiswa }
}

export async function hitungDanSimpanLeger(kelasId: string, semester: number) {
  const { mapel, siswa } = await getLegerData(kelasId, semester)
  if (!siswa.length) return { error: 'Tidak ada siswa' }

  const totalMapel = mapel.length || 10

  const kalkulasi = siswa.map((s: any) => {
    let jumlah = 0
    Object.values(s.nilai).forEach((v: any) => { jumlah += Number(v) || 0 })
    const rata = Number((jumlah / totalMapel).toFixed(2))
    return { riwayat_pendidikan_id: s.riwayat_id, semester, jumlah_nilai: jumlah, rata_rata: rata }
  })

  kalkulasi.sort((a, b) => b.rata_rata - a.rata_rata)

  for (let idx = 0; idx < kalkulasi.length; idx++) {
    const item = kalkulasi[idx]
    const predikat = getPredikat(item.rata_rata)
    await execute(`
      INSERT INTO ranking (id, riwayat_pendidikan_id, semester, jumlah_nilai, rata_rata, ranking_kelas, predikat)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
        jumlah_nilai = excluded.jumlah_nilai,
        rata_rata = excluded.rata_rata,
        ranking_kelas = excluded.ranking_kelas,
        predikat = excluded.predikat
    `, [generateId(), item.riwayat_pendidikan_id, item.semester, item.jumlah_nilai, item.rata_rata, idx + 1, predikat])
  }

  revalidatePath('/dashboard/akademik/leger')
  return { success: true }
}

function getPredikat(rata: number) {
  if (rata >= 86) return 'Mumtaz'
  if (rata >= 76) return 'Jayyid Jiddan'
  if (rata >= 66) return 'Jayyid'
  if (rata >= 56) return 'Maqbul'
  return 'Dhoif'
}