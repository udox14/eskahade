export type ExportModule = 'nilai' | 'hafalan'
export type ExportRequest =
  | { module: 'nilai'; kelasId: string; scope: 'semua' }
  | { module: 'nilai'; kelasId: string; scope: 'mapel'; mapelId: number }
  | { module: 'nilai'; kelasId: string; scope: 'sesi'; mapelId: number; sesiId: string }
  | { module: 'hafalan'; kelasId: string; scope: 'semua' }
  | { module: 'hafalan'; kelasId: string; scope: 'jenis'; jenis: string }

export type ExportCell = string | number | null
export type ExportSheet = { headers: string[]; rows: ExportCell[][] }
export type ExportDocument = {
  title: string; kelas: string; tahunAjaran: string; cakupan: string; exportedAt: string
  rekap: ExportSheet; detail: ExportSheet
}
export type ExportResult<T> = { ok: true; data: T } | { ok: false; error: string }
export type ExportOptions = {
  mapel: { id: number; nama: string }[]
  sesi: { id: string; mapel_id: number; nama_sesi: string; tanggal: string }[]
  jenis: { key: string; label: string }[]
}
export type ExportSantri = {
  riwayat_id: string; santri_id: string; nis: string | null; nama: string
  asrama: string | null; kamar: string | null
}
export type ExportSesi = {
  id: string; mapel_id: number; mapel_nama: string; nama_sesi: string
  tanggal: string; guru_nama: string | null; kkm: number
}
export type ExportNilai = { sesi_id: string; riwayat_pendidikan_id: string; nilai: number }
const identity = (s: ExportSantri): ExportCell[] => [String(s.nis ?? ''), s.nama, s.asrama ?? '', s.kamar ?? '']
const identityHeaders = ['NIS', 'Nama', 'Asrama', 'Kamar']
const round = (n: number) => Math.round(n * 10) / 10

export function buildNilaiSheets(santri: ExportSantri[], sesi: ExportSesi[], nilai: ExportNilai[]) {
  const scores = new Map(nilai.map(n => [`${n.riwayat_pendidikan_id}:${n.sesi_id}`, n.nilai]))
  const groups = new Map<number, ExportSesi[]>()
  for (const item of sesi) {
    const group = groups.get(item.mapel_id) ?? []
    group.push(item); groups.set(item.mapel_id, group)
  }
  const rekap: ExportSheet = { headers: ['No', ...identityHeaders, 'Mapel', 'Jumlah Sesi', 'Nilai Terisi', 'Rata-rata', 'Minimum', 'Maksimum', 'Tuntas', 'Tidak Tuntas'], rows: [] }
  const detail: ExportSheet = { headers: ['No', ...identityHeaders, 'Mapel', 'Sesi', 'Tanggal', 'Guru', 'KKM', 'Nilai', 'Ketuntasan'], rows: [] }
  for (const s of santri) {
    for (const sessions of groups.values()) {
      const values: number[] = []
      let tuntas = 0
      for (const item of sessions) {
        const score = scores.get(`${s.riwayat_id}:${item.id}`) ?? null
        if (score !== null) { values.push(score); if (score >= item.kkm) tuntas++ }
        detail.rows.push([detail.rows.length + 1, ...identity(s), item.mapel_nama, item.nama_sesi, item.tanggal, item.guru_nama ?? '', item.kkm, score, score === null ? 'Belum diisi' : score >= item.kkm ? 'Tuntas' : 'Tidak Tuntas'])
      }
      rekap.rows.push([rekap.rows.length + 1, ...identity(s), sessions[0].mapel_nama, sessions.length, values.length,
        values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null,
        values.length ? values.reduce((a, b) => Math.min(a, b)) : null,
        values.length ? values.reduce((a, b) => Math.max(a, b)) : null, tuntas, values.length - tuntas])
    }
  }
  return { rekap, detail }
}

export type ExportBlok = {
  id: number; jenis: string; jenis_label: string; judul: string; label: string; total_kata: number
}
export type ExportProgress = { blok_id: number; santri_id: string; status: string; highlight: string | null }
export function buildHafalanSheets(santri: ExportSantri[], blok: ExportBlok[], progress: ExportProgress[]) {
  const byProgress = new Map<string, { hafal: boolean; proses: boolean; words: Set<number> }>()
  const byBlok = new Map(blok.map(b => [b.id, b]))
  for (const p of progress) {
    const target = byBlok.get(p.blok_id)
    if (!target) continue
    const key = `${p.santri_id}:${p.blok_id}`
    const merged = byProgress.get(key) ?? { hafal: false, proses: false, words: new Set<number>() }
    merged.hafal ||= p.status === 'hafal'
    merged.proses ||= p.status === 'proses'
    if (target.jenis === 'jurumiyah' && p.highlight) {
      try {
        const words: unknown = JSON.parse(p.highlight)
        if (Array.isArray(words)) for (const word of words) {
          if (typeof word === 'number' && Number.isInteger(word) && word >= 0 && word < target.total_kata) merged.words.add(word)
        }
      } catch { /* Invalid historical highlights do not count as memorized words. */ }
    }
    byProgress.set(key, merged)
  }
  const groups = new Map<string, ExportBlok[]>()
  for (const b of blok) {
    const group = groups.get(b.jenis) ?? []
    group.push(b); groups.set(b.jenis, group)
  }
  const rekap: ExportSheet = { headers: ['No', ...identityHeaders, 'Jenis Hafalan', 'Total Blok', 'Hafal', 'Proses', 'Belum Dihafal', 'Penyelesaian (%)', 'Target Kata', 'Kata Dihafal', 'Kata Dihafal (%)'], rows: [] }
  const detail: ExportSheet = { headers: ['No', ...identityHeaders, 'Jenis Hafalan', 'Bab/Surat', 'Bagian/Ayat', 'Status', 'Target Kata', 'Kata Dihafal', 'Kata Dihafal (%)'], rows: [] }
  for (const s of santri) for (const blocks of groups.values()) {
    let hafal = 0, proses = 0, totalWords = 0, doneWords = 0
    const jurumiyah = blocks[0].jenis === 'jurumiyah'
    for (const b of blocks) {
      const p = byProgress.get(`${s.santri_id}:${b.id}`)
      const words = p?.words.size ?? 0
      const done = jurumiyah ? b.total_kata > 0 && words === b.total_kata : !!p?.hafal
      const partial = !done && (jurumiyah ? words > 0 : !!p?.proses)
      if (done) hafal++
      if (partial) proses++
      totalWords += b.total_kata; doneWords += words
      detail.rows.push([detail.rows.length + 1, ...identity(s), b.jenis_label, b.judul, b.label,
        done ? 'Hafal' : partial ? 'Proses' : 'Belum dihafal',
        jurumiyah ? b.total_kata : null, jurumiyah ? words : null, jurumiyah && b.total_kata ? round(words / b.total_kata * 100) : null])
    }
    rekap.rows.push([rekap.rows.length + 1, ...identity(s), blocks[0].jenis_label, blocks.length, hafal, proses,
      blocks.length - hafal - proses, round(hafal / blocks.length * 100), jurumiyah ? totalWords : null,
      jurumiyah ? doneWords : null, jurumiyah && totalWords ? round(doneWords / totalWords * 100) : null])
  }
  return { rekap, detail }
}
