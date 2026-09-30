'use server'

import { query } from '@/lib/db'
import { assertFeature } from '@/lib/auth/feature'
import { getAbsensiWeek, rekapPemanggilan, type AbsensiCetakSource } from '@/lib/absensi/pemanggilan'

export async function getRekapAlfaMingguan(tanggalRef: string, onlyMangkir = false) {
  const access = await assertFeature('/dashboard/akademik/absensi/cetak')
  if ('error' in access) throw new Error(access.error)
  const pekan = getAbsensiWeek(tanggalRef)
  const rows = await query<AbsensiCetakSource>(`
    SELECT ah.id, ah.tanggal, ah.created_at, ah.shubuh, ah.ashar, ah.maghrib,
           ah.verif_shubuh, ah.verif_ashar, ah.verif_maghrib,
           s.id AS santri_id, s.nama_lengkap, s.asrama, s.kamar, k.nama_kelas
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ah.tanggal <= ? AND (
      (ah.shubuh = 'A' AND (ah.verif_shubuh = 'BELUM' OR (? = 0 AND ah.tanggal >= ? AND ah.verif_shubuh IS NULL))) OR
      (ah.ashar = 'A' AND (ah.verif_ashar = 'BELUM' OR (? = 0 AND ah.tanggal >= ? AND ah.verif_ashar IS NULL))) OR
      (ah.maghrib = 'A' AND (ah.verif_maghrib = 'BELUM' OR (? = 0 AND ah.tanggal >= ? AND ah.verif_maghrib IS NULL)))
    ) ORDER BY ah.tanggal, ah.id
  `, [pekan.end, Number(onlyMangkir), pekan.start, Number(onlyMangkir), pekan.start, Number(onlyMangkir), pekan.start])
  return rekapPemanggilan(rows, pekan, onlyMangkir)
}
