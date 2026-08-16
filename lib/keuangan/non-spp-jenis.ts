// lib/keuangan/non-spp-jenis.ts
//
// Konstanta jenis biaya Non-SPP, dipisah dari non-spp-outstanding.ts supaya
// bisa diimpor dari Client Component tanpa ikut menyeret lib/db (yang pakai
// next/headers, server-only) ke bundle browser.

export const NON_SPP_JENIS_TAHUNAN = ['KESEHATAN', 'EHB', 'EKSKUL'] as const
export const NON_SPP_JENIS_ALL = ['BANGUNAN', ...NON_SPP_JENIS_TAHUNAN] as const
export type NonSppJenis = typeof NON_SPP_JENIS_ALL[number]
