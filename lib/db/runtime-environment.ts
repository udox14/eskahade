import { getCloudflareContext } from '@opennextjs/cloudflare'
import { environmentDatabase, type AppEnvironment } from './environment'

export async function runtimeEnvironment(): Promise<AppEnvironment> {
  const { env } = await getCloudflareContext({ async: true })
  return environmentDatabase(env).environment
}
