export type CacheEntry<T> = { promise: Promise<T>; expiresAt: number; value?: T }

export const KEUANGAN_CACHE_MS = 10 * 60 * 1000

export function cachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key)
  return entry && entry.expiresAt > Date.now() ? entry.value : undefined
}

export function cached<T>(cache: Map<string, CacheEntry<T>>, key: string, fetch: () => Promise<T>) {
  const current = cache.get(key)
  if (current && current.expiresAt > Date.now()) return current
  const entry: CacheEntry<T> = {
    expiresAt: Infinity,
    promise: fetch().then(value => {
      entry.value = value
      entry.expiresAt = Date.now() + KEUANGAN_CACHE_MS
      return value
    }).catch(error => {
      if (cache.get(key) === entry) cache.delete(key)
      throw error
    }),
  }
  cache.set(key, entry)
  return entry
}

export async function readCached<T>(cache: Map<string, CacheEntry<T>>, key: string, fetch: () => Promise<T>) {
  const entry = cached(cache, key, fetch)
  const data = entry.value ?? await entry.promise
  // A save can publish newer data while this read is in flight.
  const latest = cache.get(key)
  return latest && latest !== entry ? latest.promise : data
}
