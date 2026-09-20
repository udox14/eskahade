// lib/print/letterhead.ts
// Modul Pengaturan & Resolusi Kop Surat / Print Infrastructure Shared
// Mendukung:
// 1. Profil Kop Identitas Lembaga (Pondok Pesantren Sukahideng, Koperasi, Dewan Santri, dll.)
// 2. Pemilihan per jenis dokumen: Kop Default, Kop Spesifik, atau Tanpa Kop (none)
// 3. Penyimpanan non-destruktif ke tabel app_settings


export interface LetterheadProfile {
  id: string
  name: string
  institutionName: string
  subheading?: string
  address?: string
  contactLine?: string
  nspp?: string
  logoUrl?: string
  logoPosition?: 'left' | 'center'
  showDivider?: boolean
  isDefault?: boolean
}

export type LetterheadMode = 'default' | 'profile' | 'none'

export interface DocumentPrintConfig {
  documentKey: string
  label: string
  mode: LetterheadMode
  profileId?: string
  showSignatureBlock?: boolean
  signatoryTitleLeft?: string
  signatoryNameLeft?: string
  signatoryTitleRight?: string
  signatoryNameRight?: string
}

export const DEFAULT_LETTERHEAD_PROFILES: LetterheadProfile[] = [
  {
    id: 'sukahideng_main',
    name: 'Pondok Pesantren Sukahideng (Utama)',
    institutionName: 'Pondok Pesantren Sukahideng',
    subheading: '',
    address: '',
    contactLine: '',
    logoUrl: '',
    logoPosition: 'left',
    showDivider: true,
    isDefault: true,
  },
  {
    id: 'koperasi_sukahideng',
    name: 'Koperasi Pesantren',
    institutionName: 'Koperasi Pondok Pesantren Sukahideng',
    subheading: '',
    address: '',
    contactLine: '',
    logoUrl: '',
    logoPosition: 'left',
    showDivider: true,
    isDefault: false,
  },
  {
    id: 'dewan_santri',
    name: 'Dewan Santri',
    institutionName: 'Dewan Santri',
    subheading: '',
    address: '',
    contactLine: '',
    logoUrl: '',
    logoPosition: 'left',
    showDivider: true,
    isDefault: false,
  },
]

export const DEFAULT_DOCUMENT_PRINT_CONFIGS: DocumentPrintConfig[] = [
  {
    documentKey: 'report_penerimaan',
    label: 'Laporan Penerimaan Kas & Gateway',
    mode: 'default',
    showSignatureBlock: true,
    signatoryTitleLeft: 'Mengetahui,\nBendahara Pesantren',
    signatoryTitleRight: 'Petugas Pembuat Laporan',
  },
  {
    documentKey: 'report_penyaluran',
    label: 'Laporan Penyaluran & Honor',
    mode: 'default',
    showSignatureBlock: true,
    signatoryTitleLeft: 'Mengetahui,\nBendahara Pesantren',
    signatoryTitleRight: 'Petugas Penyaluran',
  },
  {
    documentKey: 'report_tunggakan',
    label: 'Laporan Tunggakan Kewajiban Santri',
    mode: 'default',
    showSignatureBlock: true,
    signatoryTitleLeft: 'Mengetahui,\nBendahara Pesantren',
    signatoryTitleRight: 'Petugas Administrasi',
  },
  {
    documentKey: 'report_dispensasi',
    label: 'Laporan Pembebasan & Keringanan Biaya',
    mode: 'default',
    showSignatureBlock: true,
    signatoryTitleLeft: 'Mengetahui,\nPimpinan Pesantren',
    signatoryTitleRight: 'Bagian Administrasi',
  },
  {
    documentKey: 'report_buku_santri',
    label: 'Laporan Buku Pembantu Santri',
    mode: 'default',
    showSignatureBlock: true,
    signatoryTitleLeft: 'Mengetahui,\nBendahara Pesantren',
    signatoryTitleRight: 'Petugas Pembukuan',
  },
  {
    documentKey: 'report_uang_jajan',
    label: 'Laporan Saldo & Mutasi Uang Jajan',
    mode: 'profile',
    profileId: 'koperasi_sukahideng',
    showSignatureBlock: true,
    signatoryTitleLeft: 'Mengetahui,\nPengelola Koperasi',
    signatoryTitleRight: 'Petugas Kasir Loket',
  },
  {
    documentKey: 'report_sesi_kas',
    label: 'Laporan Rekap Sesi Kasir',
    mode: 'profile',
    profileId: 'koperasi_sukahideng',
    showSignatureBlock: true,
    signatoryTitleLeft: 'Mengetahui,\nPengelola Koperasi',
    signatoryTitleRight: 'Petugas Kasir',
  },
  {
    documentKey: 'report_settlement',
    label: 'Laporan Settlement Payment Gateway',
    mode: 'default',
    showSignatureBlock: true,
    signatoryTitleLeft: 'Mengetahui,\nBendahara Pesantren',
    signatoryTitleRight: 'Administrator Sistem',
  },
  {
    documentKey: 'report_rekonsiliasi',
    label: 'Laporan Rekonsiliasi Bank & Selisih',
    mode: 'default',
    showSignatureBlock: true,
    signatoryTitleLeft: 'Mengetahui,\nBendahara Pesantren',
    signatoryTitleRight: 'Petugas Rekonsiliasi',
  },
  {
    documentKey: 'receipt_pembayaran',
    label: 'Kuitansi Pembayaran Tagihan Tunai',
    mode: 'default',
    showSignatureBlock: false,
  },
  {
    documentKey: 'receipt_penyaluran',
    label: 'Kuitansi / Bukti Penyaluran Dana',
    mode: 'default',
    showSignatureBlock: true,
    signatoryTitleLeft: 'Pihak Penerima Dana',
    signatoryTitleRight: 'Petugas Penyaluran',
  },
  {
    documentKey: 'card_santri',
    label: 'Kartu Santri ID-1 CR80 (Khusus)',
    mode: 'none',
    showSignatureBlock: false,
  },
]


