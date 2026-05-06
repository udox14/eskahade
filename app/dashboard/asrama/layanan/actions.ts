'use server'

import { batch, execute, generateId, query } from '@/lib/db'
import { getSession, hasRole } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

type LayananFilterArgs = {
  asrama: string
  kamar?: string
  belumDitempatkan?: boolean
}

// Helper: ambil asrama restriction untuk pengurus_asrama
async function getRestrictedAsrama(): Promise<string | null> {
  const session = await getSession()
  if (!session) return null
  if (hasRole(session, 'pengurus_asrama')) return session.asrama_binaan ?? null
  return null
}

function buildSantriFilterSql(
  filters: LayananFilterArgs,
  targetAsrama: string,
  alias = ''
) {
  const prefix = alias ? `${alias}.` : ''
  let where = `WHERE ${prefix}asrama = ? AND ${prefix}status_global = 'aktif'`
  const params: unknown[] = [targetAsrama]

  if (filters.kamar) {
    where += ` AND ${prefix}kamar = ?`
    params.push(filters.kamar)
  }

  if (filters.belumDitempatkan) {
    where += ` AND (${prefix}tempat_makan_id IS NULL OR ${prefix}tempat_mencuci_id IS NULL)`
  }

  return { where, params }
}

export async function getClientRestriction() {
  const session = await getSession()
  if (!session) return null
  if (hasRole(session, 'pengurus_asrama')) return session.asrama_binaan ?? null
  return null
}

export async function getDaftarAsrama() {
  const restrictedAsrama = await getRestrictedAsrama()
  if (restrictedAsrama) return [restrictedAsrama]

  const data = await query<{ asrama: string }>(
    'SELECT DISTINCT asrama FROM santri WHERE asrama IS NOT NULL ORDER BY asrama',
    []
  )
  return data.map((item) => item.asrama)
}

export async function getDaftarKamar(asrama: string) {
  const restrictedAsrama = await getRestrictedAsrama()
  const targetAsrama = restrictedAsrama ?? asrama

  const data = await query<{ kamar: string }>(
    'SELECT DISTINCT kamar FROM santri WHERE asrama = ? AND kamar IS NOT NULL',
    [targetAsrama]
  )
  return data
    .map((item) => item.kamar)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
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
  if (!dataBatch?.length) return { error: 'Data kosong' }

  await batch(
    dataBatch.map((item) => ({
      sql: 'INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)',
      params: [generateId(), item.nama_jasa, item.jenis],
    }))
  )

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
  belumDitempatkan = false,
  page = 1,
  limit = 20,
}: LayananFilterArgs & {
  page?: number
  limit?: number
}) {
  const restrictedAsrama = await getRestrictedAsrama()
  const targetAsrama = restrictedAsrama ?? asrama
  const safePage = Math.max(1, page)
  const safeLimit = Math.max(1, limit)
  const { where, params } = buildSantriFilterSql(
    { asrama, kamar, belumDitempatkan },
    targetAsrama
  )

  const countResult = await query<{ total: number }>(
    `
      SELECT COUNT(*) AS total
      FROM santri
      ${where}
    `,
    params
  )
  const count = countResult[0]?.total ?? 0

  const data = await query<any>(
    `
      SELECT id, nis, nama_lengkap, kamar, tempat_makan_id, tempat_mencuci_id
      FROM santri
      ${where}
      ORDER BY kamar, nama_lengkap
      LIMIT ? OFFSET ?
    `,
    [...params, safeLimit, (safePage - 1) * safeLimit]
  )

  return {
    data,
    count,
    page: safePage,
    totalPages: Math.max(1, Math.ceil(count / safeLimit)),
  }
}

export async function getSebaranLayanan({
  asrama,
  kamar,
  belumDitempatkan = false,
}: LayananFilterArgs) {
  const restrictedAsrama = await getRestrictedAsrama()
  const targetAsrama = restrictedAsrama ?? asrama
  const { where, params } = buildSantriFilterSql(
    { asrama, kamar, belumDitempatkan },
    targetAsrama,
    's'
  )

  const makan = await query<any>(
    `
      SELECT
        s.tempat_makan_id AS jasa_id,
        CASE
          WHEN s.tempat_makan_id IS NULL THEN 'Belum diatur'
          WHEN m.id IS NULL THEN 'Penyedia terhapus'
          ELSE m.nama_jasa
        END AS nama_jasa,
        COUNT(*) AS total
      FROM santri s
      LEFT JOIN master_jasa m ON m.id = s.tempat_makan_id
      ${where}
      GROUP BY
        s.tempat_makan_id,
        CASE
          WHEN s.tempat_makan_id IS NULL THEN 'Belum diatur'
          WHEN m.id IS NULL THEN 'Penyedia terhapus'
          ELSE m.nama_jasa
        END
      ORDER BY total DESC, nama_jasa ASC
    `,
    params
  )

  const cuci = await query<any>(
    `
      SELECT
        s.tempat_mencuci_id AS jasa_id,
        CASE
          WHEN s.tempat_mencuci_id IS NULL THEN 'Belum diatur'
          WHEN m.id IS NULL THEN 'Penyedia terhapus'
          ELSE m.nama_jasa
        END AS nama_jasa,
        COUNT(*) AS total
      FROM santri s
      LEFT JOIN master_jasa m ON m.id = s.tempat_mencuci_id
      ${where}
      GROUP BY
        s.tempat_mencuci_id,
        CASE
          WHEN s.tempat_mencuci_id IS NULL THEN 'Belum diatur'
          WHEN m.id IS NULL THEN 'Penyedia terhapus'
          ELSE m.nama_jasa
        END
      ORDER BY total DESC, nama_jasa ASC
    `,
    params
  )

  return { makan, cuci }
}

export async function getSantriSebaranDetail({
  asrama,
  kamar,
  belumDitempatkan = false,
  jenis,
  jasaId,
  page = 1,
  limit = 20,
}: LayananFilterArgs & {
  jenis: 'Makan' | 'Cuci'
  jasaId: string | null
  page?: number
  limit?: number
}) {
  const restrictedAsrama = await getRestrictedAsrama()
  const targetAsrama = restrictedAsrama ?? asrama
  const safePage = Math.max(1, page)
  const safeLimit = Math.max(1, limit)
  const { where, params } = buildSantriFilterSql(
    { asrama, kamar, belumDitempatkan },
    targetAsrama
  )
  const column = jenis === 'Makan' ? 'tempat_makan_id' : 'tempat_mencuci_id'

  let detailWhere = where
  const detailParams = [...params]

  if (jasaId) {
    detailWhere += ` AND ${column} = ?`
    detailParams.push(jasaId)
  } else {
    detailWhere += ` AND ${column} IS NULL`
  }

  const countResult = await query<{ total: number }>(
    `
      SELECT COUNT(*) AS total
      FROM santri
      ${detailWhere}
    `,
    detailParams
  )
  const count = countResult[0]?.total ?? 0

  const data = await query<any>(
    `
      SELECT id, nis, nama_lengkap, asrama, kamar
      FROM santri
      ${detailWhere}
      ORDER BY kamar, nama_lengkap
      LIMIT ? OFFSET ?
    `,
    [...detailParams, safeLimit, (safePage - 1) * safeLimit]
  )

  return {
    data,
    count,
    page: safePage,
    totalPages: Math.max(1, Math.ceil(count / safeLimit)),
  }
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
    const params: unknown[] = []

    if ('tempat_makan_id' in data) {
      sets.push('tempat_makan_id = ?')
      params.push(data.tempat_makan_id)
    }
    if ('tempat_mencuci_id' in data) {
      sets.push('tempat_mencuci_id = ?')
      params.push(data.tempat_mencuci_id)
    }

    if (sets.length) {
      params.push(id)
      await execute(`UPDATE santri SET ${sets.join(', ')} WHERE id = ?`, params)
    }
  }

  revalidatePath('/dashboard/asrama/layanan')
  return { success: true, count: entries.length }
}
