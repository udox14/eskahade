export const KATEGORI_SANTRI_DASAR = ['REGULER', 'SADESA'] as const
export const KATEGORI_SANTRI_EFEKTIF = ['BARU', ...KATEGORI_SANTRI_DASAR] as const

export type KategoriSantriDasar = (typeof KATEGORI_SANTRI_DASAR)[number]
export type KategoriSantriEfektif = (typeof KATEGORI_SANTRI_EFEKTIF)[number]

export const SANTRI_BARU_MULAI_KEY = 'santri_baru_mulai_berlaku'
export const SANTRI_BARU_DURASI_KEY = 'santri_baru_durasi_bulan'
export const DEFAULT_SANTRI_BARU_MULAI = '2026-07-01'
export const DEFAULT_SANTRI_BARU_DURASI_BULAN = 3

export function normalizeKategoriSantriDasar(value: unknown): KategoriSantriDasar {
  return String(value ?? '').trim().toUpperCase() === 'SADESA' ? 'SADESA' : 'REGULER'
}

export function getKategoriSantriEfektifSql(alias = 's') {
  const mulaiSql = `(SELECT value FROM app_settings WHERE key = '${SANTRI_BARU_MULAI_KEY}')`
  const durasiSql = `(SELECT value FROM app_settings WHERE key = '${SANTRI_BARU_DURASI_KEY}')`
  return `CASE
    WHEN ${alias}.status_global = 'aktif'
      AND ${alias}.created_at IS NOT NULL
      AND date(${alias}.created_at) >= date(COALESCE(${mulaiSql}, '${DEFAULT_SANTRI_BARU_MULAI}'))
      AND datetime(${alias}.created_at) >= datetime('now', '-' || MIN(24, MAX(1, CAST(COALESCE(${durasiSql}, '${DEFAULT_SANTRI_BARU_DURASI_BULAN}') AS INTEGER))) || ' months')
    THEN 'BARU'
    ELSE COALESCE(NULLIF(${alias}.kategori_santri, ''), 'REGULER')
  END`
}

export function getKategoriSantriEfektifCondition(alias = 's') {
  const mulaiSql = `(SELECT value FROM app_settings WHERE key = '${SANTRI_BARU_MULAI_KEY}')`
  const durasiSql = `(SELECT value FROM app_settings WHERE key = '${SANTRI_BARU_DURASI_KEY}')`
  return `${alias}.status_global = 'aktif'
    AND ${alias}.created_at IS NOT NULL
    AND date(${alias}.created_at) >= date(COALESCE(${mulaiSql}, '${DEFAULT_SANTRI_BARU_MULAI}'))
    AND datetime(${alias}.created_at) >= datetime('now', '-' || MIN(24, MAX(1, CAST(COALESCE(${durasiSql}, '${DEFAULT_SANTRI_BARU_DURASI_BULAN}') AS INTEGER))) || ' months')`
}

export type SantriBaruSettings = {
  mulaiBerlaku: string
  durasiBulan: number
}

export function normalizeMulaiBerlaku(value: unknown) {
  const text = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : DEFAULT_SANTRI_BARU_MULAI
}

export function normalizeDurasiBulan(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return DEFAULT_SANTRI_BARU_DURASI_BULAN
  return Math.min(24, Math.max(1, Math.trunc(numberValue)))
}
