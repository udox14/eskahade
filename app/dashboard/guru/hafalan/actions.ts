'use server'

import { revalidatePath } from 'next/cache'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSession } from '@/lib/auth/session'
import { execute, generateId, query, queryOne } from '@/lib/db'
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
  const placeholders = santriIds.map(() => '?').join(',')
  const progressRows = await query<{ blok_id: number; santri_id: string; status: string; marhalah_id: number | null; highlight: string | null }>(`
    SELECT hp.blok_id, hp.santri_id, hp.status, hp.marhalah_id, hp.highlight
    FROM hafalan_progress hp
    JOIN hafalan_blok hblk ON hblk.id = hp.blok_id
    JOIN hafalan_bab hb ON hb.id = hblk.bab_id
    WHERE hb.jenis = ?
      AND hp.santri_id IN (${placeholders})
  `, [jenis, ...santriIds])

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

export async function toggleHafalanProgress(payload: { kelasId: string; jenis: string; riwayatId: string; blokId: number }) {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!(await canAccessKelas(session, payload.kelasId))) return { error: 'Akses kelas ditolak.' }
  if (!isHafalanType(payload.jenis)) return { error: 'Jenis hafalan tidak valid.' }
  await ensureGuruFeatureSchema()

  const valid = await queryOne<{ id: number; santri_id: string; marhalah_id: number | null }>(`
    SELECT hblk.id, rp.santri_id, k.marhalah_id
    FROM hafalan_blok hblk
    JOIN hafalan_bab hb ON hb.id = hblk.bab_id
    JOIN hafalan_paket_marhalah hpm ON hpm.paket_id = hb.paket_id AND hpm.jenis = hb.jenis
    JOIN kelas k ON k.marhalah_id = hpm.marhalah_id
    JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.id = ?
    WHERE k.id = ?
      AND hblk.id = ?
      AND hb.jenis = ?
      AND hb.is_active = 1
      AND hblk.is_active = 1
  `, [payload.riwayatId, payload.kelasId, payload.blokId, payload.jenis])
  if (!valid) return { error: 'Blok hafalan tidak tersedia untuk kelas ini.' }

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM hafalan_progress WHERE blok_id = ? AND santri_id = ? AND marhalah_id = ? AND status = 'hafal'",
    [payload.blokId, valid.santri_id, valid.marhalah_id]
  )

  if (existing) {
    await execute('DELETE FROM hafalan_progress WHERE id = ?', [existing.id])
  } else {
    await execute(`
      INSERT INTO hafalan_progress (id, blok_id, riwayat_pendidikan_id, santri_id, kelas_id, marhalah_id, guru_id, status, tanggal_setor, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'hafal', date('now'), ?, datetime('now'))
    `, [generateId(), payload.blokId, payload.riwayatId, valid.santri_id, payload.kelasId, valid.marhalah_id, await getGuruIdForSession(session), session.id])
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'guru_hafalan',
    action: existing ? 'delete' : 'update',
    fiturHref: '/dashboard/guru/hafalan',
    logKind: 'update',
    entityType: 'hafalan_progress',
    entityId: `${payload.riwayatId}:${payload.blokId}`,
    summary: existing ? 'Membatalkan blok hafalan santri' : 'Menandai blok hafalan santri',
    details: { kelas_id: payload.kelasId, jenis: payload.jenis, blok_id: payload.blokId },
  })

  revalidatePath('/dashboard/guru/hafalan')
  return { success: true, checked: !existing }
}

export async function simpanHafalanProgressBatch(payload: {
  kelasId: string
  jenis: string
  riwayatId: string
  checkedBlokIds: number[]
  statusByBlokId?: Record<string, string>
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
  const checkedIds = Array.from(new Set((payload.checkedBlokIds || []).map(Number).filter(id => validIds.has(id))))
  const guruId = await getGuruIdForSession(session)
  if (validIds.size === 0) return { error: 'Belum ada blok hafalan aktif untuk kelas ini.' }
  const scope = validRows[0]
  if (!scope?.santri_id || !scope.marhalah_id) return { error: 'Data santri atau marhalah tidak valid.' }

  const validPlaceholders = Array.from(validIds).map(() => '?').join(',')
  await execute(
    `DELETE FROM hafalan_progress
     WHERE santri_id = ?
       AND marhalah_id = ?
       AND blok_id IN (${validPlaceholders})`,
    [scope.santri_id, scope.marhalah_id, ...Array.from(validIds)]
  )

  for (const blokId of checkedIds) {
    const existingAnyScope = await queryOne<{ id: string; marhalah_id: number | null }>(
      'SELECT id, marhalah_id FROM hafalan_progress WHERE blok_id = ? AND santri_id = ? LIMIT 1',
      [blokId, scope.santri_id]
    )
    if (existingAnyScope && existingAnyScope.marhalah_id !== scope.marhalah_id) {
      continue
    }
    const requestedStatus = payload.statusByBlokId?.[String(blokId)]
    const status = requestedStatus === 'proses' ? 'proses' : 'hafal'
    await execute(`
      INSERT INTO hafalan_progress (id, blok_id, riwayat_pendidikan_id, santri_id, kelas_id, marhalah_id, guru_id, status, tanggal_setor, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'), ?, datetime('now'))
    `, [generateId(), blokId, payload.riwayatId, scope.santri_id, payload.kelasId, scope.marhalah_id, guruId, status, session.id])
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'guru_hafalan',
    action: 'update',
    fiturHref: '/dashboard/guru/hafalan',
    logKind: 'update',
    entityType: 'hafalan_progress_batch',
    entityId: `${payload.riwayatId}:${payload.jenis}`,
    summary: `Menyimpan hafalan ${payload.jenis} untuk ${checkedIds.length} blok`,
    details: { kelas_id: payload.kelasId, jenis: payload.jenis, total_blok: checkedIds.length },
  })

  revalidatePath('/dashboard/guru/hafalan')
  return { success: true, checkedBlokIds: checkedIds }
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

  // hapus progress highlight marhalah ini untuk blok valid, lalu tulis ulang
  const ph = Array.from(validIds).map(() => '?').join(',')
  await execute(
    `DELETE FROM hafalan_progress WHERE santri_id = ? AND marhalah_id = ? AND blok_id IN (${ph})`,
    [scope.santri_id, scope.marhalah_id, ...Array.from(validIds)]
  )

  let saved = 0
  for (const item of payload.perBlok) {
    const blokId = Number(item.blokId)
    if (!validIds.has(blokId)) continue
    const words = Array.from(new Set((item.words || []).map(Number).filter(Number.isFinite))).sort((a, b) => a - b)
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
    details: { kelas_id: payload.kelasId, jenis: payload.jenis, blok: saved },
  })
  revalidatePath('/dashboard/guru/hafalan')
  return { success: true, saved }
}
