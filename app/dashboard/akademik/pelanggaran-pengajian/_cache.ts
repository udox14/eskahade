/**
 * In-memory client-side cache for Pelanggaran Pengajian module.
 * Provides instant tab switching, instantaneous drawer opening,
 * and background revalidation (SWR) without repeated skeletons.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

class ClientCache {
  private cache = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    return entry.data as T
  }

  isFresh(key: string, maxAgeMs = 60_000): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    return Date.now() - entry.timestamp < maxAgeMs
  }

  set<T>(key: string, data: T): void {
    // Bound cache size to prevent memory leaks in very long sessions
    if (this.cache.size > 150) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): void {
    this.cache.delete(key)
  }
}

export const pelanggaranCache = new ClientCache()

export function serializeFilters(f: Record<string, unknown>): string {
  return Object.keys(f)
    .sort()
    .filter((k) => f[k] !== undefined && f[k] !== '' && f[k] !== null)
    .map((k) => `${k}:${f[k]}`)
    .join('|')
}

export function getHistoryCacheKey(
  filters: Record<string, unknown>,
  page: number,
  pageSize: number
): string {
  return `history:${serializeFilters(filters)}:p${page}:s${pageSize}`
}

export function getRecapCacheKey(
  filters: Record<string, unknown>,
  page: number,
  pageSize: number
): string {
  return `recap:${serializeFilters(filters)}:p${page}:s${pageSize}`
}

export function getAnalyticsCacheKey(filters: Record<string, unknown>): string {
  return `analytics:${serializeFilters(filters)}`
}

export function getStudentDetailCacheKey(
  santriId: string,
  filters: Record<string, unknown>,
  page: number,
  pageSize: number
): string {
  return `detail:${santriId}:${serializeFilters(filters)}:p${page}:s${pageSize}`
}
