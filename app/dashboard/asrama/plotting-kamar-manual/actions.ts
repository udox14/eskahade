'use server'

import { revalidatePath } from 'next/cache'
import { assertFeature } from '@/lib/auth/feature'
import { hasRole, isAdmin } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { execute, getDB, query, queryOne } from '@/lib/db'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { getKategoriSantriEfektifSql } from '@/lib/santri/kategori'

const FEATURE_PATH = '/dashboard/asrama/plotting-kamar-manual'
const KAMAR_PATH = '/dashboard/asrama/kamar'
const LEGACY_PATH = '/dashboard/asrama/perpindahan-kamar'

type KamarManualInput = {
  nomor_kamar: string
  kuota_lama: number
  kuota_baru: number
  blok?: string
}

type KamarConfigRow = {
  nomor_kamar: string
  kuota: number
  reserved_baru: number | null
  blok: string | null
}

type DraftRow = {
  id?: number
  santri_id: string
  kamar_lama: string | null
  kamar_baru: string
  applied: number
}

type KetuaRow = {
  nomor_kamar: string
  santri_id: string
  nama_lengkap: string
}

type SantriRow = {
  id: string
  nama_lengkap: string
  nis: string
  jenis_kelamin: string
  kamar_asli: string | null
  sekolah: string | null
  kelas_sekolah: string | null
  marhalah_nama: string | null
  nama_kelas: string | null
  kategori_santri: string
  kategori_efektif: string
}

type ExistingKamarRow = {
  nomor_kamar: string
  kuota_lama: number
}

type AccessOk = {
  session: {
    id: string
    email: string
    full_name: string
    role: string
    roles: string[]
    asrama_binaan: string | null
  }
  asrama: string
}

async function ensureSchema() {
  const db = await getDB()
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_config (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama        TEXT NOT NULL,
        nomor_kamar   TEXT NOT NULL,
        kuota         INTEGER NOT NULL DEFAULT 10,
        reserved_baru INTEGER NOT NULL DEFAULT 0,
        blok          TEXT,
        created_at    TEXT DEFAULT (datetime('now')),
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

  const columns = await query<{ name: string }>('PRAGMA table_info(kamar_config)')
  if (!columns.some((col) => col.name === 'blok')) {
    await execute('ALTER TABLE kamar_config ADD COLUMN blok TEXT')
  }
  if (!columns.some((col) => col.name === 'reserved_baru')) {
    await execute('ALTER TABLE kamar_config ADD COLUMN reserved_baru INTEGER NOT NULL DEFAULT 0')
  }
}

async function assertAccess(asrama: string, action: 'read' | 'update' | 'delete' = 'read'): Promise<AccessOk | { error: string }> {
  await ensureSchema()
  const access = await assertFeature(FEATURE_PATH, action)
  if ('error' in access) return access

  const targetAsrama = String(asrama ?? '').trim()
  if (!targetAsrama) return { error: 'Asrama wajib dipilih' }
  if (isAsramaTanpaKamar(targetAsrama)) return { error: 'Asrama ini tidak memakai fitur kamar' }

  const canReadAllAsrama = action === 'read' && hasRole(access, 'tester')
  if (!isAdmin(access) && !canReadAllAsrama) {
    if (!hasRole(access, 'pengurus_asrama')) return { error: 'Unauthorized' }
    if (!access.asrama_binaan) return { error: 'Asrama binaan akun belum diset' }
    if (access.asrama_binaan !== targetAsrama) return { error: 'Anda hanya boleh mengelola asrama binaan Anda' }
  }

  return { session: access, asrama: targetAsrama }
}

function cleanKamarList(kamarList: KamarManualInput[]): KamarManualInput[] | { error: string } {
  if (!kamarList.length) return { error: 'Tambahkan minimal 1 kamar' }
  const seen = new Set<string>()
  const cleaned = kamarList.map((kamar) => ({
    nomor_kamar: String(kamar.nomor_kamar ?? '').trim(),
    kuota_lama: Number(kamar.kuota_lama ?? 0),
    kuota_baru: Number(kamar.kuota_baru ?? 0),
    blok: kamar.blok ? String(kamar.blok).trim().toUpperCase() : '',
  }))

  for (const kamar of cleaned) {
    if (!kamar.nomor_kamar) return { error: 'Nomor kamar tidak boleh kosong' }
    if (seen.has(kamar.nomor_kamar)) return { error: `Nomor kamar ${kamar.nomor_kamar} duplikat` }
    seen.add(kamar.nomor_kamar)
    if (!Number.isInteger(kamar.kuota_lama) || kamar.kuota_lama < 0 || kamar.kuota_lama > 50) {
      return { error: `Kuota santri lama kamar ${kamar.nomor_kamar} harus 0-50` }
    }
    if (!Number.isInteger(kamar.kuota_baru) || kamar.kuota_baru < 0 || kamar.kuota_baru > 50) {
      return { error: `Kuota santri baru kamar ${kamar.nomor_kamar} harus 0-50` }
    }
    if (kamar.kuota_lama + kamar.kuota_baru < 1) {
      return { error: `Total kuota kamar ${kamar.nomor_kamar} minimal 1` }
    }
  }

  return cleaned
}

function mapConfig(row: KamarConfigRow) {
  const kuota = Number(row.kuota ?? 0)
  const kuotaBaru = Number(row.reserved_baru ?? 0)
  return {
    nomor_kamar: String(row.nomor_kamar),
    kuota,
    reserved_baru: kuotaBaru,
    kuota_lama: Math.max(0, kuota - kuotaBaru),
    kuota_baru: kuotaBaru,
    blok: row.blok ?? '',
  }
}

async function getKamar(asrama: string, nomorKamar: string) {
  return queryOne<{ nomor_kamar: string; kuota: number; reserved_baru: number }>(
    'SELECT nomor_kamar, kuota, reserved_baru FROM kamar_config WHERE asrama = ? AND nomor_kamar = ?',
    [asrama, nomorKamar]
  )
}

async function cleanupKetuaInvalid(asrama: string) {
  await execute(`
    DELETE FROM kamar_ketua
    WHERE asrama = ?
      AND (
        nomor_kamar NOT IN (SELECT nomor_kamar FROM kamar_config WHERE asrama = ?)
        OR santri_id NOT IN (
          SELECT kd.santri_id
          FROM kamar_draft kd
          WHERE kd.asrama = ? AND kd.kamar_baru = kamar_ketua.nomor_kamar
        )
      )
  `, [asrama, asrama, asrama])
}

export async function getDataPlottingManual(asrama: string) {
  const access = await assertAccess(asrama)
  if ('error' in access) {
    return { error: access.error, configs: [], drafts: [], ketuaList: [], santriList: [], defaultConfigs: [] }
  }

  await cleanupKetuaInvalid(access.asrama)
  const kategoriEfektifSql = getKategoriSantriEfektifSql('s')

  const [configs, drafts, ketuaList, santriList, existingKamar] = await Promise.all([
    query<KamarConfigRow>('SELECT nomor_kamar, kuota, reserved_baru, blok FROM kamar_config WHERE asrama = ? ORDER BY CAST(nomor_kamar AS INTEGER), nomor_kamar', [access.asrama]),
    query<DraftRow>('SELECT santri_id, kamar_lama, kamar_baru, applied FROM kamar_draft WHERE asrama = ? ORDER BY created_at', [access.asrama]),
    query<KetuaRow>(`
      SELECT kk.nomor_kamar, kk.santri_id, s.nama_lengkap
      FROM kamar_ketua kk
      JOIN santri s ON s.id = kk.santri_id AND s.status_global = 'aktif' AND s.asrama = kk.asrama
      WHERE kk.asrama = ?
    `, [access.asrama]),
    query<SantriRow>(`
      SELECT s.id, s.nama_lengkap, s.nis, s.jenis_kelamin,
             s.kamar AS kamar_asli, s.sekolah, s.kelas_sekolah,
             COALESCE(NULLIF(s.kategori_santri, ''), 'REGULER') AS kategori_santri,
             ${kategoriEfektifSql} AS kategori_efektif,
             m.nama AS marhalah_nama, k.nama_kelas
      FROM santri s
      LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      LEFT JOIN kelas k ON k.id = rp.kelas_id
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
      WHERE s.status_global = 'aktif' AND s.asrama = ?
      ORDER BY s.nama_lengkap
    `, [access.asrama]),
    query<ExistingKamarRow>(`
      SELECT TRIM(kamar) AS nomor_kamar, COUNT(*) AS kuota_lama
      FROM santri
      WHERE status_global = 'aktif'
        AND asrama = ?
        AND kamar IS NOT NULL
        AND TRIM(kamar) <> ''
      GROUP BY TRIM(kamar)
      ORDER BY CAST(TRIM(kamar) AS INTEGER), TRIM(kamar)
    `, [access.asrama]),
  ])

  const defaultConfigs = configs.length
    ? configs.map(mapConfig)
    : existingKamar.map((row) => ({
        nomor_kamar: row.nomor_kamar,
        kuota_lama: Number(row.kuota_lama) || 1,
        kuota_baru: 0,
        kuota: Number(row.kuota_lama) || 1,
        reserved_baru: 0,
        blok: '',
      }))

  return {
    configs: configs.map(mapConfig),
    drafts,
    ketuaList,
    santriList,
    defaultConfigs,
  }
}

export async function simpanKonfigurasiManual(asrama: string, kamarList: KamarManualInput[]) {
  const access = await assertAccess(asrama, 'update')
  if ('error' in access) return access
  const cleaned = cleanKamarList(kamarList)
  if ('error' in cleaned) return cleaned

  const validKamar = cleaned.map((kamar) => kamar.nomor_kamar)
  const placeholders = validKamar.map(() => '?').join(',')
  const db = await getDB()
  await db.batch([
    db.prepare('DELETE FROM kamar_config WHERE asrama = ?').bind(access.asrama),
    ...cleaned.map((kamar) =>
      db.prepare('INSERT INTO kamar_config (asrama, nomor_kamar, kuota, reserved_baru, blok) VALUES (?, ?, ?, ?, ?)')
        .bind(access.asrama, kamar.nomor_kamar, kamar.kuota_lama + kamar.kuota_baru, kamar.kuota_baru, kamar.blok || null)
    ),
    db.prepare(`DELETE FROM kamar_draft WHERE asrama = ? AND kamar_baru NOT IN (${placeholders})`).bind(access.asrama, ...validKamar),
    db.prepare(`DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar NOT IN (${placeholders})`).bind(access.asrama, ...validKamar),
  ])
  await cleanupKetuaInvalid(access.asrama)

  await logActivity({
    actor: actorFromSession(access.session),
    module: 'plotting_kamar_manual',
    action: 'update',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'kamar_config_batch',
    entityId: access.asrama,
    entityLabel: access.asrama,
    summary: `Memperbarui konfigurasi plotting manual asrama ${access.asrama}`,
    details: { total_kamar: cleaned.length },
  })
  revalidatePath(FEATURE_PATH)
  revalidatePath(KAMAR_PATH)
  return { success: true }
}

export async function buatDraftManual(asrama: string, mode: 'prefill' | 'empty') {
  const access = await assertAccess(asrama, 'update')
  if ('error' in access) return access

  const [configs, santriList] = await Promise.all([
    query<{ nomor_kamar: string }>('SELECT nomor_kamar FROM kamar_config WHERE asrama = ?', [access.asrama]),
    query<{ id: string; kamar: string | null }>('SELECT id, kamar FROM santri WHERE status_global = ? AND asrama = ?', ['aktif', access.asrama]),
  ])
  if (!configs.length) return { error: 'Simpan konfigurasi kamar dulu' }

  const validKamar = new Set(configs.map((row) => row.nomor_kamar))
  const prefilled = mode === 'prefill'
    ? santriList.filter((santri) => validKamar.has(String(santri.kamar ?? '').trim()))
    : []

  const db = await getDB()
  const stmts = [
    db.prepare('DELETE FROM kamar_draft WHERE asrama = ?').bind(access.asrama),
    db.prepare('DELETE FROM kamar_ketua WHERE asrama = ?').bind(access.asrama),
    ...prefilled.map((santri) =>
      db.prepare(`
        INSERT INTO kamar_draft (asrama, santri_id, kamar_lama, kamar_baru, applied)
        VALUES (?, ?, ?, ?, 0)
      `).bind(access.asrama, santri.id, santri.kamar || null, String(santri.kamar).trim())
    ),
  ]
  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100))
  }

  await logActivity({
    actor: actorFromSession(access.session),
    module: 'plotting_kamar_manual',
    action: 'update',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'kamar_draft',
    entityId: access.asrama,
    entityLabel: access.asrama,
    summary: `Membuat draft plotting manual asrama ${access.asrama}`,
    details: { mode, total_prefill: prefilled.length },
  })
  revalidatePath(FEATURE_PATH)
  return { success: true, total: prefilled.length }
}

export async function tambahSantriKeKamar(asrama: string, nomorKamar: string, santriIds: string[]) {
  const access = await assertAccess(asrama, 'update')
  if ('error' in access) return access
  const targetKamar = String(nomorKamar ?? '').trim()
  if (!targetKamar) return { error: 'Kamar wajib dipilih' }
  const kamar = await getKamar(access.asrama, targetKamar)
  if (!kamar) return { error: 'Kamar tidak ada di konfigurasi' }

  const ids = [...new Set(santriIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (!ids.length) return { error: 'Pilih minimal satu santri' }
  const placeholders = ids.map(() => '?').join(',')
  const kategoriEfektifSql = getKategoriSantriEfektifSql('s')

  const [existingDraft, validSantri, currentCounts] = await Promise.all([
    query<{ santri_id: string }>(`SELECT santri_id FROM kamar_draft WHERE asrama = ? AND santri_id IN (${placeholders})`, [access.asrama, ...ids]),
    query<{ id: string; kamar: string | null; kategori_efektif: string }>(
      `SELECT s.id, s.kamar, ${kategoriEfektifSql} AS kategori_efektif
       FROM santri s
       WHERE s.status_global = 'aktif' AND s.asrama = ? AND s.id IN (${placeholders})`,
      [access.asrama, ...ids]
    ),
    query<{ kategori_efektif: string; total: number }>(`
      SELECT ${kategoriEfektifSql} AS kategori_efektif, COUNT(*) AS total
      FROM kamar_draft kd
      JOIN santri s ON s.id = kd.santri_id AND s.status_global = 'aktif' AND s.asrama = kd.asrama
      WHERE kd.asrama = ? AND kd.kamar_baru = ?
      GROUP BY kategori_efektif
    `, [access.asrama, targetKamar]),
  ])

  if (existingDraft.length) return { error: `${existingDraft.length} santri sudah ditempatkan di kamar lain` }
  if (validSantri.length !== ids.length) return { error: 'Ada santri yang tidak aktif atau bukan penghuni asrama ini' }

  const kuotaLama = Math.max(0, Number(kamar.kuota) - Number(kamar.reserved_baru ?? 0))
  const kuotaBaru = Math.max(0, Number(kamar.reserved_baru ?? 0))
  const currentBaru = Number(currentCounts.find((row) => row.kategori_efektif === 'BARU')?.total ?? 0)
  const currentLama = currentCounts.reduce((sum, row) => row.kategori_efektif === 'BARU' ? sum : sum + Number(row.total ?? 0), 0)
  const tambahBaru = validSantri.filter((santri) => santri.kategori_efektif === 'BARU').length
  const tambahLama = validSantri.length - tambahBaru
  if (currentBaru + tambahBaru > kuotaBaru) {
    return { error: `Kuota santri baru kamar ${targetKamar} tidak cukup` }
  }
  if (currentLama + tambahLama > kuotaLama) {
    return { error: `Kuota santri lama kamar ${targetKamar} tidak cukup` }
  }

  const santriMap = new Map(validSantri.map((santri) => [santri.id, santri]))
  const db = await getDB()
  await db.batch(ids.map((id) =>
    db.prepare(`
      INSERT INTO kamar_draft (asrama, santri_id, kamar_lama, kamar_baru, applied)
      VALUES (?, ?, ?, ?, 0)
    `).bind(access.asrama, id, santriMap.get(id)?.kamar ?? null, targetKamar)
  ))

  await logActivity({
    actor: actorFromSession(access.session),
    module: 'plotting_kamar_manual',
    action: 'update',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'kamar_draft',
    entityId: `${access.asrama}:${targetKamar}`,
    entityLabel: `${access.asrama} kamar ${targetKamar}`,
    summary: `Menambahkan ${ids.length} santri ke draft kamar ${targetKamar}`,
    details: { asrama: access.asrama, nomor_kamar: targetKamar, total: ids.length },
  })
  revalidatePath(FEATURE_PATH)
  return { success: true, total: ids.length }
}

export async function hapusSantriDariDraft(asrama: string, santriId: string) {
  const access = await assertAccess(asrama, 'delete')
  if ('error' in access) return access
  const id = String(santriId ?? '').trim()
  if (!id) return { error: 'Santri wajib dipilih' }

  await execute('DELETE FROM kamar_draft WHERE asrama = ? AND santri_id = ?', [access.asrama, id])
  await execute('DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id = ?', [access.asrama, id])

  await logActivity({
    actor: actorFromSession(access.session),
    module: 'plotting_kamar_manual',
    action: 'delete',
    fiturHref: FEATURE_PATH,
    logKind: 'delete',
    entityType: 'kamar_draft',
    entityId: id,
    entityLabel: id,
    summary: `Menghapus santri dari draft plotting kamar`,
    details: { asrama: access.asrama, santri_id: id },
  })
  revalidatePath(FEATURE_PATH)
  return { success: true }
}

export async function setKetuaKamarManual(asrama: string, nomorKamar: string, santriId: string | null) {
  const access = await assertAccess(asrama, 'update')
  if ('error' in access) return access
  const targetKamar = String(nomorKamar ?? '').trim()
  if (!targetKamar) return { error: 'Kamar wajib dipilih' }
  const kamar = await getKamar(access.asrama, targetKamar)
  if (!kamar) return { error: 'Kamar tidak ada di konfigurasi' }

  if (!santriId) {
    await execute('DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar = ?', [access.asrama, targetKamar])
  } else {
    const draft = await queryOne<{ santri_id: string }>(
      'SELECT santri_id FROM kamar_draft WHERE asrama = ? AND kamar_baru = ? AND santri_id = ?',
      [access.asrama, targetKamar, santriId]
    )
    if (!draft) return { error: 'Ketua harus dipilih dari penghuni draft kamar ini' }

    const db = await getDB()
    await db.batch([
      db.prepare('DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id = ? AND nomor_kamar <> ?')
        .bind(access.asrama, santriId, targetKamar),
      db.prepare(`
        INSERT INTO kamar_ketua (asrama, nomor_kamar, santri_id)
        VALUES (?, ?, ?)
        ON CONFLICT(asrama, nomor_kamar) DO UPDATE SET santri_id = excluded.santri_id
      `).bind(access.asrama, targetKamar, santriId),
    ])
  }

  await logActivity({
    actor: actorFromSession(access.session),
    module: 'plotting_kamar_manual',
    action: 'update',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'kamar_ketua',
    entityId: `${access.asrama}:${targetKamar}`,
    entityLabel: `${access.asrama} kamar ${targetKamar}`,
    summary: santriId ? `Menetapkan ketua kamar ${targetKamar}` : `Menghapus ketua kamar ${targetKamar}`,
    details: { asrama: access.asrama, nomor_kamar: targetKamar, santri_id: santriId },
  })
  revalidatePath(FEATURE_PATH)
  revalidatePath(KAMAR_PATH)
  return { success: true }
}

export async function terapkanPlottingManual(asrama: string) {
  const access = await assertAccess(asrama, 'update')
  if ('error' in access) return access
  const kategoriEfektifSql = getKategoriSantriEfektifSql('s')

  const drafts = await query<DraftRow>(`
    SELECT kd.*
    FROM kamar_draft kd
    JOIN santri s ON s.id = kd.santri_id AND s.status_global = 'aktif' AND s.asrama = kd.asrama
    JOIN kamar_config kc ON kc.asrama = kd.asrama AND kc.nomor_kamar = kd.kamar_baru
    WHERE kd.asrama = ?
  `, [access.asrama])
  if (!drafts.length) return { error: 'Tidak ada draft untuk diterapkan' }

  const [configs, roomCounts] = await Promise.all([
    query<{ nomor_kamar: string; kuota: number; reserved_baru: number }>(
      'SELECT nomor_kamar, kuota, reserved_baru FROM kamar_config WHERE asrama = ?',
      [access.asrama]
    ),
    query<{ kamar_baru: string; kategori_efektif: string; total: number }>(`
      SELECT kd.kamar_baru, ${kategoriEfektifSql} AS kategori_efektif, COUNT(*) AS total
      FROM kamar_draft kd
      JOIN santri s ON s.id = kd.santri_id AND s.status_global = 'aktif' AND s.asrama = kd.asrama
      WHERE kd.asrama = ?
      GROUP BY kd.kamar_baru, kategori_efektif
    `, [access.asrama]),
  ])
  const configMap = new Map(configs.map((config) => [config.nomor_kamar, config]))
  for (const config of configs) {
    const counts = roomCounts.filter((row) => row.kamar_baru === config.nomor_kamar)
    const totalBaru = Number(counts.find((row) => row.kategori_efektif === 'BARU')?.total ?? 0)
    const totalLama = counts.reduce((sum, row) => row.kategori_efektif === 'BARU' ? sum : sum + Number(row.total ?? 0), 0)
    const kuotaBaru = Math.max(0, Number(config.reserved_baru ?? 0))
    const kuotaLama = Math.max(0, Number(config.kuota ?? 0) - kuotaBaru)
    if (totalBaru > kuotaBaru) return { error: `Kuota santri baru kamar ${config.nomor_kamar} melebihi batas` }
    if (totalLama > kuotaLama) return { error: `Kuota santri lama kamar ${config.nomor_kamar} melebihi batas` }
  }
  const kamarTidakAda = [...new Set(drafts.map((draft) => draft.kamar_baru))].filter((nomorKamar) => !configMap.has(nomorKamar))
  if (kamarTidakAda.length) return { error: `Ada draft menuju kamar yang tidak ada di konfigurasi: ${kamarTidakAda.join(', ')}` }

  const tanpaDraft = await queryOne<{ total: number }>(`
    SELECT COUNT(*) AS total
    FROM santri s
    WHERE s.status_global = 'aktif'
      AND s.asrama = ?
      AND s.kamar IS NOT NULL
      AND TRIM(s.kamar) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM kamar_draft kd
        JOIN kamar_config kc ON kc.asrama = kd.asrama AND kc.nomor_kamar = kd.kamar_baru
        WHERE kd.asrama = s.asrama AND kd.santri_id = s.id
      )
  `, [access.asrama])

  const db = await getDB()
  const updateStmts = drafts.map((draft) =>
    db.prepare('UPDATE santri SET kamar = ?, updated_at = datetime(\'now\') WHERE id = ? AND status_global = ? AND asrama = ?')
      .bind(draft.kamar_baru, draft.santri_id, 'aktif', access.asrama)
  )
  for (let i = 0; i < updateStmts.length; i += 100) {
    await db.batch(updateStmts.slice(i, i + 100))
  }
  await execute(`
    UPDATE santri
    SET kamar = NULL, updated_at = datetime('now')
    WHERE status_global = 'aktif'
      AND asrama = ?
      AND kamar IS NOT NULL
      AND TRIM(kamar) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM kamar_draft kd
        JOIN kamar_config kc ON kc.asrama = kd.asrama AND kc.nomor_kamar = kd.kamar_baru
        WHERE kd.asrama = santri.asrama AND kd.santri_id = santri.id
      )
  `, [access.asrama])
  await execute('UPDATE kamar_draft SET applied = 1 WHERE asrama = ?', [access.asrama])
  await cleanupKetuaInvalid(access.asrama)

  await logActivity({
    actor: actorFromSession(access.session),
    module: 'plotting_kamar_manual',
    action: 'update',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'kamar_draft',
    entityId: access.asrama,
    entityLabel: access.asrama,
    summary: `Menerapkan plotting manual kamar asrama ${access.asrama}`,
    details: { total: drafts.length, dikosongkan: Number(tanpaDraft?.total ?? 0) },
  })
  revalidatePath(FEATURE_PATH)
  revalidatePath(KAMAR_PATH)
  revalidatePath(LEGACY_PATH)
  return { success: true, count: drafts.length, clearedCount: Number(tanpaDraft?.total ?? 0) }
}
