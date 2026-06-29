'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { assertFeature } from '@/lib/auth/feature'
import { execute } from '@/lib/db'
import { getSantriBaruSettings } from '@/lib/santri/kategori-settings'
import {
  normalizeDurasiBulan,
  normalizeMulaiBerlaku,
  SANTRI_BARU_DURASI_KEY,
  SANTRI_BARU_MULAI_KEY,
} from '@/lib/santri/kategori'

const FEATURE_PATH = '/dashboard/pengaturan/santri-baru'

export async function getPengaturanSantriBaru() {
  const access = await assertFeature(FEATURE_PATH)
  if ('error' in access) return access
  return getSantriBaruSettings()
}

export async function simpanPengaturanSantriBaru(input: {
  mulaiBerlaku: string
  durasiBulan: number
}) {
  const access = await assertFeature(FEATURE_PATH)
  if ('error' in access) return access

  const mulaiBerlaku = normalizeMulaiBerlaku(input.mulaiBerlaku)
  const durasiBulan = normalizeDurasiBulan(input.durasiBulan)

  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [SANTRI_BARU_MULAI_KEY, mulaiBerlaku]
  )
  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [SANTRI_BARU_DURASI_KEY, String(durasiBulan)]
  )

  await logActivity({
    actor: actorFromSession(access),
    module: 'pengaturan_santri_baru',
    action: 'update',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'app_setting',
    entityId: 'santri_baru',
    entityLabel: 'Pengaturan masa santri baru',
    summary: `Memperbarui pengaturan masa santri baru`,
    details: { mulai_berlaku: mulaiBerlaku, durasi_bulan: durasiBulan },
  })

  revalidatePath('/dashboard/santri')
  revalidatePath('/dashboard/asrama/kamar')
  revalidatePath('/dashboard/asrama/plotting-kamar-manual')
  revalidatePath(FEATURE_PATH)
  return { success: true, mulaiBerlaku, durasiBulan }
}
