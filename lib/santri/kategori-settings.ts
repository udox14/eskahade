import { execute, queryOne } from '@/lib/db'
import {
  DEFAULT_SANTRI_BARU_DURASI_BULAN,
  DEFAULT_SANTRI_BARU_MULAI,
  normalizeDurasiBulan,
  normalizeMulaiBerlaku,
  SANTRI_BARU_DURASI_KEY,
  SANTRI_BARU_MULAI_KEY,
  type SantriBaruSettings,
} from '@/lib/santri/kategori'

export async function ensureSantriBaruSettings() {
  await execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  await execute(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`,
    [SANTRI_BARU_MULAI_KEY, DEFAULT_SANTRI_BARU_MULAI]
  )
  await execute(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`,
    [SANTRI_BARU_DURASI_KEY, String(DEFAULT_SANTRI_BARU_DURASI_BULAN)]
  )
}

export async function getSantriBaruSettings(): Promise<SantriBaruSettings> {
  await ensureSantriBaruSettings()
  const [mulai, durasi] = await Promise.all([
    queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [SANTRI_BARU_MULAI_KEY]),
    queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [SANTRI_BARU_DURASI_KEY]),
  ])

  return {
    mulaiBerlaku: normalizeMulaiBerlaku(mulai?.value),
    durasiBulan: normalizeDurasiBulan(durasi?.value),
  }
}
