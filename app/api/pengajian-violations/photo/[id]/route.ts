import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getIncidentPhotoKey } from '@/app/dashboard/akademik/pelanggaran-pengajian/actions'

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'}
 try{
  const {id}=await params
  const result=await getIncidentPhotoKey(id)
  if(!result.data)return new Response('Foto tidak tersedia',{status:404,headers})
  const {env}=await getCloudflareContext({async:true})
  const object=await env.R2_BUCKET.get(result.data.key) as {body:ReadableStream}|null
  if(!object)return new Response('Foto tidak tersedia',{status:404,headers})
  return new Response(object.body,{headers:{...headers,'Content-Type':'image/webp'}})
 }catch{return new Response('Foto gagal dimuat',{status:503,headers})}
}
