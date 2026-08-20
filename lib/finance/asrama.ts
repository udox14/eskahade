import { ALL_ASRAMA_LIST } from '@/lib/asrama'

/**
 * AL-BAGHORY dihuni warga lokal yang tidak tinggal di asrama, sehingga tidak
 * pernah menjadi objek keuangan terpusat: tidak ditagih layanan asrama, tidak
 * dilayani loket, dan tidak muncul di pencarian/daftar mana pun modul ini.
 */
export const FINANCE_EXCLUDED_ASRAMA = ['AL-BAGHORY'] as const

/** Daftar asrama yang boleh dipakai di seluruh modul keuangan terpusat. */
export const FINANCE_ASRAMA_LIST = ALL_ASRAMA_LIST.filter(
  asrama => !FINANCE_EXCLUDED_ASRAMA.includes(asrama as (typeof FINANCE_EXCLUDED_ASRAMA)[number])
)

export function isAsramaLuarKeuangan(asrama: string | null | undefined): boolean {
  return FINANCE_EXCLUDED_ASRAMA.includes(
    (asrama || '').trim().toUpperCase() as (typeof FINANCE_EXCLUDED_ASRAMA)[number]
  )
}

/**
 * Potongan SQL untuk menyingkirkan asrama yang dikecualikan. Santri tanpa
 * asrama tetap ikut — yang dibuang hanya yang jelas-jelas warga lokal.
 * Nilai dikeraskan di sini (bukan parameter bind) agar bisa disisipkan ke query
 * mana pun tanpa mengacaukan urutan parameter pemanggilnya.
 */
export function excludeAsramaSql(column = 'asrama'): string {
  const list = FINANCE_EXCLUDED_ASRAMA.map(value => `'${value}'`).join(',')
  return `(${column} IS NULL OR upper(trim(${column})) NOT IN (${list}))`
}

/** Sama seperti excludeAsramaSql, tapi sudah berawalan AND untuk ditempel di WHERE. */
export function andExcludeAsramaSql(column = 'asrama'): string {
  return `AND ${excludeAsramaSql(column)}`
}

/**
 * Scope gabungan untuk Unit Kas. Satu loket sering melayani seluruh asrama
 * putra atau seluruh asrama putri sekaligus, sehingga scope tidak selalu satu
 * nama asrama.
 */
export const CASH_UNIT_SCOPE_GROUPS = {
  SEMUA_PUTRA: { label: 'Semua asrama putra', members: ['AL-FALAH', 'BAHAGIA', 'AS-SALAM'] },
  SEMUA_PUTRI: { label: 'Semua asrama putri', members: ['ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4'] },
} as const

export type CashUnitScopeGroup = keyof typeof CASH_UNIT_SCOPE_GROUPS

/** Pilihan yang boleh muncul di dropdown scope Unit Kas. */
export const CASH_UNIT_SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Pusat / semua' },
  ...(Object.entries(CASH_UNIT_SCOPE_GROUPS) as [CashUnitScopeGroup, { label: string; members: readonly string[] }][])
    .map(([value, group]) => ({ value, label: `${group.label} (${group.members.join(', ')})` })),
  ...FINANCE_ASRAMA_LIST.map(value => ({ value, label: value })),
]

export function isCashUnitScopeValid(scope: string | null | undefined): boolean {
  const value = (scope || '').trim()
  if (!value) return true
  return CASH_UNIT_SCOPE_OPTIONS.some(option => option.value && option.value === value)
}

/** Daftar asrama yang dilayani sebuah scope; null berarti tanpa batasan asrama. */
export function resolveCashUnitScope(scope: string | null | undefined): string[] | null {
  const value = (scope || '').trim()
  if (!value) return null
  const group = CASH_UNIT_SCOPE_GROUPS[value as CashUnitScopeGroup]
  if (group) return [...group.members]
  return [value]
}

/** Label scope untuk ditampilkan di UI. */
export function cashUnitScopeLabel(scope: string | null | undefined): string {
  const value = (scope || '').trim()
  if (!value) return 'Pusat / semua asrama'
  const group = CASH_UNIT_SCOPE_GROUPS[value as CashUnitScopeGroup]
  return group ? group.label : value
}
