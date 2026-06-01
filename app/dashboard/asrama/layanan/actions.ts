'use server'

import { batch, execute, generateId, query } from '@/lib/db'
import { getSession, hasRole } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getKategoriSantriEfektifSql } from '@/lib/santri/kategori'
import { revalidatePath } from 'next/cache'

type LayananFilterArgs = {
  asrama: string
  kamar?: string
  belumDitempatkan?: boolean
  santriBaruOnly?: boolean
  search?: string
}

type MasterJasaRecord = {
  id: string
  nama_jasa: string
  jenis: 'Makan' | 'Cuci'
}

type SantriLayananRecord = {
  id: string
  nis: string
  nama_lengkap: string
  kamar: string | null
  tempat_makan_id: string | null
  tempat_mencuci_id: string | null
  kategori_santri: string
  kategori_efektif: string
}

type SebaranLayananRecord = {
  jasa_id: string | null
  nama_jasa: string
  total: number
}

type SantriSebaranDetailRecord = {
  id: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  kategori_santri: string
  kategori_efektif: string
}

function canManageMasterJasa(session: Awaited<ReturnType<typeof getSession>>) {
  return hasRole(session, 'admin') || hasRole(session, 'dewan_santri')
}

async function requireCanManageMasterJasa() {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  if (!canManageMasterJasa(session)) throw new Error('Forbidden')
  return session
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

  if (filters.santriBaruOnly) {
    where += ` AND ${getKategoriSantriEfektifSql(alias || 'santri')} = 'BARU'`
  }

  const search = filters.search?.trim()
  if (search) {
    where += ` AND (${prefix}nama_lengkap LIKE ? OR ${prefix}nis LIKE ?)`
    const keyword = `%${search}%`
    params.push(keyword, keyword)
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
  return query<MasterJasaRecord>('SELECT * FROM master_jasa ORDER BY nama_jasa', [])
}

export async function tambahMasterJasa(nama_jasa: string, jenis: string) {
  const session = await requireCanManageMasterJasa()

  const jasaId = generateId()
  await execute(
    'INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)',
    [jasaId, nama_jasa, jenis]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'asrama_layanan',
    action: 'create',
    fiturHref: '/dashboard/asrama/layanan',
    logKind: 'create',
    entityType: 'master_jasa',
    entityId: jasaId,
    entityLabel: nama_jasa,
    summary: `Menambahkan master jasa ${nama_jasa}`,
    details: {
      jenis,
    },
  })
  revalidatePath('/dashboard/asrama/layanan')
  return { success: true }
}

export async function updateMasterJasa(id: string, nama_jasa: string, _jenis: string) {
  const session = await requireCanManageMasterJasa()
  void _jenis
  const nama = nama_jasa.trim()
  if (!id || !nama) return { error: 'Data penyedia jasa tidak lengkap' }

  const before = await query<{ id: string; nama_jasa: string | null; jenis: string | null }>(
    'SELECT id, nama_jasa, jenis FROM master_jasa WHERE id = ?',
    [id]
  )
  const target = before[0]
  if (!target) return { error: 'Penyedia jasa tidak ditemukan' }

  await execute(
    'UPDATE master_jasa SET nama_jasa = ? WHERE id = ?',
    [nama, id]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'asrama_layanan',
    action: 'update',
    fiturHref: '/dashboard/asrama/layanan',
    logKind: 'update',
    entityType: 'master_jasa',
    entityId: id,
    entityLabel: nama,
    summary: `Memperbarui master jasa ${target.nama_jasa || id}`,
    details: {
      before: target,
      after: { nama_jasa: nama, jenis: target.jenis },
    },
  })
  revalidatePath('/dashboard/asrama/layanan')
  return { success: true }
}

export async function tambahMasterJasaBatch(dataBatch: { nama_jasa: string; jenis: string }[]) {
  const session = await requireCanManageMasterJasa()
  if (!dataBatch?.length) return { error: 'Data kosong' }

  await batch(
    dataBatch.map((item) => ({
      sql: 'INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)',
      params: [generateId(), item.nama_jasa, item.jenis],
    }))
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'asrama_layanan',
    action: 'create',
    fiturHref: '/dashboard/asrama/layanan',
    logKind: 'create',
    entityType: 'master_jasa_batch',
    entityId: 'batch',
    entityLabel: 'Tambah master jasa batch',
    summary: `Menambahkan ${dataBatch.length} master jasa secara batch`,
    details: {
      count: dataBatch.length,
    },
  })

  revalidatePath('/dashboard/asrama/layanan')
  return { success: true, count: dataBatch.length }
}

export async function hapusMasterJasa(id: string) {
  const session = await requireCanManageMasterJasa()

  const jasa = await query<{ id: string; nama_jasa: string | null; jenis: string | null }>(
    'SELECT id, nama_jasa, jenis FROM master_jasa WHERE id = ?',
    [id]
  )
  const target = jasa[0]
  await execute('DELETE FROM master_jasa WHERE id = ?', [id])
  if (target) {
    await logActivity({
      actor: actorFromSession(session),
      module: 'asrama_layanan',
      action: 'delete',
      fiturHref: '/dashboard/asrama/layanan',
      logKind: 'delete',
      entityType: 'master_jasa',
      entityId: target.id,
      entityLabel: target.nama_jasa || target.id,
      summary: `Menghapus master jasa ${target.nama_jasa || target.id}`,
      details: {
        jenis: target.jenis,
      },
    })
  }
  revalidatePath('/dashboard/asrama/layanan')
}

export async function getSantriLayanan({
  asrama,
  kamar,
  belumDitempatkan = false,
  santriBaruOnly = false,
  search = '',
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
    { asrama, kamar, belumDitempatkan, santriBaruOnly, search },
    targetAsrama
  )
  const kategoriEfektifSql = getKategoriSantriEfektifSql('santri')

  const countResult = await query<{ total: number }>(
    `
      SELECT COUNT(*) AS total
      FROM santri
      ${where}
    `,
    params
  )
  const count = countResult[0]?.total ?? 0

  const data = await query<SantriLayananRecord>(
    `
      SELECT id, nis, nama_lengkap, kamar, tempat_makan_id, tempat_mencuci_id,
             COALESCE(NULLIF(kategori_santri, ''), 'REGULER') AS kategori_santri,
             ${kategoriEfektifSql} AS kategori_efektif
      FROM santri
      ${where}
      ORDER BY nama_lengkap COLLATE NOCASE ASC, kamar COLLATE NOCASE ASC
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
  santriBaruOnly = false,
  search = '',
}: LayananFilterArgs) {
  const restrictedAsrama = await getRestrictedAsrama()
  const targetAsrama = restrictedAsrama ?? asrama
  const { where, params } = buildSantriFilterSql(
    { asrama, kamar, belumDitempatkan, santriBaruOnly, search },
    targetAsrama,
    's'
  )

  const makan = await query<SebaranLayananRecord>(
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

  const cuci = await query<SebaranLayananRecord>(
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
  santriBaruOnly = false,
  search = '',
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
    { asrama, kamar, belumDitempatkan, santriBaruOnly, search },
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

  const data = await query<SantriSebaranDetailRecord>(
    `
      SELECT id, nis, nama_lengkap, asrama, kamar,
             COALESCE(NULLIF(kategori_santri, ''), 'REGULER') AS kategori_santri,
             ${getKategoriSantriEfektifSql('santri')} AS kategori_efektif
      FROM santri
      ${detailWhere}
      ORDER BY nama_lengkap COLLATE NOCASE ASC, kamar COLLATE NOCASE ASC
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

export async function simpanLayananSantri(
  santriId: string,
  field: 'tempat_makan_id' | 'tempat_mencuci_id',
  value: string | null
) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  if (field !== 'tempat_makan_id' && field !== 'tempat_mencuci_id') {
    return { error: 'Kolom layanan tidak valid' }
  }

  const santri = await query<{ id: string; nama_lengkap: string | null; asrama: string | null }>(
    'SELECT id, nama_lengkap, asrama FROM santri WHERE id = ? AND status_global = ?',
    [santriId, 'aktif']
  )
  const target = santri[0]
  if (!target) return { error: 'Santri tidak ditemukan' }
  if (hasRole(session, 'pengurus_asrama') && session.asrama_binaan !== target.asrama) {
    return { error: 'Tidak boleh mengubah santri di luar asrama binaan' }
  }

  if (value) {
    const expectedJenis = field === 'tempat_makan_id' ? 'Makan' : 'Cuci'
    const jasa = await query<{ id: string }>(
      'SELECT id FROM master_jasa WHERE id = ? AND jenis = ?',
      [value, expectedJenis]
    )
    if (!jasa[0]) return { error: 'Penyedia jasa tidak valid' }
  }

  await execute(`UPDATE santri SET ${field} = ? WHERE id = ?`, [value, santriId])
  await logActivity({
    actor: actorFromSession(session),
    module: 'asrama_layanan',
    action: 'update',
    fiturHref: '/dashboard/asrama/layanan',
    logKind: 'update',
    entityType: 'santri_layanan',
    entityId: santriId,
    entityLabel: target.nama_lengkap || santriId,
    summary: `Memperbarui ${field === 'tempat_makan_id' ? 'tempat makan' : 'tempat cuci'} ${target.nama_lengkap || santriId}`,
    details: {
      field,
      value,
    },
  })

  revalidatePath('/dashboard/asrama/layanan')
  return { success: true }
}
