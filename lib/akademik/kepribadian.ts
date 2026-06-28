export const KEPRIBADIAN_FIELDS = [
  { key: 'kedisiplinan', label: 'Akhlak/Budi Pekerti' },
  { key: 'ibadah', label: 'Ketekunan Ibadah' },
  { key: 'kesopanan', label: 'Kerapihan' },
  { key: 'kebersihan', label: 'Kebersihan' },
  { key: 'kemandirian', label: 'Kemandirian' },
] as const

export const KEPRIBADIAN_PREDIKAT = [
  { code: 'A', description: 'Sangat Baik', score: 95 },
  { code: 'B', description: 'Baik', score: 80 },
  { code: 'C', description: 'Cukup', score: 65 },
  { code: 'D', description: 'Kurang', score: 50 },
  { code: 'E', description: 'Sangat Kurang', score: 35 },
] as const

export type KepribadianCode = typeof KEPRIBADIAN_PREDIKAT[number]['code']

const PREDIKAT_BY_CODE = new Map(KEPRIBADIAN_PREDIKAT.map(item => [item.code, item]))

export function scoreToKepribadianCode(score: unknown): KepribadianCode {
  const value = Number(score)
  if (Number.isNaN(value)) return 'B'
  if (value >= 90) return 'A'
  if (value >= 75) return 'B'
  if (value >= 60) return 'C'
  if (value >= 45) return 'D'
  return 'E'
}

export function codeToKepribadianScore(code: unknown): number {
  const normalized = String(code || '').trim().toUpperCase()
  return PREDIKAT_BY_CODE.get(normalized as KepribadianCode)?.score ?? 80
}

export function codeToKepribadianDescription(code: unknown): string {
  const normalized = String(code || '').trim().toUpperCase()
  return PREDIKAT_BY_CODE.get(normalized as KepribadianCode)?.description ?? 'Baik'
}

export function scoreToKepribadianDescription(score: unknown): string {
  return codeToKepribadianDescription(scoreToKepribadianCode(score))
}
