'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const PAGE_SIZE = 50

export async function getClientRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

// ─── Tarif SPP aktif untuk tahun tertentu ────────────────────────────────
export async function getSppSettings(tahun: number) {
  const row = await queryOne<{ nominal: number; tahun_kalender: number; tanggal_tutup_buku: number }>(
    `SELECT nominal, tahun_kalender, COALESCE(tanggal_tutup_buku, 10) as tanggal_tutup_buku
     FROM spp_settings WHERE tahun_kalender = ? AND is_active = 1
     ORDER BY id DESC LIMIT 1`,
    [tahun]
  )
  return row ?? { nominal: 70000, tahun_kalender: tahun, tanggal_tutup_buku: 10 }
}

// ─── Update tanggal tutup buku ────────────────────────────────────────────
export async function updateTanggalTutupBuku(tahun: number, tanggal: number): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session || !['admin', 'dewan_santri', 'bendahara'].includes(session.role)) {
    return { error: 'Akses ditolak' }
  }
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM spp_settings WHERE tahun_kalender = ? AND is_active = 1 LIMIT 1`,
    [tahun]
  )
  if (existing) {
    await execute(
      `UPDATE spp_settings SET tanggal_tutup_buku = ? WHERE tahun_kalender = ? AND is_active = 1`,
      [tanggal, tahun]
    )
  } else {
    await execute(
      `INSERT INTO spp_settings (tahun_kalender, nominal, is_active, tanggal_tutup_buku) VALUES (?, 70000, 1, ?)`,
      [tahun, tanggal]
    )
  }
  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}

// ─── Monitoring setoran per asrama ───────────────────────────────────────
// Strategi hemat row reads:
// - Query 1: aggregate santri per asrama dari tabel santri (ringan, no join besar)
// - Query 2: aggregate spp_log bulan ini — 1 JOIN + GROUP BY, index (tahun,bulan) dipakai
// - Query 3: aggregate spp_log bulan lalu — sama
// - Semua digabung di memory, tidak ada CTE correlated
export async function getMonitoringSetoran(tahun: number, bulan: number) {
  const bulanSebelumnya = bulan === 1 ? 12 : bulan - 1
  const tahunSebelumnya = bulan === 1 ? tahun - 1 : tahun

  // Query 1: data santri per asrama (hanya baca tabel santri)
  const santriRows = await query<{
    asrama: string
    total_santri: number
    bebas_spp: number
    wajib_bayar: number
  }>(`
    SELECT
      asrama,
      COUNT(*)                                                       AS total_santri,
      COALESCE(SUM(bebas_spp), 0)                                    AS bebas_spp,
      COUNT(*) - COALESCE(SUM(bebas_spp), 0)                         AS wajib_bayar
    FROM santri
    WHERE status_global = 'aktif' AND asrama IS NOT NULL
    GROUP BY asrama
    ORDER BY asrama
  `, [])

  // Query 2: siapa bayar bulan ini + total nominal (1 JOIN flat, index tahun+bulan)
  const bayarIniRows = await query<{
    asrama: string
    jumlah_bayar: number
    total_nominal: number
  }>(`
    SELECT s.asrama,
           COUNT(DISTINCT sl.santri_id)  AS jumlah_bayar,
           SUM(sl.nominal_bayar)         AS total_nominal
    FROM spp_log sl
    INNER JOIN santri s ON s.id = sl.santri_id AND s.status_global = 'aktif'
    WHERE sl.tahun = ? AND sl.bulan = ?
    GROUP BY s.asrama
  `, [tahun, bulan])

  // Query 3: siapa bayar tunggakan bulan lalu tapi TIDAK bayar bulan ini
  // Pakai LEFT JOIN untuk deteksi "bayar lalu tapi tidak ini" di memory
  const bayarLaluRows = await query<{
    asrama: string
    santri_id: string
  }>(`
    SELECT s.asrama, sl.santri_id
    FROM spp_log sl
    INNER JOIN santri s ON s.id = sl.santri_id AND s.status_global = 'aktif'
    WHERE sl.tahun = ? AND sl.bulan = ?
  `, [tahunSebelumnya, bulanSebelumnya])

  // Query 4: siapa bayar bulan ini (untuk exclusion tunggakan)
  const bayarIniSet = new Set(bayarIniRows.flatMap(r =>
    // kita butuh set of santri_id yang bayar ini — query terpisah ringan
    [] as string[]
  ))
  // Ambil set santri_id yang bayar bulan ini
  const bayarIniIds = await query<{ santri_id: string }>(
    `SELECT DISTINCT santri_id FROM spp_log WHERE tahun = ? AND bulan = ?`,
    [tahun, bulan]
  )
  const bayarIniIdSet = new Set(bayarIniIds.map(r => r.santri_id))

  // Gabung di memory — O(n)
  const bayarIniMap  = new Map(bayarIniRows.map(r => [r.asrama, r]))

  // Hitung bayar tunggakan (bayar bulan lalu tapi tidak bayar bulan ini) per asrama
  const tunggakanMap = new Map<string, number>()
  for (const r of bayarLaluRows) {
    if (!bayarIniIdSet.has(r.santri_id)) {
      tunggakanMap.set(r.asrama, (tunggakanMap.get(r.asrama) ?? 0) + 1)
    }
  }

  // Query 5: data setoran dari pengurus
  const setoranRows = await query<{
    asrama: string
    tanggal_setor: string | null
    tanggal_terima: string | null
    nama_penyetor: string | null
    jumlah_aktual: number
    jumlah_bulan_ini: number
    jumlah_tunggakan_bayar: number
    orang_bulan_ini: number
    orang_tunggakan: number
    status: string
    konfirmasi_bulan_ini_at: string | null
    konfirmasi_tunggakan_at: string | null
    aktual_bulan_ini: number
    aktual_tunggakan: number
  }>(
    `SELECT asrama, tanggal_setor, tanggal_terima, nama_penyetor, jumlah_aktual,
            COALESCE(jumlah_bulan_ini, 0)       AS jumlah_bulan_ini,
            COALESCE(jumlah_tunggakan_bayar, 0) AS jumlah_tunggakan_bayar,
            COALESCE(orang_bulan_ini, 0)        AS orang_bulan_ini,
            COALESCE(orang_tunggakan, 0)        AS orang_tunggakan,
            COALESCE(status, 'terkirim')        AS status,
            konfirmasi_bulan_ini_at, konfirmasi_tunggakan_at,
            COALESCE(aktual_bulan_ini, 0)       AS aktual_bulan_ini,
            COALESCE(aktual_tunggakan, 0)       AS aktual_tunggakan
     FROM spp_setoran WHERE tahun = ? AND bulan = ?`,
    [tahun, bulan]
  )
  const setoranMap = new Map(setoranRows.map(r => [r.asrama, r]))

  // Gabung semua di memory
  return santriRows.map(r => {
    const ini     = bayarIniMap.get(r.asrama)
    const setoran = setoranMap.get(r.asrama)
    const bayar_bulan_ini      = ini?.jumlah_bayar ?? 0
    const bayar_tunggakan_lalu = tunggakanMap.get(r.asrama) ?? 0
    const penunggak            = Math.max(0, r.wajib_bayar - bayar_bulan_ini)
    const pct                  = r.wajib_bayar > 0
      ? Math.round((bayar_bulan_ini / r.wajib_bayar) * 100) : 0

    return {
      asrama:               r.asrama,
      total_santri:         r.total_santri,
      bebas_spp:            r.bebas_spp,
      wajib_bayar:          r.wajib_bayar,
      bayar_bulan_ini,
      bayar_tunggakan_lalu,
      total_nominal:        ini?.total_nominal ?? 0,
      penunggak,
      persentase:           pct,
      tanggal_setor:        setoran?.tanggal_setor        ?? null,
      tanggal_terima:       setoran?.tanggal_terima       ?? null,
      nama_penyetor:        setoran?.nama_penyetor        ?? null,
      jumlah_aktual:        setoran?.jumlah_aktual        ?? null,
      jumlah_bulan_ini:     setoran?.jumlah_bulan_ini     ?? 0,
      jumlah_tunggakan_bayar: setoran?.jumlah_tunggakan_bayar ?? 0,
      orang_bulan_ini:      setoran?.orang_bulan_ini      ?? 0,
      orang_tunggakan:      setoran?.orang_tunggakan      ?? 0,
      status_setoran:       setoran?.status               ?? null,
      konfirmasi_bulan_ini_at: setoran?.konfirmasi_bulan_ini_at ?? null,
      konfirmasi_tunggakan_at: setoran?.konfirmasi_tunggakan_at ?? null,
      aktual_bulan_ini:     setoran?.aktual_bulan_ini     ?? 0,
      aktual_tunggakan:     setoran?.aktual_tunggakan     ?? 0,
    }
  })
}

// ─── Konfirmasi terima setoran ────────────────────────────────────────────
export async function konfirmasiSetoran(
  asrama: string, tahun: number, bulan: number,
  tipe: 'bulan_ini' | 'tunggakan', jumlahAktual: number
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM spp_setoran WHERE asrama = ? AND tahun = ? AND bulan = ?`,
    [asrama, tahun, bulan]
  )
  if (!existing) return { error: 'Data setoran tidak ditemukan' }

  if (tipe === 'bulan_ini') {
    await execute(
      `UPDATE spp_setoran SET
        aktual_bulan_ini = ?, konfirmasi_bulan_ini_by = ?,
        konfirmasi_bulan_ini_at = datetime('now'), tanggal_terima = datetime('now'),
        status = CASE WHEN konfirmasi_tunggakan_at IS NOT NULL THEN 'dikonfirmasi' ELSE status END
       WHERE id = ?`,
      [jumlahAktual, session.id, existing.id]
    )
  } else {
    await execute(
      `UPDATE spp_setoran SET
        aktual_tunggakan = ?, konfirmasi_tunggakan_by = ?,
        konfirmasi_tunggakan_at = datetime('now'), tanggal_terima = datetime('now'),
        status = CASE WHEN konfirmasi_bulan_ini_at IS NOT NULL THEN 'dikonfirmasi' ELSE status END
       WHERE id = ?`,
      [jumlahAktual, session.id, existing.id]
    )
  }
  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}

// ─── Simpan setoran manual (fallback) ────────────────────────────────────
export async function simpanSetoran(
  asrama: string, tahun: number, bulan: number,
  jumlahAktual: number, namaPenyetor: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  await batch([
    {
      sql: `DELETE FROM spp_setoran WHERE asrama = ? AND tahun = ? AND bulan = ?`,
      params: [asrama, tahun, bulan],
    },
    {
      sql: `INSERT INTO spp_setoran (id, asrama, bulan, tahun, tanggal_terima, penerima_id,
              jumlah_aktual, nama_penyetor, status, tanggal_setor)
            VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, 'dikonfirmasi', datetime('now'))`,
      params: [generateId(), asrama, bulan, tahun, session?.id ?? null, jumlahAktual, namaPenyetor],
    },
  ])
  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}

// ─── Daftar penunggak bulan tertentu (dengan pagination) ──────────────────
// Fix: ganti NOT EXISTS (correlated subquery per baris) dengan
// LEFT JOIN spp_log + WHERE IS NULL — jauh lebih efisien di D1
// Tambah pagination agar tidak load ratusan baris sekaligus
export async function getDaftarPenunggak(params: {
  tahun: number
  bulan: number
  asramaFilter?: string
  kamarFilter?: string
  page?: number
}) {
  const { tahun, bulan, asramaFilter, kamarFilter, page = 1 } = params
  const offset = (page - 1) * PAGE_SIZE

  const clauses: string[] = [
    "s.status_global = 'aktif'",
    "s.bebas_spp = 0",
    "sl_cek.santri_id IS NULL",   // LEFT JOIN anti-join: tidak ada di spp_log bulan ini
  ]
  const baseParams: any[] = [tahun, bulan]  // untuk LEFT JOIN ON

  if (asramaFilter && asramaFilter !== 'SEMUA') {
    clauses.push('s.asrama = ?')
    baseParams.push(asramaFilter)
  }
  if (kamarFilter && kamarFilter !== 'SEMUA') {
    clauses.push('s.kamar = ?')
    baseParams.push(kamarFilter)
  }

  const where = clauses.join(' AND ')

  // Count total
  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM santri s
     LEFT JOIN spp_log sl_cek
       ON sl_cek.santri_id = s.id AND sl_cek.tahun = ? AND sl_cek.bulan = ?
     WHERE ${where}`,
    baseParams
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0, pageSize: PAGE_SIZE }

  // Data dengan pagination + LEFT JOIN untuk kelas & alasan
  const rows = await query<{
    id: string; nama_lengkap: string; nis: string
    asrama: string; kamar: string
    sekolah: string | null; kelas_sekolah: string | null
    nama_kelas: string | null; marhalah_nama: string | null
    alasan: string | null
  }>(
    `SELECT
       s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
       s.sekolah, s.kelas_sekolah,
       k.nama_kelas,
       m.nama AS marhalah_nama,
       ta.alasan
     FROM santri s
     -- Anti-join: hanya santri yang TIDAK ada di spp_log bulan ini
     LEFT JOIN spp_log sl_cek
       ON sl_cek.santri_id = s.id AND sl_cek.tahun = ? AND sl_cek.bulan = ?
     -- Kelas pesantren (aktif saja)
     LEFT JOIN riwayat_pendidikan rp
       ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     LEFT JOIN marhalah m ON m.id = k.marhalah_id
     -- Alasan tunggakan jika sudah diisi
     LEFT JOIN spp_tunggakan_alasan ta
       ON ta.santri_id = s.id AND ta.bulan = ? AND ta.tahun = ?
     WHERE ${where}
     ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
     LIMIT ? OFFSET ?`,
    [tahun, bulan, ...baseParams.slice(2), bulan, tahun, PAGE_SIZE, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / PAGE_SIZE), pageSize: PAGE_SIZE }
}

// ─── Daftar asrama ────────────────────────────────────────────────────────
export async function getAsramaList() {
  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama FROM santri
     WHERE status_global = 'aktif' AND asrama IS NOT NULL ORDER BY asrama`
  )
  return rows.map(r => r.asrama)
}

// ─── Daftar kamar per asrama ──────────────────────────────────────────────
export async function getKamarList(asrama: string) {
  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [asrama]
  )
  return rows.map(r => r.kamar)
}

// ─── Simpan/update alasan penunggak ──────────────────────────────────────
export async function simpanAlasanPenunggak(
  santriId: string, tahun: number, bulan: number, alasan: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  await execute(
    `INSERT INTO spp_tunggakan_alasan (id, santri_id, bulan, tahun, alasan, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(santri_id, bulan, tahun) DO UPDATE SET
       alasan = excluded.alasan,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`,
    [generateId(), santriId, bulan, tahun, alasan, session.id]
  )
  return { success: true }
}

// ─── Fungsi lama ──────────────────────────────────────────────────────────
export async function getNominalSPP() {
  const s = await getSppSettings(new Date().getFullYear())
  return s.nominal
}

export async function getStatusSPP(santriId: string, tahun: number) {
  return query<any>(
    `SELECT id, bulan, tahun, nominal_bayar, tanggal_bayar
     FROM spp_log WHERE santri_id = ? AND tahun = ?`,
    [santriId, tahun]
  )
}

export async function bayarSPP(santriId: string, tahun: number, bulans: number[], nominalPerBulan: number): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  const ph = bulans.map(() => '?').join(',')
  const exist = await query<any>(
    `SELECT bulan FROM spp_log WHERE santri_id = ? AND tahun = ? AND bulan IN (${ph})`,
    [santriId, tahun, ...bulans]
  )
  if (exist.length > 0) return { error: 'Beberapa bulan sudah dibayar sebelumnya.' }
  await batch(bulans.map(b => ({
    sql: `INSERT INTO spp_log (id, santri_id, tahun, bulan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
          VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Manual', date('now'))`,
    params: [generateId(), santriId, tahun, b, nominalPerBulan, session?.id ?? null],
  })))
  revalidatePath('/dashboard/asrama/spp')
  return { success: true }
}

export async function simpanSppBatch(listTransaksi: any[]): Promise<{ success: boolean; count: number } | { error: string }> {
  const session = await getSession()
  if (!listTransaksi.length) return { error: 'Tidak ada data.' }
  await batch(listTransaksi.map(item => ({
    sql: `INSERT INTO spp_log (id, santri_id, bulan, tahun, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
          VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Cepat', date('now'))`,
    params: [generateId(), item.santriId, item.bulan, item.tahun, item.nominal, session?.id ?? null],
  })))
  revalidatePath('/dashboard/asrama/spp')
  return { success: true, count: listTransaksi.length }
}
