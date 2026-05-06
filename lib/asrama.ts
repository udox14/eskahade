export const ALL_ASRAMA_LIST = [
  'AL-FALAH',
  'AS-SALAM',
  'BAHAGIA',
  'ASY-SYIFA 1',
  'ASY-SYIFA 2',
  'ASY-SYIFA 3',
  'ASY-SYIFA 4',
  'AL-BAGHORY',
] as const

export const ASRAMA_TANPA_KAMAR = ['AL-BAGHORY'] as const

export const ROOM_REQUIRED_ASRAMA_LIST = ALL_ASRAMA_LIST.filter(
  (asrama) => !ASRAMA_TANPA_KAMAR.includes(asrama as (typeof ASRAMA_TANPA_KAMAR)[number])
)

export function isAsramaTanpaKamar(asrama: string | null | undefined) {
  return ASRAMA_TANPA_KAMAR.includes(
    (asrama || '').trim().toUpperCase() as (typeof ASRAMA_TANPA_KAMAR)[number]
  )
}
