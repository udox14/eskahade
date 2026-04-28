'use server'

import { query, execute, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

type SantriSuratRow = {
  id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  tempat_lahir: string | null
  tanggal_lahir: string | null
  jenis_kelamin: string | null
  alamat: string | null
  nama_ayah: string | null
  sekolah: string | null
  kelas_sekolah: string | null
}

type SppLogRow = {
  bulan: number
  nominal_bayar: number
}

type RiwayatSuratRow = {
  id: string
  jenis_surat: string
  detail_info: string | null
  created_at: string
  nama_lengkap: string
  asrama: string | null
  admin_nama: string | null
}

export async function cariSantri(keyword: string) {
  return query<SantriSuratRow>(`
    SELECT id, nama_lengkap, nis, asrama, kamar, tempat_lahir, tanggal_lahir,
           jenis_kelamin, alamat, nama_ayah, sekolah, kelas_sekolah
    FROM santri
    WHERE status_global = 'aktif' AND nama_lengkap LIKE ?
    LIMIT 5
  `, [`%${keyword}%`])
}

export async function cekTunggakanSantri(santriId: string) {
  const tahun = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const logs = await query<SppLogRow>(
    'SELECT bulan, nominal_bayar FROM spp_log WHERE santri_id = ? AND tahun = ?',
    [santriId, tahun]
  )

  const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

  const bulanNunggak: string[] = []
  let totalHutang = 0

  for (let i = 1; i <= currentMonth; i++) {
    if (!logs.some((log) => log.bulan === i)) {
      bulanNunggak.push(BULAN_NAMA[i - 1])
      totalHutang += 70000
    }
  }

  return {
    adaTunggakan: bulanNunggak.length > 0,
    listBulan: bulanNunggak.join(', '),
    total: totalHutang,
    tahun,
  }
}

export async function catatSuratKeluar(santriId: string, jenis: string, detail: string): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()

  await execute(`
    INSERT INTO riwayat_surat (id, santri_id, jenis_surat, detail_info, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [generateId(), santriId, jenis, detail, session?.id ?? null, now()])

  if (jenis === 'BERHENTI') {
    await execute(
      `UPDATE santri SET status_global = 'keluar' WHERE id = ?`,
      [santriId]
    )
    await execute(
      `UPDATE riwayat_pendidikan SET status_riwayat = 'pindah'
       WHERE santri_id = ? AND status_riwayat = 'aktif'`,
      [santriId]
    )
  }

  revalidatePath('/dashboard/dewan-santri/surat')
  revalidatePath('/dashboard/santri')
  return { success: true }
}

export async function getRiwayatSurat(bulan: number, tahun: number) {
  const startDate = new Date(tahun, bulan - 1, 1).toISOString()
  const endDate = new Date(tahun, bulan, 0, 23, 59, 59).toISOString()

  return query<RiwayatSuratRow>(`
    SELECT rs.id, rs.jenis_surat, rs.detail_info, rs.created_at,
           s.nama_lengkap, s.asrama,
           u.full_name AS admin_nama
    FROM riwayat_surat rs
    JOIN santri s ON s.id = rs.santri_id
    LEFT JOIN users u ON u.id = rs.created_by
    WHERE rs.created_at >= ? AND rs.created_at <= ?
    ORDER BY rs.created_at DESC
  `, [startDate, endDate])
}

export async function hapusRiwayatSurat(id: string): Promise<{ success: boolean } | { error: string }> {
  await execute('DELETE FROM riwayat_surat WHERE id = ?', [id])
  revalidatePath('/dashboard/dewan-santri/surat')
  return { success: true }
}
