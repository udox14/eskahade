import type { BillingWorkerEnv } from './finance-billing-env'
import { environmentDatabase } from '../lib/db/environment'
import { billingStore } from '../lib/finance/billing-store'
import { runBillingJob } from '../lib/finance/billing-job'

export default {
  async scheduled(controller: ScheduledController, env: BillingWorkerEnv) {
    if (String(env.FINANCE_BILLING_AUTO_ENABLED) !== 'true') return
    const { db,environment } = environmentDatabase(env)
    try {
      const store = billingStore(db)
      let queries = 0
      const counted = {
        query: async <T>(sql: string,p?: unknown[]) => {queries++;return store.query<T>(sql,p)},
        queryOne: async <T>(sql: string,p?: unknown[]) => {queries++;return store.queryOne<T>(sql,p)},
        execute: async (sql: string,p?: unknown[]) => {queries++;return store.execute(sql,p)},
      }
      // One student per durable checkpoint. Reserve query headroom for a whole student
      // below D1's paid 1,000-query limit; a 20-second wall budget left only three
      // students per tick in sandbox and could not finish a 2,500-student daily round.
      // Network waiting does not consume CPU time. Stop between checkpoints within
      // four and a half minutes, reserving the remaining time for the last student.
      const started = Date.now()
      do {
        const result = await runBillingJob(counted, new Date(controller.scheduledTime), 1)
        console.log(JSON.stringify({ event:'finance_billing_run',environment,...result,
          queries,elapsedMs:Date.now()-started,candidates: undefined }))
        if (result.status!=='RUNNING') break
      } while (queries<875 && Date.now()-started<270_000)
    } catch (error) {
      console.error(JSON.stringify({ event:'finance_billing_run_failed',environment,
        message: error instanceof Error ? error.message : 'Penerbitan gagal.' }))
      throw error
    }
  },
}
