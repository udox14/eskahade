import { queryOne } from '@/lib/db'
import { getKategoriSantriEfektifSql } from '@/lib/santri/kategori'

export const TUJUAN_DEWAN_SANTRI = 'DEWAN_SANTRI' as const
export const TUJUAN_BENDAHARA_PUSAT = 'BENDAHARA_PUSAT' as const
export type TujuanSetoranSpp = typeof TUJUAN_DEWAN_SANTRI | typeof TUJUAN_BENDAHARA_PUSAT

export async function getTujuanSetoranSpp(
  santriId: string,
  tahun: number,
  bulan: number,
): Promise<TujuanSetoranSpp> {
  if (bulan !== 7) return TUJUAN_DEWAN_SANTRI

  const row = await queryOne<{ is_baru_psb: number; is_santri_baru: number }>(`
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM psb_flow pf WHERE pf.santri_id = s.id
    ) AND COALESCE(
      NULLIF(CAST(s.tahun_masuk AS INTEGER), 0),
      CAST(substr(s.tanggal_masuk, 1, 4) AS INTEGER)
    ) = ? THEN 1 ELSE 0 END AS is_baru_psb,
    CASE WHEN ${getKategoriSantriEfektifSql('s')} = 'BARU' THEN 1 ELSE 0 END AS is_santri_baru
    FROM santri s WHERE s.id = ?
  `, [tahun, santriId])

  return row?.is_baru_psb === 1 || row?.is_santri_baru === 1
    ? TUJUAN_BENDAHARA_PUSAT
    : TUJUAN_DEWAN_SANTRI
}

export const tujuanSetoranSql = (santriAlias: string, tahunSql: string, bulanSql: string) => `CASE
  WHEN ${bulanSql} = 7
    AND (
      (
        EXISTS (SELECT 1 FROM psb_flow pf WHERE pf.santri_id = ${santriAlias}.id)
        AND COALESCE(
          NULLIF(CAST(${santriAlias}.tahun_masuk AS INTEGER), 0),
          CAST(substr(${santriAlias}.tanggal_masuk, 1, 4) AS INTEGER)
        ) = ${tahunSql}
      )
      OR ${getKategoriSantriEfektifSql(santriAlias)} = 'BARU'
    )
  THEN 'BENDAHARA_PUSAT'
  ELSE 'DEWAN_SANTRI'
END`

/**
 * Kondisi baris `spp_log` yang uangnya masuk ke Bendahara Pesantren
 * (SPP Juli santri baru), bukan ke setoran rutin Dewan Santri.
 *
 * Dipakai bersama oleh laporan keuangan PSB dan halaman Setoran SPP Santri
 * Baru supaya angka keduanya tidak bisa berbeda. Cek kategori efektif 'BARU'
 * dipertahankan sebagai fallback untuk baris lama yang ditulis sebelum kolom
 * `tujuan_setoran` ada (lihat migrasi 0116).
 */
export const sppJuliPusatLogCondition = (santriAlias: string, sppLogAlias: string) => `(
  ${sppLogAlias}.tujuan_setoran = '${TUJUAN_BENDAHARA_PUSAT}'
  OR ${getKategoriSantriEfektifSql(santriAlias)} = 'BARU'
)`

/**
 * Kondisi santri yang punya tagihan SPP Juli ke Bendahara Pesantren pada
 * tahun tertentu. Ini sisi "target", pasangan dari `sppJuliPusatLogCondition`
 * yang menghitung sisi "terbayar".
 */
export const sppJuliPusatSantriCondition = (santriAlias: string, tahunSql: string) =>
  `${tujuanSetoranSql(santriAlias, tahunSql, '7')} = '${TUJUAN_BENDAHARA_PUSAT}'`
