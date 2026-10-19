import { AsyncLocalStorage } from 'node:async_hooks'

// The store carries an already authorized binding through a cache callback.
// It is scoped to the async call, never shared mutable per-user global state.
export const databaseCacheContext = new AsyncLocalStorage<D1Database>()
