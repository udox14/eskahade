import type { Filters } from './types'

export function validateFilters(f: Filters) {
 for (const date of [f.start, f.end]) {
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0,10) !== date)) throw new Error('Tanggal filter tidak valid.')
 }
 if (f.start && f.end && f.start > f.end) throw new Error('Tanggal awal harus sebelum tanggal akhir.')
 if (f.gender && !['L','P'].includes(f.gender)) throw new Error('Jenis kelamin tidak valid.')
 if (f.session && !['shubuh','ashar','maghrib'].includes(f.session)) throw new Error('Sesi tidak valid.')
 if (f.status && !['active','cancelled','all'].includes(f.status)) throw new Error('Status tidak valid.')
 if (f.sort && !['time','name','type','actor','count','last'].includes(f.sort)) throw new Error('Urutan tidak valid.')
 if (f.direction && !['asc','desc'].includes(f.direction)) throw new Error('Arah urutan tidak valid.')
 for (const n of [f.min,f.max]) if (n != null && (!Number.isSafeInteger(n) || n < 0)) throw new Error('Batas jumlah harus berupa bilangan bulat positif atau nol.')
 if (f.min != null && f.max != null && f.min > f.max) throw new Error('Batas minimum melebihi maksimum.')
 for (const value of [f.search,f.asrama,f.kamar,f.kelasId,f.typeId,f.actorId]) if (value && (typeof value !== 'string' || value.length > 200)) throw new Error('Filter terlalu panjang.')
}

export const ACTIVE_EDUCATION = "lower(trim(COALESCE(rp.status_riwayat,'aktif'))) IN ('aktif','active','')"
export const BASE_FROM = 'FROM pengajian_violations v JOIN santri s ON s.id=v.santri_id JOIN users u ON u.id=v.created_by'

export function studentScope(kelasIds: string[] | null) {
 if (kelasIds === null) return { sql: '1=1', params: [] as string[] }
 if (!kelasIds.length) return { sql: '1=0', params: [] as string[] }
 return { sql: `EXISTS(SELECT 1 FROM riwayat_pendidikan rp WHERE rp.santri_id=s.id AND ${ACTIVE_EDUCATION} AND rp.kelas_id IN (${kelasIds.map(()=>'?').join(',')}))`, params: kelasIds }
}

export function whereClause(f: Filters, kelasIds: string[] | null, santriId?: string, summary = false) {
 validateFilters(f)
 const scope = studentScope(kelasIds)
 const clauses = [scope.sql]; const params: (string | number)[] = [...scope.params]
 const add = (sql: string, value: string | number) => { clauses.push(sql); params.push(value) }
 if (summary || !f.status || f.status !== 'all') add('v.status=?',summary ? 'active' : f.status || 'active')
 if (santriId) add('s.id=?',santriId)
 if (f.search) { clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)'); params.push(`%${f.search.trim()}%`,`%${f.search.trim()}%`) }
 if (f.start) add('v.occurred_at>=?',new Date(f.start+'T00:00:00+07:00').toISOString())
 if (f.end) add('v.occurred_at<=?',new Date(f.end+'T23:59:59.999+07:00').toISOString())
 if(f.asrama==='__unassigned__') clauses.push("NULLIF(trim(s.asrama),'') IS NULL")
 else if(f.asrama) add('s.asrama=?',f.asrama)
 for (const [value,column] of [[f.kamar,'s.kamar'],[f.gender,'s.jenis_kelamin'],[f.typeId,'v.type_id'],[f.session,'v.session'],[f.actorId,'v.created_by']] as const) if (value) add(column+'=?',value)
 if (f.kelasId) add(`EXISTS(SELECT 1 FROM riwayat_pendidikan rp JOIN kelas k ON k.id=rp.kelas_id JOIN tahun_ajaran ta ON ta.id=k.tahun_ajaran_id AND ta.is_active=1 WHERE rp.santri_id=s.id AND ${ACTIVE_EDUCATION} AND rp.kelas_id=?)`,f.kelasId)
 return { sql: clauses.join(' AND '), params }
}
export function countHaving(f: Filters) {
 const parts: string[] = []; const params: number[] = []
 if (f.min != null) { parts.push('COUNT(*)>=?'); params.push(f.min) }
 if (f.max != null) { parts.push('COUNT(*)<=?'); params.push(f.max) }
 return { sql: parts.length ? 'HAVING '+parts.join(' AND ') : '', params }
}
export function orderBy(f: Filters, recap = false) {
 const columns = recap ? { count:'count', name:'s.nama_lengkap', last:'last' } : { time:'v.occurred_at', name:'s.nama_lengkap', type:'v.type_name', actor:'u.full_name' }
 const selected = columns[f.sort as keyof typeof columns] || (recap ? 'count' : 'v.occurred_at')
 return `${selected} ${f.direction === 'asc' ? 'ASC' : 'DESC'}, ${recap ? 's.id' : 'v.id'} ASC`
}
