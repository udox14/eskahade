'use server'

import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// ─── Reexport dari parent agar monitoring bisa pakai periode & tandai telat ──
export { getPeriodeAktif, tandaiTelatMassal } from '../actions'

// ─── Session info ─────────────────────────────────────────────────────────────
export async function getSessionMonitoring() {
  const session = await getSession()
  if (!session) return null
  return {
    role: session.role,
    asrama_binaan: session.asrama_binaan ?? null,
  }
}

// ─── Aggregate per asrama (load awal, ringan) ─────────────────────────────────
export async function getMonitoringAggregate(periodeId: number, asramaFilter?: string) {
  const session = await getSession()
  if (!session) return []

  const asramaClause = asramaFilter ? 'AND s.asrama = ?' : ''
  const params: any[] = [periodeId]
  if (asramaFilter) params.push(asramaFilter)

  const rows = await query<{
    asrama: string
    total: number
    sudah_pulang: number
    belum_pulang: number
    sudah_datang: number
    belum_datang: number
    telat: number
  }>(`
    SELECT
      s.asrama,
      COUNT(*)                                                                AS total,
      SUM(CASE WHEN pl.status_pulang = 'PULANG' THEN 1 ELSE 0 END)          AS sudah_pulang,
      SUM(CASE WHEN pl.status_pulang = 'BELUM'  THEN 1 ELSE 0 END)          AS belum_pulang,
      SUM(CASE WHEN pl.status_datang = 'SUDAH'  THEN 1 ELSE 0 END)          AS sudah_datang,
      SUM(CASE WHEN pl.status_pulang = 'PULANG'
               AND pl.status_datang  = 'BELUM'  THEN 1 ELSE 0 END)          AS belum_datang,
      SUM(CASE WHEN pl.status_datang IN ('TELAT','VONIS') THEN 1 ELSE 0 END) AS telat
    FROM santri s
    INNER JOIN perpulangan_log pl ON pl.santri_id = s.id AND pl.periode_id = ?
    WHERE s.status_global = 'aktif' ${asramaClause}
    GROUP BY s.asrama
    ORDER BY s.asrama
  `, params)

  return rows
}

// ─── Aggregate per kamar dalam 1 asrama (lazy, dipanggil saat accordion dibuka) ──
export async function getMonitoringPerKamar(periodeId: number, asrama: string) {
  const rows = await query<{
    kamar: string
    total: number
    sudah_pulang: number
    belum_pulang: number
    sudah_datang: number
    belum_datang: number
    telat: number
  }>(`
    SELECT
      s.kamar,
      COUNT(*)                                                                AS total,
      SUM(CASE WHEN pl.status_pulang = 'PULANG' THEN 1 ELSE 0 END)          AS sudah_pulang,
      SUM(CASE WHEN pl.status_pulang = 'BELUM'  THEN 1 ELSE 0 END)          AS belum_pulang,
      SUM(CASE WHEN pl.status_datang = 'SUDAH'  THEN 1 ELSE 0 END)          AS sudah_datang,
      SUM(CASE WHEN pl.status_pulang = 'PULANG'
               AND pl.status_datang  = 'BELUM'  THEN 1 ELSE 0 END)          AS belum_datang,
      SUM(CASE WHEN pl.status_datang IN ('TELAT','VONIS') THEN 1 ELSE 0 END) AS telat
    FROM santri s
    INNER JOIN perpulangan_log pl ON pl.santri_id = s.id AND pl.periode_id = ?
    WHERE s.status_global = 'aktif' AND s.asrama = ?
    GROUP BY s.kamar
    ORDER BY CAST(s.kamar AS INTEGER), s.kamar
  `, [periodeId, asrama])

  return rows
}

// ─── List santri dalam 1 kamar (lazy, dipanggil saat kamar diklik) ────────────
export async function getMonitoringSantriKamar(
  periodeId: number,
  asrama: string,
  kamar: string
) {
  return query<{
    id: string
    nama_lengkap: string
    nis: string
    jenis_pulang: string | null
    status_pulang: string
    status_datang: string
    keterangan: string | null
    tgl_pulang: string | null
    tgl_datang: string | null
  }>(`
    SELECT s.id, s.nama_lengkap, s.nis,
           pl.jenis_pulang, pl.status_pulang, pl.status_datang,
           pl.keterangan, pl.tgl_pulang, pl.tgl_datang
    FROM santri s
    INNER JOIN perpulangan_log pl ON pl.santri_id = s.id AND pl.periode_id = ?
    WHERE s.status_global = 'aktif' AND s.asrama = ? AND s.kamar = ?
    ORDER BY s.nama_lengkap
  `, [periodeId, asrama, kamar])
}
