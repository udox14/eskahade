'use server'

import { batch, execute, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

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

export async function ensureKeuanganSchema() {
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
        SELECT DISTINCT j.kelas_id, j.mapel_id
        FROM ehb_jadwal j
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
