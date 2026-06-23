export type UnitUPK = 'PUTRA' | 'PUTRI'

export type SantriOption = {
  id: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  kelas_id: string | null
  nama_kelas: string | null
  marhalah_id: number | null
  marhalah_nama: string | null
}

export type KatalogItem = {
  id: number
  nama_kitab: string
  marhalah_id: number | null
  marhalah_nama: string | null
  harga_beli: number
  harga_jual: number
  jumlah_stok: number
  is_default: boolean
  is_marhalah: boolean
}

export type GuruOption = {
  id: number
  nama_lengkap: string
  gelar: string | null
  kode_guru: string | null
}

export type CartItem = KatalogItem & {
  qty: number
  selected: boolean
}

export type Antrian = {
  id: string
  nomor: number
  nama_santri: string
  nis: string | null
  kelas_nama: string | null
  marhalah_nama: string | null
  total_tagihan: number
  total_item?: number
}

export type AntrianDetail = Antrian & {
  items: Array<{
    id: string
    katalog_id: number | null
    nama_kitab: string
    qty: number
    harga_jual: number
    subtotal: number
    status_serah: string
    masuk_pesanan: number
    jumlah_stok: number
  }>
}

export type FinalItem = {
  itemId: string
  qty: number
  diserahkan: boolean
}

export function rupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

export function nomorAntrian(value: number) {
  return String(value || 0).padStart(3, '0')
}
