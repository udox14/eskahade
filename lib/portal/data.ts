// lib/portal/data.ts
// Query read-only untuk halaman portal ortu (dipanggil dari Server Components).
// Semua fungsi menerima santriId dari session portal — bukan dari input client.

import { query, queryOne } from '@/lib/db'
import { countActiveSessions, getDateRange, type SessionType } from '@/lib/absensi/pengajian'

// ── Absensi pengajian ────────────────────────────────────────

export type RekapAbsensiAnak = {
  punyaKelas: boolean
  namaKelas: string | null
  totalSesi: number
  hadir: number
  sakit: number
  izin: number
  alfa: number
  detail: { tanggal: string; shubuh: string | null; ashar: string | null; maghrib: string | null }[]
}

// Versi satu-santri dari getRekapAbsensi (app/dashboard/akademik/absensi/rekap/actions.ts):
// hanya baris non-Hadir yang tersimpan; Hadir = total sesi aktif − (S+I+A).
export async function getRekapAbsensiAnak(
  santriId: string,
  startDate: string,
  endDate: string
): Promise<RekapAbsensiAnak> {
  const range = getDateRange(startDate, endDate)
  const empty: RekapAbsensiAnak = {
    punyaKelas: false, namaKelas: null, totalSesi: 0,
    hadir: 0, sakit: 0, izin: 0, alfa: 0, detail: [],
  }
  if (!range.start || !range.end) return empty

  const riwayat = await queryOne<{ id: string; nama_kelas: string | null }>(`
    SELECT rp.id, k.nama_kelas
    FROM riwayat_pendidikan rp
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE rp.santri_id = ? AND rp.status_riwayat = 'aktif'
    LIMIT 1
  `, [santriId])
  if (!riwayat) return empty

  const detail = await query<{ tanggal: string; shubuh: string | null; ashar: string | null; maghrib: string | null }>(`
    SELECT tanggal, shubuh, ashar, maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id = ?
      AND tanggal >= ? AND tanggal <= ?
      AND (shubuh IN ('A','S','I') OR ashar IN ('A','S','I') OR maghrib IN ('A','S','I'))
    ORDER BY tanggal DESC
  `, [riwayat.id, range.start, range.end])

  let sakit = 0, izin = 0, alfa = 0
  detail.forEach(row => {
    for (const sesi of [row.shubuh, row.ashar, row.maghrib]) {
      if (sesi === 'S') sakit++
      else if (sesi === 'I') izin++
      else if (sesi === 'A') alfa++
    }
  })

  const liburList = await query<{ tanggal: string; sesi: SessionType }>(`
    SELECT tanggal, sesi FROM pengajian_libur_sesi WHERE tanggal >= ? AND tanggal <= ?
  `, [range.start, range.end]).catch(() => [] as { tanggal: string; sesi: SessionType }[])

  const totalSesi = countActiveSessions(
    range.start,
    range.end,
    new Set(liburList.map(item => `${item.tanggal}-${item.sesi}`))
  )

  return {
    punyaKelas: true,
    namaKelas: riwayat.nama_kelas,
    totalSesi,
    hadir: totalSesi > 0 ? Math.max(totalSesi - sakit - izin - alfa, 0) : 0,
    sakit,
    izin,
    alfa,
    detail,
  }
}

// ── Pelanggaran ──────────────────────────────────────────────

export type PelanggaranAnak = {
  id: string
  tanggal: string
  jenis: string
  deskripsi: string | null
  poin: number
}

export async function getPelanggaranAnak(santriId: string): Promise<PelanggaranAnak[]> {
  return query<PelanggaranAnak>(`
    SELECT id, tanggal, jenis, deskripsi, COALESCE(poin, 0) AS poin
    FROM pelanggaran
    WHERE santri_id = ?
    ORDER BY tanggal DESC, created_at DESC
    LIMIT 200
  `, [santriId])
}

// ── Pengajuan pembayaran portal ──────────────────────────────

export type PortalSubmission = {
  id: string
  kategori: 'SPP' | 'NON_SPP'
  detail_json: string
  jumlah: number
  metode: 'TRANSFER' | 'QRIS'
  bank_tujuan: string | null
  bukti_url: string | null
  status: 'menunggu_konfirmasi' | 'terkonfirmasi' | 'ditolak' | 'dibatalkan'
  catatan_ortu: string | null
  reject_reason: string | null
  confirmed_at: string | null
  rejected_at: string | null
  created_at: string
  updated_at: string
}

export async function getPendingSubmission(santriId: string, kategori: 'SPP' | 'NON_SPP') {
  return queryOne<PortalSubmission>(`
    SELECT * FROM portal_payment_submission
    WHERE santri_id = ? AND kategori = ? AND status = 'menunggu_konfirmasi'
    LIMIT 1
  `, [santriId, kategori])
}

// Pengajuan ditolak paling baru yang belum digantikan pengajuan lain — untuk
// banner "upload ulang" di portal.
export async function getLatestRejectedSubmission(santriId: string, kategori: 'SPP' | 'NON_SPP') {
  return queryOne<PortalSubmission>(`
    SELECT * FROM portal_payment_submission
    WHERE santri_id = ? AND kategori = ? AND status = 'ditolak'
    ORDER BY datetime(updated_at) DESC
    LIMIT 1
  `, [santriId, kategori])
}

export async function getRiwayatSubmissions(santriId: string) {
  return query<PortalSubmission>(`
    SELECT * FROM portal_payment_submission
    WHERE santri_id = ?
    ORDER BY datetime(created_at) DESC
    LIMIT 50
  `, [santriId])
}

// ── Rekening & QRIS ──────────────────────────────────────────

export type PortalBank = { id: string; bank: string; nomor: string; atas_nama: string }
export type PortalPaymentChannels = { banks: PortalBank[]; qris_url: string | null }

export async function getPaymentChannels(): Promise<PortalPaymentChannels> {
  const row = await queryOne<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'portal_payment_channels'`
  )
  try {
    const parsed = JSON.parse(row?.value || '{}')
    return {
      banks: Array.isArray(parsed?.banks) ? parsed.banks : [],
      qris_url: typeof parsed?.qris_url === 'string' && parsed.qris_url ? parsed.qris_url : null,
    }
  } catch {
    return { banks: [], qris_url: null }
  }
}
