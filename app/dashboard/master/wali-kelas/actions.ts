'use server'

import { query, queryOne, batch, execute } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getCachedDataGuru, getCachedMarhalahList, getCachedTahunAjaranAktif, getCachedTahunAjaranList } from '@/lib/cache/master'
import {
  buildWeeklyGuruRuleMap,
  ensureGuruJadwalSchema,
  getKelasGabunganPengajian,
  getWeeklyGuruRules,
  isPengajianLiburByHariIndex,
  resolveGuruForHariIndex,
  saveKelasGabunganPengajian,
  summarizeWeeklyGuruAssignmentNames,
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
  tahun_ajaran_id: number | null
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
  gabungan?: Partial<Record<GuruJadwalSession, { group_key: string; tempat: string | null }>>
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
  gabungan?: Partial<Record<GuruJadwalSession, { groupKey?: string | null; tempat?: string | null }>>
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
  const gabungan = await getKelasGabunganPengajian(kelas.map(item => item.id))
  const rulesByKelas = new Map<string, WeeklyGuruRule[]>()
  const gabunganByKelas = new Map<string, NonNullable<KelasMasterRow['gabungan']>>()

  for (const rule of rules) {
    if (!rulesByKelas.has(rule.kelas_id)) rulesByKelas.set(rule.kelas_id, [])
    rulesByKelas.get(rule.kelas_id)!.push(rule)
  }
  for (const item of gabungan) {
    const existing = gabunganByKelas.get(item.kelas_id) || {}
    existing[item.sesi] = { group_key: item.group_key, tempat: item.tempat }
    gabunganByKelas.set(item.kelas_id, existing)
  }

  return kelas.map(item => ({
    ...item,
    weekly_rules: rulesByKelas.get(item.id) || [],
    gabungan: gabunganByKelas.get(item.id) || {},
  }))
}

async function getActiveKelasRows() {
  return query<KelasMasterRow>(`
    SELECT
      k.id,
      k.nama_kelas,
      k.tahun_ajaran_id,
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
  const existingGabungan = await getKelasGabunganPengajian(allKelas.map(item => item.id))
  const guruList = await getCachedDataGuru()
  const guruNameMap = new Map<number, string>(guruList.map(guru => [Number(guru.id), guru.nama_lengkap]))
  const kelasMap = new Map(allKelas.map(kelas => [kelas.id, { ...kelas }]))
  const rulesByKelas = new Map<string, WeeklyGuruRule[]>()
  const gabunganByKelas = new Map<string, string>()

  for (const rule of allRules) {
    if (!rulesByKelas.has(rule.kelas_id)) rulesByKelas.set(rule.kelas_id, [])
    rulesByKelas.get(rule.kelas_id)!.push(rule)
  }
  for (const item of existingGabungan) {
    gabunganByKelas.set(`${item.kelas_id}|${item.sesi}`, item.group_key)
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
    for (const sesi of ['shubuh', 'ashar', 'maghrib'] as GuruJadwalSession[]) {
      const groupKey = String(item.gabungan?.[sesi]?.groupKey || '').trim()
      const key = `${item.kelasId}|${sesi}`
      if (groupKey) gabunganByKelas.set(key, groupKey)
      else gabunganByKelas.delete(key)
    }
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

        const gabunganKey = gabunganByKelas.get(`${kelas.id}|${sesi}`)
        const kelasBentrokKey = gabunganKey ? `gabungan:${sesi}:${gabunganKey}` : `kelas:${kelas.id}`
        const key = `${hariIndex}|${sesi}|${resolved.id}`
        const existing = seen.get(key)
        if (existing && existing.kelasId !== kelasBentrokKey) {
          return {
            error: `Bentrok jadwal ${resolved.nama} pada sesi ${sesi} antara kelas ${existing.kelasNama} dan ${kelas.nama_kelas}.`,
          }
        }

        seen.set(key, {
          kelasId: kelasBentrokKey,
          kelasNama: gabunganKey ? `Gabungan ${gabunganKey}` : kelas.nama_kelas,
          guruNama: resolved.nama,
        })
      }
    }
  }

  return null
}

export async function getTahunAjaranList() {
  return getCachedTahunAjaranList()
}

export async function copyGuruJadwalFromTahunAjaran(sourceTahunAjaranId: number): Promise<
  { success: boolean; kelasUpdated: number; jadwalCopied: number; skipped: number; unmatched: number } | { error: string }
> {
  await ensureKelasCetakColumns()
  const session = await getSession()
  const aktif = await getCachedTahunAjaranAktif()
  if (!aktif) return { error: 'Tidak ada tahun ajaran aktif.' }
  if (Number(sourceTahunAjaranId) === Number(aktif.id)) return { error: 'Tidak bisa copy dari tahun ajaran yang sama.' }

  const sourceKelas = await query<{
    id: string; nama_kelas: string; marhalah_id: string | null
    wali_kelas_id: string | null; guru_shubuh_id: number | null; guru_ashar_id: number | null; guru_maghrib_id: number | null
  }>(
    `SELECT id, nama_kelas, marhalah_id, wali_kelas_id, guru_shubuh_id, guru_ashar_id, guru_maghrib_id
     FROM kelas WHERE tahun_ajaran_id = ?`,
    [sourceTahunAjaranId]
  )
  if (sourceKelas.length === 0) return { error: 'Tidak ada data kelas di tahun ajaran sumber.' }

  const targetKelas = await query<{
    id: string; nama_kelas: string; marhalah_id: string | null
    wali_kelas_id: string | null; guru_shubuh_id: number | null; guru_ashar_id: number | null; guru_maghrib_id: number | null
  }>(
    `SELECT id, nama_kelas, marhalah_id, wali_kelas_id, guru_shubuh_id, guru_ashar_id, guru_maghrib_id
     FROM kelas WHERE tahun_ajaran_id = ?`,
    [aktif.id]
  )
  const targetMap = new Map(targetKelas.map(k => [`${k.nama_kelas.toLowerCase().trim()}-${k.marhalah_id}`, k]))

  const kelasUpdateStmts: { sql: string; params: any[] }[] = []
  const kelasIdsToCopyJadwal: { sourceId: string; targetId: string }[] = []
  let unmatched = 0
  let skipped = 0

  for (const src of sourceKelas) {
    const key = `${src.nama_kelas.toLowerCase().trim()}-${src.marhalah_id}`
    const target = targetMap.get(key)
    if (!target) { unmatched++; continue }

    const targetHasGuru = target.wali_kelas_id || target.guru_shubuh_id || target.guru_ashar_id || target.guru_maghrib_id
    if (!targetHasGuru) {
      kelasUpdateStmts.push({
        sql: 'UPDATE kelas SET wali_kelas_id = ?, guru_shubuh_id = ?, guru_ashar_id = ?, guru_maghrib_id = ? WHERE id = ?',
        params: [src.wali_kelas_id, src.guru_shubuh_id, src.guru_ashar_id, src.guru_maghrib_id, target.id],
      })
    } else {
      skipped++
    }

    kelasIdsToCopyJadwal.push({ sourceId: src.id, targetId: target.id })
  }

  if (kelasUpdateStmts.length > 0) await batch(kelasUpdateStmts)

  let jadwalCopied = 0
  if (kelasIdsToCopyJadwal.length > 0) {
    const targetIdsWithRules = new Set(
      (await query<{ kelas_id: string }>(
        `SELECT DISTINCT kelas_id FROM kelas_jadwal_guru_mingguan WHERE kelas_id IN (${kelasIdsToCopyJadwal.map(() => '?').join(',')})`,
        kelasIdsToCopyJadwal.map(x => x.targetId)
      )).map(r => r.kelas_id)
    )

    const sourceIds = kelasIdsToCopyJadwal.map(x => x.sourceId)
    const sourceRules = await query<{ kelas_id: string; sesi: string; hari_index: number; guru_id: number }>(
      `SELECT kelas_id, sesi, hari_index, guru_id FROM kelas_jadwal_guru_mingguan WHERE kelas_id IN (${sourceIds.map(() => '?').join(',')})`,
      sourceIds
    )

    const insertStmts: { sql: string; params: any[] }[] = []
    for (const pair of kelasIdsToCopyJadwal) {
      if (targetIdsWithRules.has(pair.targetId)) continue
      const rulesForKelas = sourceRules.filter(r => r.kelas_id === pair.sourceId)
      for (const rule of rulesForKelas) {
        insertStmts.push({
          sql: `INSERT INTO kelas_jadwal_guru_mingguan (kelas_id, sesi, hari_index, guru_id, updated_at) VALUES (?, ?, ?, ?, datetime('now'))`,
          params: [pair.targetId, rule.sesi, rule.hari_index, rule.guru_id],
        })
      }
    }
    if (insertStmts.length > 0) {
      await batch(insertStmts)
      jadwalCopied = insertStmts.length
    }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_wali_kelas',
    action: 'update',
    fiturHref: '/dashboard/master/wali-kelas',
    logKind: 'update',
    entityType: 'kelas_guru_jadwal_batch',
    entityId: 'copy-tahun-ajaran',
    entityLabel: 'Copy guru & jadwal dari tahun ajaran lalu',
    summary: `Copy guru & jadwal dari tahun ajaran lalu: ${kelasUpdateStmts.length} kelas, ${jadwalCopied} baris jadwal`,
    details: {
      kelas_updated: kelasUpdateStmts.length,
      jadwal_copied: jadwalCopied,
      skipped,
      unmatched,
      source_tahun_ajaran_id: sourceTahunAjaranId,
      target_tahun_ajaran_id: aktif.id,
    },
  })

  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, kelasUpdated: kelasUpdateStmts.length, jadwalCopied, skipped, unmatched }
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
      k.tahun_ajaran_id,
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
      const summary = summarizeWeeklyGuruAssignmentNames(row as any, ruleMap, { separator: '\n' })
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
  const session = await getSession()
  await execute(
    'INSERT INTO data_guru (nama_lengkap, gelar, kode_guru) VALUES (?, ?, ?)',
    [nama, gelar, kode]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_wali_kelas',
    action: 'create',
    fiturHref: '/dashboard/master/wali-kelas',
    logKind: 'create',
    entityType: 'data_guru',
    entityLabel: nama,
    summary: `Menambahkan data guru ${nama}`,
    details: { gelar, kode_guru: kode || null },
  })
  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function hapusGuru(id: number): Promise<{ success: boolean } | { error: string }> {
  await ensureKelasCetakColumns()
  const session = await getSession()
  const guru = await queryOne<{ nama_lengkap: string | null; gelar: string | null; kode_guru: string | null }>(
    'SELECT nama_lengkap, gelar, kode_guru FROM data_guru WHERE id = ?',
    [id]
  )
  if (!guru) return { error: 'Guru tidak ditemukan.' }
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
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_wali_kelas',
    action: 'delete',
    fiturHref: '/dashboard/master/wali-kelas',
    logKind: 'delete',
    entityType: 'data_guru',
    entityId: String(id),
    entityLabel: guru.nama_lengkap || String(id),
    summary: `Menghapus data guru ${guru.nama_lengkap || id}`,
    details: { gelar: guru.gelar, kode_guru: guru.kode_guru },
  })
  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function hapusGuruMassal(ids: number[]): Promise<{ success: boolean; count: number } | { error: string }> {
  await ensureKelasCetakColumns()
  const session = await getSession()
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
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_wali_kelas',
    action: 'delete',
    fiturHref: '/dashboard/master/wali-kelas',
    logKind: 'delete',
    entityType: 'data_guru_batch',
    entityId: 'hapus-massal',
    entityLabel: 'Hapus guru massal',
    summary: `Menghapus ${ids.length} data guru`,
    details: { count: ids.length },
  })
  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: ids.length }
}

export async function importGuruMassal(dataExcel: ImportGuruRow[]): Promise<{ success: boolean; count: number; skipped: number } | { error: string }> {
  const session = await getSession()
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

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_wali_kelas',
    action: 'create',
    fiturHref: '/dashboard/master/wali-kelas',
    logKind: 'create',
    entityType: 'data_guru_batch',
    entityId: 'import',
    entityLabel: 'Import guru massal',
    summary: `Import guru massal: ${toInsert.length} ditambahkan`,
    details: { count: toInsert.length, skipped },
  })

  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: toInsert.length, skipped }
}

export async function simpanJadwalBatch(
  payload: SimpanJadwalPayload[]
): Promise<{ success: boolean; count: number } | { error: string }> {
  await ensureKelasCetakColumns()
  const session = await getSession()
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
    if (weeklyRules.length > 0) {
      await batch(weeklyRules.map(rule => ({
        sql: `
          INSERT INTO kelas_jadwal_guru_mingguan (kelas_id, sesi, hari_index, guru_id, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `,
        params: [item.kelasId, rule.sesi, rule.hariIndex, Number(rule.guruId)],
      })))
    }

    const kelas = await queryOne<{ tahun_ajaran_id: number | null }>(
      'SELECT tahun_ajaran_id FROM kelas WHERE id = ?',
      [item.kelasId]
    )
    await saveKelasGabunganPengajian(
      item.kelasId,
      kelas?.tahun_ajaran_id ?? null,
      (['shubuh', 'ashar', 'maghrib'] as GuruJadwalSession[]).map(sesi => ({
        sesi,
        groupKey: item.gabungan?.[sesi]?.groupKey || null,
        tempat: item.gabungan?.[sesi]?.tempat || null,
      }))
    )
  }

  revalidatePath('/dashboard/master/wali-kelas')
  revalidatePath('/dashboard/master/wali-kelas/cetak')
  revalidatePath('/dashboard/akademik/absensi-guru')
  revalidatePath('/dashboard/akademik/absensi-guru/rekap')
  revalidatePath('/dashboard/akademik/absensi/cetak-blanko')
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_wali_kelas',
    action: 'update',
    fiturHref: '/dashboard/master/wali-kelas',
    logKind: 'update',
    entityType: 'kelas_batch',
    entityId: 'jadwal-batch',
    entityLabel: 'Jadwal wali kelas',
    summary: `Memperbarui jadwal mengajar ${payload.length} kelas`,
    details: { count: payload.length },
  })
  return { success: true, count: payload.length }
}

export async function setWaliKelas(kelasId: string, userId: string | null) {
  await ensureKelasCetakColumns()
  const session = await getSession()
  await execute('UPDATE kelas SET wali_kelas_id = ? WHERE id = ?', [userId, kelasId])
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_wali_kelas',
    action: 'update',
    fiturHref: '/dashboard/master/wali-kelas',
    logKind: 'update',
    entityType: 'kelas',
    entityId: kelasId,
    entityLabel: kelasId,
    summary: 'Memperbarui wali kelas',
    details: { user_id: userId },
  })
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
  const session = await getSession()
  await execute(
    'UPDATE kelas SET guru_shubuh_id = ?, guru_ashar_id = ?, guru_maghrib_id = ? WHERE id = ?',
    [guruShubuhId, guruAsharId, guruMaghribId, kelasId]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_wali_kelas',
    action: 'update',
    fiturHref: '/dashboard/master/wali-kelas',
    logKind: 'update',
    entityType: 'kelas',
    entityId: kelasId,
    entityLabel: kelasId,
    summary: 'Memperbarui guru kelas',
    details: {
      guru_shubuh_id: guruShubuhId,
      guru_ashar_id: guruAsharId,
      guru_maghrib_id: guruMaghribId,
    },
  })
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
  const session = await getSession()
  const guru = await queryOne<{ id: number; nama_lengkap: string }>('SELECT id, nama_lengkap FROM data_guru WHERE id = ?', [guruId])
  if (!guru) return { error: 'Data guru tidak ditemukan.' }

  const email = generateEmail(guru.nama_lengkap)
  const existing = await queryOne<{ id: string; role: string; roles: string | null; source_type: string | null; source_ref_id: string | null }>(
    'SELECT id, role, roles, source_type, source_ref_id FROM users WHERE email = ?',
    [email]
  )
  if (existing) {
    let roles = [existing.role]
    try {
      if (existing.roles) {
        const parsed = JSON.parse(existing.roles)
        if (Array.isArray(parsed) && parsed.length > 0) roles = parsed
      }
    } catch {}
    if (!roles.includes('guru')) roles.push('guru')
    await execute(
      `UPDATE users
       SET roles = ?,
           source_type = CASE WHEN source_type IS NULL AND source_ref_id IS NULL THEN 'guru' ELSE source_type END,
           source_ref_id = CASE WHEN source_type IS NULL AND source_ref_id IS NULL THEN ? ELSE source_ref_id END,
           updated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(roles), String(guru.id), existing.id]
    )
    return { success: true, email }
  }

  const hashed = await hashPassword('eskahade2026')
  await execute(
    `INSERT INTO users (id, email, password_hash, full_name, role, roles, source_type, source_ref_id)
     VALUES (?, ?, ?, ?, 'guru', ?, 'guru', ?)`,
    [crypto.randomUUID(), email, hashed, guru.nama_lengkap, JSON.stringify(['guru']), String(guru.id)]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_wali_kelas',
    action: 'create',
    fiturHref: '/dashboard/master/wali-kelas',
    logKind: 'create',
    entityType: 'user',
    entityLabel: guru.nama_lengkap,
    summary: `Membuat akun guru otomatis untuk ${guru.nama_lengkap}`,
    details: { email, guru_id: guruId },
  })

  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, email }
}
