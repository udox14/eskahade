// lib/pimpinan/cache.ts
//
// Cache lapisan monitoring Pimpinan. Semua halaman pimpinan bersifat
// force-dynamic, namun agregasi di belakangnya mahal (scan absensi bulanan,
// jurnal keuangan, dll). Getter di sini dibungkus unstable_cache (KV via
// OpenNext — pola sama dengan lib/cache/master.ts) dengan TTL pendek.
//
// Key ALWAYS diawali parameter `scope` ('live' | 'demo') sehingga cache DB
// asli dan DB demo tidak saling menimpa. Tester berbagi scope 'live' karena
// membaca DB yang sama (hanya dibungkus read-only).

import { unstable_cache } from 'next/cache'
import { getRingkasanPimpinan } from './ringkasan'
import { getKeuanganMonitoring } from './keuangan'
import { getAbsensiSantriMonitoring, getAbsensiGuruMonitoring } from './absensi'
import { getKesehatanMonitoring } from './kesehatan'
import { getAsramaMonitoring } from './asrama'
import { getDisiplinMonitoring } from './disiplin'
import { getAkademikMonitoring } from './akademik'
import { getPsbMonitoringPimpinan } from './psb'

export const MONITORING_CACHE_TTL = 60

export const getCachedRingkasanPimpinan = unstable_cache(
  async (_scope: string) => getRingkasanPimpinan(),
  ['pimpinan-ringkasan'],
  { revalidate: MONITORING_CACHE_TTL }
)

export const getCachedKeuanganMonitoring = unstable_cache(
  async (scope: string, month?: string) => getKeuanganMonitoring({ month }),
  ['pimpinan-keuangan'],
  { revalidate: MONITORING_CACHE_TTL }
)

export const getCachedAbsensiSantriMonitoring = unstable_cache(
  async (scope: string, month?: string, asrama?: string) =>
    getAbsensiSantriMonitoring({ month, asrama }),
  ['pimpinan-absensi-santri'],
  { revalidate: MONITORING_CACHE_TTL }
)

export const getCachedAbsensiGuruMonitoring = unstable_cache(
  async (scope: string, from?: string, to?: string) =>
    getAbsensiGuruMonitoring({ from, to }),
  ['pimpinan-absensi-guru'],
  { revalidate: MONITORING_CACHE_TTL }
)

export const getCachedKesehatanMonitoring = unstable_cache(
  async (scope: string, month?: string) => getKesehatanMonitoring({ month }),
  ['pimpinan-kesehatan'],
  { revalidate: MONITORING_CACHE_TTL }
)

export const getCachedAsramaMonitoring = unstable_cache(
  async (scope: string, month?: string) => getAsramaMonitoring({ month }),
  ['pimpinan-asrama'],
  { revalidate: MONITORING_CACHE_TTL }
)

export const getCachedDisiplinMonitoring = unstable_cache(
  async (scope: string, month?: string) => getDisiplinMonitoring({ month }),
  ['pimpinan-disiplin'],
  { revalidate: MONITORING_CACHE_TTL }
)

export const getCachedAkademikMonitoring = unstable_cache(
  async (_scope: string) => getAkademikMonitoring(),
  ['pimpinan-akademik'],
  { revalidate: MONITORING_CACHE_TTL }
)

export const getCachedPsbMonitoring = unstable_cache(
  async (_scope: string) => getPsbMonitoringPimpinan(),
  ['pimpinan-psb'],
  { revalidate: MONITORING_CACHE_TTL }
)
