type QuranExportData = {
  santri: { riwayat_id: string; santri_id: string; nama: string; nis: string | null }[]
  bab: { urutan: number; blok: { id: number; ref: string | null; urutan: number }[] }[]
  progressStatus?: Record<string, string>
}

type Surah = { number: number; name: string; ayahCount: number }

export function buildQuranExportRows(data: QuranExportData, surahs: readonly Surah[]) {
  const surahByNumber = new Map(surahs.map(surah => [surah.number, surah]))
  const verses = data.bab.flatMap(bab => bab.blok.map(blok => {
    const ref = /^quran:(\d+):(\d+)$/.exec(blok.ref ?? '')
    return {
      id: blok.id,
      // Materi lama menggunakan urutan bab dan blok sebagai nomor surat dan ayat.
      surat: Number(ref?.[1] ?? bab.urutan),
      ayat: Number(ref?.[2] ?? blok.urutan),
    }
  }))

  const rows: (string | number | null)[][] = []
  // Gunakan riwayat yang sama dengan pemetaan progres di getHafalanInputData.
  const students = new Map(data.santri.map(santri => [santri.santri_id, santri]))
  for (const student of students.values()) {
    const memorized = new Map<number, Set<number>>()
    for (const verse of verses) {
      if (data.progressStatus?.[`${student.riwayat_id}:${verse.id}`] !== 'hafal') continue
      const surah = surahByNumber.get(verse.surat)
      if (!surah || !Number.isInteger(verse.ayat) || verse.ayat < 1 || verse.ayat > surah.ayahCount) {
        return { error: 'Ada data hafalan dengan nomor surat atau ayat yang tidak valid.' }
      }
      const ayat = memorized.get(verse.surat) ?? new Set<number>()
      ayat.add(verse.ayat)
      memorized.set(verse.surat, ayat)
    }

    const identity = [student.nis ?? '', student.nama]
    if (memorized.size === 0) {
      rows.push([...identity, '', null, null, 'Belum ada ayat berstatus hafal'])
      continue
    }

    for (const surah of surahs) {
      const memorizedAyat = memorized.get(surah.number)
      if (!memorizedAyat) continue
      const [first, ...rest] = [...memorizedAyat].sort((a, b) => a - b)
      let start = first
      let end = first
      for (const ayat of rest) {
        if (ayat !== end + 1) {
          rows.push([...identity, surah.name, start, end, 'Hafal'])
          start = ayat
        }
        end = ayat
      }
      rows.push([...identity, surah.name, start, end, 'Hafal'])
    }
  }
  return { rows }
}
