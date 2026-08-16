// lib/finance/exemptions.ts
//
// Pembebasan biaya permanen granular per layanan (SPP/Makan/Laundry/USPP) —
// santri_pembebasan_biaya (DB utama, karena santri & seluruh alur SPP juga
// di DB utama). Bangunan/Kesehatan/EHB/Ekskul TIDAK di sini — mekanismenya
// (marker nominal_bayar=0 di pembayaran_tahunan) sudah granular per tahun
// ajaran, lihat catatBebasPembayaran/hapusBebasPembayaran di
// app/dashboard/master/santri-tools/actions.ts.
//
// SPP dual-write: santri.bebas_spp dipertahankan sebagai mirror sinkron
// (bukan trigger DB, tapi explicit di setExemption) supaya 20+ tempat yang
// sudah membaca kolom itu (asrama/spp, portal session, dsb) tidak perlu diubah.

import { batch, generateId, query, queryOne } from '@/lib/db'

export type PermanentExemptionKind = 'SPP' | 'MAKAN' | 'LAUNDRY' | 'USPP'

export type ExemptionMap = Record<PermanentExemptionKind, boolean>

const KINDS: PermanentExemptionKind[] = ['SPP', 'MAKAN', 'LAUNDRY', 'USPP']

export async function setExemption(input: {
  santriId: string
  serviceKind: PermanentExemptionKind
  isActive: boolean
  alasan?: string | null
  actorId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!KINDS.includes(input.serviceKind)) return { success: false, error: 'Jenis layanan tidak valid.' }
  const santri = await queryOne<{ id: string }>(`SELECT id FROM santri WHERE id = ?`, [input.santriId])
  if (!santri) return { success: false, error: 'Santri tidak ditemukan.' }

  const now = new Date().toISOString()
  const statements: { sql: string; params: unknown[] }[] = [
    {
      sql: `INSERT INTO santri_pembebasan_biaya (id, santri_id, service_kind, is_active, alasan, created_by, updated_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(santri_id, service_kind) DO UPDATE SET
              is_active = excluded.is_active,
              alasan = excluded.alasan,
              updated_by = excluded.updated_by,
              updated_at = excluded.updated_at`,
      params: [generateId(), input.santriId, input.serviceKind, input.isActive ? 1 : 0, input.alasan?.trim() || null, input.actorId, input.actorId, now],
    },
  ]

  if (input.serviceKind === 'SPP') {
    statements.push({
      sql: `UPDATE santri SET bebas_spp = ?, updated_at = ? WHERE id = ?`,
      params: [input.isActive ? 1 : 0, now, input.santriId],
    })
  }

  await batch(statements)
  return { success: true }
}

export async function getExemptionsForSantri(santriId: string): Promise<ExemptionMap> {
  const rows = await query<{ service_kind: PermanentExemptionKind; is_active: number }>(
    `SELECT service_kind, is_active FROM santri_pembebasan_biaya WHERE santri_id = ?`,
    [santriId]
  )
  const map: ExemptionMap = { SPP: false, MAKAN: false, LAUNDRY: false, USPP: false }
  for (const row of rows) {
    if (KINDS.includes(row.service_kind)) map[row.service_kind] = Number(row.is_active) === 1
  }
  return map
}

export type ExemptedSantriRow = {
  santri_id: string
  service_kind: PermanentExemptionKind
  alasan: string | null
  nama_lengkap: string
  nis: string | null
  asrama: string | null
}

export async function listExempted(): Promise<ExemptedSantriRow[]> {
  return query<ExemptedSantriRow>(
    `SELECT p.santri_id, p.service_kind, p.alasan, s.nama_lengkap, s.nis, s.asrama
     FROM santri_pembebasan_biaya p
     JOIN santri s ON s.id = p.santri_id
     WHERE p.is_active = 1
     ORDER BY s.nama_lengkap, p.service_kind`
  )
}
