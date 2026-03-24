'use server'

import { query, execute, generateId, batch } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// Helper: ambil asrama restriction untuk pengurus_asrama
async function getRestrictedAsrama(): Promise<string | null> {
  const session = await getSession()
  if (!session) return null
  if (session.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null // admin & role lain → tidak dibatasi
}

export async function getClientRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

export async function getDaftarAsrama() {
  const restrictedAsrama = await getRestrictedAsrama()
  // Kalau pengurus_asrama → hanya return asrama binaannya saja
  if (restrictedAsrama) return [restrictedAsrama]

  const data = await query<any>(
    `SELECT DISTINCT asrama FROM santri WHERE asrama IS NOT NULL ORDER BY asrama`, []
  )
  return data.map((d: any) => d.asrama)
}

export async function getDaftarKamar(asrama: string) {
  const restrictedAsrama = await getRestrictedAsrama()
  // Kalau pengurus_asrama → paksa pakai asrama binaannya, abaikan parameter
  const targetAsrama = restrictedAsrama ?? asrama

  const data = await query<any>(
    `SELECT DISTINCT kamar FROM santri WHERE asrama = ? AND kamar IS NOT NULL ORDER BY kamar`,
    [targetAsrama]
  )
  return data.map((d: any) => d.kamar)
}

export async function getMasterJasa() {
  return query<any>('SELECT * FROM master_jasa ORDER BY nama_jasa', [])
}

export async function tambahMasterJasa(nama_jasa: string, jenis: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  await execute(
    'INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)',
    [generateId(), nama_jasa, jenis]
  )
  revalidatePath('/dashboard/asrama/layanan')
  return { success: true }
}

export async function tambahMasterJasaBatch(dataBatch: { nama_jasa: string; jenis: string }[]) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  if (!dataBatch || !dataBatch.length) return { error: 'Data kosong' }

  await batch(dataBatch.map(item => ({
    sql: 'INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)',
    params: [generateId(), item.nama_jasa, item.jenis],
  })))

  revalidatePath('/dashboard/asrama/layanan')
  return { success: true, count: dataBatch.length }
}

export async function hapusMasterJasa(id: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

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
  const restrictedAsrama = await getRestrictedAsrama()
  // Kalau pengurus_asrama → paksa asrama binaannya, tidak bisa query asrama lain
  const targetAsrama = restrictedAsrama ?? asrama

  let sql = `
    SELECT id, nis, nama_lengkap, kamar, tempat_makan_id, tempat_mencuci_id
    FROM santri
    WHERE asrama = ? AND status_global = 'aktif'
  `
  const params: any[] = [targetAsrama]

  if (kamar) { sql += ' AND kamar = ?'; params.push(kamar) }
  if (belumDitempatkan) { sql += ' AND (tempat_makan_id IS NULL OR tempat_mencuci_id IS NULL)' }

  sql += ' ORDER BY kamar, nama_lengkap'

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
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

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
