'use server'

import { getSession } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import { query, queryOne } from '@/lib/db'
import { canAccessKelas, ensureGuruFeatureSchema, getSantriForKelas, HAFALAN_TYPES, displayQuranSurahTitle } from './guru-access'
import { resolveHafalanText } from '@/lib/hafalan/text'
import { buildHafalanSheets, buildNilaiSheets } from './guru-export'
import type { ExportDocument, ExportModule, ExportOptions, ExportRequest, ExportResult, ExportSesi, ExportNilai, ExportBlok, ExportProgress } from './guru-export'

type KelasExport = { nama_kelas: string; tahun_ajaran_nama: string; marhalah_id: number | null }
async function authorize(module: ExportModule, kelasId: string): Promise<KelasExport | null> {
  if (!['nilai', 'hafalan'].includes(module) || typeof kelasId !== 'string' || !kelasId) return null
  const session = await getSession()
  const href = module === 'nilai' ? '/dashboard/guru/nilai-harian' : '/dashboard/guru/hafalan'
  if (!session || !(await canAccessFeatureForSession(session, href)) || !(await canAccessKelas(session, kelasId))) return null
  await ensureGuruFeatureSchema()
  return queryOne<KelasExport>(`
    SELECT k.nama_kelas, ta.nama AS tahun_ajaran_nama, k.marhalah_id
    FROM kelas k JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id WHERE k.id = ?
  `, [kelasId])
}

async function nilaiSesi(kelasId: string) {
  return query<ExportSesi>(`
    SELECT nhs.id, nhs.mapel_id, mp.nama AS mapel_nama, nhs.nama_sesi, nhs.tanggal,
           nhs.kkm, g.nama_lengkap AS guru_nama
    FROM nilai_harian_sesi nhs JOIN mapel mp ON mp.id = nhs.mapel_id
    LEFT JOIN data_guru g ON g.id = nhs.guru_id
    WHERE nhs.kelas_id = ? ORDER BY mp.nama, nhs.tanggal, nhs.created_at, nhs.id
  `, [kelasId])
}

async function hafalanBlok(marhalahId: number | null, jenis?: string) {
  return query<Pick<ExportBlok, 'id' | 'jenis' | 'judul' | 'label'> & { ref: string | null; parent_judul: string | null }>(`
    SELECT hblk.id, hp.jenis, hb.judul, parent.judul AS parent_judul, hblk.label, hblk.ref
    FROM hafalan_paket_marhalah hpm
    JOIN hafalan_paket hp ON hp.id = hpm.paket_id AND hp.jenis = hpm.jenis AND hp.is_active = 1
    JOIN hafalan_bab hb ON hb.paket_id = hp.id AND hb.jenis = hp.jenis AND hb.is_active = 1
    LEFT JOIN hafalan_bab parent ON parent.id = hb.parent_id
    JOIN hafalan_blok hblk ON hblk.bab_id = hb.id AND hblk.is_active = 1
    WHERE hpm.marhalah_id = ? ${jenis ? 'AND hp.jenis = ?' : ''}
    ORDER BY hp.jenis, COALESCE(parent.urutan, hb.urutan), COALESCE(parent.id, hb.id), hb.urutan, hb.id, hblk.urutan, hblk.id
  `, jenis ? [marhalahId, jenis] : [marhalahId])
}

export async function getGuruExportOptions(module: ExportModule, kelasId: string): Promise<ExportResult<ExportOptions>> {
  try {
    const kelas = await authorize(module, kelasId)
    if (!kelas) return { ok: false, error: 'Akses kelas atau modul ditolak.' }
    if (module === 'nilai') {
      const sesi = await nilaiSesi(kelasId)
      const mapel = Array.from(new Map(sesi.map(s => [s.mapel_id, { id: s.mapel_id, nama: s.mapel_nama }])).values())
      return { ok: true, data: { mapel, sesi, jenis: [] } }
    }
    const rows = await query<{ jenis: string }>(`
      SELECT DISTINCT hp.jenis FROM hafalan_paket_marhalah hpm
      JOIN hafalan_paket hp ON hp.id = hpm.paket_id AND hp.jenis = hpm.jenis AND hp.is_active = 1
      JOIN hafalan_bab hb ON hb.paket_id = hp.id AND hb.jenis = hp.jenis AND hb.is_active = 1
      JOIN hafalan_blok hblk ON hblk.bab_id = hb.id AND hblk.is_active = 1
      WHERE hpm.marhalah_id = ?
    `, [kelas.marhalah_id])
    return { ok: true, data: { mapel: [], sesi: [], jenis: HAFALAN_TYPES.filter(t => rows.some(r => r.jenis === t.key)) } }
  } catch {
    return { ok: false, error: 'Pilihan ekspor belum berhasil dimuat. Silakan coba lagi.' }
  }
}

export async function getGuruExportData(request: ExportRequest): Promise<ExportResult<ExportDocument>> {
  try {
    if (!request || typeof request !== 'object') return { ok: false, error: 'Pilihan ekspor tidak valid.' }
    const kelas = await authorize(request.module, request.kelasId)
    if (!kelas) return { ok: false, error: 'Akses kelas atau modul ditolak.' }
    const santri = await getSantriForKelas(request.kelasId)
    if (!santri.length) return { ok: false, error: 'Tidak ada santri pada kelas ini.' }
    const metadata = {
      kelas: kelas.nama_kelas, tahunAjaran: kelas.tahun_ajaran_nama,
      exportedAt: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '+07:00',
    }
    if (request.module === 'nilai') {
      if (!['semua', 'mapel', 'sesi'].includes(request.scope)) return { ok: false, error: 'Cakupan ekspor tidak valid.' }
      const allSesi = await nilaiSesi(request.kelasId)
      if (request.scope === 'mapel' && (!Array.isArray(request.mapelIds) || !request.mapelIds.length || request.mapelIds.some(id => !Number.isInteger(id) || !allSesi.some(s => s.mapel_id === id)))) {
        return { ok: false, error: 'Pilihan mapel tidak valid untuk kelas ini.' }
      }
      if (request.scope === 'sesi' && (!Array.isArray(request.sesiIds) || !request.sesiIds.length || request.sesiIds.some(id => typeof id !== 'string' || !allSesi.some(s => s.id === id)))) {
        return { ok: false, error: 'Pilihan sesi tidak valid untuk kelas ini.' }
      }
      const sesi = allSesi.filter(s => request.scope === 'semua' ||
        (request.scope === 'mapel' ? request.mapelIds.includes(s.mapel_id) : request.sesiIds.includes(s.id)))
      if (!sesi.length) return { ok: false, error: 'Tidak ada sesi untuk pilihan ekspor ini.' }
      const nilai: ExportNilai[] = []
      // Keep each D1 query below its bound-parameter limit for large selections.
      for (let i = 0; i < sesi.length; i += 90) {
        const ids = sesi.slice(i, i + 90).map(s => s.id)
        nilai.push(...await query<ExportNilai>(`
          SELECT nhd.sesi_id, nhd.riwayat_pendidikan_id, nhd.nilai FROM nilai_harian_detail nhd
          JOIN nilai_harian_sesi nhs ON nhs.id = nhd.sesi_id
          WHERE nhs.kelas_id = ? AND nhs.id IN (${ids.map(() => '?').join(',')})
        `, [request.kelasId, ...ids]))
      }
      return { ok: true, data: {
        ...metadata, title: 'Nilai Harian',
        cakupan: request.scope === 'semua' ? 'Seluruh Mapel' : request.scope === 'mapel'
          ? Array.from(new Set(sesi.map(s => s.mapel_nama))).join(', ')
          : sesi.map(s => `${s.mapel_nama} - ${s.nama_sesi}`).join(', '),
        ...buildNilaiSheets(santri, sesi, nilai, request.scope === 'sesi' ? 'sesi' : 'mapel'),
      } }
    }
    if (!['semua', 'jenis'].includes(request.scope)) return { ok: false, error: 'Cakupan ekspor tidak valid.' }
    const jenis = request.scope === 'jenis' ? request.jenis : undefined
    if (request.scope === 'jenis' && !HAFALAN_TYPES.some(t => t.key === jenis)) return { ok: false, error: 'Jenis hafalan tidak valid.' }
    const rows = await hafalanBlok(kelas.marhalah_id, jenis)
    if (!rows.length) return { ok: false, error: 'Tidak ada materi hafalan untuk pilihan ini.' }
    const blok: ExportBlok[] = rows.map(b => ({
      ...b, jenis_label: HAFALAN_TYPES.find(t => t.key === b.jenis)?.label ?? b.jenis,
      judul: b.parent_judul ? `${b.parent_judul} / ${b.judul}` : b.jenis === 'quran' ? displayQuranSurahTitle(b.judul) : b.judul,
      total_kata: b.jenis === 'jurumiyah' ? String(resolveHafalanText(b.ref)?.arab ?? '').split(/\s+/).filter(Boolean).length : 0,
    }))
    const progress = await query<ExportProgress>(`
      SELECT p.blok_id, p.santri_id, p.status, p.highlight FROM hafalan_progress p
      JOIN hafalan_blok hblk ON hblk.id = p.blok_id AND hblk.is_active = 1
      JOIN hafalan_bab hb ON hb.id = hblk.bab_id AND hb.is_active = 1
      JOIN hafalan_paket hp ON hp.id = hb.paket_id AND hp.jenis = hb.jenis AND hp.is_active = 1
      JOIN hafalan_paket_marhalah hpm ON hpm.paket_id = hp.id AND hpm.jenis = hp.jenis
      WHERE hpm.marhalah_id = ? ${jenis ? 'AND hp.jenis = ?' : ''}
        AND EXISTS (SELECT 1 FROM riwayat_pendidikan rp WHERE rp.kelas_id = ? AND rp.santri_id = p.santri_id)
    `, jenis ? [kelas.marhalah_id, jenis, request.kelasId] : [kelas.marhalah_id, request.kelasId])
    return { ok: true, data: {
      ...metadata, title: 'Hafalan', cakupan: jenis ? HAFALAN_TYPES.find(t => t.key === jenis)!.label : 'Seluruh Jenis Hafalan',
      ...buildHafalanSheets(santri, blok, progress),
    } }
  } catch {
    return { ok: false, error: 'Data ekspor belum berhasil dimuat. Silakan coba lagi.' }
  }
}
