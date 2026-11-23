// Tipe bersama sistem notifikasi. Modul ini murni (tanpa import runtime) agar bisa
// dipakai di app Worker, cron Worker, dan test node:sqlite.

export type NotifChannel = 'in_app' | 'webpush' | 'fcm'
export const NOTIF_CHANNELS: readonly NotifChannel[] = ['in_app', 'webpush', 'fcm']

export type NotifAudience = 'PARENT' | 'STAFF'
export type NotifLevel = 'info' | 'success' | 'warning' | 'danger'
export type PushPrivacy = 'MASKED' | 'FULL'
export type RecipientKind = 'USER' | 'SANTRI'

export interface NotifRecipient {
  kind: RecipientKind
  id: string
}

export type PlaceholderFormat = 'text' | 'rupiah' | 'date' | 'datetime'

export interface PlaceholderDef {
  key: string
  label: string
  format: PlaceholderFormat
  /** Nilai sensitif (nominal, alasan) tidak boleh dipakai di template push MASKED. */
  sensitive?: boolean
  sample: string | number
}

/**
 * Aturan penerima pegawai.
 * - roles: salah satu role efektif user harus ada di daftar (admin selalu termasuk bila didaftarkan).
 * - scope: penyaring tambahan berdasarkan payload (asrama).
 * - requireHref: penerima harus punya akses ke halaman tautan (fitur_akses + override).
 */
export type StaffScope = 'ALL' | 'TRANSFER_VERIFIER' | 'ASRAMA_BINAAN'

export interface StaffRecipientRule {
  roles: string[]
  scope: StaffScope
  includeUserIds: string[]
  excludeUserIds: string[]
  /** Kirim juga ke pelaku/pengaju (payload.actor_user_id), mis. hasil persetujuan. */
  notifyActor: boolean
  /** Jangan kirim ke pelaku aksi itu sendiri. */
  excludeActor: boolean
}

export interface NotifEventDefinition {
  code: string
  module: string
  category: string
  audience: NotifAudience
  label: string
  description: string
  /** Sudah dipasang di titik event (fase NOTIF-4/5). false = belum terhubung. */
  wired: boolean
  defaultEnabled: boolean
  defaultMandatory: boolean
  defaultChannels: NotifChannel[]
  level: NotifLevel
  title: string
  inApp: string
  /** Redaksi push layar kunci saat privasi MASKED; tidak boleh memuat placeholder sensitif. */
  push: string
  defaultPushPrivacy: PushPrivacy
  link: string
  placeholders: PlaceholderDef[]
  /** Hanya untuk audience STAFF. */
  defaultRecipients?: StaffRecipientRule
}

/** Konfigurasi efektif = default katalog + override admin. */
export interface EffectiveEventConfig {
  definition: NotifEventDefinition
  enabled: boolean
  mandatory: boolean
  channels: NotifChannel[]
  title: string
  inApp: string
  push: string
  pushPrivacy: PushPrivacy
  recipients: StaffRecipientRule | null
  overridden: boolean
  updatedBy: string | null
  updatedAt: string | null
}

export type NotifPayload = Record<string, string | number | boolean | null | undefined>

/** Akses database eksplisit. Tanpa sesi, cookie, atau fallback environment. */
export interface NotifStore {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>
  execute(sql: string, params?: unknown[]): Promise<{ success: boolean }>
  batch(statements: Array<{ sql: string; params: unknown[] }>): Promise<void>
}

export interface SqlStatement {
  sql: string
  params: unknown[]
}
