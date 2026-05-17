'use server'

import { query, getDB } from '@/lib/db'
import { getSession, hasAnyRole, hasRole } from '@/lib/auth/session'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { parseWibDate } from '@/lib/date/wib'
import { revalidatePath } from 'next/cache'

export async function getSessionInfo() {
  const session = await getSession()
  if (!session) return null
  return { role: session.role, asrama_binaan: session.asrama_binaan ?? null }
}

async function ensureAbsenMalamSchema() {
  const db = await getDB()
  try {
    await db.prepare(`ALTER TABLE absen_malam_v2 ADD COLUMN keterangan TEXT`).run()
  } catch {
    // Kolom sudah ada pada database yang sudah termigrasi.
  }
}

// Hanya ambil daftar kamar — ringan, dipanggil saat halaman pertama dibuka
export async function getKamarsMalam(asrama: string) {
  if (isAsramaTanpaKamar(asrama)) return []
  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar
     FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [asrama]
  )
  return rows.map(r => r.kamar)
}

// Ambil santri + status absen + izin hanya untuk 1 kamar
export async function getDataAbsenMalamKamar(asrama: string, kamar: string, tanggal: string) {
  await ensureAbsenMalamSchema()

  const session = await getSession()
  if (!session) return []
  if (isAsramaTanpaKamar(asrama)) return []

  const santriList = await query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar, s.foto_url
    FROM santri s
    WHERE s.asrama = ? AND s.kamar = ? AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [asrama, kamar])

  if (!santriList.length) return []

  const ids = santriList.map((s: any) => s.id)
  const ph = ids.map(() => '?').join(',')

  let absenList: any[] = []
  let izinList: any[] = []

  try {
    absenList = await query<any>(
      `SELECT santri_id, status, keterangan FROM absen_malam_v2 WHERE tanggal = ? AND santri_id IN (${ph})`,
      [tanggal, ...ids]
    )
  } catch {}

  try {
    izinList = await query<any>(
      `SELECT p.id, p.santri_id, p.jenis, p.alasan, p.tgl_selesai_rencana FROM perizinan p
       WHERE p.status = 'AKTIF'
         AND p.tgl_kembali_aktual IS NULL
         AND p.tgl_mulai <= ?
         AND p.tgl_selesai_rencana >= ?
         AND p.santri_id IN (${ph})`,
      [tanggal, tanggal, ...ids]
    )
  } catch {}

  const absenMap: Record<string, string> = {}
  const keteranganMap: Record<string, string> = {}
  absenList.forEach((a: any) => {
    absenMap[a.santri_id] = a.status
    keteranganMap[a.santri_id] = a.keterangan || ''
  })
  const izinMap = new Map(izinList.map((i: any) => [i.santri_id, i]))

  return santriList.map((s: any) => ({
    ...s,
    status: izinMap.has(s.id) ? 'IZIN' : (absenMap[s.id] || 'HADIR'),
    keterangan: izinMap.has(s.id) ? '' : (keteranganMap[s.id] || ''),
    is_izin: izinMap.has(s.id),
    izin_id: izinMap.get(s.id)?.id ?? null,
    izin_jenis: izinMap.get(s.id)?.jenis ?? null,
    izin_alasan: izinMap.get(s.id)?.alasan ?? null,
    izin_batas: izinMap.get(s.id)?.tgl_selesai_rencana ?? null,
  }))
}

export async function tandaiSantriKembaliDariAbsenMalam(santriId: string, tanggal: string) {
  await ensureAbsenMalamSchema()

  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) return { error: 'Unauthorized' }

  const actual = parseWibDate(tanggal, 'start')
  if (Number.isNaN(actual.getTime())) return { error: 'Tanggal kembali tidak valid.' }

  const izin = await query<any>(`
    SELECT
      p.id,
      p.jenis,
      p.status,
      p.tgl_selesai_rencana,
      p.tgl_kembali_aktual,
      s.nama_lengkap,
      s.asrama
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE p.santri_id = ?
      AND p.status = 'AKTIF'
      AND p.tgl_kembali_aktual IS NULL
      AND p.tgl_mulai <= ?
      AND p.tgl_selesai_rencana >= ?
    ORDER BY p.tgl_selesai_rencana ASC
    LIMIT 1
  `, [santriId, tanggal, tanggal])

  const row = izin[0]
  if (!row) return { error: 'Izin aktif santri ini tidak ditemukan atau sudah ditandai kembali.' }
  if (row.jenis !== 'PULANG') return { error: 'Yang bisa ditandai kembali dari absen malam hanya izin pulang.' }

  if (hasRole(session, 'pengurus_asrama') && session.asrama_binaan && row.asrama !== session.asrama_binaan) {
    return { error: 'Pengurus asrama hanya bisa menandai santri asramanya.' }
  }

  const rencana = new Date(row.tgl_selesai_rencana)
  const isTelat = actual > rencana
  const statusFinal = isTelat ? 'AKTIF' : 'KEMBALI'

  const db = await getDB()
  await db.batch([
    db.prepare(`
      UPDATE perizinan
      SET status = ?, tgl_kembali_aktual = ?
      WHERE id = ?
    `).bind(statusFinal, actual.toISOString(), row.id),
    db.prepare(`
      DELETE FROM absen_malam_v2
      WHERE tanggal = ? AND santri_id = ?
    `).bind(tanggal, santriId),
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'asrama_absen_malam',
    action: 'update',
    fiturHref: '/dashboard/asrama/absen-malam',
    logKind: 'update',
    entityType: 'perizinan',
    entityId: row.id,
    entityLabel: row.nama_lengkap || santriId,
    summary: `Menandai santri kembali dari absen malam ${row.nama_lengkap || santriId}`,
    details: {
      tanggal_absen: tanggal,
      waktu_datang: actual.toISOString(),
      status_final: statusFinal,
      telat: isTelat,
    },
  })

  revalidatePath('/dashboard/asrama/absen-malam')
  revalidatePath('/dashboard/asrama/santri-kembali')
  revalidatePath('/dashboard/keamanan/perizinan')
  revalidatePath('/dashboard/keamanan/perizinan/verifikasi-telat')

  if (isTelat) {
    return { success: true, telat: true, message: 'Santri ditandai datang terlambat dan masuk verifikasi telat.' }
  }
  return { success: true, telat: false, message: 'Santri sudah ditandai kembali.' }
}

export async function batchSaveAbsenMalam(
  records: { santri_id: string; status: string; keterangan?: string }[],
  tanggal: string
) {
  await ensureAbsenMalamSchema()

  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) return { error: 'Unauthorized' }
  const santriIds = records.map((record) => record.santri_id)
  const santriScope = santriIds.length
    ? await query<{ asrama: string | null; kamar: string | null }>(
        `SELECT DISTINCT asrama, kamar
         FROM santri
         WHERE id IN (${santriIds.map(() => '?').join(',')})`,
        santriIds
      )
    : []

  const normalized = records.map(record => ({
    ...record,
    status: record.status === 'ALFA' ? 'ALFA' : 'HADIR',
    keterangan: (record.keterangan || '').trim(),
  }))
  const toSave = normalized.filter(r => r.status === 'ALFA' || r.keterangan)
  const toDelete = normalized.filter(r => r.status !== 'ALFA' && !r.keterangan).map(r => r.santri_id)

  const db = await getDB()
  const stmts: any[] = []

  for (let i = 0; i < toDelete.length; i += 100) {
    const chunk = toDelete.slice(i, i + 100)
    stmts.push(
      db.prepare(`DELETE FROM absen_malam_v2 WHERE tanggal = ? AND santri_id IN (${chunk.map(() => '?').join(',')})`).bind(tanggal, ...chunk)
    )
  }

  for (const r of toSave) {
    stmts.push(db.prepare(`
      INSERT INTO absen_malam_v2 (santri_id, tanggal, status, keterangan, created_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(santri_id, tanggal) DO UPDATE SET
        status = excluded.status,
        keterangan = excluded.keterangan,
        created_by = excluded.created_by
    `).bind(r.santri_id, tanggal, r.status, r.keterangan || null, session.id))
  }

  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100))
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'asrama_absen_malam',
    action: 'update',
    fiturHref: '/dashboard/asrama/absen-malam',
    logKind: 'update',
    entityType: 'absen_malam_batch',
    entityId: tanggal,
    entityLabel: tanggal,
    summary: `Menyimpan absen malam ${records.length} santri`,
    details: {
      tanggal,
      count: records.length,
      alfa_count: normalized.filter(record => record.status === 'ALFA').length,
      keterangan_count: normalized.filter(record => record.keterangan).length,
      scope: santriScope,
    },
  })

  revalidatePath('/dashboard/asrama/absen-malam')
  return { success: true, saved: toSave.length }
}
