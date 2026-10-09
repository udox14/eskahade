// lib/finance/bri/qlola-policy.ts
// Kebijakan & Aturan Bisnis Penyaluran Non-STP QLola (Fase BRI-5)
// Berdasarkan PRD Bab 24 s.d. 29, AGENTS.md, dan Reviewer Hardening

import type {
  BriDistributionStatus,
  BriDistributionMethod,
  BriDistributionRole,
  QlolaApprovalInternalStatus,
} from '@/lib/finance/bri/qlola-types'

/**
 * Memeriksa apakah suatu status menahan/mereservasi dana alokasi (baik live maupun final).
 */
export function isStatusReserving(status: BriDistributionStatus): boolean {
  return ['PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED'].includes(status)
}

/**
 * Memeriksa apakah suatu status transfer intent menahan/mereservasi dana alokasi pre-ACK.
 */
export function isIntentReserving(intentStatus: string): boolean {
  return ['SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING'].includes(intentStatus)
}

/**
 * Memeriksa apakah suatu status merupakan reservasi bank aktif (belum actual delivery).
 */
export function isLiveReservation(status: BriDistributionStatus): boolean {
  return ['PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING'].includes(status)
}

/**
 * Validasi State Machine Transisi Penyaluran Non-STP.
 */
export function validateDistributionStatusTransition(
  currentStatus: BriDistributionStatus,
  nextStatus: BriDistributionStatus,
  method: BriDistributionMethod
): { valid: boolean; reason?: string } {
  if (currentStatus === nextStatus) {
    return { valid: true }
  }

  // Terminal status bersifat final dan immutable
  if (['DISTRIBUTED', 'FAILED', 'REJECTED', 'CANCELLED'].includes(currentStatus)) {
    return {
      valid: false,
      reason: `Status terminal "${currentStatus}" bersifat final dan tidak dapat diubah ke "${nextStatus}".`,
    }
  }

  if (method === 'BRI_QLOLA') {
    switch (currentStatus) {
      case 'DRAFT':
        if (nextStatus === 'PENDING_APPROVAL' || nextStatus === 'CANCELLED') {
          return { valid: true }
        }
        return {
          valid: false,
          reason: `Penyaluran BRI_QLOLA dari DRAFT hanya boleh ke PENDING_APPROVAL atau CANCELLED. Transisi langsung ke "${nextStatus}" diblokir (Non-STP Guard).`,
        }

      case 'PENDING_APPROVAL':
        if (['PROCESSING', 'REJECTED', 'CANCEL_PENDING', 'CANCELLED'].includes(nextStatus)) {
          return { valid: true }
        }
        return {
          valid: false,
          reason: `Penyaluran BRI_QLOLA dari PENDING_APPROVAL hanya boleh ke PROCESSING, REJECTED, CANCEL_PENDING, atau CANCELLED.`,
        }

      case 'PROCESSING':
        if (['DISTRIBUTED', 'FAILED', 'CANCEL_PENDING'].includes(nextStatus)) {
          return { valid: true }
        }
        return {
          valid: false,
          reason: `Penyaluran BRI_QLOLA dari PROCESSING hanya boleh ke DISTRIBUTED, FAILED, atau CANCEL_PENDING.`,
        }

      case 'CANCEL_PENDING':
        if (['CANCELLED', 'DISTRIBUTED', 'FAILED', 'PROCESSING'].includes(nextStatus)) {
          return { valid: true }
        }
        return {
          valid: false,
          reason: `Penyaluran BRI_QLOLA dari CANCEL_PENDING hanya boleh ke CANCELLED, DISTRIBUTED, FAILED, atau PROCESSING.`,
        }
    }
  } else {
    // CASH & MANUAL_TRANSFER
    if (currentStatus === 'DRAFT') {
      if (['DISTRIBUTED', 'CANCELLED'].includes(nextStatus)) {
        return { valid: true }
      }
    }
  }

  return {
    valid: false,
    reason: `Transisi tidak valid dari "${currentStatus}" ke "${nextStatus}" untuk metode "${method}".`,
  }
}

/**
 * Matriks Hak Akses & Kewenangan Otorisasi Penyaluran.
 */
export function canCreateDistributionDraft(roles: BriDistributionRole[]): boolean {
  if (roles.includes('tester')) return false
  return roles.some((r) => ['admin', 'bendahara', 'petugas_koperasi', 'admin_koperasi'].includes(r))
}

export function canSubmitDistribution(
  roles: BriDistributionRole[],
  method: BriDistributionMethod
): boolean {
  if (roles.includes('tester')) return false
  // Maker/Signer Separation: admin_koperasi supervisi murni tidak boleh bertindak sebagai Maker sendirian
  if (roles.includes('admin_koperasi') && !roles.some((r) => ['admin', 'bendahara', 'petugas_koperasi'].includes(r))) {
    return false
  }
  if (method === 'MANUAL_TRANSFER') {
    return roles.some((r) => r === 'admin' || r === 'bendahara')
  }
  return roles.some((r) => ['admin', 'bendahara', 'petugas_koperasi'].includes(r))
}

export function canCancelDistribution(roles: BriDistributionRole[]): boolean {
  if (roles.includes('tester')) return false
  return roles.some((r) => r === 'admin' || r === 'bendahara')
}

export function canViewDistribution(roles: BriDistributionRole[]): boolean {
  return roles.some((r) =>
    ['admin', 'pimpinan', 'bendahara', 'admin_koperasi', 'petugas_koperasi', 'tester'].includes(r)
  )
}

export function canResolveDiscrepancy(roles: BriDistributionRole[]): boolean {
  if (roles.includes('tester')) return false
  return roles.some((r) => r === 'admin' || r === 'bendahara')
}

export function canAuthorizeManualProof(roles: BriDistributionRole[]): boolean {
  if (roles.includes('tester')) return false
  return roles.some((r) => r === 'admin' || r === 'bendahara')
}

/**
 * Pemetaan status eksternal QLola / Bank ke status internal.
 */
export function mapExternalQlolaStatus(externalStatusRaw: string): QlolaApprovalInternalStatus {
  const normalized = externalStatusRaw.trim().toUpperCase()
  switch (normalized) {
    case 'WAITING_APPROVAL':
    case 'PENDING':
    case 'MAKER':
    case 'CHECKER':
      return 'WAITING_APPROVAL'

    case 'APPROVED':
    case 'IN_PROGRESS':
    case 'PROCESSING':
      return 'APPROVED'

    case 'REJECTED':
      return 'REJECTED'

    case 'CANCELLED':
      return 'CANCELLED'

    case 'COMPLETED':
    case 'SUCCESS':
    case 'SETTLED':
      return 'COMPLETED'

    default:
      return 'UNKNOWN'
  }
}

/**
 * Masking nomor rekening untuk audit logging.
 */
export function maskBeneficiaryAccount(accountNumber: string | null | undefined): string {
  if (!accountNumber) return 'N/A'
  const trimmed = accountNumber.trim()
  if (trimmed.length <= 6) return '***'
  const start = trimmed.slice(0, 3)
  const end = trimmed.slice(-3)
  return `${start}${'*'.repeat(Math.max(trimmed.length - 6, 3))}${end}`
}
