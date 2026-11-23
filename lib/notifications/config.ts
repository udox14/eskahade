// Konfigurasi efektif per jenis notifikasi = default katalog + override admin.

import { NOTIF_EVENTS, requireEventDefinition } from './catalog'
import { validateTemplates } from './render'
import {
  NOTIF_CHANNELS, type EffectiveEventConfig, type NotifChannel, type NotifEventDefinition,
  type NotifStore, type PushPrivacy, type StaffRecipientRule, type StaffScope,
} from './types'

interface OverrideRow {
  code: string
  is_enabled: number | null
  is_mandatory: number | null
  channels_json: string | null
  title_template: string | null
  in_app_template: string | null
  push_template: string | null
  push_privacy: string | null
  recipient_rule_json: string | null
  updated_by: string | null
  updated_at: string | null
}

const STAFF_SCOPES: StaffScope[] = ['ALL', 'TRANSFER_VERIFIER', 'ASRAMA_BINAAN']
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const ROLE_RE = /^[a-z_]+(:[a-z_]+)?$/

function parseChannels(raw: string | null, fallback: NotifChannel[]): NotifChannel[] {
  if (!raw) return fallback
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return fallback
    return NOTIF_CHANNELS.filter(c => value.includes(c))
  } catch {
    return fallback
  }
}

/** Validasi ketat; nilai tidak valid dari DB jatuh ke default katalog, bukan diterima. */
export function normalizeRecipientRule(input: unknown): StaffRecipientRule | null {
  if (!input || typeof input !== 'object') return null
  const r = input as Record<string, unknown>
  const list = (v: unknown, re: RegExp) => Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === 'string' && re.test(x)))].slice(0, 100) : []
  const scope = STAFF_SCOPES.includes(r.scope as StaffScope) ? r.scope as StaffScope : 'ALL'
  return {
    roles: list(r.roles, ROLE_RE),
    scope,
    includeUserIds: list(r.includeUserIds, ID_RE),
    excludeUserIds: list(r.excludeUserIds, ID_RE),
    notifyActor: r.notifyActor === true,
    excludeActor: r.excludeActor !== false,
  }
}

function parseRule(raw: string | null, def: NotifEventDefinition): StaffRecipientRule | null {
  if (def.audience !== 'STAFF') return null
  if (raw) {
    try {
      const rule = normalizeRecipientRule(JSON.parse(raw))
      if (rule) return rule
    } catch { /* jatuh ke default */ }
  }
  return def.defaultRecipients ?? null
}

function merge(def: NotifEventDefinition, row: OverrideRow | null): EffectiveEventConfig {
  const pushPrivacy: PushPrivacy = row?.push_privacy === 'FULL' || row?.push_privacy === 'MASKED' ? row.push_privacy : def.defaultPushPrivacy
  return {
    definition: def,
    enabled: row?.is_enabled == null ? def.defaultEnabled : Number(row.is_enabled) === 1,
    mandatory: row?.is_mandatory == null ? def.defaultMandatory : Number(row.is_mandatory) === 1,
    channels: parseChannels(row?.channels_json ?? null, def.defaultChannels),
    title: row?.title_template ?? def.title,
    inApp: row?.in_app_template ?? def.inApp,
    push: row?.push_template ?? def.push,
    pushPrivacy,
    recipients: parseRule(row?.recipient_rule_json ?? null, def),
    overridden: !!row,
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at ?? null,
  }
}

export async function getEffectiveConfig(store: NotifStore, code: string): Promise<EffectiveEventConfig> {
  const def = requireEventDefinition(code)
  const row = await store.queryOne<OverrideRow>('SELECT * FROM notif_event_types WHERE code = ?', [code])
  return merge(def, row)
}

export async function listEffectiveConfigs(store: NotifStore): Promise<EffectiveEventConfig[]> {
  const rows = await store.query<OverrideRow>('SELECT * FROM notif_event_types')
  const byCode = new Map(rows.map(r => [r.code, r]))
  return NOTIF_EVENTS.map(def => merge(def, byCode.get(def.code) ?? null))
}

export interface EventConfigInput {
  enabled: boolean
  mandatory: boolean
  channels: NotifChannel[]
  title: string
  inApp: string
  push: string
  pushPrivacy: PushPrivacy
  recipients?: StaffRecipientRule | null
}

export function validateConfigInput(def: NotifEventDefinition, input: EventConfigInput): string[] {
  const errors = validateTemplates(def, input)
  if (!input.channels.includes('in_app')) errors.push('Kanal in-app wajib aktif agar riwayat notifikasi tetap tersimpan.')
  if (def.audience === 'STAFF') {
    const rule = input.recipients
    if (!rule) errors.push('Aturan penerima wajib diisi.')
    else if (!rule.roles.length && !rule.includeUserIds.length && !rule.notifyActor) {
      errors.push('Pilih minimal satu role, pengguna, atau kirim ke pengaju.')
    }
  }
  return errors
}

/** Simpan override. Hanya kolom yang berbeda dari default yang disimpan (NULL = ikut default). */
export async function saveEventConfig(store: NotifStore, code: string, input: EventConfigInput, actorId: string) {
  const def = requireEventDefinition(code)
  const channels = NOTIF_CHANNELS.filter(c => input.channels.includes(c))
  const recipients = def.audience === 'STAFF' ? normalizeRecipientRule(input.recipients) : null
  const normalized: EventConfigInput = {
    enabled: input.enabled === true,
    mandatory: input.mandatory === true,
    channels,
    title: String(input.title ?? '').trim(),
    inApp: String(input.inApp ?? '').trim(),
    push: String(input.push ?? '').trim(),
    pushPrivacy: input.pushPrivacy === 'FULL' ? 'FULL' : 'MASKED',
    recipients,
  }
  const errors = validateConfigInput(def, normalized)
  if (errors.length) throw new Error(errors.join(' '))

  const same = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b)
  await store.execute(
    `INSERT INTO notif_event_types (code, is_enabled, is_mandatory, channels_json, title_template, in_app_template,
       push_template, push_privacy, recipient_rule_json, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET is_enabled = excluded.is_enabled, is_mandatory = excluded.is_mandatory,
       channels_json = excluded.channels_json, title_template = excluded.title_template,
       in_app_template = excluded.in_app_template, push_template = excluded.push_template,
       push_privacy = excluded.push_privacy, recipient_rule_json = excluded.recipient_rule_json,
       updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    [
      code,
      normalized.enabled === def.defaultEnabled ? null : Number(normalized.enabled),
      normalized.mandatory === def.defaultMandatory ? null : Number(normalized.mandatory),
      same(channels, NOTIF_CHANNELS.filter(c => def.defaultChannels.includes(c))) ? null : JSON.stringify(channels),
      normalized.title === def.title ? null : normalized.title,
      normalized.inApp === def.inApp ? null : normalized.inApp,
      normalized.push === def.push ? null : normalized.push,
      normalized.pushPrivacy === def.defaultPushPrivacy ? null : normalized.pushPrivacy,
      recipients && !same(recipients, def.defaultRecipients ?? null) ? JSON.stringify(recipients) : null,
      actorId,
      new Date().toISOString(),
    ],
  )
  return getEffectiveConfig(store, code)
}

export async function resetEventConfig(store: NotifStore, code: string) {
  requireEventDefinition(code)
  await store.execute('DELETE FROM notif_event_types WHERE code = ?', [code])
  return getEffectiveConfig(store, code)
}

export async function readNotifSetting(store: NotifStore, key: 'notifications_enabled' | 'notifications_push_enabled'): Promise<boolean> {
  const row = await store.queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key])
  // Tidak ada baris = migration belum lengkap → fail closed.
  return row?.value === '1'
}
