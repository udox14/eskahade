import { execute, query, queryOne } from '@/lib/db'
import { getSession, hasAnyRole, isAdmin, type SessionUser } from '@/lib/auth/session'

export type GuruKelasAccessRow = {
  id: string
  nama_kelas: string
  marhalah_id: number | null
  marhalah_nama: string | null
  tahun_ajaran_id: number | null
  tahun_ajaran_nama: string | null
}

let guruFeatureSchemaReady: Promise<void> | null = null

export const HAFALAN_TYPES = [
  { key: 'quran', label: "Hafalan Al-Qur'an" },
  { key: 'hadits', label: 'Hafalan Hadits' },
  { key: 'jurumiyah', label: 'Hafalan Jurumiyah' },
  { key: 'amtsilah', label: 'Hafalan Amtsilah' },
  { key: 'alfiyah', label: 'Hafalan Alfiyah' },
] as const

export type HafalanType = typeof HAFALAN_TYPES[number]['key']

export const QURAN_SURAHS = [
  { number: 1, name: 'Al-Fatihah', ayahCount: 7 },
  { number: 2, name: 'Al-Baqarah', ayahCount: 286 },
  { number: 3, name: 'Ali Imran', ayahCount: 200 },
  { number: 4, name: 'An-Nisa', ayahCount: 176 },
  { number: 5, name: "Al-Ma'idah", ayahCount: 120 },
  { number: 6, name: "Al-An'am", ayahCount: 165 },
  { number: 7, name: "Al-A'raf", ayahCount: 206 },
  { number: 8, name: 'Al-Anfal', ayahCount: 75 },
  { number: 9, name: 'At-Taubah', ayahCount: 129 },
  { number: 10, name: 'Yunus', ayahCount: 109 },
  { number: 11, name: 'Hud', ayahCount: 123 },
  { number: 12, name: 'Yusuf', ayahCount: 111 },
  { number: 13, name: "Ar-Ra'd", ayahCount: 43 },
  { number: 14, name: 'Ibrahim', ayahCount: 52 },
  { number: 15, name: 'Al-Hijr', ayahCount: 99 },
  { number: 16, name: 'An-Nahl', ayahCount: 128 },
  { number: 17, name: 'Al-Isra', ayahCount: 111 },
  { number: 18, name: 'Al-Kahf', ayahCount: 110 },
  { number: 19, name: 'Maryam', ayahCount: 98 },
  { number: 20, name: 'Taha', ayahCount: 135 },
  { number: 21, name: 'Al-Anbiya', ayahCount: 112 },
  { number: 22, name: 'Al-Hajj', ayahCount: 78 },
  { number: 23, name: "Al-Mu'minun", ayahCount: 118 },
  { number: 24, name: 'An-Nur', ayahCount: 64 },
  { number: 25, name: 'Al-Furqan', ayahCount: 77 },
  { number: 26, name: "Ash-Shu'ara", ayahCount: 227 },
  { number: 27, name: 'An-Naml', ayahCount: 93 },
  { number: 28, name: 'Al-Qasas', ayahCount: 88 },
  { number: 29, name: 'Al-Ankabut', ayahCount: 69 },
  { number: 30, name: 'Ar-Rum', ayahCount: 60 },
  { number: 31, name: 'Luqman', ayahCount: 34 },
  { number: 32, name: 'As-Sajdah', ayahCount: 30 },
  { number: 33, name: 'Al-Ahzab', ayahCount: 73 },
  { number: 34, name: 'Saba', ayahCount: 54 },
  { number: 35, name: 'Fatir', ayahCount: 45 },
  { number: 36, name: 'Yasin', ayahCount: 83 },
  { number: 37, name: 'As-Saffat', ayahCount: 182 },
  { number: 38, name: 'Sad', ayahCount: 88 },
  { number: 39, name: 'Az-Zumar', ayahCount: 75 },
  { number: 40, name: 'Ghafir', ayahCount: 85 },
  { number: 41, name: 'Fussilat', ayahCount: 54 },
  { number: 42, name: 'Ash-Shura', ayahCount: 53 },
  { number: 43, name: 'Az-Zukhruf', ayahCount: 89 },
  { number: 44, name: 'Ad-Dukhan', ayahCount: 59 },
  { number: 45, name: 'Al-Jathiyah', ayahCount: 37 },
  { number: 46, name: 'Al-Ahqaf', ayahCount: 35 },
  { number: 47, name: 'Muhammad', ayahCount: 38 },
  { number: 48, name: 'Al-Fath', ayahCount: 29 },
  { number: 49, name: 'Al-Hujurat', ayahCount: 18 },
  { number: 50, name: 'Qaf', ayahCount: 45 },
  { number: 51, name: 'Adh-Dhariyat', ayahCount: 60 },
  { number: 52, name: 'At-Tur', ayahCount: 49 },
  { number: 53, name: 'An-Najm', ayahCount: 62 },
  { number: 54, name: 'Al-Qamar', ayahCount: 55 },
  { number: 55, name: 'Ar-Rahman', ayahCount: 78 },
  { number: 56, name: "Al-Waqi'ah", ayahCount: 96 },
  { number: 57, name: 'Al-Hadid', ayahCount: 29 },
  { number: 58, name: 'Al-Mujadilah', ayahCount: 22 },
  { number: 59, name: 'Al-Hashr', ayahCount: 24 },
  { number: 60, name: 'Al-Mumtahanah', ayahCount: 13 },
  { number: 61, name: 'As-Saff', ayahCount: 14 },
  { number: 62, name: "Al-Jumu'ah", ayahCount: 11 },
  { number: 63, name: 'Al-Munafiqun', ayahCount: 11 },
  { number: 64, name: 'At-Taghabun', ayahCount: 18 },
  { number: 65, name: 'At-Talaq', ayahCount: 12 },
  { number: 66, name: 'At-Tahrim', ayahCount: 12 },
  { number: 67, name: 'Al-Mulk', ayahCount: 30 },
  { number: 68, name: 'Al-Qalam', ayahCount: 52 },
  { number: 69, name: 'Al-Haqqah', ayahCount: 52 },
  { number: 70, name: "Al-Ma'arij", ayahCount: 44 },
  { number: 71, name: 'Nuh', ayahCount: 28 },
  { number: 72, name: 'Al-Jinn', ayahCount: 28 },
  { number: 73, name: 'Al-Muzzammil', ayahCount: 20 },
  { number: 74, name: 'Al-Muddaththir', ayahCount: 56 },
  { number: 75, name: 'Al-Qiyamah', ayahCount: 40 },
  { number: 76, name: 'Al-Insan', ayahCount: 31 },
  { number: 77, name: 'Al-Mursalat', ayahCount: 50 },
  { number: 78, name: 'An-Naba', ayahCount: 40 },
  { number: 79, name: "An-Nazi'at", ayahCount: 46 },
  { number: 80, name: 'Abasa', ayahCount: 42 },
  { number: 81, name: 'At-Takwir', ayahCount: 29 },
  { number: 82, name: 'Al-Infitar', ayahCount: 19 },
  { number: 83, name: 'Al-Mutaffifin', ayahCount: 36 },
  { number: 84, name: 'Al-Inshiqaq', ayahCount: 25 },
  { number: 85, name: 'Al-Buruj', ayahCount: 22 },
  { number: 86, name: 'At-Tariq', ayahCount: 17 },
  { number: 87, name: "Al-A'la", ayahCount: 19 },
  { number: 88, name: 'Al-Ghashiyah', ayahCount: 26 },
  { number: 89, name: 'Al-Fajr', ayahCount: 30 },
  { number: 90, name: 'Al-Balad', ayahCount: 20 },
  { number: 91, name: 'Ash-Shams', ayahCount: 15 },
  { number: 92, name: 'Al-Lail', ayahCount: 21 },
  { number: 93, name: 'Ad-Duha', ayahCount: 11 },
  { number: 94, name: 'Ash-Sharh', ayahCount: 8 },
  { number: 95, name: 'At-Tin', ayahCount: 8 },
  { number: 96, name: 'Al-Alaq', ayahCount: 19 },
  { number: 97, name: 'Al-Qadr', ayahCount: 5 },
  { number: 98, name: 'Al-Bayyinah', ayahCount: 8 },
  { number: 99, name: 'Az-Zalzalah', ayahCount: 8 },
  { number: 100, name: 'Al-Adiyat', ayahCount: 11 },
  { number: 101, name: "Al-Qari'ah", ayahCount: 11 },
  { number: 102, name: 'At-Takathur', ayahCount: 8 },
  { number: 103, name: 'Al-Asr', ayahCount: 3 },
  { number: 104, name: 'Al-Humazah', ayahCount: 9 },
  { number: 105, name: 'Al-Fil', ayahCount: 5 },
  { number: 106, name: 'Quraysh', ayahCount: 4 },
  { number: 107, name: "Al-Ma'un", ayahCount: 7 },
  { number: 108, name: 'Al-Kawthar', ayahCount: 3 },
  { number: 109, name: 'Al-Kafirun', ayahCount: 6 },
  { number: 110, name: 'An-Nasr', ayahCount: 3 },
  { number: 111, name: 'Al-Masad', ayahCount: 5 },
  { number: 112, name: 'Al-Ikhlas', ayahCount: 4 },
  { number: 113, name: 'Al-Falaq', ayahCount: 5 },
  { number: 114, name: 'An-Nas', ayahCount: 6 },
] as const

export function isHafalanType(value: string): value is HafalanType {
  return HAFALAN_TYPES.some(type => type.key === value)
}

export async function ensureGuruFeatureSchema() {
  guruFeatureSchemaReady ??= ensureGuruFeatureSchemaOnce().catch(error => {
    guruFeatureSchemaReady = null
    throw error
  })
  await guruFeatureSchemaReady
}

async function ensureGuruFeatureSchemaOnce() {
  await execute(`
    CREATE TABLE IF NOT EXISTS nilai_harian_sesi (
      id TEXT PRIMARY KEY,
      kelas_id TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      mapel_id INTEGER NOT NULL REFERENCES mapel(id),
      guru_id INTEGER REFERENCES data_guru(id),
      tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id),
      tanggal TEXT NOT NULL,
      nama_sesi TEXT NOT NULL,
      kkm INTEGER NOT NULL DEFAULT 0,
      deskripsi TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS nilai_harian_detail (
      id TEXT PRIMARY KEY,
      sesi_id TEXT NOT NULL REFERENCES nilai_harian_sesi(id) ON DELETE CASCADE,
      riwayat_pendidikan_id TEXT NOT NULL REFERENCES riwayat_pendidikan(id) ON DELETE CASCADE,
      nilai INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(sesi_id, riwayat_pendidikan_id)
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS hafalan_bab (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jenis TEXT NOT NULL,
      marhalah_id INTEGER NOT NULL REFERENCES marhalah(id),
      parent_id INTEGER REFERENCES hafalan_bab(id) ON DELETE CASCADE,
      judul TEXT NOT NULL,
      urutan INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS hafalan_blok (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bab_id INTEGER NOT NULL REFERENCES hafalan_bab(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      deskripsi TEXT,
      urutan INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS hafalan_progress (
      id TEXT PRIMARY KEY,
      blok_id INTEGER NOT NULL REFERENCES hafalan_blok(id) ON DELETE CASCADE,
      riwayat_pendidikan_id TEXT NOT NULL REFERENCES riwayat_pendidikan(id) ON DELETE CASCADE,
      guru_id INTEGER REFERENCES data_guru(id),
      status TEXT NOT NULL DEFAULT 'hafal',
      tanggal_setor TEXT NOT NULL DEFAULT (date('now')),
      updated_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(blok_id, riwayat_pendidikan_id)
    )
  `)
  await execute('CREATE INDEX IF NOT EXISTS idx_nilai_harian_sesi_kelas ON nilai_harian_sesi(kelas_id, mapel_id, tanggal)')
  await execute('CREATE INDEX IF NOT EXISTS idx_nilai_harian_detail_sesi ON nilai_harian_detail(sesi_id)')
  try {
    await execute('ALTER TABLE hafalan_bab ADD COLUMN parent_id INTEGER REFERENCES hafalan_bab(id) ON DELETE CASCADE')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }
  await execute('CREATE INDEX IF NOT EXISTS idx_hafalan_bab_lookup ON hafalan_bab(jenis, marhalah_id, is_active, urutan)')
  await execute('CREATE INDEX IF NOT EXISTS idx_hafalan_bab_parent ON hafalan_bab(parent_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_hafalan_blok_bab ON hafalan_blok(bab_id, is_active, urutan)')
  await execute('CREATE INDEX IF NOT EXISTS idx_hafalan_progress_riwayat ON hafalan_progress(riwayat_pendidikan_id)')
  await execute(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan)
    VALUES
      ('Akademik', 'Nilai Harian', '/dashboard/guru/nilai-harian', 'BookOpen', '["admin","sekpen","akademik","guru"]', 1, 8, 1, 3),
      ('Akademik', 'Hafalan', '/dashboard/guru/hafalan', 'ClipboardCheck', '["admin","sekpen","akademik","guru"]', 1, 9, 1, 4),
      ('Master Data', 'Master Hafalan', '/dashboard/master/hafalan', 'Database', '["admin"]', 1, 11, 0, 0)
  `)
}

export async function getGuruIdForSession(session: SessionUser | null): Promise<number | null> {
  if (!session) return null
  const row = await queryOne<{ source_type: string | null; source_ref_id: string | null }>(
    'SELECT source_type, source_ref_id FROM users WHERE id = ?',
    [session.id]
  )
  if (row?.source_type !== 'guru') return null
  const guruId = Number(row.source_ref_id)
  return Number.isFinite(guruId) && guruId > 0 ? guruId : null
}

export async function getAccessibleKelasForSession(session?: SessionUser | null): Promise<GuruKelasAccessRow[]> {
  await ensureGuruFeatureSchema()
  const activeSession = session ?? await getSession()
  if (!activeSession) return []

  const unrestricted = isAdmin(activeSession) || hasAnyRole(activeSession, ['sekpen', 'akademik'])
  if (unrestricted) {
    const rows = await query<GuruKelasAccessRow>(`
      SELECT k.id, k.nama_kelas, k.marhalah_id, m.nama AS marhalah_nama,
             k.tahun_ajaran_id, ta.nama AS tahun_ajaran_nama
      FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      LEFT JOIN marhalah m ON m.id = k.marhalah_id
    `)
    return sortKelasNaturally(rows)
  }

  const guruId = await getGuruIdForSession(activeSession)
  if (!guruId) return []

  const rows = await query<GuruKelasAccessRow>(`
    SELECT DISTINCT k.id, k.nama_kelas, k.marhalah_id, m.nama AS marhalah_nama,
           k.tahun_ajaran_id, ta.nama AS tahun_ajaran_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN kelas_jadwal_guru_mingguan kj ON kj.kelas_id = k.id AND kj.guru_id = ?
    WHERE kj.id IS NOT NULL
       OR k.guru_shubuh_id = ?
       OR k.guru_ashar_id = ?
       OR k.guru_maghrib_id = ?
    ORDER BY k.nama_kelas
  `, [guruId, guruId, guruId, guruId])

  return sortKelasNaturally(rows)
}

function sortKelasNaturally(rows: GuruKelasAccessRow[]) {
  return [...rows].sort((a, b) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function canAccessKelas(session: SessionUser | null, kelasId: string) {
  if (!session || !kelasId) return false
  if (isAdmin(session) || hasAnyRole(session, ['sekpen', 'akademik'])) return true
  const kelas = await getAccessibleKelasForSession(session)
  return kelas.some(item => item.id === kelasId)
}

export async function getSantriForKelas(kelasId: string) {
  return query<{ riwayat_id: string; santri_id: string; nis: string | null; nama: string }>(`
    SELECT rp.id AS riwayat_id, s.id AS santri_id, s.nis, s.nama_lengkap AS nama
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])
}
