'use server'

import { query, queryOne, batch, execute } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { getCachedMarhalahList, getCachedTahunAjaranAktif, getCachedTahunAjaranList } from '@/lib/cache/master'
import { isKomposisiKelas } from '@/lib/akademik/grade'
import { getKategoriSantriEfektifSql } from '@/lib/santri/kategori'

// Komposisi baru/lama AKTUAL kelas, dihitung dari data riil hasil Penempatan Kelas
// (riwayat_pendidikan + kategori efektif santri), bukan dari input manual `baru_lama`.
// Field manual tetap dipakai sebagai rencana/target komposisi (non-restriktif).
function baruLamaAktualSql(kelasAlias = 'k') {
  const kategoriSql = getKategoriSantriEfektifSql('s2')
  return `(
    SELECT CASE
      WHEN COUNT(*) = 0 THEN NULL
      WHEN SUM(CASE WHEN ${kategoriSql} = 'BARU' THEN 1 ELSE 0 END) = COUNT(*) THEN 'BARU'
      WHEN SUM(CASE WHEN ${kategoriSql} = 'BARU' THEN 1 ELSE 0 END) = 0 THEN 'LAMA'
      ELSE 'BARU DAN LAMA (CAMPURAN)'
    END
    FROM riwayat_pendidikan rp2
    JOIN santri s2 ON s2.id = rp2.santri_id AND s2.status_global = 'aktif'
    WHERE rp2.kelas_id = ${kelasAlias}.id AND rp2.status_riwayat = 'aktif'
  ) AS baru_lama_aktual`
}

// Pakai cache untuk data yang jarang berubah
export { getCachedTahunAjaranAktif as getTahunAjaranAktif }
export { getCachedMarhalahList as getMarhalahList }
export { getCachedTahunAjaranList as getTahunAjaranList }

async function ensureKelasExtraColumns() {
  try {
    await execute('ALTER TABLE kelas ADD COLUMN tempat TEXT')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }

  try {
    await execute('ALTER TABLE kelas ADD COLUMN grade TEXT')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }

  try {
    await execute('ALTER TABLE kelas ADD COLUMN baru_lama TEXT')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }
}

function sortKelasByMarhalahPriority(a: any, b: any) {
  const getSortWeight = (nama: string) => {
    const lower = (nama || '').toLowerCase()
    if (lower.includes('tamhidiyyah 1')) return 1
    if (lower.includes('tamhidiyyah 2')) return 2
    if (lower.includes('tamhidiyyah')) return 2 // Fallback
    if (lower.includes('ibtidaiyyah')) return 3
    if (lower.includes('mutawassithah')) return 4
    if (lower.includes('mutaqaddimah')) return 5
    return 99
  }
  
  const weightA = getSortWeight(a.nama_kelas)
  const weightB = getSortWeight(b.nama_kelas)
  
  if (weightA !== weightB) {
    return weightA - weightB
  }
  
  return a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
}

export async function getKelasList() {
  await ensureKelasExtraColumns()
  const data = await query<any>(`
    SELECT k.*, m.nama as marhalah_nama, ta.nama as tahun_ajaran_nama, ${baruLamaAktualSql('k')}
    FROM kelas k
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `)
  return data.sort(sortKelasByMarhalahPriority)
}

export type TempelanKelasItem = {
  id: string
  nama_kelas: string
  tempat: string | null
  grade: string | null
  baru_lama: string | null
  marhalah_nama: string | null
  tahun_ajaran_nama: string
}

export async function getKelasTempelanList() {
  await ensureKelasExtraColumns()
  const data = await query<TempelanKelasItem>(`
    SELECT
      k.id,
      k.nama_kelas,
      k.tempat,
      k.grade,
      k.baru_lama,
      m.nama as marhalah_nama,
      ta.nama as tahun_ajaran_nama
    FROM kelas k
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    ORDER BY k.nama_kelas COLLATE NOCASE
  `)

  return data.sort(sortKelasByMarhalahPriority)
}

export async function getTempelanKelasData(kelasId: string) {
  await ensureKelasExtraColumns()
  return queryOne<TempelanKelasItem>(`
    SELECT
      k.id,
      k.nama_kelas,
      k.tempat,
      k.grade,
      k.baru_lama,
      m.nama as marhalah_nama,
      ta.nama as tahun_ajaran_nama
    FROM kelas k
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    WHERE k.id = ?
    LIMIT 1
  `, [kelasId])
}

export async function getTempelanKelasSemuaData() {
  return getKelasTempelanList()
}

export async function tambahKelas(formData: FormData) {
  const session = await getSession()
  const namaKelas = formData.get('nama_kelas') as string
  const marhalahId = formData.get('marhalah_id') as string
  const jenisKelamin = formData.get('jenis_kelamin') as string
  const tempat = ((formData.get('tempat') as string) || '').trim()
  const gradeRaw = ((formData.get('grade') as string) || '').trim().toUpperCase()
  const grade = isKomposisiKelas(gradeRaw) ? gradeRaw : ''
  const baruLama = ((formData.get('baru_lama') as string) || '').trim().toUpperCase()

  await ensureKelasExtraColumns()

  const tahunAktif = await queryOne<{ id: string }>(
    'SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  )
  if (!tahunAktif) return { error: 'Tidak ada tahun ajaran aktif.' }

  const exist = await queryOne(
    'SELECT id FROM kelas WHERE nama_kelas = ? AND marhalah_id = ? AND tahun_ajaran_id = ?',
    [namaKelas, marhalahId, tahunAktif.id]
  )
  if (exist) return { error: 'Kelas dengan nama ini sudah ada di marhalah tersebut.' }

  await query(
    'INSERT INTO kelas (id, nama_kelas, marhalah_id, jenis_kelamin, tempat, grade, baru_lama, tahun_ajaran_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [crypto.randomUUID(), namaKelas, marhalahId, jenisKelamin, tempat || null, grade || null, baruLama || null, tahunAktif.id]
  )

  const marhalah = await queryOne<{ nama: string | null }>('SELECT nama FROM marhalah WHERE id = ?', [marhalahId])
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_kelas',
    action: 'create',
    fiturHref: '/dashboard/master/kelas',
    logKind: 'create',
    entityType: 'kelas',
    entityLabel: namaKelas,
    summary: `Menambahkan kelas ${namaKelas}`,
    details: {
      marhalah: marhalah?.nama || marhalahId,
      jenis_kelamin: jenisKelamin,
      tempat: tempat || null,
      grade: grade || null,
      baru_lama: baruLama || null,
      tahun_ajaran_id: tahunAktif.id,
    },
  })

  revalidatePath('/dashboard/master/kelas')
  return { success: true }
}

export async function hapusKelas(kelasId: string) {
  const session = await getSession()
  const targetKelas = await queryOne<{
    id: string
    nama_kelas: string
    jenis_kelamin: string | null
    tempat: string | null
    grade: string | null
    baru_lama: string | null
  }>('SELECT id, nama_kelas, jenis_kelamin, tempat, grade, baru_lama FROM kelas WHERE id = ?', [kelasId])
  if (!targetKelas) return { error: 'Kelas tidak ditemukan.' }
  const rows = await query<{ count: number }>(
    'SELECT COUNT(*) as count FROM riwayat_pendidikan WHERE kelas_id = ? AND status_riwayat = ?',
    [kelasId, 'aktif']
  )
  const count = rows[0]?.count ?? 0
  if (count > 0) return { error: 'Gagal hapus: Masih ada santri aktif di kelas ini. Kosongkan dulu.' }

  await query('DELETE FROM kelas WHERE id = ?', [kelasId])
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_kelas',
    action: 'delete',
    fiturHref: '/dashboard/master/kelas',
    logKind: 'delete',
    entityType: 'kelas',
    entityId: targetKelas.id,
    entityLabel: targetKelas.nama_kelas,
    summary: `Menghapus kelas ${targetKelas.nama_kelas}`,
    details: {
      jenis_kelamin: targetKelas.jenis_kelamin,
      tempat: targetKelas.tempat,
      grade: targetKelas.grade,
      baru_lama: targetKelas.baru_lama,
    },
  })

  revalidatePath('/dashboard/master/kelas')
  return { success: true }
}

export async function importKelasMassal(dataExcel: any[]) {
  const session = await getSession()
  await ensureKelasExtraColumns()
  const tahunAktif = await queryOne<{ id: string }>(
    'SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  )
  if (!tahunAktif) return { error: 'Tidak ada tahun ajaran aktif.' }

  // Pakai cache untuk marhalah list
  const marhalahList = await getCachedMarhalahList()
  const mapMarhalah = new Map(marhalahList.map((m: any) => [m.nama.toLowerCase().trim(), m.id]))

  const existingClasses = await query<{ nama_kelas: string; marhalah_id: string }>(
    'SELECT nama_kelas, marhalah_id FROM kelas WHERE tahun_ajaran_id = ?',
    [tahunAktif.id]
  )
  const existingSet = new Set(existingClasses.map(c => `${c.nama_kelas.toLowerCase().trim()}-${c.marhalah_id}`))

  const inserts: any[] = []
  const errors: string[] = []
  let duplicates = 0

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    const rowNum = i + 2
    const namaKelas = String(row['NAMA KELAS'] || row['nama kelas'] || '').trim()
    const namaMarhalah = String(row['MARHALAH'] || row['marhalah'] || '').trim()
    const jkRaw = String(row['JENIS KELAMIN'] || row['jenis kelamin'] || 'L').toUpperCase().trim()
    const tempat = String(row['TEMPAT'] || row['tempat'] || '').trim()
    const gradeRaw = String(row['GRADE'] || row['grade'] || '').trim().toUpperCase()
    const grade = isKomposisiKelas(gradeRaw) ? gradeRaw : ''
    const baruLamaRaw = String(row['B/L'] || row['BARU/LAMA'] || row['baru/lama'] || row['baru_lama'] || '').trim().toUpperCase()
    let baruLama = baruLamaRaw
    if (baruLamaRaw === 'B') baruLama = 'BARU'
    else if (baruLamaRaw === 'L') baruLama = 'LAMA'
    else if (baruLamaRaw === 'C' || baruLamaRaw === 'CAMPURAN' || baruLamaRaw === 'CAMPUR') baruLama = 'BARU DAN LAMA (CAMPURAN)'

    if (!namaKelas || !namaMarhalah) continue

    const marhalahId = mapMarhalah.get(namaMarhalah.toLowerCase())
    if (!marhalahId) {
      errors.push(`Baris ${rowNum}: Marhalah '${namaMarhalah}' tidak ditemukan di sistem.`)
      continue
    }

    const keyCheck = `${namaKelas.toLowerCase()}-${marhalahId}`
    if (existingSet.has(keyCheck)) { duplicates++; continue }

    let jk = 'L'
    if (jkRaw === 'P' || jkRaw === 'PUTRI' || jkRaw === 'PEREMPUAN') jk = 'P'
    else if (jkRaw === 'C' || jkRaw === 'CAMPURAN') jk = 'C'

    inserts.push([crypto.randomUUID(), namaKelas, marhalahId, jk, tempat || null, grade || null, baruLama || null, tahunAktif.id])
    existingSet.add(keyCheck)
  }

  if (errors.length > 0) return { error: `Gagal sebagian:\n${errors.slice(0, 5).join('\n')}` }
  if (inserts.length === 0) {
    if (duplicates > 0) return { error: `Semua data (${duplicates}) dilewati karena kelas sudah ada.` }
    return { error: 'Tidak ada data valid untuk disimpan.' }
  }

  await batch(inserts.map(row => ({
    sql: 'INSERT INTO kelas (id, nama_kelas, marhalah_id, jenis_kelamin, tempat, grade, baru_lama, tahun_ajaran_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    params: row,
  })))

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_kelas',
    action: 'create',
    fiturHref: '/dashboard/master/kelas',
    logKind: 'create',
    entityType: 'kelas_batch',
    entityId: 'import',
    entityLabel: 'Import kelas massal',
    summary: `Import kelas massal: ${inserts.length} kelas ditambahkan`,
    details: {
      inserted: inserts.length,
      skipped: duplicates,
      failed: errors.length,
      tahun_ajaran_id: tahunAktif.id,
    },
  })

  revalidatePath('/dashboard/master/kelas')
  return { success: true, count: inserts.length, skipped: duplicates }
}

export async function updateKelasRuanganFields(
  kelasId: string,
  fields: { tempat?: string; grade?: string; baru_lama?: string; jenis_kelamin?: string }
) {
  const session = await getSession()
  await ensureKelasExtraColumns()

  const existing = await queryOne<{ id: string; nama_kelas: string }>(
    'SELECT id, nama_kelas FROM kelas WHERE id = ?',
    [kelasId]
  )
  if (!existing) return { error: 'Kelas tidak ditemukan.' }

  const tempat = (fields.tempat ?? '').trim()
  const gradeRaw = (fields.grade ?? '').trim().toUpperCase()
  const grade = isKomposisiKelas(gradeRaw) ? gradeRaw : ''
  const baruLama = (fields.baru_lama ?? '').trim().toUpperCase()
  const jenisKelamin = fields.jenis_kelamin ?? 'L'

  await execute(
    'UPDATE kelas SET tempat = ?, grade = ?, baru_lama = ?, jenis_kelamin = ? WHERE id = ?',
    [tempat || null, grade || null, baruLama || null, jenisKelamin, kelasId]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_kelas',
    action: 'update',
    fiturHref: '/dashboard/master/kelas',
    logKind: 'update',
    entityType: 'kelas',
    entityId: kelasId,
    entityLabel: existing.nama_kelas,
    summary: `Update data ruangan kelas ${existing.nama_kelas}`,
    details: { tempat: tempat || null, grade: grade || null, baru_lama: baruLama || null, jenis_kelamin: jenisKelamin },
  })

  revalidatePath('/dashboard/master/kelas')
  return { success: true }
}

export async function copyKelasFromTahunAjaran(sourceTahunAjaranId: number): Promise<{ success: boolean; count: number; skipped: number } | { error: string }> {
  const session = await getSession()
  await ensureKelasExtraColumns()

  const tahunAktif = await queryOne<{ id: number; nama: string }>(
    'SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  )
  if (!tahunAktif) return { error: 'Tidak ada tahun ajaran aktif.' }
  if (Number(sourceTahunAjaranId) === Number(tahunAktif.id)) return { error: 'Tidak bisa copy dari tahun ajaran yang sama.' }

  const sourceKelas = await query<any>(
    `SELECT nama_kelas, marhalah_id, jenis_kelamin, tempat, grade, baru_lama, wali_kelas_id, guru_shubuh_id, guru_ashar_id, guru_maghrib_id
     FROM kelas WHERE tahun_ajaran_id = ?`,
    [sourceTahunAjaranId]
  )
  if (sourceKelas.length === 0) return { error: 'Tidak ada data kelas di tahun ajaran sumber.' }

  const existingClasses = await query<{ nama_kelas: string; marhalah_id: string }>(
    'SELECT nama_kelas, marhalah_id FROM kelas WHERE tahun_ajaran_id = ?',
    [tahunAktif.id]
  )
  const existingSet = new Set(existingClasses.map(c => `${c.nama_kelas.toLowerCase().trim()}-${c.marhalah_id}`))

  const inserts: any[] = []
  let skipped = 0

  for (const k of sourceKelas) {
    const keyCheck = `${String(k.nama_kelas).toLowerCase().trim()}-${k.marhalah_id}`
    if (existingSet.has(keyCheck)) { skipped++; continue }
    inserts.push([
      crypto.randomUUID(), k.nama_kelas, k.marhalah_id, k.jenis_kelamin, k.tempat, k.grade, k.baru_lama,
      k.wali_kelas_id, k.guru_shubuh_id, k.guru_ashar_id, k.guru_maghrib_id, tahunAktif.id,
    ])
    existingSet.add(keyCheck)
  }

  if (inserts.length === 0) return { success: true, count: 0, skipped }

  await batch(inserts.map(row => ({
    sql: `INSERT INTO kelas (id, nama_kelas, marhalah_id, jenis_kelamin, tempat, grade, baru_lama, wali_kelas_id, guru_shubuh_id, guru_ashar_id, guru_maghrib_id, tahun_ajaran_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: row,
  })))

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_kelas',
    action: 'create',
    fiturHref: '/dashboard/master/kelas',
    logKind: 'create',
    entityType: 'kelas_batch',
    entityId: 'copy-tahun-ajaran',
    entityLabel: 'Copy kelas dari tahun ajaran lalu',
    summary: `Copy kelas dari tahun ajaran lalu: ${inserts.length} kelas disalin`,
    details: { inserted: inserts.length, skipped, source_tahun_ajaran_id: sourceTahunAjaranId, target_tahun_ajaran_id: tahunAktif.id },
  })

  revalidatePath('/dashboard/master/kelas')
  return { success: true, count: inserts.length, skipped }
}
