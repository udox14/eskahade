'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function getAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Server Key Error")
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const PAGE_SIZE = 30

// ============================================================
// 1. GETTER: Santri aktif dengan lazy load + filter
// ============================================================
export type FilterSantri = {
  search?: string
  asrama?: string
  sekolah?: string
  kelas_sekolah?: string
  kelas_pesantren?: string   // nama kelas, misal "1-A"
  page?: number
}

export async function getSantriAktifUntukArsip(filter: FilterSantri = {}) {
  const supabase = await createClient()
  const { search, asrama, sekolah, kelas_sekolah, kelas_pesantren, page = 1 } = filter
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Base query — join riwayat_pendidikan untuk filter kelas pesantren
  let query = supabase
    .from('santri')
    .select(`
      id, nis, nama_lengkap, asrama, kamar, sekolah, kelas_sekolah,
      riwayat_pendidikan!left (
        kelas:kelas_id (nama_kelas)
      )
    `, { count: 'exact' })
    .eq('status_global', 'aktif')
    .eq('riwayat_pendidikan.status_riwayat', 'aktif')
    .order('nama_lengkap')
    .range(from, to)

  if (search) {
    query = query.or(`nama_lengkap.ilike.%${search}%,nis.ilike.%${search}%`)
  }
  if (asrama) query = query.eq('asrama', asrama)
  if (sekolah) query = query.eq('sekolah', sekolah)
  if (kelas_sekolah) query = query.ilike('kelas_sekolah', `%${kelas_sekolah}%`)

  const { data, count, error } = await query

  // Filter kelas pesantren di sisi server setelah join (Supabase tidak support filter nested langsung)
  let rows = (data || []) as any[]
  if (kelas_pesantren) {
    rows = rows.filter((s: any) =>
      (s.riwayat_pendidikan || []).some((r: any) =>
        r.kelas?.nama_kelas?.toLowerCase() === kelas_pesantren.toLowerCase()
      )
    )
  }

  return {
    data: rows,
    total: count ?? 0,
    page,
    hasMore: to < (count ?? 0) - 1
  }
}

// Ambil opsi filter (distinct values) untuk dropdown
export async function getFilterOptionsSantri() {
  const supabase = await createClient()

  const [asramaRes, sekolahRes, kelasRes] = await Promise.all([
    supabase.from('santri').select('asrama').eq('status_global', 'aktif').not('asrama', 'is', null),
    supabase.from('santri').select('sekolah').eq('status_global', 'aktif').not('sekolah', 'is', null),
    supabase.from('kelas').select('nama_kelas')
  ])

  const asramaList = [...new Set((asramaRes.data || []).map((r: any) => r.asrama))].sort()
  const sekolahList = [...new Set((sekolahRes.data || []).map((r: any) => r.sekolah))].sort()
  const kelasList = (kelasRes.data || []).map((r: any) => r.nama_kelas).sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

  return { asramaList, sekolahList, kelasList }
}

// ============================================================
// 2. GETTER: Grup arsip (Level 1 — per angkatan/catatan)
// ============================================================
export async function getGrupArsip() {
  const supabase = await createClient()

  // Ambil semua arsip, group by (angkatan, catatan, tanggal_arsip::date)
  // Karena Supabase tidak support GROUP BY langsung, kita ambil kolom ringkas
  // lalu group di sisi server
  const { data, error } = await supabase
    .from('santri_arsip')
    .select('angkatan, catatan, tanggal_arsip, asrama')
    .order('tanggal_arsip', { ascending: false })

  if (error || !data) return []

  // Group by: kombinasi angkatan + catatan + tanggal (hari)
  const grupMap = new Map<string, {
    key: string
    angkatan: number | null
    catatan: string | null
    tanggal_arsip: string       // tanggal hari pertama batch ini
    jumlah: number
    asramaList: string[]
  }>()

  for (const row of data) {
    const tgl = row.tanggal_arsip?.split('T')[0] ?? ''
    // Key unik per grup: angkatan + catatan + tanggal hari
    const key = `${row.angkatan ?? 'null'}__${row.catatan ?? ''}__${tgl}`

    if (grupMap.has(key)) {
      const g = grupMap.get(key)!
      g.jumlah++
      if (row.asrama && !g.asramaList.includes(row.asrama)) g.asramaList.push(row.asrama)
    } else {
      grupMap.set(key, {
        key,
        angkatan: row.angkatan,
        catatan: row.catatan,
        tanggal_arsip: tgl,
        jumlah: 1,
        asramaList: row.asrama ? [row.asrama] : []
      })
    }
  }

  return Array.from(grupMap.values())
}

// ============================================================
// 2b. GETTER: Santri dalam satu grup (Level 2 — lazy load)
// ============================================================
export type FilterSantriArsip = {
  search?: string
  asrama?: string
  page?: number
}

export async function getSantriDalamGrup(
  angkatan: number | null,
  catatan: string | null,
  tanggalArsip: string,         // format YYYY-MM-DD
  filter: FilterSantriArsip = {}
) {
  const supabase = await createClient()
  const { search, asrama, page = 1 } = filter
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('santri_arsip')
    .select('id, nis, nama_lengkap, asrama, tanggal_arsip, catatan, angkatan', { count: 'exact' })
    .gte('tanggal_arsip', `${tanggalArsip}T00:00:00`)
    .lte('tanggal_arsip', `${tanggalArsip}T23:59:59`)
    .order('nama_lengkap')
    .range(from, to)

  // Filter angkatan
  if (angkatan !== null) query = query.eq('angkatan', angkatan)
  else query = query.is('angkatan', null)

  // Filter catatan
  if (catatan) query = query.eq('catatan', catatan)
  else query = query.is('catatan', null)

  if (search) query = query.or(`nama_lengkap.ilike.%${search}%,nis.ilike.%${search}%`)
  if (asrama) query = query.eq('asrama', asrama)

  const { data, count } = await query

  return {
    data: data || [],
    total: count ?? 0,
    page,
    hasMore: to < (count ?? 0) - 1
  }
}

// ============================================================
// 3. CORE: Arsipkan santri (bisa satu atau banyak sekaligus)
// ============================================================
export async function arsipkanSantri(santriIds: string[], catatan: string) {
  const supabaseAdmin = getAdminClient()

  if (!santriIds || santriIds.length === 0) return { error: "Pilih minimal 1 santri" }

  let berhasil = 0
  let gagal = 0
  const errorList: string[] = []

  for (const santriId of santriIds) {
    try {
      // --- STEP 1: Ambil profil santri ---
      const { data: profil } = await supabaseAdmin
        .from('santri')
        .select('*')
        .eq('id', santriId)
        .single()

      if (!profil) { gagal++; errorList.push(`ID ${santriId}: Data tidak ditemukan`); continue }

      // --- STEP 2: Ambil riwayat pendidikan + nilai ---
      const { data: riwayatList } = await supabaseAdmin
        .from('riwayat_pendidikan')
        .select(`
          id, kelas_id, status_riwayat,
          kelas:kelas_id (nama_kelas),
          nilai_akademik (mapel_id, semester, nilai, mapel:mapel_id (nama))
        `)
        .eq('santri_id', santriId)

      // --- STEP 3: Ambil absensi harian ---
      const riwayatIds = (riwayatList || []).map((r: any) => r.id)
      let absensiList: any[] = []
      if (riwayatIds.length > 0) {
        const { data: absensi } = await supabaseAdmin
          .from('absensi_harian')
          .select('riwayat_pendidikan_id, tanggal, shubuh, ashar, maghrib')
          .in('riwayat_pendidikan_id', riwayatIds)
        absensiList = absensi || []
      }

      // --- STEP 4: Ambil pelanggaran ---
      const { data: pelanggaranList } = await supabaseAdmin
        .from('pelanggaran')
        .select('*')
        .eq('santri_id', santriId)

      // --- STEP 5: Ambil SPP log ---
      const { data: sppList } = await supabaseAdmin
        .from('spp_log')
        .select('*')
        .eq('santri_id', santriId)

      // --- STEP 6: Rakit snapshot JSONB ---
      const snapshot = {
        profil,
        riwayat_pendidikan: riwayatList || [],
        absensi: absensiList,
        pelanggaran: pelanggaranList || [],
        spp: sppList || []
      }

      // Hitung angkatan dari NIS (ambil 4 digit pertama) atau tahun masuk
      // Fallback ke tahun arsip jika tidak ketahuan
      const angkatan = profil.nis ? parseInt(String(profil.nis).substring(0, 4)) || null : null

      // --- STEP 7: Simpan ke tabel arsip ---
      const { error: errArsip } = await supabaseAdmin
        .from('santri_arsip')
        .insert({
          santri_id_asli: santriId,
          nis: profil.nis,
          nama_lengkap: profil.nama_lengkap,
          angkatan: isNaN(angkatan as number) ? null : angkatan,
          asrama: profil.asrama,
          catatan: catatan || null,
          snapshot
        })

      if (errArsip) {
        gagal++
        errorList.push(`${profil.nama_lengkap}: ${errArsip.message}`)
        continue
      }

      // --- STEP 8: Hapus data relasi & santri dari tabel aktif ---
      // Urutan penting: hapus child dulu baru parent

      // Hapus nilai akademik
      if (riwayatIds.length > 0) {
        await supabaseAdmin.from('nilai_akademik').delete().in('riwayat_pendidikan_id', riwayatIds)
        await supabaseAdmin.from('absensi_harian').delete().in('riwayat_pendidikan_id', riwayatIds)
        await supabaseAdmin.from('riwayat_pendidikan').delete().eq('santri_id', santriId)
      }

      await supabaseAdmin.from('pelanggaran').delete().eq('santri_id', santriId)
      await supabaseAdmin.from('spp_log').delete().eq('santri_id', santriId)

      // Hapus santri utama
      await supabaseAdmin.from('santri').delete().eq('id', santriId)

      berhasil++

    } catch (err: any) {
      gagal++
      errorList.push(`ID ${santriId}: ${err.message}`)
    }
  }

  revalidatePath('/dashboard/santri/arsip')
  revalidatePath('/dashboard/santri')

  return {
    success: true,
    berhasil,
    gagal,
    errors: errorList
  }
}

// ============================================================
// 4. CORE: Restore santri dari arsip (bisa pilih sebagian)
// ============================================================
export async function restoreSantri(arsipIds: string[]) {
  const supabaseAdmin = getAdminClient()

  if (!arsipIds || arsipIds.length === 0) return { error: "Pilih minimal 1 data untuk direstore" }

  let berhasil = 0
  let gagal = 0
  const errorList: string[] = []

  for (const arsipId of arsipIds) {
    try {
      // Ambil data arsip
      const { data: arsip } = await supabaseAdmin
        .from('santri_arsip')
        .select('*')
        .eq('id', arsipId)
        .single()

      if (!arsip) { gagal++; errorList.push(`Arsip ID ${arsipId}: Tidak ditemukan`); continue }

      const snap = arsip.snapshot

      // --- STEP 1: Restore profil santri dengan ID BARU ---
      const profilAsli = { ...snap.profil }
      const idAsli = profilAsli.id

      // Hapus id lama, biarkan Supabase generate UUID baru
      delete profilAsli.id

      // Reset kelas ke null (admin atur manual setelahnya)
      profilAsli.status_global = 'aktif'

      const { data: santriBaruList, error: errInsert } = await supabaseAdmin
        .from('santri')
        .insert(profilAsli)
        .select('id')

      if (errInsert || !santriBaruList || santriBaruList.length === 0) {
        gagal++
        errorList.push(`${arsip.nama_lengkap}: Gagal insert santri — ${errInsert?.message || 'unknown'}`)
        continue
      }

      const idBaru = santriBaruList[0].id

      // --- STEP 2: Restore riwayat pendidikan (kelas = null) ---
      const mapRiwayatOldToNew = new Map<string, string>()

      for (const riwayat of (snap.riwayat_pendidikan || [])) {
        const { data: rwBaru, error: errRw } = await supabaseAdmin
          .from('riwayat_pendidikan')
          .insert({
            santri_id: idBaru,
            kelas_id: null,       // Kelas dikosongkan, admin atur manual
            status_riwayat: riwayat.status_riwayat || 'aktif'
          })
          .select('id')

        if (!errRw && rwBaru && rwBaru.length > 0) {
          mapRiwayatOldToNew.set(riwayat.id, rwBaru[0].id)

          // Restore nilai akademik untuk riwayat ini
          const nilaiList = riwayat.nilai_akademik || []
          if (nilaiList.length > 0) {
            const nilaiInserts = nilaiList.map((n: any) => ({
              riwayat_pendidikan_id: rwBaru[0].id,
              mapel_id: n.mapel_id,
              semester: n.semester,
              nilai: n.nilai
            }))
            await supabaseAdmin.from('nilai_akademik').insert(nilaiInserts)
          }
        }
      }

      // --- STEP 3: Restore absensi harian ---
      for (const absensi of (snap.absensi || [])) {
        const riwayatIdBaru = mapRiwayatOldToNew.get(absensi.riwayat_pendidikan_id)
        if (!riwayatIdBaru) continue

        const { id: _id, riwayat_pendidikan_id: _old, ...absensiData } = absensi
        await supabaseAdmin.from('absensi_harian').insert({
          ...absensiData,
          riwayat_pendidikan_id: riwayatIdBaru
        })
      }

      // --- STEP 4: Restore pelanggaran ---
      for (const p of (snap.pelanggaran || [])) {
        const { id: _id, santri_id: _old, ...pData } = p
        await supabaseAdmin.from('pelanggaran').insert({
          ...pData,
          santri_id: idBaru
        })
      }

      // --- STEP 5: Restore SPP log ---
      for (const spp of (snap.spp || [])) {
        const { id: _id, santri_id: _old, ...sppData } = spp
        await supabaseAdmin.from('spp_log').insert({
          ...sppData,
          santri_id: idBaru
        })
      }

      // --- STEP 6: Hapus dari tabel arsip setelah berhasil restore ---
      await supabaseAdmin.from('santri_arsip').delete().eq('id', arsipId)

      berhasil++

    } catch (err: any) {
      gagal++
      errorList.push(`Arsip ID ${arsipId}: ${err.message}`)
    }
  }

  revalidatePath('/dashboard/santri/arsip')
  revalidatePath('/dashboard/santri')

  return { success: true, berhasil, gagal, errors: errorList }
}

// ============================================================
// 6. DOWNLOAD: Ambil data arsip lengkap (dengan snapshot) untuk diexport
// ============================================================
export async function getArsipForDownload(arsipIds?: string[]) {
  const supabase = await createClient()

  let query = supabase
    .from('santri_arsip')
    .select('id, nis, nama_lengkap, asrama, angkatan, catatan, tanggal_arsip')
    .order('angkatan', { ascending: false })
    .order('nama_lengkap')

  // Jika ada filter ID tertentu, hanya ambil yang itu
  if (arsipIds && arsipIds.length > 0) {
    query = query.in('id', arsipIds)
  }

  const { data, error } = await query
  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function hapusArsipPermanen(arsipId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('santri_arsip').delete().eq('id', arsipId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/santri/arsip')
  return { success: true }
}

// Hapus banyak arsip sekaligus
export async function hapusArsipMassal(arsipIds: string[]) {
  const supabase = await createClient()
  if (!arsipIds || arsipIds.length === 0) return { error: "Pilih minimal 1 data" }
  const { error } = await supabase.from('santri_arsip').delete().in('id', arsipIds)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/santri/arsip')
  return { success: true, count: arsipIds.length }
}