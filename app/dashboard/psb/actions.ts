'use server'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { assertFeature } from '@/lib/auth/feature'
import { getSession, hasAnyRole, hasRole, isAdmin, type SessionUser } from '@/lib/auth/session'
import { execute, generateId, getDB, query, queryOne, today } from '@/lib/db'
import { getKategoriSantriEfektifSql, normalizeKategoriSantriDasar } from '@/lib/santri/kategori'

const PSB_PATH = '/dashboard/psb'
const MONITORING_PATH = '/dashboard/psb/monitoring'

const SEKOLAH_LIST = ['MTSU', 'MTSN', 'MAN', 'SMK', 'SMA', 'SMP', 'LAINNYA'] as const
const ASRAMA_LIST = ['AL-FALAH', 'AS-SALAM', 'BAHAGIA', 'ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4', 'AL-BAGHORY']
const STATUS_ORDER = ['VERIFICATION', 'VERIFIED', 'PLACED_ASRAMA', 'PLACED_KAMAR', 'PAID', 'DONE'] as const
const BIAYA_TAHUNAN = ['KESEHATAN', 'EHB', 'EKSKUL'] as const

export type PsbStatus = (typeof STATUS_ORDER)[number]
export type PsbPaymentInput = {
  jenis: 'BANGUNAN' | 'KESEHATAN' | 'EHB' | 'EKSKUL'
  nominal?: number
}

type SantriPsbRow = {
  id: string
  nis: string
  nama_lengkap: string
  jenis_kelamin: string
  sekolah: string | null
  kelas_sekolah: string | null
  asrama: string | null
  kamar: string | null
  tahun_masuk: number | null
  tanggal_masuk: string | null
  created_at: string
  kategori_santri: string | null
  kategori_efektif: string
  psb_flow_id: string | null
  status: PsbStatus | null
  verification_note: string | null
  verified_at: string | null
  placed_asrama_at: string | null
  placed_kamar_at: string | null
  paid_at: string | null
  done_at: string | null
}

function hasProcessAccess(session: SessionUser | null) {
  return isAdmin(session) || hasAnyRole(session, ['sekpen', 'pengurus_asrama', 'bendahara'])
}

function canSekretariat(session: SessionUser | null) {
  return isAdmin(session) || hasRole(session, 'sekpen')
}

function canPenempatan(session: SessionUser | null) {
  return isAdmin(session) || hasRole(session, 'sekpen')
}

function canKamar(session: SessionUser | null) {
  return isAdmin(session) || hasRole(session, 'pengurus_asrama')
}

function canBayar(session: SessionUser | null) {
  return isAdmin(session) || hasRole(session, 'bendahara')
}

function statusAtLeast(status: PsbStatus, minimum: PsbStatus) {
  return STATUS_ORDER.indexOf(status) >= STATUS_ORDER.indexOf(minimum)
}

function normalizeStatus(status: string | null | undefined): PsbStatus {
  return STATUS_ORDER.includes(status as PsbStatus) ? status as PsbStatus : 'VERIFICATION'
}

function hasCompletedPsbPayment(params: {
  bangunanTarget: number
  bangunanPaid: number
  tahunTagihan: number
  payments: Array<{ jenis_biaya: string; tahun_tagihan: number | null }>
}) {
  const bangunanLunas = params.bangunanTarget <= 0 || params.bangunanPaid >= params.bangunanTarget
  const tahunanLunas = BIAYA_TAHUNAN.every((jenis) =>
    params.payments.some((row) => row.jenis_biaya === jenis && Number(row.tahun_tagihan) === params.tahunTagihan)
  )
  return bangunanLunas && tahunanLunas
}

function deriveFlowStatusFromPayments(params: {
  bangunanTarget: number
  bangunanPaid: number
  tahunTagihan: number
  payments: Array<{ jenis_biaya: string; tahun_tagihan: number | null }>
}): PsbStatus {
  if (hasCompletedPsbPayment(params)) return 'DONE'
  return params.payments.length > 0 ? 'PAID' : 'PLACED_KAMAR'
}

function yearFromSantri(row: { tahun_masuk: number | null; tanggal_masuk?: string | null; created_at: string | null }) {
  if (row.tahun_masuk) return Number(row.tahun_masuk)
  const tanggalMasukYear = Number(String(row.tanggal_masuk ?? '').slice(0, 4))
  if (Number.isFinite(tanggalMasukYear) && tanggalMasukYear > 0) return tanggalMasukYear
  const parsed = row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear()
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear()
}

async function ensureSchema() {
  const db = await getDB()
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS psb_flow (
        id                    TEXT PRIMARY KEY,
        santri_id             TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        status                TEXT NOT NULL DEFAULT 'VERIFICATION',
        verification_note     TEXT,
        verified_by           TEXT REFERENCES users(id),
        verified_at           TEXT,
        placed_asrama_by      TEXT REFERENCES users(id),
        placed_asrama_at      TEXT,
        placed_kamar_by       TEXT REFERENCES users(id),
        placed_kamar_at       TEXT,
        paid_by               TEXT REFERENCES users(id),
        paid_at               TEXT,
        done_by               TEXT REFERENCES users(id),
        done_at               TEXT,
        created_by            TEXT REFERENCES users(id),
        created_at            TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(santri_id)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS psb_payment_receipt (
        id             TEXT PRIMARY KEY,
        receipt_no     TEXT NOT NULL UNIQUE,
        santri_id      TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        tahun_tagihan  INTEGER NOT NULL,
        total          INTEGER NOT NULL DEFAULT 0,
        created_by     TEXT REFERENCES users(id),
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `),
  ])

  const paymentColumns = await query<{ name: string }>('PRAGMA table_info(pembayaran_tahunan)')
  if (!paymentColumns.some((col) => col.name === 'psb_receipt_id')) {
    await execute('ALTER TABLE pembayaran_tahunan ADD COLUMN psb_receipt_id TEXT REFERENCES psb_payment_receipt(id)')
  }
}

async function getPsbRows(session: SessionUser | null, filters?: {
  q?: string
  sekolah?: string
  asrama?: string
  status?: string
}) {
  await ensureSchema()
  const kategoriSql = getKategoriSantriEfektifSql('s')
  const params: unknown[] = []
  let where = `s.status_global = 'aktif' AND ((${kategoriSql}) = 'BARU' OR pf.id IS NOT NULL)`

  if (hasRole(session, 'pengurus_asrama') && !isAdmin(session) && session?.asrama_binaan) {
    where += ` AND s.asrama = ?`
    params.push(session.asrama_binaan)
  }
  if (filters?.q?.trim()) {
    where += ` AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)`
    const term = `%${filters.q.trim()}%`
    params.push(term, term)
  }
  if (filters?.sekolah) {
    where += ` AND s.sekolah = ?`
    params.push(filters.sekolah)
  }
  if (filters?.asrama) {
    where += ` AND s.asrama = ?`
    params.push(filters.asrama)
  }

  const statusFilter = normalizeStatus(filters?.status)
  const rows = await query<SantriPsbRow>(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.sekolah, s.kelas_sekolah,
           s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at, s.kategori_santri,
           ${kategoriSql} AS kategori_efektif,
           pf.id AS psb_flow_id,
           COALESCE(pf.status, 'VERIFICATION') AS status,
           pf.verification_note,
           pf.verified_at,
           pf.placed_asrama_at,
           pf.placed_kamar_at,
           pf.paid_at,
           pf.done_at
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE ${where}
    ORDER BY s.created_at DESC, s.nama_lengkap
  `, params)

  if (filters?.status) {
    return rows.filter((row) => normalizeStatus(row.status) === statusFilter)
  }
  return rows
}

async function getPaymentInfoForRows(rows: SantriPsbRow[], tahunTagihan: number) {
  if (!rows.length) return new Map<string, any>()
  const ids = rows.map((row) => row.id)
  const placeholders = ids.map(() => '?').join(',')
  const pembayaran = await query<any>(
    `SELECT santri_id, jenis_biaya, nominal_bayar, tahun_tagihan
     FROM pembayaran_tahunan
     WHERE santri_id IN (${placeholders})`,
    ids
  )
  const tarif = await query<any>('SELECT tahun_angkatan, jenis_biaya, nominal FROM biaya_settings')
  const receipts = await query<any>(
    `SELECT id, santri_id, receipt_no, total, created_at
     FROM psb_payment_receipt
     WHERE santri_id IN (${placeholders})
     ORDER BY datetime(created_at) DESC, created_at DESC`,
    ids
  )
  const tarifMap = new Map<string, number>()
  tarif.forEach((row) => tarifMap.set(`${row.tahun_angkatan}:${row.jenis_biaya}`, Number(row.nominal ?? 0)))

  const result = new Map<string, any>()
  rows.forEach((row) => {
    const tahunMasuk = yearFromSantri(row)
    const paySantri = pembayaran.filter((p) => p.santri_id === row.id)
    const bangunanPaid = paySantri
      .filter((p) => p.jenis_biaya === 'BANGUNAN')
      .reduce((sum, p) => sum + Number(p.nominal_bayar ?? 0), 0)
    const bangunanTarget = tarifMap.get(`${tahunMasuk}:BANGUNAN`) ?? 0
    const latestReceipt = receipts.find((receipt) => receipt.santri_id === row.id) ?? null
    const tahunan = Object.fromEntries(BIAYA_TAHUNAN.map((jenis) => {
      const nominal = tarifMap.get(`${tahunMasuk}:${jenis}`) ?? 0
      const lunas = paySantri.some((p) => p.jenis_biaya === jenis && Number(p.tahun_tagihan) === tahunTagihan)
      return [jenis, { nominal, lunas }]
    }))

    result.set(row.id, {
      tahunMasuk,
      bangunan: {
        target: bangunanTarget,
        paid: bangunanPaid,
        sisa: Math.max(0, bangunanTarget - bangunanPaid),
      },
      tahunan,
      latestReceipt,
    })
  })
  return result
}

async function getAsramaPsbStats() {
  const kategoriSql = getKategoriSantriEfektifSql('s')
  const placeholders = ASRAMA_LIST.map(() => '?').join(',')
  const [quotaRows, placedRows] = await Promise.all([
    query<{ asrama: string; total_kuota: number; kuota_baru: number }>(
      `SELECT asrama,
              SUM(COALESCE(kuota, 0)) AS total_kuota,
              SUM(COALESCE(reserved_baru, 0)) AS kuota_baru
       FROM kamar_config
       WHERE asrama IN (${placeholders})
       GROUP BY asrama`,
      ASRAMA_LIST
    ),
    query<{ asrama: string; terisi_baru: number }>(
      `SELECT s.asrama, COUNT(*) AS terisi_baru
       FROM santri s
       LEFT JOIN psb_flow pf ON pf.santri_id = s.id
       WHERE s.status_global = 'aktif'
         AND s.asrama IS NOT NULL
         AND TRIM(s.asrama) <> ''
         AND ((${kategoriSql}) = 'BARU' OR pf.id IS NOT NULL)
       GROUP BY s.asrama`
    ),
  ])

  const quotaByAsrama = new Map(quotaRows.map((row) => [row.asrama, row]))
  const placedByAsrama = new Map(placedRows.map((row) => [row.asrama, Number(row.terisi_baru ?? 0)]))

  return ASRAMA_LIST.map((asrama) => {
    const quota = quotaByAsrama.get(asrama)
    const totalKuota = Number(quota?.total_kuota ?? 0)
    const reservedKuota = Number(quota?.kuota_baru ?? 0)
    const kuotaBaru = reservedKuota > 0 ? reservedKuota : totalKuota
    const terisiBaru = Number(placedByAsrama.get(asrama) ?? 0)
    const sisa = kuotaBaru - terisiBaru
    return {
      asrama,
      total_kuota: totalKuota,
      kuota_baru: kuotaBaru,
      terisi_baru: terisiBaru,
      sisa,
      over: Math.max(0, terisiBaru - kuotaBaru),
      status: kuotaBaru <= 0
        ? (terisiBaru > 0 ? 'OVER' : 'BELUM_CONFIG')
        : terisiBaru > kuotaBaru
          ? 'OVER'
          : terisiBaru === kuotaBaru
            ? 'PENUH'
            : 'TERSEDIA',
    }
  })
}

export async function getPsbDashboard(filters?: {
  q?: string
  sekolah?: string
  asrama?: string
  status?: string
  tahunTagihan?: number
}) {
  const access = await assertFeature(PSB_PATH)
  if ('error' in access) return access
  if (!hasProcessAccess(access)) return { error: 'Akses ditolak' }

  const tahunTagihan = Number(filters?.tahunTagihan ?? new Date().getFullYear())
  const rows = await getPsbRows(access, filters)
  const payments = await getPaymentInfoForRows(rows, tahunTagihan)
  const asramaStats = await getAsramaPsbStats()
  const summary = STATUS_ORDER.reduce((acc, status) => ({ ...acc, [status]: 0 }), {} as Record<PsbStatus, number>)
  rows.forEach((row) => { summary[normalizeStatus(row.status)] += 1 })

  return {
    rows: rows.map((row) => ({
      ...row,
      status: normalizeStatus(row.status),
      tahun_masuk_fix: payments.get(row.id)?.tahunMasuk ?? yearFromSantri(row),
      pembayaran: payments.get(row.id) ?? null,
    })),
    summary,
    asramaStats,
    asramaList: ASRAMA_LIST,
    sekolahList: SEKOLAH_LIST,
    user: {
      roles: access.roles,
      role: access.role,
      asrama_binaan: access.asrama_binaan,
      canSekretariat: canSekretariat(access),
      canPenempatan: canPenempatan(access),
      canKamar: canKamar(access),
      canBayar: canBayar(access),
    },
  }
}

export async function getPsbMonitoring(filters?: {
  q?: string
  sekolah?: string
  asrama?: string
  status?: string
}) {
  const access = await assertFeature(MONITORING_PATH)
  if ('error' in access) return access
  const rows = await getPsbRows(access, filters)
  const summary = STATUS_ORDER.reduce((acc, status) => ({ ...acc, [status]: 0 }), {} as Record<PsbStatus, number>)
  rows.forEach((row) => { summary[normalizeStatus(row.status)] += 1 })

  return {
    rows: rows.map((row) => ({ ...row, status: normalizeStatus(row.status), tahun_masuk_fix: yearFromSantri(row) })),
    summary,
    asramaList: ASRAMA_LIST,
    sekolahList: SEKOLAH_LIST,
  }
}

async function nextTempNis() {
  const prefix = `PSB-${today().replace(/-/g, '')}`
  for (let i = 1; i <= 9999; i += 1) {
    const nis = `${prefix}-${String(i).padStart(4, '0')}`
    const exists = await queryOne<{ id: string }>('SELECT id FROM santri WHERE nis = ?', [nis])
    if (!exists) return nis
  }
  return `${prefix}-${generateId().slice(0, 8).toUpperCase()}`
}

export async function tambahSantriDadakan(input: {
  nama_lengkap: string
  jenis_kelamin: 'L' | 'P'
  sekolah?: string
}) {
  const access = await assertFeature(PSB_PATH, 'create')
  if ('error' in access) return access
  if (!canSekretariat(access)) return { error: 'Akses ditolak' }

  await ensureSchema()
  const nama = String(input.nama_lengkap ?? '').trim()
  if (!nama) return { error: 'Nama santri wajib diisi' }
  const jenisKelamin = input.jenis_kelamin === 'P' ? 'P' : 'L'
  const sekolah = input.sekolah && SEKOLAH_LIST.includes(input.sekolah as any) ? input.sekolah : null
  const santriId = generateId()
  const flowId = generateId()
  const nis = await nextTempNis()
  const tanggalMasuk = today()
  const tahunMasuk = Number(tanggalMasuk.slice(0, 4))

  const db = await getDB()
  await db.batch([
    db.prepare(`
      INSERT INTO santri (
        id, nis, nama_lengkap, jenis_kelamin, sekolah, tanggal_masuk, tahun_masuk,
        status_global, kategori_santri, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif', ?, datetime('now'), datetime('now'))
    `).bind(santriId, nis, nama, jenisKelamin, sekolah, tanggalMasuk, tahunMasuk, normalizeKategoriSantriDasar('REGULER')),
    db.prepare(`
      INSERT INTO psb_flow (
        id, santri_id, status, verified_by, verified_at, created_by, created_at, updated_at
      ) VALUES (?, ?, 'VERIFIED', ?, datetime('now'), ?, datetime('now'), datetime('now'))
    `).bind(flowId, santriId, access.id, access.id),
  ])

  await logActivity({
    actor: actorFromSession(access),
    module: 'psb',
    action: 'create',
    fiturHref: PSB_PATH,
    logKind: 'create',
    entityType: 'santri',
    entityId: santriId,
    entityLabel: nama,
    summary: `Input santri dadakan PSB: ${nama}`,
    details: { nis, jenis_kelamin: jenisKelamin, sekolah },
  })

  revalidatePath(PSB_PATH)
  revalidatePath(MONITORING_PATH)
  return { success: true, santriId, nis }
}

export async function verifikasiSantriPsb(santriId: string, note?: string) {
  const access = await assertFeature(PSB_PATH, 'update')
  if ('error' in access) return access
  if (!canSekretariat(access)) return { error: 'Akses ditolak' }
  await ensureSchema()

  const santri = await queryOne<{ nama_lengkap: string }>('SELECT nama_lengkap FROM santri WHERE id = ? AND status_global = ?', [santriId, 'aktif'])
  if (!santri) return { error: 'Santri tidak ditemukan' }

  await execute(`
    INSERT INTO psb_flow (id, santri_id, status, verification_note, verified_by, verified_at, created_by, created_at, updated_at)
    VALUES (?, ?, 'VERIFIED', ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
    ON CONFLICT(santri_id) DO UPDATE SET
      status = CASE WHEN psb_flow.status = 'VERIFICATION' THEN 'VERIFIED' ELSE psb_flow.status END,
      verification_note = excluded.verification_note,
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at,
      updated_at = excluded.updated_at
  `, [generateId(), santriId, note?.trim() || null, access.id, access.id])

  await logActivity({
    actor: actorFromSession(access),
    module: 'psb',
    action: 'update',
    fiturHref: PSB_PATH,
    logKind: 'update',
    entityType: 'psb_flow',
    entityId: santriId,
    entityLabel: santri.nama_lengkap,
    summary: `Verifikasi PSB ${santri.nama_lengkap}`,
    details: { note: note?.trim() || null },
  })
  revalidatePath(PSB_PATH)
  revalidatePath(MONITORING_PATH)
  return { success: true }
}

export async function tempatkanAsramaPsb(santriId: string, asrama: string) {
  const access = await assertFeature(PSB_PATH, 'update')
  if ('error' in access) return access
  if (!canPenempatan(access)) return { error: 'Akses ditolak' }
  await ensureSchema()

  const targetAsrama = String(asrama ?? '').trim().toUpperCase()
  if (!ASRAMA_LIST.includes(targetAsrama)) return { error: 'Asrama tidak valid' }
  const row = await queryOne<{ status: string | null; nama_lengkap: string; asrama: string | null; kamar: string | null }>(`
    SELECT pf.status, s.nama_lengkap, s.asrama, s.kamar
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `, [santriId])
  if (!row) return { error: 'Santri tidak ditemukan' }
  if (!statusAtLeast(normalizeStatus(row.status), 'VERIFIED')) return { error: 'Santri belum diverifikasi sekretariat' }

  const db = await getDB()
  await db.batch([
    db.prepare('UPDATE santri SET asrama = ?, kamar = NULL, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(targetAsrama, santriId),
    db.prepare(`
      INSERT INTO psb_flow (id, santri_id, status, placed_asrama_by, placed_asrama_at, created_by, created_at, updated_at)
      VALUES (?, ?, 'PLACED_ASRAMA', ?, datetime('now'), ?, datetime('now'), datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET
        status = CASE WHEN psb_flow.status IN ('VERIFICATION','VERIFIED','PLACED_ASRAMA') THEN 'PLACED_ASRAMA' ELSE psb_flow.status END,
        placed_asrama_by = excluded.placed_asrama_by,
        placed_asrama_at = excluded.placed_asrama_at,
        updated_at = excluded.updated_at
    `).bind(generateId(), santriId, access.id, access.id),
  ])

  await logActivity({
    actor: actorFromSession(access),
    module: 'psb',
    action: 'update',
    fiturHref: PSB_PATH,
    logKind: 'update',
    entityType: 'psb_flow',
    entityId: santriId,
    entityLabel: row.nama_lengkap,
    summary: `Menempatkan ${row.nama_lengkap} ke asrama ${targetAsrama}`,
    details: { asrama_lama: row.asrama, kamar_lama: row.kamar, asrama_baru: targetAsrama },
  })
  revalidatePath(PSB_PATH)
  revalidatePath(MONITORING_PATH)
  return { success: true }
}

export async function getKamarPsb(asrama: string) {
  const access = await assertFeature(PSB_PATH)
  if ('error' in access) return access
  const targetAsrama = String(asrama ?? '').trim().toUpperCase()
  if (!targetAsrama) return []
  if (!isAdmin(access) && hasRole(access, 'pengurus_asrama') && access.asrama_binaan !== targetAsrama) {
    return { error: 'Anda hanya boleh melihat kamar asrama binaan Anda' }
  }
  await ensureSchema()
  return query<any>(`
    SELECT kc.nomor_kamar, kc.kuota, COALESCE(kc.reserved_baru, 0) AS reserved_baru, kc.blok,
           COUNT(s.id) AS terisi,
           (kc.kuota - COUNT(s.id)) AS slot_kosong,
           ((CASE WHEN COALESCE(kc.reserved_baru, 0) > 0 THEN COALESCE(kc.reserved_baru, 0) ELSE kc.kuota END) - COUNT(s.id)) AS sisa_slot_baru
    FROM kamar_config kc
    LEFT JOIN santri s ON s.asrama = kc.asrama AND s.kamar = kc.nomor_kamar AND s.status_global = 'aktif'
    WHERE kc.asrama = ?
    GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru, kc.blok
    ORDER BY CAST(kc.nomor_kamar AS INTEGER), kc.nomor_kamar
  `, [targetAsrama])
}

export async function tempatkanKamarPsb(santriId: string, kamar: string) {
  const access = await assertFeature(PSB_PATH, 'update')
  if ('error' in access) return access
  if (!canKamar(access)) return { error: 'Akses ditolak' }
  await ensureSchema()

  const targetKamar = String(kamar ?? '').trim()
  if (!targetKamar) return { error: 'Kamar wajib dipilih' }
  const row = await queryOne<{ status: string | null; nama_lengkap: string; asrama: string | null }>(`
    SELECT pf.status, s.nama_lengkap, s.asrama
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `, [santriId])
  if (!row) return { error: 'Santri tidak ditemukan' }
  if (!row.asrama) return { error: 'Santri belum ditempatkan ke asrama' }
  if (!statusAtLeast(normalizeStatus(row.status), 'PLACED_ASRAMA')) return { error: 'Santri belum masuk tahap kamar' }
  if (!isAdmin(access) && hasRole(access, 'pengurus_asrama') && access.asrama_binaan !== row.asrama) {
    return { error: 'Anda hanya boleh mengelola asrama binaan Anda' }
  }

  const kamarRow = await queryOne<{ nomor_kamar: string; kuota: number; reserved_baru: number; terisi: number; sisa_slot_baru: number }>(`
    SELECT kc.nomor_kamar, kc.kuota, COALESCE(kc.reserved_baru, 0) AS reserved_baru,
           COUNT(s.id) AS terisi,
           ((CASE WHEN COALESCE(kc.reserved_baru, 0) > 0 THEN COALESCE(kc.reserved_baru, 0) ELSE kc.kuota END) - COUNT(s.id)) AS sisa_slot_baru
    FROM kamar_config kc
    LEFT JOIN santri s ON s.asrama = kc.asrama AND s.kamar = kc.nomor_kamar AND s.status_global = 'aktif' AND s.id <> ?
    WHERE kc.asrama = ? AND kc.nomor_kamar = ?
    GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru
  `, [santriId, row.asrama, targetKamar])
  if (!kamarRow) return { error: 'Kamar belum dikonfigurasi di asrama ini' }

  const db = await getDB()
  await db.batch([
    db.prepare('UPDATE santri SET kamar = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(targetKamar, santriId),
    db.prepare(`
      INSERT INTO psb_flow (id, santri_id, status, placed_kamar_by, placed_kamar_at, created_by, created_at, updated_at)
      VALUES (?, ?, 'PLACED_KAMAR', ?, datetime('now'), ?, datetime('now'), datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET
        status = CASE WHEN psb_flow.status IN ('VERIFICATION','VERIFIED','PLACED_ASRAMA','PLACED_KAMAR') THEN 'PLACED_KAMAR' ELSE psb_flow.status END,
        placed_kamar_by = excluded.placed_kamar_by,
        placed_kamar_at = excluded.placed_kamar_at,
        updated_at = excluded.updated_at
    `).bind(generateId(), santriId, access.id, access.id),
  ])

  await logActivity({
    actor: actorFromSession(access),
    module: 'psb',
    action: 'update',
    fiturHref: PSB_PATH,
    logKind: 'update',
    entityType: 'psb_flow',
    entityId: santriId,
    entityLabel: row.nama_lengkap,
    summary: `Menempatkan ${row.nama_lengkap} ke kamar ${targetKamar}`,
    details: { asrama: row.asrama, kamar: targetKamar },
  })
  revalidatePath(PSB_PATH)
  revalidatePath(MONITORING_PATH)
  return { success: true }
}

async function nextReceiptNo() {
  const prefix = `PSB/${today().replace(/-/g, '')}`
  const row = await queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM psb_payment_receipt WHERE receipt_no LIKE ?',
    [`${prefix}/%`]
  )
  return `${prefix}/${String(Number(row?.total ?? 0) + 1).padStart(4, '0')}`
}

export async function bayarPsbBatch(input: {
  santriId: string
  tahunTagihan: number
  items: PsbPaymentInput[]
}) {
  const access = await assertFeature(PSB_PATH, 'create')
  if ('error' in access) return access
  if (!canBayar(access)) return { error: 'Akses ditolak' }
  await ensureSchema()

  const tahunTagihan = Number(input.tahunTagihan || new Date().getFullYear())
  const selected = input.items
    .filter((item) => ['BANGUNAN', 'KESEHATAN', 'EHB', 'EKSKUL'].includes(item.jenis))
    .map((item) => ({ jenis: item.jenis, nominal: Number(item.nominal ?? 0) }))
  if (!selected.length) return { error: 'Pilih minimal satu item pembayaran' }

  const santri = await queryOne<SantriPsbRow>(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.sekolah, s.kelas_sekolah,
           s.asrama, s.kamar, s.tahun_masuk, s.tanggal_masuk, s.created_at, s.kategori_santri,
           'BARU' AS kategori_efektif, pf.id AS psb_flow_id, pf.status,
           pf.verification_note, pf.verified_at, pf.placed_asrama_at, pf.placed_kamar_at, pf.paid_at, pf.done_at
    FROM santri s
    LEFT JOIN psb_flow pf ON pf.santri_id = s.id
    WHERE s.id = ? AND s.status_global = 'aktif'
  `, [input.santriId])
  if (!santri) return { error: 'Santri tidak ditemukan' }
  if (!statusAtLeast(normalizeStatus(santri.status), 'PLACED_KAMAR')) return { error: 'Santri belum ditempatkan ke kamar' }

  const tahunMasuk = yearFromSantri(santri)
  const tarifRows = await query<{ jenis_biaya: string; nominal: number }>(
    'SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?',
    [tahunMasuk]
  )
  const tarif = new Map(tarifRows.map((row) => [row.jenis_biaya, Number(row.nominal ?? 0)]))
  const existing = await query<{ jenis_biaya: string; nominal_bayar: number; tahun_tagihan: number | null }>(
    'SELECT jenis_biaya, nominal_bayar, tahun_tagihan FROM pembayaran_tahunan WHERE santri_id = ?',
    [input.santriId]
  )
  const totalBangunanPaid = existing
    .filter((row) => row.jenis_biaya === 'BANGUNAN')
    .reduce((sum, row) => sum + Number(row.nominal_bayar ?? 0), 0)
  const sisaBangunan = Math.max(0, (tarif.get('BANGUNAN') ?? 0) - totalBangunanPaid)

  const normalized: Array<{ jenis: string; nominal: number; tahunTagihan: number | null; keterangan: string }> = []
  for (const item of selected) {
    if (item.jenis === 'BANGUNAN') {
      const nominal = Math.trunc(item.nominal)
      if (nominal <= 0) return { error: 'Nominal bangunan wajib lebih dari 0' }
      if (nominal > sisaBangunan) return { error: 'Nominal bangunan melebihi sisa tagihan' }
      normalized.push({ jenis: 'BANGUNAN', nominal, tahunTagihan: null, keterangan: 'Pembayaran PSB - Bangunan' })
      continue
    }

    const nominal = tarif.get(item.jenis) ?? 0
    if (nominal <= 0) return { error: `Tarif ${item.jenis} angkatan ${tahunMasuk} belum diatur` }
    const sudahAda = existing.some((row) => row.jenis_biaya === item.jenis && Number(row.tahun_tagihan) === tahunTagihan)
    if (sudahAda) return { error: `${item.jenis} tahun ${tahunTagihan} sudah dibayar` }
    normalized.push({ jenis: item.jenis, nominal, tahunTagihan, keterangan: `Pembayaran PSB - ${item.jenis} ${tahunTagihan}` })
  }

  const receiptId = generateId()
  const receiptNo = await nextReceiptNo()
  const total = normalized.reduce((sum, item) => sum + item.nominal, 0)
  const completedPayments = [
    ...existing.map((row) => ({ jenis_biaya: row.jenis_biaya, tahun_tagihan: row.tahun_tagihan })),
    ...normalized.map((item) => ({ jenis_biaya: item.jenis, tahun_tagihan: item.tahunTagihan })),
  ]
  const statusAfterPayment: PsbStatus = hasCompletedPsbPayment({
    bangunanTarget: tarif.get('BANGUNAN') ?? 0,
    bangunanPaid: totalBangunanPaid + normalized.filter((item) => item.jenis === 'BANGUNAN').reduce((sum, item) => sum + item.nominal, 0),
    tahunTagihan,
    payments: completedPayments,
  }) ? 'DONE' : 'PAID'
  const db = await getDB()
  await db.batch([
    db.prepare(`
      INSERT INTO psb_payment_receipt (id, receipt_no, santri_id, tahun_tagihan, total, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(receiptId, receiptNo, input.santriId, tahunTagihan, total, access.id),
    ...normalized.map((item) =>
      db.prepare(`
        INSERT INTO pembayaran_tahunan (
          id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, tanggal_bayar, penerima_id, keterangan, psb_receipt_id
        ) VALUES (?, ?, ?, ?, ?, date('now'), ?, ?, ?)
      `).bind(generateId(), input.santriId, item.jenis, item.tahunTagihan, item.nominal, access.id, item.keterangan, receiptId)
    ),
    db.prepare(`
      INSERT INTO psb_flow (id, santri_id, status, paid_by, paid_at, done_by, done_at, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), ?, CASE WHEN ? = 'DONE' THEN datetime('now') ELSE NULL END, ?, datetime('now'), datetime('now'))
      ON CONFLICT(santri_id) DO UPDATE SET
        status = CASE
          WHEN ? = 'DONE' THEN 'DONE'
          WHEN psb_flow.status IN ('VERIFICATION','VERIFIED','PLACED_ASRAMA','PLACED_KAMAR','PAID') THEN 'PAID'
          ELSE psb_flow.status
        END,
        paid_by = excluded.paid_by,
        paid_at = excluded.paid_at,
        done_by = CASE WHEN ? = 'DONE' THEN excluded.done_by ELSE psb_flow.done_by END,
        done_at = CASE WHEN ? = 'DONE' THEN excluded.done_at ELSE psb_flow.done_at END,
        updated_at = excluded.updated_at
    `).bind(generateId(), input.santriId, statusAfterPayment, access.id, access.id, statusAfterPayment, access.id, statusAfterPayment, statusAfterPayment, statusAfterPayment),
  ])

  try {
    await logActivity({
      actor: actorFromSession(access),
      module: 'psb',
      action: 'payment',
      fiturHref: PSB_PATH,
      logKind: 'create',
      entityType: 'psb_payment_receipt',
      entityId: receiptId,
      entityLabel: receiptNo,
      summary: `Pembayaran PSB ${santri.nama_lengkap}: ${receiptNo}`,
      details: { santri_id: input.santriId, receipt_no: receiptNo, total, items: normalized, status_after_payment: statusAfterPayment },
    })
  } catch (error) {
    console.error('Failed to write PSB payment activity log', error)
  }
  try {
    revalidatePath(PSB_PATH)
    revalidatePath(MONITORING_PATH)
  } catch (error) {
    console.error('Failed to revalidate PSB pages after payment', error)
  }
  return { success: true, receiptId, receiptNo, total, status: statusAfterPayment }
}

export async function selesaikanPsb(santriId: string) {
  const access = await assertFeature(PSB_PATH, 'update')
  if ('error' in access) return access
  if (!isAdmin(access) && !hasRole(access, 'bendahara')) return { error: 'Akses ditolak' }
  const flow = await queryOne<{ status: string }>('SELECT status FROM psb_flow WHERE santri_id = ?', [santriId])
  if (!flow || !statusAtLeast(normalizeStatus(flow.status), 'PAID')) return { error: 'Santri belum menyelesaikan pembayaran PSB' }
  await execute(`
    UPDATE psb_flow
    SET status = 'DONE', done_by = ?, done_at = datetime('now'), updated_at = datetime('now')
    WHERE santri_id = ?
  `, [access.id, santriId])
  revalidatePath(PSB_PATH)
  revalidatePath(MONITORING_PATH)
  return { success: true }
}

export async function batalkanPembayaranPsb(input: { santriId: string; receiptId: string }) {
  const access = await assertFeature(PSB_PATH, 'update')
  if ('error' in access) return access
  if (!isAdmin(access) && !hasRole(access, 'bendahara')) return { error: 'Akses ditolak' }
  await ensureSchema()

  const receipt = await queryOne<{
    id: string
    santri_id: string
    receipt_no: string
    tahun_tagihan: number | null
    nama_lengkap: string
    tahun_masuk: number | null
    tanggal_masuk: string | null
    created_at: string | null
  }>(`
    SELECT r.id, r.santri_id, r.receipt_no, r.tahun_tagihan, s.nama_lengkap, s.tahun_masuk, s.tanggal_masuk, s.created_at
    FROM psb_payment_receipt r
    JOIN santri s ON s.id = r.santri_id
    WHERE r.id = ?
  `, [input.receiptId])
  if (!receipt) return { error: 'Kuitansi pembayaran tidak ditemukan' }
  if (receipt.santri_id !== input.santriId) return { error: 'Kuitansi tidak cocok dengan santri' }

  const latestReceipt = await queryOne<{ id: string }>(
    `SELECT id
     FROM psb_payment_receipt
     WHERE santri_id = ?
     ORDER BY datetime(created_at) DESC, created_at DESC
     LIMIT 1`,
    [input.santriId]
  )
  if (!latestReceipt || latestReceipt.id !== input.receiptId) {
    return { error: 'Hanya pembayaran terakhir yang bisa dibatalkan' }
  }

  await execute('DELETE FROM pembayaran_tahunan WHERE psb_receipt_id = ?', [input.receiptId])
  await execute('DELETE FROM psb_payment_receipt WHERE id = ?', [input.receiptId])

  const remainingPayments = await query<{ jenis_biaya: string; tahun_tagihan: number | null; nominal_bayar: number }>(
    'SELECT jenis_biaya, tahun_tagihan, nominal_bayar FROM pembayaran_tahunan WHERE santri_id = ?',
    [input.santriId]
  )
  const tahunMasuk = yearFromSantri(receipt)
  const tarifRows = await query<{ jenis_biaya: string; nominal: number }>(
    'SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?',
    [tahunMasuk]
  )
  const tarif = new Map(tarifRows.map((row) => [row.jenis_biaya, Number(row.nominal ?? 0)]))
  const nextStatus = deriveFlowStatusFromPayments({
    bangunanTarget: tarif.get('BANGUNAN') ?? 0,
    bangunanPaid: remainingPayments
      .filter((row) => row.jenis_biaya === 'BANGUNAN')
      .reduce((sum, row) => sum + Number(row.nominal_bayar ?? 0), 0),
    tahunTagihan: Number(receipt.tahun_tagihan ?? new Date().getFullYear()),
    payments: remainingPayments.map((row) => ({ jenis_biaya: row.jenis_biaya, tahun_tagihan: row.tahun_tagihan })),
  })

  await execute(`
    UPDATE psb_flow
    SET status = ?,
        paid_by = CASE WHEN ? = 'PLACED_KAMAR' THEN NULL ELSE paid_by END,
        paid_at = CASE WHEN ? = 'PLACED_KAMAR' THEN NULL ELSE paid_at END,
        done_by = CASE WHEN ? = 'DONE' THEN done_by ELSE NULL END,
        done_at = CASE WHEN ? = 'DONE' THEN done_at ELSE NULL END,
        updated_at = datetime('now')
    WHERE santri_id = ?
  `, [nextStatus, nextStatus, nextStatus, nextStatus, nextStatus, input.santriId])

  try {
    await logActivity({
      actor: actorFromSession(access),
      module: 'psb',
      action: 'payment_cancel',
      fiturHref: PSB_PATH,
      logKind: 'delete',
      entityType: 'psb_payment_receipt',
      entityId: input.receiptId,
      entityLabel: receipt.receipt_no,
      summary: `Pembayaran PSB dibatalkan ${receipt.nama_lengkap}: ${receipt.receipt_no}`,
      details: { santri_id: input.santriId, receipt_no: receipt.receipt_no, status_after_cancel: nextStatus },
    })
  } catch (error) {
    console.error('Failed to write PSB payment cancellation log', error)
  }

  try {
    revalidatePath(PSB_PATH)
    revalidatePath(MONITORING_PATH)
  } catch (error) {
    console.error('Failed to revalidate PSB pages after cancellation', error)
  }

  return { success: true, status: nextStatus }
}

export async function getPsbReceipt(receiptId: string) {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  if (!hasAnyRole(session, ['admin', 'bendahara', 'sekpen'])) return { error: 'Akses ditolak' }
  await ensureSchema()
  const receipt = await queryOne<any>(`
    SELECT r.*, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, u.full_name AS penerima_nama
    FROM psb_payment_receipt r
    JOIN santri s ON s.id = r.santri_id
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.id = ?
  `, [receiptId])
  if (!receipt) return { error: 'Kuitansi tidak ditemukan' }
  const items = await query<any>(`
    SELECT jenis_biaya, tahun_tagihan, nominal_bayar, keterangan, tanggal_bayar
    FROM pembayaran_tahunan
    WHERE psb_receipt_id = ?
    ORDER BY jenis_biaya
  `, [receiptId])
  return { receipt, items }
}
