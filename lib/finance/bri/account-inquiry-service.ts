// lib/finance/bri/account-inquiry-service.ts
// Abstraksi Layanan Inquiry Rekening Tujuan Penyaluran (Fase BRI-5)
// Berdasarkan SNAP BI v1.0 Account Inquiry & PRD Bab 24 s.d. 29

import { briLog } from '@/lib/finance/bri/logging'
import { maskBeneficiaryAccount } from '@/lib/finance/bri/qlola-policy'
import type { AccountInquiryInput, AccountInquiryResult } from '@/lib/finance/bri/qlola-types'

export class BriAccountInquiryService {
  /**
   * Melakukan verifikasi nomor rekening dan pencocokan nama pemilik rekening.
   * Kontrak SNAP BI:
   * - Internal Account Inquiry: POST /snap/v1.0/account-inquiry-internal
   * - External Account Inquiry: POST /snap/v1.0/account-inquiry-external
   */
  async verifyBeneficiaryAccount(input: AccountInquiryInput): Promise<AccountInquiryResult> {
    const cleanAccountNo = input.accountNumber.replace(/[\s-]/g, '')
    const cleanBankCode = input.bankCode.trim().toUpperCase()

    if (!cleanAccountNo || cleanAccountNo.length < 5) {
      throw new Error(`Nomor rekening tujuan tidak valid: "${input.accountNumber}".`)
    }

    briLog('info', 'BRI_ACCOUNT_INQUIRY_INITIATED', {
      details: {
        bankCode: cleanBankCode,
        accountMasked: maskBeneficiaryAccount(cleanAccountNo),
      },
    })

    return {status:'NOT_VERIFIED',reason:'BRI_BENEFICIARY_CONTRACT_TBD',bankCode:cleanBankCode,accountNumber:cleanAccountNo,
      accountHolderName:'',isMatched:false,inquiryReference:'',inquiredAt:new Date().toISOString()}

  }
}
