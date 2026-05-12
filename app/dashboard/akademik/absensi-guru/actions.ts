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
