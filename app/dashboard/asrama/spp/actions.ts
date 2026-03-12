'use server'

import { query, queryOne, execute, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getClientRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

export async function getNominalSPP() {
  return 70000
}

export async function getRingkasanTunggakan(asramaFilter?: string) {
  const tahun = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  let sql = `SELECT id FROM santri WHERE status_global = 'aktif'`
  const params: any[] = []
  if (asramaFilter && asramaFilter !== 'SEMUA') { sql += ' AND asrama = ?'; params.push(asramaFilter) }

  const santriList = await query<any>(sql, params)
  if (!santriList.length) return 0

  let joinSQL = `SELECT sl.santri_id, sl.bulan FROM spp_log sl
                 INNER JOIN santri s ON s.id = sl.santri_id
                 WHERE sl.tahun = ? AND s.status_global = 'aktif'`
  const joinParams: any[] = [tahun]
  if (asramaFilter && asramaFilter !== 'SEMUA') { joinSQL += ' AND s.asrama = ?'; joinParams.push(asramaFilter) }

  const logs = await query<any>(joinSQL, joinParams)

  let penunggakCount = 0
  santriList.forEach((s: any) => {
    const bayarAnak = logs.filter((l: any) => l.santri_id === s.id)
    for (let i = 1; i <= currentMonth; i++) {
      if (!bayarAnak.some((l: any) => l.bulan === i)) { penunggakCount++; break }
    }
  })

  return penunggakCount
}

export async function getDashboardSPP(tahun: number, asrama: string) {
  const currentMonth = new Date().getMonth() + 1

  let sql = `SELECT id, nama_lengkap, nis, asrama, kamar FROM santri WHERE status_global = 'aktif'`
  const params: any[] = []
  if (asrama && asrama !== 'SEMUA') { sql += ' AND asrama = ?'; params.push(asrama) }
  sql += ' ORDER BY nama_lengkap'

  const santriList = await query<any>(sql, params)
  if (!santriList.length) return []

  let joinSQL = `SELECT sl.santri_id, sl.bulan FROM spp_log sl
                 INNER JOIN santri s ON s.id = sl.santri_id
                 WHERE sl.tahun = ? AND s.status_global = 'aktif'`
  const joinParams: any[] = [tahun]
  if (asrama && asrama !== 'SEMUA') { joinSQL += ' AND s.asrama = ?'; joinParams.push(asrama) }

  const logs = await query<any>(joinSQL, joinParams)

  return santriList.map((s: any) => {
    const bayarAnak = logs.filter((l: any) => l.santri_id === s.id)
    const bulanIniLunas = bayarAnak.some((l: any) => l.bulan === currentMonth)
    const maxCheck = tahun < new Date().getFullYear() ? 12 : currentMonth
    let tunggakan = 0
    for (let i = 1; i <= maxCheck; i++) {
      if (!bayarAnak.some((l: any) => l.bulan === i)) tunggakan++
    }
    return { ...s, bulan_ini_lunas: bulanIniLunas, jumlah_tunggakan: tunggakan, kamar_num: parseInt(s.kamar) || 999 }
  })
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

  for (const b of bulans) {
    await execute(`
      INSERT INTO spp_log (id, santri_id, tahun, bulan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
      VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Manual', date('now'))
    `, [generateId(), santriId, tahun, b, nominalPerBulan, session?.id ?? null])
  }

  revalidatePath('/dashboard/asrama/spp')
  return { success: true }
}

export async function simpanSppBatch(listTransaksi: any[]): Promise<{ success: boolean; count: number } | { error: string }> {
  const session = await getSession()
  if (!listTransaksi.length) return { error: 'Tidak ada data.' }

  for (const item of listTransaksi) {
    await execute(`
      INSERT INTO spp_log (id, santri_id, bulan, tahun, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
      VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Cepat', date('now'))
    `, [generateId(), item.santriId, item.bulan, item.tahun, item.nominal, session?.id ?? null])
  }

  revalidatePath('/dashboard/asrama/spp')
  return { success: true, count: listTransaksi.length }
}