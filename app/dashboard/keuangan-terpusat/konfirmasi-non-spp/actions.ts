'use server'

import { revalidatePath } from 'next/cache'
import { requireFinanceAccess } from '@/lib/finance/access'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { approvePortalSubmission, listPortalSubmissions, rejectPortalSubmission } from '@/lib/finance/portal-confirm'

const PATH = '/dashboard/keuangan-terpusat/konfirmasi-non-spp'
const REVALIDATE_PATHS = [
  PATH,
  '/dashboard/keuangan-terpusat',
  '/dashboard/keuangan-terpusat/ledger',
  '/portal-ortu/keuangan',
  '/portal-ortu/beranda',
]

export async function getSubmissionsNonSpp(statusFilter: string) {
  try {
    await requireFinanceAccess('VIEW')
    const rows = await listPortalSubmissions('NON_SPP', statusFilter, '', [])
    return { rows }
  } catch (error: any) {
    return { error: error?.message || 'Gagal memuat pengajuan.' }
  }
}

export async function approveSubmissionNonSpp(submissionId: string) {
  try {
    const session = await requireFinanceAccess('CONFIGURE')
    const result = await approvePortalSubmission({
      submissionId, kategori: 'NON_SPP', actorId: session.id, assertAccess: () => {},
    })
    if (result.success) {
      await logActivity({
        actor: actorFromSession(session),
        module: 'portal_ortu',
        action: 'approve_submission_non_spp',
        fiturHref: PATH,
        logKind: 'update',
        entityType: 'portal_payment_submission',
        entityId: submissionId,
        entityLabel: result.submission.nama_lengkap || result.submission.nis || result.submission.santri_id,
        summary: `Konfirmasi pembayaran Non-SPP portal ${result.submission.nama_lengkap || result.submission.nis} (${result.submission.jumlah})`,
        details: { santri_id: result.submission.santri_id, jumlah: result.submission.jumlah, metode: result.submission.metode },
      })
      REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    }
    return result
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Gagal mengonfirmasi pengajuan.' }
  }
}

export async function rejectSubmissionNonSpp(submissionId: string, reason: string) {
  try {
    const session = await requireFinanceAccess('CONFIGURE')
    const result = await rejectPortalSubmission({
      submissionId, kategori: 'NON_SPP', actorId: session.id, reason, assertAccess: () => {},
    })
    if (result.success) {
      await logActivity({
        actor: actorFromSession(session),
        module: 'portal_ortu',
        action: 'reject_submission_non_spp',
        fiturHref: PATH,
        logKind: 'update',
        entityType: 'portal_payment_submission',
        entityId: submissionId,
        entityLabel: result.submission.nama_lengkap || result.submission.nis || result.submission.santri_id,
        summary: `Menolak pengajuan Non-SPP portal ${result.submission.nama_lengkap || result.submission.nis}`,
        details: { santri_id: result.submission.santri_id, alasan: reason },
      })
      REVALIDATE_PATHS.forEach(p => revalidatePath(p))
    }
    return result
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Gagal menolak pengajuan.' }
  }
}
