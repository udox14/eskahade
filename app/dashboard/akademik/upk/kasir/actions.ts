'use server'

import { query, execute, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getDaftarKitab() {
  const data = await query<any>(`
    SELECT k.id, k.nama_kitab, k.harga,
           m.id AS marhalah_id, m.nama AS marhalah_nama, m.urutan AS marhalah_urutan
    FROM kitab k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    ORDER BY k.nama_kitab
  `, [])

  const grouped: Record<string, any[]> = {}

  data.forEach((k: any) => {
    const mNama = k.marhalah_nama || 'Umum / Lainnya'
    const mUrut = k.marhalah_urutan || 999
    if (!grouped[mNama]) grouped[mNama] = []
    grouped[mNama].push({ id: k.id, nama: k.nama_kitab, harga: k.harga, urutan_marhalah: mUrut })
  })

  const orderedGrouped: Record<string, any[]> = {}
  Object.keys(grouped)
    .sort((a, b) => (grouped[a][0]?.urutan_marhalah || 999) - (grouped[b][0]?.urutan_marhalah || 999))
    .forEach(key => { orderedGrouped[key] = grouped[key] })

  return orderedGrouped
}

export async function cariSantri(keyword: string) {
  return query<any>(`
    SELECT id, nama_lengkap, nis, asrama, kamar
    FROM santri
    WHERE status_global = 'aktif' AND nama_lengkap LIKE ?
    LIMIT 5
  `, [`%${keyword}%`])
}

export async function simpanTransaksiUPK(payload: any) {
  const session = await getSession()
  const { santriId, namaPemesan, infoTambahan, totalTagihan, totalBayar, items } = payload

  const diff = totalBayar - totalTagihan
  const kembalian = diff > 0 ? diff : 0
  const tunggakan = diff < 0 ? Math.abs(diff) : 0
  const lunas = tunggakan === 0 ? 1 : 0

  const trxId = generateId()

  await execute(`
    INSERT INTO upk_transaksi (id, santri_id, nama_pemesan, info_tambahan, total_tagihan, total_bayar,
      sisa_kembalian, sisa_tunggakan, status_lunas, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [trxId, santriId, namaPemesan, infoTambahan, totalTagihan, totalBayar,
      kembalian, tunggakan, lunas, session?.id ?? null, now()])

  for (const item of items) {
    await execute(`
      INSERT INTO upk_item (id, transaksi_id, kitab_id, harga_saat_ini, is_gratis, status_serah)
      VALUES (?, ?, ?, ?, ?, 'BELUM')
    `, [generateId(), trxId, item.id, item.hargaAsli, item.isGratis ? 1 : 0])
  }

  revalidatePath('/dashboard/akademik/upk')
  return { success: true }
}