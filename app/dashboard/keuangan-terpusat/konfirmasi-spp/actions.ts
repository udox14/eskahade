'use server'

import { revalidatePath } from 'next/cache'
import { getSession, type SessionUser } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSppScope, isSadesaCategory, SADESA_CATEGORY } from '@/lib/spp/unit-setor'
import {
  approvePortalSubmission, listPortalSubmissions, rejectPortalSubmission, type PortalSubmissionRow,
} from '@/lib/finance/portal-confirm'

// Siapa yang boleh mereview tetap sama seperti sebelum migrasi ke Keuangan
// Terpusat (getSppScope: asrama → pengurus_asrama binaan; SADESA → dewan
// santri; admin/tester → semua). Yang berubah hanya tempat uangnya dicatat:
// finance_bills/finance_allocations, bukan spp_log lagi.
const PATH = '/dashboard/keuangan-terpusat/konfirmasi-spp'
const REVALIDATE_PATHS = [
  PATH,
  '/dashboard/keuangan-terpusat',
  '/dashboard/keuangan-terpusat/ledger',
  '/portal-ortu/tagihan',
  '/portal-ortu/riwayat',
  '/portal-ortu/beranda',
]

function scopeWhere(session: SessionUser | null): { where: string; params: unknown[] } | null {
  const scope = getSppScope(session)
  if (!scope) return null
  if (scope.kind === 'ASRAMA') {
    return { where: `AND s.asrama = ? AND COALESCE(s.kategori_santri, 'REGULER') != ?`, params: [scope.defaultUnit, SADESA_CATEGORY] }
  }
  if (scope.kind === 'SADESA') {
    return { where: `AND s.kategori_santri = ?`, params: [SADESA_CATEGORY] }
  }
  return { where: '', params: [] }
}

// Tidak pernah throw sinkron saat dibangun — pengecekan ditunda ke dalam
// closure supaya selalu tertangkap oleh try/catch di approvePortalSubmission/
// rejectPortalSubmission, bukan meledak sebagai unhandled exception di server action.
function assertAccess(session: SessionUser | null) {
  const scope = getSppScope(session)
  return (row: PortalSubmissionRow) => {
    if (!scope) throw new Error('Akses ditolak.')
    const sadesa = isSadesaCategory(row.kategori_santri)
    if (scope.kind === 'ASRAMA' && (sadesa || row.asrama !== scope.defaultUnit)) {
      throw new Error('Pengajuan ini bukan dari asrama binaan Anda.')
    }
    if (scope.kind === 'SADESA' && !sadesa) {
      throw new Error('Pengajuan ini bukan santri kategori SADESA.')
    }
  }
}

export async function getSubmissionsSpp(statusFilter: string) {
  const session = await getSession()
  const scope = scopeWhere(session)
  if (!scope) return { error: 'Akses ditolak.' as const }
  const rows = await listPortalSubmissions('SPP', statusFilter, scope.where, scope.params)
  return { rows }
}

export async function approveSubmissionSpp(submissionId: string) {
  try {
    const session = await getSession()
    if (!session) return { success: false as const, error: 'Sesi tidak valid.' }
    const result = await approvePortalSubmission({
      submissionId, kategori: 'SPP', actorId: session.id, assertAccess: assertAccess(session),
    })
    if (result.success) {
      await logActivity({
        actor: actorFromSession(session),
        module: 'portal_ortu',
        action: 'approve_submission',
        fiturHref: PATH,
        logKind: 'update',
        entityType: 'portal_payment_submission',
        entityId: submissionId,
        entityLabel: result.submission.nama_lengkap || result.submission.nis || result.submission.santri_id,
        summary: `Konfirmasi pembayaran SPP portal ${result.submission.nama_lengkap || result.submission.nis} (${result.submission.jumlah})`,
        details: { santri_id: result.submission.santri_id, jumlah: result.submission.jumlah, metode: result.submission.metode },
      })
      REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    }
    return result
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Gagal mengonfirmasi pengajuan.' }
  }
}

export async function rejectSubmissionSpp(submissionId: string, reason: string) {
  try {
    const session = await getSession()
    if (!session) return { success: false as const, error: 'Sesi tidak valid.' }
    const result = await rejectPortalSubmission({
      submissionId, kategori: 'SPP', actorId: session.id, reason, assertAccess: assertAccess(session),
    })
    if (result.success) {
      await logActivity({
        actor: actorFromSession(session),
        module: 'portal_ortu',
        action: 'reject_submission',
        fiturHref: PATH,
        logKind: 'update',
        entityType: 'portal_payment_submission',
        entityId: submissionId,
        entityLabel: result.submission.nama_lengkap || result.submission.nis || result.submission.santri_id,
        summary: `Menolak pengajuan SPP portal ${result.submission.nama_lengkap || result.submission.nis}`,
        details: { santri_id: result.submission.santri_id, alasan: reason },
      })
      REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    }
    return result
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Gagal menolak pengajuan.' }
  }
}
