import { PHOTO_PREFIX } from './photo'

// Retry-safe: delete the object first; only acknowledge deletion after R2 succeeds.
// Pending uploads are also tracked before any R2 write, so outages leave no untracked objects.
export async function cleanupEvidencePhotos(db: D1Database, bucket: R2Bucket, namespace: 'prod'|'demo', timestamp=new Date().toISOString()) {
 const {results=[]}=await db.prepare("SELECT object_key FROM pengajian_violation_photos WHERE expires_at<=? AND state!='deleted' ORDER BY expires_at,object_key LIMIT 200").bind(timestamp).all<{object_key:string}>()
 let deleted=0,failed=0
 for(const row of results){
  if(!row.object_key.startsWith(`${PHOTO_PREFIX}${namespace}/`)){failed++;continue}
  try{
   await bucket.delete(row.object_key)
   await db.prepare("UPDATE pengajian_violation_photos SET state='deleted',deleted_at=? WHERE object_key=? AND expires_at<=?").bind(timestamp,row.object_key,timestamp).run()
   deleted++
  }catch(error){failed++;console.error('[pengajian-photo-cleanup]',error instanceof Error?error.message:String(error))}
 }
 return {checked:results.length,deleted,failed,more:results.length===200}
}
