'use server'

import { query, queryOne, batch, execute } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getCachedDataGuru, getCachedMarhalahList } from '@/lib/cache/master'
import {
  buildWeeklyGuruRuleMap,
  ensureGuruJadwalSchema,
  getWeeklyGuruRules,
  isPengajianLiburByHariIndex,
  resolveGuruForHariIndex,
  summarizeWeeklyGuruAssignments,
  type GuruJadwalSession,
  type WeeklyGuruRule,
} from '@/lib/akademik/guru-jadwal'

function generateEmail(name: string) {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${cleanName}@sukahideng.or.id`
}

type KelasMasterRow = {
  id: string
  nama_kelas: string
  marhalah_nama: string | null
  guru_shubuh_id: number | null
  guru_shubuh_nama: string | null
  guru_ashar_id: number | null
  guru_ashar_nama: string | null
  guru_maghrib_id: number | null
  guru_maghrib_nama: string | null
  wali_kelas_id: string | null
  wali_kelas_nama: string | null
  weekly_rules?: WeeklyGuruRule[]
}

type ImportGuruRow = Record<string, unknown>

type WeeklyRuleInput = {
  sesi: GuruJadwalSession
  hariIndex: number
  guruId: number | null
}

type SimpanJadwalPayload = {
  kelasId: string
  waliKelasId: string | null
  shubuhId: number | null
  asharId: number | null
  maghribId: number | null
  weeklyRules: WeeklyRuleInput[]
}

async function ensureKelasCetakColumns() {
  await ensureGuruJadwalSchema()

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

function getJenjangDominan(row: {
  jumlah_sltp: number
  jumlah_slta: number
  jumlah_kuliah: number
  jumlah_tidak_sekolah: number
}) {
  const options = [
    { label: 'SLTP', value: Number(row.jumlah_sltp || 0) },
    { label: 'SLTA', value: Number(row.jumlah_slta || 0) },
    { label: 'KULIAH', value: Number(row.jumlah_kuliah || 0) },
    { label: 'TIDAK SEKOLAH', value: Number(row.jumlah_tidak_sekolah || 0) },
  ].sort((a, b) => b.value - a.value)

  return options[0]?.value ? options[0].label : '-'
}

function normalizeGuruId(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function sanitizeWeeklyRules(rules: WeeklyRuleInput[]) {
  const unique = new Map<string, WeeklyRuleInput>()

  for (const rule of rules || []) {
    if (!rule) continue
    if (!['shubuh', 'ashar', 'maghrib'].includes(rule.sesi)) continue
    if (!Number.isInteger(rule.hariIndex) || rule.hariIndex < 0 || rule.hariIndex > 6) continue

    const guruId = normalizeGuruId(rule.guruId)
    if (!guruId) continue

    unique.set(`${rule.sesi}|${rule.hariIndex}`, {
      sesi: rule.sesi,
      hariIndex: rule.hariIndex,
      guruId,
    })
  }

  return Array.from(unique.values()).sort((a, b) => {
    if (a.sesi === b.sesi) return a.hariIndex - b.hariIndex
    return ['shubuh', 'ashar', 'maghrib'].indexOf(a.sesi) - ['shubuh', 'ashar', 'maghrib'].indexOf(b.sesi)
  })
}

async function attachWeeklyRules<T extends KelasMasterRow>(kelas: T[]) {
  const rules = await getWeeklyGuruRules(kelas.map(item => item.id))
  const rulesByKelas = new Map<string, WeeklyGuruRule[]>()

  for (const rule of rules) {
    if (!rulesByKelas.has(rule.kelas_id)) rulesByKelas.set(rule.kelas_id, [])
    rulesByKelas.get(rule.kelas_id)!.push(rule)
  }

  return kelas.map(item => ({
    ...item,
    weekly_rules: rulesByKelas.get(item.id) || [],
  }))
}

async function getActiveKelasRows() {
  return query<KelasMasterRow>(`
    SELECT
      k.id,
      k.nama_kelas,
      m.nama as marhalah_nama,
      gs.id as guru_shubuh_id,
      gs.nama_lengkap as guru_shubuh_nama,
      ga.id as guru_ashar_id,
      ga.nama_lengkap as guru_ashar_nama,
      gm.id as guru_maghrib_id,
      gm.nama_lengkap as guru_maghrib_nama,
      k.wali_kelas_id,
      u.full_name as wali_kelas_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN data_guru gs ON k.guru_shubuh_id = gs.id
    LEFT JOIN data_guru ga ON k.guru_ashar_id = ga.id
    LEFT JOIN data_guru gm ON k.guru_maghrib_id = gm.id
    LEFT JOIN users u ON k.wali_kelas_id = u.id
  `)
}

async function validateWeeklyGuruConflicts(payload: SimpanJadwalPayload[]) {
  const allKelas = await getActiveKelasRows()
  const allRules = await getWeeklyGuruRules(allKelas.map(item => item.id))
  const guruList = await getCachedDataGuru()
  const guruNameMap = new Map<number, string>(guruList.map(guru => [Number(guru.id), guru.nama_lengkap]))
  const kelasMap = new Map(allKelas.map(kelas => [kelas.id, { ...kelas }]))
  const rulesByKelas = new Map<string, WeeklyGuruRule[]>()

  for (const rule of allRules) {
    if (!rulesByKelas.has(rule.kelas_id)) rulesByKelas.set(rule.kelas_id, [])
    rulesByKelas.get(rule.kelas_id)!.push(rule)
  }

  for (const item of payload) {
    const kelas = kelasMap.get(item.kelasId)
    if (!kelas) continue

    kelas.guru_shubuh_id = normalizeGuruId(item.shubuhId)
    kelas.guru_ashar_id = normalizeGuruId(item.asharId)
    kelas.guru_maghrib_id = normalizeGuruId(item.maghribId)
    kelas.guru_shubuh_nama = kelas.guru_shubuh_id ? guruNameMap.get(kelas.guru_shubuh_id) || null : null
    kelas.guru_ashar_nama = kelas.guru_ashar_id ? guruNameMap.get(kelas.guru_ashar_id) || null : null
    kelas.guru_maghrib_nama = kelas.guru_maghrib_id ? guruNameMap.get(kelas.guru_maghrib_id) || null : null
    rulesByKelas.set(
      item.kelasId,
      sanitizeWeeklyRules(item.weeklyRules).map(rule => ({
        kelas_id: item.kelasId,
        sesi: rule.sesi,
        hari_index: rule.hariIndex,
        guru_id: Number(rule.guruId),
        guru_nama: guruNameMap.get(Number(rule.guruId)) || null,
      }))
    )
  }

  const mergedRules = Array.from(rulesByKelas.entries()).flatMap(([kelasId, rules]) =>
    rules.map(rule => ({ ...rule, kelas_id: kelasId }))
  )
  const ruleMap = buildWeeklyGuruRuleMap(mergedRules)
  const seen = new Map<string, { kelasId: string; kelasNama: string; guruNama: string }>()

  for (const kelas of kelasMap.values()) {
    for (const sesi of ['shubuh', 'ashar', 'maghrib'] as GuruJadwalSession[]) {
      for (let hariIndex = 0; hariIndex <= 6; hariIndex += 1) {
        if (isPengajianLiburByHariIndex(hariIndex, sesi)) continue

        const resolved = resolveGuruForHariIndex(kelas, hariIndex, ruleMap)[sesi]
        if (!resolved.id || !resolved.nama) continue

        const key = `${hariIndex}|${sesi}|${resolved.id}`
        const existing = seen.get(key)
        if (existing && existing.kelasId !== kelas.id) {
          return {
            error: `Bentrok jadwal ${resolved.nama} pada sesi ${sesi} antara kelas ${existing.kelasNama} dan ${kelas.nama_kelas}.`,
          }
        }

        seen.set(key, {
          kelasId: kelas.id,
          kelasNama: kelas.nama_kelas,
          guruNama: resolved.nama,
        })
      }
    }
  }

  return null
}

export async function getDataMaster() {
  await ensureKelasCetakColumns()

  const kelas = await attachWeeklyRules(await getActiveKelasRows())
  const guru = await getCachedDataGuru()

  const sortedKelas = kelas.sort((a, b) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )

  return { kelasList: sortedKelas, guruList: guru }
}

export async function getJadwalFilterOptions() {
  await ensureKelasCetakColumns()
  const [guru, marhalah, waliUsers] = await Promise.all([
    getCachedDataGuru(),
    getCachedMarhalahList(),
    getUsersForWaliKelas(),
  ])
  return { guruList: guru, marhalahList: marhalah, waliUserList: waliUsers }
}

export async function getKelasJadwalByMarhalah(marhalahId: string) {
  await ensureKelasCetakColumns()

  const params: unknown[] = []
  const marhalahClause =
    marhalahId && marhalahId !== 'SEMUA'
      ? (params.push(Number(marhalahId)), 'AND k.marhalah_id = ?')
      : ''

  const kelas = await query<KelasMasterRow>(`
    SELECT
      k.id,
      k.nama_kelas,
      m.nama as marhalah_nama,
      gs.id as guru_shubuh_id,
      gs.nama_lengkap as guru_shubuh_nama,
      ga.id as guru_ashar_id,
      ga.nama_lengkap as guru_ashar_nama,
      gm.id as guru_maghrib_id,
      gm.nama_lengkap as guru_maghrib_nama,
      k.wali_kelas_id,
      u.full_name as wali_kelas_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN data_guru gs ON k.guru_shubuh_id = gs.id
    LEFT JOIN data_guru ga ON k.guru_ashar_id = ga.id
    LEFT JOIN data_guru gm ON k.guru_maghrib_id = gm.id
    LEFT JOIN users u ON k.wali_kelas_id = u.id
    WHERE 1=1 ${marhalahClause}
  `, params)

  const withRules = await attachWeeklyRules(kelas)

  return withRules.sort((a, b) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export type PembagianTugasMengajarRow = {
  id: string
  nama_kelas: string
  marhalah_nama: string | null
  tahun_ajaran_nama: string
  tempat: string | null
  grade: string | null
  baru_lama: string | null
  jenis_kelamin: string
  guru_shubuh_nama: string | null
  guru_ashar_nama: string | null
  guru_maghrib_nama: string | null
  total_putra: number
  total_putri: number
  total_santri: number
  jumlah_sltp: number
  jumlah_slta: number
  jumlah_kuliah: number
  jumlah_tidak_sekolah: number
  tingkat_label: string
  lp_label: string
  bl_label: string
}

export async function getPembagianTugasMengajarData() {
  await ensureKelasCetakColumns()
  const rows = await query<Omit<PembagianTugasMengajarRow, 'tingkat_label' | 'lp_label' | 'bl_label'>>(`
    SELECT
      k.id,
      k.nama_kelas,
      m.nama as marhalah_nama,
      ta.nama as tahun_ajaran_nama,
      k.tempat,
      k.grade,
      k.baru_lama,
      k.jenis_kelamin,
      gs.nama_lengkap as guru_shubuh_nama,
      ga.nama_lengkap as guru_ashar_nama,
      gm.nama_lengkap as guru_maghrib_nama,
      k.guru_shubuh_id,
      k.guru_ashar_id,
      k.guru_maghrib_id,
      SUM(CASE WHEN s.status_global = 'aktif' AND s.jenis_kelamin = 'L' THEN 1 ELSE 0 END) as total_putra,
      SUM(CASE WHEN s.status_global = 'aktif' AND s.jenis_kelamin = 'P' THEN 1 ELSE 0 END) as total_putri,
      SUM(CASE WHEN s.status_global = 'aktif' THEN 1 ELSE 0 END) as total_santri,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND (s.kategori_santri = 'SADESA'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%MTS%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%SMP%')
        THEN 1 ELSE 0 END) as jumlah_sltp,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND (UPPER(COALESCE(s.sekolah, '')) LIKE '%MA%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%SMA%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%SMK%')
        THEN 1 ELSE 0 END) as jumlah_slta,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND (UPPER(COALESCE(s.sekolah, '')) LIKE '%KULIAH%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%UNIVERSITAS%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%ST%')
        THEN 1 ELSE 0 END) as jumlah_kuliah,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND COALESCE(TRIM(s.sekolah), '') = ''
        THEN 1 ELSE 0 END) as jumlah_tidak_sekolah
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN data_guru gs ON k.guru_shubuh_id = gs.id
    LEFT JOIN data_guru ga ON k.guru_ashar_id = ga.id
    LEFT JOIN data_guru gm ON k.guru_maghrib_id = gm.id
    LEFT JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN santri s ON s.id = rp.santri_id
    GROUP BY
      k.id, k.nama_kelas, m.nama, ta.nama, k.tempat, k.grade, k.baru_lama, k.jenis_kelamin,
      gs.nama_lengkap, ga.nama_lengkap, gm.nama_lengkap, k.guru_shubuh_id, k.guru_ashar_id, k.guru_maghrib_id
  `)

  const rules = await getWeeklyGuruRules(rows.map(row => row.id))
  const ruleMap = buildWeeklyGuruRuleMap(rules)

  return rows
    .map((row) => {
      const summary = summarizeWeeklyGuruAssignments(row as any, ruleMap)
      return {
        ...row,
        guru_shubuh_nama: summary.shubuh,
        guru_ashar_nama: summary.ashar,
        guru_maghrib_nama: summary.maghrib,
        tingkat_label: getJenjangDominan(row),
        lp_label: row.jenis_kelamin === 'L' ? 'Pa' : row.jenis_kelamin === 'P' ? 'Pi' : 'C',
        bl_label: row.baru_lama || '-',
      }
    })
    .sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' }))
}

export async function tambahGuruManual(nama: string, gelar: string, kode: string): Promise<{ success: boolean } | { error: string }> {
  await execute(
    'INSERT INTO data_guru (nama_lengkap, gelar, kode_guru) VALUES (?, ?, ?)',
    [nama, gelar, kode]
  )
  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function hapusGuru(id: number): Promise<{ success: boolean } | { error: string }> {
  await ensureKelasCetakColumns()
  const used = await queryOne<{ id: string }>(
    `
      SELECT id
      FROM kelas
      WHERE guru_shubuh_id = ? OR guru_ashar_id = ? OR guru_maghrib_id = ?
      LIMIT 1
    `,
    [id, id, id]
  )
  if (used) return { error: 'Guru ini masih terdaftar sebagai pengajar default di salah satu kelas.' }

  const usedInWeeklyRule = await queryOne<{ id: number }>(
    'SELECT id FROM kelas_jadwal_guru_mingguan WHERE guru_id = ? LIMIT 1',
    [id]
  )
  if (usedInWeeklyRule) return { error: 'Guru ini masih dipakai pada pembagian jadwal mingguan.' }

  await execute('DELETE FROM data_guru WHERE id = ?', [id])
  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function hapusGuruMassal(ids: number[]): Promise<{ success: boolean; count: number } | { error: string }> {
  await ensureKelasCetakColumns()
  if (!ids.length) return { error: 'Tidak ada data.' }
  const placeholders = ids.map(() => '?').join(',')
  const usedCheck = await query<{ id: string }>(
    `SELECT id FROM kelas WHERE guru_shubuh_id IN (${placeholders}) OR guru_ashar_id IN (${placeholders}) OR guru_maghrib_id IN (${placeholders}) LIMIT 1`,
    [...ids, ...ids, ...ids]
  )
  if (usedCheck.length > 0) return { error: 'Beberapa guru masih terdaftar sebagai pengajar default aktif di kelas.' }

  const usedInWeeklyRule = await query<{ id: number }>(
    `SELECT id FROM kelas_jadwal_guru_mingguan WHERE guru_id IN (${placeholders}) LIMIT 1`,
    ids
  )
  if (usedInWeeklyRule.length > 0) return { error: 'Beberapa guru masih dipakai pada pembagian jadwal mingguan.' }

  await execute(`DELETE FROM data_guru WHERE id IN (${placeholders})`, ids)
  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: ids.length }
}

export async function importGuruMassal(dataExcel: ImportGuruRow[]): Promise<{ success: boolean; count: number; skipped: number } | { error: string }> {
  if (!dataExcel.length) return { error: 'Data kosong.' }

  const existing = await query<{ nama_lengkap: string }>('SELECT nama_lengkap FROM data_guru')
  const existingNames = new Set(existing.map(g => g.nama_lengkap.toLowerCase().trim()))

  const toInsert: [string, string, string][] = []
  let skipped = 0

  for (const row of dataExcel) {
    const nama = String(row['NAMA'] || row['NAMA LENGKAP'] || row['nama'] || '').trim()
    const gelar = String(row['GELAR'] || row['gelar'] || '').trim()
    const kode = String(row['KODE'] || row['kode'] || '').trim()
    if (!nama) { skipped += 1; continue }
    if (existingNames.has(nama.toLowerCase())) { skipped += 1; continue }
    toInsert.push([nama, gelar, kode])
    existingNames.add(nama.toLowerCase())
  }

  if (!toInsert.length) return { error: `Semua data dilewati (${skipped} duplikat atau kosong).` }

  await batch(toInsert.map(row => ({
    sql: 'INSERT INTO data_guru (nama_lengkap, gelar, kode_guru) VALUES (?, ?, ?)',
    params: row,
  })))

  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: toInsert.length, skipped }
}

export async function simpanJadwalBatch(
  payload: SimpanJadwalPayload[]
): Promise<{ success: boolean; count: number } | { error: string }> {
  await ensureKelasCetakColumns()
  if (!payload.length) return { error: 'Tidak ada data.' }

  const validation = await validateWeeklyGuruConflicts(payload)
  if (validation?.error) return validation

  const kelasUpdates = payload.map(item => ({
    sql: `
      UPDATE kelas
      SET guru_shubuh_id = ?, guru_ashar_id = ?, guru_maghrib_id = ?, wali_kelas_id = ?
      WHERE id = ?
    `,
    params: [
      normalizeGuruId(item.shubuhId),
      normalizeGuruId(item.asharId),
      normalizeGuruId(item.maghribId),
      item.waliKelasId || null,
      item.kelasId,
    ],
  }))
  await batch(kelasUpdates)

  for (const item of payload) {
    await execute('DELETE FROM kelas_jadwal_guru_mingguan WHERE kelas_id = ?', [item.kelasId])
    const weeklyRules = sanitizeWeeklyRules(item.weeklyRules)
    if (weeklyRules.length === 0) continue

    await batch(weeklyRules.map(rule => ({
      sql: `
        INSERT INTO kelas_jadwal_guru_mingguan (kelas_id, sesi, hari_index, guru_id, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `,
      params: [item.kelasId, rule.sesi, rule.hariIndex, Number(rule.guruId)],
    })))
  }

  revalidatePath('/dashboard/master/wali-kelas')
  revalidatePath('/dashboard/master/wali-kelas/cetak')
  revalidatePath('/dashboard/akademik/absensi-guru')
  revalidatePath('/dashboard/akademik/absensi-guru/rekap')
  revalidatePath('/dashboard/akademik/absensi/cetak-blanko')
  return { success: true, count: payload.length }
}

export async function setWaliKelas(kelasId: string, userId: string | null) {
  await ensureKelasCetakColumns()
  await execute('UPDATE kelas SET wali_kelas_id = ? WHERE id = ?', [userId, kelasId])
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function setGuruKelas(
  kelasId: string,
  guruShubuhId: string | null,
  guruAsharId: string | null,
  guruMaghribId: string | null
) {
  await ensureKelasCetakColumns()
  await execute(
    'UPDATE kelas SET guru_shubuh_id = ?, guru_ashar_id = ?, guru_maghrib_id = ? WHERE id = ?',
    [guruShubuhId, guruAsharId, guruMaghribId, kelasId]
  )
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function getUsersForWaliKelas() {
  return query<{ id: string; full_name: string | null }>(`
    SELECT id, full_name
    FROM users
    WHERE role IN ('wali_kelas', 'sekpen')
       OR EXISTS (
         SELECT 1
         FROM json_each(COALESCE(users.roles, '[]'))
         WHERE value IN ('wali_kelas', 'sekpen')
       )
    ORDER BY full_name
  `)
}

export async function buatAkunGuruOtomatis(guruId: number): Promise<{ success: boolean; email?: string } | { error: string }> {
  const guru = await queryOne<{ id: number; nama_lengkap: string }>('SELECT id, nama_lengkap FROM data_guru WHERE id = ?', [guruId])
  if (!guru) return { error: 'Data guru tidak ditemukan.' }

  const email = generateEmail(guru.nama_lengkap)
  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email])
  if (existing) return { error: `Akun dengan email ${email} sudah ada.` }

  const hashed = await hashPassword('sukahideng123')
  await execute(
    "INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'wali_kelas')",
    [crypto.randomUUID(), email, hashed, guru.nama_lengkap]
  )

  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, email }
}
