export type ExportModule = 'nilai' | 'hafalan'
export type ExportRequest =
  | { module: 'nilai'; kelasId: string; scope: 'semua' }
  | { module: 'nilai'; kelasId: string; scope: 'mapel'; mapelIds: number[] }
  | { module: 'nilai'; kelasId: string; scope: 'sesi'; sesiIds: string[] }
  | { module: 'hafalan'; kelasId: string; scope: 'semua' }
  | { module: 'hafalan'; kelasId: string; scope: 'jenis'; jenis: string }

export type ExportCell = string | number | null
export type ExportSheet = { name: string; headers: string[]; rows: ExportCell[][] }
export type ExportDocument = {
  title: string; kelas: string; tahunAjaran: string; cakupan: string; exportedAt: string
  sheets: ExportSheet[]
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

export function buildNilaiSheets(santri: ExportSantri[], sesi: ExportSesi[], nilai: ExportNilai[], groupBy: 'mapel' | 'sesi' = 'mapel') {
  const scores = new Map(nilai.map(n => [`${n.riwayat_pendidikan_id}:${n.sesi_id}`, n.nilai]))
  const groups = new Map<number | string, ExportSesi[]>()
  for (const item of sesi) {
    const key = groupBy === 'sesi' ? item.id : item.mapel_id
    const group = groups.get(key) ?? []
    group.push(item); groups.set(key, group)
  }
  function sheet(name: string, sessions: ExportSesi[], combined = false): ExportSheet {
    const used = new Set<string>()
    const columns = sessions.map(item => {
      const base = `${combined ? `${item.mapel_nama} · ` : ''}${item.nama_sesi} (${item.tanggal})`
      let label = base, suffix = 2
      while (used.has(label)) label = `${base} (${suffix++})`
      used.add(label)
      return label
    })
    return {
      name, headers: ['No', ...identityHeaders, ...columns, ...(sessions.length > 1 ? ['Rata-rata'] : [])],
      rows: santri.map((s, i) => {
        const values = sessions.map(item => scores.get(`${s.riwayat_id}:${item.id}`) ?? null)
        const filled = values.filter((v): v is number => v !== null)
        return [i + 1, ...identity(s), ...values, ...(sessions.length > 1 ? [filled.length ? round(filled.reduce((a, b) => a + b, 0) / filled.length) : null] : [])]
      }),
    }
  }
  const sheets = Array.from(groups.values()).map(items => sheet(groupBy === 'sesi' ? `${items[0].mapel_nama} - ${items[0].nama_sesi}` : items[0].mapel_nama, items))
  if (sheets.length > 1) sheets.unshift(sheet('Gabungan', sesi, true))
  return { sheets }
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
  const sheets: ExportSheet[] = []
  for (const blocks of groups.values()) {
    const jurumiyah = blocks[0].jenis === 'jurumiyah'
    const sheet: ExportSheet = { name: blocks[0].jenis_label, headers: ['No', ...identityHeaders, 'Total Blok', 'Hafal', 'Proses', 'Belum Dihafal', 'Penyelesaian (%)', ...(jurumiyah ? ['Target Kata', 'Kata Dihafal', 'Kata Dihafal (%)'] : [])], rows: [] }
    for (const s of santri) {
      let hafal = 0, proses = 0, totalWords = 0, doneWords = 0
      for (const b of blocks) {
        const p = byProgress.get(`${s.santri_id}:${b.id}`)
        const words = p?.words.size ?? 0
        const done = jurumiyah ? b.total_kata > 0 && words === b.total_kata : !!p?.hafal
        const partial = !done && (jurumiyah ? words > 0 : !!p?.proses)
        if (done) hafal++
        if (partial) proses++
        totalWords += b.total_kata; doneWords += words
      }
      sheet.rows.push([sheet.rows.length + 1, ...identity(s), blocks.length, hafal, proses,
        blocks.length - hafal - proses, round(hafal / blocks.length * 100), ...(jurumiyah ? [totalWords, doneWords, totalWords ? round(doneWords / totalWords * 100) : null] : [])])
    }
    sheets.push(sheet)
  }
  if (sheets.length > 1) sheets.unshift({
    name: 'Gabungan', headers: ['No', ...identityHeaders, ...sheets.flatMap(sheet => sheet.headers.slice(5).map(header => `${sheet.name} · ${header}`))],
    rows: santri.map((s, i) => [i + 1, ...identity(s), ...sheets.flatMap(sheet => sheet.rows[i].slice(5))]),
  })
  return { sheets }
}
