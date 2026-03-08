'use server'

import { query, execute, generateId } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getDaftarAsrama() {
  const data = await query<any>(
    `SELECT DISTINCT asrama FROM santri WHERE asrama IS NOT NULL ORDER BY asrama`, []
  )
  return data.map((d: any) => d.asrama)
}

export async function getDaftarKamar(asrama: string) {
  const data = await query<any>(
    `SELECT DISTINCT kamar FROM santri WHERE asrama = ? AND kamar IS NOT NULL ORDER BY kamar`,
    [asrama]
  )
  return data.map((d: any) => d.kamar)
}

export async function getMasterJasa() {
  return query<any>('SELECT * FROM master_jasa ORDER BY nama_jasa', [])
}

export async function tambahMasterJasa(nama_jasa: string, jenis: string) {
  await execute(
    'INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)',
    [generateId(), nama_jasa, jenis]
  )
  revalidatePath('/dashboard/asrama/layanan')
  return { success: true }
}

export async function tambahMasterJasaBatch(dataBatch: { nama_jasa: string; jenis: string }[]) {
  if (!dataBatch || !dataBatch.length) return { error: 'Data kosong' }

  for (const item of dataBatch) {
    await execute(
      'INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)',
      [generateId(), item.nama_jasa, item.jenis]
    )
  }

  revalidatePath('/dashboard/asrama/layanan')
  return { success: true, count: dataBatch.length }
}

export async function hapusMasterJasa(id: string) {
  await execute('DELETE FROM master_jasa WHERE id = ?', [id])
  revalidatePath('/dashboard/asrama/layanan')
}

export async function getSantriLayanan({
  asrama,
  kamar,
  belumDitempatkan,
  page = 0,
  limit = 20,
}: {
  asrama: string
  kamar?: string
  belumDitempatkan: boolean
  page: number
  limit: number
}) {
  let sql = `
    SELECT id, nis, nama_lengkap, kamar, tempat_makan_id, tempat_mencuci_id
    FROM santri
    WHERE asrama = ?
  `
  const params: any[] = [asrama]

  if (kamar) { sql += ' AND kamar = ?'; params.push(kamar) }
  if (belumDitempatkan) { sql += ' AND (tempat_makan_id IS NULL OR tempat_mencuci_id IS NULL)' }

  sql += ' ORDER BY kamar, nama_lengkap'

  // count total
  const countSql = sql.replace(
    'SELECT id, nis, nama_lengkap, kamar, tempat_makan_id, tempat_mencuci_id',
    'SELECT COUNT(*) AS total'
  )
  const countResult = await query<any>(countSql, params)
  const count = countResult[0]?.total ?? 0

  sql += ' LIMIT ? OFFSET ?'
  params.push(limit, page * limit)

  const data = await query<any>(sql, params)
  return { data, count }
}

export async function simpanBatchLayanan(
  changes: Record<string, { tempat_makan_id?: string | null; tempat_mencuci_id?: string | null }>
) {
  const entries = Object.entries(changes)
  if (!entries.length) return { success: true }

  for (const [id, data] of entries) {
    const sets: string[] = []
    const params: any[] = []

    if ('tempat_makan_id' in data) { sets.push('tempat_makan_id = ?'); params.push(data.tempat_makan_id) }
    if ('tempat_mencuci_id' in data) { sets.push('tempat_mencuci_id = ?'); params.push(data.tempat_mencuci_id) }

    if (sets.length) {
      params.push(id)
      await execute(`UPDATE santri SET ${sets.join(', ')} WHERE id = ?`, params)
    }
  }

  revalidatePath('/dashboard/asrama/layanan')
  return { success: true, count: entries.length }
}