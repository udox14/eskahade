'use server'

import { batch, execute, generateId, now, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { assertFeature } from '@/lib/auth/feature'
import { sessionKey, sessionStatement, sessionLinkStatement } from '@/lib/discipline/data'
import { revalidateDiscipline } from '@/lib/discipline/revalidate'

type SourceType = 'pengajian' | 'berjamaah'
export type FinalStatus = 'ALFA' | 'IZIN' | 'SAKIT' | 'HADIR' | 'MANGKIR'
export type FinalFilterStatus = 'BELUM' | 'MANGKIR' | 'SELESAI' | 'SEMUA'

export type FinalVonisItem = {
  key: string
  panggilan_id: string
  santri_id: string
  nama: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  periode_awal: string
  periode_akhir: string
  source: SourceType
  tanggal: string
  sesi: string
  catatan_panggilan: string | null
  final_status: FinalStatus | null
  final_catatan: string | null
}

type SnapshotEvent = {
  source: SourceType
  tanggal: string
  sesi: string
  counted?: boolean
}

type SaveFinalPayload = {
  panggilanId: string
  santriId: string
  periodeAwal: string
  periodeAkhir: string
  source: SourceType
  tanggal: string
  sesi: string
  status: FinalStatus
  catatan?: string
}

const SOURCE_PATH: Record<SourceType, string> = {
  pengajian: '/dashboard/akademik/absensi/vonis-final',
  berjamaah: '/dashboard/keamanan/verifikasi-berjamaah',
}

const PENGAJIAN_SESI = ['shubuh', 'ashar', 'maghrib'] as const
const BERJAMAAH_SESI = ['shubuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as const

function dateFromYmd(dateStr: string) {
  return new Date(`${dateStr}T12:00:00.000Z`)
}

function ymdFromDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number) {
  const d = dateFromYmd(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return ymdFromDate(d)
}

function getWeekRangeFromRef(tanggalRef: string) {
  const ref = dateFromYmd(tanggalRef)
  const day = ref.getUTCDay()
  const diff = day >= 3 ? day - 3 : day + 4
  ref.setUTCDate(ref.getUTCDate() - diff)
  const start = ymdFromDate(ref)
  return { start, end: addDays(start, 6) }
}

async function ensureFinalVonisTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS verifikasi_panggilan_vonis (
      id TEXT PRIMARY KEY,
      panggilan_id TEXT NOT NULL REFERENCES verifikasi_panggilan(id),
      periode_awal TEXT NOT NULL,
      periode_akhir TEXT NOT NULL,
      santri_id TEXT NOT NULL REFERENCES santri(id),
      source TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      sesi TEXT NOT NULL,
      status_final TEXT NOT NULL,
      catatan TEXT,
      pelanggaran_id TEXT REFERENCES pelanggaran(id),
      verified_by TEXT REFERENCES users(id),
      verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(panggilan_id, source, tanggal, sesi)
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_periode ON verifikasi_panggilan_vonis(periode_awal, periode_akhir, source)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_status ON verifikasi_panggilan_vonis(status_final)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_santri ON verifikasi_panggilan_vonis(santri_id)`)

  try {
    await execute(`ALTER TABLE absen_berjamaah ADD COLUMN dzuhur TEXT`)
  } catch {
    // Kolom sudah tersedia pada database yang sudah termigrasi.
  }
}

function parseSnapshot(value: string) {
  try {
    return JSON.parse(value) as {
      nama?: string
      nis?: string | null
      asrama?: string | null
      kamar?: string | null
      events?: SnapshotEvent[]
    }
  } catch {
    return { events: [] }
  }
}

function eventKey(panggilanId: string, source: SourceType, tanggal: string, sesi: string) {
  return `${panggilanId}|${source}|${tanggal}|${sesi}`
}

async function getPengajianAbsensiId(santriId: string, tanggal: string) {
  const row = await queryOne<{ id: string }>(`
    SELECT ah.id
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    WHERE rp.santri_id = ? AND rp.status_riwayat = 'aktif' AND ah.tanggal = ?
    LIMIT 1
  `, [santriId, tanggal])
  return row?.id || null
}

function pengajianColumns(sesi: string) {
  if (!PENGAJIAN_SESI.includes(sesi as any)) throw new Error(`Sesi pengajian tidak valid: ${sesi}`)
  return { statusColumn: sesi, verifColumn: `verif_${sesi}` }
}

function berjamaahColumn(sesi: string) {
  if (!BERJAMAAH_SESI.includes(sesi as any)) throw new Error(`Waktu berjamaah tidak valid: ${sesi}`)
  return sesi
}

export async function getFinalVonisQueue(
  source: SourceType,
  tanggalRef: string,
  filters: { status?: FinalFilterStatus; search?: string; asrama?: string } = {}
) {
  const access=await assertFeature(SOURCE_PATH[source]);if('error' in access) throw new Error(access.error)
  await ensureFinalVonisTable()
  const { start, end } = getWeekRangeFromRef(tanggalRef)
  const rows = await query<any>(`
    SELECT vp.id AS panggilan_id, vp.periode_awal, vp.periode_akhir, vp.santri_id,
           vp.snapshot_json, vp.catatan AS catatan_panggilan,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM verifikasi_panggilan vp
    JOIN santri s ON s.id = vp.santri_id
    WHERE vp.periode_awal = ? AND vp.periode_akhir = ? AND vp.keputusan = 'DIPANGGIL'
    ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
  `, [start, end])

  if (!rows.length) return { periode: { start, end }, rows: [] as FinalVonisItem[] }

  const panggilanIds = rows.map((row: any) => row.panggilan_id)
  const ph = panggilanIds.map(() => '?').join(',')
  const existing = await query<any>(`
    SELECT panggilan_id, source, tanggal, sesi, status_final, catatan
    FROM verifikasi_panggilan_vonis
    WHERE panggilan_id IN (${ph}) AND source = ?
  `, [...panggilanIds, source])
  const existingMap = new Map(existing.map((row: any) => [eventKey(row.panggilan_id, row.source, row.tanggal, row.sesi), row]))

  const list: FinalVonisItem[] = []
  for (const row of rows) {
    const snapshot = parseSnapshot(row.snapshot_json)
    const events = (snapshot.events || []).filter((event) => event.source === source && event.counted !== false)
    for (const event of events) {
      const key = eventKey(row.panggilan_id, source, event.tanggal, event.sesi)
      const final = existingMap.get(key)
      list.push({
        key,
        panggilan_id: row.panggilan_id,
        santri_id: row.santri_id,
        nama: snapshot.nama || row.nama_lengkap,
        nis: snapshot.nis ?? row.nis ?? null,
        asrama: snapshot.asrama ?? row.asrama ?? null,
        kamar: snapshot.kamar ?? row.kamar ?? null,
        periode_awal: row.periode_awal,
        periode_akhir: row.periode_akhir,
        source,
        tanggal: event.tanggal,
        sesi: event.sesi,
        catatan_panggilan: row.catatan_panggilan ?? null,
        final_status: final?.status_final ?? null,
        final_catatan: final?.catatan ?? null,
      })
    }
  }

  const status = filters.status || 'BELUM'
  const search = (filters.search || '').trim().toLowerCase()
  const filtered = list.filter((item) => {
    if (filters.asrama && item.asrama !== filters.asrama) return false
    if (search && !item.nama.toLowerCase().includes(search) && !(item.nis || '').includes(search)) return false
    if (status === 'BELUM') return !item.final_status
    if (status === 'MANGKIR') return item.final_status === 'MANGKIR'
    if (status === 'SELESAI') return !!item.final_status && item.final_status !== 'MANGKIR'
    return true
  })

  return { periode: { start, end }, rows: filtered }
}

export async function simpanFinalVonis(daftar: SaveFinalPayload[]) {
  if(!Array.isArray(daftar)||!daftar.length||daftar.length>500) return {error:'Data vonis tidak valid.'}
  const seen=new Set<string>()
  for(const item of daftar) {
    if(!['pengajian','berjamaah'].includes(item.source)||!['ALFA','IZIN','SAKIT','HADIR','MANGKIR'].includes(item.status)||!/^\d{4}-\d{2}-\d{2}$/.test(item.tanggal)||!Number.isFinite(Date.parse(item.tanggal))||new Date(item.tanggal+'T00:00:00Z').toISOString().slice(0,10)!==item.tanggal||item.tanggal<item.periodeAwal||item.tanggal>item.periodeAkhir) return {error:'Data vonis tidak valid.'}
    const sessions=item.source==='pengajian'?PENGAJIAN_SESI:BERJAMAAH_SESI
    if(!(sessions as readonly string[]).includes(item.sesi)) return {error:'Sesi tidak valid.'}
    const key=sessionKey(item.source,item.santriId,item.tanggal,item.sesi)
    if(seen.has(key)) return {error:'Sesi duplikat.'};seen.add(key)
    const access=await assertFeature(SOURCE_PATH[item.source],'update');if('error' in access)return access
  }
  const session=await getSession();if(!session)return {error:'Unauthorized'}
  await ensureFinalVonisTable()
  const savedAt=now(),statements:{sql:string;params:unknown[]}[]=[]
  for(const item of daftar) {
    const call=await queryOne<{snapshot_json:string}>("SELECT snapshot_json FROM verifikasi_panggilan WHERE id=? AND santri_id=? AND periode_awal=? AND periode_akhir=? AND keputusan='DIPANGGIL'",[item.panggilanId,item.santriId,item.periodeAwal,item.periodeAkhir])
    if(!call||!(parseSnapshot(call.snapshot_json).events??[]).some(e=>e.source===item.source&&e.tanggal===item.tanggal&&e.sesi===item.sesi&&e.counted!==false)) return {error:'Sesi bukan bagian pemanggilan santri ini.'}
    const old=await queryOne<{id:string;status_final:string;updated_at:string;pelanggaran_id:string|null}>('SELECT id,status_final,updated_at,pelanggaran_id FROM verifikasi_panggilan_vonis WHERE panggilan_id=? AND source=? AND tanggal=? AND sesi=?',[item.panggilanId,item.source,item.tanggal,item.sesi])
    const canonical=await queryOne<{pelanggaran_id:string}>('SELECT pelanggaran_id FROM pelanggaran_sessions WHERE santri_id=? AND source=? AND tanggal=? AND sesi=?',[item.santriId,item.source,item.tanggal,item.sesi])
    const parent=canonical?.pelanggaran_id??old?.pelanggaran_id??sessionKey(item.source,item.santriId,item.tanggal,item.sesi)
    statements.push({sql:"SELECT json(CASE WHEN EXISTS(SELECT 1 FROM verifikasi_panggilan WHERE id=? AND santri_id=? AND snapshot_json=? AND keputusan='DIPANGGIL') THEN 'true' ELSE 'stale_call' END)",params:[item.panggilanId,item.santriId,call.snapshot_json]})
    if(old)statements.push({sql:"SELECT json(CASE WHEN EXISTS(SELECT 1 FROM verifikasi_panggilan_vonis WHERE id=? AND updated_at=? AND status_final=?) THEN 'true' ELSE 'stale_verdict' END)",params:[old.id,old.updated_at,old.status_final]})
    else statements.push({sql:"SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM verifikasi_panggilan_vonis WHERE panggilan_id=? AND source=? AND tanggal=? AND sesi=?) THEN 'true' ELSE 'stale_verdict' END)",params:[item.panggilanId,item.source,item.tanggal,item.sesi]})
    if(item.status!=='MANGKIR') {
      if(item.source==='pengajian') {
        const absenId=await getPengajianAbsensiId(item.santriId,item.tanggal)
        if(!absenId) return {error:'Data absensi sesi tidak ditemukan.'}
        const {statusColumn,verifColumn}=pengajianColumns(item.sesi)
        statements.push(item.status==='ALFA'?{sql:`UPDATE absensi_harian SET ${statusColumn}='A',${verifColumn}='OK' WHERE id=?`,params:[absenId]}:{sql:`UPDATE absensi_harian SET ${statusColumn}=?,${verifColumn}=NULL WHERE id=?`,params:[item.status==='IZIN'?'I':item.status==='SAKIT'?'S':'H',absenId]})
      } else {
        const column=berjamaahColumn(item.sesi)
        statements.push({sql:`INSERT INTO absen_berjamaah(santri_id,tanggal,${column},created_by) VALUES(?,?,?,?) ON CONFLICT(santri_id,tanggal) DO UPDATE SET ${column}=excluded.${column}`,params:[item.santriId,item.tanggal,item.status==='ALFA'?'A':item.status==='IZIN'?'P':item.status==='SAKIT'?'S':'H',session.id]})
      }
    }
    if(item.status==='ALFA') {
      const jenis=item.source==='pengajian'?'ALFA_PENGAJIAN':'ALFA_BERJAMAAH'
      statements.push({sql:'INSERT OR IGNORE INTO pelanggaran(id,santri_id,tanggal,jenis,deskripsi,poin,penindak_id) VALUES(?,?,?,?,?,0,?)',params:[parent,item.santriId,item.tanggal,jenis,`Alfa ${item.source}. Detail: ${item.tanggal} (${item.sesi})`,session.id]})
      statements.push(sessionStatement({parentId:parent,santriId:item.santriId,source:item.source,tanggal:item.tanggal,sesi:item.sesi,ref:item.panggilanId,actor:session.id,reason:item.catatan?.trim()||'Vonis final alfa'}))
      statements.push(sessionLinkStatement(parent,item.source,item.santriId,item.tanggal,item.sesi))
    } else if(item.status!=='MANGKIR'&&canonical) {
      statements.push({sql:"UPDATE pelanggaran_sessions SET status='cancelled',updated_by=?,updated_at=?,reason=?,version=version+1 WHERE santri_id=? AND source=? AND tanggal=? AND sesi=? AND status='active'",params:[session.id,savedAt,item.catatan?.trim()||'Koreksi vonis menjadi '+item.status,item.santriId,item.source,item.tanggal,item.sesi]})
    }
    statements.push({sql:`INSERT INTO verifikasi_panggilan_vonis(id,panggilan_id,periode_awal,periode_akhir,santri_id,source,tanggal,sesi,status_final,catatan,pelanggaran_id,verified_by,verified_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(panggilan_id,source,tanggal,sesi) DO UPDATE SET status_final=excluded.status_final,catatan=excluded.catatan,pelanggaran_id=excluded.pelanggaran_id,verified_by=excluded.verified_by,verified_at=excluded.verified_at,updated_at=excluded.updated_at`,params:[old?.id??generateId(),item.panggilanId,item.periodeAwal,item.periodeAkhir,item.santriId,item.source,item.tanggal,item.sesi,item.status,item.catatan?.trim()||null,item.status==='ALFA'||canonical||old?.pelanggaran_id?parent:null,session.id,savedAt,savedAt]})
  }
  try {await batch(statements)} catch(error) {
    if(error instanceof Error&&/malformed JSON|stale_|UNIQUE constraint/.test(error.message))return {error:'Data berubah. Muat ulang antrean sebelum menyimpan.'}
    throw error
  }

  const source = daftar[0]?.source || 'pengajian'
  await logActivity({
    actor: actorFromSession(session),
    module: source === 'pengajian' ? 'akademik_absensi_vonis_final' : 'keamanan_berjamaah_vonis_final',
    action: 'approval',
    fiturHref: SOURCE_PATH[source],
    logKind: 'update',
    entityType: 'verifikasi_panggilan_vonis_batch',
    entityId: `${source}:${savedAt}`,
    entityLabel: source === 'pengajian' ? 'Vonis final pengajian' : 'Vonis final berjamaah',
    summary: `Menyimpan ${daftar.length} vonis final ${source}`,
    details: {
      total: daftar.length,
      alfa: daftar.filter((item) => item.status === 'ALFA').length,
      izin: daftar.filter((item) => item.status === 'IZIN').length,
      sakit: daftar.filter((item) => item.status === 'SAKIT').length,
      hadir: daftar.filter((item) => item.status === 'HADIR').length,
      mangkir: daftar.filter((item) => item.status === 'MANGKIR').length,
    },
  })

  revalidatePath(SOURCE_PATH[source])
  revalidatePath('/dashboard/keamanan/verifikasi-panggilan')
  revalidateDiscipline()
  return { success: true, count: daftar.length }
}
