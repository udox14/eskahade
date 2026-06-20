'use server'

import { revalidatePath } from 'next/cache'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSession, isAdmin } from '@/lib/auth/session'
import { batch, execute, query, queryOne } from '@/lib/db'
import {
  displayQuranSurahTitle,
  ensureGuruFeatureSchema,
  getQuranSurahArabicName,
  HAFALAN_TYPES,
  isHafalanType,
  QURAN_JUZ,
  QURAN_SURAHS,
} from '@/lib/akademik/guru-access'
import { getCachedMarhalahList } from '@/lib/cache/master'
import { getMatanBab, getMatanSources, hafalanSlug, resolveHafalanText } from '@/lib/hafalan/text'

const FITUR = '/dashboard/master/hafalan'

async function requireAdmin() {
  const session = await getSession()
  if (!session || !isAdmin(session)) return null
  await ensureGuruFeatureSchema()
  return session
}

type PaketScope = { id: number; jenis: string; nama: string; marhalah_id: number | null }

async function getPaketScope(paketId: number): Promise<PaketScope | null> {
  return queryOne<PaketScope>(`
    SELECT hp.id, hp.jenis, hp.nama, MIN(hpm.marhalah_id) AS marhalah_id
    FROM hafalan_paket hp
    LEFT JOIN hafalan_paket_marhalah hpm ON hpm.paket_id = hp.id
    WHERE hp.id = ?
    GROUP BY hp.id, hp.jenis, hp.nama
  `, [paketId])
}

/** Paket harus punya minimal satu marhalah sebelum diisi materi (bab.marhalah_id NOT NULL). */
async function requirePaketMateri(paketId: number, jenis?: string) {
  const paket = await getPaketScope(paketId)
  if (!paket) return { error: 'Paket hafalan tidak ditemukan.' } as const
  if (jenis && paket.jenis !== jenis) return { error: 'Jenis paket tidak sesuai.' } as const
  if (!paket.marhalah_id) return { error: 'Assign minimal satu marhalah ke paket ini dulu.' } as const
  return { paket } as const
}

// ── Data awal ────────────────────────────────────────────────────────────────

export async function getMasterHafalanInitialData() {
  const session = await requireAdmin()
  const quranSurahs = QURAN_SURAHS.map(surah => ({ ...surah, arabicName: getQuranSurahArabicName(surah) }))
  if (!session) return { marhalah: [], paket: [], types: HAFALAN_TYPES, quranSurahs }
  return {
    marhalah: await getCachedMarhalahList(),
    paket: await getHafalanPaketList(),
    types: HAFALAN_TYPES,
    quranSurahs,
  }
}

export async function getHafalanPaketList() {
  const session = await requireAdmin()
  if (!session) return []
  const rows = await query<any>(`
    SELECT hp.id, hp.jenis, hp.nama, hp.is_active,
           hpm.marhalah_id, m.nama AS marhalah_nama, m.urutan AS marhalah_urutan,
           (SELECT COUNT(*) FROM hafalan_bab hb WHERE hb.paket_id = hp.id) AS total_bab,
           (SELECT COUNT(*) FROM hafalan_blok hblk
              JOIN hafalan_bab hb2 ON hb2.id = hblk.bab_id
              WHERE hb2.paket_id = hp.id) AS total_blok
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
        total_bab: row.total_bab || 0,
        total_blok: row.total_blok || 0,
        marhalah: [],
      })
    }
    if (row.marhalah_id) {
      map.get(row.id).marhalah.push({ id: row.marhalah_id, nama: row.marhalah_nama })
    }
  }
  return Array.from(map.values())
}

// ── CRUD Paket ───────────────────────────────────────────────────────────────

export async function createHafalanPaket(payload: { jenis: string; nama: string }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  const nama = String(payload.nama || '').trim()
  if (!nama) return { error: 'Nama paket wajib diisi.' }

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM hafalan_paket WHERE jenis = ? AND nama = ?',
    [payload.jenis, nama]
  )
  if (existing) return { error: 'Paket dengan nama itu sudah ada.' }

  await execute('INSERT INTO hafalan_paket (jenis, nama) VALUES (?, ?)', [payload.jenis, nama])
  const paket = await queryOne<{ id: number }>(
    'SELECT id FROM hafalan_paket WHERE jenis = ? AND nama = ?',
    [payload.jenis, nama]
  )
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'create',
    fiturHref: FITUR, logKind: 'create', entityType: 'hafalan_paket',
    entityId: String(paket?.id), entityLabel: nama,
    summary: `Membuat paket hafalan ${nama}`, details: { jenis: payload.jenis },
  })
  revalidatePath(FITUR)
  return { success: true, paketId: paket?.id, paket: await getHafalanPaketList() }
}

export async function renameHafalanPaket(payload: { paketId: number; nama: string }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const nama = String(payload.nama || '').trim()
  if (!nama) return { error: 'Nama paket wajib diisi.' }
  const paket = await getPaketScope(payload.paketId)
  if (!paket) return { error: 'Paket hafalan tidak ditemukan.' }
  const clash = await queryOne<{ id: number }>(
    'SELECT id FROM hafalan_paket WHERE jenis = ? AND nama = ? AND id <> ?',
    [paket.jenis, nama, payload.paketId]
  )
  if (clash) return { error: 'Nama paket sudah dipakai.' }

  await execute("UPDATE hafalan_paket SET nama = ?, updated_at = datetime('now') WHERE id = ?", [nama, payload.paketId])
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'update',
    fiturHref: FITUR, logKind: 'update', entityType: 'hafalan_paket',
    entityId: String(payload.paketId), entityLabel: nama, summary: `Mengubah nama paket menjadi ${nama}`,
  })
  revalidatePath(FITUR)
  return { success: true, paket: await getHafalanPaketList() }
}

export async function setHafalanPaketActive(payload: { paketId: number; active: boolean }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  await execute("UPDATE hafalan_paket SET is_active = ?, updated_at = datetime('now') WHERE id = ?", [payload.active ? 1 : 0, payload.paketId])
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'update',
    fiturHref: FITUR, logKind: 'update', entityType: 'hafalan_paket', entityId: String(payload.paketId),
    summary: `${payload.active ? 'Mengaktifkan' : 'Menonaktifkan'} paket hafalan`,
  })
  revalidatePath(FITUR)
  return { success: true, paket: await getHafalanPaketList() }
}

export async function deleteHafalanPaket(payload: { paketId: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const paket = await getPaketScope(payload.paketId)
  if (!paket) return { error: 'Paket hafalan tidak ditemukan.' }

  const babRows = await query<{ id: number }>('SELECT id FROM hafalan_bab WHERE paket_id = ?', [payload.paketId])
  const babIds = babRows.map(r => r.id)
  if (babIds.length) {
    const ph = babIds.map(() => '?').join(',')
    const blokRows = await query<{ id: number }>(`SELECT id FROM hafalan_blok WHERE bab_id IN (${ph})`, babIds)
    const blokIds = blokRows.map(r => r.id)
    if (blokIds.length) {
      const bph = blokIds.map(() => '?').join(',')
      await execute(`DELETE FROM hafalan_progress WHERE blok_id IN (${bph})`, blokIds)
    }
    await execute(`DELETE FROM hafalan_bab WHERE id IN (${ph})`, babIds)
  }
  await execute('DELETE FROM hafalan_paket_marhalah WHERE paket_id = ?', [payload.paketId])
  await execute('DELETE FROM hafalan_paket WHERE id = ?', [payload.paketId])

  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'delete',
    fiturHref: FITUR, logKind: 'delete', entityType: 'hafalan_paket', entityId: String(payload.paketId),
    entityLabel: paket.nama, summary: `Menghapus paket hafalan ${paket.nama} beserta materinya`,
  })
  revalidatePath(FITUR)
  return { success: true, paket: await getHafalanPaketList() }
}

export async function setHafalanPaketMarhalah(payload: { paketId: number; marhalahId: number; assigned: boolean }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const paket = await getPaketScope(payload.paketId)
  if (!paket) return { error: 'Paket hafalan tidak ditemukan.' }

  if (payload.assigned) {
    // marhalah hanya boleh terikat ke satu paket per jenis (UNIQUE jenis, marhalah_id)
    await execute(`
      INSERT INTO hafalan_paket_marhalah (paket_id, marhalah_id, jenis)
      VALUES (?, ?, ?)
      ON CONFLICT(jenis, marhalah_id) DO UPDATE SET paket_id = excluded.paket_id
    `, [payload.paketId, payload.marhalahId, paket.jenis])
    await execute(
      'UPDATE hafalan_bab SET marhalah_id = ? WHERE paket_id = ? AND marhalah_id IS NULL',
      [payload.marhalahId, payload.paketId]
    )
  } else {
    await execute('DELETE FROM hafalan_paket_marhalah WHERE paket_id = ? AND marhalah_id = ?', [payload.paketId, payload.marhalahId])
  }

  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'update',
    fiturHref: FITUR, logKind: 'update', entityType: 'hafalan_paket_marhalah',
    entityId: `${payload.paketId}:${payload.marhalahId}`,
    summary: `${payload.assigned ? 'Assign' : 'Unassign'} marhalah ke paket ${paket.nama}`, details: payload,
  })
  revalidatePath(FITUR)
  return { success: true, paket: await getHafalanPaketList() }
}

// ── Detail paket (materi) ──────────────────────────────────────────────────────

export async function getPaketDetail(paketId: number) {
  const session = await requireAdmin()
  if (!session) return null
  const paket = await getPaketScope(paketId)
  if (!paket) return null

  const rows = await query<any>(`
    SELECT hb.id AS bab_id, hb.judul, hb.urutan AS bab_urutan, hb.is_active AS bab_active, hb.parent_id,
           hblk.id AS blok_id, hblk.label, hblk.deskripsi, hblk.ref, hblk.urutan AS blok_urutan, hblk.is_active AS blok_active
    FROM hafalan_bab hb
    LEFT JOIN hafalan_blok hblk ON hblk.bab_id = hb.id
    WHERE hb.paket_id = ?
    ORDER BY hb.urutan, hb.id, hblk.urutan, hblk.id
  `, [paketId])

  const map = new Map<number, any>()
  for (const row of rows) {
    if (!map.has(row.bab_id)) {
      map.set(row.bab_id, {
        id: row.bab_id,
        judul: paket.jenis === 'quran' ? displayQuranSurahTitle(row.judul) : row.judul,
        urutan: row.bab_urutan,
        parent_id: row.parent_id,
        is_active: row.bab_active === 1,
        blok: [],
      })
    }
    if (row.blok_id) {
      const teks = resolveHafalanText(row.ref)
      map.get(row.bab_id).blok.push({
        id: row.blok_id,
        label: row.label,
        deskripsi: row.deskripsi,
        ref: row.ref,
        urutan: row.blok_urutan,
        is_active: row.blok_active === 1,
        teks: teks ? { arab: teks.arab, terjemah: teks.terjemah } : null,
      })
    }
  }
  const matanOptions = getMatanSources(paket.jenis).map(s => ({ key: s.key, label: s.label }))
  return {
    paket: { id: paket.id, jenis: paket.jenis, nama: paket.nama, hasMarhalah: !!paket.marhalah_id, matanOptions },
    bab: Array.from(map.values()),
  }
}

/** Isi materi paket otomatis dari matan bawaan (mis. Jurumiyah): bab + segmen-blok. */
export async function seedMatanKePaket(payload: { paketId: number; matanKey?: string }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const scope = await requirePaketMateri(payload.paketId)
  if ('error' in scope) return { error: scope.error }
  const matan = getMatanBab(scope.paket.jenis, payload.matanKey)
  if (matan.length === 0) return { error: 'Tidak ada matan bawaan untuk jenis ini.' }

  const existing = await query<{ judul: string }>('SELECT judul FROM hafalan_bab WHERE paket_id = ?', [payload.paketId])
  const seen = new Set(existing.map(r => r.judul.trim()))

  let insertedBab = 0
  let insertedBlok = 0
  for (const bab of matan) {
    if (seen.has(bab.nama.trim())) continue
    await execute(
      'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
      [scope.paket.jenis, scope.paket.marhalah_id, scope.paket.id, bab.nama, bab.urutan]
    )
    const row = await queryOne<{ id: number }>(
      'SELECT id FROM hafalan_bab WHERE paket_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
      [payload.paketId, bab.nama]
    )
    if (!row) continue
    insertedBab += 1
    if (bab.segmen.length > 0) {
      await batch(bab.segmen.map(seg => ({
        sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, ref, urutan) VALUES (?, ?, ?, ?, ?)',
        params: [row.id, seg.label || String(seg.n), null, seg.ref, seg.n],
      })))
      insertedBlok += bab.segmen.length
    }
  }

  if (insertedBab === 0) return { error: 'Semua bab matan sudah ada di paket ini.' }
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'create',
    fiturHref: FITUR, logKind: 'create', entityType: 'hafalan_matan_seed', entityLabel: scope.paket.nama,
    summary: `Isi materi dari matan bawaan: ${insertedBab} bab, ${insertedBlok} blok`,
    details: { paket_id: payload.paketId, jenis: scope.paket.jenis },
  })
  revalidatePath(FITUR)
  return { success: true, insertedBab, insertedBlok }
}

// ── Materi: bab & blok ─────────────────────────────────────────────────────────

export async function tambahHafalanBab(payload: { paketId: number; judul: string; urutan: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const judul = String(payload.judul || '').trim()
  if (!judul) return { error: 'Judul bab wajib diisi.' }
  const scope = await requirePaketMateri(payload.paketId)
  if ('error' in scope) return { error: scope.error }

  await execute(
    'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
    [scope.paket.jenis, scope.paket.marhalah_id, scope.paket.id, judul, Number(payload.urutan || 0)]
  )
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'create',
    fiturHref: FITUR, logKind: 'create', entityType: 'hafalan_bab', entityLabel: judul,
    summary: `Menambahkan bab hafalan ${judul}`, details: { paket_id: scope.paket.id },
  })
  revalidatePath(FITUR)
  return { success: true }
}

export async function updateHafalanBab(payload: { babId: number; judul: string; urutan: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const judul = String(payload.judul || '').trim()
  if (!judul) return { error: 'Judul bab wajib diisi.' }
  await execute(
    "UPDATE hafalan_bab SET judul = ?, urutan = ?, updated_at = datetime('now') WHERE id = ?",
    [judul, Number(payload.urutan || 0), payload.babId]
  )
  revalidatePath(FITUR)
  return { success: true }
}

export async function deleteHafalanBab(payload: { babId: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const blokRows = await query<{ id: number }>('SELECT id FROM hafalan_blok WHERE bab_id = ?', [payload.babId])
  const blokIds = blokRows.map(r => r.id)
  if (blokIds.length) {
    const ph = blokIds.map(() => '?').join(',')
    await execute(`DELETE FROM hafalan_progress WHERE blok_id IN (${ph})`, blokIds)
  }
  await execute('DELETE FROM hafalan_bab WHERE id = ?', [payload.babId])
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'delete',
    fiturHref: FITUR, logKind: 'delete', entityType: 'hafalan_bab', entityId: String(payload.babId),
    summary: 'Menghapus bab hafalan beserta bloknya',
  })
  revalidatePath(FITUR)
  return { success: true }
}

export async function tambahSuratQuran(payload: { paketId: number; surahNumber: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const surah = QURAN_SURAHS.find(item => item.number === Number(payload.surahNumber))
  if (!surah) return { error: 'Surat tidak valid.' }
  const scope = await requirePaketMateri(payload.paketId, 'quran')
  if ('error' in scope) return { error: scope.error }
  const surahTitle = getQuranSurahArabicName(surah)

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND judul IN (?, ?) LIMIT 1',
    ['quran', scope.paket.id, surah.name, surahTitle]
  )
  if (existing) return { error: 'Surat ini sudah ada di paket tersebut.' }

  await execute(
    'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
    ['quran', scope.paket.marhalah_id, scope.paket.id, surahTitle, surah.number]
  )
  const bab = await queryOne<{ id: number }>(
    'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
    ['quran', scope.paket.id, surahTitle]
  )
  if (!bab) return { error: 'Gagal membuat surat.' }

  await batch(Array.from({ length: surah.ayahCount }, (_, index) => {
    const ayah = index + 1
    return {
      sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, ref, urutan) VALUES (?, ?, ?, ?, ?)',
      params: [bab.id, `Ayat ${ayah}`, `${surahTitle}:${ayah}`, `quran:${surah.number}:${ayah}`, ayah],
    }
  }))

  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'create',
    fiturHref: FITUR, logKind: 'create', entityType: 'hafalan_quran_surat', entityId: String(bab.id),
    entityLabel: surahTitle, summary: `Menambahkan surat ${surahTitle} (${surah.ayahCount} ayat)`,
    details: { paket_id: scope.paket.id, surah_number: surah.number },
  })
  revalidatePath(FITUR)
  return { success: true, count: surah.ayahCount }
}

export async function tambahJuzQuran(payload: { paketId: number; juz: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const range = QURAN_JUZ.find(j => j.juz === Number(payload.juz))
  if (!range) return { error: 'Juz tidak valid.' }
  const scope = await requirePaketMateri(payload.paketId, 'quran')
  if ('error' in scope) return { error: scope.error }

  let insertedBlok = 0
  let insertedBab = 0
  for (let s = range.startSurah; s <= range.endSurah; s += 1) {
    const surah = QURAN_SURAHS.find(item => item.number === s)
    if (!surah) continue
    const aStart = s === range.startSurah ? range.startAyah : 1
    const aEnd = s === range.endSurah ? range.endAyah : surah.ayahCount
    const title = getQuranSurahArabicName(surah)

    let bab = await queryOne<{ id: number }>(
      'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND judul IN (?, ?) LIMIT 1',
      ['quran', scope.paket.id, surah.name, title]
    )
    if (!bab) {
      await execute(
        'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
        ['quran', scope.paket.marhalah_id, scope.paket.id, title, s]
      )
      bab = await queryOne<{ id: number }>(
        'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
        ['quran', scope.paket.id, title]
      )
      if (!bab) continue
      insertedBab += 1
    }

    const existing = await query<{ urutan: number }>('SELECT urutan FROM hafalan_blok WHERE bab_id = ?', [bab.id])
    const seen = new Set(existing.map(r => Number(r.urutan)))
    const ops: { sql: string; params: any[] }[] = []
    for (let a = aStart; a <= aEnd; a += 1) {
      if (seen.has(a)) continue
      ops.push({
        sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, ref, urutan) VALUES (?, ?, ?, ?, ?)',
        params: [bab.id, `Ayat ${a}`, `${title}:${a}`, `quran:${s}:${a}`, a],
      })
    }
    if (ops.length) { await batch(ops); insertedBlok += ops.length }
  }

  if (insertedBlok === 0 && insertedBab === 0) return { error: `Juz ${payload.juz} sudah ada di paket ini.` }
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'create',
    fiturHref: FITUR, logKind: 'create', entityType: 'hafalan_quran_juz', entityLabel: `Juz ${payload.juz}`,
    summary: `Menambahkan Juz ${payload.juz}: ${insertedBab} surat, ${insertedBlok} ayat`,
    details: { paket_id: scope.paket.id, juz: payload.juz },
  })
  revalidatePath(FITUR)
  return { success: true, insertedBab, insertedBlok }
}

export async function tambahHafalanBlok(payload: { babId: number; label: string; deskripsi?: string; ref?: string; urutan: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const label = String(payload.label || '').trim()
  if (!label) return { error: 'Label blok wajib diisi.' }
  const bab = await queryOne<{ id: number; jenis: string }>('SELECT id, jenis FROM hafalan_bab WHERE id = ?', [payload.babId])
  if (!bab) return { error: 'Bab tidak ditemukan.' }

  await execute(
    'INSERT INTO hafalan_blok (bab_id, label, deskripsi, ref, urutan) VALUES (?, ?, ?, ?, ?)',
    [payload.babId, label, String(payload.deskripsi || '').trim() || null, String(payload.ref || '').trim() || null, Number(payload.urutan || 0)]
  )
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'create',
    fiturHref: FITUR, logKind: 'create', entityType: 'hafalan_blok', entityLabel: label,
    summary: `Menambahkan blok hafalan ${label}`, details: { bab_id: payload.babId },
  })
  revalidatePath(FITUR)
  return { success: true }
}

export async function updateHafalanBlok(payload: { blokId: number; label: string; deskripsi?: string; ref?: string; urutan: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const label = String(payload.label || '').trim()
  if (!label) return { error: 'Label blok wajib diisi.' }
  await execute(
    "UPDATE hafalan_blok SET label = ?, deskripsi = ?, ref = ?, urutan = ?, updated_at = datetime('now') WHERE id = ?",
    [label, String(payload.deskripsi || '').trim() || null, String(payload.ref || '').trim() || null, Number(payload.urutan || 0), payload.blokId]
  )
  revalidatePath(FITUR)
  return { success: true }
}

export async function deleteHafalanBlok(payload: { blokId: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  await execute('DELETE FROM hafalan_progress WHERE blok_id = ?', [payload.blokId])
  await execute('DELETE FROM hafalan_blok WHERE id = ?', [payload.blokId])
  revalidatePath(FITUR)
  return { success: true }
}

export async function setHafalanActive(target: 'bab' | 'blok', id: number, active: boolean) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const table = target === 'bab' ? 'hafalan_bab' : 'hafalan_blok'
  await execute(`UPDATE ${table} SET is_active = ?, updated_at = datetime('now') WHERE id = ?`, [active ? 1 : 0, id])
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'update',
    fiturHref: FITUR, logKind: 'update', entityType: table, entityId: String(id),
    summary: `${active ? 'Mengaktifkan' : 'Menonaktifkan'} ${target} hafalan`,
  })
  revalidatePath(FITUR)
  return { success: true }
}

export async function clearPaketMateri(payload: { paketId: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const paket = await getPaketScope(payload.paketId)
  if (!paket) return { error: 'Paket hafalan tidak ditemukan.' }

  const babRows = await query<{ id: number }>('SELECT id FROM hafalan_bab WHERE paket_id = ?', [payload.paketId])
  const babIds = babRows.map(r => r.id)
  if (babIds.length === 0) return { error: 'Paket ini belum punya materi.' }
  const ph = babIds.map(() => '?').join(',')
  const blokRows = await query<{ id: number }>(`SELECT id FROM hafalan_blok WHERE bab_id IN (${ph})`, babIds)
  const blokIds = blokRows.map(r => r.id)
  if (blokIds.length) {
    const bph = blokIds.map(() => '?').join(',')
    await execute(`DELETE FROM hafalan_progress WHERE blok_id IN (${bph})`, blokIds)
  }
  await execute(`DELETE FROM hafalan_bab WHERE id IN (${ph})`, babIds)

  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'delete',
    fiturHref: FITUR, logKind: 'delete', entityType: 'hafalan_bab_batch', entityLabel: paket.nama,
    summary: `Mengosongkan materi paket ${paket.nama}: ${babIds.length} bab, ${blokIds.length} blok`,
  })
  revalidatePath(FITUR)
  return { success: true, deletedBab: babIds.length, deletedBlok: blokIds.length }
}

// ── Import Excel ──────────────────────────────────────────────────────────────

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

export async function importHafalanMassal(payload: { paketId: number; rows: ImportHafalanRow[] }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const scope = await requirePaketMateri(payload.paketId)
  if ('error' in scope) return { error: scope.error }
  if (!payload.rows.length) return { error: 'Data import kosong.' }
  const jenis = scope.paket.jenis
  const paket = scope.paket
  // kitab hadits default dari nama paket; bisa di-override kolom KITAB
  const defaultKitab = hafalanSlug(paket.nama) || 'kitab'

  const existingBabRows = await query<{ id: number; judul: string }>(
    'SELECT id, judul FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND parent_id IS NULL',
    [jenis, paket.id]
  )
  const babMap = new Map(existingBabRows.map(row => [row.judul.toLowerCase().trim(), row.id]))
  const childBabRows = await query<{ id: number; judul: string; parent_id: number | null }>(
    'SELECT id, judul, parent_id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND parent_id IS NOT NULL',
    [jenis, paket.id]
  )
  const childBabMap = new Map(childBabRows.map(row => [`${row.parent_id}:${row.judul.toLowerCase().trim()}`, row.id]))
  const blockRows = await query<{ bab_id: number; label: string }>(`
    SELECT hblk.bab_id, hblk.label
    FROM hafalan_blok hblk
    JOIN hafalan_bab hb ON hb.id = hblk.bab_id
    WHERE hb.jenis = ? AND hb.paket_id = ?
  `, [jenis, paket.id])
  const blockKeys = new Set(blockRows.map(row => `${row.bab_id}:${row.label.toLowerCase().trim()}`))

  let insertedBab = 0
  let insertedBlok = 0
  let skipped = 0
  const blockOps: { sql: string; params: any[] }[] = []
  const pushBlok = (babId: number, label: string, deskripsi: string | null, ref: string | null, urutan: number) => {
    blockOps.push({
      sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, ref, urutan) VALUES (?, ?, ?, ?, ?)',
      params: [babId, label, deskripsi, ref, urutan],
    })
  }

  for (const row of payload.rows) {
    const bagian = cell(row, ['BAGIAN', 'Bagian', 'bagian'])
    const explicitBab = cell(row, ['BAB', 'Bab', 'bab', 'JUDUL BAB', 'Judul Bab', 'judul_bab', 'NAMA BAB (ARAB)', 'Nama Bab (Arab)', 'nama bab (arab)', 'NAMA BAB', 'Nama Bab'])
    const judulBab = jenis === 'amtsilah' ? (bagian || explicitBab) : explicitBab
    const labelBlok = cell(row, ['BLOK', 'Blok', 'blok', 'LABEL BLOK', 'Label Blok', 'label_blok'])
    const wazan = cell(row, ['WAZAN', 'Wazan', 'wazan'])
    const deskripsi = cell(row, ['DESKRIPSI', 'Deskripsi', 'deskripsi', 'KETERANGAN', 'Keterangan'])
    const refKolom = cell(row, ['REF', 'Ref', 'ref'])
    const kitab = hafalanSlug(cell(row, ['KITAB', 'Kitab', 'kitab'])) || defaultKitab
    const urutanBab = Number(cell(row, ['URUTAN BAB', 'Urutan Bab', 'urutan_bab', 'URUTAN']) || 0)
    const urutanBlok = Number(cell(row, ['URUTAN BLOK', 'Urutan Blok', 'urutan_blok']) || 0)
    const rangeValue = cell(row, ['BAIT KE-', 'Bait Ke-', 'bait ke-', 'BAIT KE', 'Bait Ke', 'bait_ke', 'HADITS KE-', 'Hadits Ke-', 'hadits ke-', 'HADITS KE', 'Hadits Ke', 'hadits_ke'])
    const jumlahRange = Number(cell(row, ['JUMLAH BAIT', 'Jumlah Bait', 'jumlah bait', 'jumlah_bait', 'JUMLAH HADITS', 'Jumlah Hadits', 'jumlah hadits', 'jumlah_hadits']) || 0)
    const isRangeImport = jenis === 'alfiyah' || jenis === 'hadits'
    const parsedRangeImport = isRangeImport && rangeValue ? parseRange(rangeValue) : null
    const isJurumiyahSimple = jenis === 'jurumiyah' && judulBab && !labelBlok

    if (!judulBab) { skipped += 1; continue }

    const babKey = judulBab.toLowerCase().trim()
    let babId = babMap.get(babKey)
    if (!babId) {
      await execute(
        'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
        [jenis, paket.marhalah_id, paket.id, judulBab, Number.isFinite(urutanBab) && urutanBab > 0 ? urutanBab : parsedRangeImport?.start || 0]
      )
      const inserted = await queryOne<{ id: number }>(
        'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
        [jenis, paket.id, judulBab]
      )
      if (!inserted) { skipped += 1; continue }
      babId = inserted.id
      babMap.set(babKey, babId)
      insertedBab += 1
    }

    if (jenis === 'amtsilah') {
      const blockLabel = wazan || labelBlok
      if (!blockLabel) { skipped += 1; continue }
      let targetBabId: number = babId
      if (bagian && explicitBab) {
        const childKey = `${babId}:${explicitBab.toLowerCase().trim()}`
        targetBabId = childBabMap.get(childKey) || 0
        if (!targetBabId) {
          await execute(
            'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, parent_id, judul, urutan) VALUES (?, ?, ?, ?, ?, ?)',
            [jenis, paket.marhalah_id, paket.id, babId, explicitBab, Number.isFinite(urutanBab) && urutanBab > 0 ? urutanBab : 0]
          )
          const child = await queryOne<{ id: number }>(
            'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND parent_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
            [jenis, paket.id, babId, explicitBab]
          )
          if (!child) { skipped += 1; continue }
          targetBabId = child.id
          childBabMap.set(childKey, targetBabId)
          insertedBab += 1
        }
      }
      const blockKey = `${targetBabId}:${blockLabel.toLowerCase().trim()}`
      if (blockKeys.has(blockKey)) { skipped += 1; continue }
      const ref = refKolom || `amtsilah:${hafalanSlug(blockLabel)}`
      pushBlok(targetBabId, blockLabel, deskripsi || null, ref, Number.isFinite(urutanBlok) ? urutanBlok : 0)
      blockKeys.add(blockKey)
      insertedBlok += 1
      continue
    }

    if (isJurumiyahSimple) {
      const blockKey = `${babId}:Status`.toLowerCase().trim()
      if (!blockKeys.has(blockKey)) {
        const ref = refKolom || `jurumiyah:${hafalanSlug(judulBab)}`
        pushBlok(babId, 'Status', 'Progress bab', ref, 1)
        blockKeys.add(blockKey)
        insertedBlok += 1
      }
      continue
    }

    if (isRangeImport && rangeValue) {
      const parsedRange = parsedRangeImport
      if (!parsedRange) { skipped += 1; continue }
      const count = parsedRange.end - parsedRange.start + 1
      if (Number.isFinite(jumlahRange) && jumlahRange > 0 && jumlahRange !== count) { skipped += 1; continue }
      const prefix = jenis === 'hadits' ? 'Hadits' : 'Bait'
      for (let n = parsedRange.start; n <= parsedRange.end; n += 1) {
        const blockKey = `${babId}:${prefix} ${n}`.toLowerCase().trim()
        if (blockKeys.has(blockKey)) { skipped += 1; continue }
        const ref = jenis === 'hadits' ? `hadits:${kitab}:${n}` : `alfiyah:${n}`
        pushBlok(babId, `${prefix} ${n}`, `${judulBab} ${prefix.toLowerCase()} ${n}`, ref, n)
        blockKeys.add(blockKey)
        insertedBlok += 1
      }
      continue
    }

    if (!labelBlok) { skipped += 1; continue }
    const blockKey = `${babId}:${labelBlok.toLowerCase().trim()}`
    if (blockKeys.has(blockKey)) { skipped += 1; continue }
    pushBlok(babId, labelBlok, deskripsi || null, refKolom || null, Number.isFinite(urutanBlok) ? urutanBlok : 0)
    blockKeys.add(blockKey)
    insertedBlok += 1
  }

  if (insertedBab === 0 && insertedBlok === 0) {
    return { error: `Tidak ada data baru yang diimport. ${skipped} baris dilewati.` }
  }
  if (blockOps.length > 0) await batch(blockOps)

  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'create',
    fiturHref: FITUR, logKind: 'create', entityType: 'hafalan_import', entityLabel: paket.nama,
    summary: `Import hafalan ${paket.nama}: ${insertedBab} bab, ${insertedBlok} blok`,
    details: { paket_id: paket.id, inserted_bab: insertedBab, inserted_blok: insertedBlok, skipped },
  })
  revalidatePath(FITUR)
  return { success: true, insertedBab, insertedBlok, skipped }
}
