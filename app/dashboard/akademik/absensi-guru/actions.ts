'use server'

import { query, batch, generateId, execute, now } from '@/lib/db'
import { getCachedMarhalahList } from '@/lib/cache/master'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import {
  buildWeekSchedule,
  buildGabunganByKelas,
  buildGabunganMembersByGroup,
  buildWeeklyGuruRuleMap,
  ensureGuruJadwalSchema,
  getKelasGabunganPengajian,
  getWeeklyGuruRules,
  resolveGuruForDate,
  type GuruJadwalSession,
} from '@/lib/akademik/guru-jadwal'

const VALID_SESI = ['shubuh', 'ashar', 'maghrib'] as const
type SessionType = typeof VALID_SESI[number]
type GuruStatusImport = 'H' | 'A' | 'B' | 'L'

export type AbsensiGuruImportCell = {
  sheet: string
  row: number
  kelasName: string
  guruName: string
  waktu: string
  tanggal: string
  sesi: SessionType
  status: GuruStatusImport
}

export type AbsensiGuruImportMappings = {
  kelas?: Record<string, string>
  guru?: Record<string, number | string>
}

type ImportIssue = {
  sheet?: string
  row?: number
  kelasName?: string
  guruName?: string
  tanggal?: string
  sesi?: SessionType
  message: string
}

type ImportOption = {
  id: string
  label: string
}

type ImportGroup = {
  kelasId: string
  kelasName: string
  tanggal: string
  shubuh: GuruStatusImport
  ashar: GuruStatusImport
  maghrib: GuruStatusImport
  guru_shubuh_id_snapshot: number | null
  guru_shubuh_nama_snapshot: string | null
  guru_ashar_id_snapshot: number | null
  guru_ashar_nama_snapshot: string | null
  guru_maghrib_id_snapshot: number | null
  guru_maghrib_nama_snapshot: string | null
}

type ImportBuildResult = {
  groups: ImportGroup[]
  statusCounts: Record<GuruStatusImport, number>
  matchedGuruCells: number
  unmatchedGuruCells: number
  unmatchedKelas: ImportIssue[]
  unmatchedGuru: ImportIssue[]
  conflicts: ImportIssue[]
  duplicateKelas: string[]
  kelasOptions: ImportOption[]
  guruOptions: ImportOption[]
}

function emptyResolvedGuru() {
  return {
    shubuh: { id: null, nama: null, source: 'default' },
    ashar: { id: null, nama: null, source: 'default' },
    maghrib: { id: null, nama: null, source: 'default' },
  }
}

async function ensureLiburPengajianTable() {
  await ensureGuruJadwalSchema()
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS pengajian_libur_sesi (
        tanggal    TEXT NOT NULL,
        sesi       TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (tanggal, sesi)
      )
    `)
    await execute(`
      CREATE INDEX IF NOT EXISTS idx_pengajian_libur_sesi_tanggal
      ON pengajian_libur_sesi(tanggal, sesi)
    `)
    await execute(`
      CREATE INDEX IF NOT EXISTS idx_absensi_guru_tanggal_kelas
      ON absensi_guru(tanggal, kelas_id)
    `)
    await execute(`
      CREATE INDEX IF NOT EXISTS idx_riwayat_kelas_status_santri
      ON riwayat_pendidikan(kelas_id, status_riwayat, santri_id)
    `)
  } catch {
    // noop
  }
}

function normalizeLookupKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[`\u2018\u2019']/g, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
}

function kelasLookupKeys(value: unknown) {
  const base = normalizeLookupKey(value)
  const keys = new Set<string>()
  if (base) keys.add(base)

  const match = base.match(/(?:^|\s)(\d+)\s*-\s*0*(\d+)\s*$/)
  if (match) {
    const tingkat = Number(match[1])
    const rombel = Number(match[2])
    if (Number.isFinite(tingkat) && Number.isFinite(rombel)) {
      keys.add(`${tingkat}-${rombel}`)
      keys.add(`${tingkat}-${String(rombel).padStart(2, '0')}`)
      keys.add(`ibtidaiyyah ${tingkat}-${rombel}`)
      keys.add(`ibtidaiyyah ${tingkat}-${String(rombel).padStart(2, '0')}`)
    }
  }

  return Array.from(keys)
}

function normalizeImportStatus(value: unknown): GuruStatusImport {
  const status = String(value || 'H').trim().toUpperCase()
  return status === 'A' || status === 'B' || status === 'L' ? status : 'H'
}

function sessionSnapshotFields(sessionName: SessionType) {
  if (sessionName === 'shubuh') {
    return {
      idField: 'guru_shubuh_id_snapshot' as const,
      nameField: 'guru_shubuh_nama_snapshot' as const,
    }
  }
  if (sessionName === 'ashar') {
    return {
      idField: 'guru_ashar_id_snapshot' as const,
      nameField: 'guru_ashar_nama_snapshot' as const,
    }
  }
  return {
    idField: 'guru_maghrib_id_snapshot' as const,
    nameField: 'guru_maghrib_nama_snapshot' as const,
  }
}

async function buildAbsensiGuruImport(
  cells: AbsensiGuruImportCell[],
  mappings: AbsensiGuruImportMappings = {}
): Promise<ImportBuildResult> {
  await ensureLiburPengajianTable()

  const cleanCells = cells
    .map(cell => ({
      ...cell,
      kelasName: String(cell.kelasName || '').trim(),
      guruName: String(cell.guruName || '').trim(),
      waktu: String(cell.waktu || '').trim(),
      status: normalizeImportStatus(cell.status),
    }))
    .filter(cell =>
      cell.kelasName &&
      cell.guruName &&
      cell.tanggal &&
      VALID_SESI.includes(cell.sesi)
    )

  const kelasRows = await query<any>(`
    SELECT k.id, k.nama_kelas, COALESCE(ta.is_active, 0) AS is_active
    FROM kelas k
    LEFT JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id
    ORDER BY COALESCE(ta.is_active, 0) DESC, k.nama_kelas
  `)
  const guruRows = await query<any>(`
    SELECT id, nama_lengkap
    FROM data_guru
    ORDER BY nama_lengkap
  `)

  const kelasById = new Map<string, any>()
  const kelasMap = new Map<string, any[]>()
  kelasRows.forEach(row => {
    kelasById.set(String(row.id), row)
    kelasLookupKeys(row.nama_kelas).forEach(key => {
      kelasMap.set(key, [...(kelasMap.get(key) || []), row])
    })
  })

  const guruById = new Map<string, any>()
  const guruMap = new Map<string, any>()
  guruRows.forEach(row => {
    guruById.set(String(row.id), row)
    const key = normalizeLookupKey(row.nama_lengkap)
    if (!key || guruMap.has(key)) return
    guruMap.set(key, row)
  })

  const statusCounts: Record<GuruStatusImport, number> = { H: 0, A: 0, B: 0, L: 0 }
  const unmatchedKelasMap = new Map<string, ImportIssue>()
  const unmatchedGuruMap = new Map<string, ImportIssue>()
  const conflicts: ImportIssue[] = []
  const duplicateKelas = Array.from(kelasMap.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([, rows]) => rows.map(row => row.nama_kelas).join(' / '))
    .slice(0, 30)

  const groups = new Map<string, ImportGroup>()
  const assignedStatus = new Map<string, GuruStatusImport>()
  const assignedTeacher = new Map<string, string>()
  let matchedGuruCells = 0
  let unmatchedGuruCells = 0

  for (const cell of cleanCells) {
    statusCounts[cell.status] += 1
    const mappedKelasId = mappings.kelas?.[cell.kelasName]
    const kelas = mappedKelasId
      ? kelasById.get(String(mappedKelasId))
      : kelasLookupKeys(cell.kelasName)
          .flatMap(key => kelasMap.get(key) || [])
          .find(Boolean)
    if (!kelas) {
      const key = cell.kelasName
      if (!unmatchedKelasMap.has(key)) {
        unmatchedKelasMap.set(key, {
          sheet: cell.sheet,
          row: cell.row,
          kelasName: cell.kelasName,
          message: `Kelas "${cell.kelasName}" tidak ditemukan di Master Kelas.`,
        })
      }
      continue
    }

    const groupKey = `${kelas.id}|${cell.tanggal}`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        kelasId: String(kelas.id),
        kelasName: String(kelas.nama_kelas || cell.kelasName),
        tanggal: cell.tanggal,
        shubuh: 'H',
        ashar: 'H',
        maghrib: 'H',
        guru_shubuh_id_snapshot: null,
        guru_shubuh_nama_snapshot: null,
        guru_ashar_id_snapshot: null,
        guru_ashar_nama_snapshot: null,
        guru_maghrib_id_snapshot: null,
        guru_maghrib_nama_snapshot: null,
      })
    }

    const group = groups.get(groupKey)!
    const statusKey = `${groupKey}|${cell.sesi}`
    const existingStatus = assignedStatus.get(statusKey)
    if (existingStatus && existingStatus !== cell.status) {
      conflicts.push({
        sheet: cell.sheet,
        row: cell.row,
        kelasName: cell.kelasName,
        guruName: cell.guruName,
        tanggal: cell.tanggal,
        sesi: cell.sesi,
        message: `Konflik status ${cell.sesi} ${cell.tanggal} untuk ${cell.kelasName}: ${existingStatus} vs ${cell.status}.`,
      })
      continue
    }
    const existingTeacher = assignedTeacher.get(statusKey)
    if (existingTeacher && normalizeLookupKey(existingTeacher) !== normalizeLookupKey(cell.guruName)) {
      conflicts.push({
        sheet: cell.sheet,
        row: cell.row,
        kelasName: cell.kelasName,
        guruName: cell.guruName,
        tanggal: cell.tanggal,
        sesi: cell.sesi,
        message: `Konflik guru ${cell.sesi} ${cell.tanggal} untuk ${cell.kelasName}: ${existingTeacher} vs ${cell.guruName}.`,
      })
      continue
    }
    assignedStatus.set(statusKey, cell.status)
    assignedTeacher.set(statusKey, cell.guruName)
    group[cell.sesi] = cell.status

    const mappedGuruId = mappings.guru?.[cell.guruName]
    const guru = mappedGuruId
      ? guruById.get(String(mappedGuruId))
      : guruMap.get(normalizeLookupKey(cell.guruName))
    const fields = sessionSnapshotFields(cell.sesi)
    if (guru?.id) {
      matchedGuruCells += 1
      group[fields.idField] = Number(guru.id)
      group[fields.nameField] = String(guru.nama_lengkap || cell.guruName)
    } else {
      unmatchedGuruCells += 1
      group[fields.nameField] = cell.guruName
      const key = cell.guruName
      if (!unmatchedGuruMap.has(key)) {
        unmatchedGuruMap.set(key, {
          sheet: cell.sheet,
          row: cell.row,
          guruName: cell.guruName,
          kelasName: cell.kelasName,
          message: `Guru "${cell.guruName}" belum cocok dengan Data Guru.`,
        })
      }
    }
  }

  return {
    groups: Array.from(groups.values()),
    statusCounts,
    matchedGuruCells,
    unmatchedGuruCells,
    unmatchedKelas: Array.from(unmatchedKelasMap.values()),
    unmatchedGuru: Array.from(unmatchedGuruMap.values()),
    conflicts: conflicts.slice(0, 50),
    duplicateKelas,
    kelasOptions: kelasRows.map(row => ({
      id: String(row.id),
      label: String(row.nama_kelas || row.id),
    })),
    guruOptions: guruRows.map(row => ({
      id: String(row.id),
      label: String(row.nama_lengkap || row.id),
    })),
  }
}

export async function getMarhalahList() {
  return getCachedMarhalahList()
}

export async function getJurnalGuru(startDate: string, endDate: string, marhalahId?: string) {
  await ensureLiburPengajianTable()
  let sql = `
    SELECT
      k.id,
      k.nama_kelas,
      m.id AS marhalah_id,
      m.nama AS marhalah_nama,
      gs.id AS guru_shubuh_id,
      gs.nama_lengkap AS guru_shubuh_nama,
      ga.id AS guru_ashar_id,
      ga.nama_lengkap AS guru_ashar_nama,
      gm.id AS guru_maghrib_id,
      gm.nama_lengkap AS guru_maghrib_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
    LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
    LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
    WHERE k.id IN (
      SELECT DISTINCT rp.kelas_id
      FROM riwayat_pendidikan rp
      JOIN santri s ON s.id = rp.santri_id
      WHERE rp.status_riwayat = 'aktif'
        AND s.status_global = 'aktif'
    )
  `
  const params: any[] = []
  if (marhalahId) { sql += ' AND k.marhalah_id = ?'; params.push(marhalahId) }
  sql += ' ORDER BY k.id'

  const kelasList = await query<any>(sql, params)
  if (!kelasList.length) return { list: [], absensi: {}, libur: [] }

  const absensi = await query<any>(
    `SELECT kelas_id, tanggal, shubuh, ashar, maghrib
     FROM absensi_guru
     WHERE tanggal >= ? AND tanggal <= ?`,
    [startDate, endDate]
  )

  const libur = await query<{ tanggal: string; sesi: SessionType }>(`
    SELECT tanggal, sesi
    FROM pengajian_libur_sesi
    WHERE tanggal >= ? AND tanggal <= ?
  `, [startDate, endDate])

  const rules = await getWeeklyGuruRules(kelasList.map((kelas: any) => kelas.id))
  const ruleMap = buildWeeklyGuruRuleMap(rules)
  const gabungan = await getKelasGabunganPengajian(kelasList.map((kelas: any) => kelas.id))
  const gabunganByKelas = buildGabunganByKelas(gabungan)
  const gabunganMembersByGroup = buildGabunganMembersByGroup(gabungan)
  const kelasById = new Map(kelasList.map((kelas: any) => [String(kelas.id), kelas]))

  const dates: string[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  const absensiMap: Record<string, any> = {}
  absensi.forEach((a: any) => {
    absensiMap[`${a.kelas_id}-${a.tanggal}`] = {
      shubuh: a.shubuh || 'H',
      ashar: a.ashar || 'H',
      maghrib: a.maghrib || 'H',
    }
  })

  const baseRows = kelasList.map((kelas: any) => ({
    ...kelas,
    week_schedule: buildWeekSchedule(kelas, dates, ruleMap).map(entry => {
      const guru = { ...entry.guru }
      for (const sesi of VALID_SESI) {
        const group = gabunganByKelas.get(`${kelas.id}|${sesi}`)
        if (!group) continue
        guru[sesi] = { id: null, nama: null, source: 'default' }
      }
      return { ...entry, guru }
    }),
  }))

  const virtualRows: any[] = []
  for (const [groupId, members] of gabunganMembersByGroup.entries()) {
    const representative = members[0]
    if (!representative) continue
    const baseKelas = kelasById.get(String(representative.kelas_id))
    if (!baseKelas) continue
    const sesi = representative.sesi as GuruJadwalSession
    const namaKelas = members.map(member => member.nama_kelas).join(' + ')
    virtualRows.push({
      ...baseKelas,
      id: representative.kelas_id,
      nama_kelas: namaKelas,
      marhalah_nama: `${baseKelas.marhalah_nama || 'Tanpa tingkat'} - Gabungan ${representative.sesi}${representative.tempat ? ` - ${representative.tempat}` : ''}`,
      is_gabungan: true,
      gabungan_id: groupId,
      gabungan_sesi: representative.sesi,
      gabungan_members: members.map(member => member.kelas_id),
      week_schedule: buildWeekSchedule(baseKelas, dates, ruleMap).map(entry => ({
        ...entry,
        guru: {
          ...emptyResolvedGuru(),
          [sesi]: entry.guru[sesi],
        },
      })),
    })
  }

  return {
    list: [...baseRows, ...virtualRows]
      .sort((a: any, b: any) =>
        a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
      ),
    absensi: absensiMap,
    libur,
  }
}

export async function simpanAbsensiGuru(
  payload: any[],
  liburInput: { tanggal: string; sesi: SessionType; is_libur: boolean }[] = []
) {
  await ensureLiburPengajianTable()
  const session = await getSession()
  if (payload.length === 0 && liburInput.length === 0) return { error: 'Tidak ada data untuk disimpan' }

  const normalizeStatus = (value: unknown) => {
    const status = String(value || 'H').toUpperCase()
    return status === 'A' || status === 'B' ? status : 'H'
  }

  const kelasIds = Array.from(new Set(payload.map(item => String(item.kelas_id)).filter(Boolean)))
  const kelasList = kelasIds.length > 0
    ? await query<any>(`
        SELECT
          k.id,
          gs.id AS guru_shubuh_id,
          gs.nama_lengkap AS guru_shubuh_nama,
          ga.id AS guru_ashar_id,
          ga.nama_lengkap AS guru_ashar_nama,
          gm.id AS guru_maghrib_id,
          gm.nama_lengkap AS guru_maghrib_nama
        FROM kelas k
        LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
        LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
        LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
        WHERE k.id IN (${kelasIds.map(() => '?').join(',')})
      `, kelasIds)
    : []

  const kelasMap = new Map(kelasList.map((kelas: any) => [kelas.id, kelas]))
  const ruleMap = buildWeeklyGuruRuleMap(await getWeeklyGuruRules(kelasIds))

  const payloadByKey = new Map<string, any>()
  for (const item of payload) {
    if (!item?.kelas_id || !item?.tanggal) continue
    const key = `${item.kelas_id}|${item.tanggal}`
    payloadByKey.set(key, { ...(payloadByKey.get(key) || {}), ...item })
  }

  const statements = Array.from(payloadByKey.values()).map(item => {
    const kelas = kelasMap.get(String(item.kelas_id))
    const resolved = kelas
      ? resolveGuruForDate(kelas, item.tanggal, ruleMap)
      : {
          shubuh: { id: null, nama: null },
          ashar: { id: null, nama: null },
          maghrib: { id: null, nama: null },
        }

    return {
      sql: `
        INSERT INTO absensi_guru (
          id, kelas_id, guru_id, tanggal, shubuh, ashar, maghrib, updated_by,
          guru_shubuh_id_snapshot, guru_shubuh_nama_snapshot,
          guru_ashar_id_snapshot, guru_ashar_nama_snapshot,
          guru_maghrib_id_snapshot, guru_maghrib_nama_snapshot
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(kelas_id, tanggal) DO UPDATE SET
          guru_id = excluded.guru_id,
          shubuh = excluded.shubuh,
          ashar = excluded.ashar,
          maghrib = excluded.maghrib,
          updated_by = excluded.updated_by,
          guru_shubuh_id_snapshot = excluded.guru_shubuh_id_snapshot,
          guru_shubuh_nama_snapshot = excluded.guru_shubuh_nama_snapshot,
          guru_ashar_id_snapshot = excluded.guru_ashar_id_snapshot,
          guru_ashar_nama_snapshot = excluded.guru_ashar_nama_snapshot,
          guru_maghrib_id_snapshot = excluded.guru_maghrib_id_snapshot,
          guru_maghrib_nama_snapshot = excluded.guru_maghrib_nama_snapshot
      `,
      params: [
        generateId(),
        item.kelas_id,
        item.guru_id_wali ?? null,
        item.tanggal,
        normalizeStatus(item.shubuh),
        normalizeStatus(item.ashar),
        normalizeStatus(item.maghrib),
        session?.id ?? null,
        resolved.shubuh.id ?? null,
        resolved.shubuh.nama ?? null,
        resolved.ashar.id ?? null,
        resolved.ashar.nama ?? null,
        resolved.maghrib.id ?? null,
        resolved.maghrib.nama ?? null,
      ],
    }
  })

  const chunkSize = 50
  for (let i = 0; i < statements.length; i += chunkSize) {
    await batch(statements.slice(i, i + chunkSize))
  }

  const uniqueLiburMap = new Map<string, { tanggal: string; sesi: SessionType; is_libur: boolean }>()
  liburInput.forEach(item => {
    if (!item?.tanggal || !VALID_SESI.includes(item.sesi)) return
    uniqueLiburMap.set(`${item.tanggal}-${item.sesi}`, item)
  })
  const liburStatements = Array.from(uniqueLiburMap.values()).map(item => (
    item.is_libur
      ? {
          sql: `INSERT INTO pengajian_libur_sesi (tanggal, sesi, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(tanggal, sesi) DO UPDATE SET updated_at = excluded.updated_at`,
          params: [item.tanggal, item.sesi, session?.id ?? null, now(), now()],
        }
      : {
          sql: `DELETE FROM pengajian_libur_sesi WHERE tanggal = ? AND sesi = ?`,
          params: [item.tanggal, item.sesi],
        }
  ))
  for (let i = 0; i < liburStatements.length; i += chunkSize) {
    await batch(liburStatements.slice(i, i + chunkSize))
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_absensi_guru',
    action: 'update',
    fiturHref: '/dashboard/akademik/absensi-guru',
    logKind: 'update',
    entityType: 'absensi_guru_batch',
    entityId: 'simpan-absensi-guru',
    entityLabel: 'Absensi guru pengajian',
    summary: `Menyimpan absensi guru (${payload.length} baris)`,
    details: {
      saved_rows: payload.length,
      libur_rows: liburInput.length,
      kelas_terdampak: kelasIds.length,
    },
  })

  revalidatePath('/dashboard/akademik/absensi-guru')
  revalidatePath('/dashboard/akademik/absensi-guru/rekap')
  return { success: true, saved: payload.length }
}

export async function previewImportAbsensiGuru(
  cells: AbsensiGuruImportCell[],
  mappings: AbsensiGuruImportMappings = {}
) {
  if (!Array.isArray(cells) || cells.length === 0) return { error: 'Tidak ada data absensi yang terbaca dari Excel.' }

  const result = await buildAbsensiGuruImport(cells, mappings)
  const dates = Array.from(new Set(result.groups.map(group => group.tanggal))).sort()
  const kelas = Array.from(new Set(result.groups.map(group => group.kelasName))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  )

  return {
    success: true as const,
    canImport: result.groups.length > 0 && result.unmatchedKelas.length === 0 && result.conflicts.length === 0,
    summary: {
      sourceCells: cells.length,
      importRows: result.groups.length,
      kelasCount: kelas.length,
      dateStart: dates[0] || '',
      dateEnd: dates[dates.length - 1] || '',
      statusCounts: result.statusCounts,
      matchedGuruCells: result.matchedGuruCells,
      unmatchedGuruCells: result.unmatchedGuruCells,
    },
    samples: result.groups.slice(0, 20).map(group => ({
      kelasName: group.kelasName,
      tanggal: group.tanggal,
      shubuh: group.shubuh,
      ashar: group.ashar,
      maghrib: group.maghrib,
      guruShubuh: group.guru_shubuh_nama_snapshot,
      guruAshar: group.guru_ashar_nama_snapshot,
      guruMaghrib: group.guru_maghrib_nama_snapshot,
    })),
    issues: {
      unmatchedKelas: result.unmatchedKelas,
      unmatchedGuru: result.unmatchedGuru.slice(0, 50),
      conflicts: result.conflicts,
      duplicateKelas: result.duplicateKelas,
    },
    options: {
      kelas: result.kelasOptions,
      guru: result.guruOptions,
    },
  }
}

export async function importAbsensiGuruHistoris(
  cells: AbsensiGuruImportCell[],
  mappings: AbsensiGuruImportMappings = {}
) {
  await ensureLiburPengajianTable()
  const session = await getSession()
  if (!Array.isArray(cells) || cells.length === 0) return { error: 'Tidak ada data absensi yang terbaca dari Excel.' }

  const result = await buildAbsensiGuruImport(cells, mappings)
  if (result.groups.length === 0) return { error: 'Tidak ada baris yang bisa diimpor.' }
  if (result.unmatchedKelas.length > 0) {
    return { error: `Ada ${result.unmatchedKelas.length} kelas yang belum cocok. Perbaiki Master Kelas atau file Excel terlebih dahulu.` }
  }
  if (result.conflicts.length > 0) {
    return { error: `Ada ${result.conflicts.length} konflik status dalam file Excel. Periksa preview sebelum import.` }
  }

  const statements = result.groups.map(group => ({
    sql: `
      INSERT INTO absensi_guru (
        id, kelas_id, guru_id, tanggal, shubuh, ashar, maghrib, updated_by,
        guru_shubuh_id_snapshot, guru_shubuh_nama_snapshot,
        guru_ashar_id_snapshot, guru_ashar_nama_snapshot,
        guru_maghrib_id_snapshot, guru_maghrib_nama_snapshot
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(kelas_id, tanggal) DO UPDATE SET
        guru_id = excluded.guru_id,
        shubuh = excluded.shubuh,
        ashar = excluded.ashar,
        maghrib = excluded.maghrib,
        updated_by = excluded.updated_by,
        guru_shubuh_id_snapshot = excluded.guru_shubuh_id_snapshot,
        guru_shubuh_nama_snapshot = excluded.guru_shubuh_nama_snapshot,
        guru_ashar_id_snapshot = excluded.guru_ashar_id_snapshot,
        guru_ashar_nama_snapshot = excluded.guru_ashar_nama_snapshot,
        guru_maghrib_id_snapshot = excluded.guru_maghrib_id_snapshot,
        guru_maghrib_nama_snapshot = excluded.guru_maghrib_nama_snapshot
    `,
    params: [
      generateId(),
      group.kelasId,
      group.guru_maghrib_id_snapshot || group.guru_ashar_id_snapshot || group.guru_shubuh_id_snapshot || null,
      group.tanggal,
      group.shubuh,
      group.ashar,
      group.maghrib,
      session?.id ?? null,
      group.guru_shubuh_id_snapshot,
      group.guru_shubuh_nama_snapshot,
      group.guru_ashar_id_snapshot,
      group.guru_ashar_nama_snapshot,
      group.guru_maghrib_id_snapshot,
      group.guru_maghrib_nama_snapshot,
    ],
  }))

  const chunkSize = 50
  for (let i = 0; i < statements.length; i += chunkSize) {
    await batch(statements.slice(i, i + chunkSize))
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_absensi_guru',
    action: 'import',
    fiturHref: '/dashboard/akademik/absensi-guru',
    logKind: 'create',
    entityType: 'absensi_guru_import',
    entityId: 'import-absensi-guru-historis',
    entityLabel: 'Import absensi guru historis',
    summary: `Import absensi guru historis (${result.groups.length} baris)`,
    details: {
      source_cells: cells.length,
      saved_rows: result.groups.length,
      status_counts: result.statusCounts,
      guru_unmatched_cells: result.unmatchedGuruCells,
    },
  })

  revalidatePath('/dashboard/akademik/absensi-guru')
  revalidatePath('/dashboard/akademik/absensi-guru/rekap')
  return {
    success: true as const,
    saved: result.groups.length,
    statusCounts: result.statusCounts,
    unmatchedGuruCells: result.unmatchedGuruCells,
  }
}
