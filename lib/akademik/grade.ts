// lib/akademik/grade.ts
//
// Satu sumber kebenaran untuk grade santri.
// Grade tersimpan dalam beberapa format di DB:
//   - hasil_tes_klasifikasi.catatan_grade : "Grade A", "Grade A (REKOMENDASI TES NAHWU LANJUTAN)", "-"
//   - riwayat_pendidikan.grade_lanjutan   : "Grade A", "Grade B", "Grade C"
//   - kelas.grade (komposisi)             : "A", "AB", "ABC", "B", "BC", "C"
//     (kelas tak harus 1 grade — komposisi memuat huruf grade yang ditampung,
//      mis. "ABC" = kelas campur semua grade)
//
// Util ini menormalkan grade santri jadi satu huruf (A/B/C) dan
// mencocokkannya dengan komposisi kelas.

export type Grade = 'A' | 'B' | 'C'

// Komposisi grade yang valid untuk sebuah kelas (huruf grade yang ditampung).
export const KOMPOSISI_KELAS = ['A', 'AB', 'ABC', 'B', 'BC', 'C'] as const
export type KomposisiKelas = (typeof KOMPOSISI_KELAS)[number]

export function isKomposisiKelas(value: string | null | undefined): value is KomposisiKelas {
  if (!value) return false
  return (KOMPOSISI_KELAS as readonly string[]).includes(value.trim().toUpperCase())
}

// Normalkan teks grade apa pun jadi satu huruf A/B/C, atau null jika tak ada.
// Ambil huruf grade pertama yang muncul ("Grade A (REKOMENDASI...)" -> "A").
export function normalizeGrade(raw: string | null | undefined): Grade | null {
  if (!raw) return null
  const text = String(raw).toUpperCase()
  
  // Cocokkan pola "GRADE A/B/C" secara eksplisit terlebih dahulu agar huruf 'A' pada kata "GRADE" tidak salah dicocokkan
  const gradeMatch = text.match(/\bGRADE\s+([ABC])\b/)
  if (gradeMatch) {
    return gradeMatch[1] as Grade
  }

  // Fallback ke huruf A/B/C yang berdiri sendiri
  const match = text.match(/\b[ABC]\b/)
  if (!match) return null
  const letter = match[0] as Grade
  return letter === 'A' || letter === 'B' || letter === 'C' ? letter : null
}

// Label "Grade X" standar untuk disimpan ke kolom grade_lanjutan.
export function gradeLabel(grade: Grade): string {
  return `Grade ${grade}`
}

// Apakah santri dengan `grade` cocok ditempatkan di kelas berkomposisi `kelasGrade`?
// Komposisi harus memuat huruf grade (mis. grade B cocok di "AB", "ABC", "B", "BC").
export function gradeCocokKelas(grade: Grade | null, kelasGrade: string | null | undefined): boolean {
  if (!grade) return false
  if (!kelasGrade) return false
  return kelasGrade.trim().toUpperCase().includes(grade)
}
