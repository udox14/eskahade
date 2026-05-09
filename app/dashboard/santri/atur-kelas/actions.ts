'use server'

import { query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

export async function simpanSantriKeKelas(kelasId: string, santriIds: string[]) {
  const session = await getSession()
  if (!kelasId || santriIds.length === 0) return { error: 'Pilih kelas dan minimal satu santri.' }

  const now = new Date().toISOString()
  try {
    for (const santriId of santriIds) {
      await query(
        'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), santriId, kelasId, 'aktif', now]
      )
    }
  } catch {
    return { error: 'Gagal menyimpan data.' }
  }

  revalidatePath('/dashboard/santri/atur-kelas')
  await logActivity({
    actor: actorFromSession(session),
    module: 'santri_atur_kelas',
    action: 'create',
    fiturHref: '/dashboard/santri/atur-kelas',
    logKind: 'create',
    entityType: 'riwayat_pendidikan_batch',
    entityId: kelasId,
    entityLabel: kelasId,
    summary: `Menempatkan ${santriIds.length} santri ke kelas`,
    details: { kelas_id: kelasId, count: santriIds.length },
  })
  return { success: true }
}

export async function simpanPenempatanBatch(dataPenempatan: { santri_id: string; kelas_id: string }[]) {
  const session = await getSession()
  if (!dataPenempatan || dataPenempatan.length === 0) return { error: 'Data kosong.' }

  const now = new Date().toISOString()
  try {
    for (const item of dataPenempatan) {
      await query(
        'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), item.santri_id, item.kelas_id, 'aktif', now]
      )
    }
  } catch {
    return { error: 'Gagal menyimpan data batch. Pastikan santri belum punya kelas.' }
  }

  revalidatePath('/dashboard/santri/atur-kelas')
  await logActivity({
    actor: actorFromSession(session),
    module: 'santri_atur_kelas',
    action: 'create',
    fiturHref: '/dashboard/santri/atur-kelas',
    logKind: 'create',
    entityType: 'riwayat_pendidikan_batch',
    entityId: 'batch',
    entityLabel: 'Penempatan kelas batch',
    summary: `Menempatkan ${dataPenempatan.length} santri ke kelas secara batch`,
    details: { count: dataPenempatan.length },
  })
  return { success: true, count: dataPenempatan.length }
}
