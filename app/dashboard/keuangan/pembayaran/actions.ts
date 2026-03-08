'use server'

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function cariSantriKeuangan(keyword: string) {
  const data = await query<any>(`
    SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at
    FROM santri
    WHERE status_global = 'aktif' AND nama_lengkap LIKE ?
    LIMIT 5
  `, [`%${keyword}%`])

  return data.map((s: any) => ({
    ...s,
    tahun_masuk_fix: s.tahun_masuk || new Date(s.created_at).getFullYear(),
  }))
}

export async function getInfoTagihan(santriId: string, tahunMasuk: number, tahunTagihan: number) {
  const tarif = await query<any>(
    'SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?', [tahunMasuk]
  )
  const harga: any = { BANGUNAN: 0, KESEHATAN: 0, EHB: 0, EKSKUL: 0 }
  tarif.forEach((t: any) => { harga[t.jenis_biaya] = t.nominal })

  const bayar = await query<any>(
    'SELECT jenis_biaya, nominal_bayar, tahun_tagihan FROM pembayaran_tahunan WHERE santri_id = ?',
    [santriId]
  )

  const totalSudahBayarBangunan = bayar
    .filter((b: any) => b.jenis_biaya === 'BANGUNAN')
    .reduce((sum: number, b: any) => sum + b.nominal_bayar, 0)
  const sisaBangunan = harga.BANGUNAN - totalSudahBayarBangunan

  const cekLunas = (jenis: string) =>
    bayar.some((b: any) => b.jenis_biaya === jenis && b.tahun_tagihan === tahunTagihan)

  return {
    harga_angkatan: harga,
    bangunan: {
      total_wajib: harga.BANGUNAN,
      sudah_bayar: totalSudahBayarBangunan,
      sisa: sisaBangunan <= 0 ? 0 : sisaBangunan,
      status: sisaBangunan <= 0 ? 'LUNAS' : totalSudahBayarBangunan > 0 ? 'CICILAN' : 'BELUM',
    },
    tahunan: {
      KESEHATAN: { nominal: harga.KESEHATAN, lunas: cekLunas('KESEHATAN') },
      EHB: { nominal: harga.EHB, lunas: cekLunas('EHB') },
      EKSKUL: { nominal: harga.EKSKUL, lunas: cekLunas('EKSKUL') },
    },
  }
}

export async function bayarTagihan(
  santriId: string,
  jenis: string,
  nominal: number,
  tahunTagihan: number | null,
  keterangan: string
) {
  const session = await getSession()

  if (jenis !== 'BANGUNAN' && tahunTagihan) {
    const exist = await queryOne<{ id: string }>(
      'SELECT id FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = ? AND tahun_tagihan = ?',
      [santriId, jenis, tahunTagihan]
    )
    if (exist) return { error: `Tagihan ${jenis} tahun ${tahunTagihan} sudah lunas sebelumnya.` }
  }

  await execute(`
    INSERT INTO pembayaran_tahunan (id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
    VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))
  `, [generateId(), santriId, jenis, tahunTagihan, nominal, session?.id ?? null, keterangan])

  revalidatePath('/dashboard/keuangan/pembayaran')
  return { success: true }
}

export async function getMonitoringPembayaran(
  asrama: string,
  kamar: string,
  search: string,
  tahunTagihan: number
) {
  const settings = await query<any>(
    'SELECT tahun_angkatan, jenis_biaya, nominal FROM biaya_settings', []
  )
  const mapTarifBangunan = new Map<number, number>()
  settings.forEach((s: any) => {
    if (s.jenis_biaya === 'BANGUNAN') mapTarifBangunan.set(s.tahun_angkatan, s.nominal)
  })

  let sql = `SELECT id, nama_lengkap, nis, asrama, kamar, tahun_masuk, created_at
             FROM santri WHERE status_global = 'aktif'`
  const params: any[] = []

  if (asrama && asrama !== 'SEMUA') { sql += ' AND asrama = ?'; params.push(asrama) }
  if (kamar && kamar !== 'SEMUA') { sql += ' AND kamar = ?'; params.push(kamar) }
  if (search) { sql += ' AND nama_lengkap LIKE ?'; params.push(`%${search}%`) }
  sql += ' ORDER BY nama_lengkap'

  const santriList = await query<any>(sql, params)
  if (!santriList.length) return []

  const santriIds = santriList.map((s: any) => s.id)
  const ph = santriIds.map(() => '?').join(',')

  const payBangunan = await query<any>(
    `SELECT santri_id, nominal_bayar FROM pembayaran_tahunan WHERE santri_id IN (${ph}) AND jenis_biaya = 'BANGUNAN'`,
    santriIds
  )
  const payTahunan = await query<any>(
    `SELECT santri_id, jenis_biaya FROM pembayaran_tahunan WHERE santri_id IN (${ph}) AND tahun_tagihan = ?`,
    [...santriIds, tahunTagihan]
  )

  return santriList.map((s: any) => {
    const tahunMasuk = s.tahun_masuk || new Date(s.created_at).getFullYear()
    const targetBangunan = mapTarifBangunan.get(tahunMasuk) || 0
    const totalBayarBangunan = payBangunan
      .filter((p: any) => p.santri_id === s.id)
      .reduce((sum: number, p: any) => sum + p.nominal_bayar, 0)

    let statusBangunan = 'BELUM'
    if (targetBangunan > 0) {
      if (totalBayarBangunan >= targetBangunan) statusBangunan = 'LUNAS'
      else if (totalBayarBangunan > 0) statusBangunan = 'CICIL'
    } else {
      statusBangunan = '-'
    }

    const bayarIni = payTahunan.filter((p: any) => p.santri_id === s.id)
    const lunasEHB = bayarIni.some((p: any) => p.jenis_biaya === 'EHB')
    const lunasKes = bayarIni.some((p: any) => p.jenis_biaya === 'KESEHATAN')
    const lunasEkskul = bayarIni.some((p: any) => p.jenis_biaya === 'EKSKUL')

    return {
      ...s,
      tahun_masuk_fix: tahunMasuk,
      status_bangunan: statusBangunan,
      lunas_ehb: lunasEHB,
      lunas_kesehatan: lunasKes,
      lunas_ekskul: lunasEkskul,
      is_full_tahunan: lunasEHB && lunasKes && lunasEkskul,
    }
  })
}

export async function bayarLunasSetahun(santriId: string, tahunTagihan: number, tahunMasuk: number) {
  const session = await getSession()

  const tarif = await query<any>(
    `SELECT jenis_biaya, nominal FROM biaya_settings
     WHERE tahun_angkatan = ? AND jenis_biaya IN ('KESEHATAN', 'EHB', 'EKSKUL')`,
    [tahunMasuk]
  )
  if (!tarif.length) return { error: 'Tarif belum diatur untuk angkatan ini.' }

  const sudahBayar = await query<any>(
    'SELECT jenis_biaya FROM pembayaran_tahunan WHERE santri_id = ? AND tahun_tagihan = ?',
    [santriId, tahunTagihan]
  )
  const sudahList = sudahBayar.map((b: any) => b.jenis_biaya)

  const toInsert = tarif.filter((t: any) => !sudahList.includes(t.jenis_biaya) && t.nominal > 0)
  if (!toInsert.length) return { error: 'Santri ini sudah lunas semua tagihan tahunan.' }

  let totalNominal = 0
  for (const t of toInsert) {
    await execute(`
      INSERT INTO pembayaran_tahunan (id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
      VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))
    `, [generateId(), santriId, t.jenis_biaya, tahunTagihan, t.nominal, session?.id ?? null, `Pelunasan Otomatis ${tahunTagihan}`])
    totalNominal += t.nominal
  }

  revalidatePath('/dashboard/keuangan/pembayaran')
  return { success: true, count: toInsert.length, total: totalNominal }
}