'use server'

import { query, execute, generateId } from '@/lib/db'
import { getCachedMapelList, getCachedTahunAjaranAktif } from '@/lib/cache/master'
import { getSession, hasRole, hasAnyRole } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

export async function getTahunAjaranList() {
  return query<any>('SELECT id, nama, is_active FROM tahun_ajaran ORDER BY id DESC')
}

// D1 batasi max 100 bound param/query. Pecah IN (...) jadi chunk biar kelas
// dengan santri >100 tidak kena "too many SQL variables".
const SQL_VAR_CHUNK = 90

async function getNilaiChunked(riwayatIds: string[], semester: number) {
  const out: any[] = []
  for (let i = 0; i < riwayatIds.length; i += SQL_VAR_CHUNK) {
    const part = riwayatIds.slice(i, i + SQL_VAR_CHUNK)
    const ph = part.map(() => '?').join(',')
    const rows = await query<any>(`
      SELECT riwayat_pendidikan_id, mapel_id, nilai
      FROM nilai_akademik
      WHERE riwayat_pendidikan_id IN (${ph}) AND semester = ?
    `, [...part, semester])
    out.push(...rows)
  }
  return out
}

export async function getKelasListForLeger(tahunAjaranId?: number) {
  const session = await getSession()
  if (!session) return []

  // Jika tidak ada tahunAjaranId, default ke tahun aktif
  let taId = tahunAjaranId
  if (!taId) {
    const aktif = await getCachedTahunAjaranAktif()
    taId = aktif?.id
  }

  let sql = `
    SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE k.tahun_ajaran_id = ?
  `
  const params: any[] = [taId]

  // Wali kelas hanya bisa lihat kelas binaannya
  if (!hasAnyRole(session, ['admin', 'sekpen', 'akademik']) && hasRole(session, 'wali_kelas')) {
    sql += ' AND k.wali_kelas_id = ?'
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
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
    LIMIT 1000
  `, [semester, kelasId])

  if (!santriList.length) return { mapel: mapelList, siswa: [] }

  const riwayatIds = santriList.map((s: any) => s.id)
  const nilaiList = await getNilaiChunked(riwayatIds, semester)

  // Lookup O(1) per (riwayat, mapel)
  const nilaiMap = new Map<string, number | string>()
  nilaiList.forEach((n: any) => nilaiMap.set(`${n.riwayat_pendidikan_id}:${n.mapel_id}`, n.nilai))

  // Mapel yang DIUJIANKAN di kelas = ada minimal 1 nilai > 0 dari seluruh santri.
  // Pembagi rata-rata = jumlah mapel ini (bukan per santri). Santri yang tidak
  // ikut satu mapel => nilai 0, tetap masuk pembagi.
  const mapelDiujikan = new Set<string>()
  nilaiList.forEach((n: any) => {
    if (Number(n.nilai) > 0) mapelDiujikan.add(String(n.mapel_id))
  })
  const divisor = mapelDiujikan.size

  const legerSiswa = santriList.map((s: any) => {
    const nilaiPerMapel: Record<string, number | string> = {}
    let jumlah = 0
    mapelList.forEach((m: any) => {
      const v = nilaiMap.get(`${s.id}:${m.id}`) ?? 0
      nilaiPerMapel[m.id] = v
      jumlah += Number(v) || 0
    })
    const rata = divisor > 0 ? Number((jumlah / divisor).toFixed(2)) : 0
    return {
      id: s.id,
      riwayat_id: s.id,
      nis: s.nis || '-',
      nama: s.nama_lengkap || 'Tanpa Nama',
      nilai: nilaiPerMapel,
      jumlah,
      rata,
      rank: s.ranking_kelas || '-',
    }
  })

  legerSiswa.sort((a: any, b: any) => a.nama.localeCompare(b.nama))
  return { mapel: mapelList, siswa: legerSiswa }
}

export async function hitungDanSimpanLeger(
  kelasId: string,
  semester: number,
  opts: { force?: boolean; skipLog?: boolean } = {}
) {
  const session = await getSession()
  const { siswa } = await getLegerData(kelasId, semester)
  if (!siswa.length) return { error: 'Tidak ada siswa' }

  // Pembagi = jumlah mapel diujiankan di kelas (ada nilai >0 dari minimal 1 santri).
  const mapelDiujikan = new Set<string>()
  siswa.forEach((s: any) => {
    Object.entries(s.nilai).forEach(([mapelId, v]: [string, any]) => {
      if (Number(v) > 0) mapelDiujikan.add(mapelId)
    })
  })
  const divisor = mapelDiujikan.size

  const kalkulasi = siswa.map((s: any) => {
    let jumlah = 0
    Object.values(s.nilai).forEach((v: any) => { jumlah += Number(v) || 0 })
    // Santri yang tidak ikut satu mapel => nilai 0, tetap dibagi total mapel diujiankan.
    const rata = divisor > 0 ? Number((jumlah / divisor).toFixed(2)) : 0
    return { riwayat_pendidikan_id: s.riwayat_id, semester, jumlah_nilai: jumlah, rata_rata: rata }
  })

  kalkulasi.sort((a, b) => b.rata_rata - a.rata_rata)

  // force = sekpen sengaja hitung ulang dari nilai guru -> timpa termasuk baris 'sekpen' & set sumber 'guru'.
  // tanpa force (alur guru biasa) = jangan timpa baris yang sudah difinalkan sekpen.
  const conflictClause = opts.force
    ? `ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
        jumlah_nilai = excluded.jumlah_nilai,
        rata_rata = excluded.rata_rata,
        ranking_kelas = excluded.ranking_kelas,
        predikat = excluded.predikat,
        sumber = 'guru'`
    : `ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
        jumlah_nilai = excluded.jumlah_nilai,
        rata_rata = excluded.rata_rata,
        ranking_kelas = excluded.ranking_kelas,
        predikat = excluded.predikat
      WHERE ranking.sumber != 'sekpen'`

  for (let idx = 0; idx < kalkulasi.length; idx++) {
    const item = kalkulasi[idx]
    const predikat = getPredikat(item.rata_rata)
    await execute(`
      INSERT INTO ranking (id, riwayat_pendidikan_id, semester, jumlah_nilai, rata_rata, ranking_kelas, predikat, sumber)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'guru')
      ${conflictClause}
    `, [generateId(), item.riwayat_pendidikan_id, item.semester, item.jumlah_nilai, item.rata_rata, idx + 1, predikat])
  }

  if (opts.skipLog) {
    revalidatePath('/dashboard/akademik/leger')
    return { success: true, count: kalkulasi.length }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_leger',
    action: 'update',
    fiturHref: '/dashboard/akademik/leger',
    logKind: 'update',
    entityType: 'ranking_batch',
    entityId: `${kelasId}:${semester}`,
    entityLabel: `Leger semester ${semester}`,
    summary: `Menghitung dan menyimpan leger untuk ${kalkulasi.length} santri`,
    details: {
      kelas_id: kelasId,
      semester,
      total_santri: kalkulasi.length,
    },
  })

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
