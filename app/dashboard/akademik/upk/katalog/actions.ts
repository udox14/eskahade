'use server'

import { execute, query, queryOne, now } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getCachedMarhalahList, getCachedTahunAjaranAktif } from '@/lib/cache/master'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'

export { getCachedMarhalahList as getMarhalahList }

const KATALOG_PATH = '/dashboard/akademik/upk/katalog'

type KatalogRow = {
  id: number
  kitab_id: number | null
  nama_kitab: string
  toko_id: number | null
  stok_lama: number
  stok_baru: number
  harga_beli: number
  harga_jual: number
  is_active: number
  catatan: string | null
  stok_updated_at: string | null
  updated_at: string | null
  created_at: string
  toko_nama: string | null
  master_nama_kitab: string | null
  is_consignment: number
}

type KatalogMarhalahRow = {
  katalog_id: number
  marhalah_id: number
  is_default: number
  nama: string | null
  urutan: number | null
}

type TokoRow = {
  id: number
  nama: string
  is_active: number
  created_at: string
  updated_at: string | null
}

type MasterKitabOption = {
  id: number
  nama_kitab: string
  marhalah_id: number | null
  marhalah_nama: string | null
  marhalah_urutan: number | null
}

type KatalogStockSnapshot = {
  stok_lama: number
  stok_updated_at: string | null
}

type ImportRow = Record<string, unknown>

type MarhalahRow = {
  id: number
  nama: string
}

async function hasColumn(table: 'upk_katalog' | 'upk_belanja_item', column: string) {
  const columns = await query<{ name: string }>(`PRAGMA table_info(${table})`)
  return columns.some((row) => row.name === column)
}

function toImportInt(value: unknown) {
  const cleaned = String(value ?? '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .trim()
  const parsed = parseInt(cleaned, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function keyText(value: unknown) {
  return cleanText(value).toLowerCase()
}

function pick(row: ImportRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key]
  }
  return ''
}

function toNullableInt(value: FormDataEntryValue | null) {
  const parsed = parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function getKatalogUPK(search = '', filterMarhalah = '', filterStatus = 'SEMUA') {
  const hasConsignment = await hasColumn('upk_katalog', 'is_consignment')
  let sql = `
    SELECT uk.id, uk.kitab_id, uk.nama_kitab, uk.toko_id,
           uk.stok_lama, uk.stok_baru, uk.harga_beli, uk.harga_jual,
           uk.is_active, uk.catatan, uk.stok_updated_at, uk.updated_at, uk.created_at,
           ${hasConsignment ? 'uk.is_consignment' : '0 AS is_consignment'},
           t.nama AS toko_nama,
           k.nama_kitab AS master_nama_kitab
    FROM upk_katalog uk
    LEFT JOIN upk_toko t ON t.id = uk.toko_id
    LEFT JOIN kitab k ON k.id = uk.kitab_id
  `
  const conditions: string[] = []
  const params: unknown[] = []

  if (search.trim()) {
    conditions.push('(uk.nama_kitab LIKE ? OR t.nama LIKE ? OR uk.catatan LIKE ?)')
    const like = `%${search.trim()}%`
    params.push(like, like, like)
  }
  if (filterMarhalah) {
    conditions.push('EXISTS (SELECT 1 FROM upk_katalog_marhalah km WHERE km.katalog_id = uk.id AND km.marhalah_id = ?)')
    params.push(filterMarhalah)
  }
  if (filterStatus === 'AKTIF') conditions.push('uk.is_active = 1')
  if (filterStatus === 'NONAKTIF') conditions.push('uk.is_active = 0')

  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`
  sql += ' ORDER BY uk.is_active DESC, uk.nama_kitab'

  const rows = await query<KatalogRow>(sql, params)
  if (!rows.length) return []

  const ids = rows.map((row) => row.id)
  const marhalahRows = await query<KatalogMarhalahRow>(
    `SELECT km.katalog_id, km.marhalah_id, km.is_default, m.nama, m.urutan
     FROM upk_katalog_marhalah km
     LEFT JOIN marhalah m ON m.id = km.marhalah_id
     WHERE km.katalog_id IN (${ids.map(() => '?').join(',')})
     ORDER BY m.urutan`,
    ids
  )
  const marhalahByKatalog = new Map<number, { marhalah_id: number; nama: string | null; is_default: boolean }[]>()
  for (const mr of marhalahRows) {
    const list = marhalahByKatalog.get(mr.katalog_id) ?? []
    list.push({ marhalah_id: mr.marhalah_id, nama: mr.nama, is_default: !!mr.is_default })
    marhalahByKatalog.set(mr.katalog_id, list)
  }

  return rows.map((row) => {
    const jumlahStok = (row.stok_lama || 0) + (row.stok_baru || 0)
    const modal = jumlahStok * (row.harga_beli || 0)
    const labaKotor = jumlahStok * (row.harga_jual || 0)
    return {
      ...row,
      is_active: !!row.is_active,
      is_consignment: !!row.is_consignment,
      marhalah: marhalahByKatalog.get(row.id) ?? [],
      jumlah_stok: jumlahStok,
      modal,
      laba_kotor: labaKotor,
      laba_bersih: labaKotor - modal,
    }
  })
}

export async function getTokoList(includeInactive = false) {
  const rows = await query<TokoRow>(
    `SELECT id, nama, is_active, created_at, updated_at
     FROM upk_toko
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY is_active DESC, nama`,
    []
  )
  return rows.map((row) => ({ ...row, is_active: !!row.is_active }))
}

export async function getMasterKitabOptions() {
  const aktif = await getCachedTahunAjaranAktif()
  const params: unknown[] = []
  let where = ''
  if (aktif?.id) {
    where = 'WHERE k.tahun_ajaran_id = ?'
    params.push(aktif.id)
  }

  return query<MasterKitabOption>(`
    SELECT k.id, k.nama_kitab, k.marhalah_id,
           m.nama AS marhalah_nama, m.urutan AS marhalah_urutan
    FROM kitab k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    ${where}
    ORDER BY m.urutan, k.nama_kitab
  `, params)
}

export async function simpanKatalog(payload: {
  id?: number | null
  kitab_id?: number | null
  nama_kitab: string
  toko_id?: number | null
  stok_lama: number
  harga_beli: number
  harga_jual: number
  is_active: boolean
  catatan: string
  marhalah: { marhalah_id: number; is_default: boolean }[]
  is_consignment?: boolean
}): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  const id = payload.id && payload.id > 0 ? payload.id : null
  const kitabId = payload.kitab_id && payload.kitab_id > 0 ? payload.kitab_id : null
  const namaKitab = payload.nama_kitab.trim()
  const tokoId = payload.toko_id && payload.toko_id > 0 ? payload.toko_id : null
  const stokLama = Number(payload.stok_lama) || 0
  const hargaBeli = Number(payload.harga_beli) || 0
  const hargaJual = Number(payload.harga_jual) || 0
  const isActive = payload.is_active ? 1 : 0
  const isConsignment = payload.is_consignment ? 1 : 0
  const catatan = payload.catatan.trim()
  const hasConsignment = await hasColumn('upk_katalog', 'is_consignment')

  // dedupe marhalah, max 1 default per item tetap diizinkan banyak default
  const marhalahMap = new Map<number, boolean>()
  for (const m of payload.marhalah) {
    if (m.marhalah_id > 0) marhalahMap.set(m.marhalah_id, m.is_default || marhalahMap.get(m.marhalah_id) || false)
  }
  const marhalahList = Array.from(marhalahMap.entries()).map(([marhalah_id, is_default]) => ({ marhalah_id, is_default }))

  if (!namaKitab) return { error: 'Nama kitab wajib diisi.' }
  if (!marhalahList.length) return { error: 'Pilih minimal satu marhalah.' }
  if (stokLama < 0) return { error: 'Stok tidak boleh minus.' }
  if (hargaBeli < 0 || hargaJual < 0) return { error: 'Harga tidak boleh minus.' }

  const timestamp = now()
  let katalogId = id

  if (id) {
    const currentStock = await queryOne<KatalogStockSnapshot>(
      'SELECT stok_lama, stok_updated_at FROM upk_katalog WHERE id = ?',
      [id]
    )
    const stockChanged = !currentStock || currentStock.stok_lama !== stokLama
    const stockUpdatedAt = stockChanged ? timestamp : currentStock.stok_updated_at

    const consignmentSet = hasConsignment ? ', is_consignment = ?' : ''
    const params = [
      kitabId, namaKitab, tokoId, stokLama, hargaBeli, hargaJual,
      isActive, catatan || null,
    ]
    if (hasConsignment) params.push(isConsignment)
    params.push(stockUpdatedAt, timestamp, id)

    await execute(`
      UPDATE upk_katalog
      SET kitab_id = ?, nama_kitab = ?, toko_id = ?,
          stok_lama = ?, harga_beli = ?, harga_jual = ?,
          is_active = ?, catatan = ?${consignmentSet}, stok_updated_at = ?, updated_at = ?
      WHERE id = ?
    `, params)
  } else {
    const consignmentColumn = hasConsignment ? ', is_consignment' : ''
    const consignmentPlaceholder = hasConsignment ? ', ?' : ''
    const params = [
      kitabId, namaKitab, tokoId, stokLama, 0, hargaBeli, hargaJual,
      isActive, catatan || null,
    ]
    if (hasConsignment) params.push(isConsignment)
    params.push(timestamp, timestamp, timestamp)

    await execute(`
      INSERT INTO upk_katalog
        (kitab_id, nama_kitab, toko_id, stok_lama, stok_baru,
         harga_beli, harga_jual, is_active, catatan${consignmentColumn}, stok_updated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?${consignmentPlaceholder}, ?, ?, ?)
    `, params)
    const created = await queryOne<{ id: number }>('SELECT id FROM upk_katalog ORDER BY id DESC LIMIT 1')
    katalogId = created?.id ?? null
  }

  if (!katalogId) return { error: 'Gagal menyimpan katalog.' }

  await execute('DELETE FROM upk_katalog_marhalah WHERE katalog_id = ?', [katalogId])
  for (const m of marhalahList) {
    await execute(
      'INSERT INTO upk_katalog_marhalah (katalog_id, marhalah_id, is_default) VALUES (?, ?, ?)',
      [katalogId, m.marhalah_id, m.is_default ? 1 : 0]
    )
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_katalog',
    action: id ? 'update' : 'create',
    fiturHref: '/dashboard/akademik/upk/katalog',
    logKind: id ? 'update' : 'create',
    entityType: 'upk_katalog',
    entityId: String(katalogId),
    entityLabel: namaKitab,
    summary: `${id ? 'Memperbarui' : 'Menambahkan'} katalog UPK ${namaKitab}`,
    details: {
      marhalah: marhalahList,
      toko_id: tokoId,
      stok_lama: stokLama,
      harga_beli: hargaBeli,
      harga_jual: hargaJual,
      is_active: isActive === 1,
    },
  })

  revalidatePath(KATALOG_PATH)
  return { success: true }
}

type BatchKatalogItem = {
  kitab_id: number
  nama_kitab: string
  marhalah_id: number
  toko_id: number | null
  stok_lama: number
  harga_beli: number
  harga_jual: number
  catatan: string
}

export async function simpanKatalogBatchUPK(
  items: BatchKatalogItem[]
): Promise<{ success: boolean; inserted: number; skipped: number } | { error: string }> {
  const session = await getSession()
  if (!items.length) return { error: 'Belum ada kitab yang dipilih.' }

  const kitabIds = items.map((item) => item.kitab_id).filter(Boolean)
  if (!kitabIds.length) return { error: 'Kitab tidak valid.' }

  const existingRows = await query<{ kitab_id: number | null }>(
    `SELECT kitab_id FROM upk_katalog WHERE kitab_id IN (${kitabIds.map(() => '?').join(',')})`,
    kitabIds
  )
  const existingSet = new Set(existingRows.map((row) => row.kitab_id))

  const timestamp = now()
  let inserted = 0
  let skipped = 0

  for (const item of items) {
    if (!item.kitab_id || !item.nama_kitab.trim() || !item.marhalah_id) {
      skipped++
      continue
    }
    if (existingSet.has(item.kitab_id)) {
      skipped++
      continue
    }
    if (item.stok_lama < 0 || item.harga_beli < 0 || item.harga_jual < 0) {
      skipped++
      continue
    }

    await execute(`
      INSERT INTO upk_katalog
        (kitab_id, nama_kitab, toko_id, stok_lama, stok_baru,
         harga_beli, harga_jual, is_active, catatan, stok_updated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `, [item.kitab_id, item.nama_kitab.trim(), item.toko_id,
        item.stok_lama, 0, item.harga_beli, item.harga_jual,
        item.catatan.trim() || null, timestamp, timestamp, timestamp])
    const created = await queryOne<{ id: number }>('SELECT id FROM upk_katalog ORDER BY id DESC LIMIT 1')
    if (created?.id) {
      await execute(
        'INSERT INTO upk_katalog_marhalah (katalog_id, marhalah_id, is_default) VALUES (?, ?, 1)',
        [created.id, item.marhalah_id]
      )
    }
    existingSet.add(item.kitab_id)
    inserted++
  }

  if (inserted === 0) return { error: 'Tidak ada kitab baru yang ditambahkan (mungkin sudah ada di katalog).' }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_katalog',
    action: 'create',
    fiturHref: '/dashboard/akademik/upk/katalog',
    logKind: 'create',
    entityType: 'upk_katalog_batch',
    entityId: 'batch-katalog',
    entityLabel: 'Tambah katalog batch',
    summary: `Menambahkan ${inserted} kitab ke katalog UPK`,
    details: { inserted, skipped, total: items.length },
  })

  revalidatePath(KATALOG_PATH)
  return { success: true, inserted, skipped }
}

export async function hapusKatalogUPK(id: number): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  const target = await queryOne<{ id: number; nama_kitab: string }>(
    'SELECT id, nama_kitab FROM upk_katalog WHERE id = ?',
    [id]
  )
  await execute('DELETE FROM upk_katalog_marhalah WHERE katalog_id = ?', [id])
  await execute('DELETE FROM upk_katalog WHERE id = ?', [id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_katalog',
    action: 'delete',
    fiturHref: '/dashboard/akademik/upk/katalog',
    logKind: 'delete',
    entityType: 'upk_katalog',
    entityId: String(id),
    entityLabel: target?.nama_kitab ?? `Katalog ${id}`,
    summary: `Menghapus katalog UPK ${target?.nama_kitab ?? id}`,
  })
  revalidatePath(KATALOG_PATH)
  return { success: true }
}

export async function importKatalogUPK(rows: ImportRow[]): Promise<{ success: boolean; inserted: number; updated: number; failed: number; errors: string[] } | { error: string }> {
  const session = await getSession()
  if (!rows.length) return { error: 'File Excel belum berisi data.' }

  const [marhalahRows, tokoRows, masterRows, katalogRows, linkRows] = await Promise.all([
    query<MarhalahRow>('SELECT id, nama FROM marhalah', []),
    query<TokoRow>('SELECT id, nama, is_active, created_at, updated_at FROM upk_toko', []),
    getMasterKitabOptions(),
    query<{ id: number; kitab_id: number | null; nama_kitab: string }>(
      'SELECT id, kitab_id, nama_kitab FROM upk_katalog',
      []
    ),
    query<{ katalog_id: number; marhalah_id: number }>(
      'SELECT katalog_id, marhalah_id FROM upk_katalog_marhalah',
      []
    ),
  ])

  const marhalahByName = new Map(marhalahRows.map(m => [keyText(m.nama), m]))
  const tokoByName = new Map(tokoRows.map(t => [keyText(t.nama), t]))
  const masterByNameAndMarhalah = new Map(masterRows.map(k => [`${keyText(k.nama_kitab)}|||${k.marhalah_id}`, k]))
  const katalogByName = new Map(katalogRows.map(k => [keyText(k.nama_kitab), k]))
  const linkSet = new Set(linkRows.map(l => `${l.katalog_id}|||${l.marhalah_id}`))

  let inserted = 0
  let updated = 0
  let failed = 0
  const errors: string[] = []
  const timestamp = now()

  const ensureLink = async (katalogId: number, marhalahId: number) => {
    const key = `${katalogId}|||${marhalahId}`
    if (linkSet.has(key)) return false
    await execute(
      'INSERT INTO upk_katalog_marhalah (katalog_id, marhalah_id, is_default) VALUES (?, ?, 1)',
      [katalogId, marhalahId]
    )
    linkSet.add(key)
    return true
  }

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    const rowNumber = index + 2
    const namaKitab = cleanText(pick(row, ['NAMA KITAB', 'Nama Kitab', 'nama kitab', 'KITAB', 'Kitab']))
    const marhalahNama = cleanText(pick(row, ['MARHALAH', 'Marhalah', 'marhalah']))
    const tokoNama = cleanText(pick(row, ['TOKO', 'Toko', 'toko']))
    const stokLama = toImportInt(pick(row, ['STOK LAMA', 'Stok Lama', 'stok lama']))
    const hargaBeli = toImportInt(pick(row, ['HARGA BELI', 'Harga Beli', 'harga beli']))
    const hargaJual = toImportInt(pick(row, ['HARGA JUAL', 'Harga Jual', 'harga jual']))
    const catatan = cleanText(pick(row, ['CATATAN', 'Catatan', 'catatan']))

    if (!namaKitab || !marhalahNama) {
      failed++
      errors.push(`Baris ${rowNumber}: nama kitab dan marhalah wajib diisi.`)
      continue
    }

    const marhalah = marhalahByName.get(keyText(marhalahNama))
    if (!marhalah) {
      failed++
      errors.push(`Baris ${rowNumber}: marhalah "${marhalahNama}" tidak ditemukan.`)
      continue
    }

    let tokoId: number | null = null
    if (tokoNama) {
      let toko = tokoByName.get(keyText(tokoNama))
      if (!toko) {
        await execute('INSERT INTO upk_toko (nama, is_active, created_at, updated_at) VALUES (?, 1, ?, ?)', [tokoNama, timestamp, timestamp])
        toko = await queryOne<TokoRow>('SELECT id, nama, is_active, created_at, updated_at FROM upk_toko WHERE lower(nama) = lower(?) LIMIT 1', [tokoNama]) ?? undefined
        if (toko) tokoByName.set(keyText(toko.nama), toko)
      }
      tokoId = toko?.id ?? null
    }

    const master = masterByNameAndMarhalah.get(`${keyText(namaKitab)}|||${marhalah.id}`)
    const existing = katalogByName.get(keyText(namaKitab))

    if (existing) {
      // 1 item per nama kitab = stok bersama; baris hanya menambah/menyetel marhalah
      const currentStock = await queryOne<KatalogStockSnapshot>(
        'SELECT stok_lama, stok_updated_at FROM upk_katalog WHERE id = ?',
        [existing.id]
      )
      const stockChanged = !currentStock || currentStock.stok_lama !== stokLama
      const stockUpdatedAt = stockChanged ? timestamp : currentStock.stok_updated_at

      await execute(`
        UPDATE upk_katalog
        SET kitab_id = COALESCE(?, kitab_id), nama_kitab = ?, toko_id = ?,
            stok_lama = ?, harga_beli = ?, harga_jual = ?,
            is_active = 1, catatan = ?, stok_updated_at = ?, updated_at = ?
        WHERE id = ?
      `, [master?.id ?? existing.kitab_id ?? null, namaKitab, tokoId,
          stokLama, hargaBeli, hargaJual, catatan || null, stockUpdatedAt, timestamp, existing.id])
      await ensureLink(existing.id, marhalah.id)
      updated++
    } else {
      await execute(`
        INSERT INTO upk_katalog
          (kitab_id, nama_kitab, toko_id, stok_lama, stok_baru,
           harga_beli, harga_jual, is_active, catatan, stok_updated_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `, [master?.id ?? null, namaKitab, tokoId, stokLama, 0,
          hargaBeli, hargaJual, catatan || null, timestamp, timestamp, timestamp])

      const insertedRow = await queryOne<{ id: number; kitab_id: number | null; nama_kitab: string }>(
        'SELECT id, kitab_id, nama_kitab FROM upk_katalog ORDER BY id DESC LIMIT 1'
      )
      if (insertedRow) {
        katalogByName.set(keyText(insertedRow.nama_kitab), insertedRow)
        await ensureLink(insertedRow.id, marhalah.id)
      }
      inserted++
    }
  }

  if (inserted === 0 && updated === 0) {
    return { error: errors[0] || 'Tidak ada baris valid untuk diimport.' }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_katalog',
    action: 'update',
    fiturHref: '/dashboard/akademik/upk/katalog',
    logKind: 'update',
    entityType: 'upk_katalog_batch',
    entityId: 'import-katalog',
    entityLabel: 'Import katalog UPK',
    summary: `Import katalog UPK: ${inserted} tambah, ${updated} update`,
    details: {
      inserted,
      updated,
      failed,
      total_rows: rows.length,
    },
  })

  revalidatePath(KATALOG_PATH)
  return { success: true, inserted, updated, failed, errors: errors.slice(0, 8) }
}

export async function simpanTokoUPK(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  const id = toNullableInt(formData.get('id'))
  const nama = String(formData.get('nama') ?? '').trim()
  const isActive = formData.get('is_active') === 'on' ? 1 : 0
  if (!nama) return { error: 'Nama toko wajib diisi.' }

  const duplicate = await queryOne<{ id: number }>(
    'SELECT id FROM upk_toko WHERE lower(nama) = lower(?) AND (? IS NULL OR id <> ?) LIMIT 1',
    [nama, id, id]
  )
  if (duplicate) return { error: 'Nama toko sudah ada.' }

  if (id) {
    await execute('UPDATE upk_toko SET nama = ?, is_active = ?, updated_at = ? WHERE id = ?', [nama, isActive, now(), id])
    await logActivity({
      actor: actorFromSession(session),
      module: 'akademik_upk_katalog',
      action: 'update',
      fiturHref: '/dashboard/akademik/upk/katalog',
      logKind: 'update',
      entityType: 'upk_toko',
      entityId: String(id),
      entityLabel: nama,
      summary: `Memperbarui toko UPK ${nama}`,
      details: { is_active: isActive === 1 },
    })
  } else {
    await execute('INSERT INTO upk_toko (nama, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)', [nama, isActive, now(), now()])
    const created = await queryOne<{ id: number }>('SELECT id FROM upk_toko WHERE lower(nama) = lower(?) ORDER BY id DESC LIMIT 1', [nama])
    await logActivity({
      actor: actorFromSession(session),
      module: 'akademik_upk_katalog',
      action: 'create',
      fiturHref: '/dashboard/akademik/upk/katalog',
      logKind: 'create',
      entityType: 'upk_toko',
      entityId: created ? String(created.id) : null,
      entityLabel: nama,
      summary: `Menambahkan toko UPK ${nama}`,
      details: { is_active: isActive === 1 },
    })
  }

  revalidatePath(KATALOG_PATH)
  return { success: true }
}

export async function hapusTokoUPK(id: number): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  const used = await queryOne<{ id: number }>('SELECT id FROM upk_katalog WHERE toko_id = ? LIMIT 1', [id])
  if (used) return { error: 'Toko sudah dipakai di katalog. Nonaktifkan saja jika tidak digunakan lagi.' }

  const target = await queryOne<{ id: number; nama: string }>('SELECT id, nama FROM upk_toko WHERE id = ?', [id])
  await execute('DELETE FROM upk_toko WHERE id = ?', [id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_upk_katalog',
    action: 'delete',
    fiturHref: '/dashboard/akademik/upk/katalog',
    logKind: 'delete',
    entityType: 'upk_toko',
    entityId: String(id),
    entityLabel: target?.nama ?? `Toko ${id}`,
    summary: `Menghapus toko UPK ${target?.nama ?? id}`,
  })
  revalidatePath(KATALOG_PATH)
  return { success: true }
}
