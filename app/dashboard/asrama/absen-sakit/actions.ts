'use server'

import { execute, generateId, query, queryOne } from '@/lib/db'
import { getSession, hasAnyRole, hasRole, isAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const FEATURE_PATH = '/dashboard/asrama/absen-sakit'

export type SesiSakit = 'PAGI' | 'SORE' | 'MALAM'

export type SessionInfo = {
  role: string
  asrama_binaan: string | null
  isAdmin: boolean
}

export type SantriSakitOption = {
  id: string
  nama_lengkap: string
  nis: string | null
  kamar: string | null
  asrama: string | null
}

export type DataSakitRow = {
  id: string
  santri_id: string
  tanggal: string
  sesi: SesiSakit
  sakit_apa: string
  beli_surat: number
  created_at: string
  updated_at: string | null
  nama_lengkap: string
  nis: string | null
  kamar: string | null
  asrama: string | null
}

export type RiwayatSakitItem = DataSakitRow & {
  pencatat_nama: string | null
}

async function ensureSchema() {
  const statements = [
    `ALTER TABLE absen_sakit ADD COLUMN sesi TEXT NOT NULL DEFAULT 'PAGI'`,
    `ALTER TABLE absen_sakit ADD COLUMN sakit_apa TEXT`,
    `ALTER TABLE absen_sakit ADD COLUMN beli_surat INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE absen_sakit ADD COLUMN updated_at TEXT`,
  ]

  for (const sql of statements) {
    try {
      await execute(sql)
    } catch {
      // Kolom sudah ada pada database yang sudah termigrasi.
    }
  }
}

async function getRestrictedAsrama(): Promise<string | null> {
  const session = await getSession()
  if (!session) return null
  if (hasRole(session, 'pengurus_asrama')) return session.asrama_binaan ?? null
  return null
}

async function requireAllowedSession() {
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) {
    return null
  }
  return session
}

function normalizeSesi(value: string): SesiSakit {
  if (value === 'SORE' || value === 'MALAM') return value
  return 'PAGI'
}

function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().split('T')[0]
}

export async function getSessionInfo(): Promise<SessionInfo | null> {
  const session = await getSession()
  if (!session) return null

  return {
    role: session.role,
    asrama_binaan: hasRole(session, 'pengurus_asrama') ? session.asrama_binaan ?? null : null,
    isAdmin: isAdmin(session),
  }
}

export async function getDaftarAsramaSakit() {
  const restrictedAsrama = await getRestrictedAsrama()
  if (restrictedAsrama) return [restrictedAsrama]

  const rows = await query<{ asrama: string }>(`
    SELECT DISTINCT asrama
    FROM santri
    WHERE asrama IS NOT NULL AND asrama != ''
    ORDER BY asrama
  `)

  return rows.map(row => row.asrama)
}

export async function cariSantriSakit(keyword: string, asramaRequest: string): Promise<SantriSakitOption[]> {
  const session = await requireAllowedSession()
  if (!session) return []

  const clean = keyword.trim()
  if (clean.length < 2) return []

  const restrictedAsrama = await getRestrictedAsrama()
  const targetAsrama = restrictedAsrama || asramaRequest

  return query<SantriSakitOption>(`
    SELECT id, nama_lengkap, nis, kamar, asrama
    FROM santri
    WHERE asrama = ?
      AND status_global = 'aktif'
      AND (nama_lengkap LIKE ? OR nis LIKE ?)
    ORDER BY nama_lengkap
    LIMIT 12
  `, [targetAsrama, `%${clean}%`, `%${clean}%`])
}

export async function getDataSakit(params: { asrama: string; tanggal: string; sesi: SesiSakit }) {
  await ensureSchema()

  const session = await requireAllowedSession()
  if (!session) return []

  const restrictedAsrama = await getRestrictedAsrama()
  const targetAsrama = restrictedAsrama || params.asrama
  const tanggal = normalizeDate(params.tanggal)
  const sesi = normalizeSesi(params.sesi)

  return query<DataSakitRow>(`
    SELECT
      ab.id,
      ab.santri_id,
      ab.tanggal,
      COALESCE(ab.sesi, 'PAGI') AS sesi,
      COALESCE(
        NULLIF(ab.sakit_apa, ''),
        CASE WHEN ab.keterangan IN ('BELI_SURAT', 'TIDAK_BELI') THEN NULL ELSE ab.keterangan END,
        '-'
      ) AS sakit_apa,
      CASE
        WHEN ab.beli_surat = 1 OR ab.keterangan = 'BELI_SURAT' THEN 1
        ELSE 0
      END AS beli_surat,
      ab.created_at,
      ab.updated_at,
      s.nama_lengkap,
      s.nis,
      s.kamar,
      s.asrama
    FROM absen_sakit ab
    JOIN santri s ON s.id = ab.santri_id
    WHERE s.asrama = ?
      AND ab.tanggal = ?
      AND COALESCE(ab.sesi, 'PAGI') = ?
    ORDER BY s.kamar, s.nama_lengkap
  `, [targetAsrama, tanggal, sesi])
}

export async function simpanDataSakit(payload: {
  santriId: string
  tanggal: string
  sesi: SesiSakit
  sakitApa: string
  beliSurat: boolean
}) {
  await ensureSchema()

  const session = await requireAllowedSession()
  if (!session) return { error: 'Unauthorized' }

  const sakitApa = payload.sakitApa.trim()
  if (!sakitApa) return { error: 'Isi dulu sakitnya apa.' }

  const restrictedAsrama = await getRestrictedAsrama()
  const santri = await queryOne<{ id: string; asrama: string | null; nama_lengkap: string }>(`
    SELECT id, asrama, nama_lengkap
    FROM santri
    WHERE id = ? AND status_global = 'aktif'
  `, [payload.santriId])

  if (!santri) return { error: 'Santri tidak ditemukan.' }
  if (restrictedAsrama && santri.asrama !== restrictedAsrama) {
    return { error: 'Pengurus asrama hanya bisa mendata santri asramanya.' }
  }

  const tanggal = normalizeDate(payload.tanggal)
  const sesi = normalizeSesi(payload.sesi)
  const beliSurat = payload.beliSurat ? 1 : 0
  const existing = await queryOne<{ id: string }>(`
    SELECT id FROM absen_sakit
    WHERE santri_id = ? AND tanggal = ? AND COALESCE(sesi, 'PAGI') = ?
  `, [payload.santriId, tanggal, sesi])

  if (existing) {
    await execute(`
      UPDATE absen_sakit
      SET sakit_apa = ?, beli_surat = ?, keterangan = ?, updated_at = datetime('now'), created_by = ?
      WHERE id = ?
    `, [sakitApa, beliSurat, sakitApa, session.id ?? null, existing.id])
  } else {
    await execute(`
      INSERT INTO absen_sakit (id, santri_id, tanggal, sesi, sakit_apa, beli_surat, keterangan, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [generateId(), payload.santriId, tanggal, sesi, sakitApa, beliSurat, sakitApa, session.id ?? null])
  }

  revalidatePath(FEATURE_PATH)
  return { success: true, updated: Boolean(existing), nama: santri.nama_lengkap }
}

export async function getRiwayatSakit(santriId: string): Promise<RiwayatSakitItem[]> {
  await ensureSchema()

  const session = await requireAllowedSession()
  if (!session) return []

  const restrictedAsrama = await getRestrictedAsrama()
  const santri = await queryOne<{ asrama: string | null }>('SELECT asrama FROM santri WHERE id = ?', [santriId])
  if (!santri) return []
  if (restrictedAsrama && santri.asrama !== restrictedAsrama) return []

  return query<RiwayatSakitItem>(`
    SELECT
      ab.id,
      ab.santri_id,
      ab.tanggal,
      COALESCE(ab.sesi, 'PAGI') AS sesi,
      COALESCE(
        NULLIF(ab.sakit_apa, ''),
        CASE WHEN ab.keterangan IN ('BELI_SURAT', 'TIDAK_BELI') THEN NULL ELSE ab.keterangan END,
        '-'
      ) AS sakit_apa,
      CASE
        WHEN ab.beli_surat = 1 OR ab.keterangan = 'BELI_SURAT' THEN 1
        ELSE 0
      END AS beli_surat,
      ab.created_at,
      ab.updated_at,
      s.nama_lengkap,
      s.nis,
      s.kamar,
      s.asrama,
      u.name AS pencatat_nama
    FROM absen_sakit ab
    JOIN santri s ON s.id = ab.santri_id
    LEFT JOIN users u ON u.id = ab.created_by
    WHERE ab.santri_id = ?
    ORDER BY ab.tanggal DESC,
      CASE COALESCE(ab.sesi, 'PAGI')
        WHEN 'MALAM' THEN 3
        WHEN 'SORE' THEN 2
        ELSE 1
      END DESC,
      ab.created_at DESC
    LIMIT 80
  `, [santriId])
}
