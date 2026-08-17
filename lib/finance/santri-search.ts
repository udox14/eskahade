'use server'

import { query } from '@/lib/db'
import { requireFinanceAccess } from '@/lib/finance/access'

export type SantriSearchRow = { id: string; nama_lengkap: string; nis: string; asrama: string | null; kamar: string | null }

/**
 * Pencari santri untuk seluruh halaman keuangan terpusat. Sebelumnya hidup
 * sebagai server action lokal di `tarif-layanan/actions.ts`, sehingga halaman
 * lain yang butuh memilih santri terpaksa menyuruh pengguna mengetik NIS.
 */
export async function searchSantriByName(keyword: string): Promise<SantriSearchRow[]> {
  await requireFinanceAccess('VIEW')
  const trimmed = keyword.trim()
  if (trimmed.length < 2) return []
  const like = `%${trimmed}%`
  return query<SantriSearchRow>(
    `SELECT id, nama_lengkap, nis, asrama, kamar FROM santri
     WHERE status_global='aktif' AND (nama_lengkap LIKE ? OR nis LIKE ?)
     ORDER BY nama_lengkap LIMIT 10`,
    [like, like]
  )
}

/** Cari satu santri aktif berdasarkan NIS persis; dipakai jalur impor massal. */
export async function findSantriByNis(nis: string): Promise<SantriSearchRow | null> {
  await requireFinanceAccess('VIEW')
  const trimmed = nis.trim()
  if (!trimmed) return null
  const rows = await query<SantriSearchRow>(
    `SELECT id, nama_lengkap, nis, asrama, kamar FROM santri
     WHERE status_global='aktif' AND nis=? LIMIT 1`,
    [trimmed]
  )
  return rows[0] ?? null
}
