/** Internal accounting amounts are exact, safe integer Rupiah. Never round user input. */
export function rupiah(value: number, label = 'Nominal', allowZero = false): number {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(`${label} harus berupa integer Rupiah ${allowZero ? 'non-negatif' : 'positif'} yang aman.`)
  }
  return value
}

export function sumRupiah(values: number[]): number {
  return rupiah(values.reduce((sum, value) => sum + rupiah(value, 'Nominal', true), 0), 'Total', true)
}
