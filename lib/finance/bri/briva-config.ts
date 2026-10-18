import { queryOne } from '@/lib/db'

// Non-secret institution configuration. X-PARTNER-ID is a different identifier.
export async function configuredBrivaPartnerServiceId():Promise<string>{
  const fromEnv=process.env.BRI_PARTNER_SERVICE_ID?.trim()
  const value=fromEnv || (await queryOne<{value:string}>('SELECT value FROM app_settings WHERE key=?',['bri_partner_service_id']))?.value?.trim() || ''
  if(!/^\d{1,8}$/.test(value))throw new Error('BRIVA_PARTNER_SERVICE_ID_REQUIRED')
  return value
}
