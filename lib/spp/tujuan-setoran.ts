import { queryOne } from '@/lib/db'

export const TUJUAN_DEWAN_SANTRI = 'DEWAN_SANTRI' as const
export const TUJUAN_BENDAHARA_PUSAT = 'BENDAHARA_PUSAT' as const
export type TujuanSetoranSpp = typeof TUJUAN_DEWAN_SANTRI | typeof TUJUAN_BENDAHARA_PUSAT

export async function getTujuanSetoranSpp(
  santriId: string,
  tahun: number,
  bulan: number,
): Promise<TujuanSetoranSpp> {
  if (bulan !== 7) return TUJUAN_DEWAN_SANTRI

  const row = await queryOne<{ is_baru_psb: number }>(`
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM psb_flow pf WHERE pf.santri_id = s.id
    ) AND COALESCE(
      NULLIF(CAST(s.tahun_masuk AS INTEGER), 0),
      CAST(substr(s.tanggal_masuk, 1, 4) AS INTEGER)
    ) = ? THEN 1 ELSE 0 END AS is_baru_psb
    FROM santri s WHERE s.id = ?
  `, [tahun, santriId])

  return row?.is_baru_psb === 1 ? TUJUAN_BENDAHARA_PUSAT : TUJUAN_DEWAN_SANTRI
}

export const tujuanSetoranSql = (santriAlias: string, tahunSql: string, bulanSql: string) => `CASE
  WHEN ${bulanSql} = 7
    AND EXISTS (SELECT 1 FROM psb_flow pf WHERE pf.santri_id = ${santriAlias}.id)
    AND COALESCE(
      NULLIF(CAST(${santriAlias}.tahun_masuk AS INTEGER), 0),
      CAST(substr(${santriAlias}.tanggal_masuk, 1, 4) AS INTEGER)
    ) = ${tahunSql}
  THEN 'BENDAHARA_PUSAT'
  ELSE 'DEWAN_SANTRI'
END`
