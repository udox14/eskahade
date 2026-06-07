'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession, hasAnyRole, type SessionUser } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { ASRAMA_LIST, getSppScope, isSadesaCategory, isSadesaUnit, SADESA_CATEGORY, SADESA_UNIT } from '@/lib/spp/unit-setor'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { getJumlahTunggakanHistorisBySantri, getSppBillingStartSetting } from '@/lib/spp/tunggakan'

type SppClientScope = {
  kind: 'ASRAMA' | 'SADESA' | 'ADMIN'
  lockedUnit: string | null
  defaultUnit: string
  allowedUnits: string[]
  canAdjustBilling: boolean
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
  if (isAsramaTanpaKamar(cleanUnit)) {
    throw new Error('Asrama ini tidak memiliki kewajiban SPP.')
  }
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
    nama_lengkap: string | null
    nis: string | null
    bebas_spp: number | null
  }>(
    `SELECT id, asrama, kategori_santri, nama_lengkap, nis, COALESCE(bebas_spp, 0) AS bebas_spp
     FROM santri
     WHERE id = ? AND status_global = 'aktif'`,
    [santriId]
  )

  if (!santri) throw new Error('Santri tidak ditemukan.')
  if (isAsramaTanpaKamar(santri.asrama)) {
    throw new Error('Santri asrama ini tidak memiliki kewajiban SPP.')
  }

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
    canAdjustBilling: hasAnyRole(session, ['admin', 'dewan_santri']),
  }
}

export async function getNominalSPP() {
  return 70000
}

export async function getSppBillingStart() {
  return getSppBillingStartSetting()
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

async function mapBillingRows(rows: any[], billableCount: number) {
  const historisMap = await getJumlahTunggakanHistorisBySantri(rows.map((s: any) => s.id))
  return rows.map((s: any) => ({
    ...s,
    bulan_ini_lunas: s.bulan_ini_lunas === 1,
    bebas_spp: s.bebas_spp === 1,
    tagihan_ditiadakan_bulan_ini: s.tagihan_ditiadakan_bulan_ini === 1,
    jumlah_tagihan_ditiadakan: s.jumlah_tagihan_ditiadakan ?? 0,
    jumlah_tunggakan_berjalan: s.bebas_spp === 1 ? 0 : Math.max(0, billableCount - (s.jumlah_bayar ?? 0) - (s.jumlah_tagihan_ditiadakan ?? 0)),
    jumlah_tunggakan_historis: historisMap.get(s.id) ?? 0,
    jumlah_tunggakan: (s.bebas_spp === 1 ? 0 : Math.max(0, billableCount - (s.jumlah_bayar ?? 0) - (s.jumlah_tagihan_ditiadakan ?? 0))) + (historisMap.get(s.id) ?? 0),
  }))
}

function assertAdjustmentAccess(session: SessionUser | null) {
  if (!hasAnyRole(session, ['admin', 'dewan_santri'])) {
    throw new Error('Hanya admin dan dewan santri yang boleh meniadakan tagihan SPP.')
  }
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
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
      ),
      ditiadakan_tahun AS (
        SELECT santri_id, COUNT(*) AS jumlah_tagihan_ditiadakan
        FROM spp_tagihan_ditiadakan
        WHERE is_active = 1 AND tahun = ? AND bulan BETWEEN ? AND ?
        GROUP BY santri_id
      ),
      ditiadakan_bulan_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_tagihan_ditiadakan
        WHERE is_active = 1 AND tahun = ? AND bulan = ?
      )
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url, COALESCE(s.bebas_spp, 0) AS bebas_spp,
      COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
      COALESCE(dt.jumlah_tagihan_ditiadakan, 0) AS jumlah_tagihan_ditiadakan,
      CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas,
      CASE WHEN dbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS tagihan_ditiadakan_bulan_ini
    FROM santri s
    LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
    LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
    LEFT JOIN ditiadakan_tahun dt ON dt.santri_id = s.id
    LEFT JOIN ditiadakan_bulan_ini dbi ON dbi.santri_id = s.id
    WHERE s.status_global = 'aktif'
      AND COALESCE(s.kategori_santri, 'REGULER') != ?
      AND s.asrama = ?
      AND s.kamar = ?
    ORDER BY s.nama_lengkap
  `, [tahun, startMonth, maxCheck, tahun, currentMonth, tahun, startMonth, maxCheck, tahun, currentMonth, SADESA_CATEGORY, unit, kamar])

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
      ),
      ditiadakan_tahun AS (
        SELECT santri_id, COUNT(*) AS jumlah_tagihan_ditiadakan
        FROM spp_tagihan_ditiadakan
        WHERE is_active = 1 AND tahun = ? AND bulan BETWEEN ? AND ?
        GROUP BY santri_id
      ),
      ditiadakan_bulan_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_tagihan_ditiadakan
        WHERE is_active = 1 AND tahun = ? AND bulan = ?
      )
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url, COALESCE(s.bebas_spp, 0) AS bebas_spp,
      COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
      COALESCE(dt.jumlah_tagihan_ditiadakan, 0) AS jumlah_tagihan_ditiadakan,
      CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas,
      CASE WHEN dbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS tagihan_ditiadakan_bulan_ini
    FROM santri s
    LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
    LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
    LEFT JOIN ditiadakan_tahun dt ON dt.santri_id = s.id
    LEFT JOIN ditiadakan_bulan_ini dbi ON dbi.santri_id = s.id
    WHERE s.status_global = 'aktif'
      AND s.kategori_santri = ?
    ORDER BY s.nama_lengkap
  `, [tahun, startMonth, maxCheck, tahun, currentMonth, tahun, startMonth, maxCheck, tahun, currentMonth, SADESA_CATEGORY])

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
        ),
        ditiadakan_tahun AS (
          SELECT santri_id, COUNT(*) AS jumlah_tagihan_ditiadakan
          FROM spp_tagihan_ditiadakan
          WHERE is_active = 1 AND tahun = ? AND bulan BETWEEN ? AND ?
          GROUP BY santri_id
        ),
        ditiadakan_bulan_ini AS (
          SELECT DISTINCT santri_id
          FROM spp_tagihan_ditiadakan
          WHERE is_active = 1 AND tahun = ? AND bulan = ?
        )
      SELECT
        s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url, COALESCE(s.bebas_spp, 0) AS bebas_spp,
        COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
        COALESCE(dt.jumlah_tagihan_ditiadakan, 0) AS jumlah_tagihan_ditiadakan,
        CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas,
        CASE WHEN dbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS tagihan_ditiadakan_bulan_ini
      FROM santri s
      LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
      LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
      LEFT JOIN ditiadakan_tahun dt ON dt.santri_id = s.id
      LEFT JOIN ditiadakan_bulan_ini dbi ON dbi.santri_id = s.id
      WHERE s.status_global = 'aktif'
        AND s.kategori_santri = ?
        AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)
      ORDER BY s.nama_lengkap
      LIMIT 50
    `, [tahun, startMonth, maxCheck, tahun, currentMonth, tahun, startMonth, maxCheck, tahun, currentMonth, SADESA_CATEGORY, like, like])
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
        ),
        ditiadakan_tahun AS (
          SELECT santri_id, COUNT(*) AS jumlah_tagihan_ditiadakan
          FROM spp_tagihan_ditiadakan
          WHERE is_active = 1 AND tahun = ? AND bulan BETWEEN ? AND ?
          GROUP BY santri_id
        ),
        ditiadakan_bulan_ini AS (
          SELECT DISTINCT santri_id
          FROM spp_tagihan_ditiadakan
          WHERE is_active = 1 AND tahun = ? AND bulan = ?
        )
      SELECT
        s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url, COALESCE(s.bebas_spp, 0) AS bebas_spp,
        COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
        COALESCE(dt.jumlah_tagihan_ditiadakan, 0) AS jumlah_tagihan_ditiadakan,
        CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas,
        CASE WHEN dbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS tagihan_ditiadakan_bulan_ini
      FROM santri s
      LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
      LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
      LEFT JOIN ditiadakan_tahun dt ON dt.santri_id = s.id
      LEFT JOIN ditiadakan_bulan_ini dbi ON dbi.santri_id = s.id
      WHERE s.status_global = 'aktif'
        AND COALESCE(s.kategori_santri, 'REGULER') != ?
        AND s.asrama = ?
        AND (s.nama_lengkap LIKE ? OR s.nis LIKE ? OR s.kamar LIKE ?)
      ORDER BY CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
      LIMIT 50
    `, [tahun, startMonth, maxCheck, tahun, currentMonth, tahun, startMonth, maxCheck, tahun, currentMonth, SADESA_CATEGORY, unit, like, like, like])

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

export async function getTagihanDitiadakanSPP(santriId: string, tahun: number) {
  await assertSantriAccess(await getSession(), santriId)
  return query<any>(
    `SELECT id, santri_id, bulan, tahun, alasan, is_active, created_at, updated_at
     FROM spp_tagihan_ditiadakan
     WHERE santri_id = ? AND tahun = ? AND is_active = 1
     ORDER BY bulan`,
    [santriId, tahun]
  )
}

export async function simpanTagihanDitiadakanSPP(
  santriIds: string[],
  tahun: number,
  bulans: number[],
  alasan: string
): Promise<{ success: boolean; count: number } | { error: string }> {
  try {
    const session = await getSession()
    assertAdjustmentAccess(session)
    const uniqueSantriIds = Array.from(new Set(santriIds.map(id => String(id || '').trim()).filter(Boolean)))
    const cleanBulans = Array.from(new Set(bulans.map(Number))).filter(b => Number.isInteger(b) && b >= 1 && b <= 12).sort((a, b) => a - b)
    const cleanTahun = Number(tahun)
    const cleanAlasan = String(alasan || '').trim()

    if (!uniqueSantriIds.length) return { error: 'Pilih minimal satu santri.' }
    if (!Number.isInteger(cleanTahun) || cleanTahun < 2000) return { error: 'Tahun tidak valid.' }
    if (!cleanBulans.length) return { error: 'Pilih minimal satu bulan.' }
    if (!cleanAlasan) return { error: 'Alasan wajib diisi.' }

    const billingStart = await getSppBillingStart()
    if (cleanBulans.some(b => (cleanTahun * 100 + b) < (billingStart.tahun * 100 + billingStart.bulan))) {
      return { error: 'Bulan tersebut belum memiliki tagihan SPP.' }
    }

    for (const santriId of uniqueSantriIds) {
      const santri = await assertSantriAccess(session, santriId)
      if ((santri as any).bebas_spp === 1) return { error: `${santri.nama_lengkap || santri.nis || santriId} sudah bebas SPP permanen.` }
    }

    const bulanPh = cleanBulans.map(() => '?').join(',')
    for (const santriChunk of chunkArray(uniqueSantriIds, 40)) {
      const santriPh = santriChunk.map(() => '?').join(',')
      const paidRows = await query<{ santri_id: string; bulan: number; nama_lengkap: string | null }>(
        `SELECT sl.santri_id, sl.bulan, s.nama_lengkap
         FROM spp_log sl
         LEFT JOIN santri s ON s.id = sl.santri_id
         WHERE sl.santri_id IN (${santriPh})
           AND sl.tahun = ?
           AND sl.bulan IN (${bulanPh})
         LIMIT 1`,
        [...santriChunk, cleanTahun, ...cleanBulans]
      )
      if (paidRows.length > 0) {
        const first = paidRows[0]
        return { error: `${first.nama_lengkap || first.santri_id} bulan ${first.bulan} sudah tercatat lunas. Batalkan pembayaran dulu jika ingin meniadakan tagihan.` }
      }
    }

    const now = new Date().toISOString()
    const statements = uniqueSantriIds.flatMap(santriId => cleanBulans.map(b => ({
      sql: `INSERT INTO spp_tagihan_ditiadakan
              (id, santri_id, tahun, bulan, alasan, is_active, created_by, created_at, updated_by, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
            ON CONFLICT(santri_id, tahun, bulan) DO UPDATE SET
              alasan = excluded.alasan,
              is_active = 1,
              updated_by = excluded.updated_by,
              updated_at = excluded.updated_at`,
      params: [generateId(), santriId, cleanTahun, b, cleanAlasan, session?.id ?? null, now, session?.id ?? null, now],
    })))
    for (const statementChunk of chunkArray(statements, 50)) {
      await batch(statementChunk)
    }

    await logActivity({
      actor: actorFromSession(session),
      module: 'spp',
      action: 'waive_monthly_bill',
      fiturHref: '/dashboard/asrama/spp',
      logKind: 'update',
      entityType: 'santri_batch',
      entityId: 'spp-tagihan-ditiadakan',
      entityLabel: 'SPP Tidak Ada Tagihan',
      summary: `Meniadakan tagihan SPP ${uniqueSantriIds.length} santri untuk ${cleanBulans.length} bulan`,
      details: { santri_ids: uniqueSantriIds, tahun: cleanTahun, bulan: cleanBulans, alasan: cleanAlasan },
    })

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    revalidatePath('/dashboard/dewan-santri/surat')
    return { success: true, count: statements.length }
  } catch (error: any) {
    return { error: error?.message || 'Gagal meniadakan tagihan SPP.' }
  }
}

export async function simpanTagihanDitiadakanKelasSPP(
  unitSetor: string,
  tahun: number,
  bulans: number[],
  kelasSekolah: number,
  alasan: string
): Promise<{ success: boolean; count: number; santriCount: number } | { error: string }> {
  try {
    const session = await getSession()
    assertAdjustmentAccess(session)
    const scope = getScopeOrThrow(session)
    const cleanUnit = String(unitSetor ?? '').trim().toUpperCase()
    const cleanKelas = Number(kelasSekolah)
    if (!Number.isInteger(cleanKelas) || cleanKelas < 1 || cleanKelas > 13) return { error: 'Kelas sekolah tidak valid.' }

    let where = `s.status_global = 'aktif'
      AND COALESCE(s.bebas_spp, 0) = 0
      AND s.kelas_sekolah IS NOT NULL
      AND TRIM(s.kelas_sekolah) <> ''
      AND CAST(s.kelas_sekolah AS INTEGER) = ?`
    const params: any[] = [cleanKelas]

    if (cleanUnit === 'SEMUA') {
      if (scope.kind !== 'ADMIN') return { error: 'Hanya admin yang boleh memilih semua unit.' }
      where += ` AND UPPER(TRIM(COALESCE(s.asrama, ''))) <> 'AL-BAGHORY'`
    } else {
      const unit = assertRequestedUnit(scope, cleanUnit)
      if (isSadesaUnit(unit)) {
        where += ` AND s.kategori_santri = ?`
        params.push(SADESA_CATEGORY)
      } else {
        where += ` AND COALESCE(s.kategori_santri, 'REGULER') != ? AND s.asrama = ?`
        params.push(SADESA_CATEGORY, unit)
      }
    }

    const rows = await query<{ id: string }>(
      `SELECT s.id
       FROM santri s
       WHERE ${where}
       ORDER BY s.nama_lengkap`,
      params
    )
    if (rows.length === 0) return { error: 'Tidak ada santri aktif yang cocok dengan kelas dan unit tersebut.' }

    const result = await simpanTagihanDitiadakanSPP(rows.map(row => row.id), tahun, bulans, alasan)
    if ('error' in result) return result
    return { ...result, santriCount: rows.length }
  } catch (error: any) {
    return { error: error?.message || 'Gagal meniadakan tagihan berdasarkan kelas.' }
  }
}

export async function cabutTagihanDitiadakanSPP(santriId: string, tahun: number, bulan: number): Promise<{ success: boolean } | { error: string }> {
  try {
    const session = await getSession()
    assertAdjustmentAccess(session)
    const santri = await assertSantriAccess(session, santriId)
    await execute(
      `UPDATE spp_tagihan_ditiadakan
       SET is_active = 0, updated_by = ?, updated_at = ?
       WHERE santri_id = ? AND tahun = ? AND bulan = ? AND is_active = 1`,
      [session?.id ?? null, new Date().toISOString(), santriId, tahun, bulan]
    )

    await logActivity({
      actor: actorFromSession(session),
      module: 'spp',
      action: 'restore_monthly_bill',
      fiturHref: '/dashboard/asrama/spp',
      logKind: 'update',
      entityType: 'santri',
      entityId: santriId,
      entityLabel: santri.nama_lengkap || santri.nis || santriId,
      summary: `Mengaktifkan kembali tagihan SPP ${santri.nama_lengkap || santri.nis || santriId}`,
      details: { tahun, bulan },
    })

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    revalidatePath('/dashboard/dewan-santri/surat')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal mengaktifkan kembali tagihan SPP.' }
  }
}

export async function getTunggakanHistorisSPP(santriId: string) {
  await assertSantriAccess(await getSession(), santriId)
  return query<any>(
    `SELECT id, bulan, tahun, nominal_tagihan, status, tanggal_lunas, catatan, created_at, updated_at
     FROM spp_tunggakan_historis
     WHERE santri_id = ?
     ORDER BY tahun DESC, bulan DESC`,
    [santriId]
  )
}

export async function simpanTunggakanHistorisSPP(
  santriId: string,
  tahun: number,
  bulans: number[],
  nominalPerBulan: number,
  catatan?: string
): Promise<{ success: boolean; count: number } | { error: string }> {
  try {
    const session = await getSession()
    const santri = await assertSantriAccess(session, santriId)
    const billingStart = await getSppBillingStart()
    const cleanBulans = Array.from(new Set(bulans.map(Number))).filter(b => Number.isInteger(b) && b >= 1 && b <= 12).sort((a, b) => a - b)
    if (cleanBulans.length === 0) return { error: 'Pilih minimal satu bulan tunggakan.' }
    if (!Number.isFinite(nominalPerBulan) || nominalPerBulan <= 0) return { error: 'Nominal tunggakan tidak valid.' }
    if (cleanBulans.some(b => (tahun * 100 + b) >= (billingStart.tahun * 100 + billingStart.bulan))) {
      return { error: 'Tunggakan historis hanya boleh sebelum awal tagihan SPP sistem.' }
    }

    const ph = cleanBulans.map(() => '?').join(',')
    const existingLogs = await query<{ bulan: number }>(
      `SELECT bulan FROM spp_log WHERE santri_id = ? AND tahun = ? AND bulan IN (${ph})`,
      [santriId, tahun, ...cleanBulans]
    )
    if (existingLogs.length > 0) {
      return { error: `Bulan ${existingLogs.map(row => row.bulan).join(', ')} sudah tercatat lunas di pembayaran SPP.` }
    }

    const existingHistoris = await query<{ bulan: number }>(
      `SELECT bulan FROM spp_tunggakan_historis WHERE santri_id = ? AND tahun = ? AND bulan IN (${ph})`,
      [santriId, tahun, ...cleanBulans]
    )
    if (existingHistoris.length > 0) {
      return { error: `Bulan ${existingHistoris.map(row => row.bulan).join(', ')} sudah ada di tunggakan historis.` }
    }

    await batch(cleanBulans.map(b => ({
      sql: `INSERT INTO spp_tunggakan_historis
              (id, santri_id, tahun, bulan, nominal_tagihan, status, catatan, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'BELUM_LUNAS', ?, datetime('now'), datetime('now'))`,
      params: [generateId(), santriId, tahun, b, nominalPerBulan, catatan?.trim() || null],
    })))

    await logActivity({
      actor: actorFromSession(session),
      module: 'spp',
      action: 'create_historical_arrears',
      fiturHref: '/dashboard/asrama/spp',
      logKind: 'create',
      entityType: 'santri',
      entityId: santriId,
      entityLabel: santri.nama_lengkap || santri.nis || santriId,
      summary: `Menambahkan ${cleanBulans.length} bulan tunggakan SPP historis`,
      details: {
        tahun,
        bulan: cleanBulans,
        nominal_per_bulan: nominalPerBulan,
        total_nominal: nominalPerBulan * cleanBulans.length,
        catatan: catatan?.trim() || null,
      },
    })

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    revalidatePath('/dashboard/dewan-santri/surat')
    return { success: true, count: cleanBulans.length }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menyimpan tunggakan historis.' }
  }
}

export async function bayarTunggakanHistorisSPP(id: string): Promise<{ success: boolean } | { error: string }> {
  if (!id) return { error: 'Data tunggakan tidak valid.' }
  try {
    const session = await getSession()
    const current = await queryOne<any>(
      `SELECT th.id, th.santri_id, th.tahun, th.bulan, th.nominal_tagihan, th.status,
              s.nama_lengkap, s.nis
       FROM spp_tunggakan_historis th
       LEFT JOIN santri s ON s.id = th.santri_id
       WHERE th.id = ?`,
      [id]
    )
    if (!current) return { error: 'Data tunggakan tidak ditemukan.' }
    await assertSantriAccess(session, current.santri_id)
    if (current.status === 'LUNAS') return { error: 'Tunggakan ini sudah lunas.' }

    await execute(
      `UPDATE spp_tunggakan_historis
       SET status = 'LUNAS', tanggal_lunas = date('now'), penerima_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [session?.id ?? null, id]
    )

    await logActivity({
      actor: actorFromSession(session),
      module: 'spp',
      action: 'pay_historical_arrears',
      fiturHref: '/dashboard/asrama/spp',
      logKind: 'update',
      entityType: 'santri',
      entityId: current.santri_id,
      entityLabel: current.nama_lengkap || current.nis || current.santri_id,
      summary: `Melunasi tunggakan SPP historis ${current.nama_lengkap || current.nis || current.santri_id}`,
      details: {
        tahun: current.tahun,
        bulan: current.bulan,
        nominal: current.nominal_tagihan,
        tunggakan_id: id,
      },
    })

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    revalidatePath('/dashboard/dewan-santri/surat')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal melunasi tunggakan historis.' }
  }
}

export async function bayarSPP(santriId: string, tahun: number, bulans: number[], nominalPerBulan: number): Promise<{ success: boolean } | { error: string }> {
  try {
    const session = await getSession()
    const santri = await assertSantriAccess(session, santriId)
    if ((santri.bebas_spp ?? 0) === 1) return { error: 'Santri ini berstatus bebas SPP permanen.' }

    const billingStart = await getSppBillingStart()
    const invalidMonth = bulans.some(b => (tahun * 100 + b) < (billingStart.tahun * 100 + billingStart.bulan))
    if (invalidMonth) return { error: 'Bulan tersebut belum memiliki tagihan SPP.' }

    const ph = bulans.map(() => '?').join(',')
    const waived = await query<{ bulan: number }>(
      `SELECT bulan FROM spp_tagihan_ditiadakan
       WHERE santri_id = ? AND tahun = ? AND bulan IN (${ph}) AND is_active = 1`,
      [santriId, tahun, ...bulans]
    )
    if (waived.length > 0) return { error: 'Beberapa bulan berstatus TIDAK ADA TAGIHAN.' }

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

    await logActivity({
      actor: actorFromSession(session),
      module: 'spp',
      action: 'payment',
      fiturHref: '/dashboard/asrama/spp',
      logKind: 'create',
      entityType: 'santri',
      entityId: santriId,
      entityLabel: santri.nama_lengkap || santri.nis || santriId,
      summary: `Mencatat pembayaran SPP untuk ${santri.nama_lengkap || santri.nis || santriId}`,
      details: {
        tahun,
        bulan: bulans,
        nominal_per_bulan: nominalPerBulan,
        total_nominal: nominalPerBulan * bulans.length,
        unit_setor: santri.unit_setor,
      },
    })

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menyimpan pembayaran.' }
  }
}

export async function batalkanPembayaranSPP(logId: string): Promise<{ success: boolean } | { error: string }> {
  if (!logId) return { error: 'Data pembayaran tidak valid.' }

  const current = await queryOne<{
    id: string
    santri_id: string
    bulan: number
    tahun: number
    nominal_bayar: number
    nama_lengkap: string | null
    nis: string | null
  }>(
    `SELECT sl.id, sl.santri_id, sl.bulan, sl.tahun, sl.nominal_bayar, s.nama_lengkap, s.nis
     FROM spp_log sl
     LEFT JOIN santri s ON s.id = sl.santri_id
     WHERE sl.id = ?`,
    [logId]
  )
  if (!current) return { error: 'Data pembayaran tidak ditemukan.' }

  try {
    const session = await getSession()
    await assertSantriAccess(session, current.santri_id)
    await execute(`DELETE FROM spp_log WHERE id = ?`, [logId])
    await logActivity({
      actor: actorFromSession(session),
      module: 'spp',
      action: 'delete',
      fiturHref: '/dashboard/asrama/spp',
      logKind: 'delete',
      entityType: 'santri',
      entityId: current.santri_id,
      entityLabel: current.nama_lengkap || current.nis || current.santri_id,
      summary: `Membatalkan pembayaran SPP ${current.nama_lengkap || current.nis || current.santri_id}`,
      details: {
        bulan: current.bulan,
        tahun: current.tahun,
        nominal: current.nominal_bayar,
        log_id: logId,
      },
    })
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
      const santri = await assertSantriAccess(session, item.santriId)
      if ((santri.bebas_spp ?? 0) === 1) return { error: 'Ada santri yang berstatus bebas SPP permanen.' }
      const billingStart = await getSppBillingStart()
      if ((item.tahun * 100 + item.bulan) < (billingStart.tahun * 100 + billingStart.bulan)) {
        return { error: 'Ada bulan yang belum memiliki tagihan SPP.' }
      }
    }

    const waivedChecks = await Promise.all(listTransaksi.map(item => queryOne<{ id: string }>(
      `SELECT id FROM spp_tagihan_ditiadakan
       WHERE santri_id = ? AND tahun = ? AND bulan = ? AND is_active = 1`,
      [item.santriId, item.tahun, item.bulan]
    )))
    if (waivedChecks.some(Boolean)) return { error: 'Ada tagihan yang berstatus TIDAK ADA TAGIHAN.' }

    await batch(listTransaksi.map(item => ({
      sql: `INSERT INTO spp_log (id, santri_id, bulan, tahun, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
            VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Cepat', date('now'))`,
      params: [generateId(), item.santriId, item.bulan, item.tahun, item.nominal, session?.id ?? null],
    })))

    await logActivity({
      actor: actorFromSession(session),
      module: 'spp',
      action: 'payment',
      fiturHref: '/dashboard/asrama/spp',
      logKind: 'create',
      entityType: 'spp_batch',
      entityId: 'batch',
      entityLabel: 'Pembayaran SPP batch',
      summary: `Mencatat ${listTransaksi.length} pembayaran SPP batch`,
      details: {
        count: listTransaksi.length,
        total_nominal: listTransaksi.reduce((sum, item) => sum + item.nominal, 0),
      },
    })

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    return { success: true, count: listTransaksi.length }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menyimpan pembayaran batch.' }
  }
}
