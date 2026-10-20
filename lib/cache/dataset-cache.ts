import { unstable_cache } from 'next/cache'
import { runtimeEnvironment } from '@/lib/db/runtime-environment'
import { getDB } from '@/lib/db'
import { databaseCacheContext } from '@/lib/db/cache-context'

type CacheOptions = { revalidate?: number | false; tags?: string[] }

/** Resolve cookies/role guards before Next's cache scope. The callback uses
 * only that binding, while its cache key explicitly separates both datasets. */
export function datasetCache<Args extends unknown[], Result>(
  callback: (...args: Args) => Promise<Result>,
  keyParts: string[] = [],
  options: CacheOptions = {},
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    const db = await getDB()
    const dataset = await runtimeEnvironment()
    // The callback's source must stay in the key: the wrapper below otherwise
    // has identical text for every consumer. Arguments remain normal cache keys.
    const cached = unstable_cache(
      (...cachedArgs: Args) => databaseCacheContext.run(db, () => callback(...cachedArgs)),
      ['dataset-cache-v2', dataset, callback.toString(), ...keyParts],
      options,
    )
    return cached(...args)
  }
}
