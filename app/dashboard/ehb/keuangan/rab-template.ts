import type { RabItemInput } from './actions'
import type { DraftRabItem } from './_rab-editor'

type TemplateItem = Omit<RabItemInput, 'qty'>
const inspectionKey = 'honor_pemeriksaan_hasil'

export function isLegacyInspection(key: string | null | undefined) {
  return Boolean(key && /^honor_pemeriksaan_(header|\d+)$/.test(key))
}

function itemKey(item: TemplateItem) {
  if (item.system_key) return `system:${item.system_key}`
  return `manual:${item.kategori}:${item.nama_barang.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID')}`
}

export function planRabTemplate(
  active: DraftRabItem[],
  source: TemplateItem[],
  autoQty: ReadonlyMap<string, number>,
) {
  const seen = new Set<string>()
  const existing = new Map(active.map(row => [itemKey(row), row]))
  const combinedActive = active.find(row => row.system_key === inspectionKey)
  const combinedSource = source.find(row => row.system_key === inspectionKey)
  const legacyActive = active.filter(row => isLegacyInspection(row.system_key))
  const legacySource = source.filter(row => isLegacyInspection(row.system_key))
  let candidates = source
  let skippedInspectionPrice = false

  // Earlier RABs split inspection by marhalah. Keep one representation so a
  // copy cannot budget the same exam under both the old and the new structure.
  if (combinedActive || (combinedSource && !legacyActive.length)) {
    candidates = source.filter(row => !isLegacyInspection(row.system_key))
    if (combinedActive && !combinedSource && legacySource.length) {
      const rates = new Set(legacySource.filter(row => row.system_key !== 'honor_pemeriksaan_header').map(row => row.harga))
      if (rates.size === 1) candidates.push({ ...combinedActive, harga: [...rates][0] })
      skippedInspectionPrice = combinedActive.harga === 0 && rates.size > 1
    }
  } else if (combinedSource && legacyActive.length) {
    candidates = source.filter(row => row.system_key !== inspectionKey)
    if (!legacySource.length) {
      candidates.push(...legacyActive.filter(row => row.system_key !== 'honor_pemeriksaan_header')
        .map(row => ({ ...row, harga: combinedSource.harga })))
    }
  }

  const nextOrder = new Map<string, number>()
  for (const row of active) {
    nextOrder.set(row.kategori, Math.max(nextOrder.get(row.kategori) ?? 0, row.urutan ?? 0))
  }
  const additions: RabItemInput[] = []
  const prices: { id: string; name: string; harga: number }[] = []
  for (const row of candidates) {
    const key = itemKey(row)
    if (!row.nama_barang.trim() || seen.has(key)) continue
    seen.add(key)
    const match = existing.get(key)
    if (match) {
      if (row.system_key && match.harga === 0 && row.harga > 0) {
        prices.push({ id: match.draft_id, name: match.nama_barang, harga: row.harga })
      }
      continue
    }
    const order = (nextOrder.get(row.kategori) ?? 0) + 1
    nextOrder.set(row.kategori, order)
    additions.push({
      ...row,
      urutan: order,
      qty: row.system_key ? autoQty.get(row.system_key) ?? 0 : 0,
    })
  }
  return { additions, prices, skippedInspectionPrice }
}
