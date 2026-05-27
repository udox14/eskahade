'use server'

import { revalidatePath } from 'next/cache'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSession, isAdmin } from '@/lib/auth/session'
import { batch, execute, query, queryOne } from '@/lib/db'
import { displayQuranSurahTitle, ensureGuruFeatureSchema, getQuranSurahArabicName, HAFALAN_TYPES, isHafalanType, QURAN_SURAHS } from '@/lib/akademik/guru-access'
import { getCachedMarhalahList } from '@/lib/cache/master'

async function requireAdmin() {
  const session = await getSession()
  if (!session || !isAdmin(session)) return null
  await ensureGuruFeatureSchema()
  return session
}

export async function getMasterHafalanInitialData() {
  const session = await requireAdmin()
  const quranSurahs = QURAN_SURAHS.map(surah => ({ ...surah, arabicName: getQuranSurahArabicName(surah) }))
  if (!session) return { marhalah: [], paket: [], types: HAFALAN_TYPES, quranSurahs }
  return { marhalah: await getCachedMarhalahList(), paket: await getHafalanPaketList(), types: HAFALAN_TYPES, quranSurahs }
}

export async function getHafalanPaketList() {
  const rows = await query<any>(`
    SELECT hp.id, hp.jenis, hp.nama, hp.is_active,
           hpm.marhalah_id, m.nama AS marhalah_nama
    FROM hafalan_paket hp
    LEFT JOIN hafalan_paket_marhalah hpm ON hpm.paket_id = hp.id
    LEFT JOIN marhalah m ON m.id = hpm.marhalah_id
    ORDER BY hp.jenis, hp.nama, m.urutan, m.nama
  `)

  const map = new Map<number, any>()
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        jenis: row.jenis,
        nama: row.nama,
        is_active: row.is_active === 1,
        marhalah: [],
      })
    }
    if (row.marhalah_id) {
      map.get(row.id).marhalah.push({
        id: row.marhalah_id,
        nama: row.marhalah_nama,
      })
    }
  }
  return Array.from(map.values())
}

async function getPaketOrError(paketId: number, jenis?: string) {
  const paket = await queryOne<{ id: number; jenis: string; nama: string; marhalah_id: number | null }>(`
    SELECT hp.id, hp.jenis, hp.nama, MIN(hpm.marhalah_id) AS marhalah_id
    FROM hafalan_paket hp
    LEFT JOIN hafalan_paket_marhalah hpm ON hpm.paket_id = hp.id
    WHERE hp.id = ?
    GROUP BY hp.id, hp.jenis, hp.nama
  `, [paketId])
  if (!paket) return { error: 'Paket hafalan tidak ditemukan.' } as const
  if (jenis && paket.jenis !== jenis) return { error: 'Jenis paket tidak sesuai.' } as const
  if (!paket.marhalah_id) return { error: 'Assign minimal satu marhalah dulu untuk paket ini.' } as const
  return { paket } as const
}

async function getAutoPaketForMarhalah(jenis: string, marhalahId: number) {
  const marhalah = await queryOne<{ id: number; nama: string }>(
    'SELECT id, nama FROM marhalah WHERE id = ?',
    [marhalahId]
  )
  if (!marhalah) return { error: 'Marhalah tidak ditemukan.' } as const

  const isMutawassithah = marhalah.nama.toLowerCase().includes('mutawassithah')
  const paketNama = isMutawassithah ? 'Mutawassithah' : marhalah.nama

  await execute(
    'INSERT OR IGNORE INTO hafalan_paket (jenis, nama) VALUES (?, ?)',
    [jenis, paketNama]
  )

  const paket = await queryOne<{ id: number; jenis: string; nama: string }>(
    'SELECT id, jenis, nama FROM hafalan_paket WHERE jenis = ? AND nama = ?',
    [jenis, paketNama]
  )
  if (!paket) return { error: 'Gagal menyiapkan paket hafalan.' } as const

  const targetMarhalah = isMutawassithah
    ? await query<{ id: number }>("SELECT id FROM marhalah WHERE lower(nama) LIKE '%mutawassithah%'")
    : [{ id: marhalah.id }]

  for (const target of targetMarhalah) {
    await execute(
      `INSERT INTO hafalan_paket_marhalah (paket_id, marhalah_id, jenis)
       VALUES (?, ?, ?)
       ON CONFLICT(jenis, marhalah_id) DO UPDATE SET paket_id = excluded.paket_id`,
      [paket.id, target.id, jenis]
    )
  }

  if (isMutawassithah && targetMarhalah.length > 0) {
    const placeholders = targetMarhalah.map(() => '?').join(',')
    await execute(
      `UPDATE hafalan_bab
       SET paket_id = ?
       WHERE jenis = ?
         AND marhalah_id IN (${placeholders})`,
      [paket.id, jenis, ...targetMarhalah.map(item => item.id)]
    )
  }

  return { paket: { ...paket, marhalah_id: marhalah.id } } as const
}

export async function tambahHafalanPaket(payload: { jenis: string; nama: string }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  const nama = String(payload.nama || '').trim()
  if (!nama) return { error: 'Nama paket wajib diisi.' }

  await execute(
    'INSERT OR IGNORE INTO hafalan_paket (jenis, nama) VALUES (?, ?)',
    [payload.jenis, nama]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'create',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'create',
    entityType: 'hafalan_paket',
    entityLabel: nama,
    summary: `Menambahkan paket hafalan ${nama}`,
    details: { jenis: payload.jenis },
  })
  revalidatePath('/dashboard/master/hafalan')
  return { success: true, paket: await getHafalanPaketList() }
}

export async function setHafalanPaketMarhalah(payload: { paketId: number; marhalahId: number; assigned: boolean }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const paket = await queryOne<{ id: number; jenis: string }>('SELECT id, jenis FROM hafalan_paket WHERE id = ?', [payload.paketId])
  if (!paket) return { error: 'Paket hafalan tidak ditemukan.' }

  if (payload.assigned) {
    await execute(
      `INSERT INTO hafalan_paket_marhalah (paket_id, marhalah_id, jenis)
       VALUES (?, ?, ?)
       ON CONFLICT(jenis, marhalah_id) DO UPDATE SET paket_id = excluded.paket_id`,
      [payload.paketId, payload.marhalahId, paket.jenis]
    )
    await execute(
      'UPDATE hafalan_bab SET marhalah_id = ? WHERE paket_id = ? AND marhalah_id IS NULL',
      [payload.marhalahId, payload.paketId]
    )
  } else {
    await execute(
      'DELETE FROM hafalan_paket_marhalah WHERE paket_id = ? AND marhalah_id = ?',
      [payload.paketId, payload.marhalahId]
    )
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'update',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'update',
    entityType: 'hafalan_paket_marhalah',
    entityId: `${payload.paketId}:${payload.marhalahId}`,
    summary: `${payload.assigned ? 'Assign' : 'Unassign'} marhalah paket hafalan`,
    details: payload,
  })
  revalidatePath('/dashboard/master/hafalan')
  return { success: true, paket: await getHafalanPaketList() }
}

export async function getMasterHafalanList(jenis: string, marhalahId: number) {
  const session = await requireAdmin()
  if (!session || !isHafalanType(jenis) || !marhalahId) return []
  const paketResult = await getAutoPaketForMarhalah(jenis, marhalahId)
  if ('error' in paketResult) return []

  const rows = await query<any>(`
    SELECT hb.id AS bab_id, hb.judul, hb.urutan AS bab_urutan, hb.is_active AS bab_active,
           hblk.id AS blok_id, hblk.label, hblk.deskripsi, hblk.urutan AS blok_urutan, hblk.is_active AS blok_active
    FROM hafalan_bab hb
    LEFT JOIN hafalan_blok hblk ON hblk.bab_id = hb.id
    WHERE hb.jenis = ? AND hb.paket_id = ?
    ORDER BY hb.urutan, hb.id, hblk.urutan, hblk.id
  `, [jenis, paketResult.paket.id])

  const map = new Map<number, any>()
  for (const row of rows) {
    if (!map.has(row.bab_id)) {
      map.set(row.bab_id, {
        id: row.bab_id,
        judul: jenis === 'quran' ? displayQuranSurahTitle(row.judul) : row.judul,
        urutan: row.bab_urutan,
        is_active: row.bab_active === 1,
        blok: [],
      })
    }
    if (row.blok_id) {
      map.get(row.bab_id).blok.push({
        id: row.blok_id,
        label: row.label,
        deskripsi: row.deskripsi,
        urutan: row.blok_urutan,
        is_active: row.blok_active === 1,
      })
    }
  }
  return Array.from(map.values())
}

export async function tambahHafalanBab(payload: { jenis: string; marhalahId: number; paketId?: number; judul: string; urutan: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  const judul = String(payload.judul || '').trim()
  if (!judul) return { error: 'Judul bab wajib diisi.' }
  const paketResult = payload.marhalahId
    ? await getAutoPaketForMarhalah(payload.jenis, payload.marhalahId)
    : await getPaketOrError(Number(payload.paketId), payload.jenis)
  if ('error' in paketResult) return { error: paketResult.error }

  await execute(
    'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
    [payload.jenis, paketResult.paket.marhalah_id, paketResult.paket.id, judul, Number(payload.urutan || 0)]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'create',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'create',
    entityType: 'hafalan_bab',
    entityLabel: judul,
    summary: `Menambahkan bab hafalan ${judul}`,
    details: { jenis: payload.jenis, paket_id: paketResult.paket.id, marhalah_id: paketResult.paket.marhalah_id },
  })
  revalidatePath('/dashboard/master/hafalan')
  return { success: true }
}

export async function tambahSuratQuran(payload: { marhalahId: number; paketId?: number; surahNumber: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }

  const surah = QURAN_SURAHS.find(item => item.number === Number(payload.surahNumber))
  if (!surah) return { error: 'Surat tidak valid.' }
  const surahTitle = getQuranSurahArabicName(surah)
  const paketResult = payload.marhalahId
    ? await getAutoPaketForMarhalah('quran', payload.marhalahId)
    : await getPaketOrError(Number(payload.paketId), 'quran')
  if ('error' in paketResult) return { error: paketResult.error }

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND judul IN (?, ?) LIMIT 1',
    ['quran', paketResult.paket.id, surah.name, surahTitle]
  )
  if (existing) return { error: 'Surat ini sudah ada untuk paket tersebut.' }

  await execute(
    'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
    ['quran', paketResult.paket.marhalah_id, paketResult.paket.id, surahTitle, surah.number]
  )

  const bab = await queryOne<{ id: number }>(
    'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
    ['quran', paketResult.paket.id, surahTitle]
  )
  if (!bab) return { error: 'Gagal membuat surat.' }

  await batch(Array.from({ length: surah.ayahCount }, (_, index) => {
    const ayahNumber = index + 1
    return {
      sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
      params: [bab.id, `Ayat ${ayahNumber}`, `${surahTitle}:${ayahNumber}`, ayahNumber],
    }
  }))

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'create',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'create',
    entityType: 'hafalan_quran_surat',
    entityId: String(bab.id),
    entityLabel: surahTitle,
    summary: `Menambahkan surat ${surahTitle} dengan ${surah.ayahCount} ayat`,
    details: { paket_id: paketResult.paket.id, marhalah_id: paketResult.paket.marhalah_id, surah_number: surah.number, ayah_count: surah.ayahCount },
  })

  revalidatePath('/dashboard/master/hafalan')
  return { success: true, count: surah.ayahCount }
}

export async function tambahHafalanBlok(payload: { babId: number; label: string; deskripsi?: string; urutan: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const label = String(payload.label || '').trim()
  if (!label) return { error: 'Label blok wajib diisi.' }

  const bab = await queryOne<{ id: number; judul: string }>('SELECT id, judul FROM hafalan_bab WHERE id = ?', [payload.babId])
  if (!bab) return { error: 'Bab tidak ditemukan.' }

  await execute(
    'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
    [payload.babId, label, String(payload.deskripsi || '').trim() || null, Number(payload.urutan || 0)]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'create',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'create',
    entityType: 'hafalan_blok',
    entityLabel: label,
    summary: `Menambahkan blok hafalan ${label}`,
    details: { bab_id: payload.babId },
  })
  revalidatePath('/dashboard/master/hafalan')
  return { success: true }
}

export async function setHafalanActive(target: 'bab' | 'blok', id: number, active: boolean) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const table = target === 'bab' ? 'hafalan_bab' : 'hafalan_blok'
  await execute(`UPDATE ${table} SET is_active = ?, updated_at = datetime('now') WHERE id = ?`, [active ? 1 : 0, id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'update',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'update',
    entityType: table,
    entityId: String(id),
    summary: `${active ? 'Mengaktifkan' : 'Menonaktifkan'} ${target} hafalan`,
  })
  revalidatePath('/dashboard/master/hafalan')
  return { success: true }
}

export async function hapusSemuaHafalan(payload: { jenis: string; marhalahId: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  if (!payload.marhalahId) return { error: 'Marhalah wajib dipilih.' }

  const paketResult = await getAutoPaketForMarhalah(payload.jenis, payload.marhalahId)
  if ('error' in paketResult) return { error: paketResult.error }

  const babRows = await query<{ id: number }>(
    'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ?',
    [payload.jenis, paketResult.paket.id]
  )
  if (babRows.length === 0) return { error: 'Tidak ada materi yang bisa dihapus untuk filter ini.' }

  const babIds = babRows.map(row => row.id)
  const placeholders = babIds.map(() => '?').join(',')
  const blokRows = await query<{ id: number }>(
    `SELECT id FROM hafalan_blok WHERE bab_id IN (${placeholders})`,
    babIds
  )
  const blokIds = blokRows.map(row => row.id)

  if (blokIds.length > 0) {
    const blokPlaceholders = blokIds.map(() => '?').join(',')
    await execute(`DELETE FROM hafalan_progress WHERE blok_id IN (${blokPlaceholders})`, blokIds)
  }
  await execute(`DELETE FROM hafalan_bab WHERE id IN (${placeholders})`, babIds)

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'delete',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'delete',
    entityType: 'hafalan_bab_batch',
    entityLabel: 'Hapus semua materi hafalan',
    summary: `Menghapus semua materi hafalan ${payload.jenis}: ${babIds.length} bab, ${blokIds.length} blok`,
    details: { jenis: payload.jenis, paket_id: paketResult.paket.id, marhalah_id: payload.marhalahId, total_bab: babIds.length, total_blok: blokIds.length },
  })

  revalidatePath('/dashboard/master/hafalan')
  return { success: true, deletedBab: babIds.length, deletedBlok: blokIds.length }
}

type ImportHafalanRow = Record<string, unknown>

function cell(row: ImportHafalanRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value != null && String(value).trim()) return String(value).trim()
  }
  return ''
}

function parseRange(value: string) {
  const normalized = value.replace(/[–—]/g, '-').replace(/\s+/g, '')
  const match = normalized.match(/^(\d+)-(\d+)$/)
  if (match) {
    const start = Number(match[1])
    const end = Number(match[2])
    if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start) return { start, end }
  }

  const single = Number(normalized)
  if (Number.isFinite(single) && single > 0) return { start: single, end: single }
  return null
}

export async function importHafalanMassal(payload: {
  jenis: string
  marhalahId: number
  paketId?: number
  rows: ImportHafalanRow[]
}) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  const paketResult = payload.marhalahId
    ? await getAutoPaketForMarhalah(payload.jenis, payload.marhalahId)
    : await getPaketOrError(Number(payload.paketId), payload.jenis)
  if ('error' in paketResult) return { error: paketResult.error }
  if (!payload.rows.length) return { error: 'Data import kosong.' }

  const existingBabRows = await query<{ id: number; judul: string }>(
    'SELECT id, judul FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND parent_id IS NULL',
    [payload.jenis, paketResult.paket.id]
  )
  const babMap = new Map(existingBabRows.map(row => [row.judul.toLowerCase().trim(), row.id]))
  const childBabRows = await query<{ id: number; judul: string; parent_id: number | null }>(
    'SELECT id, judul, parent_id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND parent_id IS NOT NULL',
    [payload.jenis, paketResult.paket.id]
  )
  const childBabMap = new Map(childBabRows.map(row => [`${row.parent_id}:${row.judul.toLowerCase().trim()}`, row.id]))
  const blockRows = await query<{ bab_id: number; label: string }>(`
    SELECT hblk.bab_id, hblk.label
    FROM hafalan_blok hblk
    JOIN hafalan_bab hb ON hb.id = hblk.bab_id
    WHERE hb.jenis = ? AND hb.paket_id = ?
  `, [payload.jenis, paketResult.paket.id])
  const blockKeys = new Set(blockRows.map(row => `${row.bab_id}:${row.label.toLowerCase().trim()}`))

  let insertedBab = 0
  let insertedBlok = 0
  let skipped = 0
  const blockOps: { sql: string; params: any[] }[] = []

  for (const row of payload.rows) {
    const bagian = cell(row, ['BAGIAN', 'Bagian', 'bagian'])
    const explicitBab = cell(row, ['BAB', 'Bab', 'bab', 'JUDUL BAB', 'Judul Bab', 'judul_bab', 'NAMA BAB (ARAB)', 'Nama Bab (Arab)', 'nama bab (arab)', 'NAMA BAB', 'Nama Bab'])
    const judulBab = payload.jenis === 'amtsilah'
      ? (bagian || explicitBab)
      : explicitBab
    const labelBlok = cell(row, ['BLOK', 'Blok', 'blok', 'LABEL BLOK', 'Label Blok', 'label_blok'])
    const wazan = cell(row, ['WAZAN', 'Wazan', 'wazan'])
    const deskripsi = cell(row, ['DESKRIPSI', 'Deskripsi', 'deskripsi', 'KETERANGAN', 'Keterangan'])
    const urutanBab = Number(cell(row, ['URUTAN BAB', 'Urutan Bab', 'urutan_bab', 'URUTAN']) || 0)
    const urutanBlok = Number(cell(row, ['URUTAN BLOK', 'Urutan Blok', 'urutan_blok']) || 0)
    const rangeValue = cell(row, [
      'BAIT KE-', 'Bait Ke-', 'bait ke-', 'BAIT KE', 'Bait Ke', 'bait_ke',
      'HADITS KE-', 'Hadits Ke-', 'hadits ke-', 'HADITS KE', 'Hadits Ke', 'hadits_ke',
    ])
    const jumlahRange = Number(cell(row, [
      'JUMLAH BAIT', 'Jumlah Bait', 'jumlah bait', 'jumlah_bait',
      'JUMLAH HADITS', 'Jumlah Hadits', 'jumlah hadits', 'jumlah_hadits',
    ]) || 0)
    const isRangeImport = payload.jenis === 'alfiyah' || payload.jenis === 'hadits'
    const parsedRangeImport = isRangeImport && rangeValue ? parseRange(rangeValue) : null
    const isJurumiyahSimple = payload.jenis === 'jurumiyah' && judulBab && !labelBlok

    if (!judulBab) {
      skipped += 1
      continue
    }

    const babKey = judulBab.toLowerCase().trim()
    let babId = babMap.get(babKey)
    if (!babId) {
      await execute(
        'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
        [payload.jenis, paketResult.paket.marhalah_id, paketResult.paket.id, judulBab, Number.isFinite(urutanBab) && urutanBab > 0 ? urutanBab : parsedRangeImport?.start || 0]
      )
      const inserted = await queryOne<{ id: number }>(
        'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
        [payload.jenis, paketResult.paket.id, judulBab]
      )
      if (!inserted) {
        skipped += 1
        continue
      }
      babId = inserted.id
      babMap.set(babKey, babId)
      insertedBab += 1
    }

    if (payload.jenis === 'amtsilah') {
      const blockLabel = wazan || labelBlok
      if (!blockLabel) {
        skipped += 1
        continue
      }

      let targetBabId: number = babId
      if (bagian && explicitBab) {
        const childKey = `${babId}:${explicitBab.toLowerCase().trim()}`
        targetBabId = childBabMap.get(childKey) || 0
        if (!targetBabId) {
          await execute(
            'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, parent_id, judul, urutan) VALUES (?, ?, ?, ?, ?, ?)',
            [payload.jenis, paketResult.paket.marhalah_id, paketResult.paket.id, babId, explicitBab, Number.isFinite(urutanBab) && urutanBab > 0 ? urutanBab : 0]
          )
          const child = await queryOne<{ id: number }>(
            'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND parent_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
            [payload.jenis, paketResult.paket.id, babId, explicitBab]
          )
          if (!child) {
            skipped += 1
            continue
          }
          targetBabId = child.id
          childBabMap.set(childKey, targetBabId)
          insertedBab += 1
        }
      }

      const blockKey = `${targetBabId}:${blockLabel.toLowerCase().trim()}`
      if (blockKeys.has(blockKey)) {
        skipped += 1
        continue
      }
        blockOps.push({
          sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
          params: [targetBabId, blockLabel, deskripsi || null, Number.isFinite(urutanBlok) ? urutanBlok : 0],
        })
      blockKeys.add(blockKey)
      insertedBlok += 1
      continue
    }

    if (isJurumiyahSimple) {
      const blockKey = `${babId}:Status`.toLowerCase().trim()
      if (!blockKeys.has(blockKey)) {
        blockOps.push({
          sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
          params: [babId, 'Status', 'Progress bab', 1],
        })
        blockKeys.add(blockKey)
        insertedBlok += 1
      }
      continue
    }

    if (isRangeImport && rangeValue) {
      const parsedRange = parsedRangeImport
      if (!parsedRange) {
        skipped += 1
        continue
      }

      const count = parsedRange.end - parsedRange.start + 1
      if (Number.isFinite(jumlahRange) && jumlahRange > 0 && jumlahRange !== count) {
        skipped += 1
        continue
      }

      const prefix = payload.jenis === 'hadits' ? 'Hadits' : 'Bait'
      for (let bait = parsedRange.start; bait <= parsedRange.end; bait += 1) {
        const blockKey = `${babId}:${prefix} ${bait}`.toLowerCase().trim()
        if (blockKeys.has(blockKey)) {
          skipped += 1
          continue
        }

        blockOps.push({
          sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
          params: [babId, `${prefix} ${bait}`, `${judulBab} ${prefix.toLowerCase()} ${bait}`, bait],
        })
        blockKeys.add(blockKey)
        insertedBlok += 1
      }
      continue
    }

    if (!labelBlok) {
      skipped += 1
      continue
    }

    const blockKey = `${babId}:${labelBlok.toLowerCase().trim()}`
    if (blockKeys.has(blockKey)) {
      skipped += 1
      continue
    }

    blockOps.push({
      sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
      params: [babId, labelBlok, deskripsi || null, Number.isFinite(urutanBlok) ? urutanBlok : 0],
    })
    blockKeys.add(blockKey)
    insertedBlok += 1
  }

  if (insertedBab === 0 && insertedBlok === 0) {
    return { error: `Tidak ada data baru yang diimport. ${skipped} baris dilewati.` }
  }

  if (blockOps.length > 0) {
    await batch(blockOps)
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'master_hafalan',
    action: 'create',
    fiturHref: '/dashboard/master/hafalan',
    logKind: 'create',
    entityType: 'hafalan_import',
    entityLabel: 'Import hafalan massal',
    summary: `Import hafalan: ${insertedBab} bab, ${insertedBlok} blok`,
    details: { jenis: payload.jenis, paket_id: paketResult.paket.id, marhalah_id: paketResult.paket.marhalah_id, inserted_bab: insertedBab, inserted_blok: insertedBlok, skipped },
  })

  revalidatePath('/dashboard/master/hafalan')
  return { success: true, insertedBab, insertedBlok, skipped }
}
