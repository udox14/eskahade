// Resolver teks hafalan. ref -> { arab, terjemah?, meta? }
// Data statis di lib/hafalan/data. Lihat data/README.md untuk format.
import quran from './data/quran.json'
import jurumiyah from './data/jurumiyah.json'
import amtsilah from './data/amtsilah.json'
import haditsAkhlaq1 from './data/hadits/akhlaq-ibtidaiyah-1.json'
import haditsTalkhish2 from './data/hadits/talkhish-riyadl-ibtidaiyah-2.json'
import haditsTalkhish3 from './data/hadits/talkhish-riyadl-ibtidaiyah-3.json'

export type HafalanText = {
  arab?: string
  terjemah?: string
  /** Catatan tambahan: perawi hadits, judul kitab/bab, dll. */
  meta?: string
}

type AnyRecord = Record<string, any>

// Registry kitab hadits. Tambah file baru di sini saat ada kitab lain.
// Bentuk kitab: { judul, bab: { <slug>: { nama, urutan, segmen: { n: {arab,terjemah} } } } }
const HADITS_KITAB: Record<string, AnyRecord> = {
  'akhlaq-ibtidaiyah-1': haditsAkhlaq1 as AnyRecord,
  'talkhish-riyadl-ibtidaiyah-2': haditsTalkhish2 as AnyRecord,
  'talkhish-riyadl-ibtidaiyah-3': haditsTalkhish3 as AnyRecord,
}

const QURAN = quran as AnyRecord
const JURUMIYAH = jurumiyah as AnyRecord
const AMTSILAH = amtsilah as AnyRecord

/**
 * Resolusi ref ke teks. null bila ref kosong / data belum ada.
 * Format ref:
 *   quran:{surah}:{ayah}
 *   hadits:{kitab}:{babslug}:{n}   (atau legacy hadits:{kitab}:{no})
 *   jurumiyah:{slug}:{n}           amtsilah:{slug}
 */
export function resolveHafalanText(ref?: string | null): HafalanText | null {
  if (!ref) return null
  const [type, ...rest] = String(ref).split(':')

  switch (type) {
    case 'quran': {
      const [surah, ayah] = rest
      const entry = QURAN[surah]?.ayat?.[ayah]
      if (!entry) return null
      if (typeof entry === 'string') return { arab: entry, meta: QURAN[surah]?.nama }
      return { arab: entry.arab, terjemah: entry.terjemah, meta: QURAN[surah]?.nama }
    }
    case 'hadits': {
      const kitab = HADITS_KITAB[rest[0]]
      if (!kitab) return null
      // bentuk bersegmen: hadits:{kitab}:{babslug}:{n}
      if (rest.length >= 3 && kitab.bab) {
        const bab = kitab.bab[rest[1]]
        const seg = bab?.segmen?.[rest[2]]
        if (!seg) return null
        return typeof seg === 'string'
          ? { arab: seg, meta: bab.nama }
          : { arab: seg.arab, terjemah: seg.terjemah, meta: bab.nama }
      }
      // legacy: hadits:{kitab}:{no}
      const item = kitab.items?.[rest[1]]
      if (!item) return null
      return { arab: item.arab, terjemah: item.terjemah, meta: item.perawi || kitab.judul }
    }
    case 'jurumiyah': {
      const [slug, seg] = rest
      const bab = JURUMIYAH.bab?.[slug]
      if (!bab) return null
      if (seg != null) {
        const s = bab.segmen?.[seg]
        return s ? { arab: s, meta: bab.nama } : null
      }
      // bab utuh: gabung semua segmen jadi satu teks (untuk highlight per kata)
      const joined = Object.keys(bab.segmen || {})
        .sort((a, b) => Number(a) - Number(b))
        .map(k => bab.segmen[k])
        .join(' ')
      return joined ? { arab: joined, meta: bab.nama } : null
    }
    case 'amtsilah': {
      const item = AMTSILAH.wazan?.[rest[0]]
      if (!item) return null
      return { arab: item.arab, terjemah: item.terjemah }
    }
    default:
      return null
  }
}

export function hasHafalanText(ref?: string | null): boolean {
  return resolveHafalanText(ref) != null
}

// ── Matan bawaan (untuk seed materi otomatis) ────────────────────────────────
export type MatanBab = {
  slug: string
  nama: string
  urutan: number
  segmen: { n: number; ref: string; label?: string }[]
}

function babFromSource(src: AnyRecord | null, refPrefix: string, opts?: { whole?: boolean }): MatanBab[] {
  if (!src?.bab) return []
  return Object.entries(src.bab)
    .map(([slug, b]: [string, any]) => ({
      slug,
      nama: b.nama || slug,
      urutan: Number(b.urutan) || 0,
      // whole: 1 bab = 1 blok teks utuh (ref tanpa indeks segmen). Selain itu per-segmen.
      segmen: opts?.whole
        ? [{ n: 1, ref: `${refPrefix}:${slug}` }]
        : Object.entries(b.segmen || {}).map(([n, seg]: [string, any]) => ({
            n: Number(n),
            ref: `${refPrefix}:${slug}:${n}`,
            label: seg && typeof seg === 'object' ? seg.no : undefined,
          })),
    }))
    .sort((a, b) => a.urutan - b.urutan)
}

/** Sumber matan bawaan per jenis (satu jenis bisa punya beberapa, mis. kitab hadits). */
export type MatanSource = { key: string; label: string; bab: MatanBab[] }

export function getMatanSources(jenis: string): MatanSource[] {
  if (jenis === 'jurumiyah') {
    return [{ key: 'jurumiyah', label: JURUMIYAH.judul || 'Matan Al-Ajurrumiyyah', bab: babFromSource(JURUMIYAH, 'jurumiyah', { whole: true }) }]
  }
  if (jenis === 'hadits') {
    return Object.entries(HADITS_KITAB)
      .filter(([, d]) => (d as AnyRecord).bab)
      .map(([kitab, d]) => ({ key: kitab, label: (d as AnyRecord).judul || kitab, bab: babFromSource(d as AnyRecord, `hadits:${kitab}`) }))
  }
  return []
}

/** Daftar bab+segmen (dengan ref) dari satu sumber matan. Tanpa key = sumber pertama. */
export function getMatanBab(jenis: string, key?: string): MatanBab[] {
  const sources = getMatanSources(jenis)
  if (sources.length === 0) return []
  const chosen = key ? sources.find(s => s.key === key) : sources[0]
  return chosen ? chosen.bab : []
}

export function hasMatan(jenis: string): boolean {
  return getMatanSources(jenis).length > 0
}

/** Slug konsisten untuk membentuk ref dari judul/label. */
export function hafalanSlug(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
