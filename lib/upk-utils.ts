export function toInt(value: unknown) {
  const parsed = parseInt(String(value ?? '0'), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export function statusPembayaran(total: number, dibayar: number) {
  if (dibayar <= 0) return 'HUTANG'
  if (dibayar >= total) return 'LUNAS'
  return 'SEBAGIAN'
}

export function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

export function tanggalWaktu(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
