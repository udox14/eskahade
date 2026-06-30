'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { assertFeature } from '@/lib/auth/feature'
import { isAdmin } from '@/lib/auth/session'
import { execute, query, queryOne } from '@/lib/db'
import { getSantriBaruSettings } from '@/lib/santri/kategori-settings'

const FEATURE_PATH = '/dashboard/setup-tahun-ajaran'
const RETURN_TO = '/dashboard/setup-tahun-ajaran'

const WIZARD_ITEMS = [
  {
    key: 'tahun_ajaran',
    title: 'Tahun Ajaran Aktif',
    description: 'Pastikan tahun ajaran baru sudah dibuat dan diaktifkan.',
    href: '/dashboard/pengaturan/tahun-ajaran',
    group: 'Fondasi',
  },
  {
    key: 'masa_santri_baru',
    title: 'Masa Santri Baru',
    description: 'Atur tanggal mulai dan durasi label BARU untuk santri tahun ini.',
    href: '/dashboard/pengaturan/santri-baru',
    group: 'Santri Baru',
  },
  {
    key: 'tarif_santri_baru',
    title: 'Tarif Santri Baru',
    description: 'Lengkapi tarif bangunan, kesehatan, EHB, dan ekskul untuk angkatan baru.',
    href: '/dashboard/keuangan/tarif',
    group: 'Keuangan',
  },
  {
    key: 'kelas_tahun_ajaran',
    title: 'Kelas Tahun Ajaran',
    description: 'Siapkan daftar kelas aktif beserta marhalah dan jenis kelaminnya.',
    href: '/dashboard/master/kelas',
    group: 'Akademik',
  },
  {
    key: 'penempatan_kelas',
    title: 'Kenaikan & Penempatan Kelas',
    description: 'Pastikan semua santri aktif sudah punya kelas di tahun ajaran aktif.',
    href: '/dashboard/santri/atur-kelas',
    group: 'Akademik',
  },
  {
    key: 'tes_klasifikasi',
    title: 'Tes Klasifikasi Santri Baru',
    description: 'Lengkapi hasil tes untuk santri baru yang belum ditempatkan ke kelas.',
    href: '/dashboard/santri/tes-klasifikasi',
    group: 'Santri Baru',
  },
  {
    key: 'guru_jadwal',
    title: 'Guru, Wali Kelas, dan Jadwal',
    description: 'Lengkapi wali kelas dan guru default shubuh, ashar, maghrib untuk tiap kelas.',
    href: '/dashboard/master/wali-kelas',
    group: 'Akademik',
  },
  {
    key: 'flow_psb',
    title: 'Flow PSB',
    description: 'Pastikan santri baru tahun berjalan tidak tertahan di alur PSB.',
    href: '/dashboard/psb',
    group: 'PSB',
  },
] as const

type WizardItemKey = (typeof WIZARD_ITEMS)[number]['key']
type AutoStatus = 'not_started' | 'needs_review' | 'complete'
export type SetupWizardOverrideStatus = 'complete' | 'skipped'
export type SetupWizardStatus = AutoStatus | SetupWizardOverrideStatus

type TahunAjaranRow = {
  id: number
  nama: string
}

type AutoCheck = {
  autoStatus: AutoStatus
  detail: string
  total?: number
  completed?: number
}

export type SetupWizardItemState = {
  key: WizardItemKey
  title: string
  description: string
  group: string
  href: string
  returnHref: string
  locked: boolean
  status: SetupWizardStatus
  autoStatus: AutoStatus
  detail: string
  total: number
  completed: number
  override: {
    status: SetupWizardOverrideStatus
    note: string | null
    updated_at: string
  } | null
}

export type SetupWizardState = {
  tahunAjaran: TahunAjaranRow | null
  tahunAwal: number | null
  progress: {
    total: number
    done: number
    percent: number
  }
  items: SetupWizardItemState[]
}

async function ensureSetupWizardSchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS setup_wizard_overrides (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      tahun_ajaran_id  INTEGER NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
      item_key         TEXT NOT NULL,
      status           TEXT NOT NULL CHECK(status IN ('complete', 'skipped')),
      note             TEXT,
      updated_by       TEXT REFERENCES users(id),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tahun_ajaran_id, item_key)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_setup_wizard_overrides_tahun
    ON setup_wizard_overrides(tahun_ajaran_id)
  `)
  await execute(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES ('Master Data', 'Setup Tahun Ajaran', ?, 'ClipboardList', '["admin"]', 1, 2)
  `, [FEATURE_PATH])
}

function extractTahunAwal(nama: string | null | undefined) {
  const match = String(nama ?? '').match(/\b(20\d{2})\b/)
  return match ? Number(match[1]) : null
}

function withReturnTo(href: string) {
  return `${href}?returnTo=${encodeURIComponent(RETURN_TO)}`
}

function done(total: number, detail: string): AutoCheck {
  return { autoStatus: 'complete', total, completed: total, detail }
}

function empty(detail: string, total = 0): AutoCheck {
  return { autoStatus: 'not_started', total, completed: 0, detail }
}

function review(total: number, completed: number, detail: string): AutoCheck {
  return { autoStatus: 'needs_review', total, completed, detail }
}

async function checkMasaSantriBaru(tahunAwal: number | null): Promise<AutoCheck> {
  if (!tahunAwal) return empty('Nama tahun ajaran belum memuat tahun awal yang bisa dibaca.')
  const settings = await getSantriBaruSettings()
  const mulaiYear = Number(settings.mulaiBerlaku.slice(0, 4))
  if (mulaiYear === tahunAwal && settings.durasiBulan > 0) {
    return done(1, `Mulai ${settings.mulaiBerlaku}, durasi ${settings.durasiBulan} bulan.`)
  }
  return review(
    1,
    0,
    `Mulai berlaku masih ${settings.mulaiBerlaku}; sebaiknya berada di tahun ${tahunAwal}.`
  )
}

async function checkTarifSantriBaru(tahunAwal: number | null): Promise<AutoCheck> {
  if (!tahunAwal) return empty('Tahun angkatan belum bisa ditentukan dari nama tahun ajaran.')
  const required = ['BANGUNAN', 'KESEHATAN', 'EHB', 'EKSKUL']
  const rows = await query<{ jenis_biaya: string; nominal: number }>(
    `SELECT jenis_biaya, nominal
     FROM biaya_settings
     WHERE tahun_angkatan = ? AND jenis_biaya IN (${required.map(() => '?').join(',')})`,
    [tahunAwal, ...required]
  )
  const complete = rows.filter(row => required.includes(row.jenis_biaya) && Number(row.nominal) > 0)
  if (complete.length === required.length) return done(required.length, `Semua tarif angkatan ${tahunAwal} sudah diisi.`)
  const missing = required.filter(item => !complete.some(row => row.jenis_biaya === item))
  return complete.length === 0
    ? empty(`Belum ada tarif lengkap untuk angkatan ${tahunAwal}.`, required.length)
    : review(required.length, complete.length, `Kurang tarif: ${missing.join(', ')}.`)
}

async function checkKelas(tahunAjaranId: number): Promise<AutoCheck> {
  const row = await queryOne<{ total: number; lengkap: number }>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE
        WHEN TRIM(COALESCE(nama_kelas, '')) != ''
         AND marhalah_id IS NOT NULL
         AND TRIM(COALESCE(jenis_kelamin, '')) != ''
        THEN 1 ELSE 0 END) AS lengkap
    FROM kelas
    WHERE tahun_ajaran_id = ?
  `, [tahunAjaranId])
  const total = Number(row?.total ?? 0)
  const lengkap = Number(row?.lengkap ?? 0)
  if (total === 0) return empty('Belum ada kelas untuk tahun ajaran aktif.')
  if (lengkap === total) return done(total, `${total} kelas aktif sudah lengkap.`)
  return review(total, lengkap, `${total - lengkap} dari ${total} kelas masih kurang data dasar.`)
}

async function checkPenempatan(tahunAjaranId: number): Promise<AutoCheck> {
  const row = await queryOne<{ total: number; ditempatkan: number }>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN EXISTS (
        SELECT 1
        FROM riwayat_pendidikan rp
        JOIN kelas k ON k.id = rp.kelas_id
        WHERE rp.santri_id = s.id
          AND rp.status_riwayat = 'aktif'
          AND k.tahun_ajaran_id = ?
      ) THEN 1 ELSE 0 END) AS ditempatkan
    FROM santri s
    WHERE s.status_global = 'aktif'
  `, [tahunAjaranId])
  const total = Number(row?.total ?? 0)
  const ditempatkan = Number(row?.ditempatkan ?? 0)
  if (total === 0) return empty('Belum ada santri aktif.')
  if (ditempatkan === total) return done(total, `${total} santri aktif sudah berada di kelas tahun ajaran aktif.`)
  return review(total, ditempatkan, `${total - ditempatkan} santri aktif belum punya kelas tahun ajaran aktif.`)
}

async function checkTesKlasifikasi(): Promise<AutoCheck> {
  try {
    const row = await queryOne<{ total: number; sudah: number }>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN h.id IS NOT NULL THEN 1 ELSE 0 END) AS sudah
      FROM santri s
      LEFT JOIN hasil_tes_klasifikasi h ON h.santri_id = s.id
      WHERE s.status_global = 'aktif'
        AND NOT EXISTS (
          SELECT 1 FROM riwayat_pendidikan rp WHERE rp.santri_id = s.id
        )
    `)
    const total = Number(row?.total ?? 0)
    const sudah = Number(row?.sudah ?? 0)
    if (total === 0) return done(1, 'Tidak ada santri baru yang menunggu tes klasifikasi.')
    if (sudah === total) return done(total, `${total} santri baru sudah punya hasil tes.`)
    return review(total, sudah, `${total - sudah} santri baru belum punya hasil tes.`)
  } catch {
    return review(1, 0, 'Data tes klasifikasi belum siap dibaca. Cek halaman tes klasifikasi.')
  }
}

async function checkGuruJadwal(tahunAjaranId: number): Promise<AutoCheck> {
  const row = await queryOne<{ total: number; lengkap: number }>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE
        WHEN wali_kelas_id IS NOT NULL
         AND guru_shubuh_id IS NOT NULL
         AND guru_ashar_id IS NOT NULL
         AND guru_maghrib_id IS NOT NULL
        THEN 1 ELSE 0 END) AS lengkap
    FROM kelas
    WHERE tahun_ajaran_id = ?
  `, [tahunAjaranId])
  const total = Number(row?.total ?? 0)
  const lengkap = Number(row?.lengkap ?? 0)
  if (total === 0) return empty('Belum ada kelas aktif untuk diatur guru dan wali kelasnya.')
  if (lengkap === total) return done(total, `${total} kelas sudah punya wali kelas dan guru default.`)
  return review(total, lengkap, `${total - lengkap} kelas belum lengkap wali kelas atau guru defaultnya.`)
}

async function checkPsb(tahunAwal: number | null): Promise<AutoCheck> {
  if (!tahunAwal) return empty('Tahun PSB belum bisa ditentukan dari nama tahun ajaran.')
  try {
    const row = await queryOne<{ total: number; selesai: number }>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN COALESCE(pf.status, 'VERIFICATION') = 'DONE' THEN 1 ELSE 0 END) AS selesai
      FROM santri s
      LEFT JOIN psb_flow pf ON pf.santri_id = s.id
      WHERE s.status_global = 'aktif'
        AND (
          s.tahun_masuk = ?
          OR (s.tahun_masuk IS NULL AND strftime('%Y', s.created_at) = ?)
          OR pf.id IS NOT NULL
        )
        AND (s.tahun_masuk = ? OR strftime('%Y', s.created_at) = ?)
    `, [tahunAwal, String(tahunAwal), tahunAwal, String(tahunAwal)])
    const total = Number(row?.total ?? 0)
    const selesai = Number(row?.selesai ?? 0)
    if (total === 0) return done(1, `Tidak ada data PSB untuk tahun ${tahunAwal}.`)
    if (selesai === total) return done(total, `${total} santri PSB tahun ${tahunAwal} sudah DONE.`)
    return review(total, selesai, `${total - selesai} santri PSB tahun ${tahunAwal} belum DONE.`)
  } catch {
    return done(1, `Belum ada flow PSB terbaca untuk tahun ${tahunAwal}.`)
  }
}

async function runAutoCheck(key: WizardItemKey, tahunAjaran: TahunAjaranRow | null, tahunAwal: number | null): Promise<AutoCheck> {
  if (key === 'tahun_ajaran') {
    return tahunAjaran ? done(1, `Tahun ajaran aktif: ${tahunAjaran.nama}.`) : empty('Belum ada tahun ajaran aktif.')
  }
  if (!tahunAjaran) return empty('Menunggu tahun ajaran aktif.')
  if (key === 'masa_santri_baru') return checkMasaSantriBaru(tahunAwal)
  if (key === 'tarif_santri_baru') return checkTarifSantriBaru(tahunAwal)
  if (key === 'kelas_tahun_ajaran') return checkKelas(tahunAjaran.id)
  if (key === 'penempatan_kelas') return checkPenempatan(tahunAjaran.id)
  if (key === 'tes_klasifikasi') return checkTesKlasifikasi()
  if (key === 'guru_jadwal') return checkGuruJadwal(tahunAjaran.id)
  if (key === 'flow_psb') return checkPsb(tahunAwal)
  return empty('Belum ada pemeriksaan otomatis.')
}

async function requireAdmin(action: 'read' | 'update' | 'delete' = 'read') {
  const access = await assertFeature(FEATURE_PATH, action)
  if ('error' in access) return access
  if (!isAdmin(access)) return { error: 'Akses ditolak' }
  return access
}

export async function getSetupTahunAjaranState(): Promise<SetupWizardState | { error: string }> {
  const access = await requireAdmin('update')
  if ('error' in access) return access

  await ensureSetupWizardSchema()
  const tahunAjaran = await queryOne<TahunAjaranRow>(
    'SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  )
  const tahunAwal = extractTahunAwal(tahunAjaran?.nama)
  const overrides = tahunAjaran
    ? await query<{ item_key: WizardItemKey; status: SetupWizardOverrideStatus; note: string | null; updated_at: string }>(
      'SELECT item_key, status, note, updated_at FROM setup_wizard_overrides WHERE tahun_ajaran_id = ?',
      [tahunAjaran.id]
    )
    : []
  const overrideMap = new Map(overrides.map(item => [item.item_key, item]))

  const items = await Promise.all(WIZARD_ITEMS.map(async (item) => {
    const auto = await runAutoCheck(item.key, tahunAjaran, tahunAwal)
    const override = overrideMap.get(item.key) ?? null
    return {
      ...item,
      returnHref: withReturnTo(item.href),
      locked: item.key !== 'tahun_ajaran' && !tahunAjaran,
      status: override?.status ?? auto.autoStatus,
      autoStatus: auto.autoStatus,
      detail: auto.detail,
      total: auto.total ?? 0,
      completed: auto.completed ?? 0,
      override: override
        ? { status: override.status, note: override.note, updated_at: override.updated_at }
        : null,
    } satisfies SetupWizardItemState
  }))

  const doneCount = items.filter(item => item.status === 'complete' || item.status === 'skipped').length
  return {
    tahunAjaran,
    tahunAwal,
    progress: {
      total: items.length,
      done: doneCount,
      percent: items.length ? Math.round((doneCount / items.length) * 100) : 0,
    },
    items,
  }
}

export async function saveSetupWizardOverride(input: {
  itemKey: WizardItemKey
  status: SetupWizardOverrideStatus
  note?: string
}): Promise<{ success: boolean } | { error: string }> {
  const access = await requireAdmin('delete')
  if ('error' in access) return access
  await ensureSetupWizardSchema()

  const item = WIZARD_ITEMS.find(entry => entry.key === input.itemKey)
  if (!item) return { error: 'Item setup tidak ditemukan.' }
  if (!['complete', 'skipped'].includes(input.status)) return { error: 'Status override tidak valid.' }

  const tahunAjaran = await queryOne<TahunAjaranRow>(
    'SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  )
  if (!tahunAjaran) return { error: 'Aktifkan tahun ajaran terlebih dahulu.' }

  const note = String(input.note ?? '').trim() || null
  await execute(`
    INSERT INTO setup_wizard_overrides (tahun_ajaran_id, item_key, status, note, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(tahun_ajaran_id, item_key) DO UPDATE SET
      status = excluded.status,
      note = excluded.note,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `, [tahunAjaran.id, input.itemKey, input.status, note, access.id])

  await logActivity({
    actor: actorFromSession(access),
    module: 'setup_tahun_ajaran',
    action: 'update',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'setup_wizard_override',
    entityId: `${tahunAjaran.id}:${input.itemKey}`,
    entityLabel: item.title,
    summary: `Override setup ${item.title} menjadi ${input.status === 'complete' ? 'selesai' : 'dilewati'}`,
    details: { tahun_ajaran: tahunAjaran.nama, status: input.status, note },
  })

  revalidatePath(FEATURE_PATH)
  return { success: true }
}

export async function clearSetupWizardOverride(itemKey: WizardItemKey): Promise<{ success: boolean } | { error: string }> {
  const access = await requireAdmin()
  if ('error' in access) return access
  await ensureSetupWizardSchema()

  const tahunAjaran = await queryOne<TahunAjaranRow>(
    'SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  )
  if (!tahunAjaran) return { error: 'Aktifkan tahun ajaran terlebih dahulu.' }

  await execute(
    'DELETE FROM setup_wizard_overrides WHERE tahun_ajaran_id = ? AND item_key = ?',
    [tahunAjaran.id, itemKey]
  )
  await logActivity({
    actor: actorFromSession(access),
    module: 'setup_tahun_ajaran',
    action: 'delete',
    fiturHref: FEATURE_PATH,
    logKind: 'delete',
    entityType: 'setup_wizard_override',
    entityId: `${tahunAjaran.id}:${itemKey}`,
    entityLabel: itemKey,
    summary: 'Menghapus override setup tahun ajaran',
    details: { tahun_ajaran: tahunAjaran.nama, item_key: itemKey },
  })

  revalidatePath(FEATURE_PATH)
  return { success: true }
}
