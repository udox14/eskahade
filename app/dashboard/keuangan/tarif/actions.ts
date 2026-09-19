'use server'

// app/dashboard/keuangan/tarif/actions.ts
// Server Actions untuk Modul Pengaturan Keuangan SPA (Patch B: PRD Bab 31 & Implementation Plan)
//
// Meliputi:
// 1. Tarif & Cicilan (Versioned Tariffs, Overlap Prevention, Immutability)
// 2. Pembebasan Biaya (Non-retroactive, Lifecycle ACTIVE/REVOKED)
// 3. Limit Uang Jajan (Global Limit, Read-only Wallet Balances)
// 4. Payment Gateway Duitku & Fixed VA (Sensitive Data Masking, Fee Payer, Settlement)
// 5. Otorisasi Mutasi Server-side (Admin & Bendahara mutasi, Pimpinan view-only)

import { query, queryOne, execute, now } from '@/lib/db'
import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import {
  listTariffs,
  createTariff,
} from '@/lib/finance/tariffs'
import {
  grantExemption,
  revokeExemption,
} from '@/lib/finance/exemptions'
import {
  getGlobalDailyLimit,
  setGlobalDailyLimit,
  DEFAULT_GLOBAL_DAILY_LIMIT,
} from '@/lib/finance/wallet'
import {
  getDuitkuV2Config,
} from '@/lib/finance/gateway/duitku-v2'
import {
  getDuitkuSnapConfig,
} from '@/lib/finance/gateway/duitku-snap'
import type {
  FinanceTariff,
  FinanceItemType,
  FinanceInstallmentRule,
} from '@/lib/finance/types'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface UserFinancePermissions {
  canMutate: boolean
  role: string
  fullName: string
}

export interface AcademicYearOption {
  id: number
  nama: string
  is_active: number
}

export interface ExemptionWithStudent {
  id: string
  santri_id: string
  santri_nama: string
  santri_nis: string
  santri_asrama: string | null
  santri_kamar: string | null
  item_type: string
  academic_year_id: number | null
  academic_year_nama: string | null
  period_start: string | null
  period_end: string | null
  reason: string
  notes: string | null
  status: 'ACTIVE' | 'REVOKED'
  revoked_at: string | null
  revoked_by: string | null
  revocation_reason: string | null
  created_by: string | null
  created_at: string
}

export interface StudentWalletLimitRow {
  santri_id: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  saldo_uang_jajan: number
  parent_daily_limit: number | null
  parent_weekly_limit: number | null
  parent_monthly_limit: number | null
  effective_daily_limit: number
}

export interface MaskedGatewaySettings {
  environment: 'sandbox' | 'production'
  merchantCode: string
  callbackUrl: string
  returnUrl: string
  defaultExpiryMinutes: number
  apiKeyConfigured: boolean
  apiKeyMasked: string
  feePayer: 'CUSTOMER' | 'INSTITUTION'
  defaultVaFee: number
  defaultQrisFeePercent: number
  enabledChannels: Array<'DUITKU_VA' | 'DUITKU_QRIS'>
  snapPartnerId: string
  snapPartnerServiceId: string
  snapDefaultTrxType: 'C' | 'O'
  snapClientSecretConfigured: boolean
  snapClientSecretMasked: string
  snapPrivateKeyConfigured: boolean
  snapPublicKeyConfigured: boolean
  settlementDestinationBank: string
  settlementDestinationAccount: string
  settlementAccountHolder: string
  totalFixedVaRegistered: number
}

export interface PengaturanKeuanganData {
  tariffs: FinanceTariff[]
  academicYears: AcademicYearOption[]
  exemptions: ExemptionWithStudent[]
  globalDailyLimit: number
  studentLimits: StudentWalletLimitRow[]
  gatewayConfig: MaskedGatewaySettings
  userPermissions: UserFinancePermissions
}

export interface GatewaySettingsUpdateInput {
  environment?: 'sandbox' | 'production'
  merchantCode?: string
  callbackUrl?: string
  returnUrl?: string
  defaultExpiryMinutes?: number
  newApiKey?: string
  feePayer?: 'CUSTOMER' | 'INSTITUTION'
  defaultVaFee?: number
  defaultQrisFeePercent?: number
  enabledChannels?: Array<'DUITKU_VA' | 'DUITKU_QRIS'>
  snapPartnerServiceId?: string
  snapDefaultTrxType?: 'C' | 'O'
  newSnapClientSecret?: string
  settlementDestinationBank?: string
  settlementDestinationAccount?: string
  settlementAccountHolder?: string
}

// ─── HELPER OTORISASI SERVER-SIDE ───────────────────────────────────────────

async function assertMutationPermission(): Promise<{ userId: string; role: string }> {
  const session = await getSession()
  if (!session) {
    throw new Error('Sesi autentikasi telah berakhir. Silakan login kembali.')
  }

  const roles = getEffectiveRoles(session)
  const canMutate = roles.includes('admin') || roles.includes('bendahara')

  if (!canMutate) {
    throw new Error('Akses ditolak: role Anda (misal Pimpinan) hanya memiliki izin view-only untuk pengaturan keuangan.')
  }

  return {
    userId: session.id,
    role: roles.includes('admin') ? 'admin' : 'bendahara',
  }
}

// ─── QUERY DATA LENGKAP PENGATURAN KE UANGAN ────────────────────────────────

export async function getPengaturanKeuanganData(): Promise<PengaturanKeuanganData> {
  const session = await getSession()
  const roles = session ? getEffectiveRoles(session) : []
  const canMutate = roles.includes('admin') || roles.includes('bendahara')
  const userRole = roles.includes('admin') ? 'admin' : roles.includes('bendahara') ? 'bendahara' : roles[0] || 'viewer'
  const fullName = session?.full_name || 'Pengguna'

  // 1. Data Tarif Terversi (immutable)
  const tariffs = await listTariffs().catch(() => [])

  // 2. Tahun Ajaran
  const academicYears = await query<AcademicYearOption>(
    `SELECT id, nama, is_active FROM tahun_ajaran ORDER BY is_active DESC, nama DESC`
  ).catch(() => [])

  // 3. Pembebasan Biaya + Join Santri & Tahun Ajaran
  const exemptions = await query<ExemptionWithStudent>(
    `SELECT
       e.id, e.santri_id, e.item_type, e.academic_year_id,
       e.period_start, e.period_end, e.reason, e.notes,
       e.status, e.revoked_at, e.revoked_by, e.revocation_reason,
       e.created_by, e.created_at,
       s.nama_lengkap AS santri_nama,
       s.nis AS santri_nis,
       s.asrama AS santri_asrama,
       s.kamar AS santri_kamar,
       ta.nama AS academic_year_nama
     FROM finance_exemptions e
     JOIN santri s ON s.id = e.santri_id
     LEFT JOIN tahun_ajaran ta ON ta.id = e.academic_year_id
     ORDER BY e.created_at DESC`
  ).catch(() => [])

  // 4. Limit Uang Jajan Global & Contoh Santri
  const globalDailyLimit = await getGlobalDailyLimit().catch(() => DEFAULT_GLOBAL_DAILY_LIMIT)

  const studentRows = await query<{
    santri_id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    saldo_uang_jajan: number | null
    parent_daily_limit: number | null
    parent_weekly_limit: number | null
    parent_monthly_limit: number | null
  }>(
    `SELECT
       s.id AS santri_id,
       s.nis,
       s.nama_lengkap,
       s.asrama,
       s.kamar,
       s.saldo_uang_jajan,
       wl.parent_daily_limit,
       wl.parent_weekly_limit,
       wl.parent_monthly_limit
     FROM santri s
     LEFT JOIN finance_wallet_limits wl ON wl.santri_id = s.id
     WHERE s.status_global = 'aktif'
     ORDER BY s.nama_lengkap ASC
     LIMIT 50`
  ).catch(() => [])

  const studentLimits: StudentWalletLimitRow[] = studentRows.map((s) => {
    const parentDaily = s.parent_daily_limit !== null ? Number(s.parent_daily_limit) : null
    const effectiveDaily = parentDaily !== null ? Math.min(globalDailyLimit, parentDaily) : globalDailyLimit

    return {
      santri_id: s.santri_id,
      nis: s.nis,
      nama_lengkap: s.nama_lengkap,
      asrama: s.asrama,
      kamar: s.kamar,
      saldo_uang_jajan: Number(s.saldo_uang_jajan || 0),
      parent_daily_limit: parentDaily,
      parent_weekly_limit: s.parent_weekly_limit !== null ? Number(s.parent_weekly_limit) : null,
      parent_monthly_limit: s.parent_monthly_limit !== null ? Number(s.parent_monthly_limit) : null,
      effective_daily_limit: effectiveDaily,
    }
  })

  // 5. Konfigurasi Gateway & Fixed VA Ter-Masking
  const [duitkuV2, snapConfig, settingsRows, vaCountRow] = await Promise.all([
    getDuitkuV2Config().catch(() => ({
      merchantCode: '',
      apiKey: '',
      environment: 'sandbox' as const,
      callbackUrl: undefined,
      returnUrl: undefined,
      defaultExpiryMinutes: 1440,
    })),
    getDuitkuSnapConfig().catch(() => ({
      partnerId: '',
      partnerServiceId: '',
      clientSecret: '',
      privateKey: '',
      duitkuPublicKey: undefined,
      environment: 'sandbox' as const,
      defaultTrxType: 'C' as const,
    })),
    query<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key IN (
        'gateway_fee_payer',
        'gateway_default_va_fee',
        'gateway_default_qris_fee_percent',
        'gateway_channels_enabled',
        'settlement_destination_bank',
        'settlement_destination_account',
        'settlement_account_holder'
      )`
    ).catch(() => []),
    queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM finance_student_va`).catch(() => ({ count: 0 })),
  ])

  const settingsMap = new Map<string, string>()
  settingsRows.forEach((r) => settingsMap.set(r.key, r.value))

  const feePayer = (settingsMap.get('gateway_fee_payer') === 'INSTITUTION' ? 'INSTITUTION' : 'CUSTOMER') as
    | 'CUSTOMER'
    | 'INSTITUTION'
  const defaultVaFee = parseInt(settingsMap.get('gateway_default_va_fee') || '4000', 10) || 4000
  const defaultQrisFeePercent = parseFloat(settingsMap.get('gateway_default_qris_fee_percent') || '0.7') || 0.7
  const settlementDestinationBank = settingsMap.get('settlement_destination_bank') || 'Bank Syariah Indonesia (BSI)'
  const settlementDestinationAccount = settingsMap.get('settlement_destination_account') || ''
  const settlementAccountHolder = settingsMap.get('settlement_account_holder') || 'Pesantren SKH'

  let enabledChannels: Array<'DUITKU_VA' | 'DUITKU_QRIS'> = ['DUITKU_VA', 'DUITKU_QRIS']
  const channelsRaw = settingsMap.get('gateway_channels_enabled')
  if (channelsRaw) {
    try {
      const parsed = JSON.parse(channelsRaw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((c: unknown): c is 'DUITKU_VA' | 'DUITKU_QRIS' =>
          c === 'DUITKU_VA' || c === 'DUITKU_QRIS'
        )
        if (valid.length > 0) enabledChannels = valid
      }
    } catch {}
  }

  const hasApiKey = Boolean(duitkuV2.apiKey && duitkuV2.apiKey.length > 0)
  const hasSnapSecret = Boolean(snapConfig.clientSecret && snapConfig.clientSecret.length > 0)
  const hasSnapPrivateKey = Boolean(snapConfig.privateKey && snapConfig.privateKey.length > 0)
  const hasSnapPublicKey = Boolean(snapConfig.duitkuPublicKey && snapConfig.duitkuPublicKey.length > 0)

  const gatewayConfig: MaskedGatewaySettings = {
    environment: duitkuV2.environment,
    merchantCode: duitkuV2.merchantCode,
    callbackUrl: duitkuV2.callbackUrl || '/api/finance/gateway/duitku/callback',
    returnUrl: duitkuV2.returnUrl || '/portal-ortu/tagihan',
    defaultExpiryMinutes: duitkuV2.defaultExpiryMinutes,
    apiKeyConfigured: hasApiKey,
    apiKeyMasked: hasApiKey ? '••••••••••••••••••••••••' : '',
    feePayer,
    defaultVaFee,
    defaultQrisFeePercent,
    enabledChannels,
    snapPartnerId: snapConfig.partnerId || duitkuV2.merchantCode,
    snapPartnerServiceId: snapConfig.partnerServiceId,
    snapDefaultTrxType: snapConfig.defaultTrxType,
    snapClientSecretConfigured: hasSnapSecret,
    snapClientSecretMasked: hasSnapSecret ? '••••••••••••••••••••••••' : '',
    snapPrivateKeyConfigured: hasSnapPrivateKey,
    snapPublicKeyConfigured: hasSnapPublicKey,
    settlementDestinationBank,
    settlementDestinationAccount,
    settlementAccountHolder,
    totalFixedVaRegistered: vaCountRow?.count || 0,
  }

  return {
    tariffs,
    academicYears,
    exemptions,
    globalDailyLimit,
    studentLimits,
    gatewayConfig,
    userPermissions: {
      canMutate,
      role: userRole,
      fullName,
    },
  }
}

// ─── SERVER ACTIONS: TARIF & CICILAN ────────────────────────────────────────

export async function createTariffAction(input: {
  item_type: FinanceItemType
  academic_year_id?: number | null
  nominal: number
  installment_rule?: FinanceInstallmentRule
  effective_from: string
  effective_until?: string | null
}): Promise<{ success: boolean; tariff?: FinanceTariff; error?: string }> {
  try {
    const { userId } = await assertMutationPermission()

    // Enforce PRD Installment Rules
    let installmentRule = input.installment_rule ?? 'DISALLOWED'
    if (input.item_type === 'SPP') {
      installmentRule = 'DISALLOWED'
    } else if (input.item_type === 'USPP') {
      installmentRule = 'ALLOWED'
    }

    const created = await createTariff({
      item_type: input.item_type,
      academic_year_id: input.academic_year_id ?? null,
      nominal: input.nominal,
      installment_rule: installmentRule,
      effective_from: input.effective_from,
      effective_until: input.effective_until ?? null,
      created_by: userId,
    })

    revalidatePath('/dashboard/keuangan/tarif')
    return { success: true, tariff: created }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ─── SERVER ACTIONS: PEMBEBASAN BIAYA ────────────────────────────────────────

export async function grantExemptionAction(input: {
  santri_id: string
  item_type: FinanceItemType | 'ALL'
  academic_year_id?: number | null
  period_start?: string | null
  period_end?: string | null
  reason: string
  notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await assertMutationPermission()

    if (!input.santri_id) {
      return { success: false, error: 'Santri wajib dipilih.' }
    }
    if (!input.reason || input.reason.trim().length === 0) {
      return { success: false, error: 'Alasan pembebasan wajib diisi.' }
    }

    await grantExemption({
      santri_id: input.santri_id,
      item_type: input.item_type,
      academic_year_id: input.academic_year_id ?? null,
      period_start: input.period_start || null,
      period_end: input.period_end || null,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
      created_by: userId,
    })

    revalidatePath('/dashboard/keuangan/tarif')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function revokeExemptionAction(
  exemptionId: string,
  reason: string
): Promise<{ success: boolean; error?: string; restoredCount?: number }> {
  try {
    const { userId } = await assertMutationPermission()

    if (!exemptionId) {
      return { success: false, error: 'ID pembebasan tidak valid.' }
    }
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Alasan pencabutan pembebasan wajib diisi.' }
    }

    const res = await revokeExemption(exemptionId, {
      revokedBy: userId,
      reason: reason.trim(),
    })

    revalidatePath('/dashboard/keuangan/tarif')
    return { success: true, restoredCount: res.restoredCount }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ─── SERVER ACTIONS: LIMIT UANG JAJAN ───────────────────────────────────────

export async function updateGlobalDailyLimitAction(
  limit: number
): Promise<{ success: boolean; error?: string; limit?: number }> {
  try {
    await assertMutationPermission()

    if (!Number.isFinite(limit) || limit < 0) {
      return { success: false, error: 'Limit harian harus berupa angka non-negatif.' }
    }

    await setGlobalDailyLimit(limit)

    revalidatePath('/dashboard/keuangan/tarif')
    revalidatePath('/dashboard/keuangan/uang-jajan')
    return { success: true, limit: Math.floor(limit) }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ─── SERVER ACTIONS: PAYMENT GATEWAY DUITKU & SETTLEMENT ───────────────────

export async function saveGatewaySettingsAction(
  input: GatewaySettingsUpdateInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertMutationPermission()

    const currentNow = now()
    const updates: Array<{ key: string; value: string }> = []

    if (input.environment) {
      updates.push({ key: 'duitku_env', value: input.environment })
    }
    if (input.merchantCode !== undefined) {
      updates.push({ key: 'duitku_merchant_code', value: input.merchantCode.trim() })
    }
    if (input.callbackUrl !== undefined) {
      updates.push({ key: 'duitku_callback_url', value: input.callbackUrl.trim() })
    }
    if (input.returnUrl !== undefined) {
      updates.push({ key: 'duitku_return_url', value: input.returnUrl.trim() })
    }
    if (input.defaultExpiryMinutes !== undefined) {
      updates.push({ key: 'duitku_expiry_minutes', value: String(Math.max(1, input.defaultExpiryMinutes)) })
    }
    if (input.feePayer) {
      updates.push({ key: 'gateway_fee_payer', value: input.feePayer })
    }
    if (input.defaultVaFee !== undefined) {
      updates.push({ key: 'gateway_default_va_fee', value: String(Math.max(0, input.defaultVaFee)) })
    }
    if (input.defaultQrisFeePercent !== undefined) {
      updates.push({ key: 'gateway_default_qris_fee_percent', value: String(Math.max(0, input.defaultQrisFeePercent)) })
    }
    if (input.enabledChannels && Array.isArray(input.enabledChannels) && input.enabledChannels.length > 0) {
      const sanitized = input.enabledChannels.filter(c => c === 'DUITKU_VA' || c === 'DUITKU_QRIS')
      if (sanitized.length > 0) {
        updates.push({ key: 'gateway_channels_enabled', value: JSON.stringify(sanitized) })
      }
    }
    if (input.snapPartnerServiceId !== undefined) {
      updates.push({ key: 'duitku_snap_partner_service_id', value: input.snapPartnerServiceId.trim() })
    }
    if (input.snapDefaultTrxType) {
      updates.push({ key: 'duitku_snap_default_trx_type', value: input.snapDefaultTrxType })
    }
    if (input.settlementDestinationBank !== undefined) {
      updates.push({ key: 'settlement_destination_bank', value: input.settlementDestinationBank.trim() })
    }
    if (input.settlementDestinationAccount !== undefined) {
      updates.push({ key: 'settlement_destination_account', value: input.settlementDestinationAccount.trim() })
    }
    if (input.settlementAccountHolder !== undefined) {
      updates.push({ key: 'settlement_account_holder', value: input.settlementAccountHolder.trim() })
    }

    // Jika user menginput API key baru
    if (input.newApiKey && input.newApiKey.trim().length > 0) {
      updates.push({ key: 'duitku_api_key', value: input.newApiKey.trim() })
    }
    // Jika user menginput SNAP Client Secret baru
    if (input.newSnapClientSecret && input.newSnapClientSecret.trim().length > 0) {
      updates.push({ key: 'duitku_snap_client_secret', value: input.newSnapClientSecret.trim() })
    }

    for (const item of updates) {
      await execute(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [item.key, item.value, currentNow]
      )
    }

    revalidatePath('/dashboard/keuangan/tarif')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ─── SEARCH SANTRI AKTIF UNTUK DROPDOWN PICKER ──────────────────────────────

export async function searchActiveStudents(
  searchTerm: string
): Promise<Array<{ id: string; nis: string; nama_lengkap: string; asrama: string | null; kamar: string | null }>> {
  const term = `%${searchTerm.trim()}%`
  return query<{ id: string; nis: string; nama_lengkap: string; asrama: string | null; kamar: string | null }>(
    `SELECT id, nis, nama_lengkap, asrama, kamar
     FROM santri
     WHERE status_global = 'aktif'
       AND (nama_lengkap LIKE ? OR nis LIKE ?)
     ORDER BY nama_lengkap ASC
     LIMIT 20`,
    [term, term]
  ).catch(() => [])
}
