// lib/finance/gateway/duitku.ts
// Modul Orkestrasi Payment Gateway Duitku & Fixed Virtual Account (Fase 3B)
//
// Pemisahan Protokol Eksplisit:
// 1. Web API V2: Checkout, Dynamic Payment, QRIS (lib/finance/gateway/duitku-v2.ts)
// 2. SNAP VA: Permanent Fixed Virtual Account BI SNAP (lib/finance/gateway/duitku-snap.ts)

// Export Web API V2 Adapter (Checkout Dinamis & QRIS)
export * from './duitku-v2'

// Export SNAP VA Adapter (Fixed Virtual Account Permanen)
export * from './duitku-snap'

// Backward-compatibility aliases untuk V2 Checkout & Callback
export {
  processDuitkuV2Callback as processDuitkuCallback,
  generateInquirySignatureV2 as generateInquirySignature,
  generateCheckStatusSignatureV2 as generateCheckStatusSignature,
  generateCallbackSignatureV2 as generateCallbackSignature,
  verifyDuitkuCallbackSignatureV2 as verifyDuitkuCallbackSignature,
  getDuitkuV2Config as getDuitkuConfig,
  createDuitkuV2Transaction as createDuitkuTransaction,
  checkDuitkuV2TransactionStatus as checkDuitkuTransactionStatus,
} from './duitku-v2'
