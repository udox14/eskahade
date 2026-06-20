// Converter: quran-json-kemenag (per-surat) -> lib/hafalan/data/quran.json (ringkas)
// Sumber: https://github.com/dyazincahya/quran-json-kemenag (surah/{1..114}.json)
//
// Pakai:
//   node scripts/build-quran.mjs                 # arab + terjemah
//   node scripts/build-quran.mjs --arab-only     # arab saja (bundle lebih kecil)
//
// Output cocok dgn resolveHafalanText: quran:{surah}:{ayah}
//   { "1": { "nama":"الفاتحة", "latin":"Al-Fatihah",
//            "ayat": { "1": { "arab":"...", "terjemah":"..." } } } }

import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAW = 'https://raw.githubusercontent.com/dyazincahya/quran-json-kemenag/main/surah'
const arabOnly = process.argv.includes('--arab-only')
const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'lib', 'hafalan', 'data', 'quran.json')

async function fetchSurah(n) {
  const res = await fetch(`${RAW}/${n}.json`)
  if (!res.ok) throw new Error(`surah ${n}: HTTP ${res.status}`)
  return res.json()
}

function pick(obj, keys) {
  for (const k of keys) if (obj?.[k]) return obj[k]
  return undefined
}

const out = {}
for (let n = 1; n <= 114; n++) {
  const rows = await fetchSurah(n)
  const meta = rows[0]?.surah || {}
  const ayat = {}
  for (const row of rows) {
    const arab = pick(row, ['arabic', 'kitabah'])
    const terjemah = pick(row, ['translation'])
    ayat[String(row.ayah)] = arabOnly ? arab : { arab, terjemah }
  }
  out[String(n)] = {
    nama: pick(meta, ['name', 'nama', 'name_arabic', 'arabic']) || '',
    latin: pick(meta, ['latin', 'name_latin', 'transliteration']) || '',
    ayat,
  }
  process.stdout.write(`\r${n}/114 surat`)
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(out))
console.log(`\nSelesai -> ${OUT} (${arabOnly ? 'arab' : 'arab+terjemah'})`)
