'use server'

import { query, execute, batch, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { hitungDanSimpanLeger } from '@/app/dashboard/akademik/leger/actions'

export async function getJuaraUmum(semester: number) {
  const allKelas = await query<any>(`
    SELECT k.id, k.nama_kelas,
           ta.nama AS tahun_ajaran,
           m.nama AS marhalah_nama, m.urutan AS marhalah_urutan,
           u.full_name AS wali_kelas
    FROM kelas k
    LEFT JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN users u ON u.id = k.wali_kelas_id
    WHERE m.nama IS NULL OR LOWER(m.nama) != 'mutaqaddimah'
  `, [])

  const rankingData = await query<any>(`
    SELECT r.ranking_kelas, r.jumlah_nilai, r.rata_rata, r.sumber,
           rp.id AS riwayat_pendidikan_id, rp.kelas_id,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM ranking r
    JOIN riwayat_pendidikan rp ON rp.id = r.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    WHERE r.semester = ? AND r.ranking_kelas <= 3
  `, [semester])

  const formattedKelas = allKelas.map((k: any) => ({
    kelas_id: k.id,
    kelas_nama: k.nama_kelas,
    tahun_ajaran: k.tahun_ajaran || null,
    marhalah_nama: k.marhalah_nama || '-',
    marhalah_urutan: k.marhalah_urutan || 999,
    wali_kelas: k.wali_kelas || '-',
  }))

  formattedKelas.sort((a: any, b: any) => {
    if (a.marhalah_urutan !== b.marhalah_urutan) return a.marhalah_urutan - b.marhalah_urutan
    return a.kelas_nama.localeCompare(b.kelas_nama, undefined, { numeric: true, sensitivity: 'base' })
  })

  const result: any[] = []

  formattedKelas.forEach((kelas: any) => {
    const ranksForClass = rankingData.filter((r: any) => r.kelas_id === kelas.kelas_id)

    for (let i = 1; i <= 3; i++) {
      const foundRank = ranksForClass.find((r: any) => r.ranking_kelas === i)
      if (foundRank) {
        result.push({
          rank: i,
          jumlah: foundRank.jumlah_nilai,
          rata: foundRank.rata_rata,
          sumber: foundRank.sumber || 'guru',
          riwayat_pendidikan_id: foundRank.riwayat_pendidikan_id,
          kelas_id: kelas.kelas_id,
          kelas_nama: kelas.kelas_nama,
          tahun_ajaran: kelas.tahun_ajaran,
          marhalah_nama: kelas.marhalah_nama,
          marhalah_urutan: kelas.marhalah_urutan,
          wali_kelas: kelas.wali_kelas,
          santri_nama: foundRank.nama_lengkap,
          nis: foundRank.nis,
          asrama: foundRank.asrama || '',
          kamar: foundRank.kamar || '',
        })
      } else {
        result.push({
          rank: i, jumlah: '', rata: '',
          sumber: null,
          riwayat_pendidikan_id: null,
          kelas_id: kelas.kelas_id,
          kelas_nama: kelas.kelas_nama,
          tahun_ajaran: kelas.tahun_ajaran,
          marhalah_nama: kelas.marhalah_nama,
          marhalah_urutan: kelas.marhalah_urutan,
          wali_kelas: kelas.wali_kelas,
          santri_nama: '', nis: '', asrama: '', kamar: '',
        })
      }
    }
  })

  return result
}

// Pendekatan alternatif: input manual oleh sekpen via combobox.
// Ambil santri aktif per kelas, asrama/kamar ikut biar bisa auto-isi saat dipilih.
export async function getSantriByKelas() {
  const rows = await query<any>(`
    SELECT rp.id AS rp_id, rp.kelas_id, s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap COLLATE NOCASE
  `, [])

  const map: Record<string, any[]> = {}
  for (const r of rows) {
    if (!map[r.kelas_id]) map[r.kelas_id] = []
    map[r.kelas_id].push({
      id: r.id,
      rp_id: r.rp_id,
      nama: r.nama_lengkap,
      nis: r.nis,
      asrama: r.asrama || '',
      kamar: r.kamar || '',
    })
  }
  return map
}

// Simpan SATU baris kejuaraan (auto-save per item) ke tabel ranking.
// UPSERT by (riwayat_pendidikan_id, semester) -> jadi riwayat ranking santri, satu sumber.
// jumlah_nilai / rata_rata disimpan NULL bila kosong (bukan 0).
export type SaveKejuaraanRow = {
  riwayat_pendidikan_id: string
  ranking_kelas: number
  jumlah: number | null
  rata: number | null
}

export async function saveKejuaraanRow(semester: number, row: SaveKejuaraanRow) {
  if (!row.riwayat_pendidikan_id) {
    return { error: 'Santri belum dipilih.' }
  }

  await execute(`
    INSERT INTO ranking (id, riwayat_pendidikan_id, semester, jumlah_nilai, rata_rata, ranking_kelas, sumber)
    VALUES (?, ?, ?, ?, ?, ?, 'sekpen')
    ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
      jumlah_nilai = excluded.jumlah_nilai,
      rata_rata = excluded.rata_rata,
      ranking_kelas = excluded.ranking_kelas,
      sumber = 'sekpen'
  `, [generateId(), row.riwayat_pendidikan_id, semester, row.jumlah, row.rata, row.ranking_kelas])

  return { success: true }
}

// Import hasil export Excel (upsert). Tiap item: kelas + ranking + nama santri.
// Aturan:
//  - nama kosong  -> skip (tak nimpa data yang ada)
//  - tak ketemu di DB -> skip (dilaporkan)
//  - ranking sama dengan yang tersimpan -> skip (tak ada perubahan)
//  - ranking beda / belum ada -> upsert (jumlah_nilai & rata_rata existing TIDAK ditimpa)
export type ImportKejuaraanItem = {
  kelas_nama: string
  ranking_kelas: number
  santri_nama: string
}

export async function importKejuaraan(semester: number, items: ImportKejuaraanItem[]) {
  const session = await getSession()

  // 1 query: peta santri aktif (kelas_nama + nama -> rp_id).
  const santriRows = await query<any>(`
    SELECT rp.id AS rp_id, k.nama_kelas, s.nama_lengkap
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
  `, [])
  const key = (kelas: string, nama: string) => `${kelas.trim().toLowerCase()}||${nama.trim().toLowerCase()}`
  const santriMap = new Map<string, string>()
  for (const r of santriRows) {
    const k = key(r.nama_kelas, r.nama_lengkap)
    if (!santriMap.has(k)) santriMap.set(k, r.rp_id) // nama dobel: ambil pertama
  }

  // 1 query: ranking tersimpan utk semester ini (rp_id -> ranking_kelas) buat banding sama/beda.
  const existingRows = await query<any>(
    `SELECT riwayat_pendidikan_id, ranking_kelas FROM ranking WHERE semester = ?`,
    [semester]
  )
  const existingRank = new Map<string, number>()
  for (const r of existingRows) existingRank.set(r.riwayat_pendidikan_id, r.ranking_kelas)

  let upsert = 0, sama = 0, kosong = 0, takKetemu = 0
  const seenRp = new Set<string>()
  const statements: { sql: string; params?: unknown[] }[] = []

  for (const it of items) {
    if (!it.santri_nama || !it.santri_nama.trim()) { kosong++; continue }
    const rpId = santriMap.get(key(it.kelas_nama, it.santri_nama))
    if (!rpId) { takKetemu++; continue }
    if (seenRp.has(rpId)) continue // santri dobel dalam file -> ambil pertama
    seenRp.add(rpId)

    if (existingRank.get(rpId) === it.ranking_kelas) { sama++; continue } // sama -> skip

    // beda / belum ada -> upsert. jumlah_nilai & rata_rata existing dijaga (tak disebut di UPDATE).
    statements.push({
      sql: `
        INSERT INTO ranking (id, riwayat_pendidikan_id, semester, jumlah_nilai, rata_rata, ranking_kelas, sumber)
        VALUES (?, ?, ?, NULL, NULL, ?, 'sekpen')
        ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
          ranking_kelas = excluded.ranking_kelas,
          sumber = 'sekpen'
      `,
      params: [generateId(), rpId, semester, it.ranking_kelas],
    })
    upsert++
  }

  if (statements.length > 0) await batch(statements)

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_ranking',
    action: 'update',
    fiturHref: '/dashboard/akademik/ranking',
    logKind: 'update',
    entityType: 'kejuaraan_import',
    entityId: `semester:${semester}`,
    entityLabel: `Import kejuaraan semester ${semester}`,
    summary: `Import: ${upsert} upsert, ${sama} sama, ${kosong} kosong, ${takKetemu} tak ketemu`,
    details: { semester, upsert, sama, kosong, tak_ketemu: takKetemu },
  })

  return { success: true, upsert, sama, kosong, takKetemu }
}

// Daftar kelas untuk recalc "semua" — dipecah di client, satu kelas per request.
export async function getRecalcKelasList() {
  const rows = await query<any>(`
    SELECT k.id, k.nama_kelas,
           m.urutan AS marhalah_urutan
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE m.nama IS NULL OR LOWER(m.nama) != 'mutaqaddimah'
  `, [])
  return rows
    .map((r: any) => ({ id: r.id, nama: r.nama_kelas, urutan: r.marhalah_urutan || 999 }))
    .sort((a: any, b: any) =>
      a.urutan !== b.urutan
        ? a.urutan - b.urutan
        : a.nama.localeCompare(b.nama, undefined, { numeric: true, sensitivity: 'base' })
    )
}

// Sekpen hitung ulang ranking SATU kelas dari input nilai guru.
// force=true: hasil guru ditulis ulang, menimpa termasuk baris yang sebelumnya 'sekpen'
// (sekpen sengaja reset -> hasil yang muncul adalah hitungan guru, sumber 'guru').
// Dipanggil per kelas dari client (loop), jadi tiap kelas dapat budget subrequest Worker sendiri.
export async function recalcKejuaraanKelas(semester: number, kelasId: string) {
  const session = await getSession()
  const r = await hitungDanSimpanLeger(kelasId, semester, { force: true, skipLog: true })
  const santri = (r as any)?.success ? ((r as any).count || 0) : 0

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_ranking',
    action: 'update',
    fiturHref: '/dashboard/akademik/ranking',
    logKind: 'update',
    entityType: 'kejuaraan_recalc',
    entityId: `kelas:${kelasId}:${semester}`,
    entityLabel: `Hitung ulang kejuaraan semester ${semester}`,
    summary: `Hitung ulang 1 kelas dari nilai guru (${santri} santri)`,
    details: { semester, kelas_id: kelasId, santri_dihitung: santri },
  })

  return { success: true, santriDihitung: santri }
}