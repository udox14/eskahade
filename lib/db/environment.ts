export type AppEnvironment = 'production' | 'sandbox'
type DatabaseBindings = Pick<CloudflareEnv, 'DB' | 'DEMO_DB' | 'ESKAHADE_ENV'>
type EnvironmentSession = { role?: unknown; roles?: unknown; demoSandbox?: unknown; environment?: unknown }

/** Bindings, never a cookie/hostname/default, define the database for this Worker. */
export function environmentDatabase(env: DatabaseBindings): { environment: AppEnvironment; db: D1Database } {
  const environment = env.ESKAHADE_ENV
  if (environment !== 'production' && environment !== 'sandbox') throw new Error('Environment aplikasi tidak valid.')
  if (!env.DB) throw new Error('Database aplikasi tidak tersedia.')
  if (environment === 'production' && 'DEMO_DB' in env) throw new Error('Konfigurasi isolasi production tidak valid.')
  if (environment === 'sandbox' && !env.DEMO_DB) throw new Error('Konfigurasi isolasi sandbox tidak valid.')
  return { environment, db: env.DB }
}

export function environmentAllowsSession(session: EnvironmentSession, environment: AppEnvironment): boolean {
  const demo = session.role === 'demo' || (Array.isArray(session.roles) && session.roles.includes('demo'))
  if (environment === 'production' && (demo || session.demoSandbox === true)) return false
  // Legacy tokens have no trustworthy realm. Require a fresh login after cutover.
  return session.environment === environment
}
