'use server'

import { query } from '@/lib/db'
import { getCachedBiayaSettings } from '@/lib/cache/master'

export async function getLaporanKeuangan(tahun: number) {
  const startDate = `${tahun}-01-01`
  const endDate = `${tahun}-12-31`

  // 1. Cash flow tahun ini (tidak berubah, sudah ada filter tanggal)
  const listTransaksi = await query<any>(`
    SELECT pt.id, pt.jenis_biaya, pt.nominal_bayar, pt.tahun_tagihan, pt.tanggal_bayar, pt.keterangan,
           s.nama_lengkap, s.nis, s.asrama,
           u.full_name AS penerima_nama
    FROM pembayaran_tahunan pt
    JOIN santri s ON s.id = pt.santri_id
    LEFT JOIN users u ON u.id = pt.penerima_id
    WHERE pt.tanggal_bayar >= ? AND pt.tanggal_bayar <= ?
    ORDER BY pt.tanggal_bayar DESC
  `, [startDate, endDate])

  const cashFlow = { BANGUNAN: 0, KESEHATAN: 0, EHB: 0, EKSKUL: 0, TOTAL: 0 }
  listTransaksi.forEach((item: any) => {
    const jenis = item.jenis_biaya as keyof typeof cashFlow
    if (cashFlow[jenis] !== undefined) cashFlow[jenis] += item.nominal_bayar
    cashFlow.TOTAL += item.nominal_bayar
  })

  // 2. Target & kekurangan
  const santriList = await query<any>(
    "SELECT id, tahun_masuk, created_at FROM santri WHERE status_global = 'aktif'", []
  )
  const settings = await getCachedBiayaSettings()

  // FIX #3: Pisah query BANGUNAN (lifetime) dan tahunan, keduanya dengan filter yang tepat
  // BANGUNAN: lifetime, ambil semua bangunan tanpa filter tahun
  const allBangunanPayments = await query<any>(
    "SELECT santri_id, nominal_bayar FROM pembayaran_tahunan WHERE jenis_biaya = 'BANGUNAN'",
    []
  )
  // KESEHATAN, EHB, EKSKUL: hanya untuk tahun yang sedang dilihat
  const tahunanPayments = await query<any>(
    "SELECT santri_id, jenis_biaya, nominal_bayar FROM pembayaran_tahunan WHERE jenis_biaya IN ('KESEHATAN', 'EHB', 'EKSKUL') AND tahun_tagihan = ?",
    [tahun]
  )

  const mapTarif = new Map<string, number>()
  settings.forEach((s: any) => { mapTarif.set(`${s.tahun_angkatan}-${s.jenis_biaya}`, s.nominal) })

  // Buat map untuk lookup cepat, hindari .filter() berulang di dalam loop
  const mapBangunan = new Map<string, number>()
  allBangunanPayments.forEach((p: any) => {
    mapBangunan.set(p.santri_id, (mapBangunan.get(p.santri_id) ?? 0) + p.nominal_bayar)
  })

  const mapTahunan = new Map<string, { KESEHATAN: number; EHB: number; EKSKUL: number }>()
  tahunanPayments.forEach((p: any) => {
    if (!mapTahunan.has(p.santri_id)) mapTahunan.set(p.santri_id, { KESEHATAN: 0, EHB: 0, EKSKUL: 0 })
    const entry = mapTahunan.get(p.santri_id)!
    entry[p.jenis_biaya as 'KESEHATAN' | 'EHB' | 'EKSKUL'] += p.nominal_bayar
  })

  const targets = {
    BANGUNAN:  { target: 0, terima: 0, kurang: 0 },
    KESEHATAN: { target: 0, terima: 0, kurang: 0 },
    EHB:       { target: 0, terima: 0, kurang: 0 },
    EKSKUL:    { target: 0, terima: 0, kurang: 0 },
  }

  santriList.forEach((s: any) => {
    const angkatan = s.tahun_masuk || new Date(s.created_at).getFullYear()

    // Bangunan (lifetime)
    const tarifBangunan = mapTarif.get(`${angkatan}-BANGUNAN`) || 0
    const sudahBayarBangunan = mapBangunan.get(s.id) ?? 0
    targets.BANGUNAN.target += tarifBangunan
    targets.BANGUNAN.terima += sudahBayarBangunan
    targets.BANGUNAN.kurang += Math.max(0, tarifBangunan - sudahBayarBangunan)

    // Tahunan
    const tahunanSantri = mapTahunan.get(s.id)
    ;(['KESEHATAN', 'EHB', 'EKSKUL'] as const).forEach(jenis => {
      const tarif = mapTarif.get(`${angkatan}-${jenis}`) || 0
      const sudahBayar = tahunanSantri?.[jenis] ?? 0
      targets[jenis].target += tarif
      targets[jenis].terima += sudahBayar
      targets[jenis].kurang += Math.max(0, tarif - sudahBayar)
    })
  })

  return { cashFlow, targets, list: listTransaksi }
}
