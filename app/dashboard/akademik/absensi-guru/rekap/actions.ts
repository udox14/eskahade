'use server'

import { revalidatePath } from 'next/cache'
import { getCachedMarhalahList, getCachedTahunAjaranList } from '@/lib/cache/master'
import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import {
  hitungGuruOptionsForRekap,
  hitungRekapDetailGuru,
  hitungRekapKinerjaGuru,
  rentangEfektifRekapGuru,
} from '@/lib/akademik/rekap-guru'
import {
  bukaKunciAbsensiGuru,
  getKunciAbsensiGuru,
  kunciAbsensiGuru,
  listKunciAbsensiGuru,
  type KunciAbsensiGuru,
} from '@/lib/akademik/absensi-guru-kunci'
import { alasanPayrollMenahanKunci } from '@/lib/finance/teacher-attendance'

/**
 * Perhitungannya sendiri ada di `lib/akademik/rekap-guru.ts` supaya payroll di
 * keuangan terpusat bisa memakai angka yang sama persis tanpa lewat server
 * action ini. Berkas ini tinggal lapisan izin dan pemicu revalidasi.
 */

const PATH = '/dashboard/akademik/absensi-guru/rekap'

/** Yang berhak menyatakan rekap satu bulan sudah final. */
const ROLE_KUNCI = ['admin', 'sekpen']

export async function getMarhalahList() {
  return getCachedMarhalahList()
}

export async function getTahunAjaranList() {
  return getCachedTahunAjaranList()
}

export async function getGuruOptionsForRekap(
  marhalahId: string = '',
  tahunAjaranId: string = '',
  startDate: string = '',
  endDate: string = ''
) {
  return hitungGuruOptionsForRekap(marhalahId, tahunAjaranId, startDate, endDate)
}

/**
 * Rentang yang benar-benar dihitung. "Hari ini" ditentukan di server memakai
 * WIB, bukan jam browser, supaya angka yang tampil sama untuk semua pemakai.
 */
export async function getRentangEfektif(startDate: string, endDate: string) {
  return rentangEfektifRekapGuru(startDate, endDate)
}

export async function getRekapKinerjaGuru(
  startDate: string,
  endDate: string,
  marhalahId: string,
  badalAsHadir: boolean,
  tahunAjaranId: string = ''
) {
  return hitungRekapKinerjaGuru(startDate, endDate, marhalahId, badalAsHadir, tahunAjaranId)
}

export async function getRekapDetailGuru(
  startDate: string,
  endDate: string,
  guruId: string,
  marhalahId: string,
  badalAsHadir: boolean,
  tahunAjaranId: string = ''
) {
  return hitungRekapDetailGuru(startDate, endDate, guruId, marhalahId, badalAsHadir, tahunAjaranId)
}

export type StatusKunciBulan = {
  periodKey: string
  kunci: KunciAbsensiGuru | null
  bolehMengunci: boolean
}

export async function getStatusKunciBulan(periodKey: string): Promise<StatusKunciBulan> {
  const session = await getSession()
  const roles = session ? getEffectiveRoles(session) : []
  return {
    periodKey,
    kunci: await getKunciAbsensiGuru(periodKey),
    bolehMengunci: roles.some(role => ROLE_KUNCI.includes(role)),
  }
}

export async function getRiwayatKunci() {
  return listKunciAbsensiGuru(12)
}

async function pastikanBolehMengunci() {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak ditemukan. Silakan masuk ulang.' as const }
  const roles = getEffectiveRoles(session)
  if (!roles.some(role => ROLE_KUNCI.includes(role))) {
    return { error: 'Hanya sekpen yang dapat mengunci atau membuka rekap absensi guru.' as const }
  }
  return { session }
}

/**
 * Menyatakan rekap bulan ini final. Setelah ini absensi guru bulan tersebut
 * tidak dapat disimpan atau diimpor ulang, dan payroll baru boleh dihitung.
 */
export async function kunciRekapBulanAction(periodKey: string, note?: string | null) {
  const izin = await pastikanBolehMengunci()
  if ('error' in izin) return { success: false as const, error: izin.error }

  const result = await kunciAbsensiGuru({
    periodKey,
    actorId: izin.session.id ?? null,
    actorNama: izin.session.full_name || izin.session.email || null,
    note,
  })
  if (result.success) {
    revalidatePath(PATH)
    revalidatePath('/dashboard/akademik/absensi-guru')
  }
  return result.success
    ? { success: true as const }
    : { success: false as const, error: result.error }
}

/**
 * Membuka kunci untuk koreksi susulan. Ditolak bila payroll bulan itu sudah
 * disetujui - kewajiban gajinya sudah masuk jurnal dan tidak bisa ditarik
 * kembali hanya karena absensinya berubah.
 */
export async function bukaKunciRekapBulanAction(periodKey: string, note?: string | null) {
  const izin = await pastikanBolehMengunci()
  if ('error' in izin) return { success: false as const, error: izin.error }

  const result = await bukaKunciAbsensiGuru({
    periodKey,
    actorId: izin.session.id ?? null,
    actorNama: izin.session.full_name || izin.session.email || null,
    note,
    payrollTerkunci: () => alasanPayrollMenahanKunci(periodKey),
  })
  if (result.success) {
    revalidatePath(PATH)
    revalidatePath('/dashboard/akademik/absensi-guru')
  }
  return result.success
    ? { success: true as const }
    : { success: false as const, error: result.error }
}
