import { runUangJajanAutoPotong } from '../lib/uang-jajan/auto-potong'

const worker = {
  async fetch() {
    return Response.json({ ok: true, worker: 'uang-jajan-auto' })
  },

  async scheduled(_controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      runUangJajanAutoPotong(env.DB)
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
