// File ini TIDAK pakai 'use server' — aman diimport di client & server

export type ExportFilter = {
  status?:            string     // 'aktif' | 'lulus' | 'keluar' | 'nonaktif_sementara' | 'all'
  jenis_kelamin?:     'L' | 'P'
  asrama?:            string[]   // multi-select
  kamar?:             string[]
  tempat_makan_id?:   string[]
  tempat_mencuci_id?: string[]
  sekolah?:           string[]
  kelas_sekolah?:     string[]
  nama_kelas?:        string[]
  marhalah?:          string[]
  tahun_masuk?:       number[]
  kategori_santri?:   string[]
  gol_darah?:         string[]
  kab_kota?:          string[]
  provinsi?:          string[]
  jemaah?:            string[]
  q?:                 string     // pencarian nama / nis
  alamat_kata?:       string     // pencarian teks alamat
}

export type SortBy =
  | 'nama_lengkap'
  | 'nis'
  | 'asrama'
  | 'kamar'
  | 'kelas_pesantren'
  | 'sekolah'
  | 'tahun_masuk'
  | 'tanggal_masuk'

export type KolomExport = (
  | 'nis'
  | 'nama_lengkap'
  | 'jenis_kelamin'
  | 'nik'
  | 'tempat_lahir'
  | 'tanggal_lahir'
  | 'gol_darah'
  | 'status_global'
  | 'nama_ayah'
  | 'nama_ibu'
  | 'no_wa_ortu'
  | 'alamat'
  | 'alamat_lengkap'
  | 'kecamatan'
  | 'kab_kota'
  | 'provinsi'
  | 'jemaah'
  | 'asrama'
  | 'kamar'
  | 'tahun_masuk'
  | 'tanggal_masuk'
  | 'tanggal_keluar'
  | 'kategori_santri'
  | 'tempat_makan'
  | 'tempat_mencuci'
  | 'nama_kelas'
  | 'marhalah'
  | 'sekolah'
  | 'kelas_sekolah'
)

export const KOLOM_TERSEDIA: { key: KolomExport; label: string; group: string }[] = [
  // 1. Identitas Santri
  { key: 'nis',             label: 'NIS',                     group: 'Identitas Santri' },
  { key: 'nama_lengkap',    label: 'Nama Lengkap',            group: 'Identitas Santri' },
  { key: 'jenis_kelamin',   label: 'Jenis Kelamin',           group: 'Identitas Santri' },
  { key: 'nik',             label: 'NIK',                     group: 'Identitas Santri' },
  { key: 'tempat_lahir',    label: 'Tempat Lahir',            group: 'Identitas Santri' },
  { key: 'tanggal_lahir',   label: 'Tanggal Lahir',           group: 'Identitas Santri' },
  { key: 'gol_darah',       label: 'Golongan Darah',          group: 'Identitas Santri' },
  { key: 'status_global',   label: 'Status Santri',           group: 'Identitas Santri' },
  { key: 'kategori_santri', label: 'Kategori Santri',         group: 'Identitas Santri' },

  // 2. Kehidupan Pesantren & Asrama
  { key: 'asrama',          label: 'Asrama',                  group: 'Pesantren & Asrama' },
  { key: 'kamar',           label: 'Kamar',                   group: 'Pesantren & Asrama' },
  { key: 'nama_kelas',      label: 'Kelas Pesantren',         group: 'Pesantren & Asrama' },
  { key: 'marhalah',        label: 'Marhalah',                group: 'Pesantren & Asrama' },
  { key: 'tahun_masuk',     label: 'Tahun Masuk',             group: 'Pesantren & Asrama' },
  { key: 'tanggal_masuk',   label: 'Tanggal Masuk',           group: 'Pesantren & Asrama' },
  { key: 'tanggal_keluar',  label: 'Tanggal Keluar',          group: 'Pesantren & Asrama' },

  // 3. Sekolah Formal & Layanan
  { key: 'sekolah',         label: 'Sekolah Formal',          group: 'Sekolah & Layanan' },
  { key: 'kelas_sekolah',   label: 'Kelas Sekolah',           group: 'Sekolah & Layanan' },
  { key: 'tempat_makan',    label: 'Katering / Tempat Makan', group: 'Sekolah & Layanan' },
  { key: 'tempat_mencuci',  label: 'Laundry / Tempat Cuci',   group: 'Sekolah & Layanan' },

  // 4. Keluarga & Wilayah Asal
  { key: 'nama_ayah',       label: 'Nama Ayah',               group: 'Keluarga & Wilayah' },
  { key: 'nama_ibu',        label: 'Nama Ibu',                group: 'Keluarga & Wilayah' },
  { key: 'no_wa_ortu',      label: 'No. WA / HP Ortu',        group: 'Keluarga & Wilayah' },
  { key: 'alamat',          label: 'Alamat Ringkas',          group: 'Keluarga & Wilayah' },
  { key: 'alamat_lengkap',  label: 'Alamat Lengkap',          group: 'Keluarga & Wilayah' },
  { key: 'kecamatan',       label: 'Kecamatan',               group: 'Keluarga & Wilayah' },
  { key: 'kab_kota',        label: 'Kab/Kota',                group: 'Keluarga & Wilayah' },
  { key: 'provinsi',        label: 'Provinsi',                group: 'Keluarga & Wilayah' },
  { key: 'jemaah',          label: 'Jemaah',                  group: 'Keluarga & Wilayah' },
]

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'nama_lengkap',    label: 'Nama (A-Z)' },
  { value: 'nis',             label: 'NIS' },
  { value: 'asrama',          label: 'Asrama & Kamar' },
  { value: 'kamar',           label: 'Kamar' },
  { value: 'kelas_pesantren', label: 'Kelas Pesantren' },
  { value: 'sekolah',         label: 'Sekolah & Kelas' },
  { value: 'tahun_masuk',     label: 'Tahun Masuk' },
  { value: 'tanggal_masuk',   label: 'Tanggal Masuk' },
]

export const KOLOM_DEFAULT: KolomExport[] = [
  'nis', 'nama_lengkap', 'jenis_kelamin', 'asrama', 'kamar', 'nama_kelas', 'sekolah', 'kelas_sekolah'
]

export interface PresetKolom {
  id: string
  label: string
  description: string
  kolom: KolomExport[]
}

export const PRESET_KOLOM: PresetKolom[] = [
  {
    id: 'standar',
    label: 'Ringkas (Standar)',
    description: 'Data pokok, kamar, kelas & sekolah',
    kolom: ['nis', 'nama_lengkap', 'jenis_kelamin', 'asrama', 'kamar', 'nama_kelas', 'sekolah', 'kelas_sekolah'],
  },
  {
    id: 'lengkap',
    label: 'Lengkap (Semua)',
    description: 'Seluruh 29 kolom data santri',
    kolom: KOLOM_TERSEDIA.map(k => k.key),
  },
  {
    id: 'asrama_layanan',
    label: 'Asrama & Fasilitas',
    description: 'Kamar, katering & laundry',
    kolom: ['nis', 'nama_lengkap', 'jenis_kelamin', 'asrama', 'kamar', 'tempat_makan', 'tempat_mencuci'],
  },
  {
    id: 'kontak_keluarga',
    label: 'Kontak & Keluarga',
    description: 'Nama ortu, No WA & asal daerah',
    kolom: ['nis', 'nama_lengkap', 'nama_ayah', 'nama_ibu', 'no_wa_ortu', 'alamat', 'kab_kota', 'provinsi', 'jemaah'],
  },
  {
    id: 'akademik',
    label: 'Akademik & Sekolah',
    description: 'Kelas pesantren, marhalah & sekolah',
    kolom: ['nis', 'nama_lengkap', 'marhalah', 'nama_kelas', 'sekolah', 'kelas_sekolah', 'tahun_masuk'],
  },
]

export const HEADER_MAP: Record<KolomExport, string> = {
  nis: 'NIS',
  nama_lengkap: 'Nama Lengkap',
  jenis_kelamin: 'JK',
  nik: 'NIK',
  tempat_lahir: 'Tempat Lahir',
  tanggal_lahir: 'Tgl Lahir',
  gol_darah: 'Gol Darah',
  status_global: 'Status Santri',
  nama_ayah: 'Nama Ayah',
  nama_ibu: 'Nama Ibu',
  no_wa_ortu: 'No. WA Ortu',
  alamat: 'Alamat',
  alamat_lengkap: 'Alamat Lengkap',
  kecamatan: 'Kecamatan',
  kab_kota: 'Kab/Kota',
  provinsi: 'Provinsi',
  jemaah: 'Jemaah',
  asrama: 'Asrama',
  kamar: 'Kamar',
  tahun_masuk: 'Tahun Masuk',
  tanggal_masuk: 'Tgl Masuk',
  tanggal_keluar: 'Tgl Keluar',
  kategori_santri: 'Kategori Santri',
  tempat_makan: 'Katering / Tempat Makan',
  tempat_mencuci: 'Laundry / Tempat Cuci',
  sekolah: 'Sekolah',
  kelas_sekolah: 'Kelas Sekolah',
  nama_kelas: 'Kelas Pesantren',
  marhalah: 'Marhalah',
}
