'use server'

import { revalidatePath } from 'next/cache'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSession } from '@/lib/auth/session'
import { batch, execute, generateId, query, queryOne } from '@/lib/db'
import {
  canAccessKelas,
  displayQuranSurahTitle,
  ensureGuruFeatureSchema,
  getAccessibleKelasForSession,
  getGuruIdForSession,
  getSantriForKelas,
  HAFALAN_TYPES,
  isHafalanType,
} from '@/lib/akademik/guru-access'
import { resolveHafalanText } from '@/lib/hafalan/text'

export async function getHafalanInitialData() {
  const session = await getSession()
  if (!session) return { kelas: [], types: HAFALAN_TYPES }
  await ensureGuruFeatureSchema()
  const kelas = await getAccessibleKelasForSession(session)
  return { kelas, types: HAFALAN_TYPES }
}

async function getHafalanPaketForKelas(kelasId: string, jenis: string) {
  const kelas = await queryOne<{ marhalah_id: number | null }>('SELECT marhalah_id FROM kelas WHERE id = ?', [kelasId])
  if (!kelas?.marhalah_id) return null

  const paket = await queryOne<{ id: number; marhalah_id: number }>(`
    SELECT hp.id, hpm.marhalah_id
    FROM hafalan_paket_marhalah hpm
    JOIN hafalan_paket hp ON hp.id = hpm.paket_id AND hp.is_active = 1
    WHERE hpm.marhalah_id = ?
      AND hpm.jenis = ?
      AND hp.jenis = ?
    LIMIT 1
  `, [kelas.marhalah_id, jenis, jenis])

  return paket ? { paketId: paket.id, marhalahId: kelas.marhalah_id } : null
}

export async function getAvailableHafalanTypes(kelasId: string) {
  const session = await getSession()
  if (!session || !(await canAccessKelas(session, kelasId))) return []
  await ensureGuruFeatureSchema()

  const kelas = await queryOne<{ marhalah_id: number | null }>('SELECT marhalah_id FROM kelas WHERE id = ?', [kelasId])
  if (!kelas?.marhalah_id) return []

  const rows = await query<{ jenis: string; total_bab: number; total_blok: number }>(`
    SELECT hp.jenis, COUNT(DISTINCT hb.id) AS total_bab, COUNT(hblk.id) AS total_blok
    FROM hafalan_paket_marhalah hpm
    JOIN hafalan_paket hp ON hp.id = hpm.paket_id AND hp.is_active = 1
    JOIN hafalan_bab hb ON hb.paket_id = hp.id AND hb.is_active = 1
    JOIN hafalan_blok hblk ON hblk.bab_id = hb.id AND hblk.is_active = 1
    WHERE hpm.marhalah_id = ?
    GROUP BY hp.jenis
  `, [kelas.marhalah_id])

  return HAFALAN_TYPES
    .map(type => {
      const row = rows.find(item => item.jenis === type.key)
      return row ? { ...type, total_bab: row.total_bab, total_blok: row.total_blok } : null
    })
    .filter(Boolean)
}

export async function getHafalanInputData(kelasId: string, jenis: string) {
  const session = await getSession()
  if (!session || !(await canAccessKelas(session, kelasId))) return { santri: [], bab: [], progress: {} }
  if (!isHafalanType(jenis)) return { santri: [], bab: [], progress: {} }
  await ensureGuruFeatureSchema()

  const paket = await getHafalanPaketForKelas(kelasId, jenis)
  if (!paket) return { santri: [], bab: [], progress: {}, progressStatus: {} }
  const kelas = await queryOne<{ marhalah_id: number; marhalah_urutan: number | null }>(`
    SELECT k.marhalah_id, m.urutan AS marhalah_urutan
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE k.id = ?
  `, [kelasId])
  if (!kelas?.marhalah_id) return { santri: [], bab: [], progress: {}, progressStatus: {} }
  const maxUrutan = kelas.marhalah_urutan ?? 999999

  const [santri, babRows] = await Promise.all([
    getSantriForKelas(kelasId),
    query<any>(`
      WITH visible_paket AS (
        SELECT hp.id AS paket_id,
               MIN(COALESCE(m.urutan, 999999)) AS paket_urutan,
               MAX(CASE WHEN hpm.marhalah_id = ? THEN 1 ELSE 0 END) AS is_editable,
               GROUP_CONCAT(m.nama, ', ') AS source_marhalah_nama
        FROM hafalan_paket_marhalah hpm
        JOIN hafalan_paket hp ON hp.id = hpm.paket_id AND hp.is_active = 1
        LEFT JOIN marhalah m ON m.id = hpm.marhalah_id
        WHERE hpm.jenis = ?
          AND hp.jenis = ?
          AND (COALESCE(m.urutan, 999999) <= ? OR hpm.marhalah_id = ?)
        GROUP BY hp.id
      )
      SELECT hb.id AS bab_id, hb.judul, hb.urutan AS bab_urutan, hb.parent_id,
             parent.judul AS parent_judul, parent.urutan AS parent_urutan,
             hblk.id AS blok_id, hblk.label, hblk.deskripsi, hblk.ref, hblk.urutan AS blok_urutan,
             vp.is_editable, vp.source_marhalah_nama, vp.paket_urutan
      FROM hafalan_bab hb
      JOIN visible_paket vp ON vp.paket_id = hb.paket_id
      LEFT JOIN hafalan_bab parent ON parent.id = hb.parent_id
      LEFT JOIN hafalan_blok hblk ON hblk.bab_id = hb.id AND hblk.is_active = 1
      WHERE hb.jenis = ? AND hb.is_active = 1
      ORDER BY vp.is_editable DESC, vp.paket_urutan, COALESCE(parent.urutan, hb.urutan), COALESCE(parent.id, hb.id), hb.urutan, hb.id, hblk.urutan, hblk.id
    `, [kelas.marhalah_id, jenis, jenis, maxUrutan, kelas.marhalah_id, jenis]),
  ])

  const babMap = new Map<number, any>()
  const editableBlokIds: number[] = []
  for (const row of babRows) {
    if (!babMap.has(row.bab_id)) {
      babMap.set(row.bab_id, {
        id: row.bab_id,
        judul: row.parent_judul
          ? `${row.parent_judul} / ${row.judul}`
          : jenis === 'quran'
            ? displayQuranSurahTitle(row.judul)
            : row.judul,
        urutan: row.bab_urutan,
        parent_id: row.parent_id,
        is_editable: row.is_editable === 1,
        source_marhalah_nama: row.source_marhalah_nama,
        blok: [],
      })
    }
    if (row.blok_id) {
      if (row.is_editable === 1) editableBlokIds.push(Number(row.blok_id))
      const teks = resolveHafalanText(row.ref)
      babMap.get(row.bab_id).blok.push({
        id: row.blok_id,
        label: row.label,
        deskripsi: row.deskripsi,
        ref: row.ref,
        teks: teks ? { arab: teks.arab, terjemah: teks.terjemah, meta: teks.meta } : null,
        urutan: row.blok_urutan,
        is_editable: row.is_editable === 1,
      })
    }
  }

  const bab = Array.from(babMap.values()).filter(item => item.blok.length > 0)
  if (santri.length === 0) return { santri, bab, progress: {}, progressStatus: {}, editableBlokIds }
  const santriIds = santri.map(row => row.santri_id)
  const riwayatBySantri = new Map(santri.map(row => [row.santri_id, row.riwayat_id]))
  // D1 batasi maksimal 100 bound param/query — IN (...) dipecah per chunk.
  const SQL_VAR_CHUNK = 90
  const progressRows: { blok_id: number; santri_id: string; status: string; marhalah_id: number | null; highlight: string | null }[] = []
  for (let i = 0; i < santriIds.length; i += SQL_VAR_CHUNK) {
    const part = santriIds.slice(i, i + SQL_VAR_CHUNK)
    const ph = part.map(() => '?').join(',')
    const rows = await query<{ blok_id: number; santri_id: string; status: string; marhalah_id: number | null; highlight: string | null }>(`
      SELECT hp.blok_id, hp.santri_id, hp.status, hp.marhalah_id, hp.highlight
      FROM hafalan_progress hp
      JOIN hafalan_blok hblk ON hblk.id = hp.blok_id
      JOIN hafalan_bab hb ON hb.id = hblk.bab_id
      WHERE hb.jenis = ?
        AND hp.santri_id IN (${ph})
    `, [jenis, ...part])
    progressRows.push(...rows)
  }

  const progress: Record<string, boolean> = {}
  const progressStatus: Record<string, string> = {}
  const progressEditable: Record<string, boolean> = {}
  // Jurumiyah: highlight kata. progressHighlight = kata marhalah ini (editable),
  // progressHighlightLocked = kata dari marhalah sebelumnya (terkunci).
  const progressHighlight: Record<string, number[]> = {}
  const progressHighlightLocked: Record<string, number[]> = {}
  const parseWords = (raw: string | null): number[] => {
    if (!raw) return []
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.map(Number).filter(Number.isFinite) : [] } catch { return [] }
  }
  for (const row of progressRows) {
    const riwayatId = riwayatBySantri.get(row.santri_id)
    if (!riwayatId) continue
    const key = `${riwayatId}:${row.blok_id}`
    progress[key] = true
    progressStatus[key] = row.status
    progressEditable[key] = !!progressEditable[key] || row.marhalah_id === kelas.marhalah_id
    const words = parseWords(row.highlight)
    if (words.length) {
      if (row.marhalah_id === kelas.marhalah_id) {
        progressHighlight[key] = Array.from(new Set([...(progressHighlight[key] || []), ...words]))
      } else {
        progressHighlightLocked[key] = Array.from(new Set([...(progressHighlightLocked[key] || []), ...words]))
      }
    }
  }
  return { santri, bab, progress, progressStatus, progressEditable, progressHighlight, progressHighlightLocked, editableBlokIds }
}

export async function simpanHafalanProgressBatch(payload: {
  kelasId: string
  jenis: string
  riwayatId: string
  changes: { blokId: number; checked: boolean; status?: string }[]
}) {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await canAccessKelas(session, payload.kelasId))) return { error: 'Akses kelas ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  await ensureGuruFeatureSchema()

  const validRows = await query<{ id: number; santri_id: string; marhalah_id: number | null }>(`
    SELECT hblk.id, rp.santri_id, k.marhalah_id
    FROM hafalan_blok hblk
    JOIN hafalan_bab hb ON hb.id = hblk.bab_id
    JOIN hafalan_paket_marhalah hpm ON hpm.paket_id = hb.paket_id AND hpm.jenis = hb.jenis
    JOIN kelas k ON k.marhalah_id = hpm.marhalah_id
    JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.id = ?
    WHERE k.id = ?
      AND hb.jenis = ?
      AND hb.is_active = 1
      AND hblk.is_active = 1
  `, [payload.riwayatId, payload.kelasId, payload.jenis])

  const validIds = new Set(validRows.map(row => Number(row.id)))
  if (validIds.size === 0) return { error: 'Belum ada blok hafalan aktif untuk kelas ini.' }
  const scope = validRows[0]
  if (!scope?.santri_id || !scope.marhalah_id) return { error: 'Data santri atau marhalah tidak valid.' }

  // Merge duplicate block IDs server-side as a final guard. The client already
  // does this with a Map, but the last state must also win if a request is
  // retried or constructed by another caller.
  const requestedChanges = new Map<number, { checked: boolean; status: string }>()
  for (const item of payload.changes || []) {
    const blokId = Number(item.blokId)
    if (!Number.isInteger(blokId) || !validIds.has(blokId)) continue
    requestedChanges.set(blokId, {
      checked: item.checked === true,
      status: item.status === 'proses' ? 'proses' : 'hafal',
    })
  }

  const changes = Array.from(requestedChanges.entries()).map(([blokId, change]) => ({ blokId, ...change }))
  const guruId = await getGuruIdForSession(session)

  // Validasi urutan hafalan (kecuali hadits: input bebas, boleh hafalkan
  // bagian mana pun dulu): sebuah blok hanya boleh ditandai hafal bila semua
  // blok sebelumnya dalam bab yang sama (urutannya lebih kecil) sudah punya
  // progres. Uncheck selalu diizinkan.
  // D1 batasi maksimal 100 bound param/query, jadi IN (...) dipecah per chunk.
  const SQL_VAR_CHUNK = 90
  const orderRows: { id: number; bab_id: number; urutan: number }[] = []
  for (let i = 0; i < Array.from(validIds).length; i += SQL_VAR_CHUNK) {
    const part = Array.from(validIds).slice(i, i + SQL_VAR_CHUNK)
    const ph = part.map(() => '?').join(',')
    const rows = await query<{ id: number; bab_id: number; urutan: number }>(`
      SELECT hblk.id, hblk.bab_id, hblk.urutan
      FROM hafalan_blok hblk
      WHERE hblk.id IN (${ph})
    `, part)
    orderRows.push(...rows)
  }
  const existingRows = await query<{ blok_id: number }>(
    'SELECT blok_id FROM hafalan_progress WHERE riwayat_pendidikan_id = ?',
    [payload.riwayatId],
  )
  const existingBloks = new Set(existingRows.map(r => Number(r.blok_id)))
  const batchChecked = new Map<number, boolean>()
  for (const change of changes) batchChecked.set(change.blokId, change.checked)
  const isChecked = (blokId: number): boolean =>
    batchChecked.has(blokId) ? batchChecked.get(blokId)! : existingBloks.has(blokId)

  const prefixReadyByBlok = new Map<number, boolean>()
  const byBab = new Map<number, { id: number; urutan: number }[]>()
  for (const row of orderRows) {
    const arr = byBab.get(row.bab_id) || []
    arr.push(row)
    byBab.set(row.bab_id, arr)
  }
  for (const arr of byBab.values()) {
    arr.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0) || (a.id ?? 0) - (b.id ?? 0))
    let allPrevChecked = true
    for (const row of arr) {
      prefixReadyByBlok.set(row.id, allPrevChecked)
      if (!isChecked(row.id)) allPrevChecked = false
    }
  }

  const skippedBlokIds: number[] = []
  const applied = changes.filter(change => {
    if (!change.checked) return true
    if (payload.jenis === 'hadits') return true
    if (prefixReadyByBlok.get(change.blokId) !== false) return true
    skippedBlokIds.push(change.blokId)
    return false
  })

  if (applied.length > 0) {
    // D1 membatasi maksimal 100 statement per batch — pecah agar guru yang
    // menandai banyak blok sekaligus (mis. target ayat quran) tetap tersimpan.
    const statements = applied.map(change => change.checked
      ? {
          sql: `
            INSERT INTO hafalan_progress (
              id, blok_id, riwayat_pendidikan_id, santri_id, kelas_id,
              marhalah_id, guru_id, status, tanggal_setor, updated_by, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'), ?, datetime('now'))
            ON CONFLICT(blok_id, riwayat_pendidikan_id) DO UPDATE SET
              santri_id = excluded.santri_id,
              kelas_id = excluded.kelas_id,
              marhalah_id = excluded.marhalah_id,
              guru_id = excluded.guru_id,
              status = excluded.status,
              tanggal_setor = excluded.tanggal_setor,
              updated_by = excluded.updated_by,
              updated_at = datetime('now')
          `,
          params: [
            generateId(), change.blokId, payload.riwayatId, scope.santri_id,
            payload.kelasId, scope.marhalah_id, guruId, change.status, session.id,
          ],
        }
      : {
          sql: `
            DELETE FROM hafalan_progress
            WHERE blok_id = ? AND riwayat_pendidikan_id = ?
          `,
          params: [change.blokId, payload.riwayatId],
        }
    )
    for (let i = 0; i < statements.length; i += SQL_VAR_CHUNK) {
      await batch(statements.slice(i, i + SQL_VAR_CHUNK))
    }
  }

  const checkedIds = applied.filter(change => change.checked).map(change => change.blokId)
  const appliedBlokIds = applied.map(change => change.blokId)

  await logActivity({
    actor: actorFromSession(session),
    module: 'guru_hafalan',
    action: 'update',
    fiturHref: '/dashboard/guru/hafalan',
    logKind: 'update',
    entityType: 'hafalan_progress_batch',
    entityId: `${payload.riwayatId}:${payload.jenis}`,
    summary: `Menyimpan hafalan ${payload.jenis} untuk ${applied.length} perubahan`,
    details: { kelas_id: payload.kelasId, jenis: payload.jenis, total_perubahan: applied.length, total_blok_hafal: checkedIds.length, dilewati_urutan: skippedBlokIds.length },
  })

  revalidatePath('/dashboard/guru/hafalan')
  return { success: true, checkedBlokIds: checkedIds, appliedBlokIds, skippedBlokIds }
}

/** Jurumiyah: simpan highlight kata per blok (1 bab = 1 blok teks utuh). */
export async function simpanHafalanHighlightBatch(payload: {
  kelasId: string
  jenis: string
  riwayatId: string
  perBlok: { blokId: number; words: number[] }[]
}) {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await canAccessKelas(session, payload.kelasId))) return { error: 'Akses kelas ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  await ensureGuruFeatureSchema()

  const validRows = await query<{ id: number; santri_id: string; marhalah_id: number | null }>(`
    SELECT hblk.id, rp.santri_id, k.marhalah_id
    FROM hafalan_blok hblk
    JOIN hafalan_bab hb ON hb.id = hblk.bab_id
    JOIN hafalan_paket_marhalah hpm ON hpm.paket_id = hb.paket_id AND hpm.jenis = hb.jenis
    JOIN kelas k ON k.marhalah_id = hpm.marhalah_id
    JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.id = ?
    WHERE k.id = ? AND hb.jenis = ? AND hb.is_active = 1 AND hblk.is_active = 1
  `, [payload.riwayatId, payload.kelasId, payload.jenis])

  const validIds = new Set(validRows.map(r => Number(r.id)))
  if (validIds.size === 0) return { error: 'Belum ada materi hafalan aktif untuk kelas ini.' }
  const scope = validRows[0]
  if (!scope?.santri_id || !scope.marhalah_id) return { error: 'Data santri atau marhalah tidak valid.' }
  const guruId = await getGuruIdForSession(session)

  const blokIds = Array.from(validIds)
  const parseWords = (raw: string | null): number[] => {
    if (!raw) return []
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.map(Number).filter(Number.isFinite) : [] } catch { return [] }
  }
  // D1 batasi maksimal 100 bound param/query — IN (...) dipecah per chunk.
  const SQL_VAR_CHUNK = 90
  const chunkedBlokIds: number[][] = []
  for (let i = 0; i < blokIds.length; i += SQL_VAR_CHUNK) chunkedBlokIds.push(blokIds.slice(i, i + SQL_VAR_CHUNK))

  const existingRows: { blok_id: number; highlight: string | null }[] = []
  const lockedRows: { blok_id: number; highlight: string | null }[] = []
  for (const part of chunkedBlokIds) {
    const ph = part.map(() => '?').join(',')
    const [ex, lk] = await Promise.all([
      query<{ blok_id: number; highlight: string | null }>(
        `SELECT blok_id, highlight FROM hafalan_progress WHERE santri_id = ? AND marhalah_id = ? AND blok_id IN (${ph})`,
        [scope.santri_id, scope.marhalah_id, ...part],
      ),
      query<{ blok_id: number; highlight: string | null }>(
        `SELECT blok_id, highlight FROM hafalan_progress WHERE santri_id = ? AND marhalah_id != ? AND blok_id IN (${ph})`,
        [scope.santri_id, scope.marhalah_id, ...part],
      ),
    ])
    existingRows.push(...ex)
    lockedRows.push(...lk)
  }
  const persistedWords = new Map<number, number[]>()
  for (const r of existingRows) persistedWords.set(Number(r.blok_id), parseWords(r.highlight))
  const lockedWordsByBlok = new Map<number, number[]>()
  for (const r of lockedRows) lockedWordsByBlok.set(Number(r.blok_id), parseWords(r.highlight))

  // Validasi urutan kata (Jurumiyah): kata boleh bertambah hanya jika
  // membentuk prefix 0..max (gabungan dengan kata terkunci marhalah
  // sebelumnya). Mengurangi / menghapus kata selalu diizinkan.
  const skippedBlokIds: number[] = []
  let saved = 0
  for (const item of payload.perBlok) {
    const blokId = Number(item.blokId)
    if (!validIds.has(blokId)) continue
    const words = Array.from(new Set((item.words || []).map(Number).filter(Number.isFinite))).sort((a, b) => a - b)
    const locked = lockedWordsByBlok.get(blokId) || []
    const union = Array.from(new Set([...words, ...locked])).sort((a, b) => a - b)
    const maxIdx = union.length ? union[union.length - 1] : -1
    const maxPersisted = Math.max(-1, ...(persistedWords.get(blokId) || []), ...locked)
    if (maxIdx > maxPersisted && (union[0] !== 0 || union.length !== maxIdx + 1)) {
      skippedBlokIds.push(blokId)
      continue
    }
    await execute('DELETE FROM hafalan_progress WHERE blok_id = ? AND riwayat_pendidikan_id = ?', [blokId, payload.riwayatId])
    if (words.length === 0) continue
    await execute(`
      INSERT INTO hafalan_progress (id, blok_id, riwayat_pendidikan_id, santri_id, kelas_id, marhalah_id, guru_id, status, highlight, tanggal_setor, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'hafal', ?, date('now'), ?, datetime('now'))
    `, [generateId(), blokId, payload.riwayatId, scope.santri_id, payload.kelasId, scope.marhalah_id, guruId, JSON.stringify(words), session.id])
    saved += 1
  }

  await logActivity({
    actor: actorFromSession(session), module: 'guru_hafalan', action: 'update',
    fiturHref: '/dashboard/guru/hafalan', logKind: 'update', entityType: 'hafalan_highlight_batch',
    entityId: `${payload.riwayatId}:${payload.jenis}`, summary: `Menyimpan highlight hafalan ${saved} bab`,
    details: { kelas_id: payload.kelasId, jenis: payload.jenis, blok: saved, dilewati_urutan: skippedBlokIds.length },
  })
  revalidatePath('/dashboard/guru/hafalan')
  return { success: true, saved, skippedBlokIds }
}
