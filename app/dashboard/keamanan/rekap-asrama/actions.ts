'use server'

import { query, batch, execute } from '@/lib/db'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { isAsramaTanpaKamar } from '@/lib/asrama'

const ASRAMA_PUTRI = ['ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']

export async function getSessionRekap() {
  const session = await getSession()
  if (!session) return null
  return {
    role: session.role,
    asrama_binaan: session.asrama_binaan ?? null,
    isPutri: ASRAMA_PUTRI.includes(session.asrama_binaan || '')
  }
}

export async function getKamarList(asrama: string) {
  if (isAsramaTanpaKamar(asrama)) return []
  const rows = await query<any>(`
    SELECT DISTINCT kamar FROM santri 
    WHERE asrama = ? AND status_global = 'aktif'
  `, [asrama])
  return rows.map(r => r.kamar || 'Tanpa Kamar').sort((a,b) => (parseInt(a) || 999) - (parseInt(b) || 999))
}

// Rekap Absen Malam: per santri, jumlah alfa per bulan
export async function getRekapAbsenMalam(asrama: string, bulan: string, tanggal?: string) {
  if (isAsramaTanpaKamar(asrama)) return { santriList: [], alfaPerSantri: {}, detailPerSantri: {} }
  // bulan format: YYYY-MM
  const [tahun, bln] = bulan.split('-')
  const startDate = tanggal || `${tahun}-${bln}-01`
  const endDate = tanggal || `${tahun}-${bln}-31`

  const absenList = await query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar, a.santri_id, a.tanggal, a.status FROM absen_malam_v2 a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ?
      AND s.asrama = ? AND s.status_global = 'aktif'
      AND a.status = 'ALFA'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap, a.tanggal
  `, [startDate, endDate, asrama])

  const santriMap: Record<string, any> = {}
  const detailPerSantri: Record<string, Record<string, string>> = {}
  const alfaPerSantri: Record<string, number> = {}
  absenList.forEach((a: any) => {
    if (!santriMap[a.id]) {
      santriMap[a.id] = { id: a.id, nama_lengkap: a.nama_lengkap, nis: a.nis, kamar: a.kamar }
    }
    if (!detailPerSantri[a.santri_id]) detailPerSantri[a.santri_id] = {}
    detailPerSantri[a.santri_id][a.tanggal] = a.status
    alfaPerSantri[a.santri_id] = (alfaPerSantri[a.santri_id] || 0) + 1
  })

  return { santriList: Object.values(santriMap), alfaPerSantri, detailPerSantri }
}

// Riwayat ALFA absen malam: semua bulan, supaya histori lama tetap mudah dicek.
export async function getRiwayatAlfaAbsenMalam(asrama: string) {
  if (isAsramaTanpaKamar(asrama)) return []

  const rows = await query<any>(`
    SELECT
      s.id,
      s.nama_lengkap,
      s.nis,
      s.kamar,
      a.tanggal,
      a.keterangan
    FROM absen_malam_v2 a
    JOIN santri s ON a.santri_id = s.id
    WHERE s.asrama = ?
      AND s.status_global = 'aktif'
      AND a.status = 'ALFA'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap, a.tanggal DESC
  `, [asrama])

  const map: Record<string, {
    id: string
    nama_lengkap: string
    nis: string | null
    kamar: string | null
    total_alfa: number
    tanggal: { tanggal: string; keterangan: string | null }[]
  }> = {}

  rows.forEach((row: any) => {
    if (!map[row.id]) {
      map[row.id] = {
        id: row.id,
        nama_lengkap: row.nama_lengkap,
        nis: row.nis,
        kamar: row.kamar,
        total_alfa: 0,
        tanggal: [],
      }
    }
    map[row.id].total_alfa += 1
    map[row.id].tanggal.push({
      tanggal: row.tanggal,
      keterangan: row.keterangan || null,
    })
  })

  return Object.values(map)
}

// Rekap Absen Berjamaah: per santri, per waktu, per bulan
// hideHaid: true untuk non-pengurus-asrama-putri
export async function getRekapAbsenBerjamaah(asrama: string, bulan: string, hideHaid: boolean) {
  if (isAsramaTanpaKamar(asrama)) return { santriList: [], detail: {} }
  const [tahun, bln] = bulan.split('-')
  const startDate = `${tahun}-${bln}-01`
  const endDate = `${tahun}-${bln}-31`

  const santriList = await query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar
    FROM santri s
    WHERE s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap
  `, [asrama])

  if (!santriList.length) return { santriList: [], detail: {} }

  const rows = await query<any>(`
    SELECT a.santri_id, a.tanggal, a.shubuh, a.dzuhur, a.ashar, a.maghrib, a.isya FROM absen_berjamaah a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ? AND s.asrama = ? AND s.status_global = 'aktif'
    ORDER BY a.tanggal
  `, [startDate, endDate, asrama])

  // detail[santri_id][tanggal] = { shubuh, dzuhur, ashar, maghrib, isya }
  const detail: Record<string, Record<string, any>> = {}
  rows.forEach((r: any) => {
    if (!detail[r.santri_id]) detail[r.santri_id] = {}
    detail[r.santri_id][r.tanggal] = {
      shubuh: hideHaid && r.shubuh === 'H' ? 'S' : r.shubuh,  // Sembunyikan Haid → tampilkan sebagai 'S' ke non-putri
      dzuhur: hideHaid && r.dzuhur === 'H' ? 'S' : r.dzuhur,
      ashar:  hideHaid && r.ashar === 'H'  ? 'S' : r.ashar,
      maghrib:hideHaid && r.maghrib === 'H'? 'S' : r.maghrib,
      isya:   hideHaid && r.isya === 'H'   ? 'S' : r.isya,
    }
  })

  return { santriList, detail }
}

export async function getSantriByAsrama(asrama: string) {
  if (isAsramaTanpaKamar(asrama)) return []
  return query<any>(`
    SELECT id, nama_lengkap, nis, kamar FROM santri
    WHERE asrama = ? AND status_global = 'aktif'
    ORDER BY CAST(kamar AS INTEGER), nama_lengkap
  `, [asrama])
}

// Rekap berjamaah per rentang tanggal, hanya santri yang punya alfa
export async function getRekapBerjamaahAlfaRange(asrama: string, startDate: string, endDate: string) {
  if (isAsramaTanpaKamar(asrama)) return { santriList: [], detail: {} }
  const rows = await query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.kamar,
           a.tanggal, a.shubuh, a.dzuhur, a.ashar, a.maghrib, a.isya
    FROM absen_berjamaah a
    JOIN santri s ON a.santri_id = s.id
    WHERE a.tanggal >= ? AND a.tanggal <= ?
      AND s.asrama = ? AND s.status_global = 'aktif'
      AND (a.shubuh = 'A' OR a.dzuhur = 'A' OR a.ashar = 'A' OR a.maghrib = 'A' OR a.isya = 'A')
    ORDER BY CAST(s.kamar AS INTEGER), s.nama_lengkap, a.tanggal
  `, [startDate, endDate, asrama])

  const santriMap: Record<string, any> = {}
  const detail: Record<string, Record<string, any>> = {}

  rows.forEach((r: any) => {
    if (!santriMap[r.id]) {
      santriMap[r.id] = { id: r.id, nama_lengkap: r.nama_lengkap, nis: r.nis, kamar: r.kamar }
    }
    if (!detail[r.id]) detail[r.id] = {}
    detail[r.id][r.tanggal] = {
      shubuh:  r.shubuh  === 'A' ? 'A' : null,
      dzuhur:  r.dzuhur  === 'A' ? 'A' : null,
      ashar:   r.ashar   === 'A' ? 'A' : null,
      maghrib: r.maghrib === 'A' ? 'A' : null,
      isya:    r.isya    === 'A' ? 'A' : null,
    }
  })

  return { santriList: Object.values(santriMap) as any[], detail }
}

// Hapus record alfa berjamaah tertentu (verifikasi)
export async function deleteAbsenBerjamaahRecords(records: { santriId: string, tanggal: string, waktu: string }[]) {
  if (!records.length) return { success: true, count: 0 }

  const VALID_WAKTU = new Set(['shubuh', 'dzuhur', 'ashar', 'maghrib', 'isya'])
  const valid = records.filter(r => VALID_WAKTU.has(r.waktu))
  if (!valid.length) return { success: true, count: 0 }

  // Group by santriId|tanggal
  const grouped: Record<string, Set<string>> = {}
  valid.forEach(r => {
    const k = `${r.santriId}|${r.tanggal}`
    if (!grouped[k]) grouped[k] = new Set()
    grouped[k].add(r.waktu)
  })

  const stmts: { sql: string, params: any[] }[] = []
  Object.entries(grouped).forEach(([key, waktus]) => {
    const [santriId, tanggal] = key.split('|')
    const setParts: string[] = []
    if (waktus.has('shubuh'))  setParts.push("shubuh = NULL")
    if (waktus.has('dzuhur'))  setParts.push("dzuhur = NULL")
    if (waktus.has('ashar'))   setParts.push("ashar = NULL")
    if (waktus.has('maghrib')) setParts.push("maghrib = NULL")
    if (waktus.has('isya'))    setParts.push("isya = NULL")
    stmts.push({
      sql: `UPDATE absen_berjamaah SET ${setParts.join(', ')} WHERE santri_id = ? AND tanggal = ?`,
      params: [santriId, tanggal]
    })
    stmts.push({
      sql: `DELETE FROM absen_berjamaah WHERE santri_id = ? AND tanggal = ? AND shubuh IS NULL AND dzuhur IS NULL AND ashar IS NULL AND maghrib IS NULL AND isya IS NULL`,
      params: [santriId, tanggal]
    })
  })

  const chunkSize = 50
  for (let i = 0; i < stmts.length; i += chunkSize) {
    await batch(stmts.slice(i, i + chunkSize))
  }

  return { success: true, count: valid.length }
}

export async function importAbsenBerjamaahFingerprint(alfaRows: { santri_id: string, tanggal: string, shubuh?: 'A', ashar?: 'A' }[]) {
  if (!alfaRows || !alfaRows.length) return { success: true, count: 0 }
  const session = await getSession()
  const uid = session?.id || null

  const statements = alfaRows.map(r => ({
    sql: `
      INSERT INTO absen_berjamaah (santri_id, tanggal, shubuh, ashar, created_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(santri_id, tanggal) DO UPDATE SET
        shubuh = COALESCE(absen_berjamaah.shubuh, excluded.shubuh),
        ashar  = COALESCE(absen_berjamaah.ashar, excluded.ashar)
    `,
    params: [r.santri_id, r.tanggal, r.shubuh || null, r.ashar || null, uid]
  }))

  try {
    // Jalankan dalam chunking jika alfaRows sangat banyak untuk menghindari limit
    const chunkSize = 50
    for (let i = 0; i < statements.length; i += chunkSize) {
      const chunk = statements.slice(i, i + chunkSize)
      await batch(chunk)
    }
    return { success: true, count: alfaRows.length }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function deleteAbsenMalamRecord(santriId: string, tanggal: string) {
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama', 'keamanan'])) {
    return { error: 'Unauthorized' }
  }

  // Jika pengurus asrama, check asrama binaan
  if (hasRole(session, 'pengurus_asrama') && session.asrama_binaan) {
    const rows = await query<any>('SELECT asrama FROM santri WHERE id = ?', [santriId])
    const santri = rows[0]
    if (santri && santri.asrama !== session.asrama_binaan) {
      return { error: 'Pengurus asrama hanya bisa mengubah absen santri asramanya.' }
    }
  }

  await execute(
    'DELETE FROM absen_malam_v2 WHERE santri_id = ? AND tanggal = ?',
    [santriId, tanggal]
  )

  const { logActivity, actorFromSession } = await import('@/lib/activity-log')
  const rows = await query<any>('SELECT nama_lengkap FROM santri WHERE id = ?', [santriId])
  const santriNama = rows[0]?.nama_lengkap || santriId

  await logActivity({
    actor: actorFromSession(session),
    module: 'asrama_absen_malam',
    action: 'delete',
    fiturHref: '/dashboard/keamanan/rekap-absen-malam',
    logKind: 'delete',
    entityType: 'absen_malam',
    entityId: `${santriId}_${tanggal}`,
    entityLabel: santriNama,
    summary: `Membatalkan status alfa absen malam ${santriNama} pada ${tanggal}`,
    details: { santri_id: santriId, tanggal },
  })

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/dashboard/keamanan/rekap-absen-malam')
  revalidatePath('/dashboard/asrama/absen-malam')

  return { success: true }
}
