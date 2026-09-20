// lib/print/letterhead-server.ts
// Server-only data access untuk Kop Surat & Dokumen Cetak (menggunakan @/lib/db)

import { queryOne, execute } from '@/lib/db'
import {
  LetterheadProfile,
  DocumentPrintConfig,
  LetterheadMode,
  DEFAULT_LETTERHEAD_PROFILES,
  DEFAULT_DOCUMENT_PRINT_CONFIGS,
} from './letterhead'

const PROFILES_SETTING_KEY = 'print_letterhead_profiles'
const CONFIGS_SETTING_KEY = 'print_document_settings'

/**
 * Mengambil daftar profil kop surat dari DB (atau default fallback).
 */
export async function getLetterheadProfiles(): Promise<LetterheadProfile[]> {
  try {
    const row = await queryOne<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [PROFILES_SETTING_KEY]
    )
    if (row?.value) {
      const parsed = JSON.parse(row.value)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.error('Error fetching letterhead profiles from app_settings:', err)
  }
  return DEFAULT_LETTERHEAD_PROFILES
}

/**
 * Menyimpan daftar profil kop ke app_settings.
 */
export async function saveLetterheadProfiles(profiles: LetterheadProfile[]): Promise<void> {
  const json = JSON.stringify(profiles)
  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [PROFILES_SETTING_KEY, json]
  )
}

/**
 * Mengambil konfigurasi per-dokumen dari DB (atau default fallback).
 */
export async function getDocumentPrintConfigs(): Promise<DocumentPrintConfig[]> {
  try {
    const row = await queryOne<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [CONFIGS_SETTING_KEY]
    )
    if (row?.value) {
      const parsed = JSON.parse(row.value)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with defaults to ensure all document types exist
        const map = new Map<string, DocumentPrintConfig>()
        DEFAULT_DOCUMENT_PRINT_CONFIGS.forEach((d) => map.set(d.documentKey, { ...d }))
        parsed.forEach((item: DocumentPrintConfig) => {
          if (item?.documentKey) {
            const existing = map.get(item.documentKey)
            map.set(item.documentKey, { ...existing, ...item })
          }
        })
        return Array.from(map.values())
      }
    }
  } catch (err) {
    console.error('Error fetching document print configs:', err)
  }
  return DEFAULT_DOCUMENT_PRINT_CONFIGS
}

/**
 * Menyimpan konfigurasi per-dokumen ke app_settings.
 */
export async function saveDocumentPrintConfigs(configs: DocumentPrintConfig[]): Promise<void> {
  const json = JSON.stringify(configs)
  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [CONFIGS_SETTING_KEY, json]
  )
}

/**
 * Menyelesaikan profil kop yang aktif untuk suatu dokumen.
 */
export async function resolveDocumentLetterhead(
  documentKey: string
): Promise<{
  mode: LetterheadMode
  profile: LetterheadProfile | null
  config: DocumentPrintConfig | null
}> {
  const [profiles, configs] = await Promise.all([
    getLetterheadProfiles(),
    getDocumentPrintConfigs(),
  ])

  const defaultProfile =
    profiles.find((p) => p.isDefault) ||
    profiles[0] ||
    DEFAULT_LETTERHEAD_PROFILES[0]

  const docConfig = configs.find((c) => c.documentKey === documentKey)
  if (!docConfig) {
    return {
      mode: 'default',
      profile: defaultProfile,
      config: null,
    }
  }

  if (docConfig.mode === 'none') {
    return {
      mode: 'none',
      profile: null,
      config: docConfig,
    }
  }

  if (docConfig.mode === 'profile' && docConfig.profileId) {
    const customProfile = profiles.find((p) => p.id === docConfig.profileId)
    return {
      mode: 'profile',
      profile: customProfile || defaultProfile,
      config: docConfig,
    }
  }

  return {
    mode: 'default',
    profile: defaultProfile,
    config: docConfig,
  }
}
