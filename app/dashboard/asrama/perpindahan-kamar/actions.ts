'use server'

import { query, queryOne, execute, batch, getDB } from '@/lib/db'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const REVALIDATE = '/dashboard/asrama/perpindahan-kamar'

// ─── GET: Load semua data yang dibutuhkan untuk satu asrama ──────────────────

export async function getDataPerpindahan(asrama: string) {
  try {
    // Auto-patch untuk mem-fix error "has no column named blok" di DB lokal
    await execute('ALTER TABLE kamar_config ADD COLUMN blok TEXT');
  } catch (e) {
    // Abaikan error jika kolom sudah ada
  }

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
  kamarList: { nomor_kamar: string; kuota: number; blok?: string }[]
) {
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) return { error: 'Unauthorized' }

  const db = await getDB()
  try {
    // Hapus config lama, insert baru
    const stmts = [
      db.prepare('DELETE FROM kamar_config WHERE asrama = ?').bind(asrama),
      ...kamarList.map(k =>
        db.prepare('INSERT INTO kamar_config (asrama, nomor_kamar, kuota, blok) VALUES (?, ?, ?, ?)').bind(asrama, k.nomor_kamar, k.kuota, k.blok || null)
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
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) return { error: 'Unauthorized' }

  const { configs, santriList } = await getDataPerpindahan(asrama)
  if (!configs.length) return { error: 'Belum ada konfigurasi kamar' }
  if (!santriList.length) return { error: 'Tidak ada santri di asrama ini' }

  const db = await getDB()
  const kamarKetua = await query<any>('SELECT santri_id, nomor_kamar FROM kamar_ketua WHERE asrama = ?', [asrama])

  // Hitung slot efektif per kamar (setelah dikurangi % untuk santri baru)
  const kamarSlots = configs.map((k: any) => {
    const terisiKetua = kamarKetua.filter(x => x.nomor_kamar === k.nomor_kamar).length
    return {
      nomor: k.nomor_kamar,
      kuota: k.kuota,
      blok: k.blok || null,
      efektif: Math.max(0, Math.floor(k.kuota * (1 - persenUntukBaru / 100)) - terisiKetua),
    }
  })

  // Pengelompokan blok: { 'A': [kamar1,kamar2,...], null: [...] }
  const blokKamar: Record<string, typeof kamarSlots> = {}
  for (const k of kamarSlots) {
    const blokKey = k.blok || '__TANPA_BLOK__'
    if (!blokKamar[blokKey]) blokKamar[blokKey] = []
    blokKamar[blokKey].push(k)
  }

  // Helper: interleave santri per kelas → campuran proporsional
  function interleaveByKelas(list: any[]): any[] {
    const groups: Record<string, any[]> = {}
    for (const s of list) {
      const key = s.kelas_sekolah || 'BELUM_SET'
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    }
    const keys = Object.keys(groups).sort()
    const maxLen = Math.max(...keys.map(k => groups[k].length), 0)
    const result: any[] = []
    for (let i = 0; i < maxLen; i++) {
      for (const key of keys) { if (groups[key][i]) result.push(groups[key][i]) }
    }
    return result
  }

  // Helper: distribusi santri ke kamar dalam satu blok
  function distribusiBlok(santriBlok: any[], kamarBlok: typeof kamarSlots, assignment: Record<string,string>) {
    const belumAssign = santriBlok.filter(s => !assignment[s.id])
    const shuffled = interleaveByKelas(belumAssign)
    let idx = 0
    for (const kamar of kamarBlok) {
      for (let slot = 0; slot < kamar.efektif && idx < shuffled.length; slot++, idx++) {
        assignment[shuffled[idx].id] = kamar.nomor
      }
    }
    // Overflow: taruh di kamar tersedikit dalam blok ini (over capacity)
    for (let i = idx; i < shuffled.length; i++) {
      const counts: Record<string, number> = {}
      for (const [sid, nom] of Object.entries(assignment)) {
        if (kamarBlok.some(k => k.nomor === nom)) counts[nom] = (counts[nom] || 0) + 1
      }
      const min = kamarBlok.reduce((a, b) => (counts[a.nomor]||0) <= (counts[b.nomor]||0) ? a : b)
      assignment[shuffled[i].id] = min.nomor
    }
  }

  const assignment: Record<string, string> = {}

  // Assign ketua ke kamarnya masing-masing
  for (const k of kamarKetua) {
     assignment[k.santri_id] = k.nomor_kamar;
  }

  // Santri yang kamar lamanya ada di blok tertentu → ikut blok itu
  // Santri tanpa kamar / kamar tidak dikenali blok → masuk pool __TANPA_BLOK__
  const blokSantri: Record<string, any[]> = {}

  // Bangun map: nomor kamar → blok
  const kamarToBlok: Record<string, string> = {}
  for (const k of kamarSlots) { kamarToBlok[k.nomor] = k.blok || '__TANPA_BLOK__' }

  for (const s of santriList) {
    if (assignment[s.id]) continue; // lewati ketua yang sudah diassign
    const blokSantriKey = s.kamar_asli && kamarToBlok[s.kamar_asli]
      ? kamarToBlok[s.kamar_asli]
      : '__TANPA_BLOK__'
    if (!blokSantri[blokSantriKey]) blokSantri[blokSantriKey] = []
    blokSantri[blokSantriKey].push(s)
  }

  // Distribusikan per blok
  for (const [blokKey, santriBlok] of Object.entries(blokSantri)) {
    const targetKamar = blokKamar[blokKey] || kamarSlots  // fallback ke semua kamar jika blok tidak dikenali
    distribusiBlok(santriBlok, targetKamar, assignment)
  }

  // Simpan ke kamar_draft (upsert)
  try {
    const stmts = [
      db.prepare('DELETE FROM kamar_draft WHERE asrama = ?').bind(asrama),
      ...santriList.map(s =>
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
    return { success: true, total: santriList.length }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ─── UPDATE DRAFT: Pindahkan satu santri ke kamar lain ───────────────────────

export async function updateKamarDraft(asrama: string, santriId: string, kamarBaru: string) {
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) return { error: 'Unauthorized' }

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
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) return { error: 'Unauthorized' }

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
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) return { error: 'Unauthorized' }

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
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) return { error: 'Unauthorized' }

  await execute('DELETE FROM kamar_draft WHERE asrama = ?', [asrama])
  revalidatePath(REVALIDATE)
  return { success: true }
}
