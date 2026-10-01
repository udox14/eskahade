/**
 * In-memory client-side cache for Modul Keamanan / Pelanggaran Santri.
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

export const keamananCache = new ClientCache()

export function getDaftarPelanggarCacheKey(search?: string, asrama?: string, page = 1): string {
  return `daftar:${search || ''}:${asrama || ''}:${page}`
}

export function getDetailSantriCacheKey(santriId: string): string {
  return `detail:${santriId}`
}

export function getHistoryReviewCacheKey(page = 1): string {
  return `reviews:${page}`
}
