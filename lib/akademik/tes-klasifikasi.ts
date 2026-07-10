// lib/akademik/tes-klasifikasi.ts
//
// Satu sumber kebenaran algoritma rekomendasi marhalah + grade dari hasil
// tes klasifikasi santri baru. Dipakai saat input (actions.ts simpanTes)
// dan saat recompute massal (recomputeSemuaTesKlasifikasi) supaya hasil
// lama yang tersimpan dengan versi algoritma lawas bisa dihitung ulang
// tanpa perlu input ulang jawaban mentahnya.

export type HasilTesKlasifikasiInput = {
  baca_kelancaran: string | null | undefined
  baca_tajwid: string | null | undefined
  nahwu_pengalaman: boolean
}

export type HasilTesKlasifikasi = {
  rekomendasi_marhalah: string
  catatan_grade: string
}

// Prioritas utama adalah kemampuan membaca dan tajwid.
export function hitungRekomendasiTesKlasifikasi(input: HasilTesKlasifikasiInput): HasilTesKlasifikasi {
  const { baca_kelancaran: kelancaran, baca_tajwid: tajwid, nahwu_pengalaman: nahwu } = input

  let rekomendasi = 'Ibtidaiyyah 1'
  let grade = 'Grade C'

  if (kelancaran === 'TIDAK_BISA') {
    rekomendasi = 'Tamhidiyyah 1'
    grade = '-'
  } else if (kelancaran === 'TIDAK_LANCAR') {
    rekomendasi = 'Tamhidiyyah 2'
    if (tajwid === 'BURUK') {
      grade = 'Grade C'
    } else if (tajwid === 'KURANG') {
      grade = 'Grade B'
    } else if (tajwid === 'BAIK') {
      grade = 'Grade A'
    }
  } else if (kelancaran === 'LANCAR') {
    rekomendasi = 'Ibtidaiyyah 1'
    if (tajwid === 'BURUK') {
      grade = 'Grade C'
    } else if (tajwid === 'KURANG') {
      grade = 'Grade B'
    } else if (tajwid === 'BAIK') {
      grade = 'Grade A'
    }
  }

  if (nahwu) grade += ' (REKOMENDASI TES NAHWU LANJUTAN)'

  return { rekomendasi_marhalah: rekomendasi, catatan_grade: grade }
}
