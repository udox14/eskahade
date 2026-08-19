import { financeQueryOne } from '@/lib/db'
import { hitungRekapKinerjaGuru } from '@/lib/akademik/rekap-guru'
import { getKunciAbsensiGuru, rentangBulan, type KunciAbsensiGuru } from '@/lib/akademik/absensi-guru-kunci'

/**
 * Jembatan antara rekap absensi guru (DB utama, milik sekpen) dan payroll
 * (FINANCE_DB, milik bendahara).
 *
 * Dua basis data ini sengaja terpisah, jadi angkanya tidak bisa di-JOIN. Yang
 * dilakukan di sini adalah menyalin cacah sesi pada saat payroll dihitung, lalu
 * membekukannya di baris payroll. Pembekuan itu bukan keterbatasan melainkan
 * yang diinginkan: gaji yang sudah dihitung tidak boleh berubah diam-diam
 * karena ada koreksi absensi susulan.
 *
 * Satuannya sesi, sama seperti sumbernya. Lihat migrasi keuangan 0003.
 */

export type AbsensiGuruSesi = {
  teacherId: string
  nama: string
  wajibSesi: number
  hadirSesi: number
  badalSesi: number
  alfaSesi: number
}

export type RekapAbsensiPayroll = {
  periodKey: string
  kunci: KunciAbsensiGuru
  perGuru: Map<string, AbsensiGuruSesi>
}

/**
 * Cacah sesi per guru untuk satu bulan. Menolak bila sekpen belum mengunci
 * bulan itu - bendahara tidak boleh menghitung gaji di atas angka yang masih
 * mungkin berubah.
 */
export async function rekapAbsensiGuruUntukPayroll(periodKey: string): Promise<RekapAbsensiPayroll> {
  const kunci = await getKunciAbsensiGuru(periodKey)
  if (!kunci) {
    throw new Error(
      `Rekap absensi guru ${periodKey} belum dikunci sekpen. Payroll baru bisa dihitung setelah rekap bulan itu dinyatakan final.`
    )
  }

  const { from, to } = rentangBulan(periodKey)
  // `badalAsHadir` hanya menggeser kolom persentase, bukan cacah mentah yang
  // dipakai di sini. Nilainya tidak memengaruhi potongan siapa pun.
  const rows = await hitungRekapKinerjaGuru(from, to, '', true, '')

  const perGuru = new Map<string, AbsensiGuruSesi>()
  for (const row of rows) {
    perGuru.set(String(row.id), {
      teacherId: String(row.id),
      nama: row.nama,
      wajibSesi: Number(row.total_wajib) || 0,
      hadirSesi: Number(row.hadir) || 0,
      badalSesi: Number(row.badal) || 0,
      alfaSesi: Number(row.kosong) || 0,
    })
  }

  return { periodKey, kunci, perGuru }
}

/**
 * Alasan kenapa kunci absensi bulan ini tidak boleh dibuka, atau null bila
 * boleh. Dipakai `bukaKunciAbsensiGuru` lewat callback supaya modul akademik
 * tidak perlu mengimpor lapisan keuangan.
 */
export async function alasanPayrollMenahanKunci(periodKey: string): Promise<string | null> {
  try {
    const period = await financeQueryOne<{ status: string }>(
      `SELECT status FROM finance_payroll_periods WHERE period_key=?`, [periodKey])
    if (!period) return null
    if (period.status === 'DISETUJUI' || period.status === 'DIBAYAR') {
      return `Payroll ${periodKey} sudah ${period.status.toLowerCase()} dan kewajiban gajinya sudah masuk pembukuan. Kunci absensi tidak dapat dibuka lagi.`
    }
    return null
  } catch {
    // FINANCE_DB tidak terjangkau bukan alasan untuk menahan pekerjaan sekpen;
    // yang dijaga di sini payroll yang sudah disetujui, dan itu keadaan langka.
    return null
  }
}
