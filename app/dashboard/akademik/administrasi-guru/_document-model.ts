import type {
  AdministrasiBundle,
  AdministrasiKind,
  AdministrasiPage,
  AdministrasiStudent,
} from './types'

export const ROWS_PER_PAGE = 45
export const ADMINISTRASI_KIND_ORDER: AdministrasiKind[] = ['absensi', 'hafalan', 'nilai']

export function chunkStudents(students: AdministrasiStudent[]) {
  if (students.length === 0) return [[]] as AdministrasiStudent[][]
  const chunks: AdministrasiStudent[][] = []
  for (let index = 0; index < students.length; index += ROWS_PER_PAGE) {
    chunks.push(students.slice(index, index + ROWS_PER_PAGE))
  }
  return chunks
}

export function buildAdministrasiPages(
  bundle: AdministrasiBundle,
  selectedKinds: AdministrasiKind[]
): AdministrasiPage[] {
  const enabled = new Set(selectedKinds)
  const pages: AdministrasiPage[] = [{ type: 'cover', bundle }]

  for (const kelas of bundle.kelas) {
    pages.push({ type: 'separator', bundle, kelas })
    const chunks = chunkStudents(kelas.santri)

    for (const kind of ADMINISTRASI_KIND_ORDER) {
      if (!enabled.has(kind)) continue
      const copies = kind === 'hafalan' ? 3 : 1
      for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
        chunks.forEach((students, chunkIndex) => {
          pages.push({
            type: 'form',
            bundle,
            kelas,
            kind,
            copyIndex,
            chunkIndex,
            chunkCount: chunks.length,
            students,
          })
        })
      }
    }
  }

  return pages
}

export function paddedStudentRows(page: Extract<AdministrasiPage, { type: 'form' }>) {
  return Array.from({ length: ROWS_PER_PAGE }, (_, slotIndex) => ({
    student: page.students[slotIndex] ?? null,
    number: page.students[slotIndex] ? page.chunkIndex * ROWS_PER_PAGE + slotIndex + 1 : null,
  }))
}

export function teacherDisplayName(bundle: AdministrasiBundle) {
  return [bundle.guru.nama_lengkap, bundle.guru.gelar].filter(Boolean).join(', ')
}

export function formatDorm(student: AdministrasiStudent | null) {
  if (!student) return ''
  return [student.asrama, student.kamar].filter(Boolean).join(' / ')
}

export function formatSchool(student: AdministrasiStudent | null) {
  if (!student) return ''
  return [student.sekolah, student.kelas_sekolah].filter(Boolean).join(' / ')
}

export function safeDocumentFilename(bundle: AdministrasiBundle) {
  return `Administrasi-Guru-${teacherDisplayName(bundle)}-${bundle.tahunAjaran.nama}`
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
