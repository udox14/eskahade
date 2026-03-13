'use server'

import { query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

const ASRAMA_PUTRI = ['ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']

export async function getSessionRekap() {
  const session = await getSession()
  if (!session) return null
  return {
    role: session.role,
    asrama_binaan: session.asrama_binaan ?? null,
    isPutri: ASRAMA_PUTRI.includes(session.asrama_binaan || '')
  }
}

// Rekap Absen Malam: per santri, jumlah alfa per bulan
export async function getRekapAbsenMalam(asrama: string, bulan: string) {
  // bulan format: YYYY-MM
  const [tahun, bln] = bulan.split('-')
  const startDate = `${tahun}-${bln}-01`
  const endDate = `${tahun}-${bln}-31`

  const santriList = await query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar
    FROM santri s
    WHERE s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap
  `, [asrama])

  if (!santriList.length) return { santriList: [], alfaPerSantri: {}, detailPerSantri: {} }

  const ids = santriList.map((s: any) => s.id)
  const ph = ids.map(() => '?').join(',')

  const absenList = await query<any>(`
    SELECT santri_id, tanggal, status FROM absen_malam_v2
    WHERE tanggal >= ? AND tanggal <= ? AND santri_id IN (${ph})
    ORDER BY tanggal
  `, [startDate, endDate, ...ids])

  // Build detail per santri: { santri_id: { 'YYYY-MM-DD': status } }
  const detailPerSantri: Record<string, Record<string, string>> = {}
  const alfaPerSantri: Record<string, number> = {}
  absenList.forEach((a: any) => {
    if (!detailPerSantri[a.santri_id]) detailPerSantri[a.santri_id] = {}
    detailPerSantri[a.santri_id][a.tanggal] = a.status
    if (a.status === 'ALFA') alfaPerSantri[a.santri_id] = (alfaPerSantri[a.santri_id] || 0) + 1
  })

  return { santriList, alfaPerSantri, detailPerSantri }
}

// Rekap Absen Berjamaah: per santri, per waktu, per bulan
// hideHaid: true untuk non-pengurus-asrama-putri
export async function getRekapAbsenBerjamaah(asrama: string, bulan: string, hideHaid: boolean) {
  const [tahun, bln] = bulan.split('-')
  const startDate = `${tahun}-${bln}-01`
  const endDate = `${tahun}-${bln}-31`

  const santriList = await query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar
    FROM santri s
    WHERE s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap
  `, [asrama])

  if (!santriList.length) return { santriList: [], detail: {} }

  const ids = santriList.map((s: any) => s.id)
  const ph = ids.map(() => '?').join(',')

  const rows = await query<any>(`
    SELECT santri_id, tanggal, shubuh, ashar, maghrib, isya FROM absen_berjamaah
    WHERE tanggal >= ? AND tanggal <= ? AND santri_id IN (${ph})
    ORDER BY tanggal
  `, [startDate, endDate, ...ids])

  // detail[santri_id][tanggal] = { shubuh, ashar, maghrib, isya }
  const detail: Record<string, Record<string, any>> = {}
  rows.forEach((r: any) => {
    if (!detail[r.santri_id]) detail[r.santri_id] = {}
    detail[r.santri_id][r.tanggal] = {
      shubuh: hideHaid && r.shubuh === 'H' ? 'S' : r.shubuh,  // Sembunyikan Haid → tampilkan sebagai 'S' ke non-putri
      ashar:  hideHaid && r.ashar === 'H'  ? 'S' : r.ashar,
      maghrib:hideHaid && r.maghrib === 'H'? 'S' : r.maghrib,
      isya:   hideHaid && r.isya === 'H'   ? 'S' : r.isya,
    }
  })

  return { santriList, detail }
}
