// lib/portal/data.ts
// Query read-only untuk halaman portal ortu (dipanggil dari Server Components).
// Semua fungsi menerima santriId dari session portal — bukan dari input client.

import { query, queryOne } from '@/lib/db'
import { getDateRange, isHoliday, type SessionType } from '@/lib/absensi/pengajian'
import { toWibDateInputValue } from '@/lib/date/wib'

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

// Rekap absensi authoritative untuk Portal Orang Tua:
// Menggunakan tabel absensi_verifikasi_periode (status = 'FINAL') sebagai satu-satunya
// penentu periode verifikasi resmi Sekpen.
// Periode yang berstatus FINAL merepresentasikan bahwa Sekpen telah mengesahkan kehadiran seluruh santri:
// - Status Sakit (S) dan Izin (I) pada periode tersebut dianggap sah/final.
// - Status Alfa (A) dengan verif = 'OK' dianggap Alfa final.
// - Santri aktif yang tidak memiliki exception row dihitung HADIR.
// - Hadir = totalSesi - sakit - izin - alfa.
// - Jika belum ada periode yang FINAL (totalSesi === 0), Portal Orang Tua menampilkan neutral state.
export async function getRekapAbsensiAnak(
  santriId: string,
  startDate: string,
  endDate: string,
): Promise<RekapAbsensiAnak> {
  const empty: RekapAbsensiAnak = {
    punyaKelas: false,
    namaKelas: null,
    totalSesi: 0,
    hadir: 0,
    sakit: 0,
    izin: 0,
    alfa: 0,
    detail: [],
  }

  const range = getDateRange(startDate, endDate)
  if (!range.start || !range.end) return empty

  const todayStr = toWibDateInputValue()
  const effectiveRange = {
    start: range.start,
    end: range.end > todayStr ? todayStr : range.end,
  }
  if (effectiveRange.start > effectiveRange.end) return empty

  const riwayat = await queryOne<{ id: string; nama_kelas: string | null; created_at: string }>(`
    SELECT rp.id, k.nama_kelas, rp.created_at
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE rp.santri_id = ? AND rp.status_riwayat = 'aktif'
    LIMIT 1
  `, [santriId])
  if (!riwayat) return empty

  // Applicability rule: Sesi sebelum santri terdaftar/aktif tidak dihitung
  const enrollmentDate = (riwayat.created_at || '').slice(0, 10)
  const applicableStart = enrollmentDate && enrollmentDate > effectiveRange.start
    ? enrollmentDate
    : effectiveRange.start

  // Query seluruh periode yang telah berstatus FINAL oleh Sekpen dalam rentang applicable
  let finalPeriods: { tanggal_mulai: string; tanggal_selesai: string }[] = []
  try {
    finalPeriods = await query<{ tanggal_mulai: string; tanggal_selesai: string }>(`
      SELECT tanggal_mulai, tanggal_selesai
      FROM absensi_verifikasi_periode
      WHERE status = 'FINAL'
        AND tanggal_mulai <= ? AND tanggal_selesai >= ?
      ORDER BY tanggal_mulai ASC
    `, [effectiveRange.end, applicableStart])
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('no such table: absensi_verifikasi_periode')) {
      // Graceful fallback jika tabel absensi_verifikasi_periode belum ada
      return empty
    }
    throw err
  }

  // Jika belum ada periode yang difinalisasi oleh Sekpen, tampilkan neutral state (totalSesi = 0)
  if (!finalPeriods.length) {
    return {
      punyaKelas: true,
      namaKelas: riwayat.nama_kelas,
      totalSesi: 0,
      hadir: 0,
      sakit: 0,
      izin: 0,
      alfa: 0,
      detail: [],
    }
  }

  // Kumpulkan tanggal-tanggal unik yang masuk ke dalam periode FINAL
  const validDates = new Set<string>()
  for (const p of finalPeriods) {
    const curDateStr = p.tanggal_mulai < applicableStart ? applicableStart : p.tanggal_mulai
    const endDateStr = p.tanggal_selesai > effectiveRange.end ? effectiveRange.end : p.tanggal_selesai

    const cur = new Date(`${curDateStr}T12:00:00Z`)
    const end = new Date(`${endDateStr}T12:00:00Z`)
    while (cur <= end) {
      validDates.add(cur.toISOString().split('T')[0])
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }

  if (validDates.size === 0) {
    return {
      punyaKelas: true,
      namaKelas: riwayat.nama_kelas,
      totalSesi: 0,
      hadir: 0,
      sakit: 0,
      izin: 0,
      alfa: 0,
      detail: [],
    }
  }

  const liburList = await query<{ tanggal: string; sesi: SessionType }>(`
    SELECT tanggal, sesi FROM pengajian_libur_sesi WHERE tanggal >= ? AND tanggal <= ?
  `, [applicableStart, effectiveRange.end]).catch(() => [] as { tanggal: string; sesi: SessionType }[])
  const liburSet = new Set(liburList.map(item => `${item.tanggal}-${item.sesi}`))

  let totalSesi = 0
  for (const d of validDates) {
    for (const s of ['shubuh', 'ashar', 'maghrib'] as const) {
      if (!isHoliday(d, s) && !liburSet.has(`${d}-${s}`)) {
        totalSesi++
      }
    }
  }

  // Ambil data pengecualian (S, I, A) hanya pada rentang tanggal yang difinalisasi
  const rawAbsen = await query<{
    tanggal: string
    shubuh: string | null; ashar: string | null; maghrib: string | null
    verif_shubuh: string | null; verif_ashar: string | null; verif_maghrib: string | null
  }>(`
    SELECT tanggal, shubuh, ashar, maghrib, verif_shubuh, verif_ashar, verif_maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id = ?
      AND tanggal >= ? AND tanggal <= ?
    ORDER BY tanggal DESC
  `, [riwayat.id, applicableStart, effectiveRange.end])

  let sakit = 0, izin = 0, alfa = 0
  const detail: { tanggal: string; shubuh: string | null; ashar: string | null; maghrib: string | null }[] = []

  rawAbsen.forEach(row => {
    if (!validDates.has(row.tanggal)) return

    let hasAbsence = false
    const rowDetail = {
      tanggal: row.tanggal,
      shubuh: null as string | null,
      ashar: null as string | null,
      maghrib: null as string | null,
    }

    const sessions = ['shubuh', 'ashar', 'maghrib'] as const
    for (const s of sessions) {
      if (isHoliday(row.tanggal, s) || liburSet.has(`${row.tanggal}-${s}`)) continue

      const status = row[s]
      const verif = row[`verif_${s}`]

      if (status === 'S') {
        sakit++
        rowDetail[s] = 'S'
        hasAbsence = true
      } else if (status === 'I') {
        izin++
        rowDetail[s] = 'I'
        hasAbsence = true
      } else if (status === 'A' && verif === 'OK') {
        alfa++
        rowDetail[s] = 'A'
        hasAbsence = true
      }
    }

    if (hasAbsence) {
      detail.push(rowDetail)
    }
  })

  // Santri yang Hadir tidak diinput / tidak memiliki exception row.
  // Hadir authoritative dihitung dari selisih total sesi final dengan seluruh exception final.
  const hadir = Math.max(totalSesi - sakit - izin - alfa, 0)

  return {
    punyaKelas: true,
    namaKelas: riwayat.nama_kelas,
    totalSesi,
    hadir,
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
// banner "upload ulang" di portal. "Belum digantikan" berarti tidak ada
// pengajuan lain (kategori sama) yang dibuat setelahnya — kalau ortu sudah
// membuat pengajuan baru pasca penolakan, banner ini tidak relevan lagi
// walau baris lama itu sendiri tetap berstatus 'ditolak' selamanya.
export async function getLatestRejectedSubmission(santriId: string, kategori: 'SPP' | 'NON_SPP') {
  return queryOne<PortalSubmission>(`
    SELECT * FROM portal_payment_submission ps
    WHERE ps.santri_id = ? AND ps.kategori = ? AND ps.status = 'ditolak'
      AND NOT EXISTS (
        SELECT 1 FROM portal_payment_submission newer
        WHERE newer.santri_id = ps.santri_id AND newer.kategori = ps.kategori
          AND datetime(newer.created_at) > datetime(ps.created_at)
      )
    ORDER BY datetime(ps.updated_at) DESC
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
