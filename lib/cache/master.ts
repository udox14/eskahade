// lib/cache/master.ts
// Cache terpusat untuk data master yang jarang berubah.
// Menggunakan unstable_cache (Next.js 15) yang disimpan di KV via OpenNext Cloudflare.
//
// TTL: 24 jam untuk data yang hampir tidak berubah (marhalah, mapel, biaya_settings)
//       1 jam untuk data yang berubah per tahun ajaran (tahun_ajaran, data_guru, master_pelanggaran)
//
// Invalidasi: panggil revalidateTag(TAG) di action yang menulis ke tabel tersebut.

import { unstable_cache } from 'next/cache'
import { query, queryOne } from '@/lib/db'

// ─── MARHALAH ──────────────────────────────────────────────────────────────
export const getCachedMarhalahList = unstable_cache(
  async () => query<any>('SELECT id, nama, urutan FROM marhalah ORDER BY urutan'),
  ['marhalah-list'],
  { tags: ['marhalah'], revalidate: 86400 }
)

// ─── MAPEL ─────────────────────────────────────────────────────────────────
export const getCachedMapelList = unstable_cache(
  async () => query<any>('SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama'),
  ['mapel-list'],
  { tags: ['mapel'], revalidate: 86400 }
)

export const getCachedMapelAll = unstable_cache(
  async () => query<any>('SELECT id, nama FROM mapel ORDER BY nama'),
  ['mapel-all'],
  { tags: ['mapel'], revalidate: 86400 }
)

// ─── TAHUN AJARAN ──────────────────────────────────────────────────────────
export const getCachedTahunAjaranAktif = unstable_cache(
  async () => queryOne<any>('SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'),
  ['tahun-ajaran-aktif'],
  { tags: ['tahun-ajaran'], revalidate: 3600 }
)

export const getCachedTahunAjaranList = unstable_cache(
  async () => query<any>('SELECT * FROM tahun_ajaran ORDER BY id DESC'),
  ['tahun-ajaran-list'],
  { tags: ['tahun-ajaran'], revalidate: 3600 }
)

// ─── MASTER PELANGGARAN ────────────────────────────────────────────────────
export const getCachedMasterPelanggaran = unstable_cache(
  async () => query<any>('SELECT id, nama_pelanggaran, kategori, poin FROM master_pelanggaran ORDER BY kategori DESC, nama_pelanggaran'),
  ['master-pelanggaran'],
  { tags: ['master-pelanggaran'], revalidate: 3600 }
)

// ─── BIAYA SETTINGS ────────────────────────────────────────────────────────
export const getCachedBiayaSettings = unstable_cache(
  async () => query<any>('SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC'),
  ['biaya-settings'],
  { tags: ['biaya-settings'], revalidate: 86400 }
)

// ─── DATA GURU ─────────────────────────────────────────────────────────────
export const getCachedDataGuru = unstable_cache(
  async () => query<any>('SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap'),
  ['data-guru'],
  { tags: ['data-guru'], revalidate: 3600 }
)
