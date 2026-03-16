'use server'

import { query, queryOne } from '@/lib/db'

const PAGE_SIZE = 30

// ─── Helper: range bulan ──────────────────────────────────────────────────
function getMonthRange(tahun: number, bulan: number) {
  const mm = String(bulan).padStart(2, '0')
  const lastDay = new Date(tahun, bulan, 0).getDate()
  return {
    start: `${tahun}-${mm}-01`,
    end:   `${tahun}-${mm}-${String(lastDay).padStart(2, '0')} 23:59:59`,
  }
}

// ─── Summary per asrama (dengan filter bulan) ─────────────────────────────
// Strategi: 2 query flat lalu join di memory — tidak ada subquery per-asrama
export async function getSummaryPerAsrama(tahun: number, bulan: number) {
  const { start, end } = getMonthRange(tahun, bulan)

  // Query 1: data santri per asrama (dari tabel santri, ringan)
  const santriRows = await query<{
    asrama: string
    total_santri: number
    total_saldo: number
    punya_saldo: number
    tidak_punya_saldo: number
  }>(`
    SELECT
      asrama,
      COUNT(*)                                                             AS total_santri,
      COALESCE(SUM(saldo_tabungan), 0)                                     AS total_saldo,
      SUM(CASE WHEN COALESCE(saldo_tabungan,0) > 0 THEN 1 ELSE 0 END)     AS punya_saldo,
      SUM(CASE WHEN COALESCE(saldo_tabungan,0) = 0 THEN 1 ELSE 0 END)     AS tidak_punya_saldo
    FROM santri
    WHERE status_global = 'aktif' AND asrama IS NOT NULL
    GROUP BY asrama ORDER BY asrama
  `, [])

  // Query 2: mutasi bulan ini per asrama (1 JOIN + GROUP BY, index dipakai)
  const mutasiRows = await query<{
    asrama: string
    masuk: number
    keluar: number
    cnt_masuk: number
  }>(`
    SELECT
      s.asrama,
      COALESCE(SUM(CASE WHEN tl.jenis='MASUK'  THEN tl.nominal ELSE 0 END),0) AS masuk,
      COALESCE(SUM(CASE WHEN tl.jenis='KELUAR' THEN tl.nominal ELSE 0 END),0) AS keluar,
      COUNT(DISTINCT CASE WHEN tl.jenis='MASUK' THEN tl.santri_id END)        AS cnt_masuk
    FROM tabungan_log tl
    INNER JOIN santri s ON s.id = tl.santri_id AND s.status_global = 'aktif'
    WHERE tl.created_at >= ? AND tl.created_at <= ?
    GROUP BY s.asrama
  `, [start, end])

  const mutasiMap = new Map(mutasiRows.map(r => [r.asrama, r]))
  return santriRows.map(r => {
    const m = mutasiMap.get(r.asrama)
    return {
      ...r,
      masuk_bulan_ini:        m?.masuk     ?? 0,
      keluar_bulan_ini:       m?.keluar    ?? 0,
      santri_topup_bulan_ini: m?.cnt_masuk ?? 0,
    }
  })
}

// ─── Daftar asrama ────────────────────────────────────────────────────────
export async function getAsramaList() {
  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama FROM santri
     WHERE status_global='aktif' AND asrama IS NOT NULL ORDER BY asrama`
  )
  return rows.map(r => r.asrama)
}

// ─── Daftar kamar per asrama ──────────────────────────────────────────────
export async function getKamarList(asrama: string) {
  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar FROM santri WHERE asrama=? AND status_global='aktif'
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [asrama]
  )
  return rows.map(r => r.kamar)
}

// ─── Tabel santri (lazy + pagination + filter bulan) ─────────────────────
// Row reads hemat:
// - saldo_tabungan: langsung dari kolom santri
// - masuk + keluar: 1 query aggregate untuk SEMUA santri di halaman (max 30)
//   pakai IN(id1,id2,...) — tidak ada subquery per baris
export async function getSantriUangJajan(params: {
  tahun: number
  bulan: number
  asrama?: string
  kamar?: string
  search?: string
  page?: number
  filterSaldo?: 'SEMUA' | 'PUNYA' | 'KOSONG'
}) {
  const { tahun, bulan, asrama, kamar, search, page=1, filterSaldo='SEMUA' } = params
  const { start, end } = getMonthRange(tahun, bulan)
  const offset = (page - 1) * PAGE_SIZE

  const clauses: string[] = ["s.status_global='aktif'"]
  const baseParams: any[] = []

  if (asrama) { clauses.push('s.asrama=?'); baseParams.push(asrama) }
  if (kamar)  { clauses.push('s.kamar=?');  baseParams.push(kamar) }
  if (search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    baseParams.push(`%${search}%`, `%${search}%`)
  }
  if (filterSaldo === 'PUNYA')  clauses.push('COALESCE(s.saldo_tabungan,0) > 0')
  if (filterSaldo === 'KOSONG') clauses.push('COALESCE(s.saldo_tabungan,0) = 0')

  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s WHERE ${where}`, baseParams
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows:[], total:0, page:1, totalPages:0, pageSize:PAGE_SIZE }

  // Ambil santri halaman ini
  const santriRows = await query<{
    id: string; nama_lengkap: string; nis: string
    asrama: string; kamar: string; saldo: number
  }>(
    `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
            COALESCE(s.saldo_tabungan,0) AS saldo
     FROM santri s WHERE ${where}
     ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
     LIMIT ? OFFSET ?`,
    [...baseParams, PAGE_SIZE, offset]
  )
  if (!santriRows.length) return { rows:[], total, page, totalPages:Math.ceil(total/PAGE_SIZE), pageSize:PAGE_SIZE }

  // 1 query aggregate untuk semua santri di halaman (max 30 IN params)
  const ids = santriRows.map(r => r.id)
  const ph  = ids.map(() => '?').join(',')

  const mutasiRows = await query<{
    santri_id: string
    masuk: number; keluar: number
    terakhir_masuk: string|null; terakhir_keluar: string|null
  }>(
    `SELECT santri_id,
       COALESCE(SUM(CASE WHEN jenis='MASUK'  THEN nominal ELSE 0 END),0) AS masuk,
       COALESCE(SUM(CASE WHEN jenis='KELUAR' THEN nominal ELSE 0 END),0) AS keluar,
       MAX(CASE WHEN jenis='MASUK'  THEN created_at END) AS terakhir_masuk,
       MAX(CASE WHEN jenis='KELUAR' THEN created_at END) AS terakhir_keluar
     FROM tabungan_log
     WHERE santri_id IN (${ph}) AND created_at>=? AND created_at<=?
     GROUP BY santri_id`,
    [...ids, start, end]
  )

  const mm = new Map(mutasiRows.map(r => [r.santri_id, r]))
  const rows = santriRows.map(s => {
    const m = mm.get(s.id)
    return {
      ...s,
      masuk_bulan_ini:  m?.masuk           ?? 0,
      keluar_bulan_ini: m?.keluar          ?? 0,
      terakhir_masuk:   m?.terakhir_masuk  ?? null,
      terakhir_keluar:  m?.terakhir_keluar ?? null,
    }
  })

  return { rows, total, page, totalPages:Math.ceil(total/PAGE_SIZE), pageSize:PAGE_SIZE }
}

// ─── Detail transaksi per santri (expand inline, lazy) ───────────────────
export async function getDetailTransaksiSantri(santriId: string, tahun: number, bulan: number) {
  const { start, end } = getMonthRange(tahun, bulan)
  return query<{
    id: string; jenis: string; nominal: number
    keterangan: string|null; created_at: string; admin_nama: string|null
  }>(
    `SELECT tl.id, tl.jenis, tl.nominal, tl.keterangan,
            tl.created_at, u.full_name AS admin_nama
     FROM tabungan_log tl
     LEFT JOIN users u ON u.id=tl.created_by
     WHERE tl.santri_id=? AND tl.created_at>=? AND tl.created_at<=?
     ORDER BY tl.created_at DESC`,
    [santriId, start, end]
  )
}
