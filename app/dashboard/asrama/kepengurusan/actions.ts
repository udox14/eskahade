'use server'

import { revalidatePath } from 'next/cache'
import { batch, execute, getDB, query, queryOne } from '@/lib/db'
import { assertFeature } from '@/lib/auth/feature'
import { hasRole, isAdmin, type SessionUser } from '@/lib/auth/session'
import { getCachedDataGuru } from '@/lib/cache/master'

const KEPENGURUSAN_PATH = '/dashboard/asrama/kepengurusan'
const KAMAR_PATH = '/dashboard/asrama/kamar'

type PengurusInput = {
  guru_id?: number | null
  nama: string
  source?: 'guru' | 'sadesa'
}

type PembinaKamarInput = PengurusInput & {
  kamar: string
}

async function ensureKamarSchema() {
  const db = await getDB()

  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_config (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama        TEXT NOT NULL,
        nomor_kamar   TEXT NOT NULL,
        kuota         INTEGER NOT NULL DEFAULT 10,
        reserved_baru INTEGER NOT NULL DEFAULT 0,
        blok          TEXT,
        created_at    TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, nomor_kamar)
      )
    `),
  ])
}

async function ensureKepengurusanSchema() {
  await ensureKamarSchema()
  await execute(`
    CREATE TABLE IF NOT EXISTS asrama_kepengurusan (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      asrama      TEXT NOT NULL,
      jabatan_key TEXT NOT NULL,
      kamar       TEXT,
      guru_id     INTEGER REFERENCES data_guru(id),
      nama        TEXT NOT NULL,
      urutan      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT
    )
  `)
  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_asrama_pengurus_inti_unique
    ON asrama_kepengurusan(asrama, jabatan_key)
    WHERE kamar IS NULL AND jabatan_key IN ('pembina_asrama', 'rois', 'wakil_rois')
  `)
  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_asrama_pengurus_pembina_kamar_unique
    ON asrama_kepengurusan(asrama, kamar)
    WHERE jabatan_key = 'pembina_kamar'
  `)
}

async function getAccess(asrama?: string | null) {
  await ensureKepengurusanSchema()
  const access = await assertFeature(KEPENGURUSAN_PATH)
  if ('error' in access) return access

  const session = access as SessionUser
  const requestedAsrama = String(asrama ?? '').trim()

  if (!isAdmin(session)) {
    if (!hasRole(session, 'pengurus_asrama')) return { error: 'Unauthorized' }
    if (!session.asrama_binaan) return { error: 'Asrama binaan akun belum diset' }
    if (requestedAsrama && requestedAsrama !== session.asrama_binaan) {
      return { error: 'Anda hanya boleh mengelola asrama binaan Anda' }
    }
  }

  return { session, requestedAsrama }
}

async function getAllowedAsrama(session: SessionUser) {
  if (!isAdmin(session)) {
    return session.asrama_binaan ? [session.asrama_binaan] : []
  }

  const rows = await query<{ asrama: string }>(`
    SELECT DISTINCT asrama
    FROM santri
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL
      AND TRIM(asrama) <> ''
    ORDER BY asrama
  `)
  return rows.map((row) => row.asrama)
}

function sortRoomNames(items: string[]) {
  return [...items].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

function resolveNama(input: PengurusInput, guruMap: Map<number, string>) {
  const guruId = input.guru_id ? Number(input.guru_id) : null
  if (guruId && guruMap.has(guruId)) {
    return { guru_id: guruId, nama: guruMap.get(guruId)! }
  }

  const nama = String(input.nama ?? '').trim()
  return { guru_id: null, nama }
}

export async function getKepengurusanAsramaData(asrama?: string | null) {
  const access = await getAccess(asrama)
  if ('error' in access) {
    return {
      error: access.error,
      asramaOptions: [] as string[],
      currentAsrama: '',
      guruOptions: [] as Array<{ id: number; nama: string }>,
      sadesaOptions: [] as Array<{ id: string; nama: string; asrama: string | null; kamar: string | null }>,
      roomOptions: [] as string[],
      inti: {
        pembina_asrama: null as any,
        rois: null as any,
        wakil_rois: null as any,
      },
      sekretaris: [] as any[],
      bendahara: [] as any[],
      pembinaKamar: [] as any[],
    }
  }

  const asramaOptions = await getAllowedAsrama(access.session)
  const currentAsrama = access.requestedAsrama || asramaOptions[0] || ''
  const guruRows = await getCachedDataGuru()
  const guruOptions = guruRows.map((guru: any) => ({ id: Number(guru.id), nama: String(guru.nama_lengkap) }))
  const sadesaRows = currentAsrama ? await query<{
    id: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
  }>(`
    SELECT id, nama_lengkap, asrama, kamar
    FROM santri
    WHERE status_global = 'aktif'
      AND kategori_santri = 'SADESA'
      AND asrama = ?
    ORDER BY nama_lengkap
  `, [currentAsrama]) : []
  const sadesaOptions = sadesaRows.map((row) => ({
    id: row.id,
    nama: row.nama_lengkap,
    asrama: row.asrama,
    kamar: row.kamar,
  }))

  if (!currentAsrama) {
    return {
      asramaOptions,
      currentAsrama: '',
      guruOptions,
      sadesaOptions,
      roomOptions: [],
      inti: { pembina_asrama: null, rois: null, wakil_rois: null },
      sekretaris: [],
      bendahara: [],
      pembinaKamar: [],
    }
  }

  const [rows, roomRows] = await Promise.all([
    query<{
      id: number
      jabatan_key: string
      kamar: string | null
      guru_id: number | null
      nama: string
      urutan: number
    }>(
      `SELECT id, jabatan_key, kamar, guru_id, nama, urutan
       FROM asrama_kepengurusan
       WHERE asrama = ?
       ORDER BY jabatan_key, urutan, nama`,
      [currentAsrama]
    ),
    query<{ nomor_kamar: string }>(
      `SELECT nomor_kamar
       FROM (
         SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
         UNION
         SELECT TRIM(kamar) AS nomor_kamar
         FROM santri
         WHERE status_global = 'aktif'
           AND asrama = ?
           AND kamar IS NOT NULL
           AND TRIM(kamar) <> ''
       )
       ORDER BY CAST(nomor_kamar AS INTEGER), nomor_kamar`,
      [currentAsrama, currentAsrama]
    ),
  ])

  const intiMap = new Map(rows.filter((row) => ['pembina_asrama', 'rois', 'wakil_rois'].includes(row.jabatan_key)).map((row) => [row.jabatan_key, row]))
  const sekretaris = rows.filter((row) => row.jabatan_key === 'sekretaris')
  const bendahara = rows.filter((row) => row.jabatan_key === 'bendahara')
  const pembinaKamarMap = new Map(rows.filter((row) => row.jabatan_key === 'pembina_kamar' && row.kamar).map((row) => [row.kamar as string, row]))
  const roomOptions = sortRoomNames(roomRows.map((row) => row.nomor_kamar))

  return {
    asramaOptions,
    currentAsrama,
    guruOptions,
    sadesaOptions,
    roomOptions,
    inti: {
      pembina_asrama: intiMap.get('pembina_asrama') ?? null,
      rois: intiMap.get('rois') ?? null,
      wakil_rois: intiMap.get('wakil_rois') ?? null,
    },
    sekretaris,
    bendahara,
    pembinaKamar: roomOptions.map((kamar) => pembinaKamarMap.get(kamar) ?? null),
  }
}

export async function saveKepengurusanAsrama(params: {
  asrama: string
  inti: {
    pembina_asrama?: PengurusInput | null
    rois?: PengurusInput | null
    wakil_rois?: PengurusInput | null
  }
  sekretaris: PengurusInput[]
  bendahara: PengurusInput[]
  pembinaKamar: PembinaKamarInput[]
}) {
  const access = await getAccess(params.asrama)
  if ('error' in access) return access

  const asrama = access.requestedAsrama
  if (!asrama) return { error: 'Asrama wajib dipilih' }

  const guruRows = await getCachedDataGuru()
  const guruMap = new Map<number, string>(guruRows.map((guru: any) => [Number(guru.id), String(guru.nama_lengkap)]))
  const roomOptionsRows = await query<{ nomor_kamar: string }>(
    `SELECT nomor_kamar
     FROM (
       SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
       UNION
       SELECT TRIM(kamar) AS nomor_kamar
       FROM santri
       WHERE status_global = 'aktif'
         AND asrama = ?
         AND kamar IS NOT NULL
         AND TRIM(kamar) <> ''
     )`,
    [asrama, asrama]
  )
  const roomSet = new Set(roomOptionsRows.map((row) => row.nomor_kamar))

  const statements: { sql: string; params?: unknown[] }[] = [
    { sql: 'DELETE FROM asrama_kepengurusan WHERE asrama = ?', params: [asrama] },
  ]

  const pushEntry = (jabatanKey: string, input: PengurusInput | null | undefined, urutan: number, kamar?: string | null) => {
    if (!input) return
    const clean = resolveNama(input, guruMap)
    if (!clean.nama) return
    statements.push({
      sql: `
        INSERT INTO asrama_kepengurusan (asrama, jabatan_key, kamar, guru_id, nama, urutan, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      params: [asrama, jabatanKey, kamar ?? null, clean.guru_id, clean.nama, urutan],
    })
  }

  pushEntry('pembina_asrama', params.inti.pembina_asrama, 1)
  pushEntry('rois', params.inti.rois, 2)
  pushEntry('wakil_rois', params.inti.wakil_rois, 3)

  params.sekretaris.forEach((item, index) => pushEntry('sekretaris', item, index + 1))
  params.bendahara.forEach((item, index) => pushEntry('bendahara', item, index + 1))
  params.pembinaKamar.forEach((item, index) => {
    const kamar = String(item.kamar ?? '').trim()
    if (!kamar || !roomSet.has(kamar)) return
    pushEntry('pembina_kamar', item, index + 1, kamar)
  })

  await batch(statements)
  revalidatePath(KEPENGURUSAN_PATH)
  revalidatePath(KAMAR_PATH)
  return { success: true }
}
