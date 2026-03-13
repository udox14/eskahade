'use server'

import { query, queryOne, execute, batch, getDB } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const REVALIDATE = '/dashboard/asrama/perpindahan-kamar'

// ─── GET: Load semua data yang dibutuhkan untuk satu asrama ──────────────────

export async function getDataPerpindahan(asrama: string) {
  const [configs, drafts, ketuaList, santriList] = await Promise.all([
    // Konfigurasi kamar
    query<any>('SELECT * FROM kamar_config WHERE asrama = ? ORDER BY CAST(nomor_kamar AS INTEGER), nomor_kamar', [asrama]),

    // Draft perpindahan
    query<any>('SELECT * FROM kamar_draft WHERE asrama = ?', [asrama]),

    // Ketua kamar
    query<any>(`
      SELECT kk.*, s.nama_lengkap, s.nis
      FROM kamar_ketua kk
      JOIN santri s ON s.id = kk.santri_id
      WHERE kk.asrama = ?
    `, [asrama]),

    // Santri aktif di asrama ini
    query<any>(`
      SELECT s.id, s.nama_lengkap, s.nis, s.jenis_kelamin,
             s.kamar AS kamar_asli, s.sekolah, s.kelas_sekolah,
             m.nama AS marhalah_nama, k.nama_kelas
      FROM santri s
      LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      LEFT JOIN kelas k ON k.id = rp.kelas_id
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
      WHERE s.status_global = 'aktif' AND s.asrama = ?
      ORDER BY s.kelas_sekolah, s.nama_lengkap
    `, [asrama]),
  ])

  return { configs, drafts, ketuaList, santriList }
}

// ─── SETUP KAMAR: Simpan konfigurasi kamar ───────────────────────────────────

export async function simpanKonfigurasiKamar(
  asrama: string,
  kamarList: { nomor_kamar: string; kuota: number }[]
) {
  const session = await getSession()
  if (!session || !['admin', 'pengurus_asrama'].includes(session.role)) return { error: 'Unauthorized' }

  const db = await getDB()
  try {
    // Hapus config lama, insert baru
    const stmts = [
      db.prepare('DELETE FROM kamar_config WHERE asrama = ?').bind(asrama),
      ...kamarList.map(k =>
        db.prepare('INSERT INTO kamar_config (asrama, nomor_kamar, kuota) VALUES (?, ?, ?)').bind(asrama, k.nomor_kamar, k.kuota)
      )
    ]
    await db.batch(stmts)
    revalidatePath(REVALIDATE)
    return { success: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ─── GENERATE DRAFT: Auto-distribusi santri ──────────────────────────────────

export async function generateDraft(
  asrama: string,
  persenUntukBaru: number  // 0–100, misal 20 = 20% slot dikosongkan untuk santri baru
) {
  const session = await getSession()
  if (!session || !['admin', 'pengurus_asrama'].includes(session.role)) return { error: 'Unauthorized' }

  const { configs, santriList } = await getDataPerpindahan(asrama)
  if (!configs.length) return { error: 'Belum ada konfigurasi kamar' }
  if (!santriList.length) return { error: 'Tidak ada santri di asrama ini' }

  // Hitung slot efektif per kamar (setelah dikurangi % untuk santri baru)
  const kamarSlots = configs.map((k: any) => ({
    nomor: k.nomor_kamar,
    kuota: k.kuota,
    efektif: Math.max(1, Math.floor(k.kuota * (1 - persenUntukBaru / 100))),
  }))

  const totalSlot = kamarSlots.reduce((s: number, k: any) => s + k.efektif, 0)

  // Kelompokkan santri berdasarkan kelas_sekolah untuk distribusi proporsional
  const kelasGroups: Record<string, any[]> = {}
  for (const s of santriList) {
    const key = s.kelas_sekolah || 'BELUM_SET'
    if (!kelasGroups[key]) kelasGroups[key] = []
    kelasGroups[key].push(s)
  }

  // Shuffle dalam setiap kelompok, lalu interleave agar kamar dapat campuran kelas
  const shuffled: any[] = []
  const groupKeys = Object.keys(kelasGroups).sort()
  const maxLen = Math.max(...groupKeys.map(k => kelasGroups[k].length))
  for (let i = 0; i < maxLen; i++) {
    for (const key of groupKeys) {
      if (kelasGroups[key][i]) shuffled.push(kelasGroups[key][i])
    }
  }

  // Distribusikan ke kamar secara round-robin berdasarkan slot efektif
  const assignment: Record<string, string> = {}  // santri_id -> kamar_baru
  let idx = 0
  for (const kamar of kamarSlots) {
    for (let slot = 0; slot < kamar.efektif && idx < shuffled.length; slot++, idx++) {
      assignment[shuffled[idx].id] = kamar.nomor
    }
  }

  // Santri yang tidak tertampung (melebihi total slot efektif) → tetap di kamar lama atau kamar pertama
  for (let i = idx; i < shuffled.length; i++) {
    const s = shuffled[i]
    // Taruh di kamar dengan isi paling sedikit (over capacity)
    const counts: Record<string, number> = {}
    for (const v of Object.values(assignment)) counts[v] = (counts[v] || 0) + 1
    const kamarTersedikit = kamarSlots.reduce((min: any, k: any) =>
      (counts[k.nomor] || 0) < (counts[min.nomor] || 0) ? k : min
    , kamarSlots[0])
    assignment[s.id] = kamarTersedikit.nomor
  }

  // Simpan ke kamar_draft (upsert)
  const db = await getDB()
  try {
    const stmts = [
      db.prepare('DELETE FROM kamar_draft WHERE asrama = ?').bind(asrama),
      ...shuffled.map(s =>
        db.prepare(`
          INSERT INTO kamar_draft (asrama, santri_id, kamar_lama, kamar_baru, applied)
          VALUES (?, ?, ?, ?, 0)
        `).bind(asrama, s.id, s.kamar_asli || null, assignment[s.id] || kamarSlots[0].nomor)
      )
    ]
    // Batch max 100
    for (let i = 0; i < stmts.length; i += 100) {
      await db.batch(stmts.slice(i, i + 100))
    }
    revalidatePath(REVALIDATE)
    return { success: true, total: shuffled.length }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ─── UPDATE DRAFT: Pindahkan satu santri ke kamar lain ───────────────────────

export async function updateKamarDraft(asrama: string, santriId: string, kamarBaru: string) {
  const session = await getSession()
  if (!session || !['admin', 'pengurus_asrama'].includes(session.role)) return { error: 'Unauthorized' }

  await execute(
    `UPDATE kamar_draft SET kamar_baru = ? WHERE asrama = ? AND santri_id = ?`,
    [kamarBaru, asrama, santriId]
  )
  revalidatePath(REVALIDATE)
  return { success: true }
}

// ─── APPLY DRAFT: Update kolom kamar di tabel santri ─────────────────────────

export async function applyDraft(asrama: string) {
  const session = await getSession()
  if (!session || !['admin', 'pengurus_asrama'].includes(session.role)) return { error: 'Unauthorized' }

  const drafts = await query<any>('SELECT * FROM kamar_draft WHERE asrama = ?', [asrama])
  if (!drafts.length) return { error: 'Tidak ada draft untuk diapply' }

  const db = await getDB()
  try {
    const updateStmts = drafts.map((d: any) =>
      db.prepare(`UPDATE santri SET kamar = ? WHERE id = ?`).bind(d.kamar_baru, d.santri_id)
    )
    const markStmts = [
      db.prepare(`UPDATE kamar_draft SET applied = 1 WHERE asrama = ?`).bind(asrama)
    ]
    for (let i = 0; i < updateStmts.length; i += 100) {
      await db.batch(updateStmts.slice(i, i + 100))
    }
    await db.batch(markStmts)
    revalidatePath(REVALIDATE)
    return { success: true, count: drafts.length }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ─── KETUA KAMAR: Set/unset ketua ────────────────────────────────────────────

export async function setKetuaKamar(asrama: string, nomor_kamar: string, santri_id: string | null) {
  const session = await getSession()
  if (!session || !['admin', 'pengurus_asrama'].includes(session.role)) return { error: 'Unauthorized' }

  if (!santri_id) {
    await execute('DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar = ?', [asrama, nomor_kamar])
  } else {
    await execute(`
      INSERT INTO kamar_ketua (asrama, nomor_kamar, santri_id)
      VALUES (?, ?, ?)
      ON CONFLICT(asrama, nomor_kamar) DO UPDATE SET santri_id = excluded.santri_id
    `, [asrama, nomor_kamar, santri_id])
  }
  revalidatePath(REVALIDATE)
  return { success: true }
}

// ─── RESET DRAFT ─────────────────────────────────────────────────────────────

export async function resetDraft(asrama: string) {
  const session = await getSession()
  if (!session || !['admin', 'pengurus_asrama'].includes(session.role)) return { error: 'Unauthorized' }

  await execute('DELETE FROM kamar_draft WHERE asrama = ?', [asrama])
  revalidatePath(REVALIDATE)
  return { success: true }
}
