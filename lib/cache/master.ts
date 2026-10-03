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

// ─── BIAYA SETTINGS ────────────────────────────────────────────────────────
export const getCachedBiayaSettings = unstable_cache(
  async () => query<any>('SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC'),
  ['biaya-settings'],
  { tags: ['biaya-settings'], revalidate: 86400 }
)

// ─── DATA GURU ─────────────────────────────────────────────────────────────
// Data ini dikelola lewat CRUD dan harus langsung konsisten setelah mutasi.
// Jumlah barisnya kecil, jadi query langsung lebih aman daripada cache satu jam.
export async function getCachedDataGuru() {
  return query<any>('SELECT id, nama_lengkap, gelar, kode_guru FROM data_guru ORDER BY nama_lengkap')
}

// ─── FILTER SANTRI (GLOBAL) ───────────────────────────────────────────────
// Dropdown filter santri (sekolah, kecamatan, kab_kota, tahun_masuk, dll).
// Sangat masif (>300M row reads) jika di-query ulang di setiap page load.
export type SantriFilterOptions = {
  asramaKamarRows: { asrama: string | null; kamar: string | null }[]
  sekolahRows: { v: string }[]
  kelasSekolahRows: { v: string }[]
  statusRows: { v: string }[]
  golDarahRows: { v: string }[]
  tahunRows: { v: number }[]
  provinsiRows: { v: string }[]
  kabKotaRows: { v: string }[]
  kecamatanRows: { v: string }[]
  jemaahRows: { v: string }[]
}

export const getCachedSantriFilterOptions = unstable_cache(
  async (): Promise<SantriFilterOptions> => {
    const [
      asramaKamarRows,
      sekolahRows,
      kelasSekolahRows,
      statusRows,
      golDarahRows,
      tahunRows,
      provinsiRows,
      kabKotaRows,
      kecamatanRows,
      jemaahRows,
    ] = await Promise.all([
      query<{ asrama: string | null; kamar: string | null }>(
        'SELECT DISTINCT asrama, kamar FROM santri ORDER BY asrama, CAST(kamar AS INTEGER), kamar'
      ),
      query<{ v: string }>(
        "SELECT DISTINCT sekolah AS v FROM santri WHERE sekolah IS NOT NULL AND sekolah <> '' ORDER BY sekolah"
      ),
      query<{ v: string }>(
        "SELECT DISTINCT kelas_sekolah AS v FROM santri WHERE kelas_sekolah IS NOT NULL AND kelas_sekolah <> '' ORDER BY CAST(kelas_sekolah AS INTEGER), kelas_sekolah"
      ),
      query<{ v: string }>(
        "SELECT DISTINCT status_global AS v FROM santri WHERE status_global IS NOT NULL AND status_global <> '' ORDER BY status_global"
      ),
      query<{ v: string }>(
        "SELECT DISTINCT gol_darah AS v FROM santri WHERE gol_darah IS NOT NULL AND gol_darah <> '' ORDER BY gol_darah"
      ),
      query<{ v: number }>(
        `SELECT DISTINCT COALESCE(tahun_masuk, CAST(SUBSTR(NULLIF(tanggal_masuk, ''), 1, 4) AS INTEGER)) AS v
         FROM santri
         WHERE COALESCE(tahun_masuk, CAST(SUBSTR(NULLIF(tanggal_masuk, ''), 1, 4) AS INTEGER)) IS NOT NULL
         ORDER BY v DESC`
      ),
      query<{ v: string }>(
        "SELECT DISTINCT provinsi AS v FROM santri WHERE provinsi IS NOT NULL AND provinsi <> '' ORDER BY provinsi"
      ),
      query<{ v: string }>(
        "SELECT DISTINCT kab_kota AS v FROM santri WHERE kab_kota IS NOT NULL AND kab_kota <> '' ORDER BY kab_kota"
      ),
      query<{ v: string }>(
        "SELECT DISTINCT kecamatan AS v FROM santri WHERE kecamatan IS NOT NULL AND kecamatan <> '' ORDER BY kecamatan"
      ),
      query<{ v: string }>(
        "SELECT DISTINCT jemaah AS v FROM santri WHERE jemaah IS NOT NULL AND jemaah <> '' ORDER BY jemaah"
      ),
    ])
    return {
      asramaKamarRows,
      sekolahRows,
      kelasSekolahRows,
      statusRows,
      golDarahRows,
      tahunRows,
      provinsiRows,
      kabKotaRows,
      kecamatanRows,
      jemaahRows,
    }
  },
  ['santri-filter-options-global'],
  { tags: ['santri-filters'], revalidate: 3600 }
)

