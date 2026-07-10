// lib/keuangan/non-spp-outstanding.ts
// Sisa tagihan Non-SPP untuk SATU santri.
//
// Matematika disamakan persis dengan bayarInlineNonSpp/getBukuBesarSantri di
// app/dashboard/keuangan/non-spp/actions.ts (file 'use server', helper-nya tak
// bisa diimport). Dipakai portal ortu (tampilan tagihan + create submission)
// dan halaman konfirmasi Non-SPP (re-validasi saat approve).

import { query, queryOne } from '@/lib/db'

export const NON_SPP_JENIS_TAHUNAN = ['KESEHATAN', 'EHB', 'EKSKUL'] as const
export const NON_SPP_JENIS_ALL = ['BANGUNAN', ...NON_SPP_JENIS_TAHUNAN] as const
export type NonSppJenis = typeof NON_SPP_JENIS_ALL[number]

const LEGACY_CUTOFF_KEY = 'keuangan_non_spp_cutoff_tanggal'
const DEFAULT_LEGACY_CUTOFF = '2026-07-01'

export type NonSppOutstandingItem = {
  jenis: NonSppJenis
  tarif: number
  paid: number
  sisa: number
  tahun_ajaran_id: number
  // NULL untuk BANGUNAN (sekali seumur mondok), tahun berjalan untuk tahunan
  tahun_tagihan: number | null
}

export type NonSppOutstanding = {
  tahunAjaranId: number
  tahunAjaranNama: string
  tahunTagihan: number
  legacySettled: boolean
  items: NonSppOutstandingItem[]
  totalSisa: number
}

function toInt(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDate(value: string | null | undefined) {
  const text = String(value ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function inferTahunTagihan(nama: string | null | undefined) {
  const match = String(nama ?? '').match(/\b(20\d{2}|19\d{2})\b/)
  return match ? Number(match[1]) : new Date().getFullYear()
}

export async function getNonSppOutstandingSantri(
  santriId: string,
  tahunAjaranId?: number
): Promise<NonSppOutstanding | null> {
  const tahunAjaran = tahunAjaranId
    ? await queryOne<{ id: number; nama: string }>(
        'SELECT id, nama FROM tahun_ajaran WHERE id = ?', [tahunAjaranId])
    : await queryOne<{ id: number; nama: string }>(
        'SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
  if (!tahunAjaran) return null

  const santri = await queryOne<{
    id: string
    tahun_masuk: number | null
    tanggal_masuk: string | null
    created_at: string | null
    psb_flow_id: string | null
  }>(`
    SELECT s.id, s.tahun_masuk, s.tanggal_masuk, s.created_at, pf.id AS psb_flow_id
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ?
  `, [santriId])
  if (!santri) return null

  // effectiveYear (angkatan)
  let tahunMasuk = Number(santri.tahun_masuk || 0)
  if (!tahunMasuk) {
    const tanggalMasukYear = Number(String(santri.tanggal_masuk ?? '').slice(0, 4))
    tahunMasuk = Number.isFinite(tanggalMasukYear) && tanggalMasukYear > 0
      ? tanggalMasukYear
      : (santri.created_at ? new Date(santri.created_at).getFullYear() : new Date().getFullYear())
  }

  // Santri legacy (dibuat sebelum cutoff, bukan dari PSB): tagihan = opening balance saja
  const cutoffRow = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?', [LEGACY_CUTOFF_KEY])
  const cutoffTanggal = normalizeDate(cutoffRow?.value) ?? DEFAULT_LEGACY_CUTOFF
  const createdDate = normalizeDate(santri.created_at)
  const legacySettled = !!createdDate && createdDate < cutoffTanggal && !santri.psb_flow_id

  const tarif: Record<NonSppJenis, number> = { BANGUNAN: 0, KESEHATAN: 0, EHB: 0, EKSKUL: 0 }
  if (legacySettled) {
    const openingRows = await query<{ jenis_biaya: NonSppJenis; nominal_tagihan: number }>(`
      SELECT jenis_biaya, nominal_tagihan
      FROM keuangan_non_spp_opening_balance
      WHERE santri_id = ? AND tahun_ajaran_id = ? AND COALESCE(status, 'AKTIF') != 'VOID'
    `, [santriId, tahunAjaran.id])
    openingRows.forEach(row => {
      if ((NON_SPP_JENIS_ALL as readonly string[]).includes(row.jenis_biaya)) {
        tarif[row.jenis_biaya] += toInt(row.nominal_tagihan)
      }
    })
  } else {
    const scoped = await query<{ jenis_biaya: NonSppJenis; nominal: number }>(
      'SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_ajaran_id = ? AND tahun_angkatan = ?',
      [tahunAjaran.id, tahunMasuk]
    )
    const rows = scoped.length
      ? scoped
      : await query<{ jenis_biaya: NonSppJenis; nominal: number }>(
          'SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_ajaran_id IS NULL AND tahun_angkatan = ?',
          [tahunMasuk]
        )
    rows.forEach(row => {
      if ((NON_SPP_JENIS_ALL as readonly string[]).includes(row.jenis_biaya)) {
        tarif[row.jenis_biaya] = toInt(row.nominal)
      }
    })
  }

  const tahunTagihan = inferTahunTagihan(tahunAjaran.nama)
  const items: NonSppOutstandingItem[] = []

  // BANGUNAN: lifetime, tanpa filter tahun ajaran
  {
    const paidRow = await queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(nominal_bayar), 0) AS total
      FROM pembayaran_tahunan p
      WHERE p.santri_id = ? AND p.jenis_biaya = 'BANGUNAN' AND COALESCE(p.status, 'AKTIF') != 'VOID'
    `, [santriId])
    const rawPaid = toInt(paidRow?.total)
    const paid = legacySettled && tarif.BANGUNAN <= 0 ? 0 : rawPaid
    items.push({
      jenis: 'BANGUNAN',
      tarif: tarif.BANGUNAN,
      paid,
      sisa: Math.max(0, tarif.BANGUNAN - paid),
      tahun_ajaran_id: tahunAjaran.id,
      tahun_tagihan: null,
    })
  }

  // Tahunan: per tahun ajaran (fallback tahun_tagihan utk baris lama tanpa TA)
  for (const jenis of NON_SPP_JENIS_TAHUNAN) {
    const paidRow = await queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(nominal_bayar), 0) AS total
      FROM pembayaran_tahunan p
      WHERE p.santri_id = ? AND p.jenis_biaya = ?
        AND COALESCE(p.status, 'AKTIF') != 'VOID'
        AND ((p.tahun_ajaran_id = ?) OR (p.tahun_ajaran_id IS NULL AND p.tahun_tagihan = ?))
    `, [santriId, jenis, tahunAjaran.id, tahunTagihan])
    const rawPaid = toInt(paidRow?.total)
    const paid = legacySettled && tarif[jenis] <= 0 ? 0 : rawPaid
    items.push({
      jenis,
      tarif: tarif[jenis],
      paid,
      sisa: Math.max(0, tarif[jenis] - paid),
      tahun_ajaran_id: tahunAjaran.id,
      tahun_tagihan: tahunTagihan,
    })
  }

  return {
    tahunAjaranId: tahunAjaran.id,
    tahunAjaranNama: tahunAjaran.nama,
    tahunTagihan,
    legacySettled,
    items,
    totalSisa: items.reduce((sum, item) => sum + item.sisa, 0),
  }
}
