import { runUangJajanAutoPotong } from '../lib/uang-jajan/auto-potong'
import { environmentDatabase } from '../lib/db/environment'

const worker = {
  async fetch() {
    return Response.json({ ok: true, worker: 'uang-jajan-auto' })
  },

  async scheduled(_controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    const { db, environment } = environmentDatabase(env)
    if (environment !== 'production') throw new Error('Worker auto-potong ini khusus production.')
    ctx.waitUntil(
      runUangJajanAutoPotong(db)
        .then(result => {
          console.log(JSON.stringify({ event: 'uang_jajan_auto_potong', result }))
        })
        .catch(error => {
          console.error(JSON.stringify({
            event: 'uang_jajan_auto_potong_error',
            message: error instanceof Error ? error.message : String(error),
          }))
        })
    )
  },
}

export default worker
