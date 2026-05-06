'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession, type SessionUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { ASRAMA_LIST, getSppScope, isSadesaCategory, isSadesaUnit, SADESA_CATEGORY, SADESA_UNIT } from '@/lib/spp/unit-setor'

type SppClientScope = {
  kind: 'ASRAMA' | 'SADESA' | 'ADMIN'
  lockedUnit: string | null
  defaultUnit: string
  allowedUnits: string[]
}

function getScopeOrThrow(session: SessionUser | null) {
  const scope = getSppScope(session)
  if (!scope) throw new Error('Akses ditolak')
  return scope
}

function assertRequestedUnit(scope: ReturnType<typeof getSppScope>, unitSetor: string) {
  if (!scope) throw new Error('Akses ditolak')
  const cleanUnit = String(unitSetor ?? '').trim().toUpperCase()
  if (!cleanUnit) throw new Error('Unit setor wajib dipilih')
  if (scope.kind === 'ASRAMA' && cleanUnit !== scope.defaultUnit) {
    throw new Error('Anda hanya boleh mengelola asrama binaan Anda')
  }
  if (scope.kind === 'SADESA' && cleanUnit !== SADESA_UNIT) {
    throw new Error('Anda hanya boleh mengelola unit SADESA')
  }
  return cleanUnit
}

async function assertSantriAccess(session: SessionUser | null, santriId: string) {
  const scope = getScopeOrThrow(session)
  const santri = await queryOne<{
    id: string
    asrama: string | null
    kategori_santri: string | null
  }>(
    `SELECT id, asrama, kategori_santri
     FROM santri
     WHERE id = ? AND status_global = 'aktif'`,
    [santriId]
  )

  if (!santri) throw new Error('Santri tidak ditemukan.')

  const sadesa = isSadesaCategory(santri.kategori_santri)

  if (scope.kind === 'ASRAMA') {
    if (sadesa || santri.asrama !== scope.defaultUnit) {
      throw new Error('Santri ini bukan bagian dari asrama binaan Anda.')
    }
  } else if (scope.kind === 'SADESA') {
    if (!sadesa) throw new Error('Santri ini bukan kategori SADESA.')
  }

  return {
    ...santri,
    unit_setor: sadesa ? SADESA_UNIT : (santri.asrama ?? ''),
  }
}

export async function getClientRestriction(): Promise<SppClientScope | null> {
  const session = await getSession()
  const scope = getSppScope(session)
  if (!scope) return null

  return {
    ...scope,
    allowedUnits: scope.kind === 'ADMIN' ? [...ASRAMA_LIST, SADESA_UNIT] : [scope.defaultUnit],
  }
}

export async function getNominalSPP() {
  return 70000
}

export async function getSppBillingStart() {
  const row = await queryOne<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'spp_tagihan_mulai'`
  )
  const value = row?.value ?? '2026-01'
  const [tahunMulai, bulanMulai] = value.split('-').map(Number)
  return {
    tahun: Number.isFinite(tahunMulai) ? tahunMulai : 2026,
    bulan: Number.isFinite(bulanMulai) ? bulanMulai : 1,
    value,
  }
}

export async function getKamarsSPP(_tahun: number, unitSetor: string) {
  const session = await getSession()
  const scope = getScopeOrThrow(session)
  const unit = assertRequestedUnit(scope, unitSetor)

  if (isSadesaUnit(unit)) return []

  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar
     FROM santri
     WHERE status_global = 'aktif'
       AND COALESCE(kategori_santri, 'REGULER') != ?
       AND asrama = ?
       AND kamar IS NOT NULL
       AND TRIM(kamar) <> ''
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [SADESA_CATEGORY, unit]
  )
  return rows.map(r => r.kamar).filter(Boolean)
}

function mapBillingRows(rows: any[], billableCount: number) {
  return rows.map((s: any) => ({
    ...s,
    bulan_ini_lunas: s.bulan_ini_lunas === 1,
    jumlah_tunggakan: Math.max(0, billableCount - (s.jumlah_bayar ?? 0)),
  }))
}

export async function getDashboardSPPKamar(tahun: number, unitSetor: string, kamar: string) {
  const session = await getSession()
  const scope = getScopeOrThrow(session)
  const unit = assertRequestedUnit(scope, unitSetor)
  if (isSadesaUnit(unit)) return []

  const billingStart = await getSppBillingStart()
  const currentMonth = new Date().getMonth() + 1
  const maxCheck = tahun < new Date().getFullYear() ? 12 : currentMonth
  const startMonth = tahun === billingStart.tahun ? billingStart.bulan : (tahun < billingStart.tahun ? 13 : 1)
  const billableCount = Math.max(0, maxCheck - startMonth + 1)

  const rows = await query<any>(`
    WITH
      bayar_tahun AS (
        SELECT santri_id, COUNT(*) AS jumlah_bayar
        FROM spp_log
        WHERE tahun = ? AND bulan BETWEEN ? AND ?
        GROUP BY santri_id
      ),
      bayar_bulan_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      )
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
      COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
      CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas
    FROM santri s
    LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
    LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
    WHERE s.status_global = 'aktif'
      AND COALESCE(s.kategori_santri, 'REGULER') != ?
      AND s.asrama = ?
      AND s.kamar = ?
    ORDER BY s.nama_lengkap
  `, [tahun, startMonth, maxCheck, tahun, currentMonth, SADESA_CATEGORY, unit, kamar])

  return mapBillingRows(rows, billableCount)
}

export async function getDashboardSPPSadesa(tahun: number) {
  const session = await getSession()
  const scope = getScopeOrThrow(session)
  assertRequestedUnit(scope, SADESA_UNIT)

  const billingStart = await getSppBillingStart()
  const currentMonth = new Date().getMonth() + 1
  const maxCheck = tahun < new Date().getFullYear() ? 12 : currentMonth
  const startMonth = tahun === billingStart.tahun ? billingStart.bulan : (tahun < billingStart.tahun ? 13 : 1)
  const billableCount = Math.max(0, maxCheck - startMonth + 1)

  const rows = await query<any>(`
    WITH
      bayar_tahun AS (
        SELECT santri_id, COUNT(*) AS jumlah_bayar
        FROM spp_log
        WHERE tahun = ? AND bulan BETWEEN ? AND ?
        GROUP BY santri_id
      ),
      bayar_bulan_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      )
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
      COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
      CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas
    FROM santri s
    LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
    LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
    WHERE s.status_global = 'aktif'
      AND s.kategori_santri = ?
    ORDER BY s.nama_lengkap
  `, [tahun, startMonth, maxCheck, tahun, currentMonth, SADESA_CATEGORY])

  return mapBillingRows(rows, billableCount)
}

export async function searchDashboardSPP(tahun: number, unitSetor: string, keyword: string) {
  const session = await getSession()
  const scope = getScopeOrThrow(session)
  const unit = assertRequestedUnit(scope, unitSetor)
  const q = keyword.trim()
  if (q.length < 2) return []

  const billingStart = await getSppBillingStart()
  const currentMonth = new Date().getMonth() + 1
  const maxCheck = tahun < new Date().getFullYear() ? 12 : currentMonth
  const startMonth = tahun === billingStart.tahun ? billingStart.bulan : (tahun < billingStart.tahun ? 13 : 1)
  const billableCount = Math.max(0, maxCheck - startMonth + 1)
  const like = `%${q}%`

  const rows = isSadesaUnit(unit)
    ? await query<any>(`
      WITH
        bayar_tahun AS (
          SELECT santri_id, COUNT(*) AS jumlah_bayar
          FROM spp_log
          WHERE tahun = ? AND bulan BETWEEN ? AND ?
          GROUP BY santri_id
        ),
        bayar_bulan_ini AS (
          SELECT DISTINCT santri_id
          FROM spp_log
          WHERE tahun = ? AND bulan = ?
        )
      SELECT
        s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
        COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
        CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas
      FROM santri s
      LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
      LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
      WHERE s.status_global = 'aktif'
        AND s.kategori_santri = ?
        AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)
      ORDER BY s.nama_lengkap
      LIMIT 50
    `, [tahun, startMonth, maxCheck, tahun, currentMonth, SADESA_CATEGORY, like, like])
    : await query<any>(`
      WITH
        bayar_tahun AS (
          SELECT santri_id, COUNT(*) AS jumlah_bayar
          FROM spp_log
          WHERE tahun = ? AND bulan BETWEEN ? AND ?
          GROUP BY santri_id
        ),
        bayar_bulan_ini AS (
          SELECT DISTINCT santri_id
          FROM spp_log
          WHERE tahun = ? AND bulan = ?
        )
      SELECT
        s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
        COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
        CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas
      FROM santri s
      LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
      LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
      WHERE s.status_global = 'aktif'
        AND COALESCE(s.kategori_santri, 'REGULER') != ?
        AND s.asrama = ?
        AND (s.nama_lengkap LIKE ? OR s.nis LIKE ? OR s.kamar LIKE ?)
      ORDER BY CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
      LIMIT 50
    `, [tahun, startMonth, maxCheck, tahun, currentMonth, SADESA_CATEGORY, unit, like, like, like])

  return mapBillingRows(rows, billableCount)
}

export async function getStatusSPP(santriId: string, tahun: number) {
  await assertSantriAccess(await getSession(), santriId)
  return query<any>(
    `SELECT id, bulan, tahun, nominal_bayar, tanggal_bayar
     FROM spp_log WHERE santri_id = ? AND tahun = ?`,
    [santriId, tahun]
  )
}

export async function bayarSPP(santriId: string, tahun: number, bulans: number[], nominalPerBulan: number): Promise<{ success: boolean } | { error: string }> {
  try {
    const session = await getSession()
    await assertSantriAccess(session, santriId)

    const billingStart = await getSppBillingStart()
    const invalidMonth = bulans.some(b => (tahun * 100 + b) < (billingStart.tahun * 100 + billingStart.bulan))
    if (invalidMonth) return { error: 'Bulan tersebut belum memiliki tagihan SPP.' }

    const ph = bulans.map(() => '?').join(',')
    const exist = await query<any>(
      `SELECT bulan FROM spp_log WHERE santri_id = ? AND tahun = ? AND bulan IN (${ph})`,
      [santriId, tahun, ...bulans]
    )
    if (exist.length > 0) return { error: 'Beberapa bulan sudah dibayar sebelumnya.' }

    await batch(bulans.map(b => ({
      sql: `INSERT INTO spp_log (id, santri_id, tahun, bulan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
            VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Manual', date('now'))`,
      params: [generateId(), santriId, tahun, b, nominalPerBulan, session?.id ?? null],
    })))

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menyimpan pembayaran.' }
  }
}

export async function batalkanPembayaranSPP(logId: string): Promise<{ success: boolean } | { error: string }> {
  if (!logId) return { error: 'Data pembayaran tidak valid.' }

  const current = await queryOne<{ id: string; santri_id: string }>(
    `SELECT id, santri_id FROM spp_log WHERE id = ?`,
    [logId]
  )
  if (!current) return { error: 'Data pembayaran tidak ditemukan.' }

  try {
    await assertSantriAccess(await getSession(), current.santri_id)
    await execute(`DELETE FROM spp_log WHERE id = ?`, [logId])
    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal membatalkan pembayaran.' }
  }
}

export async function simpanSppBatch(listTransaksi: Array<{ santriId: string; bulan: number; tahun: number; nominal: number }>): Promise<{ success: boolean; count: number } | { error: string }> {
  const session = await getSession()
  if (!listTransaksi.length) return { error: 'Tidak ada data.' }

  try {
    for (const item of listTransaksi) {
      await assertSantriAccess(session, item.santriId)
    }

    await batch(listTransaksi.map(item => ({
      sql: `INSERT INTO spp_log (id, santri_id, bulan, tahun, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
            VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Cepat', date('now'))`,
      params: [generateId(), item.santriId, item.bulan, item.tahun, item.nominal, session?.id ?? null],
    })))

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    return { success: true, count: listTransaksi.length }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menyimpan pembayaran batch.' }
  }
}
