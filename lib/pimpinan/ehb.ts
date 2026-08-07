import { query } from '@/lib/db'
import { safeNumber } from './helpers'

export type EhbMonitoring = {
  event: { id: number; nama: string; semester: number; tahun_ajaran_nama: string } | null
  rab: {
    total_item: number
    total_anggaran: number
    perKategori: Array<{ kategori: string; total: number; items: number }>
  }
  transaksi: {
    pemasukan: number
    pengeluaran: number
    saldo: number
  }
  panitia: number
}

async function getEvent() {
  try {
    return await query<{ id: number; nama: string; semester: number; tahun_ajaran_nama: string }>(
      `SELECT e.id, e.nama, e.semester, ta.nama AS tahun_ajaran_nama
       FROM ehb_event e
       JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
       WHERE e.is_active = 1
       LIMIT 1`
    )
  } catch {
    return []
  }
}

async function getRab(eventId: number): Promise<EhbMonitoring['rab']> {
  try {
    const [perKategori, total] = await Promise.all([
      query<{ kategori: string; total: number; items: number }>(
        `SELECT kategori, COALESCE(SUM(harga), 0) AS total, COUNT(*) AS items
         FROM ehb_rab_item
         WHERE ehb_event_id = ?
         GROUP BY kategori
         ORDER BY total DESC`,
        [eventId]
      ),
      query<{ total_item: number; total_anggaran: number }>(
        `SELECT COUNT(*) AS total_item, COALESCE(SUM(harga), 0) AS total_anggaran
         FROM ehb_rab_item
         WHERE ehb_event_id = ?`,
        [eventId]
      ),
    ])
    return {
      total_item: safeNumber(total[0]?.total_item),
      total_anggaran: safeNumber(total[0]?.total_anggaran),
      perKategori: perKategori.map(row => ({
        kategori: row.kategori || 'Lainnya',
        total: safeNumber(row.total),
        items: safeNumber(row.items),
      })),
    }
  } catch {
    return { total_item: 0, total_anggaran: 0, perKategori: [] }
  }
}

async function getTransaksi(eventId: number): Promise<EhbMonitoring['transaksi']> {
  try {
    const rows = await query<{ pemasukan: number; pengeluaran: number }>(
      `SELECT COALESCE(SUM(CASE WHEN tipe = 'pemasukan' THEN nominal ELSE 0 END), 0) AS pemasukan,
              COALESCE(SUM(CASE WHEN tipe = 'pengeluaran' THEN nominal ELSE 0 END), 0) AS pengeluaran
       FROM ehb_keuangan_transaksi
       WHERE ehb_event_id = ?`,
      [eventId]
    )
    const pemasukan = safeNumber(rows[0]?.pemasukan)
    const pengeluaran = safeNumber(rows[0]?.pengeluaran)
    return { pemasukan, pengeluaran, saldo: pemasukan - pengeluaran }
  } catch {
    return { pemasukan: 0, pengeluaran: 0, saldo: 0 }
  }
}

async function getPanitiaCount(eventId: number): Promise<number> {
  try {
    const rows = await query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM ehb_panitia WHERE ehb_event_id = ?',
      [eventId]
    )
    return safeNumber(rows[0]?.total)
  } catch {
    return 0
  }
}

export async function getEhbMonitoring(): Promise<EhbMonitoring> {
  const events = await getEvent()
  const event = events[0] ?? null

  if (!event) {
    return {
      event: null,
      rab: { total_item: 0, total_anggaran: 0, perKategori: [] },
      transaksi: { pemasukan: 0, pengeluaran: 0, saldo: 0 },
      panitia: 0,
    }
  }

  const [rab, transaksi, panitia] = await Promise.all([
    getRab(event.id),
    getTransaksi(event.id),
    getPanitiaCount(event.id),
  ])

  return { event, rab, transaksi, panitia }
}
