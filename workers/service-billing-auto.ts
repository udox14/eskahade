import { generateMonthlyServiceBillsCore, type MealServiceKind } from '../lib/finance/service-billing'
import { syncSppBillsAllSantriCore } from '../lib/finance/spp-billing-sync'

const CRON_ACTOR = 'CRON_AUTO'
const WIB_TIME_ZONE = 'Asia/Jakarta'
const SERVICE_KINDS: MealServiceKind[] = ['MAKAN', 'LAUNDRY']

function currentYyyymmWib(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  return `${year}-${month}`
}

const worker = {
  async fetch() {
    return Response.json({ ok: true, worker: 'service-billing-auto' })
  },

  async scheduled(_controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    const yyyymm = currentYyyymmWib()

    for (const serviceKind of SERVICE_KINDS) {
      ctx.waitUntil(
        generateMonthlyServiceBillsCore(env.DB, env.FINANCE_DB, serviceKind, yyyymm, CRON_ACTOR)
          .then(result => {
            console.log(JSON.stringify({ event: 'service_billing_auto', serviceKind, yyyymm, result }))
          })
          .catch(error => {
            console.error(JSON.stringify({
              event: 'service_billing_auto_error',
              serviceKind,
              yyyymm,
              message: error instanceof Error ? error.message : String(error),
            }))
          })
      )
    }

    // SPP — sinkron finance_bills untuk SEMUA santri aktif, bukan cuma yang
    // portalnya pernah dibuka ortu (syncPortalSppBills tetap jalan sendiri
    // tiap portal dibuka, ini cuma baseline harian).
    ctx.waitUntil(
      syncSppBillsAllSantriCore(env.DB, env.FINANCE_DB)
        .then(result => {
          console.log(JSON.stringify({ event: 'spp_billing_auto', result }))
        })
        .catch(error => {
          console.error(JSON.stringify({
            event: 'spp_billing_auto_error',
            message: error instanceof Error ? error.message : String(error),
          }))
        })
    )
  },
}

export default worker
