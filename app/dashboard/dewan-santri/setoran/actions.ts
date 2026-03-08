'use server'

import { query, execute, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export async function getDetailSetoranBulan(bulan: number, tahun: number) {
  const startDate = new Date(tahun, bulan - 1, 1).toISOString().split('T')[0]
  const endDate = new Date(tahun, bulan, 0).toISOString().split('T')[0]

  // A. Ambil transaksi SPP bulan ini
  const logs = await query<any>(`
    SELECT sl.nominal_bayar, s.asrama
    FROM spp_log sl
    JOIN santri s ON s.id = sl.santri_id
    WHERE sl.tanggal_bayar >= ? AND sl.tanggal_bayar <= ?
  `, [startDate, endDate])

  // B. Ambil data setoran yang sudah ada
  const setoranExisting = await query<any>(`
    SELECT ss.*, u.full_name AS penerima_nama
    FROM spp_setoran ss
    LEFT JOIN users u ON u.id = ss.penerima_id
    WHERE ss.bulan = ? AND ss.tahun = ?
  `, [bulan, tahun])

  return ASRAMA_LIST.map(namaAsrama => {
    const transaksiAsrama = logs.filter((l: any) => l.asrama === namaAsrama)
    const totalSistem = transaksiAsrama.reduce((sum: number, item: any) => sum + item.nominal_bayar, 0)

    const dataSetor = setoranExisting.find((s: any) => s.asrama === namaAsrama)

    let status = 'PENDING'
    if (dataSetor) {
      if (dataSetor.jumlah_aktual === dataSetor.jumlah_sistem) status = 'MATCH'
      else if (dataSetor.jumlah_aktual > dataSetor.jumlah_sistem) status = 'PLUS'
      else status = 'MINUS'
    } else if (totalSistem === 0) {
      status = 'EMPTY'
    }

    return {
      asrama: namaAsrama,
      total_sistem: totalSistem,
      total_aktual: dataSetor?.jumlah_aktual || 0,
      penyetor: dataSetor?.nama_penyetor || '-',
      penerima: dataSetor?.penerima_nama || 'Sistem',
      tanggal_terima: dataSetor?.tanggal_terima,
      catatan: dataSetor?.catatan,
      status,
      is_done: !!dataSetor,
    }
  })
}

export async function terimaSetoran(
  asrama: string,
  bulan: number,
  tahun: number,
  jumlahSistem: number,
  jumlahAktual: number,
  namaPenyetor: string,
  catatan: string
) {
  const session = await getSession()

  await execute(`
    INSERT INTO spp_setoran (id, asrama, bulan, tahun, jumlah_sistem, jumlah_aktual,
      nama_penyetor, catatan, penerima_id, tanggal_terima)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(asrama, bulan, tahun) DO UPDATE SET
      jumlah_sistem = excluded.jumlah_sistem,
      jumlah_aktual = excluded.jumlah_aktual,
      nama_penyetor = excluded.nama_penyetor,
      catatan = excluded.catatan,
      penerima_id = excluded.penerima_id,
      tanggal_terima = excluded.tanggal_terima
  `, [generateId(), asrama, bulan, tahun, jumlahSistem, jumlahAktual,
      namaPenyetor, catatan, session?.id ?? null, new Date().toISOString()])

  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}

export async function batalkanSetoran(asrama: string, bulan: number, tahun: number) {
  await execute(
    'DELETE FROM spp_setoran WHERE asrama = ? AND bulan = ? AND tahun = ?',
    [asrama, bulan, tahun]
  )
  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}