'use server'

import { batch, execute, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export type ActiveEvent = {
  id: number
  nama: string
  semester: number
  tahun_ajaran_nama: string
}

export type GuruOption = {
  id: number
  nama: string
}

export type EventOption = {
  id: number
  nama: string
  semester: number
  tahun_ajaran_nama: string
  tanggal_mulai: string | null
  tanggal_selesai: string | null
}

export type PanitiaRow = {
  id: number
  ehb_event_id: number
  tipe: 'inti' | 'seksi'
  jabatan_key: string | null
  seksi_key: string | null
  peran: 'ketua' | 'anggota' | null
  guru_id: number | null
  nama: string
  urutan: number
}

export type PanitiaInput = {
  tipe: 'inti' | 'seksi'
  jabatan_key?: string
  seksi_key?: string
  peran?: 'ketua' | 'anggota' | null
  guru_id?: number | null
  nama: string
}

export type PanitiaBatchItem = PanitiaInput & {
  id?: number
}

export async function ensureKepanitiaanSchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_panitia (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      tipe           TEXT NOT NULL,
      jabatan_key    TEXT,
      seksi_key      TEXT,
      peran          TEXT,
      guru_id        INTEGER REFERENCES data_guru(id),
      nama           TEXT NOT NULL,
      urutan         INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT
    )
  `)
  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ehb_panitia_inti_unique
    ON ehb_panitia(ehb_event_id, jabatan_key)
    WHERE tipe = 'inti'
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_ehb_panitia_event
    ON ehb_panitia(ehb_event_id, tipe, seksi_key, urutan)
  `)
  await execute(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES ('EHB', 'Kepanitiaan', '/dashboard/ehb/kepanitiaan', 'UserCog', '["admin"]', 1, 11)
  `)
}

export async function getActiveEventForKepanitiaan() {
  await ensureKepanitiaanSchema()
  return queryOne<ActiveEvent>(`
    SELECT e.id, e.nama, e.semester, ta.nama as tahun_ajaran_nama
    FROM ehb_event e
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.is_active = 1
    LIMIT 1
  `)
}

export async function getGuruOptionsForKepanitiaan() {
  return query<GuruOption>(`
    SELECT id, nama_lengkap as nama
    FROM data_guru
    ORDER BY nama_lengkap
  `)
}

export async function getEventOptionsForCopy(currentEventId: number) {
  await ensureKepanitiaanSchema()
  return query<EventOption>(`
    SELECT e.id, e.nama, e.semester, e.tanggal_mulai, e.tanggal_selesai, ta.nama as tahun_ajaran_nama
    FROM ehb_event e
    JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.id <> ?
    ORDER BY e.id DESC
  `, [currentEventId])
}

export async function getPanitiaList(eventId: number) {
  await ensureKepanitiaanSchema()
  return query<PanitiaRow>(`
    SELECT id, ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan
    FROM ehb_panitia
    WHERE ehb_event_id = ?
    ORDER BY
      CASE tipe WHEN 'inti' THEN 0 ELSE 1 END,
      urutan,
      nama
  `, [eventId])
}

async function nextSeksiUrutan(eventId: number, seksiKey: string) {
  const row = await queryOne<{ max_urutan: number | null }>(`
    SELECT MAX(urutan) as max_urutan
    FROM ehb_panitia
    WHERE ehb_event_id = ? AND tipe = 'seksi' AND seksi_key = ?
  `, [eventId, seksiKey])
  return (row?.max_urutan ?? 0) + 1
}

export async function savePanitia(eventId: number, input: PanitiaInput, id?: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureKepanitiaanSchema()

  const nama = input.nama.trim()
  if (!nama) return { error: 'Nama panitia wajib diisi' }

  if (input.tipe === 'inti') {
    if (!input.jabatan_key) return { error: 'Jabatan inti wajib dipilih' }
    const urutan = INTI_ORDER[input.jabatan_key] ?? 99
    const existing = await queryOne<{ id: number }>(`
      SELECT id FROM ehb_panitia
      WHERE ehb_event_id = ? AND tipe = 'inti' AND jabatan_key = ?
      LIMIT 1
    `, [eventId, input.jabatan_key])
    if (id) {
      await execute(`
        UPDATE ehb_panitia
        SET guru_id = ?, nama = ?, updated_at = datetime('now')
        WHERE id = ? AND ehb_event_id = ?
      `, [input.guru_id ?? null, nama, id, eventId])
    } else if (existing) {
      await execute(`
        UPDATE ehb_panitia
        SET guru_id = ?, nama = ?, urutan = ?, updated_at = datetime('now')
        WHERE id = ? AND ehb_event_id = ?
      `, [input.guru_id ?? null, nama, urutan, existing.id, eventId])
    } else {
      await execute(`
        INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
        VALUES (?, 'inti', ?, NULL, NULL, ?, ?, ?)
      `, [eventId, input.jabatan_key, input.guru_id ?? null, nama, urutan])
    }
  } else {
    if (!input.seksi_key) return { error: 'Seksi wajib dipilih' }
    const peran = input.peran ?? 'anggota'
    const urutan = id ? undefined : await nextSeksiUrutan(eventId, input.seksi_key)
    if (id) {
      await execute(`
        UPDATE ehb_panitia
        SET peran = ?, guru_id = ?, nama = ?, updated_at = datetime('now')
        WHERE id = ? AND ehb_event_id = ?
      `, [peran, input.guru_id ?? null, nama, id, eventId])
    } else {
      await execute(`
        INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
        VALUES (?, 'seksi', NULL, ?, ?, ?, ?, ?)
      `, [eventId, input.seksi_key, peran, input.guru_id ?? null, nama, urutan ?? 1])
    }
  }

  revalidatePath('/dashboard/ehb/kepanitiaan')
  revalidatePath('/dashboard/ehb/cetak')
  return { success: true }
}

export async function importPanitiaBatch(eventId: number, inputs: PanitiaInput[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureKepanitiaanSchema()

  const cleanInputs = inputs
    .map(input => ({ ...input, nama: input.nama.trim() }))
    .filter(input => input.nama)

  if (cleanInputs.length === 0) return { error: 'Tidak ada data valid untuk diimpor' }

  let imported = 0

  for (const input of cleanInputs) {
    if (input.tipe === 'inti') {
      if (!input.jabatan_key) continue
      const urutan = INTI_ORDER[input.jabatan_key] ?? 99
      const existing = await queryOne<{ id: number }>(`
        SELECT id FROM ehb_panitia
        WHERE ehb_event_id = ? AND tipe = 'inti' AND jabatan_key = ?
        LIMIT 1
      `, [eventId, input.jabatan_key])

      if (existing) {
        await execute(`
          UPDATE ehb_panitia
          SET guru_id = ?, nama = ?, urutan = ?, updated_at = datetime('now')
          WHERE id = ? AND ehb_event_id = ?
        `, [input.guru_id ?? null, input.nama, urutan, existing.id, eventId])
      } else {
        await execute(`
          INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
          VALUES (?, 'inti', ?, NULL, NULL, ?, ?, ?)
        `, [eventId, input.jabatan_key, input.guru_id ?? null, input.nama, urutan])
      }
      imported++
    } else {
      if (!input.seksi_key) continue
      const urutan = await nextSeksiUrutan(eventId, input.seksi_key)
      await execute(`
        INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
        VALUES (?, 'seksi', NULL, ?, ?, ?, ?, ?)
      `, [eventId, input.seksi_key, input.peran ?? 'anggota', input.guru_id ?? null, input.nama, urutan])
      imported++
    }
  }

  revalidatePath('/dashboard/ehb/kepanitiaan')
  revalidatePath('/dashboard/ehb/cetak')
  return { success: true, imported }
}

export async function replacePanitiaBatch(eventId: number, inputs: PanitiaBatchItem[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureKepanitiaanSchema()

  const cleanInputs = inputs
    .map(input => ({ ...input, nama: input.nama.trim() }))
    .filter(input => input.nama)

  await execute(`DELETE FROM ehb_panitia WHERE ehb_event_id = ?`, [eventId])

  if (cleanInputs.length > 0) {
    await batch(cleanInputs.map((input, index) => {
      if (input.tipe === 'inti') {
        return {
          sql: `
            INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
            VALUES (?, 'inti', ?, NULL, NULL, ?, ?, ?)
          `,
          params: [
            eventId,
            input.jabatan_key ?? null,
            input.guru_id ?? null,
            input.nama,
            input.jabatan_key ? INTI_ORDER[input.jabatan_key] ?? index + 1 : index + 1,
          ],
        }
      }

      return {
        sql: `
          INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
          VALUES (?, 'seksi', NULL, ?, ?, ?, ?, ?)
        `,
        params: [
          eventId,
          input.seksi_key ?? null,
          input.peran ?? 'anggota',
          input.guru_id ?? null,
          input.nama,
          index + 1,
        ],
      }
    }))
  }

  revalidatePath('/dashboard/ehb/kepanitiaan')
  revalidatePath('/dashboard/ehb/cetak')
  return { success: true, saved: cleanInputs.length }
}

export async function copyPanitiaFromEvent(targetEventId: number, sourceEventId: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await ensureKepanitiaanSchema()
  if (targetEventId === sourceEventId) return { error: 'Event sumber tidak boleh sama dengan event aktif' }

  const sourceRows = await query<PanitiaRow>(`
    SELECT id, ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan
    FROM ehb_panitia
    WHERE ehb_event_id = ?
    ORDER BY CASE tipe WHEN 'inti' THEN 0 ELSE 1 END, urutan, nama
  `, [sourceEventId])

  if (sourceRows.length === 0) return { error: 'Event sumber belum memiliki data panitia' }

  await execute(`DELETE FROM ehb_panitia WHERE ehb_event_id = ?`, [targetEventId])
  await batch(sourceRows.map(row => ({
    sql: `
      INSERT INTO ehb_panitia (ehb_event_id, tipe, jabatan_key, seksi_key, peran, guru_id, nama, urutan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [targetEventId, row.tipe, row.jabatan_key, row.seksi_key, row.peran, row.guru_id, row.nama, row.urutan],
  })))

  revalidatePath('/dashboard/ehb/kepanitiaan')
  revalidatePath('/dashboard/ehb/cetak')
  return { success: true, copied: sourceRows.length }
}

export async function deletePanitia(id: number, eventId: number) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await execute(`DELETE FROM ehb_panitia WHERE id = ? AND ehb_event_id = ?`, [id, eventId])
  revalidatePath('/dashboard/ehb/kepanitiaan')
  revalidatePath('/dashboard/ehb/cetak')
  return { success: true }
}

export async function reorderPanitia(eventId: number, ids: number[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (ids.length === 0) return { success: true }
  await batch(ids.map((id, index) => ({
    sql: `UPDATE ehb_panitia SET urutan = ?, updated_at = datetime('now') WHERE id = ? AND ehb_event_id = ?`,
    params: [index + 1, id, eventId],
  })))
  revalidatePath('/dashboard/ehb/kepanitiaan')
  return { success: true }
}

const INTI_ORDER: Record<string, number> = {
  ketua: 1,
  wakil_ketua: 2,
  sekretaris: 3,
  wakil_sekretaris: 4,
  bendahara: 5,
  wakil_bendahara: 6,
}
