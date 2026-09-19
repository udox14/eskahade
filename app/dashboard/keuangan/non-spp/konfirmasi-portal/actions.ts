'use server'

import { revalidatePath } from 'next/cache'
import { batch, execute, generateId, now, query, queryOne } from '@/lib/db'
import { getSession, hasAnyRole, type SessionUser } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getNonSppOutstandingSantri } from '@/lib/keuangan/non-spp-outstanding'
import type { NonSppDetailItem } from '@/app/portal-ortu/(app)/tagihan/actions'

const PATH = '/dashboard/keuangan/non-spp/konfirmasi-portal'
const REVALIDATE_PATHS = [
  PATH,
  '/dashboard/keuangan/non-spp',
  '/portal-ortu/tagihan',
  '/portal-ortu/riwayat',
  '/portal-ortu/beranda',
]

function assertAccess(session: SessionUser | null) {
  if (!hasAnyRole(session, ['admin', 'bendahara', 'demo'])) {
    throw new Error('Akses ditolak.')
  }
}

export async function getSubmissionsNonSpp(statusFilter: string) {
  try {
    const session = await getSession()
    assertAccess(session)

    const params: unknown[] = []
    let statusWhere = ''
    if (statusFilter && statusFilter !== 'SEMUA') {
      statusWhere = 'AND ps.status = ?'
      params.push(statusFilter)
    }

    const rows = await query(`
      SELECT ps.id, ps.santri_id, ps.detail_json, ps.jumlah, ps.metode, ps.bank_tujuan,
             ps.bukti_url, ps.status, ps.catatan_ortu, ps.reject_reason,
             ps.confirmed_at, ps.rejected_at, ps.created_at, ps.updated_at,
             s.nama_lengkap, s.nis, s.asrama, s.kamar,
             u.full_name AS confirmed_by_nama
      FROM portal_payment_submission ps
      JOIN santri s ON s.id = ps.santri_id
      LEFT JOIN users u ON u.id = ps.confirmed_by
      WHERE ps.kategori = 'NON_SPP' ${statusWhere}
      ORDER BY CASE ps.status WHEN 'menunggu_konfirmasi' THEN 0 ELSE 1 END,
               datetime(ps.created_at) DESC
      LIMIT 200
    `, params)

    return { rows: rows as any[] }
  } catch (error: any) {
    return { error: error?.message || 'Gagal memuat pengajuan.' }
  }
}

async function loadSubmission(submissionId: string) {
  const row = await queryOne<any>(`
    SELECT ps.*, s.nama_lengkap, s.nis
    FROM portal_payment_submission ps
    JOIN santri s ON s.id = ps.santri_id
    WHERE ps.id = ? AND ps.kategori = 'NON_SPP'
  `, [submissionId])
  if (!row) throw new Error('Pengajuan tidak ditemukan.')
  return row
}

function parseDetail(detailJson: string): NonSppDetailItem[] {
  const parsed = JSON.parse(detailJson)
  if (!Array.isArray(parsed)) throw new Error('Detail pengajuan rusak.')
  return parsed
}

export async function approveSubmissionNonSpp(submissionId: string): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession()
    assertAccess(session)
    const submission = await loadSubmission(submissionId)

    if (submission.status !== 'menunggu_konfirmasi') return { error: 'Pengajuan ini sudah diproses.' }
    if (!submission.bukti_url) return { error: 'Ortu belum mengunggah bukti pembayaran.' }

    const detail = parseDetail(submission.detail_json)
    if (!detail.length) return { error: 'Detail pengajuan kosong.' }

    // Re-validasi terhadap sisa tagihan live (tahun ajaran yang sama dengan saat pengajuan)
    const outstanding = await getNonSppOutstandingSantri(submission.santri_id, detail[0].tahun_ajaran_id)
    if (!outstanding) return { error: 'Tahun ajaran pengajuan tidak ditemukan.' }

    const conflicts: string[] = []
    for (const item of detail) {
      const live = outstanding.items.find(i => i.jenis === item.jenis_biaya)
      if (!live || live.sisa < item.nominal) {
        conflicts.push(`${item.jenis_biaya} (sisa tagihan kini ${live?.sisa ?? 0}, diajukan ${item.nominal})`)
      }
    }
    if (conflicts.length > 0) {
      return {
        error: `Tidak bisa dikonfirmasi: ${conflicts.join(', ')}. Tolak pengajuan ini agar ortu mengajukan ulang dengan tagihan terbaru.`,
      }
    }

    const keterangan = `Portal Ortu - ${submission.metode}`
    await batch([
      ...detail.map(item => ({
        sql: `INSERT INTO pembayaran_tahunan
                (id, santri_id, jenis_biaya, tahun_tagihan, tahun_ajaran_id, batch_id, nominal_bayar,
                 penerima_id, keterangan, tanggal_bayar, status, portal_submission_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'AKTIF', ?)`,
        params: [
          generateId(),
          submission.santri_id,
          item.jenis_biaya,
          item.jenis_biaya === 'BANGUNAN' ? null : item.tahun_tagihan,
          item.tahun_ajaran_id,
          submission.id, // batch_id = submission id → void by batch langsung jalan
          item.nominal,
          session?.id ?? null,
          keterangan,
          submission.id,
        ],
      })),
      {
        sql: `UPDATE portal_payment_submission
              SET status = 'terkonfirmasi', confirmed_by = ?, confirmed_at = datetime('now'), updated_at = datetime('now')
              WHERE id = ? AND status = 'menunggu_konfirmasi'`,
        params: [session?.id ?? null, submission.id],
      },
    ])

    await logActivity({
      actor: actorFromSession(session),
      module: 'portal_ortu',
      action: 'approve_submission_non_spp',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'portal_payment_submission',
      entityId: submission.id,
      entityLabel: submission.nama_lengkap || submission.nis || submission.santri_id,
      summary: `Konfirmasi pembayaran Non-SPP portal ${submission.nama_lengkap || submission.nis} (${submission.jumlah})`,
      details: { santri_id: submission.santri_id, jumlah: submission.jumlah, metode: submission.metode, detail },
    })

    REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal mengonfirmasi pengajuan.' }
  }
}

export async function rejectSubmissionNonSpp(submissionId: string, reason: string): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession()
    assertAccess(session)
    const submission = await loadSubmission(submissionId)
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
      action: 'reject_submission_non_spp',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'portal_payment_submission',
      entityId: submission.id,
      entityLabel: submission.nama_lengkap || submission.nis || submission.santri_id,
      summary: `Menolak pengajuan Non-SPP portal ${submission.nama_lengkap || submission.nis}`,
      details: { santri_id: submission.santri_id, alasan },
    })

    REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menolak pengajuan.' }
  }
}

// Koreksi salah konfirmasi: void semua pembayaran hasil pengajuan ini (by batch_id)
// lalu tandai pengajuan sebagai ditolak dengan alasan.
export async function undoApprovalNonSpp(submissionId: string, reason: string): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession()
    assertAccess(session)
    const submission = await loadSubmission(submissionId)
    const alasan = String(reason || '').trim()
    if (alasan.length < 5) return { error: 'Alasan pembatalan minimal 5 karakter.' }
    if (submission.status !== 'terkonfirmasi') return { error: 'Hanya pengajuan terkonfirmasi yang bisa dibatalkan.' }

    const stamp = now()
    await batch([
      {
        sql: `UPDATE pembayaran_tahunan
              SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?
              WHERE batch_id = ? AND COALESCE(status, 'AKTIF') != 'VOID'`,
        params: [`Pembatalan konfirmasi portal: ${alasan}`, session?.id ?? null, stamp, submission.id],
      },
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
      action: 'undo_approval_non_spp',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'portal_payment_submission',
      entityId: submission.id,
      entityLabel: submission.nama_lengkap || submission.nis || submission.santri_id,
      summary: `Membatalkan konfirmasi Non-SPP portal ${submission.nama_lengkap || submission.nis}`,
      details: { santri_id: submission.santri_id, alasan },
    })

    REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal membatalkan konfirmasi.' }
  }
}
