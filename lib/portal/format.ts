// Format util kecil untuk portal ortu

export function formatRupiah(value: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(Math.max(0, Math.round(value || 0)))}`
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function formatTanggalId(value: string | null | undefined) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(value || '-')
  const bulan = BULAN_ID[Number(m[2]) - 1] || m[2]
  return `${Number(m[3])} ${bulan} ${m[1]}`
}

export function namaBulanId(bulan: number) {
  return BULAN_ID[bulan - 1] || `Bulan ${bulan}`
}
