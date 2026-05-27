'use server'

import { execute, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

export type ActiveEvent = {
  id: number
  nama: string
}

export type SesiOption = {
  id: number
  nomor_sesi: number
  label: string
  jam_group: string
  waktu_mulai: string | null
  waktu_selesai: string | null
}

export type TanggalOption = {
  tanggal: string
}

export type AbsensiStatus = 'HADIR' | 'TIDAK_HADIR' | 'BADAL'
export type BadalSource = 'pengawas' | 'panitia' | 'sadesa'

export type AbsensiPengawasRow = {
  jadwal_pengawas_id: number
  pengawas_id: number
  guru_id: number | null
  nama_pengawas: string
  tag: string
  ruangan_id: number
  nomor_ruangan: number
  nama_ruangan: string | null
  jenis_kelamin: string
  status: AbsensiStatus | null
  badal_source: BadalSource | null
  badal_pengawas_id: number | null
  badal_panitia_id: number | null
  badal_nama: string | null
}

export type BadalPengawasOption = {
  id: number
  guru_id: number | null
  nama: string
}

export type BadalPanitiaOption = {
  id: number
  guru_id: number | null
  nama: string
  label: string
}

export type BadalSadesaOption = {
  id: string
  nama: string
  nis: string | null
  asrama: string | null
  kamar: string | null
}

export type BadalOptions = {
  pengawas: BadalPengawasOption[]
  panitia: BadalPanitiaOption[]
  sadesa: BadalSadesaOption[]
}

export type AbsensiPengawasInput = {
  jadwal_pengawas_id: number
  status: AbsensiStatus
  badal_source?: BadalSource | null
  badal_pengawas_id?: number | null
  badal_panitia_id?: number | null
  badal_nama?: string | null
}

export async function ensureAbsensiPengawasSchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_absensi_pengawas (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id        INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      jadwal_pengawas_id  INTEGER NOT NULL REFERENCES ehb_jadwal_pengawas(id) ON DELETE CASCADE,
      status              TEXT NOT NULL DEFAULT 'TIDAK_HADIR',
      badal_source        TEXT,
      badal_pengawas_id   INTEGER REFERENCES ehb_pengawas(id),
      badal_panitia_id    INTEGER REFERENCES ehb_panitia(id),
      badal_nama          TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT,
      UNIQUE(ehb_event_id, jadwal_pengawas_id)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_ehb_absensi_pengawas_event
    ON ehb_absensi_pengawas(ehb_event_id, status)
  `)
  await execute(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES ('EHB', 'Absensi Pengawas', '/dashboard/ehb/absensi-pengawas', 'ClipboardCheck', '["admin"]', 1, 13)
  `)
}

export async function getActiveEventForAbsensiPengawas() {
  await ensureAbsensiPengawasSchema()
  return queryOne<ActiveEvent>(`SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1`)
}

export async function getTanggalPengawasList(eventId: number) {
  await ensureAbsensiPengawasSchema()
  return query<TanggalOption>(`
    SELECT DISTINCT tanggal
    FROM ehb_jadwal_pengawas
    WHERE ehb_event_id = ?
    ORDER BY tanggal
  `, [eventId])
}

export async function getSesiPengawasList(eventId: number, tanggal: string) {
  await ensureAbsensiPengawasSchema()
  return query<SesiOption>(`
    SELECT DISTINCT s.id, s.nomor_sesi, s.label, s.jam_group, s.waktu_mulai, s.waktu_selesai
    FROM ehb_jadwal_pengawas jp
    JOIN ehb_sesi s ON s.id = jp.sesi_id
    WHERE jp.ehb_event_id = ? AND jp.tanggal = ?
    ORDER BY s.nomor_sesi
  `, [eventId, tanggal])
}

export async function getAbsensiPengawasRows(eventId: number, tanggal: string, sesiId: number) {
  await ensureAbsensiPengawasSchema()
  return query<AbsensiPengawasRow>(`
    SELECT
      jp.id as jadwal_pengawas_id,
      p.id as pengawas_id,
      p.guru_id,
      p.nama_pengawas,
      p.tag,
      r.id as ruangan_id,
      r.nomor_ruangan,
      r.nama_ruangan,
      r.jenis_kelamin,
      COALESCE(ap.status, 'TIDAK_HADIR') as status,
      ap.badal_source,
      ap.badal_pengawas_id,
      ap.badal_panitia_id,
      ap.badal_nama
    FROM ehb_jadwal_pengawas jp
    JOIN ehb_pengawas p ON p.id = jp.pengawas_id
    JOIN ehb_ruangan r ON r.id = jp.ruangan_id
    LEFT JOIN ehb_absensi_pengawas ap
      ON ap.jadwal_pengawas_id = jp.id AND ap.ehb_event_id = jp.ehb_event_id
    WHERE jp.ehb_event_id = ? AND jp.tanggal = ? AND jp.sesi_id = ?
    ORDER BY r.nomor_ruangan, p.nama_pengawas
  `, [eventId, tanggal, sesiId])
}

export async function getBadalOptions(eventId: number): Promise<BadalOptions> {
  await ensureAbsensiPengawasSchema()
  const [pengawas, panitia, sadesa] = await Promise.all([
    query<BadalPengawasOption>(`
      SELECT id, guru_id, nama_pengawas as nama
      FROM ehb_pengawas
      WHERE ehb_event_id = ?
      ORDER BY nama_pengawas
    `, [eventId]),
    query<BadalPanitiaOption>(`
      SELECT
        id,
        guru_id,
        nama,
        CASE
          WHEN tipe = 'inti' THEN COALESCE(jabatan_key, 'Panitia Inti')
          WHEN seksi_key IS NOT NULL THEN seksi_key
          ELSE 'Panitia'
        END as label
      FROM ehb_panitia
      WHERE ehb_event_id = ?
      ORDER BY tipe, urutan, nama
    `, [eventId]),
    query<BadalSadesaOption>(`
      SELECT id, nama_lengkap as nama, nis, asrama, kamar
      FROM santri
      WHERE status_global = 'aktif'
        AND kategori_santri = 'SADESA'
      ORDER BY nama_lengkap
    `),
  ])
  return { pengawas, panitia, sadesa }
}

export async function saveAbsensiPengawasInput(eventId: number, input: AbsensiPengawasInput) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureAbsensiPengawasSchema()

  const cleanInput = {
    jadwal_pengawas_id: Number(input.jadwal_pengawas_id),
    status: input.status,
    badal_source: input.status === 'BADAL' ? input.badal_source ?? null : null,
    badal_pengawas_id: input.status === 'BADAL' && input.badal_source === 'pengawas' ? input.badal_pengawas_id ?? null : null,
    badal_panitia_id: input.status === 'BADAL' && input.badal_source === 'panitia' ? input.badal_panitia_id ?? null : null,
    badal_nama: input.status === 'BADAL' ? input.badal_nama?.trim().replace(/\s+/g, ' ') || null : null,
  }

  if (!cleanInput.jadwal_pengawas_id || !['HADIR', 'TIDAK_HADIR', 'BADAL'].includes(cleanInput.status)) {
    return { error: 'Data absensi pengawas tidak valid' }
  }

  if (
    cleanInput.status === 'BADAL'
    && !cleanInput.badal_pengawas_id
    && !cleanInput.badal_panitia_id
    && !cleanInput.badal_nama
  ) {
    return { error: 'Status BADAL wajib memilih atau mengisi nama badal' }
  }

  await execute(`
    INSERT INTO ehb_absensi_pengawas
      (ehb_event_id, jadwal_pengawas_id, status, badal_source, badal_pengawas_id, badal_panitia_id, badal_nama)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ehb_event_id, jadwal_pengawas_id) DO UPDATE SET
      status = excluded.status,
      badal_source = excluded.badal_source,
      badal_pengawas_id = excluded.badal_pengawas_id,
      badal_panitia_id = excluded.badal_panitia_id,
      badal_nama = excluded.badal_nama,
      updated_at = datetime('now')
  `, [
    eventId,
    cleanInput.jadwal_pengawas_id,
    cleanInput.status,
    cleanInput.badal_source,
    cleanInput.badal_pengawas_id,
    cleanInput.badal_panitia_id,
    cleanInput.badal_nama,
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'ehb_absensi_pengawas',
    action: 'update',
    fiturHref: '/dashboard/ehb/absensi-pengawas',
    logKind: 'update',
    entityType: 'ehb_absensi_pengawas',
    entityId: `${eventId}:${cleanInput.jadwal_pengawas_id}`,
    entityLabel: 'Absensi pengawas EHB',
    summary: `Menyimpan absensi pengawas: ${cleanInput.status}`,
    details: { event_id: eventId, ...cleanInput },
  })

  revalidatePath('/dashboard/ehb/absensi-pengawas')
  revalidatePath('/dashboard/ehb/keuangan')
  return { success: true, saved: 1 }
}
