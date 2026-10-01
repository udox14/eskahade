import { batch, now } from '@/lib/db'

export async function saveLateVerdict(input:{source:'perizinan'|'perpulangan';id:string;santriId:string;vonis:'TELAT_MURNI'|'SAKIT'|'IZIN_UZUR'|'MANGKIR';actor:string}) {
 if(!['TELAT_MURNI','SAKIT','IZIN_UZUR','MANGKIR'].includes(input.vonis)||!['perizinan','perpulangan'].includes(input.source)) throw new Error('Vonis tidak valid.')
 if(input.vonis==='MANGKIR')return
 const table=input.source==='perizinan'?'perizinan':'perpulangan_log'
 const column=input.source==='perizinan'?'status':'status_datang'
 const before=input.source==='perizinan'?'AKTIF':'TELAT'
 const after=input.source==='perizinan'?'KEMBALI':input.vonis==='TELAT_MURNI'?'VONIS':'SUDAH'
 const predicate=`id=? AND santri_id=? AND ${column}=?`
 const timestamp=now()
 const statements=[{sql:`SELECT json(CASE WHEN EXISTS(SELECT 1 FROM ${table} WHERE ${predicate}) THEN 'true' ELSE 'stale_late' END)`,params:[input.id,input.santriId,before]}]
 if(input.vonis==='TELAT_MURNI') statements.push({sql:`INSERT INTO pelanggaran(id,santri_id,tanggal,jenis,deskripsi,poin,penindak_id) VALUES(?,?,?,'SEDANG',?,0,?) ON CONFLICT(id) DO NOTHING`,params:[`telat:${input.source}:${input.id}`,input.santriId,timestamp,input.source==='perizinan'?'Terlambat kembali ke pondok (melebihi batas izin).':'Terlambat kembali ke pondok setelah perpulangan.',input.actor]})
 statements.push(input.source==='perizinan'?{sql:`UPDATE perizinan SET status=? WHERE ${predicate}`,params:[after,input.id,input.santriId,before]}:{sql:`UPDATE perpulangan_log SET status_datang=?,tgl_datang=?,updated_by=? WHERE ${predicate}`,params:[after,timestamp,input.actor,input.id,input.santriId,before]})
 await batch(statements)
}
