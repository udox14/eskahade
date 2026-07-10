'use server'

import { revalidatePath } from 'next/cache'
import { batch, execute, generateId, query, queryOne } from '@/lib/db'
import { getSession, type SessionUser } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSppScope, isSadesaCategory, SADESA_CATEGORY } from '@/lib/spp/unit-setor'
import { namaBulanId } from '@/lib/portal/format'
import type { SppDetailItem } from '@/app/portal-ortu/(app)/tagihan/actions'

const PATH = '/dashboard/asrama/spp/konfirmasi-portal'
const REVALIDATE_PATHS = [
  PATH,
  '/dashboard/asrama/spp',
  '/dashboard/dewan-santri/setoran',
  '/portal-ortu/tagihan',
  '/portal-ortu/riwayat',
  '/portal-ortu/beranda',
]

export type SppSubmissionRow = {
  id: string
  santri_id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  kategori_santri: string | null
  detail_json: string
  jumlah: number
  metode: string
  bank_tujuan: string | null
  bukti_url: string | null
  status: string
  catatan_ortu: string | null
  reject_reason: string | null
  confirmed_at: string | null
  confirmed_by_nama: string | null
  rejected_at: string | null
  created_at: string
  updated_at: string
}

// Filter scope sama dengan halaman SPP:
// ASRAMA → santri asrama binaan non-SADESA; SADESA (dewan santri) → SADESA; ADMIN → semua.
function scopeWhere(session: SessionUser | null): { where: string; params: unknown[] } | null {
  const scope = getSppScope(session)
  if (!scope) return null
  if (scope.kind === 'ASRAMA') {
    return {
      where: `AND s.asrama = ? AND COALESCE(s.kategori_santri, 'REGULER') != ?`,
      params: [scope.defaultUnit, SADESA_CATEGORY],
    }
  }
  if (scope.kind === 'SADESA') {
    return { where: `AND s.kategori_santri = ?`, params: [SADESA_CATEGORY] }
  }
  return { where: '', params: [] }
}

async function assertSubmissionAccess(session: SessionUser | null, submissionId: string) {
  const scope = getSppScope(session)
  if (!scope) throw new Error('Akses ditolak.')

  const row = await queryOne<SppSubmissionRow & { bebas_spp: number | null }>(`
    SELECT ps.*, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.kategori_santri,
           COALESCE(s.bebas_spp, 0) AS bebas_spp
    FROM portal_payment_submission ps
    JOIN santri s ON s.id = ps.santri_id
    WHERE ps.id = ? AND ps.kategori = 'SPP'
  `, [submissionId])
  if (!row) throw new Error('Pengajuan tidak ditemukan.')

  const sadesa = isSadesaCategory(row.kategori_santri)
  if (scope.kind === 'ASRAMA' && (sadesa || row.asrama !== scope.defaultUnit)) {
    throw new Error('Pengajuan ini bukan dari asrama binaan Anda.')
  }
  if (scope.kind === 'SADESA' && !sadesa) {
    throw new Error('Pengajuan ini bukan santri kategori SADESA.')
  }
  return row
}

export async function getSubmissionsSpp(statusFilter: string) {
  const session = await getSession()
  const scope = scopeWhere(session)
  if (!scope) return { error: 'Akses ditolak.' as const }

  const params: unknown[] = [...scope.params]
  let statusWhere = ''
  if (statusFilter && statusFilter !== 'SEMUA') {
    statusWhere = 'AND ps.status = ?'
    params.push(statusFilter)
  }

  const rows = await query<SppSubmissionRow>(`
    SELECT ps.id, ps.santri_id, ps.detail_json, ps.jumlah, ps.metode, ps.bank_tujuan,
           ps.bukti_url, ps.status, ps.catatan_ortu, ps.reject_reason,
           ps.confirmed_at, ps.rejected_at, ps.created_at, ps.updated_at,
           s.nama_lengkap, s.nis, s.asrama, s.kamar, s.kategori_santri,
           u.full_name AS confirmed_by_nama
    FROM portal_payment_submission ps
    JOIN santri s ON s.id = ps.santri_id
    LEFT JOIN users u ON u.id = ps.confirmed_by
    WHERE ps.kategori = 'SPP' ${scope.where} ${statusWhere}
    ORDER BY CASE ps.status WHEN 'menunggu_konfirmasi' THEN 0 ELSE 1 END,
             datetime(ps.created_at) DESC
    LIMIT 200
  `, params)

  return { rows }
}

function parseDetail(detailJson: string): SppDetailItem[] {
  const parsed = JSON.parse(detailJson)
  if (!Array.isArray(parsed)) throw new Error('Detail pengajuan rusak.')
  return parsed
}

export async function approveSubmissionSpp(submissionId: string): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession()
    const submission = await assertSubmissionAccess(session, submissionId)

    if (submission.status !== 'menunggu_konfirmasi') {
      return { error: 'Pengajuan ini sudah diproses.' }
    }
    if (!submission.bukti_url) {
      return { error: 'Ortu belum mengunggah bukti pembayaran.' }
    }
    if ((submission as any).bebas_spp === 1) {
      return { error: 'Santri kini berstatus bebas SPP. Tolak pengajuan ini agar ortu mengajukan ulang.' }
    }

    const detail = parseDetail(submission.detail_json)
    const berjalan = detail.filter(item => item.source === 'BERJALAN')
    const historis = detail.filter(item => item.source === 'HISTORIS')

    // Re-validasi item BERJALAN terhadap data live
    const conflicts: string[] = []
    for (const item of berjalan) {
      const sudahBayar = await queryOne<{ id: string }>(
        `SELECT id FROM spp_log WHERE santri_id = ? AND tahun = ? AND bulan = ? LIMIT 1`,
        [submission.santri_id, item.tahun, item.bulan]
      )
      if (sudahBayar) {
        conflicts.push(`${namaBulanId(item.bulan)} ${item.tahun} (sudah dibayar)`)
        continue
      }
      const ditiadakan = await queryOne<{ id: string }>(
        `SELECT id FROM spp_tagihan_ditiadakan
         WHERE santri_id = ? AND tahun = ? AND bulan = ? AND is_active = 1 LIMIT 1`,
        [submission.santri_id, item.tahun, item.bulan]
      )
      if (ditiadakan) conflicts.push(`${namaBulanId(item.bulan)} ${item.tahun} (tagihan ditiadakan)`)
    }
    for (const item of historis) {
      if (!item.historis_id) {
        conflicts.push(`${namaBulanId(item.bulan)} ${item.tahun} (data historis tidak valid)`)
        continue
      }
      const masihTertagih = await queryOne<{ id: string }>(
        `SELECT id FROM spp_tunggakan_historis WHERE id = ? AND status = 'BELUM_LUNAS' LIMIT 1`,
        [item.historis_id]
      )
      if (!masihTertagih) conflicts.push(`${namaBulanId(item.bulan)} ${item.tahun} (tunggakan lama sudah lunas)`)
    }
    if (conflicts.length > 0) {
      return {
        error: `Tidak bisa dikonfirmasi: ${conflicts.join(', ')}. Tolak pengajuan ini agar ortu mengajukan ulang dengan tagihan terbaru.`,
      }
    }

    const keterangan = `Portal Ortu - ${submission.metode}`
    const statements = [
      ...berjalan.map(item => ({
        sql: `INSERT INTO spp_log
                (id, santri_id, tahun, bulan, nominal_bayar, penerima_id, keterangan, tanggal_bayar, portal_submission_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, date('now'), ?)`,
        params: [generateId(), submission.santri_id, item.tahun, item.bulan, item.nominal, session?.id ?? null, keterangan, submission.id],
      })),
      ...historis.map(item => ({
        sql: `UPDATE spp_tunggakan_historis
              SET status = 'LUNAS', tanggal_lunas = date('now'), penerima_id = ?, updated_at = datetime('now')
              WHERE id = ? AND status = 'BELUM_LUNAS'`,
        params: [session?.id ?? null, item.historis_id],
      })),
      {
        sql: `UPDATE portal_payment_submission
              SET status = 'terkonfirmasi', confirmed_by = ?, confirmed_at = datetime('now'), updated_at = datetime('now')
              WHERE id = ? AND status = 'menunggu_konfirmasi'`,
        params: [session?.id ?? null, submission.id],
      },
    ]
    await batch(statements)

    await logActivity({
      actor: actorFromSession(session),
      module: 'portal_ortu',
      action: 'approve_submission',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'portal_payment_submission',
      entityId: submission.id,
      entityLabel: submission.nama_lengkap || submission.nis || submission.santri_id,
      summary: `Konfirmasi pembayaran SPP portal ${submission.nama_lengkap || submission.nis} (${submission.jumlah})`,
      details: {
        santri_id: submission.santri_id,
        jumlah: submission.jumlah,
        metode: submission.metode,
        bulan_berjalan: berjalan.map(i => `${i.tahun}-${i.bulan}`),
        historis: historis.map(i => i.historis_id),
      },
    })

    REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal mengonfirmasi pengajuan.' }
  }
}

export async function rejectSubmissionSpp(submissionId: string, reason: string): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession()
    const submission = await assertSubmissionAccess(session, submissionId)
    const alasan = String(reason || '').trim()
    if (alasan.length < 5) return { error: 'Alasan penolakan minimal 5 karakter.' }
    if (submission.status !== 'menunggu_konfirmasi') return { error: 'Pengajuan ini sudah diproses.' }

    await execute(`
      UPDATE portal_payment_submission
      SET status = 'ditolak', rejected_by = ?, rejected_at = datetime('now'),
          reject_reason = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'menunggu_konfirmasi'
    `, [session?.id ?? null, alasan, submission.id])

    await logActivity({
      actor: actorFromSession(session),
      module: 'portal_ortu',
      action: 'reject_submission',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'portal_payment_submission',
      entityId: submission.id,
      entityLabel: submission.nama_lengkap || submission.nis || submission.santri_id,
      summary: `Menolak pengajuan SPP portal ${submission.nama_lengkap || submission.nis}`,
      details: { santri_id: submission.santri_id, alasan },
    })

    REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menolak pengajuan.' }
  }
}

// Koreksi setelah salah konfirmasi: hapus spp_log hasil pengajuan ini, kembalikan
// status historis, dan tandai pengajuan sebagai ditolak dengan alasan.
export async function undoApprovalSpp(submissionId: string, reason: string): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession()
    const submission = await assertSubmissionAccess(session, submissionId)
    const alasan = String(reason || '').trim()
    if (alasan.length < 5) return { error: 'Alasan pembatalan minimal 5 karakter.' }
    if (submission.status !== 'terkonfirmasi') return { error: 'Hanya pengajuan terkonfirmasi yang bisa dibatalkan.' }

    const detail = parseDetail(submission.detail_json)
    const historisIds = detail
      .filter(item => item.source === 'HISTORIS' && item.historis_id)
      .map(item => item.historis_id as string)

    await batch([
      {
        sql: `DELETE FROM spp_log WHERE portal_submission_id = ?`,
        params: [submission.id],
      },
      ...historisIds.map(id => ({
        sql: `UPDATE spp_tunggakan_historis
              SET status = 'BELUM_LUNAS', tanggal_lunas = NULL, penerima_id = NULL, updated_at = datetime('now')
              WHERE id = ? AND status = 'LUNAS'`,
        params: [id],
      })),
      {
        sql: `UPDATE portal_payment_submission
              SET status = 'ditolak', rejected_by = ?, rejected_at = datetime('now'),
                  reject_reason = ?, confirmed_by = NULL, confirmed_at = NULL, updated_at = datetime('now')
              WHERE id = ? AND status = 'terkonfirmasi'`,
        params: [session?.id ?? null, alasan, submission.id],
      },
    ])

    await logActivity({
      actor: actorFromSession(session),
      module: 'portal_ortu',
      action: 'undo_approval',
      fiturHref: PATH,
      logKind: 'delete',
      entityType: 'portal_payment_submission',
      entityId: submission.id,
      entityLabel: submission.nama_lengkap || submission.nis || submission.santri_id,
      summary: `Membatalkan konfirmasi SPP portal ${submission.nama_lengkap || submission.nis}`,
      details: { santri_id: submission.santri_id, alasan, historis_ids: historisIds },
    })

    REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal membatalkan konfirmasi.' }
  }
}
