'use server'

import { query, batch, generateId } from '@/lib/db'
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

// Simpan hasil kejuaraan (manual sekpen / hasil edit) ke tabel ranking.
// UPSERT by (riwayat_pendidikan_id, semester) -> jadi riwayat ranking santri, satu sumber.
// jumlah_nilai / rata_rata disimpan NULL bila kosong (bukan 0).
export type SaveKejuaraanRow = {
  riwayat_pendidikan_id: string
  ranking_kelas: number
  jumlah: number | null
  rata: number | null
}

export async function saveKejuaraan(semester: number, rows: SaveKejuaraanRow[]) {
  const session = await getSession()

  // Hanya baris yang punya santri terpilih (riwayat_pendidikan_id) yang disimpan.
  const valid = rows.filter(r => r.riwayat_pendidikan_id)
  if (valid.length === 0) return { error: 'Tidak ada baris berisi santri untuk disimpan.' }

  // Satu santri tak boleh dobel di semester yang sama (UPSERT key sama -> tabrakan dalam 1 batch).
  const seen = new Set<string>()
  for (const r of valid) {
    if (seen.has(r.riwayat_pendidikan_id)) {
      return { error: 'Ada santri yang dipilih lebih dari sekali. Pastikan tiap juara santri berbeda.' }
    }
    seen.add(r.riwayat_pendidikan_id)
  }

  const statements = valid.map(r => ({
    sql: `
      INSERT INTO ranking (id, riwayat_pendidikan_id, semester, jumlah_nilai, rata_rata, ranking_kelas, sumber)
      VALUES (?, ?, ?, ?, ?, ?, 'sekpen')
      ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
        jumlah_nilai = excluded.jumlah_nilai,
        rata_rata = excluded.rata_rata,
        ranking_kelas = excluded.ranking_kelas,
        sumber = 'sekpen'
    `,
    params: [generateId(), r.riwayat_pendidikan_id, semester, r.jumlah, r.rata, r.ranking_kelas],
  }))

  // Satu round-trip untuk semua baris -> hemat write.
  await batch(statements)

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_ranking',
    action: 'update',
    fiturHref: '/dashboard/akademik/ranking',
    logKind: 'update',
    entityType: 'kejuaraan_batch',
    entityId: `semester:${semester}`,
    entityLabel: `Kejuaraan semester ${semester}`,
    summary: `Menyimpan ${valid.length} data juara (input manual)`,
    details: { semester, total: valid.length },
  })

  return { success: true, saved: valid.length }
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