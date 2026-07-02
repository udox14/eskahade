'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession, hasAnyRole, type SessionUser } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { ASRAMA_LIST, getSppScope, isSadesaCategory, isSadesaUnit, SADESA_CATEGORY, SADESA_UNIT } from '@/lib/spp/unit-setor'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { getJumlahTunggakanHistorisBySantri, getSppBillingStartSetting, getNominalSppForYear } from '@/lib/spp/tunggakan'

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

export async function getNominalSPP(tahun: number) {
  return getNominalSppForYear(tahun)
}

export async function getSppBillingStart() {
  return getSppBillingStartSetting()
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

export async function getDashboardSPPAll(tahun: number, unitSetor: string, targetMonth?: number) {
  const session = await getSession()
  const scope = getScopeOrThrow(session)
  const unit = assertRequestedUnit(scope, unitSetor)

  const billingStart = await getSppBillingStart()
  const currentMonth = new Date().getMonth() + 1
  // Bulan yang status lunas/ditiadakan-nya ditampilkan di kolom "Status".
  // Default bulan berjalan; bisa dipilih bulan sebelumnya lewat filter.
  const checkMonth = targetMonth && targetMonth >= 1 && targetMonth <= 12 ? targetMonth : currentMonth
  const maxCheck = tahun < new Date().getFullYear() ? 12 : currentMonth
  const startMonth = tahun === billingStart.tahun ? billingStart.bulan : (tahun < billingStart.tahun ? 13 : 1)
  const billableCount = Math.max(0, maxCheck - startMonth + 1)

  const sadesaMode = isSadesaUnit(unit)

  const rows = await query<any>(`
    WITH
      spp_agg AS (
        SELECT
          santri_id,
          COUNT(*) AS jumlah_bayar,
          MAX(CASE WHEN bulan = ? THEN 1 ELSE 0 END) AS bayar_bulan_ini
        FROM spp_log
        WHERE tahun = ? AND bulan BETWEEN ? AND ?
        GROUP BY santri_id
      ),
      ditiadakan_agg AS (
        SELECT
          santri_id,
          COUNT(*) AS jumlah_tagihan_ditiadakan,
          MAX(CASE WHEN bulan = ? THEN 1 ELSE 0 END) AS ditiadakan_bulan_ini
        FROM spp_tagihan_ditiadakan
        WHERE is_active = 1 AND tahun = ? AND bulan BETWEEN ? AND ?
        GROUP BY santri_id
      )
    SELECT
      s.id, s.nama_lengkap, s.asrama, COALESCE(s.kamar, '-') AS kamar, s.foto_url, COALESCE(s.bebas_spp, 0) AS bebas_spp,
      COALESCE(s.sekolah, '-') AS sekolah, COALESCE(s.kelas_sekolah, '-') AS kelas_sekolah,
      COALESCE(k.nama_kelas, '-') AS kelas_pesantren,
      COALESCE(sa.jumlah_bayar, 0) AS jumlah_bayar,
      COALESCE(da.jumlah_tagihan_ditiadakan, 0) AS jumlah_tagihan_ditiadakan,
      COALESCE(sa.bayar_bulan_ini, 0) AS bulan_ini_lunas,
      COALESCE(da.ditiadakan_bulan_ini, 0) AS tagihan_ditiadakan_bulan_ini
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN spp_agg sa ON sa.santri_id = s.id
    LEFT JOIN ditiadakan_agg da ON da.santri_id = s.id
    WHERE s.status_global = 'aktif'
      ${sadesaMode ? 'AND s.kategori_santri = ?' : 'AND (s.kategori_santri IS NULL OR s.kategori_santri != ?) AND s.asrama = ?'}
    ORDER BY s.nama_lengkap ASC
  `, sadesaMode ? [checkMonth, tahun, startMonth, maxCheck, checkMonth, tahun, startMonth, maxCheck, SADESA_CATEGORY]
                : [checkMonth, tahun, startMonth, maxCheck, checkMonth, tahun, startMonth, maxCheck, SADESA_CATEGORY, unit])

  const historisMap = await getJumlahTunggakanHistorisBySantri(rows.map((s: any) => s.id))
  
  return rows.map((s: any) => ({
    id: s.id,
    nama_lengkap: s.nama_lengkap,
    kamar: s.kamar,
    foto_url: s.foto_url,
    sekolah: s.sekolah,
    kelas_sekolah: s.kelas_sekolah,
    kelas_pesantren: s.kelas_pesantren,
    bulan_ini_lunas: s.bulan_ini_lunas === 1,
    bebas_spp: s.bebas_spp === 1,
    tagihan_ditiadakan_bulan_ini: s.tagihan_ditiadakan_bulan_ini === 1,
    jumlah_tagihan_ditiadakan: s.jumlah_tagihan_ditiadakan ?? 0,
    jumlah_tunggakan_berjalan: s.bebas_spp === 1 ? 0 : Math.max(0, billableCount - (s.jumlah_bayar ?? 0) - (s.jumlah_tagihan_ditiadakan ?? 0)),
    jumlah_tunggakan_historis: historisMap.get(s.id) ?? 0,
    jumlah_tunggakan: (s.bebas_spp === 1 ? 0 : Math.max(0, billableCount - (s.jumlah_bayar ?? 0) - (s.jumlah_tagihan_ditiadakan ?? 0))) + (historisMap.get(s.id) ?? 0),
  }))
}

export async function getRekapStatistikSPP(tahun: number, unitSetor: string) {
  const session = await getSession()
  const scope = getScopeOrThrow(session)
  const unit = assertRequestedUnit(scope, unitSetor)
  const sadesaMode = isSadesaUnit(unit)

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const currentMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
  const nextMo = currentMonth === 12 ? 1 : currentMonth + 1
  const nextYr = currentMonth === 12 ? currentYear + 1 : currentYear
  const currentMonthEnd = `${nextYr}-${String(nextMo).padStart(2, '0')}-01`

  const billingStart = await getSppBillingStart()
  const isBeforeBillingStart = (tahun * 100 + currentMonth) < (billingStart.tahun * 100 + billingStart.bulan)

  const baseRows = await query<any>(`
    WITH
      base_santri AS (
        SELECT id, nama_lengkap, COALESCE(bebas_spp, 0) AS bebas_spp
        FROM santri
        WHERE status_global = 'aktif'
          ${sadesaMode ? 'AND kategori_santri = ?' : 'AND (kategori_santri IS NULL OR kategori_santri != ?) AND asrama = ?'}
      ),
      bayar_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
          AND psb_receipt_id IS NULL
      ),
      ditiadakan_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_tagihan_ditiadakan
        WHERE tahun = ? AND bulan = ? AND is_active = 1
        UNION
        -- SPP Juli via PSB: netral untuk asrama (uang ke Bendahara Pusat),
        -- diperlakukan seperti tidak ada tagihan di sisi asrama.
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ? AND psb_receipt_id IS NOT NULL
      ),
      uang_masuk_bulan_ini AS (
        SELECT sl.santri_id, sl.nominal_bayar, sl.bulan, sl.tahun
        FROM spp_log sl
        WHERE sl.tanggal_bayar >= ? AND sl.tanggal_bayar < ?
          AND sl.psb_receipt_id IS NULL
      ),
      uang_historis_masuk_bulan_ini AS (
        SELECT th.santri_id, th.nominal_tagihan
        FROM spp_tunggakan_historis th
        WHERE th.status = 'LUNAS'
          AND th.tanggal_lunas >= ? AND th.tanggal_lunas < ?
      )
    SELECT
      bs.id,
      bs.nama_lengkap,
      bs.bebas_spp,
      CASE WHEN di.santri_id IS NOT NULL THEN 1 ELSE 0 END AS ditiadakan_ini,
      CASE WHEN bi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bayar_ini,
      COALESCE(um.nominal_bayar, 0) AS nominal_bayar_masuk,
      COALESCE(um.bulan, 0) AS bulan_tagihan_dibayar,
      COALESCE(um.tahun, 0) AS tahun_tagihan_dibayar,
      COALESCE(uh.nominal_tagihan, 0) AS nominal_historis_masuk
    FROM base_santri bs
    LEFT JOIN ditiadakan_ini di ON di.santri_id = bs.id
    LEFT JOIN bayar_ini bi ON bi.santri_id = bs.id
    LEFT JOIN uang_masuk_bulan_ini um ON um.santri_id = bs.id
    LEFT JOIN uang_historis_masuk_bulan_ini uh ON uh.santri_id = bs.id
  `, sadesaMode ? [SADESA_CATEGORY, tahun, currentMonth, tahun, currentMonth, tahun, currentMonth, currentMonthStart, currentMonthEnd, currentMonthStart, currentMonthEnd]
                : [SADESA_CATEGORY, unit, tahun, currentMonth, tahun, currentMonth, tahun, currentMonth, currentMonthStart, currentMonthEnd, currentMonthStart, currentMonthEnd])

  let totalSantri = 0
  let bebasSppCount = 0
  const bebasSppList: string[] = []
  let tidakAdaTagihanIni = 0
  let bayarIni = 0
  let uangDiterimaTotal = 0
  let uangTunggakanLama = 0
  let uangHarusSetor = 0

  const processedPaymentIds = new Set<string>()

  for (const row of baseRows) {
    if (!processedPaymentIds.has(row.id)) {
      totalSantri++
      if (row.bebas_spp === 1) {
        bebasSppCount++
        bebasSppList.push(row.nama_lengkap)
      } else {
        if (row.ditiadakan_ini === 1) tidakAdaTagihanIni++
        if (row.bayar_ini === 1) bayarIni++
      }
      processedPaymentIds.add(row.id)
    }

    const uangMasuk = row.nominal_bayar_masuk + row.nominal_historis_masuk
    uangDiterimaTotal += uangMasuk
    
    if (uangMasuk > 0) {
      if (row.nominal_historis_masuk > 0) {
        uangTunggakanLama += row.nominal_historis_masuk
      }
      if (row.nominal_bayar_masuk > 0) {
        const isTunggakan = (row.tahun_tagihan_dibayar * 100 + row.bulan_tagihan_dibayar) < (new Date().getFullYear() * 100 + currentMonth)
        if (isTunggakan) {
          uangTunggakanLama += row.nominal_bayar_masuk
        } else {
          uangHarusSetor += row.nominal_bayar_masuk
        }
      }
    }
  }

  const wajibSpp = totalSantri - bebasSppCount
  const wajibBulanIni = isBeforeBillingStart ? 0 : Math.max(0, wajibSpp - tidakAdaTagihanIni)
  const nunggakBulanIni = isBeforeBillingStart ? 0 : Math.max(0, wajibBulanIni - bayarIni)

  return {
    totalSantri,
    bebasSppCount,
    bebasSppList,
    wajibSpp,
    wajibBulanIni,
    sudahBayarBulanIni: bayarIni,
    nunggakBulanIni,
    uangDiterimaTotal,
    uangTunggakanLama,
    uangHarusSetor,
    belumAdaTagihan: isBeforeBillingStart
  }
}

export async function getStatusSetoranUnit(tahun: number, unitSetor: string) {
  const session = await getSession()
  const scope = getScopeOrThrow(session)
  const unit = assertRequestedUnit(scope, unitSetor)
  
  const data = await query<any>(`
    SELECT ss.bulan, ss.tanggal_terima, ss.jumlah_aktual, ss.nama_penyetor, u.full_name AS penerima_nama
    FROM spp_setoran ss
    LEFT JOIN users u ON u.id = ss.penerima_id
    WHERE COALESCE(NULLIF(TRIM(ss.unit_setor), ''), ss.asrama) = ? AND ss.tahun = ?
    ORDER BY ss.bulan
  `, [unit, tahun])

  const statusBulan: Record<number, any> = {}
  data.forEach((d: any) => {
    statusBulan[d.bulan] = {
      lunas: true,
      tanggal: d.tanggal_terima,
      jumlahAktual: d.jumlah_aktual,
      penyetor: d.nama_penyetor,
      penerima: d.penerima_nama || 'Sistem',
    }
  })

  return statusBulan
}

export async function getFilterOptions(unitSetor: string) {
  const session = await getSession()
  const scope = getScopeOrThrow(session)
  const unit = assertRequestedUnit(scope, unitSetor)
  const sadesaMode = isSadesaUnit(unit)

  const rows = await query<any>(`
    SELECT DISTINCT
      COALESCE(s.kamar, '-') AS kamar,
      COALESCE(s.sekolah, '-') AS sekolah,
      COALESCE(s.kelas_sekolah, '-') AS kelas_sekolah,
      COALESCE(k.nama_kelas, '-') AS kelas_pesantren
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE s.status_global = 'aktif'
      ${sadesaMode ? 'AND s.kategori_santri = ?' : 'AND COALESCE(s.kategori_santri, "REGULER") != ? AND s.asrama = ?'}
  `, sadesaMode ? [SADESA_CATEGORY] : [SADESA_CATEGORY, unit])

  const kamars = new Set<string>()
  const sekolahs = new Set<string>()
  const kelasSekolahs = new Set<string>()
  const kelasPesantrens = new Set<string>()

  rows.forEach(r => {
    if (r.kamar && r.kamar !== '-') kamars.add(r.kamar)
    if (r.sekolah && r.sekolah !== '-') sekolahs.add(r.sekolah)
    if (r.kelas_sekolah && r.kelas_sekolah !== '-') kelasSekolahs.add(r.kelas_sekolah)
    if (r.kelas_pesantren && r.kelas_pesantren !== '-') kelasPesantrens.add(r.kelas_pesantren)
  })

  return {
    kamars: Array.from(kamars).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    sekolahs: Array.from(sekolahs).sort(),
    kelasSekolahs: Array.from(kelasSekolahs).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    kelasPesantrens: Array.from(kelasPesantrens).sort(),
  }
}

export async function bayarSPPBulanBerjalan(santriId: string, tahun: number, bulan: number, nominalPerBulan: number): Promise<{ success: boolean } | { error: string }> {
  try {
    const session = await getSession()
    const santri = await assertSantriAccess(session, santriId)
    if ((santri.bebas_spp ?? 0) === 1) return { error: 'Santri ini berstatus bebas SPP permanen.' }

    const billingStart = await getSppBillingStart()
    if ((tahun * 100 + bulan) < (billingStart.tahun * 100 + billingStart.bulan)) {
      return { error: 'Bulan tersebut belum memiliki tagihan SPP.' }
    }

    const waived = await query<{ bulan: number }>(
      `SELECT bulan FROM spp_tagihan_ditiadakan
       WHERE santri_id = ? AND tahun = ? AND bulan = ? AND is_active = 1`,
      [santriId, tahun, bulan]
    )
    if (waived.length > 0) return { error: 'Bulan tersebut berstatus TIDAK ADA TAGIHAN.' }

    const exist = await query<any>(
      `SELECT bulan FROM spp_log WHERE santri_id = ? AND tahun = ? AND bulan = ?`,
      [santriId, tahun, bulan]
    )
    if (exist.length > 0) return { error: 'Bulan tersebut sudah dibayar sebelumnya.' }

    await execute(
      `INSERT INTO spp_log (id, santri_id, tahun, bulan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
       VALUES (?, ?, ?, ?, ?, ?, 'Quick Pay', date('now'))`,
      [generateId(), santriId, tahun, bulan, nominalPerBulan, session?.id ?? null]
    )

    await logActivity({
      actor: actorFromSession(session),
      module: 'spp',
      action: 'payment',
      fiturHref: '/dashboard/asrama/spp',
      logKind: 'create',
      entityType: 'santri',
      entityId: santriId,
      entityLabel: santri.nama_lengkap || santri.nis || santriId,
      summary: `Mencatat pembayaran SPP (Quick Pay) untuk ${santri.nama_lengkap || santri.nis || santriId}`,
      details: {
        tahun,
        bulan: [bulan],
        nominal_per_bulan: nominalPerBulan,
        total_nominal: nominalPerBulan,
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
    const cleanTahun = Number(tahun)
    const cleanBulans = Array.from(new Set(bulans.map(Number))).filter(b => Number.isInteger(b) && b >= 1 && b <= 12).sort((a, b) => a - b)
    const cleanAlasan = String(alasan || '').trim()
    if (!Number.isInteger(cleanKelas) || cleanKelas < 1 || cleanKelas > 13) return { error: 'Kelas sekolah tidak valid.' }
    if (!Number.isInteger(cleanTahun) || cleanTahun < 2000) return { error: 'Tahun tidak valid.' }
    if (!cleanBulans.length) return { error: 'Pilih minimal satu bulan.' }
    if (!cleanAlasan) return { error: 'Alasan wajib diisi.' }

    const billingStart = await getSppBillingStart()
    if (cleanBulans.some(b => (cleanTahun * 100 + b) < (billingStart.tahun * 100 + billingStart.bulan))) {
      return { error: 'Bulan tersebut belum memiliki tagihan SPP.' }
    }

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

    const totalRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM santri s
       WHERE ${where}`,
      params
    )
    const santriCount = totalRow?.total ?? 0
    if (santriCount === 0) return { error: 'Tidak ada santri aktif yang cocok dengan kelas dan unit tersebut.' }

    const now = new Date().toISOString()
    let targetCount = 0
    for (const bulan of cleanBulans) {
      const countRow = await queryOne<{ total: number }>(
        `SELECT COUNT(*) AS total
         FROM santri s
         WHERE ${where}
           AND NOT EXISTS (
             SELECT 1 FROM spp_log sl
             WHERE sl.santri_id = s.id AND sl.tahun = ? AND sl.bulan = ?
           )`,
        [...params, cleanTahun, bulan]
      )
      targetCount += countRow?.total ?? 0

      await execute(
        `INSERT INTO spp_tagihan_ditiadakan
            (id, santri_id, tahun, bulan, alasan, is_active, created_by, created_at, updated_by, updated_at)
         SELECT lower(hex(randomblob(16))), s.id, ?, ?, ?, 1, ?, ?, ?, ?
         FROM santri s
         WHERE ${where}
           AND NOT EXISTS (
             SELECT 1 FROM spp_log sl
             WHERE sl.santri_id = s.id AND sl.tahun = ? AND sl.bulan = ?
           )
         ON CONFLICT(santri_id, tahun, bulan) DO UPDATE SET
           alasan = excluded.alasan,
           is_active = 1,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`,
        [cleanTahun, bulan, cleanAlasan, session?.id ?? null, now, session?.id ?? null, now, ...params, cleanTahun, bulan]
      )
    }

    await logActivity({
      actor: actorFromSession(session),
      module: 'spp',
      action: 'waive_monthly_bill_by_class',
      fiturHref: '/dashboard/asrama/spp',
      logKind: 'update',
      entityType: 'santri_batch',
      entityId: 'spp-tagihan-ditiadakan-kelas',
      entityLabel: `Kelas ${cleanKelas}`,
      summary: `Meniadakan tagihan SPP kelas ${cleanKelas} untuk ${cleanBulans.length} bulan`,
      details: { unit_setor: cleanUnit, kelas_sekolah: cleanKelas, tahun: cleanTahun, bulan: cleanBulans, alasan: cleanAlasan },
    })

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    revalidatePath('/dashboard/dewan-santri/surat')
    return { success: true, count: targetCount, santriCount }
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

export async function bayarSemuaSantriAsrama(
  unitSetor: string,
  tahun: number,
  bulan: number,
  nominalPerBulan: number
): Promise<{ success: boolean; count: number } | { error: string }> {
  try {
    const session = await getSession()
    const scope = getScopeOrThrow(session)
    const unit = assertRequestedUnit(scope, unitSetor)

    const billingStart = await getSppBillingStart()
    if ((tahun * 100 + bulan) < (billingStart.tahun * 100 + billingStart.bulan)) {
      return { error: 'Bulan tersebut belum memiliki tagihan SPP.' }
    }

    const sadesaMode = isSadesaUnit(unit)
    const unitWhere = sadesaMode
      ? `AND s.kategori_santri = ?`
      : `AND COALESCE(s.kategori_santri, 'REGULER') != ? AND s.asrama = ?`
    const unitParams: any[] = sadesaMode ? [SADESA_CATEGORY] : [SADESA_CATEGORY, unit]

    const eligibleSql = `
      SELECT COUNT(*) AS total FROM santri s
      WHERE s.status_global = 'aktif'
        AND COALESCE(s.bebas_spp, 0) = 0
        ${unitWhere}
        AND NOT EXISTS (
          SELECT 1 FROM spp_tagihan_ditiadakan td
          WHERE td.santri_id = s.id AND td.tahun = ? AND td.bulan = ? AND td.is_active = 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM spp_log sl
          WHERE sl.santri_id = s.id AND sl.tahun = ? AND sl.bulan = ?
        )`

    const countRow = await queryOne<{ total: number }>(eligibleSql, [...unitParams, tahun, bulan, tahun, bulan])
    const count = countRow?.total ?? 0
    if (count === 0) return { error: 'Tidak ada santri dengan tagihan yang belum lunas.' }

    await execute(
      `INSERT INTO spp_log (id, santri_id, tahun, bulan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
       SELECT lower(hex(randomblob(16))), s.id, ?, ?, ?, ?, 'Bayar Semua', date('now')
       FROM santri s
       WHERE s.status_global = 'aktif'
         AND COALESCE(s.bebas_spp, 0) = 0
         ${unitWhere}
         AND NOT EXISTS (
           SELECT 1 FROM spp_tagihan_ditiadakan td
           WHERE td.santri_id = s.id AND td.tahun = ? AND td.bulan = ? AND td.is_active = 1
         )
         AND NOT EXISTS (
           SELECT 1 FROM spp_log sl
           WHERE sl.santri_id = s.id AND sl.tahun = ? AND sl.bulan = ?
         )`,
      [tahun, bulan, nominalPerBulan, session?.id ?? null, ...unitParams, tahun, bulan, tahun, bulan]
    )

    await logActivity({
      actor: actorFromSession(session),
      module: 'spp',
      action: 'payment',
      fiturHref: '/dashboard/asrama/spp',
      logKind: 'create',
      entityType: 'santri_batch',
      entityId: 'spp-bayar-semua',
      entityLabel: unit,
      summary: `Mencatat pembayaran SPP massal ${count} santri ${unit} bulan ${bulan}/${tahun}`,
      details: { tahun, bulan, nominal_per_bulan: nominalPerBulan, unit_setor: unit, count },
    })

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    return { success: true, count }
  } catch (error: any) {
    return { error: error?.message || 'Gagal membayar semua santri.' }
  }
}

export async function getSetoranInfoBulanIni() {
  const session = await getSession()
  const scope = getScopeOrThrow(session)
  const unit = scope.defaultUnit
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1

  const [windowRow, setoranRow] = await Promise.all([
    queryOne<{ tanggal_mulai: string }>(
      `SELECT tanggal_mulai FROM spp_setoran_window WHERE tahun = ? AND bulan = ?`,
      [yr, mo]
    ),
    queryOne<{
      tanggal_setor: string | null
      tanggal_terima: string | null
      jumlah_aktual: number | null
      jumlah_bulan_ini: number | null
      jumlah_tunggakan_bayar: number | null
      status: string | null
      nama_penyetor: string | null
    }>(
      `SELECT tanggal_setor, tanggal_terima, jumlah_aktual, jumlah_bulan_ini, jumlah_tunggakan_bayar, status, nama_penyetor
       FROM spp_setoran
       WHERE COALESCE(NULLIF(TRIM(unit_setor), ''), asrama) = ? AND tahun = ? AND bulan = ?`,
      [unit, yr, mo]
    ),
  ])

  return {
    unit,
    tahun: yr,
    bulan: mo,
    tanggalMulai: windowRow?.tanggal_mulai ?? null,
    setoran: setoranRow ?? null,
  }
}

export async function submitSetoranAsrama(
  jumlahBulanIni: number,
  jumlahTunggakan: number,
  namaPenyetor: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const session = await getSession()
    const scope = getScopeOrThrow(session)
    const unit = scope.defaultUnit
    const cleanUnit = unit.trim().toUpperCase()

    const now = new Date()
    const yr = now.getFullYear()
    const mo = now.getMonth() + 1
    const today = now.toISOString().slice(0, 10)

    const windowRow = await queryOne<{ tanggal_mulai: string }>(
      `SELECT tanggal_mulai FROM spp_setoran_window WHERE tahun = ? AND bulan = ?`,
      [yr, mo]
    )
    if (!windowRow) return { error: 'Dewan Santri belum membuka periode setoran bulan ini.' }
    if (today < windowRow.tanggal_mulai) return { error: `Setoran baru dibuka mulai ${windowRow.tanggal_mulai}.` }

    const existing = await queryOne<{ tanggal_terima: string | null }>(
      `SELECT tanggal_terima FROM spp_setoran WHERE COALESCE(NULLIF(TRIM(unit_setor), ''), asrama) = ? AND tahun = ? AND bulan = ?`,
      [cleanUnit, yr, mo]
    )
    if (existing?.tanggal_terima) return { error: 'Setoran bulan ini sudah dikonfirmasi oleh Dewan Santri.' }

    const jumlahTotal = (jumlahBulanIni || 0) + (jumlahTunggakan || 0)
    if (jumlahTotal <= 0) return { error: 'Jumlah setoran harus lebih dari 0.' }
    if (!namaPenyetor.trim()) return { error: 'Nama penyetor wajib diisi.' }

    await execute(
      `INSERT INTO spp_setoran
         (id, asrama, unit_setor, jenis_unit_setor, bulan, tahun,
          tanggal_setor, nama_penyetor, jumlah_aktual, jumlah_bulan_ini, jumlah_tunggakan_bayar, status)
       VALUES (?, ?, ?, ?, ?, ?, date('now'), ?, ?, ?, ?, 'menunggu_konfirmasi')
       ON CONFLICT(unit_setor, bulan, tahun) DO UPDATE SET
         tanggal_setor         = excluded.tanggal_setor,
         nama_penyetor         = excluded.nama_penyetor,
         jumlah_aktual         = excluded.jumlah_aktual,
         jumlah_bulan_ini      = excluded.jumlah_bulan_ini,
         jumlah_tunggakan_bayar = excluded.jumlah_tunggakan_bayar,
         status                = 'menunggu_konfirmasi'`,
      [
        generateId(), cleanUnit, cleanUnit,
        isSadesaUnit(cleanUnit) ? 'SADESA' : 'ASRAMA',
        mo, yr,
        namaPenyetor.trim(), jumlahTotal, jumlahBulanIni || 0, jumlahTunggakan || 0,
      ]
    )

    revalidatePath('/dashboard/asrama/spp')
    revalidatePath('/dashboard/dewan-santri/setoran')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal mengirim setoran.' }
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
    psb_receipt_id: string | null
  }>(
    `SELECT sl.id, sl.santri_id, sl.bulan, sl.tahun, sl.nominal_bayar, s.nama_lengkap, s.nis, sl.psb_receipt_id
     FROM spp_log sl
     LEFT JOIN santri s ON s.id = sl.santri_id
     WHERE sl.id = ?`,
    [logId]
  )
  if (!current) return { error: 'Data pembayaran tidak ditemukan.' }
  if (current.psb_receipt_id) {
    return { error: 'SPP Juli ini dibayar via PSB. Batalkan lewat void kuitansi PSB, bukan dari sini.' }
  }

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
