'use server'

import { ensureGuruJadwalSchema } from '@/lib/akademik/guru-jadwal'
import { getCachedTahunAjaranAktif } from '@/lib/cache/master'
import { query, queryOne } from '@/lib/db'
import { getEffectiveRoles, getSession } from '@/lib/auth/session'
import type {
  AdministrasiBundle,
  AdministrasiStudent,
  GuruAdministrasiOption,
} from './types'

const OPERATOR_ROLES = new Set(['admin', 'sekpen', 'akademik'])

async function requireOperator() {
  const session = await getSession()
  const allowed = getEffectiveRoles(session).some(role => OPERATOR_ROLES.has(role))
  if (!session || !allowed) throw new Error('Anda tidak berwenang mengakses administrasi guru.')
  return session
}

function naturalSort<T extends { nama_kelas: string }>(rows: T[]) {
  return [...rows].sort((a, b) =>
    a.nama_kelas.localeCompare(b.nama_kelas, 'id', { numeric: true, sensitivity: 'base' })
  )
}

export async function getGuruAdministrasiOptions(): Promise<GuruAdministrasiOption[]> {
  await requireOperator()
  await ensureGuruJadwalSchema()

  const rows = await query<{
    id: number
    nama_lengkap: string
    gelar: string | null
    kode_guru: string | null
    nama_kelas: string
  }>(`
    WITH kelas_guru AS (
      SELECT k.id AS kelas_id, k.nama_kelas, k.guru_shubuh_id AS guru_id
      FROM kelas k JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      WHERE k.guru_shubuh_id IS NOT NULL
      UNION
      SELECT k.id, k.nama_kelas, k.guru_ashar_id
      FROM kelas k JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      WHERE k.guru_ashar_id IS NOT NULL
      UNION
      SELECT k.id, k.nama_kelas, k.guru_maghrib_id
      FROM kelas k JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      WHERE k.guru_maghrib_id IS NOT NULL
      UNION
      SELECT k.id, k.nama_kelas, j.guru_id
      FROM kelas_jadwal_guru_mingguan j
      JOIN kelas k ON k.id = j.kelas_id
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    )
    SELECT g.id, g.nama_lengkap, g.gelar, g.kode_guru, kg.nama_kelas
    FROM data_guru g
    JOIN kelas_guru kg ON kg.guru_id = g.id
    ORDER BY g.nama_lengkap, kg.nama_kelas
  `)

  const grouped = new Map<number, GuruAdministrasiOption>()
  for (const row of rows) {
    const item = grouped.get(row.id) ?? {
      id: row.id,
      nama_lengkap: row.nama_lengkap,
      gelar: row.gelar,
      kode_guru: row.kode_guru,
      kelas: [],
    }
    if (!item.kelas.includes(row.nama_kelas)) item.kelas.push(row.nama_kelas)
    grouped.set(row.id, item)
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.nama_lengkap.localeCompare(b.nama_lengkap, 'id', { sensitivity: 'base' })
  )
}

export async function getAdministrasiGuruBundle(guruId: number): Promise<AdministrasiBundle> {
  await requireOperator()
  await ensureGuruJadwalSchema()

  const normalizedGuruId = Number(guruId)
  if (!Number.isInteger(normalizedGuruId) || normalizedGuruId <= 0) {
    throw new Error('Guru yang dipilih tidak valid.')
  }

  const [tahunAjaran, guru] = await Promise.all([
    getCachedTahunAjaranAktif(),
    queryOne<{ id: number; nama_lengkap: string; gelar: string | null; kode_guru: string | null }>(
      'SELECT id, nama_lengkap, gelar, kode_guru FROM data_guru WHERE id = ?',
      [normalizedGuruId]
    ),
  ])

  if (!tahunAjaran) throw new Error('Tahun ajaran aktif belum ditentukan.')
  if (!guru) throw new Error('Guru tidak ditemukan.')

  const kelasRows = naturalSort(await query<{
    id: string
    nama_kelas: string
  }>(`
    SELECT DISTINCT k.id, k.nama_kelas
    FROM kelas k
    LEFT JOIN kelas_jadwal_guru_mingguan j
      ON j.kelas_id = k.id AND j.guru_id = ?
    WHERE k.tahun_ajaran_id = ?
      AND (
        k.guru_shubuh_id = ? OR
        k.guru_ashar_id = ? OR
        k.guru_maghrib_id = ? OR
        j.id IS NOT NULL
      )
  `, [normalizedGuruId, tahunAjaran.id, normalizedGuruId, normalizedGuruId, normalizedGuruId]))

  if (kelasRows.length === 0) {
    throw new Error('Guru ini tidak memiliki kelas mengajar pada tahun ajaran aktif.')
  }

  const placeholders = kelasRows.map(() => '?').join(',')
  const studentRows = await query<AdministrasiStudent & { kelas_id: string }>(`
    SELECT DISTINCT
      rp.kelas_id,
      s.id,
      s.nama_lengkap,
      s.nis,
      s.asrama,
      s.kamar,
      s.sekolah,
      s.kelas_sekolah
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id IN (${placeholders})
      AND rp.status_riwayat = 'aktif'
      AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, kelasRows.map(kelas => kelas.id))

  const studentsByClass = new Map<string, AdministrasiStudent[]>()
  for (const row of studentRows) {
    const { kelas_id, ...student } = row
    studentsByClass.set(kelas_id, [...(studentsByClass.get(kelas_id) ?? []), student])
  }

  return {
    guru,
    tahunAjaran: { id: Number(tahunAjaran.id), nama: String(tahunAjaran.nama) },
    kelas: kelasRows.map(kelas => ({
      ...kelas,
      santri: studentsByClass.get(kelas.id) ?? [],
    })),
  }
}
