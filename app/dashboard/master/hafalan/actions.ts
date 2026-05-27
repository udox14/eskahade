'use server'

import { revalidatePath } from 'next/cache'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSession, isAdmin } from '@/lib/auth/session'
import { batch, execute, query, queryOne } from '@/lib/db'
import { ensureGuruFeatureSchema, HAFALAN_TYPES, isHafalanType, QURAN_SURAHS } from '@/lib/akademik/guru-access'
import { getCachedMarhalahList } from '@/lib/cache/master'

async function requireAdmin() {
  const session = await getSession()
  if (!session || !isAdmin(session)) return null
  await ensureGuruFeatureSchema()
  return session
}

export async function getMasterHafalanInitialData() {
  const session = await requireAdmin()
  if (!session) return { marhalah: [], types: HAFALAN_TYPES, quranSurahs: QURAN_SURAHS }
  return { marhalah: await getCachedMarhalahList(), types: HAFALAN_TYPES, quranSurahs: QURAN_SURAHS }
}

export async function getMasterHafalanList(jenis: string, marhalahId: number) {
  const session = await requireAdmin()
  if (!session || !isHafalanType(jenis) || !marhalahId) return []

  const rows = await query<any>(`
    SELECT hb.id AS bab_id, hb.judul, hb.urutan AS bab_urutan, hb.is_active AS bab_active,
           hblk.id AS blok_id, hblk.label, hblk.deskripsi, hblk.urutan AS blok_urutan, hblk.is_active AS blok_active
    FROM hafalan_bab hb
    LEFT JOIN hafalan_blok hblk ON hblk.bab_id = hb.id
    WHERE hb.jenis = ? AND hb.marhalah_id = ?
    ORDER BY hb.urutan, hb.id, hblk.urutan, hblk.id
  `, [jenis, marhalahId])

  const map = new Map<number, any>()
  for (const row of rows) {
    if (!map.has(row.bab_id)) {
      map.set(row.bab_id, {
        id: row.bab_id,
        judul: row.judul,
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

export async function tambahHafalanBab(payload: { jenis: string; marhalahId: number; judul: string; urutan: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  const judul = String(payload.judul || '').trim()
  if (!judul) return { error: 'Judul bab wajib diisi.' }

  await execute(
    'INSERT INTO hafalan_bab (jenis, marhalah_id, judul, urutan) VALUES (?, ?, ?, ?)',
    [payload.jenis, payload.marhalahId, judul, Number(payload.urutan || 0)]
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
    details: { jenis: payload.jenis, marhalah_id: payload.marhalahId },
  })
  revalidatePath('/dashboard/master/hafalan')
  return { success: true }
}

export async function tambahSuratQuran(payload: { marhalahId: number; surahNumber: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }

  const surah = QURAN_SURAHS.find(item => item.number === Number(payload.surahNumber))
  if (!surah) return { error: 'Surat tidak valid.' }
  if (!payload.marhalahId) return { error: 'Marhalah wajib dipilih.' }

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM hafalan_bab WHERE jenis = ? AND marhalah_id = ? AND judul = ? LIMIT 1',
    ['quran', payload.marhalahId, surah.name]
  )
  if (existing) return { error: 'Surat ini sudah ada untuk marhalah tersebut.' }

  await execute(
    'INSERT INTO hafalan_bab (jenis, marhalah_id, judul, urutan) VALUES (?, ?, ?, ?)',
    ['quran', payload.marhalahId, surah.name, surah.number]
  )

  const bab = await queryOne<{ id: number }>(
    'SELECT id FROM hafalan_bab WHERE jenis = ? AND marhalah_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
    ['quran', payload.marhalahId, surah.name]
  )
  if (!bab) return { error: 'Gagal membuat surat.' }

  await batch(Array.from({ length: surah.ayahCount }, (_, index) => {
    const ayahNumber = index + 1
    return {
      sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
      params: [bab.id, `Ayat ${ayahNumber}`, `${surah.name}:${ayahNumber}`, ayahNumber],
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
    entityLabel: surah.name,
    summary: `Menambahkan surat ${surah.name} dengan ${surah.ayahCount} ayat`,
    details: { marhalah_id: payload.marhalahId, surah_number: surah.number, ayah_count: surah.ayahCount },
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
  rows: ImportHafalanRow[]
}) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  if (!payload.marhalahId) return { error: 'Marhalah wajib dipilih.' }
  if (!payload.rows.length) return { error: 'Data import kosong.' }

  const existingBabRows = await query<{ id: number; judul: string }>(
    'SELECT id, judul FROM hafalan_bab WHERE jenis = ? AND marhalah_id = ? AND parent_id IS NULL',
    [payload.jenis, payload.marhalahId]
  )
  const babMap = new Map(existingBabRows.map(row => [row.judul.toLowerCase().trim(), row.id]))
  const childBabRows = await query<{ id: number; judul: string; parent_id: number | null }>(
    'SELECT id, judul, parent_id FROM hafalan_bab WHERE jenis = ? AND marhalah_id = ? AND parent_id IS NOT NULL',
    [payload.jenis, payload.marhalahId]
  )
  const childBabMap = new Map(childBabRows.map(row => [`${row.parent_id}:${row.judul.toLowerCase().trim()}`, row.id]))
  const blockRows = await query<{ bab_id: number; label: string }>(`
    SELECT hblk.bab_id, hblk.label
    FROM hafalan_blok hblk
    JOIN hafalan_bab hb ON hb.id = hblk.bab_id
    WHERE hb.jenis = ? AND hb.marhalah_id = ?
  `, [payload.jenis, payload.marhalahId])
  const blockKeys = new Set(blockRows.map(row => `${row.bab_id}:${row.label.toLowerCase().trim()}`))

  let insertedBab = 0
  let insertedBlok = 0
  let skipped = 0

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
        'INSERT INTO hafalan_bab (jenis, marhalah_id, judul, urutan) VALUES (?, ?, ?, ?)',
        [payload.jenis, payload.marhalahId, judulBab, Number.isFinite(urutanBab) && urutanBab > 0 ? urutanBab : parsedRangeImport?.start || 0]
      )
      const inserted = await queryOne<{ id: number }>(
        'SELECT id FROM hafalan_bab WHERE jenis = ? AND marhalah_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
        [payload.jenis, payload.marhalahId, judulBab]
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
            'INSERT INTO hafalan_bab (jenis, marhalah_id, parent_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
            [payload.jenis, payload.marhalahId, babId, explicitBab, Number.isFinite(urutanBab) && urutanBab > 0 ? urutanBab : 0]
          )
          const child = await queryOne<{ id: number }>(
            'SELECT id FROM hafalan_bab WHERE jenis = ? AND marhalah_id = ? AND parent_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
            [payload.jenis, payload.marhalahId, babId, explicitBab]
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
      await execute(
        'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
        [targetBabId, blockLabel, deskripsi || null, Number.isFinite(urutanBlok) ? urutanBlok : 0]
      )
      blockKeys.add(blockKey)
      insertedBlok += 1
      continue
    }

    if (isJurumiyahSimple) {
      const blockKey = `${babId}:Status`.toLowerCase().trim()
      if (!blockKeys.has(blockKey)) {
        await execute(
          'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
          [babId, 'Status', 'Progress bab', 1]
        )
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

        await execute(
          'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
          [babId, `${prefix} ${bait}`, `${judulBab} ${prefix.toLowerCase()} ${bait}`, bait]
        )
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

    await execute(
      'INSERT INTO hafalan_blok (bab_id, label, deskripsi, urutan) VALUES (?, ?, ?, ?)',
      [babId, labelBlok, deskripsi || null, Number.isFinite(urutanBlok) ? urutanBlok : 0]
    )
    blockKeys.add(blockKey)
    insertedBlok += 1
  }

  if (insertedBab === 0 && insertedBlok === 0) {
    return { error: `Tidak ada data baru yang diimport. ${skipped} baris dilewati.` }
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
    details: { jenis: payload.jenis, marhalah_id: payload.marhalahId, inserted_bab: insertedBab, inserted_blok: insertedBlok, skipped },
  })

  revalidatePath('/dashboard/master/hafalan')
  return { success: true, insertedBab, insertedBlok, skipped }
}
