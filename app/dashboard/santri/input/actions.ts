'use server'

import { query, queryOne } from '@/lib/db'
import { revalidatePath } from 'next/cache'

type SantriImportData = {
  nis: string | number
  nama_lengkap: string
  nik?: string | number
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
  no_wa_ortu?: string | number
  tanggal_masuk?: string
  tanggal_keluar?: string
  sekolah?: string
  kelas_sekolah?: string
  asrama?: string
  kamar?: string | number
  kelas_pesantren?: string
}

export async function getKelasList() {
  const data = await query<{ id: string; nama_kelas: string }>('SELECT id, nama_kelas FROM kelas')
  return data.sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' }))
}

export async function importSantriMassal(dataSantri: SantriImportData[]) {
  if (!dataSantri || dataSantri.length === 0) return { error: 'Data kosong tidak bisa disimpan.' }

  const kelasList = await query<{ id: string; nama_kelas: string }>('SELECT id, nama_kelas FROM kelas')
  const mapKelas = new Map(kelasList.map(k => [k.nama_kelas.trim().toLowerCase(), k.id]))

  const tahunMasukDefault = new Date().getFullYear()

  const cleanData = dataSantri.map(s => ({
    id: crypto.randomUUID(),
    nis: String(s.nis).trim(),
    nama_lengkap: String(s.nama_lengkap).trim(),
    nik: s.nik ? String(s.nik).trim() : null,
    jenis_kelamin: String(s.jenis_kelamin).toUpperCase() === 'P' ? 'P' : 'L',
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
    sekolah: s.sekolah ? String(s.sekolah).toUpperCase().trim() : null,
    kelas_sekolah: s.kelas_sekolah ? String(s.kelas_sekolah).trim() : null,
    asrama: s.asrama ? String(s.asrama).toUpperCase().trim() : null,
    kamar: s.kamar ? String(s.kamar).trim() : null,
    kelas_pesantren: s.kelas_pesantren ? String(s.kelas_pesantren).trim() : null,
  }))

  const now = new Date().toISOString()
  let inserted = 0

  for (const s of cleanData) {
    try {
      await query(
        `INSERT INTO santri (
          id, nis, nama_lengkap, nik, jenis_kelamin, tempat_lahir, tanggal_lahir,
          nama_ayah, nama_ibu, alamat,
          gol_darah, alamat_lengkap, kecamatan, kab_kota, provinsi,
          jemaah, no_wa_ortu, tanggal_masuk, tanggal_keluar,
          status_global, sekolah, kelas_sekolah, asrama, kamar, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, s.nis, s.nama_lengkap, s.nik, s.jenis_kelamin, s.tempat_lahir, s.tanggal_lahir,
          s.nama_ayah, s.nama_ibu, s.alamat,
          s.gol_darah, s.alamat_lengkap, s.kecamatan, s.kab_kota, s.provinsi,
          s.jemaah, s.no_wa_ortu, s.tanggal_masuk, s.tanggal_keluar,
          s.status_global, s.sekolah, s.kelas_sekolah, s.asrama, s.kamar, now, now
        ]
      )

      if (s.kelas_pesantren) {
        const kelasId = mapKelas.get(s.kelas_pesantren.toLowerCase())
        if (kelasId) {
          await query(
            'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
            [crypto.randomUUID(), s.id, kelasId, 'aktif', now]
          )
        }
      }
      inserted++
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) return { error: `NIS ${s.nis} sudah terdaftar di database.` }
      return { error: `Gagal menyimpan: ${err.message}` }
    }
  }

  revalidatePath('/dashboard/santri')
  return { success: true, count: inserted }
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
  sekolah?: string
  kelas_sekolah?: string
  asrama?: string
  kamar?: string
  kelas_pesantren?: string
}) {
  const { nis, nama_lengkap, kelas_pesantren, ...rest } = data
  if (!nis || !nama_lengkap) return { error: 'NIS dan Nama wajib diisi.' }

  const existing = await queryOne('SELECT id FROM santri WHERE nis = ?', [nis.trim()])
  if (existing) return { error: `NIS ${nis} sudah terdaftar di database.` }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const tahunMasuk = new Date().getFullYear()

  await query(
    `INSERT INTO santri (
      id, nis, nama_lengkap, nik, jenis_kelamin, tempat_lahir, tanggal_lahir,
      nama_ayah, nama_ibu, alamat,
      gol_darah, alamat_lengkap, kecamatan, kab_kota, provinsi,
      jemaah, no_wa_ortu, tanggal_masuk, tanggal_keluar,
      sekolah, kelas_sekolah, asrama, kamar, status_global, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      rest.tanggal_masuk || `${tahunMasuk}-01-01`,
      rest.tanggal_keluar || null,
      rest.sekolah?.toUpperCase().trim() || null,
      rest.kelas_sekolah?.trim() || null,
      rest.asrama?.toUpperCase().trim() || null,
      rest.kamar?.trim() || null,
      'aktif', now, now
    ]
  )

  if (kelas_pesantren?.trim()) {
    const kelasData = await queryOne<{ id: string }>(
      "SELECT id FROM kelas WHERE LOWER(nama_kelas) = LOWER(?)",
      [kelas_pesantren.trim()]
    )
    if (kelasData) {
      await query(
        'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), id, kelasData.id, 'aktif', now]
      )
    }
  }

  revalidatePath('/dashboard/santri')
  return { success: true }
}
