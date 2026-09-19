'use server'

import { getCachedMarhalahList, getCachedTahunAjaranList } from '@/lib/cache/master'
import {
  hitungGuruOptionsForRekap,
  hitungRekapDetailGuru,
  hitungRekapKinerjaGuru,
  rentangEfektifRekapGuru,
} from '@/lib/akademik/rekap-guru'


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

