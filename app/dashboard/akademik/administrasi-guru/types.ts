export type AdministrasiKind = 'absensi' | 'hafalan' | 'nilai'

export type GuruAdministrasiOption = {
  id: number
  nama_lengkap: string
  gelar: string | null
  kode_guru: string | null
  kelas: string[]
}

export type AdministrasiStudent = {
  id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  sekolah: string | null
  kelas_sekolah: string | null
}

export type AdministrasiClass = {
  id: string
  nama_kelas: string
  santri: AdministrasiStudent[]
}

export type AdministrasiBundle = {
  guru: {
    id: number
    nama_lengkap: string
    gelar: string | null
    kode_guru: string | null
  }
  tahunAjaran: {
    id: number
    nama: string
  }
  kelas: AdministrasiClass[]
}

export type AdministrasiPage =
  | { type: 'cover'; bundle: AdministrasiBundle }
  | { type: 'separator'; bundle: AdministrasiBundle; kelas: AdministrasiClass }
  | {
      type: 'form'
      bundle: AdministrasiBundle
      kelas: AdministrasiClass
      kind: AdministrasiKind
      copyIndex: number
      chunkIndex: number
      chunkCount: number
      students: AdministrasiStudent[]
    }
