'use server'

import { query, execute, batch, generateId } from '@/lib/db'
import { getCachedMapelList, getCachedTahunAjaranAktif } from '@/lib/cache/master'
import { getSession, hasRole, hasAnyRole } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { ensureGuruKitabSchema } from '@/lib/akademik/guru-kitab'
import {
  KEPRIBADIAN_FIELDS,
  codeToKepribadianScore,
  scoreToKepribadianCode,
} from '@/lib/akademik/kepribadian'

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
      SELECT riwayat_pendidikan_id, mapel_id, COALESCE(nilai, 0) AS nilai, (nilai IS NOT NULL) AS has_nilai
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

export async function getMapelPeganganForKelas(kelasId: string, tahunAjaranId?: number) {
  await ensureGuruKitabSchema()
  const session = await getSession()
  if (!session || !kelasId) return []

  let taId = tahunAjaranId
  if (!taId) {
    const aktif = await getCachedTahunAjaranAktif()
    taId = aktif?.id
  }
  if (!taId) return []

  const rows = await query<any>(`
    SELECT
      a.sesi,
      a.hari_index,
      a.guru_id,
      dg.nama_lengkap AS guru_nama,
      a.kitab_id,
      kb.nama_kitab AS kitab_nama,
      mp.id AS mapel_id,
      mp.nama AS mapel_nama
    FROM guru_kitab_assignment a
    JOIN kitab kb ON kb.id = a.kitab_id
    JOIN mapel mp ON mp.id = kb.mapel_id
    JOIN data_guru dg ON dg.id = a.guru_id
    WHERE a.tahun_ajaran_id = ? AND a.kelas_id = ? AND a.is_active = 1
    ORDER BY
      CASE a.sesi WHEN 'shubuh' THEN 0 WHEN 'ashar' THEN 1 ELSE 2 END,
      COALESCE(a.hari_index, -1),
      mp.nama,
      kb.nama_kitab,
      dg.nama_lengkap
  `, [taId, kelasId])

  const seen = new Set<string>()
  return rows.filter((row: any) => {
    const key = `${row.mapel_id}:${row.kitab_id}:${row.guru_id}:${row.sesi}:${row.hari_index ?? 'default'}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map((row: any) => ({
    id: `${row.mapel_id}:${row.kitab_id}:${row.guru_id}:${row.sesi}:${row.hari_index ?? 'default'}`,
    mapel_id: Number(row.mapel_id),
    mapel_nama: row.mapel_nama || 'Tanpa Nama',
    kitab_id: Number(row.kitab_id),
    kitab_nama: row.kitab_nama || '-',
    sesi: row.sesi,
    guru_id: Number(row.guru_id),
    guru_nama: row.guru_nama || '-',
    label: `${row.mapel_nama || 'Tanpa Nama'} - ${row.kitab_nama || '-'} - ${row.sesi} / ${row.guru_nama || '-'}`,
  }))
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
  const nilaiMap = new Map<string, { nilai: number; hasNilai: boolean }>()
  nilaiList.forEach((n: any) => {
    nilaiMap.set(`${n.riwayat_pendidikan_id}:${n.mapel_id}`, {
      nilai: Number(n.nilai) || 0,
      hasNilai: Boolean(n.has_nilai),
    })
  })

  // Mapel yang DIUJIANKAN di kelas = ada minimal 1 nilai > 0 dari seluruh santri.
  // Pembagi rata-rata = jumlah mapel ini (bukan per santri). Santri yang tidak
  // ikut satu mapel => nilai 0, tetap masuk pembagi.
  const mapelDiujikan = new Set<string>()
  nilaiList.forEach((n: any) => mapelDiujikan.add(String(n.mapel_id)))
  const divisor = mapelDiujikan.size

  const legerSiswa = santriList.map((s: any) => {
    const nilaiPerMapel: Record<string, number | null> = {}
    let jumlah = 0
    mapelList.forEach((m: any) => {
      const item = nilaiMap.get(`${s.id}:${m.id}`)
      const v = item?.nilai ?? 0
      nilaiPerMapel[m.id] = item?.hasNilai ? v : null
      jumlah += v
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
  return { mapel: mapelList, mapelDiujikan: Array.from(mapelDiujikan), siswa: legerSiswa }
}

function normalizeNilaiInput(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.trunc(n)))
}

export async function simpanNilaiMatrix(
  semester: number,
  data: { riwayat_id: string; nilai: Record<string, number | string | null | undefined> }[]
) {
  const session = await getSession()
  if (!session) return { error: 'Sesi login tidak ditemukan.' }
  if (!data.length) return { error: 'Tidak ada data.' }

  const statements: { sql: string; params?: unknown[] }[] = []
  for (const row of data) {
    for (const [mapelId, rawValue] of Object.entries(row.nilai || {})) {
      statements.push({
        sql: `INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, semester, nilai)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(riwayat_pendidikan_id, mapel_id, semester) DO UPDATE SET nilai = excluded.nilai`,
        params: [generateId(), row.riwayat_id, Number(mapelId), semester, normalizeNilaiInput(rawValue)],
      })
    }
  }

  if (!statements.length) return { error: 'Tidak ada nilai yang bisa disimpan.' }
  await batch(statements)

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_nilai_rapor',
    action: 'update',
    fiturHref: '/dashboard/akademik/leger',
    logKind: 'update',
    entityType: 'nilai_rapor_matrix',
    entityId: `semester:${semester}`,
    entityLabel: 'Nilai rapor matrix',
    summary: `Menyimpan nilai rapor matrix (${statements.length} sel)`,
    details: { semester, total_cells: statements.length, total_santri: data.length },
  })

  revalidatePath('/dashboard/akademik/leger')
  revalidatePath('/dashboard/laporan/rapor')
  return { success: true, count: statements.length }
}

export async function getDataNilaiPerMapel(kelasId: string, mapelId: number, semester: number) {
  const rows = await query<any>(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap, na.nilai, na.id AS nilai_id
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN nilai_akademik na ON na.riwayat_pendidikan_id = rp.id
         AND na.mapel_id = ? AND na.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [mapelId, semester, kelasId])

  return rows.map((r: any) => ({
    riwayat_id: r.riwayat_id,
    nis: r.nis || '-',
    nama: r.nama_lengkap || 'Tanpa Nama',
    nilai: r.nilai_id ? (r.nilai === null ? '' : Number(r.nilai ?? 0)) : '',
  }))
}

export async function simpanNilaiPerMapel(
  semester: number,
  mapelId: number,
  data: { riwayat_id: string; nilai: number | string | null | undefined }[]
) {
  const session = await getSession()
  if (!session) return { error: 'Sesi login tidak ditemukan.' }
  if (!data.length) return { error: 'Tidak ada data.' }

  await batch(data.map(item => ({
    sql: `INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, semester, nilai)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(riwayat_pendidikan_id, mapel_id, semester) DO UPDATE SET nilai = excluded.nilai`,
    params: [generateId(), item.riwayat_id, mapelId, semester, normalizeNilaiInput(item.nilai)],
  })))

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_nilai_rapor',
    action: 'update',
    fiturHref: '/dashboard/akademik/leger',
    logKind: 'update',
    entityType: 'nilai_mapel_batch',
    entityId: `${mapelId}:${semester}`,
    entityLabel: `Nilai mapel ${mapelId}`,
    summary: `Menyimpan nilai mapel untuk ${data.length} santri`,
    details: { mapel_id: mapelId, semester, total_santri: data.length },
  })

  revalidatePath('/dashboard/akademik/leger')
  revalidatePath('/dashboard/laporan/rapor')
  return { success: true, count: data.length }
}

export async function getDataKepribadian(kelasId: string, semester: number) {
  const rows = await query<any>(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap,
           na.kedisiplinan, na.kebersihan, na.kesopanan, na.ibadah, na.kemandirian
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN nilai_akhlak na ON na.riwayat_pendidikan_id = rp.id AND na.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [semester, kelasId])

  return rows.map((r: any) => ({
    riwayat_id: r.riwayat_id,
    nis: r.nis || '-',
    nama: r.nama_lengkap || 'Tanpa Nama',
    kedisiplinan: scoreToKepribadianCode(r.kedisiplinan ?? 80),
    kebersihan: scoreToKepribadianCode(r.kebersihan ?? 80),
    kesopanan: scoreToKepribadianCode(r.kesopanan ?? 80),
    ibadah: scoreToKepribadianCode(r.ibadah ?? 80),
    kemandirian: scoreToKepribadianCode(r.kemandirian ?? 80),
  }))
}

export async function simpanKepribadian(semester: number, data: any[]) {
  const session = await getSession()
  if (!session) return { error: 'Sesi login tidak ditemukan.' }
  if (!data.length) return { error: 'Tidak ada data.' }

  await batch(data.map(item => ({
    sql: `INSERT INTO nilai_akhlak (id, riwayat_pendidikan_id, semester, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
            kedisiplinan = excluded.kedisiplinan, kebersihan = excluded.kebersihan,
            kesopanan = excluded.kesopanan, ibadah = excluded.ibadah, kemandirian = excluded.kemandirian`,
    params: [
      generateId(),
      item.riwayat_id,
      semester,
      codeToKepribadianScore(item.kedisiplinan),
      codeToKepribadianScore(item.kebersihan),
      codeToKepribadianScore(item.kesopanan),
      codeToKepribadianScore(item.ibadah),
      codeToKepribadianScore(item.kemandirian),
    ],
  })))

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_nilai_rapor',
    action: 'update',
    fiturHref: '/dashboard/akademik/leger',
    logKind: 'update',
    entityType: 'nilai_kepribadian_batch',
    entityId: `kepribadian:${semester}`,
    entityLabel: 'Nilai kepribadian',
    summary: `Menyimpan nilai kepribadian untuk ${data.length} santri`,
    details: { semester, total_santri: data.length },
  })

  revalidatePath('/dashboard/akademik/leger')
  revalidatePath('/dashboard/laporan/rapor')
  return { success: true }
}

export async function getDataCatatanWali(kelasId: string, semester: number) {
  const rows = await query<any>(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap, r.catatan_wali_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [semester, kelasId])

  return rows.map((r: any) => ({
    riwayat_id: r.riwayat_id,
    nis: r.nis || '-',
    nama: r.nama_lengkap || 'Tanpa Nama',
    catatan_wali_kelas: r.catatan_wali_kelas ?? '',
  }))
}

export async function simpanCatatanWali(semester: number, data: { riwayat_id: string; catatan: string }[]) {
  const session = await getSession()
  if (!session) return { error: 'Sesi login tidak ditemukan.' }
  if (!data.length) return { error: 'Tidak ada data.' }

  for (const item of data) {
    await execute(`
      INSERT INTO ranking (id, riwayat_pendidikan_id, semester, catatan_wali_kelas)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET catatan_wali_kelas = excluded.catatan_wali_kelas
    `, [generateId(), item.riwayat_id, semester, item.catatan])
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_nilai_rapor',
    action: 'update',
    fiturHref: '/dashboard/akademik/leger',
    logKind: 'update',
    entityType: 'catatan_wali_batch',
    entityId: `catatan:${semester}`,
    entityLabel: 'Catatan wali kelas',
    summary: `Menyimpan catatan wali kelas untuk ${data.length} santri`,
    details: { semester, total_santri: data.length },
  })

  revalidatePath('/dashboard/akademik/leger')
  revalidatePath('/dashboard/laporan/rapor')
  return { success: true }
}

export async function getDataSantriPerKelas(kelasId: string) {
  const data = await query<any>(`
    SELECT rp.id, s.nis, s.nama_lengkap
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])

  return data.map((d: any) => ({
    riwayat_id: d.id,
    nis: d.nis,
    nama: d.nama_lengkap,
  }))
}

export async function simpanNilaiExcelMenyeluruh(
  kelasId: string,
  semester: number,
  dataNilai: any[],
  listMapel: { id: number; nama: string }[]
) {
  const session = await getSession()
  const dataSantri = await getDataSantriPerKelas(kelasId)
  const mapNisToId = new Map<string, string>()
  dataSantri.forEach((s: any) => mapNisToId.set(String(s.nis).trim(), s.riwayat_id))

  const mapMapel = new Map<string, number>()
  listMapel.forEach(m => mapMapel.set(m.nama.toUpperCase().trim(), m.id))

  const toUpsertAkademik: any[] = []
  const toUpsertAkhlak: any[] = []
  const toUpsertRanking: any[] = []
  const errors: string[] = []

  dataNilai.forEach((row, idx) => {
    const baris = idx + 2
    const nis = String(row['NIS'] || row['nis'] || '').trim()
    const riwayatId = mapNisToId.get(nis)
    if (!riwayatId) { errors.push(`Baris ${baris}: NIS '${nis}' tidak ditemukan.`); return }

    Object.keys(row).forEach(key => {
      const namaKolom = key.toUpperCase().trim()
      const mapelId = mapMapel.get(namaKolom)
      if (mapelId) toUpsertAkademik.push({ riwayatId, mapelId, semester, nilai: normalizeNilaiInput(row[key]) })
    })

    const hasKepribadian = KEPRIBADIAN_FIELDS.some(f => row[f.label.toUpperCase()] !== undefined || row[f.key] !== undefined)
    if (hasKepribadian) {
      const getCode = (field: typeof KEPRIBADIAN_FIELDS[number]) => row[field.label.toUpperCase()] || row[field.key] || 'B'
      toUpsertAkhlak.push({
        riwayatId,
        semester,
        kedisiplinan: codeToKepribadianScore(getCode(KEPRIBADIAN_FIELDS[0])),
        ibadah: codeToKepribadianScore(getCode(KEPRIBADIAN_FIELDS[1])),
        kesopanan: codeToKepribadianScore(getCode(KEPRIBADIAN_FIELDS[2])),
        kebersihan: codeToKepribadianScore(getCode(KEPRIBADIAN_FIELDS[3])),
        kemandirian: codeToKepribadianScore(getCode(KEPRIBADIAN_FIELDS[4])),
      })
    }

    const catatan = String(row['CATATAN WALI KELAS'] || row['catatan_wali_kelas'] || '').trim()
    if (catatan) toUpsertRanking.push({ riwayatId, semester, catatan })
  })

  if (errors.length > 0) return { error: `Ditemukan masalah:\n${errors.slice(0, 5).join('\n')}` }

  const statements: { sql: string; params?: unknown[] }[] = []
  statements.push(...toUpsertAkademik.map(item => ({
    sql: `INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, semester, nilai)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(riwayat_pendidikan_id, mapel_id, semester) DO UPDATE SET nilai = excluded.nilai`,
    params: [generateId(), item.riwayatId, item.mapelId, item.semester, item.nilai],
  })))
  statements.push(...toUpsertAkhlak.map(item => ({
    sql: `INSERT INTO nilai_akhlak (id, riwayat_pendidikan_id, semester, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
            kedisiplinan = excluded.kedisiplinan, kebersihan = excluded.kebersihan,
            kesopanan = excluded.kesopanan, ibadah = excluded.ibadah, kemandirian = excluded.kemandirian`,
    params: [generateId(), item.riwayatId, item.semester, item.kedisiplinan, item.kebersihan, item.kesopanan, item.ibadah, item.kemandirian],
  })))

  if (statements.length > 0) await batch(statements)
  for (const item of toUpsertRanking) {
    await execute(`
      INSERT INTO ranking (id, riwayat_pendidikan_id, semester, catatan_wali_kelas)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET catatan_wali_kelas = excluded.catatan_wali_kelas
    `, [generateId(), item.riwayatId, item.semester, item.catatan])
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_nilai_rapor',
    action: 'update',
    fiturHref: '/dashboard/akademik/leger',
    logKind: 'update',
    entityType: 'nilai_import_batch',
    entityId: `${kelasId}:${semester}`,
    entityLabel: 'Import nilai menyeluruh',
    summary: `Import nilai menyeluruh untuk ${dataNilai.length} baris`,
    details: {
      kelas_id: kelasId,
      semester,
      total_rows: dataNilai.length,
      nilai_akademik: toUpsertAkademik.length,
      nilai_kepribadian: toUpsertAkhlak.length,
      catatan_wali: toUpsertRanking.length,
      mapel_count: listMapel.length,
    },
  })

  revalidatePath('/dashboard/akademik/leger')
  revalidatePath('/dashboard/laporan/rapor')
  return { success: true }
}

export async function hitungDanSimpanLeger(
  kelasId: string,
  semester: number,
  opts: { force?: boolean; skipLog?: boolean } = {}
) {
  const session = await getSession()
  const leger = await getLegerData(kelasId, semester)
  const { siswa } = leger
  if (!siswa.length) return { error: 'Tidak ada siswa' }

  // Pembagi = jumlah mapel yang sudah punya baris nilai di kelas ini.
  // Nilai NULL/0 tetap dihitung sebagai 0 agar santri tanpa nilai tidak menaikkan rata-rata.
  const divisor = Array.isArray((leger as any).mapelDiujikan) ? (leger as any).mapelDiujikan.length : 0

  // Tanpa force: baris yang difinalkan sekpen TIDAK diubah, dan nomor ranking
  // yang dipakai sekpen di-RESERVE supaya santri lain tidak dapat nomor sama
  // (penyebab "juara 2 dua orang"). Dengan force: semua dihitung ulang 1..N.
  const allIds = siswa.map((s: any) => s.riwayat_id)
  const pinnedRanks = new Set<number>()
  const pinnedIds = new Set<string>()
  if (!opts.force) {
    for (let i = 0; i < allIds.length; i += SQL_VAR_CHUNK) {
      const part = allIds.slice(i, i + SQL_VAR_CHUNK)
      const ph = part.map(() => '?').join(',')
      const rows = await query<any>(
        `SELECT riwayat_pendidikan_id, ranking_kelas FROM ranking
         WHERE semester = ? AND sumber = 'sekpen' AND riwayat_pendidikan_id IN (${ph})`,
        [semester, ...part]
      )
      rows.forEach((r: any) => {
        pinnedIds.add(String(r.riwayat_pendidikan_id))
        if (r.ranking_kelas != null) pinnedRanks.add(Number(r.ranking_kelas))
      })
    }
  }

  const kalkulasi = siswa
    .filter((s: any) => !pinnedIds.has(String(s.riwayat_id)))
    .map((s: any) => {
      let jumlah = 0
      Object.values(s.nilai).forEach((v: any) => { jumlah += Number(v) || 0 })
      // Santri yang tidak ikut satu mapel => nilai 0, tetap dibagi total mapel diujiankan.
      const rata = divisor > 0 ? Number((jumlah / divisor).toFixed(2)) : 0
      return { riwayat_pendidikan_id: s.riwayat_id, semester, jumlah_nilai: jumlah, rata_rata: rata }
    })

  // Urutkan rata desc, tiebreak jumlah desc -> ranking selalu unik (tanpa dobel).
  kalkulasi.sort((a, b) => b.rata_rata - a.rata_rata || b.jumlah_nilai - a.jumlah_nilai)

  // Assign nomor ranking, lewati nomor yang sudah dipin sekpen.
  const ranked = kalkulasi.map((item) => ({ ...item, ranking_kelas: 0 }))
  let nextRank = 1
  for (const item of ranked) {
    while (pinnedRanks.has(nextRank)) nextRank++
    item.ranking_kelas = nextRank
    nextRank++
  }

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

  for (const item of ranked) {
    const predikat = getPredikat(item.rata_rata)
    await execute(`
      INSERT INTO ranking (id, riwayat_pendidikan_id, semester, jumlah_nilai, rata_rata, ranking_kelas, predikat, sumber)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'guru')
      ${conflictClause}
    `, [generateId(), item.riwayat_pendidikan_id, item.semester, item.jumlah_nilai, item.rata_rata, item.ranking_kelas, predikat])
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
