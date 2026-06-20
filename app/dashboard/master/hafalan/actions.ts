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
import { getMatanBab, getMatanSources } from '@/lib/hafalan/text'

const FITUR = '/dashboard/master/hafalan'
const quranPaketNama = (marhalahId: number) => `__quran_m${marhalahId}`

async function requireAdmin() {
  const session = await getSession()
  if (!session || !isAdmin(session)) return null
  await ensureGuruFeatureSchema()
  return session
}

// ── Data utama: marhalah + katalog kitab + assignment ────────────────────────

export async function getMasterAssign() {
  const session = await requireAdmin()
  const quranSurahs = QURAN_SURAHS.map(s => ({ number: s.number, name: s.name, ayahCount: s.ayahCount, arabicName: getQuranSurahArabicName(s) }))
  const juz = QURAN_JUZ.map(j => ({ juz: j.juz }))
  if (!session) return { marhalah: [], catalog: [], assignments: {}, quranSurahs, juz }

  const marhalah = await getCachedMarhalahList()

  // katalog jenis non-quran yang punya matan (kitab utuh)
  const catalog = HAFALAN_TYPES
    .filter(t => t.key !== 'quran')
    .map(t => ({ jenis: t.key, label: t.label.replace('Hafalan ', ''), kitab: getMatanSources(t.key).map(s => ({ key: s.key, label: s.label })) }))
    .filter(c => c.kitab.length > 0)

  const links = await query<{ marhalah_id: number; jenis: string; nama: string; paket_id: number }>(`
    SELECT hpm.marhalah_id, hp.jenis, hp.nama, hp.id AS paket_id
    FROM hafalan_paket_marhalah hpm
    JOIN hafalan_paket hp ON hp.id = hpm.paket_id
  `)

  const quranPaketIds = links.filter(l => l.jenis === 'quran').map(l => l.paket_id)
  const quranBab = quranPaketIds.length
    ? await query<{ paket_id: number; id: number; judul: string; urutan: number; ayat: number }>(`
        SELECT hb.paket_id, hb.id, hb.judul, hb.urutan,
               (SELECT COUNT(*) FROM hafalan_blok hblk WHERE hblk.bab_id = hb.id) AS ayat
        FROM hafalan_bab hb
        WHERE hb.paket_id IN (${quranPaketIds.map(() => '?').join(',')})
        ORDER BY hb.urutan, hb.id
      `, quranPaketIds)
    : []

  const assignments: Record<number, any> = {}
  for (const m of marhalah) assignments[m.id] = { quran: { surat: [] }, kitab: {} }
  for (const link of links) {
    const a = assignments[link.marhalah_id]
    if (!a) continue
    if (link.jenis === 'quran') a.quran.paketId = link.paket_id
    else a.kitab[link.jenis] = link.nama // nama = kitab key
  }
  const babByPaket = new Map<number, any[]>()
  for (const b of quranBab) {
    if (!babByPaket.has(b.paket_id)) babByPaket.set(b.paket_id, [])
    babByPaket.get(b.paket_id)!.push({ babId: b.id, title: displayQuranSurahTitle(b.judul), urutan: b.urutan, ayat: b.ayat })
  }
  for (const m of marhalah) {
    const pid = assignments[m.id].quran.paketId
    if (pid && babByPaket.has(pid)) assignments[m.id].quran.surat = babByPaket.get(pid)
  }

  return { marhalah, catalog, assignments, quranSurahs, juz }
}

// ── Non-quran: assign / unassign kitab utuh ──────────────────────────────────

async function ensureKitabPaket(jenis: string, kitabKey: string, marhalahId: number) {
  let paket = await queryOne<{ id: number }>('SELECT id FROM hafalan_paket WHERE jenis = ? AND nama = ?', [jenis, kitabKey])
  if (!paket) {
    await execute('INSERT INTO hafalan_paket (jenis, nama) VALUES (?, ?)', [jenis, kitabKey])
    paket = await queryOne<{ id: number }>('SELECT id FROM hafalan_paket WHERE jenis = ? AND nama = ?', [jenis, kitabKey])
    if (!paket) return null
  }
  // seed isi kitab sekali (kalau masih kosong)
  const count = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM hafalan_bab WHERE paket_id = ?', [paket.id])
  if ((count?.n || 0) === 0) {
    const matan = getMatanBab(jenis, kitabKey)
    for (const bab of matan) {
      await execute(
        'INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
        [jenis, marhalahId, paket.id, bab.nama, bab.urutan]
      )
      const row = await queryOne<{ id: number }>(
        'SELECT id FROM hafalan_bab WHERE paket_id = ? AND judul = ? ORDER BY id DESC LIMIT 1',
        [paket.id, bab.nama]
      )
      if (row && bab.segmen.length) {
        await batch(bab.segmen.map(seg => ({
          sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, ref, urutan) VALUES (?, ?, ?, ?, ?)',
          params: [row.id, seg.label || String(seg.n), null, seg.ref, seg.n],
        })))
      }
    }
  }
  return paket
}

export async function assignKitabToMarhalah(payload: { marhalahId: number; jenis: string; kitabKey: string }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  if (!isHafalanType(payload.jenis) || payload.jenis === 'quran') return { error: 'Jenis tidak valid.' }
  const sources = getMatanSources(payload.jenis)
  const kitab = sources.find(s => s.key === payload.kitabKey)
  if (!kitab) return { error: 'Kitab tidak ditemukan.' }

  const paket = await ensureKitabPaket(payload.jenis, payload.kitabKey, payload.marhalahId)
  if (!paket) return { error: 'Gagal menyiapkan kitab.' }

  await execute(`
    INSERT INTO hafalan_paket_marhalah (paket_id, marhalah_id, jenis)
    VALUES (?, ?, ?)
    ON CONFLICT(jenis, marhalah_id) DO UPDATE SET paket_id = excluded.paket_id
  `, [paket.id, payload.marhalahId, payload.jenis])

  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'update',
    fiturHref: FITUR, logKind: 'update', entityType: 'hafalan_assign', entityId: `${payload.marhalahId}:${payload.jenis}`,
    entityLabel: kitab.label, summary: `Assign ${kitab.label} ke marhalah`,
    details: payload,
  })
  revalidatePath(FITUR)
  return { success: true }
}

export async function unassignJenisFromMarhalah(payload: { marhalahId: number; jenis: string }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  await execute('DELETE FROM hafalan_paket_marhalah WHERE marhalah_id = ? AND jenis = ?', [payload.marhalahId, payload.jenis])
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'delete',
    fiturHref: FITUR, logKind: 'delete', entityType: 'hafalan_unassign', entityId: `${payload.marhalahId}:${payload.jenis}`,
    summary: `Lepas assign ${payload.jenis} dari marhalah`,
  })
  revalidatePath(FITUR)
  return { success: true }
}

// ── Qur'an: assign surat / juz per marhalah ──────────────────────────────────

async function ensureQuranPaket(marhalahId: number) {
  const nama = quranPaketNama(marhalahId)
  let paket = await queryOne<{ id: number }>('SELECT id FROM hafalan_paket WHERE jenis = ? AND nama = ?', ['quran', nama])
  if (!paket) {
    await execute('INSERT INTO hafalan_paket (jenis, nama) VALUES (?, ?)', ['quran', nama])
    paket = await queryOne<{ id: number }>('SELECT id FROM hafalan_paket WHERE jenis = ? AND nama = ?', ['quran', nama])
    if (!paket) return null
  }
  await execute(`
    INSERT INTO hafalan_paket_marhalah (paket_id, marhalah_id, jenis)
    VALUES (?, ?, 'quran')
    ON CONFLICT(jenis, marhalah_id) DO UPDATE SET paket_id = excluded.paket_id
  `, [paket.id, marhalahId])
  return paket
}

export async function addSurahToMarhalah(payload: { marhalahId: number; surahNumber: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const surah = QURAN_SURAHS.find(s => s.number === Number(payload.surahNumber))
  if (!surah) return { error: 'Surat tidak valid.' }
  const paket = await ensureQuranPaket(payload.marhalahId)
  if (!paket) return { error: 'Gagal menyiapkan Qur\'an.' }
  const title = getQuranSurahArabicName(surah)

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND judul IN (?, ?) LIMIT 1',
    ['quran', paket.id, surah.name, title]
  )
  if (existing) return { error: 'Surat ini sudah di-assign.' }

  await execute('INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)',
    ['quran', payload.marhalahId, paket.id, title, surah.number])
  const bab = await queryOne<{ id: number }>('SELECT id FROM hafalan_bab WHERE paket_id = ? AND judul = ? ORDER BY id DESC LIMIT 1', [paket.id, title])
  if (!bab) return { error: 'Gagal membuat surat.' }
  await batch(Array.from({ length: surah.ayahCount }, (_, i) => ({
    sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, ref, urutan) VALUES (?, ?, ?, ?, ?)',
    params: [bab.id, `Ayat ${i + 1}`, `${title}:${i + 1}`, `quran:${surah.number}:${i + 1}`, i + 1],
  })))

  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'create',
    fiturHref: FITUR, logKind: 'create', entityType: 'hafalan_quran_surat', entityId: String(bab.id),
    entityLabel: title, summary: `Assign surat ${title} (${surah.ayahCount} ayat)`, details: payload,
  })
  revalidatePath(FITUR)
  return { success: true, count: surah.ayahCount }
}

export async function addJuzToMarhalah(payload: { marhalahId: number; juz: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const range = QURAN_JUZ.find(j => j.juz === Number(payload.juz))
  if (!range) return { error: 'Juz tidak valid.' }
  const paket = await ensureQuranPaket(payload.marhalahId)
  if (!paket) return { error: 'Gagal menyiapkan Qur\'an.' }

  let insertedBab = 0, insertedBlok = 0
  for (let s = range.startSurah; s <= range.endSurah; s += 1) {
    const surah = QURAN_SURAHS.find(item => item.number === s)
    if (!surah) continue
    const aStart = s === range.startSurah ? range.startAyah : 1
    const aEnd = s === range.endSurah ? range.endAyah : surah.ayahCount
    const title = getQuranSurahArabicName(surah)
    let bab = await queryOne<{ id: number }>('SELECT id FROM hafalan_bab WHERE jenis = ? AND paket_id = ? AND judul IN (?, ?) LIMIT 1', ['quran', paket.id, surah.name, title])
    if (!bab) {
      await execute('INSERT INTO hafalan_bab (jenis, marhalah_id, paket_id, judul, urutan) VALUES (?, ?, ?, ?, ?)', ['quran', payload.marhalahId, paket.id, title, s])
      bab = await queryOne<{ id: number }>('SELECT id FROM hafalan_bab WHERE paket_id = ? AND judul = ? ORDER BY id DESC LIMIT 1', [paket.id, title])
      if (!bab) continue
      insertedBab += 1
    }
    const existing = await query<{ urutan: number }>('SELECT urutan FROM hafalan_blok WHERE bab_id = ?', [bab.id])
    const seen = new Set(existing.map(r => Number(r.urutan)))
    const ops: { sql: string; params: any[] }[] = []
    for (let a = aStart; a <= aEnd; a += 1) {
      if (seen.has(a)) continue
      ops.push({ sql: 'INSERT INTO hafalan_blok (bab_id, label, deskripsi, ref, urutan) VALUES (?, ?, ?, ?, ?)', params: [bab.id, `Ayat ${a}`, `${title}:${a}`, `quran:${s}:${a}`, a] })
    }
    if (ops.length) { await batch(ops); insertedBlok += ops.length }
  }
  if (insertedBab === 0 && insertedBlok === 0) return { error: `Juz ${payload.juz} sudah di-assign.` }
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'create',
    fiturHref: FITUR, logKind: 'create', entityType: 'hafalan_quran_juz', entityLabel: `Juz ${payload.juz}`,
    summary: `Assign Juz ${payload.juz}: ${insertedBab} surat, ${insertedBlok} ayat`, details: payload,
  })
  revalidatePath(FITUR)
  return { success: true, insertedBab, insertedBlok }
}

/**
 * Hapus residu lama: paket yang tidak mengikuti konvensi baru
 * (quran: __quran_m<id>, non-quran: nama = key kitab) + bab yatim (paket_id NULL).
 */
export async function bersihkanResiduHafalan() {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }

  const validNonQuran = new Set<string>()
  for (const t of HAFALAN_TYPES) {
    if (t.key === 'quran') continue
    for (const s of getMatanSources(t.key)) validNonQuran.add(`${t.key}:${s.key}`)
  }

  const pakets = await query<{ id: number; jenis: string; nama: string }>('SELECT id, jenis, nama FROM hafalan_paket')
  const residuePaketIds = pakets
    .filter(p => p.jenis === 'quran' ? !/^__quran_m\d+$/.test(p.nama) : !validNonQuran.has(`${p.jenis}:${p.nama}`))
    .map(p => p.id)

  // kumpulkan bab residu: milik paket residu + bab yatim (paket_id NULL)
  const babIds = new Set<number>()
  if (residuePaketIds.length) {
    const rows = await query<{ id: number }>(`SELECT id FROM hafalan_bab WHERE paket_id IN (${residuePaketIds.map(() => '?').join(',')})`, residuePaketIds)
    rows.forEach(r => babIds.add(r.id))
  }
  const orphan = await query<{ id: number }>('SELECT id FROM hafalan_bab WHERE paket_id IS NULL')
  orphan.forEach(r => babIds.add(r.id))

  const babList = Array.from(babIds)
  let deletedBlok = 0
  if (babList.length) {
    const ph = babList.map(() => '?').join(',')
    const blok = await query<{ id: number }>(`SELECT id FROM hafalan_blok WHERE bab_id IN (${ph})`, babList)
    const blokIds = blok.map(b => b.id)
    deletedBlok = blokIds.length
    if (blokIds.length) {
      const bph = blokIds.map(() => '?').join(',')
      await execute(`DELETE FROM hafalan_progress WHERE blok_id IN (${bph})`, blokIds)
    }
    await execute(`DELETE FROM hafalan_bab WHERE id IN (${ph})`, babList)
  }
  if (residuePaketIds.length) {
    const ph = residuePaketIds.map(() => '?').join(',')
    await execute(`DELETE FROM hafalan_paket_marhalah WHERE paket_id IN (${ph})`, residuePaketIds)
    await execute(`DELETE FROM hafalan_paket WHERE id IN (${ph})`, residuePaketIds)
  }

  if (residuePaketIds.length === 0 && babList.length === 0) {
    return { success: true, deletedPaket: 0, deletedBab: 0, deletedBlok: 0, clean: true }
  }
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'delete',
    fiturHref: FITUR, logKind: 'delete', entityType: 'hafalan_residu', entityLabel: 'Bersihkan residu',
    summary: `Bersihkan residu: ${residuePaketIds.length} paket, ${babList.length} bab, ${deletedBlok} blok`,
  })
  revalidatePath(FITUR)
  return { success: true, deletedPaket: residuePaketIds.length, deletedBab: babList.length, deletedBlok }
}

export async function removeQuranSurah(payload: { babId: number }) {
  const session = await requireAdmin()
  if (!session) return { error: 'Akses ditolak.' }
  const blok = await query<{ id: number }>('SELECT id FROM hafalan_blok WHERE bab_id = ?', [payload.babId])
  const ids = blok.map(b => b.id)
  if (ids.length) await execute(`DELETE FROM hafalan_progress WHERE blok_id IN (${ids.map(() => '?').join(',')})`, ids)
  await execute('DELETE FROM hafalan_bab WHERE id = ?', [payload.babId])
  await logActivity({
    actor: actorFromSession(session), module: 'master_hafalan', action: 'delete',
    fiturHref: FITUR, logKind: 'delete', entityType: 'hafalan_quran_surat', entityId: String(payload.babId),
    summary: 'Lepas surat Qur\'an dari marhalah',
  })
  revalidatePath(FITUR)
  return { success: true }
}
