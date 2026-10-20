import { cleanupEvidencePhotos } from '../lib/pengajian-violations/photo-cleanup'
import { environmentDatabase } from '../lib/db/environment'

const worker = {
 async scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
  const { db, environment } = environmentDatabase(env)
  if (environment !== 'production') throw new Error('Worker cleanup ini khusus production.')
  ctx.waitUntil((async()=>{
   const timestamp=new Date(controller.scheduledTime).toISOString()
   const outcomes=await Promise.allSettled([
    cleanupEvidencePhotos(db,env.R2_BUCKET,'prod',timestamp),
   ])
   console.log(JSON.stringify({event:'pengajian_photo_cleanup',timestamp,outcomes:outcomes.map(r=>r.status==='fulfilled'?r.value:{error:String(r.reason)})}))
   if(outcomes.some(r=>r.status==='rejected'||r.value.failed>0))throw new Error('Pembersihan foto belum tuntas; periksa log, akan dicoba lagi pada jadwal berikutnya.')
  })())
 },
}
export default worker
