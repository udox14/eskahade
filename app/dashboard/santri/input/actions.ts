'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { assertCrud } from '@/lib/auth/crud'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { normalizeKategoriSantriDasar } from '@/lib/santri/kategori'
import { revalidatePath } from 'next/cache'

type SantriImportData = {
  nis: string | number
  nama_lengkap: string
  nik?: string | number
  jenis_kelamin?: string | number
  tempat_lahir?: string
  tanggal_lahir?: string
  nama_ayah?: string
  nama_ibu?: string
  alamat?: string
  gol_darah?: string
  alamat_lengkap?: string
  kecamatan?: string
  kab_kota?: string
  provinsi?: string
  jemaah?: string
  no_wa_ortu?: string | number
  tanggal_masuk?: string
  tanggal_keluar?: string
  kategori_santri?: string
  sekolah?: string
  kelas_sekolah?: string
  asrama?: string
  kamar?: string | number
  kelas_pesantren?: string
  nama_tempat_makan?: string   // nama penyedia jasa makan (auto-create di master_jasa)
  nama_tempat_cuci?: string    // nama penyedia jasa cuci (auto-create di master_jasa)
}

function normalizeJenisKelamin(value: unknown): 'L' | 'P' | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '')

  if (['l', 'lk', 'laki', 'lakilaki', 'male', 'm'].includes(normalized)) return 'L'
  if (['p', 'pr', 'perempuan', 'wanita', 'female', 'f'].includes(normalized)) return 'P'
  return null
}

/**
 * Cari jasa berdasarkan nama & jenis. Jika belum ada, buat baru.
 * Return: id dari master_jasa
 */
async function upsertJasa(nama: string, jenis: 'Makan' | 'Cuci'): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM master_jasa WHERE LOWER(nama_jasa) = LOWER(?) AND jenis = ?',
    [nama.trim(), jenis]
  )
  if (existing) return existing.id
  const id = generateId()
  await execute(
    'INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?)',
    [id, nama.trim(), jenis]
  )
  return id
}

export async function getKelasList() {
  const data = await query<{ id: string; nama_kelas: string }>(`
    SELECT k.id, k.nama_kelas
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `)
  return data.sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' }))
}

export async function importSantriMassal(dataSantri: SantriImportData[]): Promise<{ success: boolean; count: number; updated: number; skipped: number } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'create')
  if ('error' in access) return access
  const session = await getSession()
  if (!dataSantri || dataSantri.length === 0) return { error: 'Data kosong tidak bisa disimpan.' }

  const kelasList = await query<{ id: string; nama_kelas: string }>(`
    SELECT k.id, k.nama_kelas
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `)
  const mapKelas = new Map(kelasList.map(k => [k.nama_kelas.trim().toLowerCase(), k.id]))

  const tahunMasukDefault = new Date().getFullYear()

  const invalidJenisKelamin = dataSantri
    .map((s, index) => ({ row: index + 2, nis: s.nis, nama: s.nama_lengkap, value: s.jenis_kelamin }))
    .filter(s => !normalizeJenisKelamin(s.value))

  if (invalidJenisKelamin.length > 0) {
    const preview = invalidJenisKelamin
      .slice(0, 5)
      .map(s => `baris ${s.row} (${s.nis || s.nama || '-'}): "${s.value ?? ''}"`)
      .join(', ')
    return {
      error: `Jenis kelamin tidak valid. Gunakan L/P atau Laki-laki/Perempuan. Cek ${preview}${invalidJenisKelamin.length > 5 ? ', ...' : ''}.`,
    }
  }

  const cleanData = dataSantri.map(s => ({
    id: crypto.randomUUID(),
    nis: String(s.nis).trim(),
    nama_lengkap: String(s.nama_lengkap).trim(),
    nik: s.nik ? String(s.nik).trim() : null,
    jenis_kelamin: normalizeJenisKelamin(s.jenis_kelamin)!,
    tempat_lahir: s.tempat_lahir || null,
    tanggal_lahir: s.tanggal_lahir || null,
    nama_ayah: s.nama_ayah || null,
    nama_ibu: s.nama_ibu || null,
    alamat: s.alamat || null,
    gol_darah: s.gol_darah ? String(s.gol_darah).toUpperCase().trim() : null,
    alamat_lengkap: s.alamat_lengkap || null,
    kecamatan: s.kecamatan || null,
    kab_kota: s.kab_kota || null,
    provinsi: s.provinsi || null,
    jemaah: s.jemaah || null,
    no_wa_ortu: s.no_wa_ortu ? String(s.no_wa_ortu).trim() : null,
    tanggal_masuk: s.tanggal_masuk || `${tahunMasukDefault}-01-01`,
    tanggal_keluar: s.tanggal_keluar || null,
    status_global: 'aktif',
    kategori_santri: normalizeKategoriSantriDasar(s.kategori_santri ?? s.sekolah),
    sekolah: s.sekolah ? String(s.sekolah).toUpperCase().trim() : null,
    kelas_sekolah: s.kelas_sekolah ? String(s.kelas_sekolah).trim() : null,
    asrama: s.asrama ? String(s.asrama).toUpperCase().trim() : null,
    kamar: s.kamar ? String(s.kamar).trim() : null,
    kelas_pesantren: s.kelas_pesantren ? String(s.kelas_pesantren).trim() : null,
    nama_tempat_makan: s.nama_tempat_makan ? String(s.nama_tempat_makan).trim() : null,
    nama_tempat_cuci: s.nama_tempat_cuci ? String(s.nama_tempat_cuci).trim() : null,
  }))

  // ── Guard: cegah upsert-by-NIS yang destruktif ──────────────────────────
  // NIS adalah satu-satunya kunci pencocokan. NIS kosong/garbage bisa "cocok"
  // dengan santri lain yang NIS-nya juga kosong → row-nya ketimpa (nama, dst
  // hilang). NIS duplikat di dalam file juga bisa menimpa satu sama lain.
  // Tolak dua kondisi itu sebelum menyentuh DB.
  const invalidNis = cleanData
    .map((s, i) => ({ row: i + 2, nama: s.nama_lengkap, nis: s.nis }))
    .filter(s => !s.nis || s.nis === 'null' || s.nis === 'undefined')
  if (invalidNis.length > 0) {
    const preview = invalidNis.slice(0, 5).map(s => `baris ${s.row} (${s.nama || '-'})`).join(', ')
    return {
      error: `NIS wajib diisi — import dibatalkan agar data lain tidak tertimpa. ${invalidNis.length} baris tanpa NIS: ${preview}${invalidNis.length > 5 ? ', ...' : ''}.`,
    }
  }
  const nisSeen = new Map<string, number>()
  const dupNis: { row: number; nis: string }[] = []
  cleanData.forEach((s, i) => {
    const prev = nisSeen.get(s.nis)
    if (prev !== undefined) dupNis.push({ row: i + 2, nis: s.nis })
    else nisSeen.set(s.nis, i + 2)
  })
  if (dupNis.length > 0) {
    const preview = dupNis.slice(0, 5).map(s => `NIS ${s.nis} (baris ${s.row})`).join(', ')
    return {
      error: `NIS duplikat di dalam file — import dibatalkan agar data tidak saling menimpa. ${preview}${dupNis.length > 5 ? ', ...' : ''}.`,
    }
  }

  const now = new Date().toISOString()

  // ── OPTIMASI: Fetch semua santri yg NIS-nya ada di batch ini dalam 1 query ──
  const nisList = cleanData.map(s => s.nis)
  const placeholders = nisList.map(() => '?').join(',')
  const existingSantri = await query<Record<string, any>>(
    `SELECT id, nis, nama_lengkap, nik, jenis_kelamin, tempat_lahir, tanggal_lahir,
      nama_ayah, nama_ibu, alamat, gol_darah, alamat_lengkap,
      kecamatan, kab_kota, provinsi, jemaah, no_wa_ortu,
      tanggal_masuk, tanggal_keluar, kategori_santri, sekolah, kelas_sekolah,
      asrama, kamar, tempat_makan_id, tempat_mencuci_id
    FROM santri WHERE nis IN (${placeholders})`,
    nisList
  )
  const existingMap = new Map(existingSantri.map(s => [String(s.nis), s]))

  // Fetch riwayat pendidikan aktif untuk santri yang sudah ada (untuk cek kelas)
  const existingIds = existingSantri.map(s => s.id)
  let riwayatMap = new Map<string, string>() // santri_id → kelas_id
  if (existingIds.length > 0) {
    const riwayatPlaceholders = existingIds.map(() => '?').join(',')
    const riwayatData = await query<{ santri_id: string; kelas_id: string }>(
      `SELECT santri_id, kelas_id FROM riwayat_pendidikan 
       WHERE santri_id IN (${riwayatPlaceholders}) AND status_riwayat = 'aktif'`,
      existingIds
    )
    riwayatMap = new Map(riwayatData.map(r => [r.santri_id, r.kelas_id]))
  }

  // ── Resolve semua jasa (makan/cuci) dulu, kumpulkan unique names ──
  const uniqueMakan = new Set<string>()
  const uniqueCuci = new Set<string>()
  for (const s of cleanData) {
    if (s.nama_tempat_makan) uniqueMakan.add(s.nama_tempat_makan)
    if (s.nama_tempat_cuci) uniqueCuci.add(s.nama_tempat_cuci)
  }
  const jasaIdMap = new Map<string, string>() // "Makan:nama" atau "Cuci:nama" → id
  for (const nama of uniqueMakan) {
    jasaIdMap.set(`Makan:${nama}`, await upsertJasa(nama, 'Makan'))
  }
  for (const nama of uniqueCuci) {
    jasaIdMap.set(`Cuci:${nama}`, await upsertJasa(nama, 'Cuci'))
  }

  // Kolom-kolom yang akan di-compare & update
  const UPDATABLE_FIELDS = [
    'nama_lengkap', 'nik', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir',
    'nama_ayah', 'nama_ibu', 'alamat', 'gol_darah', 'alamat_lengkap',
    'kecamatan', 'kab_kota', 'provinsi', 'jemaah', 'no_wa_ortu',
    'tanggal_masuk', 'tanggal_keluar', 'kategori_santri', 'sekolah', 'kelas_sekolah',
    'asrama', 'kamar', 'tempat_makan_id', 'tempat_mencuci_id',
  ] as const

  // ── Kumpulkan semua statements untuk di-batch ──
  const statements: { sql: string; params?: unknown[] }[] = []
  // Audit nilai-sebelum tiap UPDATE, biar overwrite bisa di-rollback manual
  // dari activity log (bukan cuma angka agregat).
  const auditUpdates: Array<{
    id: string
    nis: string
    nama_lama: string | null
    perubahan: Record<string, { dari: any; ke: any }>
  }> = []
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const s of cleanData) {
    const tempat_makan_id = s.nama_tempat_makan ? (jasaIdMap.get(`Makan:${s.nama_tempat_makan}`) ?? null) : null
    const tempat_mencuci_id = s.nama_tempat_cuci ? (jasaIdMap.get(`Cuci:${s.nama_tempat_cuci}`) ?? null) : null
    const sekolah = s.kategori_santri === 'SADESA' ? null : s.sekolah
    const kelasSekolah = s.kategori_santri === 'SADESA' ? null : s.kelas_sekolah
    const tahunMasuk = Number(String(s.tanggal_masuk || '').slice(0, 4)) || tahunMasukDefault

    const existing = existingMap.get(s.nis)

    if (existing) {
      // ── NIS sudah ada → bandingkan & update hanya field yang berbeda ──
      const newValues: Record<string, any> = {
        nama_lengkap: s.nama_lengkap, nik: s.nik, jenis_kelamin: s.jenis_kelamin,
        tempat_lahir: s.tempat_lahir, tanggal_lahir: s.tanggal_lahir,
        nama_ayah: s.nama_ayah, nama_ibu: s.nama_ibu, alamat: s.alamat,
        gol_darah: s.gol_darah, alamat_lengkap: s.alamat_lengkap,
        kecamatan: s.kecamatan, kab_kota: s.kab_kota, provinsi: s.provinsi,
        jemaah: s.jemaah, no_wa_ortu: s.no_wa_ortu,
        tanggal_masuk: s.tanggal_masuk, tanggal_keluar: s.tanggal_keluar,
        kategori_santri: s.kategori_santri, sekolah, kelas_sekolah: kelasSekolah,
        asrama: s.asrama, kamar: s.kamar,
        tempat_makan_id, tempat_mencuci_id,
      }

      const changedFields: string[] = []
      const changedValues: any[] = []

      for (const field of UPDATABLE_FIELDS) {
        const oldVal = existing[field] ?? null
        const newVal = newValues[field] ?? null
        const oldStr = oldVal === null ? null : String(oldVal).trim()
        const newStr = newVal === null ? null : String(newVal).trim()
        if (oldStr !== newStr) {
          changedFields.push(field)
          changedValues.push(newVal)
        }
      }

      if (changedFields.length === 0) {
        skipped++
        continue
      }

      const setClauses = changedFields.map(f => `${f} = ?`).join(', ')
      statements.push({
        sql: `UPDATE santri SET ${setClauses}, updated_at = ? WHERE id = ?`,
        params: [...changedValues, now, existing.id],
      })

      const perubahan: Record<string, { dari: any; ke: any }> = {}
      for (const f of changedFields) perubahan[f] = { dari: existing[f] ?? null, ke: newValues[f] ?? null }
      auditUpdates.push({
        id: existing.id,
        nis: s.nis,
        nama_lama: existing.nama_lengkap ?? null,
        perubahan,
      })

      // Update kelas pesantren jika berubah
      if (s.kelas_pesantren) {
        const kelasId = mapKelas.get(s.kelas_pesantren.toLowerCase())
        if (kelasId) {
          const currentKelasId = riwayatMap.get(existing.id)
          if (currentKelasId !== kelasId) {
            statements.push({
              sql: 'UPDATE riwayat_pendidikan SET status_riwayat = ? WHERE santri_id = ? AND status_riwayat = ?',
              params: ['nonaktif', existing.id, 'aktif'],
            })
            statements.push({
              sql: 'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
              params: [crypto.randomUUID(), existing.id, kelasId, 'aktif', now],
            })
          }
        }
      }

      updated++
    } else {
      // ── NIS belum ada → INSERT baru ──
      statements.push({
        sql: `INSERT INTO santri (
          id, nis, nama_lengkap, nik, jenis_kelamin, tempat_lahir, tanggal_lahir,
          nama_ayah, nama_ibu, alamat,
          gol_darah, alamat_lengkap, kecamatan, kab_kota, provinsi,
          jemaah, no_wa_ortu, tanggal_masuk, tanggal_keluar,
          tahun_masuk, status_global, kategori_santri, sekolah, kelas_sekolah, asrama, kamar,
          tempat_makan_id, tempat_mencuci_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          s.id, s.nis, s.nama_lengkap, s.nik, s.jenis_kelamin, s.tempat_lahir, s.tanggal_lahir,
          s.nama_ayah, s.nama_ibu, s.alamat,
          s.gol_darah, s.alamat_lengkap, s.kecamatan, s.kab_kota, s.provinsi,
          s.jemaah, s.no_wa_ortu, s.tanggal_masuk, s.tanggal_keluar,
          tahunMasuk, s.status_global, s.kategori_santri, sekolah, kelasSekolah, s.asrama, s.kamar,
          tempat_makan_id, tempat_mencuci_id,
          now, now,
        ],
      })

      if (s.kelas_pesantren) {
        const kelasId = mapKelas.get(s.kelas_pesantren.toLowerCase())
        if (kelasId) {
          statements.push({
            sql: 'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
            params: [crypto.randomUUID(), s.id, kelasId, 'aktif', now],
          })
        }
      }
      inserted++
    }
  }

  // ── Kirim semua statements ke D1 dalam 1 batch call ──
  try {
    if (statements.length > 0) {
      await batch(statements)
    }
  } catch (err: any) {
    return { error: `Gagal menyimpan batch: ${err.message}` }
  }

  revalidatePath('/dashboard/santri')
  const totalAffected = inserted + updated
  if (totalAffected > 0) {
    const summaryParts: string[] = []
    if (inserted > 0) summaryParts.push(`${inserted} data baru ditambahkan`)
    if (updated > 0) summaryParts.push(`${updated} data diperbarui`)
    if (skipped > 0) summaryParts.push(`${skipped} data tidak berubah`)

    await logActivity({
      actor: actorFromSession(session),
      module: 'santri',
      action: updated > 0 ? 'update' : 'create',
      fiturHref: '/dashboard/santri',
      logKind: updated > 0 ? 'update' : 'create',
      entityType: 'santri_batch',
      entityId: 'import',
      entityLabel: 'Import santri massal',
      summary: `Import santri massal: ${summaryParts.join(', ')}`,
      details: {
        inserted,
        updated,
        skipped,
        attempted: cleanData.length,
        // Nilai-sebelum tiap update (dibatasi 200 baris) untuk audit/rollback
        updates: auditUpdates.slice(0, 200),
      },
    })
  }
  return { success: true, count: inserted, updated, skipped }
}

export async function tambahSantriSatuSatu(data: {
  nis: string
  nama_lengkap: string
  nik?: string
  jenis_kelamin: 'L' | 'P'
  tempat_lahir?: string
  tanggal_lahir?: string
  nama_ayah?: string
  nama_ibu?: string
  alamat?: string
  gol_darah?: string
  alamat_lengkap?: string
  kecamatan?: string
  kab_kota?: string
  provinsi?: string
  jemaah?: string
  no_wa_ortu?: string
  tanggal_masuk?: string
  tanggal_keluar?: string
  kategori_santri?: string
  sekolah?: string
  kelas_sekolah?: string
  asrama?: string
  kamar?: string
  kelas_pesantren?: string
  nama_tempat_makan?: string
  nama_tempat_cuci?: string
}) {
  const access = await assertCrud('/dashboard/santri', 'create')
  if ('error' in access) return access
  const session = await getSession()

  const { nis, nama_lengkap, kelas_pesantren, nama_tempat_makan, nama_tempat_cuci, ...rest } = data
  if (!nis || !nama_lengkap) return { error: 'NIS dan Nama wajib diisi.' }

  const existing = await queryOne('SELECT id FROM santri WHERE nis = ?', [nis.trim()])
  if (existing) return { error: `NIS ${nis} sudah terdaftar di database.` }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const tahunMasuk = new Date().getFullYear()
  const kategoriSantri = normalizeKategoriSantriDasar(data.kategori_santri)
  const tanggalMasuk = rest.tanggal_masuk || `${tahunMasuk}-01-01`
  const tahunMasukEfektif = Number(String(tanggalMasuk).slice(0, 4)) || tahunMasuk
  const sekolah = kategoriSantri === 'SADESA' ? null : rest.sekolah?.toUpperCase().trim() || null
  const kelasSekolah = kategoriSantri === 'SADESA' ? null : rest.kelas_sekolah?.trim() || null

  // Auto-create master_jasa jika diisi
  let tempat_makan_id: string | null = null
  let tempat_mencuci_id: string | null = null
  if (nama_tempat_makan?.trim()) tempat_makan_id = await upsertJasa(nama_tempat_makan, 'Makan')
  if (nama_tempat_cuci?.trim()) tempat_mencuci_id = await upsertJasa(nama_tempat_cuci, 'Cuci')

  await query(
    `INSERT INTO santri (
      id, nis, nama_lengkap, nik, jenis_kelamin, tempat_lahir, tanggal_lahir,
      nama_ayah, nama_ibu, alamat,
      gol_darah, alamat_lengkap, kecamatan, kab_kota, provinsi,
      jemaah, no_wa_ortu, tanggal_masuk, tanggal_keluar,
      tahun_masuk, kategori_santri, sekolah, kelas_sekolah, asrama, kamar,
      tempat_makan_id, tempat_mencuci_id,
      status_global, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, nis.trim(), nama_lengkap.trim(),
      rest.nik?.trim() || null, rest.jenis_kelamin,
      rest.tempat_lahir?.trim() || null, rest.tanggal_lahir || null,
      rest.nama_ayah?.trim() || null, rest.nama_ibu?.trim() || null, rest.alamat?.trim() || null,
      rest.gol_darah?.toUpperCase().trim() || null,
      rest.alamat_lengkap?.trim() || null,
      rest.kecamatan?.trim() || null,
      rest.kab_kota?.trim() || null,
      rest.provinsi?.trim() || null,
      rest.jemaah?.trim() || null,
      rest.no_wa_ortu?.trim() || null,
      tanggalMasuk,
      rest.tanggal_keluar || null,
      tahunMasukEfektif,
      kategoriSantri,
      sekolah,
      kelasSekolah,
      rest.asrama?.toUpperCase().trim() || null,
      rest.kamar?.trim() || null,
      tempat_makan_id, tempat_mencuci_id,
      'aktif', now, now
    ]
  )

  if (kelas_pesantren?.trim()) {
    const kelasData = await queryOne<{ id: string }>(`
      SELECT k.id FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      WHERE LOWER(k.nama_kelas) = LOWER(?)
      LIMIT 1
    `,
      [kelas_pesantren.trim()]
    )
    if (kelasData) {
      await query(
        'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), id, kelasData.id, 'aktif', now]
      )
    }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'santri',
    action: 'create',
    fiturHref: '/dashboard/santri',
    logKind: 'create',
    entityType: 'santri',
    entityId: id,
    entityLabel: nama_lengkap.trim(),
    summary: `Menambahkan santri ${nama_lengkap.trim()}`,
    details: {
      nis: nis.trim(),
      kategori_santri: kategoriSantri,
      sekolah,
      kelas_sekolah: kelasSekolah,
      asrama: rest.asrama?.toUpperCase().trim() || null,
      kamar: rest.kamar?.trim() || null,
      kelas_pesantren: kelas_pesantren?.trim() || null,
    },
  })

  revalidatePath('/dashboard/santri')
  return { success: true }
}
