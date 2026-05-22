'use server'

import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { query, queryOne } from '@/lib/db'
import {
  buildWeeklyGuruRuleMap,
  ensureGuruJadwalSchema,
  HARI_INDEX_LABEL,
  isPengajianLiburByHariIndex,
  resolveGuruForHariIndex,
  type GuruJadwalSession,
  type KelasGuruBase,
} from '@/lib/akademik/guru-jadwal'

type GuruProfile = {
  id: number
  nama_lengkap: string
  gelar: string | null
  kode_guru: string | null
}

type UserSourceRow = {
  full_name: string
  email: string
  role: string
  roles: string | null
  source_type: string | null
  source_ref_id: string | null
}

type KelasRow = KelasGuruBase & {
  nama_kelas: string
  marhalah_nama: string | null
}

export type GuruScheduleRow = {
  kelas_id: string
  nama_kelas: string
  marhalah_nama: string | null
  sesi: GuruJadwalSession
  hari: string
  sumber: 'default' | 'override' | 'campuran'
}

export type GuruPortalData = {
  user: {
    full_name: string
    email: string
    roles: string[]
  } | null
  guru: GuruProfile | null
  schedules: GuruScheduleRow[]
  stats: {
    totalKelas: number
    totalSlot: number
  }
  needsSourceLink: boolean
}

function parseRoles(raw: string | null, fallbackRole: string) {
  try {
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[]
    }
  } catch {}
  return fallbackRole ? [fallbackRole] : []
}

function formatDays(days: number[]) {
  return days
    .sort((a, b) => a - b)
    .map(day => HARI_INDEX_LABEL[day] || String(day))
    .join(', ')
}

export async function getGuruPortalData(): Promise<GuruPortalData> {
  const session = await getSession()
  if (!session) {
    return {
      user: null,
      guru: null,
      schedules: [],
      stats: { totalKelas: 0, totalSlot: 0 },
      needsSourceLink: true,
    }
  }

  await ensureGuruJadwalSchema()

  const user = await queryOne<UserSourceRow>(
    'SELECT full_name, email, role, roles, source_type, source_ref_id FROM users WHERE id = ?',
    [session.id]
  )
  const roles = user ? parseRoles(user.roles, user.role) : getEffectiveRoles(session)

  if (!user || user.source_type !== 'guru' || !user.source_ref_id) {
    return {
      user: user ? { full_name: user.full_name, email: user.email, roles } : null,
      guru: null,
      schedules: [],
      stats: { totalKelas: 0, totalSlot: 0 },
      needsSourceLink: true,
    }
  }

  const guruId = Number(user.source_ref_id)
  const guru = await queryOne<GuruProfile>(
    'SELECT id, nama_lengkap, gelar, kode_guru FROM data_guru WHERE id = ?',
    [guruId]
  )

  if (!guru) {
    return {
      user: { full_name: user.full_name, email: user.email, roles },
      guru: null,
      schedules: [],
      stats: { totalKelas: 0, totalSlot: 0 },
      needsSourceLink: true,
    }
  }

  const kelas = await query<KelasRow>(`
    SELECT
      k.id,
      k.nama_kelas,
      m.nama as marhalah_nama,
      gs.id as guru_shubuh_id,
      gs.nama_lengkap as guru_shubuh_nama,
      ga.id as guru_ashar_id,
      ga.nama_lengkap as guru_ashar_nama,
      gm.id as guru_maghrib_id,
      gm.nama_lengkap as guru_maghrib_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
    LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
    LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
    ORDER BY k.nama_kelas
  `)
  const rules = await query<any>(`
    SELECT
      r.id,
      r.kelas_id,
      r.sesi,
      r.hari_index,
      r.guru_id,
      g.nama_lengkap as guru_nama
    FROM kelas_jadwal_guru_mingguan r
    JOIN data_guru g ON g.id = r.guru_id
  `)
  const ruleMap = buildWeeklyGuruRuleMap(rules)
  const sessions: GuruJadwalSession[] = ['shubuh', 'ashar', 'maghrib']
  const schedules: GuruScheduleRow[] = []

  for (const row of kelas) {
    for (const sesi of sessions) {
      const days: number[] = []
      const sources = new Set<'default' | 'override'>()

      for (let hariIndex = 0; hariIndex <= 6; hariIndex += 1) {
        if (isPengajianLiburByHariIndex(hariIndex, sesi)) continue
        const resolved = resolveGuruForHariIndex(row, hariIndex, ruleMap)[sesi]
        if (resolved.id !== guruId) continue
        days.push(hariIndex)
        sources.add(resolved.source)
      }

      if (days.length === 0) continue
      schedules.push({
        kelas_id: row.id,
        nama_kelas: row.nama_kelas,
        marhalah_nama: row.marhalah_nama,
        sesi,
        hari: formatDays(days),
        sumber: sources.size > 1 ? 'campuran' : Array.from(sources)[0] || 'default',
      })
    }
  }

  const totalKelas = new Set(schedules.map(item => item.kelas_id)).size

  return {
    user: { full_name: user.full_name, email: user.email, roles },
    guru,
    schedules,
    stats: {
      totalKelas,
      totalSlot: schedules.length,
    },
    needsSourceLink: false,
  }
}
