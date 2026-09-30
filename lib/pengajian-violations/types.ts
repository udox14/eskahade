export const HREF = '/dashboard/akademik/pelanggaran-pengajian'
export const PAGE_SIZE = 30
export type Tab = 'riwayat' | 'rekap' | 'analitik'
export type Sesi = 'shubuh' | 'ashar' | 'maghrib'
export type Filters = {
 search?: string; start?: string; end?: string; asrama?: string; kamar?: string
 gender?: string; kelasId?: string; typeId?: string; session?: string; actorId?: string
 status?: 'active' | 'cancelled' | 'all'; min?: number; max?: number
 sort?: 'time' | 'name' | 'type' | 'actor' | 'count' | 'last'; direction?: 'asc' | 'desc'
}
export type Santri = { id: string; nis: string; nama_lengkap: string; foto_url: string | null; asrama: string | null; kamar: string | null; jenis_kelamin: string; status_global: string }
export type ViolationType = { id: string; name: string; description: string; position: number; active: number; version: number }
export type Incident = {
 id: string; santri_id: string; type_id: string; type_name: string; occurred_at: string
 session: Sesi; note: string; status: 'active' | 'cancelled'; created_by: string
 created_at: string; updated_by: string; updated_at: string; reason: string
 version: number; request_id: string; nama_lengkap: string; nis: string; foto_url: string | null
 asrama: string | null; kamar: string | null; actor_name: string
 evidence_url?: string | null; evidence_expires_at?: string | null
}
export type Recap = { santri_id: string; nama_lengkap: string; nis: string; foto_url: string | null; asrama: string | null; kamar: string | null; count: number; type_count: number; last: string }
export type Page<T> = { rows: T[]; total: number; page: number }
export type Bucket = { key: string; label: string; count: number }
export type Analytics = {
 total: number; students: number; repeat: number; trend: Bucket[]; weekly: Bucket[]
 types: Bucket[]; sessions: Bucket[]; dorms: Bucket[]; classes: Bucket[]; recurring: Recap[]
}
export type Options = { asramas: string[]; kamars: string[]; classes: { id: string; name: string }[]; actors: { id: string; name: string }[]; types: ViolationType[] }
export type Capabilities = { userId: string; manage: boolean; create: boolean; update: boolean; cancel: boolean }
export type SaveInput = { id: string; requestId: string; santriId: string; typeId: string; occurredAt: string; session: string; note: string; version?: number; reason?: string }
export type Result<T> = { data: T; error?: never } | { error: string; data?: never }
