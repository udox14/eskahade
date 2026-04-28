'use server'

import { batch, execute, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { syncWaliKelasFromGuruMaghrib } from '@/lib/akademik/wali-kelas-sync'

export type ActiveEvent = {
  id: number
  nama: string
  semester: number
  tahun_ajaran_nama: string
}

export type RabKategori = 'atk_administrasi' | 'konsumsi' | 'honorarium'

export type RabItem = {
  id: number
  ehb_event_id: number
  kategori: RabKategori
  nama_barang: string
  qty: number
  harga: number
  keterangan: string | null
  is_system: number
  system_key: string | null
  urutan: number
}

export type RabItemInput = {
  kategori: RabKategori
  nama_barang: string
  qty: number
  harga: number
  keterangan?: string | null
  is_system?: number
  system_key?: string | null
  urutan?: number
}

export type TransaksiTipe = 'pemasukan' | 'pengeluaran'

export type TransaksiItem = {
  id: number
  ehb_event_id: number
  tipe: TransaksiTipe
  tanggal: string
  kategori: string
  uraian: string
  qty: number
  harga: number
  nominal: number
  keterangan: string | null
  rab_item_id: number | null
  is_system: number
  system_key: string | null
  urutan: number
}

export type TransaksiInput = {
  tipe: TransaksiTipe
  tanggal: string
  kategori: string
  uraian: string
  qty?: number
  harga?: number
  nominal: number
  keterangan?: string | null
  rab_item_id?: number | null
  is_system?: number
  system_key?: string | null
  urutan?: number
}

export type HonorJenis = 'pembuatan_soal' | 'pengisian_rapor' | 'pemeriksaan_hasil' | 'pengawasan'
export type HonorWaktu = 'shubuh' | 'ashar' | 'maghrib'

export type HonorTarif = {
  pembuatan_soal: number
  pengisian_rapor: number
  pemeriksaan_hasil: number
  pengawasan: number
}

export type HonorMapelConfig = {
  id: number
  ehb_event_id: number
  marhalah_id: number | null
  marhalah_nama: string
  waktu: HonorWaktu
  jumlah_mapel: number
}

export type MapelEhbOption = {
  id: number
  nama: string
}

export type HonorItem = {
  id: string
  jenis: HonorJenis
  guru_id: number | null
  mapel_id?: number | null
  mapel_nama?: string | null
  nama: string
  qty: number
  tarif: number
  total: number
  detail: string
  editable: boolean
}

export type HonorPanitiaRow = {
  panitia_id: number
  tipe: 'inti' | 'seksi'
  jabatan_key: string | null
  seksi_key: string | null
  peran: 'ketua' | 'anggota' | null
  nama: string
  nominal: number
  keterangan: string | null
  urutan: number
}

export type HonorPanitiaData = {
  budget: number
  rows: HonorPanitiaRow[]
}

export type HonorPanitiaInput = {
  panitia_id: number
  nominal: number
  keterangan?: string | null
}

export type PemeriksaanBasis = {
  marhalah_id: number | null
  marhalah_nama: string
  jumlah_santri: number
  jumlah_mapel: number
  jumlah_hasil: number
}

export type RabAutoBasis = {
  totalHasilUjian: number
  rekomendasiRim: number
  pembuatanSoal: number
  pemeriksaan: PemeriksaanBasis[]
  raporSantri: number
  totalSesiEhb: number
  jumlahPanitia: number
  jumlahPengawas: number
}

let keuanganSchemaReady: Promise<void> | null = null

export async function ensureKeuanganSchema() {
  keuanganSchemaReady ??= ensureKeuanganSchemaOnce().catch(error => {
    keuanganSchemaReady = null
    throw error
  })
  await keuanganSchemaReady
}

async function ensureKeuanganSchemaOnce() {
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_rab_item (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      kategori       TEXT NOT NULL,
      nama_barang    TEXT NOT NULL,
      qty            REAL NOT NULL DEFAULT 0,
      harga          INTEGER NOT NULL DEFAULT 0,
      keterangan     TEXT,
      is_system      INTEGER NOT NULL DEFAULT 0,
      system_key     TEXT,
      urutan         INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_ehb_rab_item_event
    ON ehb_rab_item(ehb_event_id, kategori, urutan)
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_keuangan_transaksi (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      tipe           TEXT NOT NULL,
      tanggal        TEXT NOT NULL,
      kategori       TEXT NOT NULL,
      uraian         TEXT NOT NULL,
      qty            REAL NOT NULL DEFAULT 1,
      harga          INTEGER NOT NULL DEFAULT 0,
      nominal        INTEGER NOT NULL DEFAULT 0,
      keterangan     TEXT,
      rab_item_id    INTEGER REFERENCES ehb_rab_item(id) ON DELETE SET NULL,
      is_system      INTEGER NOT NULL DEFAULT 0,
      system_key     TEXT,
      urutan         INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_ehb_keuangan_transaksi_event
    ON ehb_keuangan_transaksi(ehb_event_id, tanggal, tipe, urutan)
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_honor_mapel_config (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      marhalah_id    INTEGER REFERENCES marhalah(id),
      waktu          TEXT NOT NULL,
      jumlah_mapel   INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, marhalah_id, waktu)
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_honor_manual (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      jenis          TEXT NOT NULL,
      guru_id        INTEGER REFERENCES data_guru(id),
      nama           TEXT NOT NULL,
      mapel_id       INTEGER REFERENCES mapel(id),
      mapel_nama     TEXT,
      qty            REAL NOT NULL DEFAULT 0,
      keterangan     TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_ehb_honor_manual_event
    ON ehb_honor_manual(ehb_event_id, jenis, nama)
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_pembuat_soal (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      mapel_id       INTEGER NOT NULL REFERENCES mapel(id),
      guru_id        INTEGER REFERENCES data_guru(id),
      nama_guru      TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, mapel_id)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_event
    ON ehb_pembuat_soal(ehb_event_id, guru_id)
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_pembuat_soal_marhalah (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      marhalah_id    INTEGER NOT NULL REFERENCES marhalah(id),
      mapel_id       INTEGER NOT NULL REFERENCES mapel(id),
      guru_id        INTEGER REFERENCES data_guru(id),
      nama_guru      TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, marhalah_id, mapel_id)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_marhalah_event
    ON ehb_pembuat_soal_marhalah(ehb_event_id, marhalah_id, guru_id)
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_pembuat_soal_scope (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      scope_type     TEXT NOT NULL,
      scope_id       TEXT NOT NULL,
      scope_nama     TEXT NOT NULL,
      marhalah_id    INTEGER REFERENCES marhalah(id),
      kelas_id       TEXT REFERENCES kelas(id),
      mapel_id       INTEGER NOT NULL REFERENCES mapel(id),
      guru_id        INTEGER REFERENCES data_guru(id),
      nama_guru      TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, scope_type, scope_id, mapel_id)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_scope_event
    ON ehb_pembuat_soal_scope(ehb_event_id, scope_type, guru_id)
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_absensi_pengawas (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id        INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      jadwal_pengawas_id  INTEGER NOT NULL REFERENCES ehb_jadwal_pengawas(id) ON DELETE CASCADE,
      status              TEXT NOT NULL DEFAULT 'HADIR',
      badal_source        TEXT,
      badal_pengawas_id   INTEGER REFERENCES ehb_pengawas(id),
      badal_panitia_id    INTEGER REFERENCES ehb_panitia(id),
      badal_nama          TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT,
      UNIQUE(ehb_event_id, jadwal_pengawas_id)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_ehb_absensi_pengawas_event
    ON ehb_absensi_pengawas(ehb_event_id, status)
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_honor_panitia (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      panitia_id     INTEGER NOT NULL REFERENCES ehb_panitia(id) ON DELETE CASCADE,
      nominal        INTEGER NOT NULL DEFAULT 0,
      keterangan     TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, panitia_id)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_ehb_honor_panitia_event
    ON ehb_honor_panitia(ehb_event_id, panitia_id)
  `)
  try {
    await execute(`ALTER TABLE ehb_honor_manual ADD COLUMN mapel_id INTEGER REFERENCES mapel(id)`)
  } catch {}
  try {
    await execute(`ALTER TABLE ehb_honor_manual ADD COLUMN mapel_nama TEXT`)
  } catch {}
  await execute(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES ('EHB', 'Keuangan', '/dashboard/ehb/keuangan', 'Wallet', '["admin"]', 1, 12)
  `)
}

export async function getActiveEventForKeuangan() {
  await ensureKeuanganSchema()
  return queryOne<ActiveEvent>(`
    SELECT e.id, e.nama, e.semester, ta.nama as tahun_ajaran_nama
    FROM ehb_event e
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.is_active = 1
    LIMIT 1
  `)
}

export async function getRabItems(eventId: number) {
  await ensureKeuanganSchema()
  return query<RabItem>(`
    SELECT id, ehb_event_id, kategori, nama_barang, qty, harga, keterangan, is_system, system_key, urutan
    FROM ehb_rab_item
    WHERE ehb_event_id = ?
    ORDER BY
      CASE kategori
        WHEN 'atk_administrasi' THEN 0
        WHEN 'konsumsi' THEN 1
        ELSE 2
      END,
      urutan,
      id
  `, [eventId])
}

export async function getKetuaPelaksanaName(eventId: number) {
  await ensureKeuanganSchema()
  const row = await queryOne<{ nama: string }>(`
    SELECT nama
    FROM ehb_panitia
    WHERE ehb_event_id = ? AND tipe = 'inti' AND jabatan_key = 'ketua'
    LIMIT 1
  `, [eventId])
  return row?.nama || ''
}

export async function getKeuanganSigners(eventId: number) {
  await ensureKeuanganSchema()
  const rows = await query<{ jabatan_key: string; nama: string }>(`
    SELECT jabatan_key, nama
    FROM ehb_panitia
    WHERE ehb_event_id = ? AND tipe = 'inti' AND jabatan_key IN ('ketua', 'bendahara')
  `, [eventId])
  return {
    ketua: rows.find(row => row.jabatan_key === 'ketua')?.nama || '',
    bendahara: rows.find(row => row.jabatan_key === 'bendahara')?.nama || '',
  }
}

export async function getRabAutoBasis(eventId: number): Promise<RabAutoBasis> {
  await ensureKeuanganSchema()

  const [pemeriksaan, raporRow, sesiRow, panitiaRow, pengawasRow, soalRow] = await Promise.all([
    query<PemeriksaanBasis>(`
      SELECT
        m.id as marhalah_id,
        COALESCE(m.nama, 'Tanpa Marhalah') as marhalah_nama,
        COUNT(DISTINCT ps.santri_id) as jumlah_santri,
        COUNT(DISTINCT j.mapel_id) as jumlah_mapel,
        COUNT(*) as jumlah_hasil
      FROM ehb_plotting_santri ps
      JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
      JOIN kelas k ON k.id = rp.kelas_id
      JOIN marhalah m ON m.id = k.marhalah_id
      JOIN ehb_jadwal j ON j.ehb_event_id = ps.ehb_event_id AND j.kelas_id = k.id
      WHERE ps.ehb_event_id = ?
      GROUP BY m.id, m.nama, m.urutan
      ORDER BY m.urutan
    `, [eventId]),
    queryOne<{ total: number }>(`
      SELECT COUNT(DISTINCT ps.santri_id) as total
      FROM ehb_plotting_santri ps
      JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id AND rp.status_riwayat = 'aktif'
      JOIN kelas k ON k.id = rp.kelas_id
      JOIN marhalah m ON m.id = k.marhalah_id
      WHERE ps.ehb_event_id = ? AND m.nama NOT LIKE '%Mutawassithah%'
    `, [eventId]),
    queryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM (
        SELECT DISTINCT tanggal, sesi_id
        FROM ehb_jadwal
        WHERE ehb_event_id = ?
      )
    `, [eventId]),
    queryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM ehb_panitia
      WHERE ehb_event_id = ?
    `, [eventId]),
    queryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM ehb_pengawas
      WHERE ehb_event_id = ?
    `, [eventId]),
    queryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM (
        SELECT DISTINCT
          CASE WHEN m.nama LIKE '%Mutawassithah%' THEN 'kelas' ELSE 'marhalah' END as scope_type,
          CASE WHEN m.nama LIKE '%Mutawassithah%' THEN k.id ELSE CAST(m.id AS TEXT) END as scope_id,
          j.mapel_id
        FROM ehb_jadwal j
        JOIN kelas k ON k.id = j.kelas_id
        JOIN marhalah m ON m.id = k.marhalah_id
        WHERE j.ehb_event_id = ?
      )
    `, [eventId]),
  ])

  const totalHasilUjian = pemeriksaan.reduce((sum, item) => sum + Number(item.jumlah_hasil || 0), 0)

  return {
    totalHasilUjian,
    rekomendasiRim: Math.max(1, Math.ceil(totalHasilUjian / 500)),
    pembuatanSoal: Number(soalRow?.total || 0),
    pemeriksaan: pemeriksaan.map(item => ({
      ...item,
      jumlah_santri: Number(item.jumlah_santri || 0),
      jumlah_mapel: Number(item.jumlah_mapel || 0),
      jumlah_hasil: Number(item.jumlah_hasil || 0),
    })),
    raporSantri: Number(raporRow?.total || 0),
    totalSesiEhb: Number(sesiRow?.total || 0),
    jumlahPanitia: Number(panitiaRow?.total || 0),
    jumlahPengawas: Number(pengawasRow?.total || 0),
  }
}

export async function saveRabItems(eventId: number, items: RabItemInput[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureKeuanganSchema()

  const cleanItems = items
    .map((item, index) => ({
      ...item,
      nama_barang: item.nama_barang.trim(),
      qty: Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0,
      harga: Math.max(0, Math.round(Number(item.harga) || 0)),
      keterangan: item.keterangan?.trim() || null,
      is_system: item.is_system ? 1 : 0,
      urutan: item.urutan ?? index + 1,
    }))
    .filter(item => item.nama_barang)

  await execute(`DELETE FROM ehb_rab_item WHERE ehb_event_id = ?`, [eventId])

  if (cleanItems.length > 0) {
    await batch(cleanItems.map(item => ({
      sql: `
        INSERT INTO ehb_rab_item
          (ehb_event_id, kategori, nama_barang, qty, harga, keterangan, is_system, system_key, urutan)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        eventId,
        item.kategori,
        item.nama_barang,
        item.qty,
        item.harga,
        item.keterangan,
        item.is_system,
        item.system_key ?? null,
        item.urutan,
      ],
    })))
  }

  revalidatePath('/dashboard/ehb/keuangan')
  return { success: true, saved: cleanItems.length }
}

export async function getTransaksiItems(eventId: number) {
  await ensureKeuanganSchema()
  return query<TransaksiItem>(`
    SELECT
      id, ehb_event_id, tipe, tanggal, kategori, uraian, qty, harga, nominal,
      keterangan, rab_item_id, is_system, system_key, urutan
    FROM ehb_keuangan_transaksi
    WHERE ehb_event_id = ?
    ORDER BY tanggal, CASE tipe WHEN 'pemasukan' THEN 0 ELSE 1 END, urutan, id
  `, [eventId])
}

export async function saveTransaksiItems(eventId: number, items: TransaksiInput[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureKeuanganSchema()

  const cleanItems = items
    .map((item, index) => {
      const qty = Number.isFinite(Number(item.qty)) ? Number(item.qty) : 1
      const harga = Math.max(0, Math.round(Number(item.harga) || 0))
      const nominal = Math.max(0, Math.round(Number(item.nominal) || qty * harga || 0))
      return {
        ...item,
        tanggal: item.tanggal || '',
        kategori: item.kategori.trim(),
        uraian: item.uraian.trim(),
        qty,
        harga,
        nominal,
        keterangan: item.keterangan?.trim() || null,
        is_system: item.is_system ? 1 : 0,
        urutan: item.urutan ?? index + 1,
      }
    })
    .filter(item => item.tanggal && item.kategori && item.uraian)

  await execute(`DELETE FROM ehb_keuangan_transaksi WHERE ehb_event_id = ?`, [eventId])

  if (cleanItems.length > 0) {
    await batch(cleanItems.map(item => ({
      sql: `
        INSERT INTO ehb_keuangan_transaksi
          (ehb_event_id, tipe, tanggal, kategori, uraian, qty, harga, nominal, keterangan, rab_item_id, is_system, system_key, urutan)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        eventId,
        item.tipe,
        item.tanggal,
        item.kategori,
        item.uraian,
        item.qty,
        item.harga,
        item.nominal,
        item.keterangan,
        item.rab_item_id ?? null,
        item.is_system,
        item.system_key ?? null,
        item.urutan,
      ],
    })))
  }

  revalidatePath('/dashboard/ehb/keuangan')
  return { success: true, saved: cleanItems.length }
}

const DEFAULT_MAPEL_BY_MARHALAH: Record<string, Record<HonorWaktu, number>> = {
  'Tamhidiyyah 1': { shubuh: 1, ashar: 2, maghrib: 1 },
  'Tamhidiyyah 2': { shubuh: 2, ashar: 2, maghrib: 0 },
  'Ibtidaiyyah 1': { shubuh: 3, ashar: 3, maghrib: 2 },
  'Ibtidaiyyah 2': { shubuh: 3, ashar: 3, maghrib: 2 },
  'Ibtidaiyyah 3': { shubuh: 3, ashar: 3, maghrib: 2 },
}

function normalizeMarhalahName(name: string) {
  return name.replace(/\s+/g, ' ').trim()
}

export async function ensureHonorMapelDefaults(eventId: number) {
  await ensureKeuanganSchema()
  const marhalahList = await query<{ id: number; nama: string }>(`
    SELECT DISTINCT m.id, m.nama
    FROM ehb_kelas_jam kj
    JOIN kelas k ON k.id = kj.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    WHERE kj.ehb_event_id = ?
    ORDER BY m.urutan
  `, [eventId])

  const existing = await query<{ marhalah_id: number; waktu: HonorWaktu }>(`
    SELECT marhalah_id, waktu
    FROM ehb_honor_mapel_config
    WHERE ehb_event_id = ?
  `, [eventId])
  const existingKeys = new Set(existing.map(row => `${row.marhalah_id}-${row.waktu}`))

  const statements: { sql: string; params?: unknown[] }[] = []
  for (const marhalah of marhalahList) {
    const normalizedName = normalizeMarhalahName(marhalah.nama)
    const defaults = DEFAULT_MAPEL_BY_MARHALAH[normalizedName] ?? { shubuh: 0, ashar: 0, maghrib: 0 }
    for (const waktu of ['shubuh', 'ashar', 'maghrib'] as HonorWaktu[]) {
      const key = `${marhalah.id}-${waktu}`
      if (existingKeys.has(key)) continue
      statements.push({
        sql: `
          INSERT INTO ehb_honor_mapel_config (ehb_event_id, marhalah_id, waktu, jumlah_mapel)
          VALUES (?, ?, ?, ?)
        `,
        params: [eventId, marhalah.id, waktu, defaults[waktu]],
      })
    }
  }

  if (statements.length > 0) await batch(statements)
}

export async function getHonorTarif(eventId: number): Promise<HonorTarif> {
  await ensureKeuanganSchema()
  const rows = await query<{ system_key: string | null; harga: number }>(`
    SELECT system_key, harga
    FROM ehb_rab_item
    WHERE ehb_event_id = ? AND kategori = 'honorarium'
  `, [eventId])

  const getPrice = (...keys: string[]) => Number(rows.find(row => row.system_key && keys.includes(row.system_key))?.harga || 0)

  return {
    pembuatan_soal: getPrice('honor_pembuatan_soal'),
    pengisian_rapor: getPrice('honor_pengisian_rapor'),
    pemeriksaan_hasil: getPrice('honor_pemeriksaan_hasil'),
    pengawasan: getPrice('honor_pengawasan'),
  }
}

export async function getHonorMapelConfig(eventId: number) {
  await ensureHonorMapelDefaults(eventId)
  return query<HonorMapelConfig>(`
    SELECT c.id, c.ehb_event_id, c.marhalah_id, m.nama as marhalah_nama, c.waktu, c.jumlah_mapel
    FROM ehb_honor_mapel_config c
    JOIN marhalah m ON m.id = c.marhalah_id
    WHERE c.ehb_event_id = ?
    ORDER BY m.urutan,
      CASE c.waktu WHEN 'shubuh' THEN 0 WHEN 'ashar' THEN 1 ELSE 2 END
  `, [eventId])
}

export async function saveHonorMapelConfig(eventId: number, configs: { marhalah_id: number; waktu: HonorWaktu; jumlah_mapel: number }[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureKeuanganSchema()

  if (configs.length > 0) {
    await batch(configs.map(config => ({
      sql: `
        INSERT INTO ehb_honor_mapel_config (ehb_event_id, marhalah_id, waktu, jumlah_mapel)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(ehb_event_id, marhalah_id, waktu) DO UPDATE SET
          jumlah_mapel = excluded.jumlah_mapel,
          updated_at = datetime('now')
      `,
      params: [eventId, config.marhalah_id, config.waktu, Math.max(0, Math.round(Number(config.jumlah_mapel) || 0))],
    })))
  }

  revalidatePath('/dashboard/ehb/keuangan')
  return { success: true, saved: configs.length }
}

export async function getGuruOptionsForHonor() {
  return query<{ id: number; nama: string }>(`
    SELECT id, nama_lengkap as nama
    FROM data_guru
    ORDER BY nama_lengkap
  `)
}

export async function getMapelEhbOptions(eventId: number) {
  await ensureKeuanganSchema()
  return query<MapelEhbOption>(`
    SELECT DISTINCT mp.id, mp.nama
    FROM ehb_jadwal j
    JOIN mapel mp ON mp.id = j.mapel_id
    WHERE j.ehb_event_id = ?
    ORDER BY mp.nama
  `, [eventId])
}

export async function getPembuatanSoalManual(eventId: number) {
  await ensureKeuanganSchema()
  const rows = await query<{ id: number; guru_id: number | null; nama: string; mapel_id: number | null; mapel_nama: string | null; qty: number; keterangan: string | null }>(`
    SELECT id, guru_id, nama, mapel_id, mapel_nama, qty, keterangan
    FROM ehb_honor_manual
    WHERE ehb_event_id = ? AND jenis = 'pembuatan_soal'
    ORDER BY nama, mapel_nama
  `, [eventId])

  if (rows.length > 0) return rows

  return []
}

export async function savePembuatanSoalManual(eventId: number, rows: { guru_id?: number | null; nama: string; mapel_id?: number | null; mapel_nama?: string | null; qty: number; keterangan?: string | null }[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureKeuanganSchema()

  const cleanRows = rows
    .map(row => ({
      guru_id: row.guru_id ?? null,
      nama: row.nama.trim(),
      mapel_id: row.mapel_id ?? null,
      mapel_nama: row.mapel_nama?.trim() || null,
      qty: Number(row.qty || 0),
      keterangan: row.keterangan?.trim() || null,
    }))
    .filter(row => row.nama && row.mapel_id && row.qty > 0)

  await execute(`DELETE FROM ehb_honor_manual WHERE ehb_event_id = ? AND jenis = 'pembuatan_soal'`, [eventId])
  if (cleanRows.length > 0) {
    await batch(cleanRows.map(row => ({
      sql: `
        INSERT INTO ehb_honor_manual (ehb_event_id, jenis, guru_id, nama, mapel_id, mapel_nama, qty, keterangan)
        VALUES (?, 'pembuatan_soal', ?, ?, ?, ?, ?, ?)
      `,
      params: [eventId, row.guru_id, row.nama, row.mapel_id, row.mapel_nama, row.qty, row.keterangan],
    })))
  }

  revalidatePath('/dashboard/ehb/keuangan')
  return { success: true, saved: cleanRows.length }
}

export async function getHonorItems(eventId: number): Promise<HonorItem[]> {
  await ensureHonorMapelDefaults(eventId)
  await syncWaliKelasFromGuruMaghrib()
  const tarif = await getHonorTarif(eventId)

  const pembuatSoalRows = await query<{ guru_id: number | null; nama: string; qty: number; detail: string }>(`
    SELECT
      ps.guru_id,
      COALESCE(dg.nama_lengkap, ps.nama_guru, 'Pembuat soal belum diatur') as nama,
      COUNT(*) as qty,
      GROUP_CONCAT(ps.scope_nama || ' - ' || mp.nama, ', ') as detail
    FROM ehb_pembuat_soal_scope ps
    JOIN mapel mp ON mp.id = ps.mapel_id
    LEFT JOIN data_guru dg ON dg.id = ps.guru_id
    WHERE ps.ehb_event_id = ? AND (ps.guru_id IS NOT NULL OR COALESCE(ps.nama_guru, '') <> '')
    GROUP BY ps.guru_id, dg.nama_lengkap, ps.nama_guru
    ORDER BY nama
  `, [eventId])

  const soalItems: HonorItem[] = pembuatSoalRows
    .filter(row => Number(row.qty || 0) > 0)
    .map(row => ({
      id: `soal-${row.guru_id ?? row.nama}`,
      jenis: 'pembuatan_soal',
      guru_id: row.guru_id,
      mapel_id: null,
      mapel_nama: null,
      nama: row.nama,
      qty: Number(row.qty || 0),
      tarif: tarif.pembuatan_soal,
      total: Number(row.qty || 0) * tarif.pembuatan_soal,
      detail: row.detail || 'Soal EHB',
      editable: false,
    }))

  const raporRows = await query<{ wali_id: string | null; nama: string; qty: number; detail: string }>(`
    SELECT
      k.wali_kelas_id as wali_id,
      COALESCE(u.full_name, 'Wali kelas belum diatur') as nama,
      COUNT(rp.santri_id) as qty,
      GROUP_CONCAT(k.nama_kelas, ', ') as detail
    FROM kelas k
    JOIN marhalah m ON m.id = k.marhalah_id
    JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN users u ON u.id = k.wali_kelas_id
    JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
    WHERE m.nama NOT LIKE '%Mutawassithah%'
    GROUP BY k.wali_kelas_id, u.full_name
    ORDER BY u.full_name
  `, [eventId])
  const raporItems: HonorItem[] = raporRows
    .filter(row => row.wali_id)
    .map(row => ({
      id: `rapor-${row.wali_id}`,
      jenis: 'pengisian_rapor',
      guru_id: null,
      nama: row.nama,
      qty: Number(row.qty || 0),
      tarif: tarif.pengisian_rapor,
      total: Number(row.qty || 0) * tarif.pengisian_rapor,
      detail: row.detail || 'Wali kelas',
      editable: false,
    }))

  const pemeriksaanRows = await query<{
    guru_id: number
    nama: string
    waktu: HonorWaktu
    nama_kelas: string
    jumlah_santri: number
    jumlah_mapel: number
  }>(`
    SELECT
      dg.id as guru_id,
      dg.nama_lengkap as nama,
      src.waktu,
      k.nama_kelas,
      COUNT(DISTINCT ps.santri_id) as jumlah_santri,
      COALESCE(cfg.jumlah_mapel, 0) as jumlah_mapel
    FROM (
      SELECT id as kelas_id, guru_shubuh_id as guru_id, 'shubuh' as waktu FROM kelas WHERE guru_shubuh_id IS NOT NULL
      UNION ALL
      SELECT id as kelas_id, guru_ashar_id as guru_id, 'ashar' as waktu FROM kelas WHERE guru_ashar_id IS NOT NULL
      UNION ALL
      SELECT id as kelas_id, guru_maghrib_id as guru_id, 'maghrib' as waktu FROM kelas WHERE guru_maghrib_id IS NOT NULL
    ) src
    JOIN kelas k ON k.id = src.kelas_id
    JOIN data_guru dg ON dg.id = src.guru_id
    JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
    JOIN ehb_plotting_santri ps ON ps.ehb_event_id = kj.ehb_event_id AND ps.santri_id IN (
      SELECT rp.santri_id FROM riwayat_pendidikan rp WHERE rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
    )
    LEFT JOIN ehb_honor_mapel_config cfg
      ON cfg.ehb_event_id = kj.ehb_event_id AND cfg.marhalah_id = k.marhalah_id AND cfg.waktu = src.waktu
    GROUP BY dg.id, dg.nama_lengkap, src.waktu, k.id, k.nama_kelas, cfg.jumlah_mapel
    HAVING jumlah_mapel > 0
    ORDER BY dg.nama_lengkap, k.nama_kelas, src.waktu
  `, [eventId])

  const pemeriksaanMap = new Map<number, HonorItem & { details: string[] }>()
  for (const row of pemeriksaanRows) {
    const qty = Number(row.jumlah_santri || 0) * Number(row.jumlah_mapel || 0)
    if (!pemeriksaanMap.has(row.guru_id)) {
      pemeriksaanMap.set(row.guru_id, {
        id: `periksa-${row.guru_id}`,
        jenis: 'pemeriksaan_hasil',
        guru_id: row.guru_id,
        nama: row.nama,
        qty: 0,
        tarif: tarif.pemeriksaan_hasil,
        total: 0,
        detail: '',
        editable: false,
        details: [],
      })
    }
    const item = pemeriksaanMap.get(row.guru_id)!
    item.qty += qty
    item.total = item.qty * item.tarif
    item.details.push(`${row.nama_kelas} ${row.waktu}: ${row.jumlah_santri} x ${row.jumlah_mapel}`)
  }
  const pemeriksaanItems = Array.from(pemeriksaanMap.values()).map(({ details, ...item }) => ({
    ...item,
    detail: details.join('; '),
  }))

  const pengawasanRows = await query<{ pengawas_id: number | null; guru_id: number | null; nama: string; qty: number; detail: string }>(`
    WITH hadir AS (
      SELECT
        p.id as pengawas_id,
        p.guru_id,
        p.nama_pengawas as nama,
        r.nomor_ruangan || ' / ' || s.label as detail
      FROM ehb_absensi_pengawas ap
      JOIN ehb_jadwal_pengawas jp ON jp.id = ap.jadwal_pengawas_id
      JOIN ehb_pengawas p ON p.id = jp.pengawas_id
      JOIN ehb_ruangan r ON r.id = jp.ruangan_id
      JOIN ehb_sesi s ON s.id = jp.sesi_id
      WHERE ap.ehb_event_id = ? AND ap.status = 'HADIR'
    ),
    badal_pengawas AS (
      SELECT
        bp.id as pengawas_id,
        bp.guru_id,
        bp.nama_pengawas as nama,
        r.nomor_ruangan || ' / ' || s.label || ' (badal)' as detail
      FROM ehb_absensi_pengawas ap
      JOIN ehb_jadwal_pengawas jp ON jp.id = ap.jadwal_pengawas_id
      JOIN ehb_pengawas bp ON bp.id = ap.badal_pengawas_id
      JOIN ehb_ruangan r ON r.id = jp.ruangan_id
      JOIN ehb_sesi s ON s.id = jp.sesi_id
      WHERE ap.ehb_event_id = ? AND ap.status = 'BADAL' AND ap.badal_source = 'pengawas'
    ),
    badal_panitia AS (
      SELECT
        NULL as pengawas_id,
        ep.guru_id,
        ep.nama as nama,
        r.nomor_ruangan || ' / ' || s.label || ' (badal)' as detail
      FROM ehb_absensi_pengawas ap
      JOIN ehb_jadwal_pengawas jp ON jp.id = ap.jadwal_pengawas_id
      JOIN ehb_panitia ep ON ep.id = ap.badal_panitia_id
      JOIN ehb_ruangan r ON r.id = jp.ruangan_id
      JOIN ehb_sesi s ON s.id = jp.sesi_id
      WHERE ap.ehb_event_id = ? AND ap.status = 'BADAL' AND ap.badal_source = 'panitia'
    ),
    badal_manual AS (
      SELECT
        NULL as pengawas_id,
        NULL as guru_id,
        ap.badal_nama as nama,
        r.nomor_ruangan || ' / ' || s.label || ' (badal)' as detail
      FROM ehb_absensi_pengawas ap
      JOIN ehb_jadwal_pengawas jp ON jp.id = ap.jadwal_pengawas_id
      JOIN ehb_ruangan r ON r.id = jp.ruangan_id
      JOIN ehb_sesi s ON s.id = jp.sesi_id
      WHERE ap.ehb_event_id = ? AND ap.status = 'BADAL' AND ap.badal_source = 'manual' AND COALESCE(ap.badal_nama, '') <> ''
    ),
    merged AS (
      SELECT * FROM hadir
      UNION ALL SELECT * FROM badal_pengawas
      UNION ALL SELECT * FROM badal_panitia
      UNION ALL SELECT * FROM badal_manual
    )
    SELECT
      pengawas_id,
      guru_id,
      nama,
      COUNT(*) as qty,
      GROUP_CONCAT(detail, ', ') as detail
    FROM merged
    GROUP BY COALESCE(CAST(pengawas_id AS TEXT), 'manual:' || nama), guru_id, nama
    ORDER BY nama
  `, [eventId, eventId, eventId, eventId])
  const pengawasanItems: HonorItem[] = pengawasanRows.map(row => ({
    id: `pengawas-${row.pengawas_id ?? row.nama}`,
    jenis: 'pengawasan',
    guru_id: row.guru_id,
    nama: row.nama,
    qty: Number(row.qty || 0),
    tarif: tarif.pengawasan,
    total: Number(row.qty || 0) * tarif.pengawasan,
    detail: row.detail || 'Jadwal pengawasan',
    editable: false,
  }))

  return [...soalItems, ...raporItems, ...pemeriksaanItems, ...pengawasanItems]
}

export async function getHonorPanitiaData(eventId: number): Promise<HonorPanitiaData> {
  await ensureKeuanganSchema()

  const [budgetRow, rows] = await Promise.all([
    queryOne<{ budget: number }>(`
      SELECT harga as budget
      FROM ehb_rab_item
      WHERE ehb_event_id = ? AND kategori = 'honorarium' AND system_key = 'honor_panitia'
      ORDER BY id
      LIMIT 1
    `, [eventId]),
    query<HonorPanitiaRow>(`
      SELECT
        p.id as panitia_id,
        p.tipe,
        p.jabatan_key,
        p.seksi_key,
        p.peran,
        p.nama,
        COALESCE(hp.nominal, 0) as nominal,
        hp.keterangan,
        p.urutan
      FROM ehb_panitia p
      LEFT JOIN ehb_honor_panitia hp
        ON hp.panitia_id = p.id AND hp.ehb_event_id = p.ehb_event_id
      WHERE p.ehb_event_id = ?
      ORDER BY
        CASE p.tipe WHEN 'inti' THEN 0 ELSE 1 END,
        p.urutan,
        p.seksi_key,
        CASE p.peran WHEN 'ketua' THEN 0 ELSE 1 END,
        p.nama
    `, [eventId]),
  ])

  return {
    budget: Number(budgetRow?.budget || 0),
    rows: rows.map(row => ({
      ...row,
      nominal: Number(row.nominal || 0),
    })),
  }
}

export async function saveHonorPanitiaBatch(eventId: number, rows: HonorPanitiaInput[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureKeuanganSchema()

  const cleanRows = rows
    .map(row => ({
      panitia_id: Number(row.panitia_id),
      nominal: Math.max(0, Math.round(Number(row.nominal) || 0)),
      keterangan: row.keterangan?.trim() || null,
    }))
    .filter(row => row.panitia_id)

  if (cleanRows.length > 0) {
    await batch(cleanRows.map(row => ({
      sql: `
        INSERT INTO ehb_honor_panitia (ehb_event_id, panitia_id, nominal, keterangan)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(ehb_event_id, panitia_id) DO UPDATE SET
          nominal = excluded.nominal,
          keterangan = excluded.keterangan,
          updated_at = datetime('now')
      `,
      params: [eventId, row.panitia_id, row.nominal, row.keterangan],
    })))
  }

  revalidatePath('/dashboard/ehb/keuangan')
  revalidatePath('/dashboard/ehb/keuangan/honor-panitia')
  return { success: true, saved: cleanRows.length }
}
