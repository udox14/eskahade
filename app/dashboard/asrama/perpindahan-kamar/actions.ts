'use server'

import { query, queryOne, execute, getDB } from '@/lib/db'
import { hasRole, isAdmin } from '@/lib/auth/session'
import { assertFeature } from '@/lib/auth/feature'
import { revalidatePath } from 'next/cache'

const REVALIDATE = '/dashboard/asrama/perpindahan-kamar'

type KamarInput = { nomor_kamar: string; kuota: number; blok?: string }
type AccessOk = { session: { id: string; email: string; full_name: string; role: string; roles: string[]; asrama_binaan: string | null }; asrama: string }

async function assertAsramaAccess(asrama: string): Promise<AccessOk | { error: string }> {
  const access = await assertFeature('/dashboard/asrama/perpindahan-kamar')
  const targetAsrama = asrama?.trim()

  if ('error' in access) return access
  const session = access
  if (!targetAsrama) return { error: 'Asrama wajib dipilih' }

  if (!isAdmin(session)) {
    if (!hasRole(session, 'pengurus_asrama')) return { error: 'Unauthorized' }
    if (!session.asrama_binaan) return { error: 'Asrama binaan akun belum diset' }
    if (session.asrama_binaan !== targetAsrama) {
      return { error: 'Anda hanya boleh mengelola asrama binaan Anda' }
    }
  }

  return { session, asrama: targetAsrama }
}

function cleanKamarList(kamarList: KamarInput[]): KamarInput[] | { error: string } {
  if (!kamarList.length) return { error: 'Tambahkan minimal 1 kamar' }

  const seen = new Set<string>()
  const cleaned = kamarList.map(k => ({
    nomor_kamar: String(k.nomor_kamar ?? '').trim(),
    kuota: Number(k.kuota),
    blok: k.blok ? String(k.blok).trim().toUpperCase() : '',
  }))

  for (const k of cleaned) {
    if (!k.nomor_kamar) return { error: 'Nomor kamar tidak boleh kosong' }
    if (seen.has(k.nomor_kamar)) return { error: `Nomor kamar ${k.nomor_kamar} duplikat` }
    seen.add(k.nomor_kamar)
    if (!Number.isInteger(k.kuota) || k.kuota < 1 || k.kuota > 50) {
      return { error: `Kuota kamar ${k.nomor_kamar} harus 1-50` }
    }
  }

  return cleaned
}

async function ensureKamarExists(asrama: string, nomorKamar: string) {
  return queryOne<{ nomor_kamar: string }>(
    'SELECT nomor_kamar FROM kamar_config WHERE asrama = ? AND nomor_kamar = ?',
    [asrama, nomorKamar]
  )
}

async function ensurePerpindahanKamarSchema() {
  const db = await getDB()

  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_config (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama      TEXT NOT NULL,
        nomor_kamar TEXT NOT NULL,
        kuota       INTEGER NOT NULL DEFAULT 10,
        blok        TEXT,
        created_at  TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, nomor_kamar)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_draft (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama      TEXT NOT NULL,
        santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        kamar_lama  TEXT,
        kamar_baru  TEXT NOT NULL,
        applied     INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, santri_id)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_ketua (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama      TEXT NOT NULL,
        nomor_kamar TEXT NOT NULL,
        santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        created_at  TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, nomor_kamar)
      )
    `),
  ])

  const kamarConfigColumns = await query<{ name: string }>('PRAGMA table_info(kamar_config)')
  if (!kamarConfigColumns.some(col => col.name === 'blok')) {
    await execute('ALTER TABLE kamar_config ADD COLUMN blok TEXT')
  }
}

// ─── GET: Load semua data yang dibutuhkan untuk satu asrama ──────────────────

export async function getDataPerpindahan(asrama: string) {
  await ensurePerpindahanKamarSchema()
  const access = await assertAsramaAccess(asrama)
  if ('error' in access) return { error: access.error, configs: [], drafts: [], ketuaList: [], santriList: [] }
  const targetAsrama = access.asrama

  const [configs, drafts, ketuaList, santriList] = await Promise.all([
    // Konfigurasi kamar
    query<any>('SELECT * FROM kamar_config WHERE asrama = ? ORDER BY CAST(nomor_kamar AS INTEGER), nomor_kamar', [targetAsrama]),

    // Draft perpindahan
    query<any>('SELECT * FROM kamar_draft WHERE asrama = ?', [targetAsrama]),

    // Ketua kamar
    query<any>(`
      SELECT kk.*, s.nama_lengkap, s.nis
      FROM kamar_ketua kk
      JOIN santri s ON s.id = kk.santri_id
       AND s.status_global = 'aktif'
       AND s.asrama = kk.asrama
      JOIN kamar_config kc
        ON kc.asrama = kk.asrama
       AND kc.nomor_kamar = kk.nomor_kamar
      WHERE kk.asrama = ?
    `, [targetAsrama]),

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
    `, [targetAsrama]),
  ])

  return { configs, drafts, ketuaList, santriList }
}

// ─── SETUP KAMAR: Simpan konfigurasi kamar ───────────────────────────────────

export async function simpanKonfigurasiKamar(
  asrama: string,
  kamarList: KamarInput[]
) {
  await ensurePerpindahanKamarSchema()
  const access = await assertAsramaAccess(asrama)
  if ('error' in access) return access
  const cleaned = cleanKamarList(kamarList)
  if ('error' in cleaned) return cleaned

  const db = await getDB()
  try {
    const validKamar = cleaned.map(k => k.nomor_kamar)
    const placeholders = validKamar.map(() => '?').join(',')
    const stmts = [
      db.prepare('DELETE FROM kamar_config WHERE asrama = ?').bind(access.asrama),
      ...cleaned.map(k =>
        db.prepare('INSERT INTO kamar_config (asrama, nomor_kamar, kuota, blok) VALUES (?, ?, ?, ?)').bind(access.asrama, k.nomor_kamar, k.kuota, k.blok || null)
      ),
      db.prepare(`DELETE FROM kamar_draft WHERE asrama = ? AND kamar_baru NOT IN (${placeholders})`).bind(access.asrama, ...validKamar),
      db.prepare(`DELETE FROM kamar_draft WHERE asrama = ? AND santri_id NOT IN (
        SELECT id FROM santri WHERE status_global = 'aktif' AND asrama = ?
      )`).bind(access.asrama, access.asrama),
      db.prepare(`DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar NOT IN (${placeholders})`).bind(access.asrama, ...validKamar),
      db.prepare(`DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id NOT IN (
        SELECT id FROM santri WHERE status_global = 'aktif' AND asrama = ?
      )`).bind(access.asrama, access.asrama),
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
  await ensurePerpindahanKamarSchema()
  const access = await assertAsramaAccess(asrama)
  if ('error' in access) return access
  if (!Number.isFinite(persenUntukBaru) || persenUntukBaru < 0 || persenUntukBaru > 50) {
    return { error: 'Persen slot santri baru harus 0-50' }
  }

  const { configs, santriList } = await getDataPerpindahan(access.asrama)
  if (!configs.length) return { error: 'Belum ada konfigurasi kamar' }
  if (!santriList.length) return { error: 'Tidak ada santri di asrama ini' }

  const db = await getDB()
  const kamarKetua = await query<any>(`
    SELECT kk.santri_id, kk.nomor_kamar
    FROM kamar_ketua kk
    JOIN santri s
      ON s.id = kk.santri_id
     AND s.status_global = 'aktif'
     AND s.asrama = kk.asrama
    JOIN kamar_config kc
      ON kc.asrama = kk.asrama
     AND kc.nomor_kamar = kk.nomor_kamar
    WHERE kk.asrama = ?
  `, [access.asrama])

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
      db.prepare('DELETE FROM kamar_draft WHERE asrama = ?').bind(access.asrama),
      ...santriList.map(s =>
        db.prepare(`
          INSERT INTO kamar_draft (asrama, santri_id, kamar_lama, kamar_baru, applied)
          VALUES (?, ?, ?, ?, 0)
        `).bind(access.asrama, s.id, s.kamar_asli || null, assignment[s.id] || kamarSlots[0].nomor)
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
  await ensurePerpindahanKamarSchema()
  const access = await assertAsramaAccess(asrama)
  if ('error' in access) return access
  const targetKamar = String(kamarBaru ?? '').trim()
  if (!targetKamar) return { error: 'Kamar tujuan wajib dipilih' }
  const kamar = await ensureKamarExists(access.asrama, targetKamar)
  if (!kamar) return { error: 'Kamar tujuan tidak ada di konfigurasi' }

  const draft = await queryOne<{ santri_id: string; kamar_lama: string | null }>(`
    SELECT kd.santri_id, kd.kamar_lama
    FROM kamar_draft kd
    JOIN santri s
      ON s.id = kd.santri_id
     AND s.status_global = 'aktif'
     AND s.asrama = kd.asrama
    WHERE kd.asrama = ? AND kd.santri_id = ?
    LIMIT 1
  `, [access.asrama, santriId])

  const santri = await queryOne<{ id: string; kamar: string | null }>(
    `SELECT id, kamar FROM santri WHERE id = ? AND status_global = 'aktif' AND asrama = ?`,
    [santriId, access.asrama]
  )
  if (!santri) return { error: 'Santri tidak aktif atau bukan penghuni asrama ini' }

  const ketuaAssignment = await queryOne<{ nomor_kamar: string }>(
    'SELECT nomor_kamar FROM kamar_ketua WHERE asrama = ? AND santri_id = ?',
    [access.asrama, santriId]
  )

  const db = await getDB()
  await db.batch([
    draft
      ? db.prepare(`
          UPDATE kamar_draft
          SET kamar_baru = ?, applied = 0
          WHERE asrama = ? AND santri_id = ?
        `).bind(targetKamar, access.asrama, santriId)
      : db.prepare(`
          INSERT INTO kamar_draft (asrama, santri_id, kamar_lama, kamar_baru, applied)
          VALUES (?, ?, ?, ?, 0)
        `).bind(access.asrama, santriId, santri.kamar ?? null, targetKamar),
    db.prepare(`
      DELETE FROM kamar_ketua
      WHERE asrama = ? AND santri_id = ? AND nomor_kamar <> ?
    `).bind(access.asrama, santriId, targetKamar),
  ])
  revalidatePath(REVALIDATE)
  return {
    success: true,
    removedKetuaKamar: ketuaAssignment && ketuaAssignment.nomor_kamar !== targetKamar
      ? ketuaAssignment.nomor_kamar
      : null,
  }
}

// ─── APPLY DRAFT: Update kolom kamar di tabel santri ─────────────────────────

export async function applyDraft(asrama: string) {
  await ensurePerpindahanKamarSchema()
  const access = await assertAsramaAccess(asrama)
  if ('error' in access) return access

  const [allDrafts, validDrafts] = await Promise.all([
    query<any>('SELECT id, santri_id FROM kamar_draft WHERE asrama = ?', [access.asrama]),
    query<any>(`
      SELECT kd.*
      FROM kamar_draft kd
      JOIN santri s
        ON s.id = kd.santri_id
       AND s.status_global = 'aktif'
       AND s.asrama = kd.asrama
      JOIN kamar_config kc
        ON kc.asrama = kd.asrama
       AND kc.nomor_kamar = kd.kamar_baru
      WHERE kd.asrama = ?
    `, [access.asrama]),
  ])
  if (!allDrafts.length) return { error: 'Tidak ada draft untuk diapply' }
  if (!validDrafts.length) return { error: 'Semua draft sudah tidak valid. Generate ulang draft.' }

  const db = await getDB()
  try {
    const validIds = validDrafts.map((d: any) => d.id)
    const validSantriIds = validDrafts.map((d: any) => d.santri_id)
    const validPlaceholders = validIds.map(() => '?').join(',')
    const santriPlaceholders = validSantriIds.map(() => '?').join(',')
    const staleCount = allDrafts.length - validDrafts.length

    const updateStmts = validDrafts.map((d: any) =>
      db.prepare(`UPDATE santri SET kamar = ?, updated_at = datetime('now') WHERE id = ? AND status_global = 'aktif' AND asrama = ?`)
        .bind(d.kamar_baru, d.santri_id, access.asrama)
    )
    const markStmts = [
      db.prepare(`UPDATE kamar_draft SET applied = 1 WHERE asrama = ? AND santri_id IN (${santriPlaceholders})`)
        .bind(access.asrama, ...validSantriIds),
      db.prepare(`DELETE FROM kamar_draft WHERE asrama = ? AND id NOT IN (${validPlaceholders})`)
        .bind(access.asrama, ...validIds),
    ]
    for (let i = 0; i < updateStmts.length; i += 100) {
      await db.batch(updateStmts.slice(i, i + 100))
    }
    await db.batch(markStmts)
    revalidatePath(REVALIDATE)
    return { success: true, count: validDrafts.length, skipped: staleCount }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ─── KETUA KAMAR: Set/unset ketua ────────────────────────────────────────────

export async function setKetuaKamar(asrama: string, nomor_kamar: string, santri_id: string | null) {
  await ensurePerpindahanKamarSchema()
  const access = await assertAsramaAccess(asrama)
  if ('error' in access) return access
  const targetKamar = String(nomor_kamar ?? '').trim()
  if (!targetKamar) return { error: 'Nomor kamar wajib diisi' }

  const kamar = await ensureKamarExists(access.asrama, targetKamar)
  if (!kamar) return { error: 'Kamar tidak ada di konfigurasi' }

  if (!santri_id) {
    await execute('DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar = ?', [access.asrama, targetKamar])
  } else {
    const santri = await queryOne<{ id: string }>(
      `SELECT id FROM santri WHERE id = ? AND status_global = 'aktif' AND asrama = ?`,
      [santri_id, access.asrama]
    )
    if (!santri) return { error: 'Santri tidak aktif atau bukan penghuni asrama ini' }

    const draft = await queryOne<{ kamar_baru: string }>(
      'SELECT kamar_baru FROM kamar_draft WHERE asrama = ? AND santri_id = ?',
      [access.asrama, santri_id]
    )
    if (draft && draft.kamar_baru !== targetKamar) {
      return { error: 'Santri ini tidak ada di draft kamar tujuan' }
    }

    const db = await getDB()
    await db.batch([
      db.prepare('DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id = ? AND nomor_kamar <> ?')
        .bind(access.asrama, santri_id, targetKamar),
      db.prepare(`
        INSERT INTO kamar_ketua (asrama, nomor_kamar, santri_id)
        VALUES (?, ?, ?)
        ON CONFLICT(asrama, nomor_kamar) DO UPDATE SET santri_id = excluded.santri_id
      `).bind(access.asrama, targetKamar, santri_id),
    ])
  }
  revalidatePath(REVALIDATE)
  return { success: true }
}

// ─── RESET DRAFT ─────────────────────────────────────────────────────────────

export async function resetDraft(asrama: string) {
  await ensurePerpindahanKamarSchema()
  const access = await assertAsramaAccess(asrama)
  if ('error' in access) return access

  await execute('DELETE FROM kamar_draft WHERE asrama = ?', [access.asrama])
  revalidatePath(REVALIDATE)
  return { success: true }
}
