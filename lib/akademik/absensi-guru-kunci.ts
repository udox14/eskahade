import { execute, generateId, query, queryOne } from '@/lib/db'

/**
 * Kunci bulanan rekap absensi guru.
 *
 * Payroll memotong gaji berdasarkan jumlah sesi alfa dan badal di rekap ini,
 * jadi harus ada satu momen yang jelas ketika sekpen menyatakan "angka bulan
 * ini sudah benar". Sebelum momen itu bendahara tidak boleh menghitung; sesudah
 * momen itu absensi bulan tersebut tidak boleh berubah lagi.
 *
 * Ada baris di `absensi_guru_kunci` = bulan itu terkunci. Tidak ada kolom
 * status: baris yang ada lalu dihapus lebih sulit disalahbaca daripada kolom
 * boolean yang lupa di-update.
 */

export type KunciAbsensiGuru = {
  period_key: string
  locked_by: string | null
  locked_by_nama: string | null
  locked_at: string
  note: string | null
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function isPeriodKeyValid(periodKey: string): boolean {
  return PERIOD_PATTERN.test(periodKey)
}

/** 'YYYY-MM-DD' -> 'YYYY-MM'. Tanggal kosong menghasilkan string kosong. */
export function periodKeyDariTanggal(tanggal: string): string {
  return typeof tanggal === 'string' && tanggal.length >= 7 ? tanggal.slice(0, 7) : ''
}

export function rentangBulan(periodKey: string): { from: string; to: string } {
  const [year, month] = periodKey.split('-').map(Number)
  // Tanggal 0 bulan berikutnya = hari terakhir bulan ini, sekaligus benar untuk
  // Februari kabisat tanpa tabel jumlah hari.
  const akhir = new Date(Date.UTC(year, month, 0))
  return { from: `${periodKey}-01`, to: akhir.toISOString().slice(0, 10) }
}

export async function ensureKunciSchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS absensi_guru_kunci (
      period_key     TEXT PRIMARY KEY,
      locked_by      TEXT,
      locked_by_nama TEXT,
      locked_at      TEXT NOT NULL DEFAULT (datetime('now')),
      note           TEXT
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS absensi_guru_kunci_log (
      id         TEXT PRIMARY KEY,
      period_key TEXT NOT NULL,
      action     TEXT NOT NULL CHECK (action IN ('KUNCI', 'BUKA')),
      actor_id   TEXT,
      actor_nama TEXT,
      note       TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_absensi_guru_kunci_log_period
    ON absensi_guru_kunci_log(period_key, created_at DESC)
  `)
}

export async function getKunciAbsensiGuru(periodKey: string): Promise<KunciAbsensiGuru | null> {
  if (!isPeriodKeyValid(periodKey)) return null
  await ensureKunciSchema()
  return queryOne<KunciAbsensiGuru>(
    `SELECT period_key, locked_by, locked_by_nama, locked_at, note
     FROM absensi_guru_kunci WHERE period_key = ?`,
    [periodKey]
  )
}

export async function listKunciAbsensiGuru(limit = 24): Promise<KunciAbsensiGuru[]> {
  await ensureKunciSchema()
  return query<KunciAbsensiGuru>(
    `SELECT period_key, locked_by, locked_by_nama, locked_at, note
     FROM absensi_guru_kunci ORDER BY period_key DESC LIMIT ?`,
    [limit]
  )
}

/**
 * Bulan mana saja dalam rentang tanggal ini yang sudah terkunci. Dipakai untuk
 * menolak penyimpanan absensi, termasuk saat satu penyimpanan menyentuh dua
 * bulan sekaligus (mis. impor Excel lintas bulan).
 */
export async function bulanTerkunciDalamRentang(tanggalList: string[]): Promise<string[]> {
  const periods = [...new Set(tanggalList.map(periodKeyDariTanggal).filter(isPeriodKeyValid))]
  if (!periods.length) return []
  await ensureKunciSchema()
  const rows = await query<{ period_key: string }>(
    `SELECT period_key FROM absensi_guru_kunci
     WHERE period_key IN (${periods.map(() => '?').join(',')})`,
    periods
  )
  return rows.map(row => row.period_key).sort()
}

export async function kunciAbsensiGuru(input: {
  periodKey: string
  actorId: string | null
  actorNama: string | null
  note?: string | null
}): Promise<{ success: boolean; error?: string }> {
  if (!isPeriodKeyValid(input.periodKey)) return { success: false, error: 'Format bulan tidak valid.' }
  await ensureKunciSchema()

  const sudah = await getKunciAbsensiGuru(input.periodKey)
  if (sudah) return { success: false, error: `Rekap ${input.periodKey} sudah terkunci.` }

  const note = input.note?.trim() || null
  await execute(
    `INSERT INTO absensi_guru_kunci (period_key, locked_by, locked_by_nama, locked_at, note)
     VALUES (?, ?, ?, datetime('now'), ?)`,
    [input.periodKey, input.actorId, input.actorNama, note]
  )
  await execute(
    `INSERT INTO absensi_guru_kunci_log (id, period_key, action, actor_id, actor_nama, note)
     VALUES (?, ?, 'KUNCI', ?, ?, ?)`,
    [generateId(), input.periodKey, input.actorId, input.actorNama, note]
  )
  return { success: true }
}

/**
 * Membuka kunci hanya boleh selama payroll bulan itu belum disetujui. Setelah
 * disetujui, angka potongan sudah masuk jurnal akrual dan tidak bisa ditarik
 * kembali dari pembukuan hanya karena absensinya dikoreksi belakangan.
 *
 * Pengecekan payroll dititipkan lewat `payrollTerkunci` supaya modul akademik
 * tidak perlu mengimpor lapisan keuangan; pemanggil di server action yang
 * menyediakannya.
 */
export async function bukaKunciAbsensiGuru(input: {
  periodKey: string
  actorId: string | null
  actorNama: string | null
  note?: string | null
  payrollTerkunci?: () => Promise<string | null>
}): Promise<{ success: boolean; error?: string }> {
  if (!isPeriodKeyValid(input.periodKey)) return { success: false, error: 'Format bulan tidak valid.' }
  await ensureKunciSchema()

  const sudah = await getKunciAbsensiGuru(input.periodKey)
  if (!sudah) return { success: false, error: `Rekap ${input.periodKey} memang belum terkunci.` }

  if (input.payrollTerkunci) {
    const alasan = await input.payrollTerkunci()
    if (alasan) return { success: false, error: alasan }
  }

  const note = input.note?.trim() || null
  await execute(`DELETE FROM absensi_guru_kunci WHERE period_key = ?`, [input.periodKey])
  await execute(
    `INSERT INTO absensi_guru_kunci_log (id, period_key, action, actor_id, actor_nama, note)
     VALUES (?, ?, 'BUKA', ?, ?, ?)`,
    [generateId(), input.periodKey, input.actorId, input.actorNama, note]
  )
  return { success: true }
}
