'use server'

import { execute, generateId, query, queryOne, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const DENDA_STEP = 25000
const FEATURE_PATH = '/dashboard/keamanan/denda-buku-pribadi'

export type SantriOption = {
  id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
}

export type DendaSantriSummary = {
  santri_id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  total_kasus: number
  total_nominal: number
  total_belum_lunas: number
  terakhir_hilang: string | null
}

export type DendaBukuDetail = {
  id: string
  santri_id: string
  kehilangan_ke: number
  nominal: number
  status: 'BELUM_BAYAR' | 'LUNAS'
  tanggal: string
  keterangan: string | null
  created_at: string
  paid_at: string | null
  admin_nama: string | null
  paid_by_nama: string | null
}

export type DendaStats = {
  totalSantri: number
  totalKasus: number
  totalNominal: number
  totalBelumLunas: number
}

let schemaReady: Promise<void> | null = null

export async function ensureDendaBukuPribadiSchema() {
  schemaReady ??= ensureDendaBukuPribadiSchemaOnce().catch(error => {
    schemaReady = null
    throw error
  })
  await schemaReady
}

async function ensureDendaBukuPribadiSchemaOnce() {
  await execute(`
    CREATE TABLE IF NOT EXISTS denda_buku_pribadi (
      id             TEXT PRIMARY KEY,
      santri_id      TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
      tanggal        TEXT NOT NULL,
      kehilangan_ke  INTEGER NOT NULL,
      nominal        INTEGER NOT NULL,
      status         TEXT NOT NULL DEFAULT 'BELUM_BAYAR',
      keterangan     TEXT,
      created_by     TEXT REFERENCES users(id),
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      paid_at        TEXT,
      paid_by        TEXT REFERENCES users(id)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_denda_buku_pribadi_santri
    ON denda_buku_pribadi(santri_id, kehilangan_ke)
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_denda_buku_pribadi_status
    ON denda_buku_pribadi(status, tanggal)
  `)
  await execute(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES ('Perizinan & Disiplin', 'Denda Buku Pribadi', '${FEATURE_PATH}', 'Book', '["admin","dewan_santri"]', 1, 5)
  `)
}

export async function cariSantriDenda(keyword: string) {
  await ensureDendaBukuPribadiSchema()
  const clean = keyword.trim()
  if (clean.length < 2) return []

  return query<SantriOption>(`
    SELECT id, nama_lengkap, nis, asrama, kamar
    FROM santri
    WHERE status_global = 'aktif'
      AND (nama_lengkap LIKE ? OR nis LIKE ?)
    ORDER BY nama_lengkap
    LIMIT 8
  `, [`%${clean}%`, `%${clean}%`])
}

export async function getDendaBukuPribadiData() {
  await ensureDendaBukuPribadiSchema()

  const rows = await query<DendaSantriSummary>(`
    SELECT
      s.id as santri_id,
      s.nama_lengkap,
      s.nis,
      s.asrama,
      s.kamar,
      COUNT(d.id) as total_kasus,
      COALESCE(SUM(d.nominal), 0) as total_nominal,
      COALESCE(SUM(CASE WHEN d.status = 'BELUM_BAYAR' THEN d.nominal ELSE 0 END), 0) as total_belum_lunas,
      MAX(d.tanggal) as terakhir_hilang
    FROM denda_buku_pribadi d
    JOIN santri s ON s.id = d.santri_id
    GROUP BY s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    ORDER BY total_belum_lunas DESC, terakhir_hilang DESC, s.nama_lengkap
  `)

  const statRow = await queryOne<{
    total_santri: number
    total_kasus: number
    total_nominal: number
    total_belum_lunas: number
  }>(`
    SELECT
      COUNT(DISTINCT santri_id) as total_santri,
      COUNT(*) as total_kasus,
      COALESCE(SUM(nominal), 0) as total_nominal,
      COALESCE(SUM(CASE WHEN status = 'BELUM_BAYAR' THEN nominal ELSE 0 END), 0) as total_belum_lunas
    FROM denda_buku_pribadi
  `)

  const stats: DendaStats = {
    totalSantri: Number(statRow?.total_santri || 0),
    totalKasus: Number(statRow?.total_kasus || 0),
    totalNominal: Number(statRow?.total_nominal || 0),
    totalBelumLunas: Number(statRow?.total_belum_lunas || 0),
  }

  return {
    rows: rows.map(row => ({
      ...row,
      total_kasus: Number(row.total_kasus || 0),
      total_nominal: Number(row.total_nominal || 0),
      total_belum_lunas: Number(row.total_belum_lunas || 0),
    })),
    stats,
  }
}

export async function getDendaBukuPribadiDetail(santriId: string) {
  await ensureDendaBukuPribadiSchema()
  return query<DendaBukuDetail>(`
    SELECT
      d.id,
      d.santri_id,
      d.kehilangan_ke,
      d.nominal,
      d.status,
      d.tanggal,
      d.keterangan,
      d.created_at,
      d.paid_at,
      u.full_name as admin_nama,
      pu.full_name as paid_by_nama
    FROM denda_buku_pribadi d
    LEFT JOIN users u ON u.id = d.created_by
    LEFT JOIN users pu ON pu.id = d.paid_by
    WHERE d.santri_id = ?
    ORDER BY d.kehilangan_ke DESC
  `, [santriId])
}

export async function getNextDendaBukuPribadi(santriId: string) {
  await ensureDendaBukuPribadiSchema()
  const row = await queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM denda_buku_pribadi WHERE santri_id = ?',
    [santriId]
  )
  const kehilanganKe = Number(row?.total || 0) + 1
  return {
    kehilanganKe,
    nominal: kehilanganKe * DENDA_STEP,
  }
}

export async function catatDendaBukuPribadi(formData: FormData): Promise<{ success: boolean; kehilanganKe: number; nominal: number } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureDendaBukuPribadiSchema()

  const santriId = String(formData.get('santri_id') || '')
  const tanggal = String(formData.get('tanggal') || '').trim()
  const keterangan = String(formData.get('keterangan') || '').trim()

  if (!santriId) return { error: 'Pilih santri dulu.' }
  if (!tanggal) return { error: 'Tanggal wajib diisi.' }

  const next = await getNextDendaBukuPribadi(santriId)

  await execute(`
    INSERT INTO denda_buku_pribadi
      (id, santri_id, tanggal, kehilangan_ke, nominal, status, keterangan, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, 'BELUM_BAYAR', ?, ?, ?)
  `, [
    generateId(),
    santriId,
    tanggal,
    next.kehilanganKe,
    next.nominal,
    keterangan || null,
    session.id,
    now(),
  ])

  revalidatePath(FEATURE_PATH)
  return { success: true, kehilanganKe: next.kehilanganKe, nominal: next.nominal }
}

export async function tandaiDendaBukuPribadiLunas(id: string): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureDendaBukuPribadiSchema()

  await execute(`
    UPDATE denda_buku_pribadi
    SET status = 'LUNAS', paid_at = ?, paid_by = ?
    WHERE id = ?
  `, [now(), session.id, id])

  revalidatePath(FEATURE_PATH)
  return { success: true }
}
