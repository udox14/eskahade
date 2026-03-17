// File ini TIDAK pakai 'use server' — aman diimport di client & server

export type ExportFilter = {
  jenis_kelamin?: 'L' | 'P'
  asrama?:        string[]   // multi-select
  kamar?:         string[]
  sekolah?:       string[]
  kelas_sekolah?: string[]
  nama_kelas?:    string[]
  marhalah?:      string[]
  tahun_masuk?:   number[]
  alamat_kata?:   string     // tetap single (LIKE search)
}

export type SortBy = 'nama_lengkap' | 'asrama' | 'kamar' | 'kelas_pesantren' | 'sekolah' | 'tahun_masuk' | 'nis'

export type KolomExport = (
  'nis' | 'nama_lengkap' | 'jenis_kelamin' | 'tempat_lahir' | 'tanggal_lahir' |
  'nama_ayah' | 'nama_ibu' | 'alamat' | 'asrama' | 'kamar' | 'tahun_masuk' |
  'sekolah' | 'kelas_sekolah' | 'nama_kelas' | 'marhalah' | 'nik'
)

export const KOLOM_TERSEDIA: { key: KolomExport; label: string; group: string }[] = [
  { key: 'nis',           label: 'NIS',            group: 'Identitas' },
  { key: 'nama_lengkap',  label: 'Nama Lengkap',   group: 'Identitas' },
  { key: 'jenis_kelamin', label: 'Jenis Kelamin',  group: 'Identitas' },
  { key: 'nik',           label: 'NIK',            group: 'Identitas' },
  { key: 'tempat_lahir',  label: 'Tempat Lahir',   group: 'Identitas' },
  { key: 'tanggal_lahir', label: 'Tanggal Lahir',  group: 'Identitas' },
  { key: 'nama_ayah',     label: 'Nama Ayah',      group: 'Keluarga'  },
  { key: 'nama_ibu',      label: 'Nama Ibu',       group: 'Keluarga'  },
  { key: 'alamat',        label: 'Alamat',         group: 'Keluarga'  },
  { key: 'asrama',        label: 'Asrama',         group: 'Pesantren' },
  { key: 'kamar',         label: 'Kamar',          group: 'Pesantren' },
  { key: 'tahun_masuk',   label: 'Tahun Masuk',    group: 'Pesantren' },
  { key: 'nama_kelas',    label: 'Kelas Pesantren',group: 'Pesantren' },
  { key: 'marhalah',      label: 'Marhalah',       group: 'Pesantren' },
  { key: 'sekolah',       label: 'Sekolah',        group: 'Sekolah'   },
  { key: 'kelas_sekolah', label: 'Kelas Sekolah',  group: 'Sekolah'   },
]

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'nama_lengkap',    label: 'Nama (A-Z)'       },
  { value: 'nis',             label: 'NIS'              },
  { value: 'asrama',          label: 'Asrama & Kamar'   },
  { value: 'kamar',           label: 'Kamar'            },
  { value: 'kelas_pesantren', label: 'Kelas Pesantren'  },
  { value: 'sekolah',         label: 'Sekolah & Kelas'  },
  { value: 'tahun_masuk',     label: 'Tahun Masuk'      },
]

export const KOLOM_DEFAULT: KolomExport[] = [
  'nis', 'nama_lengkap', 'jenis_kelamin', 'asrama', 'kamar', 'sekolah', 'kelas_sekolah'
]

export const HEADER_MAP: Record<KolomExport, string> = {
  nis: 'NIS', nama_lengkap: 'Nama Lengkap', jenis_kelamin: 'JK',
  nik: 'NIK', tempat_lahir: 'Tempat Lahir', tanggal_lahir: 'Tgl Lahir',
  nama_ayah: 'Nama Ayah', nama_ibu: 'Nama Ibu', alamat: 'Alamat',
  asrama: 'Asrama', kamar: 'Kamar', tahun_masuk: 'Tahun Masuk',
  sekolah: 'Sekolah', kelas_sekolah: 'Kelas Sekolah',
  nama_kelas: 'Kelas Pesantren', marhalah: 'Marhalah',
}
