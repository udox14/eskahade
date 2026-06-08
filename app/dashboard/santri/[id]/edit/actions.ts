'use server'

import { query, queryOne } from '@/lib/db'
import { assertCrud } from '@/lib/auth/crud'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, diffWhitelistedFields, logActivity } from '@/lib/activity-log'
import { normalizeKategoriSantriDasar } from '@/lib/santri/kategori'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getSantriById(id: string) {
  const data = await queryOne('SELECT * FROM santri WHERE id = ?', [id])
  return { data, error: data ? null : 'Santri tidak ditemukan' }
}

export async function getKelasPesantrenList() {
  const data = await query<{ id: string; nama_kelas: string }>(`
    SELECT k.id, k.nama_kelas
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `)

  return data.sort((a, b) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function getKelasAktifSantri(santriId: string) {
  return queryOne<{ riwayat_id: string; kelas_id: string; nama_kelas: string }>(
    `SELECT rp.id AS riwayat_id, k.id AS kelas_id, k.nama_kelas
     FROM riwayat_pendidikan rp
     JOIN kelas k ON k.id = rp.kelas_id
     WHERE rp.santri_id = ? AND rp.status_riwayat = 'aktif'
     ORDER BY rp.created_at DESC
     LIMIT 1`,
    [santriId]
  )
}

export async function updateSantri(id: string, formData: FormData) {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  const session = await getSession()

  const beforeSantri = await queryOne<Record<string, unknown>>(
    `SELECT id, nis, nama_lengkap, nik, tempat_lahir, tanggal_lahir, jenis_kelamin,
            nama_ayah, nama_ibu, alamat, gol_darah, alamat_lengkap, kecamatan, kab_kota,
            provinsi, jemaah, no_wa_ortu, tanggal_masuk, tanggal_keluar, kategori_santri,
            sekolah, kelas_sekolah, asrama, kamar
     FROM santri
     WHERE id = ?`,
    [id]
  )
  if (!beforeSantri) return { error: 'Santri tidak ditemukan.' }

  const beforeKelas = await getKelasAktifSantri(id)
  const now = new Date().toISOString()
  const kategoriSantri = normalizeKategoriSantriDasar(formData.get('kategori_santri'))
  const sekolah = kategoriSantri === 'SADESA' ? null : formData.get('sekolah') || null
  const kelasSekolah = kategoriSantri === 'SADESA' ? null : formData.get('kelas_sekolah') || null
  const kelasPesantrenId = String(formData.get('kelas_pesantren_id') || '').trim()
  const afterSantri = {
    nis: formData.get('nis'),
    nama_lengkap: formData.get('nama_lengkap'),
    nik: formData.get('nik') || null,
    tempat_lahir: formData.get('tempat_lahir') || null,
    tanggal_lahir: formData.get('tanggal_lahir') || null,
    jenis_kelamin: formData.get('jenis_kelamin'),
    nama_ayah: formData.get('nama_ayah') || null,
    nama_ibu: formData.get('nama_ibu') || null,
    alamat: formData.get('alamat') || null,
    gol_darah: formData.get('gol_darah') || null,
    alamat_lengkap: formData.get('alamat_lengkap') || null,
    kecamatan: formData.get('kecamatan') || null,
    kab_kota: formData.get('kab_kota') || null,
    provinsi: formData.get('provinsi') || null,
    jemaah: formData.get('jemaah') || null,
    no_wa_ortu: formData.get('no_wa_ortu') || null,
    tanggal_masuk: formData.get('tanggal_masuk') || null,
    tanggal_keluar: formData.get('tanggal_keluar') || null,
    kategori_santri: kategoriSantri,
    sekolah,
    kelas_sekolah: kelasSekolah,
    asrama: formData.get('asrama') || null,
    kamar: formData.get('kamar') || null,
  }
  const afterKelas = kelasPesantrenId
    ? await queryOne<{ id: string; nama_kelas: string }>('SELECT id, nama_kelas FROM kelas WHERE id = ?', [kelasPesantrenId])
    : null

  if (kelasPesantrenId && !afterKelas) return { error: 'Kelas pesantren tidak ditemukan.' }

  await query(
    `UPDATE santri SET
      nis = ?, nama_lengkap = ?, nik = ?, tempat_lahir = ?, tanggal_lahir = ?,
      jenis_kelamin = ?, nama_ayah = ?, nama_ibu = ?, alamat = ?,
      gol_darah = ?, alamat_lengkap = ?, kecamatan = ?, kab_kota = ?, provinsi = ?,
      jemaah = ?, no_wa_ortu = ?, tanggal_masuk = ?, tanggal_keluar = ?,
      kategori_santri = ?, sekolah = ?, kelas_sekolah = ?, asrama = ?, kamar = ?, updated_at = ?
    WHERE id = ?`,
    [
      formData.get('nis'), formData.get('nama_lengkap'), formData.get('nik') || null,
      formData.get('tempat_lahir') || null, formData.get('tanggal_lahir') || null,
      formData.get('jenis_kelamin'),
      formData.get('nama_ayah') || null, formData.get('nama_ibu') || null,
      formData.get('alamat') || null,
      formData.get('gol_darah') || null,
      formData.get('alamat_lengkap') || null,
      formData.get('kecamatan') || null,
      formData.get('kab_kota') || null,
      formData.get('provinsi') || null,
      formData.get('jemaah') || null,
      formData.get('no_wa_ortu') || null,
      formData.get('tanggal_masuk') || null,
      formData.get('tanggal_keluar') || null,
      kategoriSantri, sekolah, kelasSekolah,
      formData.get('asrama') || null, formData.get('kamar') || null,
      now, id
    ]
  )

  const beforeKelasId = beforeKelas?.kelas_id ?? ''
  if (kelasPesantrenId !== beforeKelasId) {
    await query(
      "UPDATE riwayat_pendidikan SET status_riwayat = 'pindah' WHERE santri_id = ? AND status_riwayat = 'aktif'",
      [id]
    )

    if (kelasPesantrenId) {
      await query(
        'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), id, kelasPesantrenId, 'aktif', now]
      )
    }
  }

  const changedFields = diffWhitelistedFields(beforeSantri, afterSantri, [
    'nis',
    'nama_lengkap',
    'nik',
    'tempat_lahir',
    'tanggal_lahir',
    'jenis_kelamin',
    'nama_ayah',
    'nama_ibu',
    'alamat',
    'gol_darah',
    'alamat_lengkap',
    'kecamatan',
    'kab_kota',
    'provinsi',
    'jemaah',
    'no_wa_ortu',
    'tanggal_masuk',
    'tanggal_keluar',
    'kategori_santri',
    'sekolah',
    'kelas_sekolah',
    'asrama',
    'kamar',
  ])
  if (kelasPesantrenId !== beforeKelasId) {
    changedFields.kelas_pesantren = {
      before: beforeKelas?.nama_kelas ?? null,
      after: afterKelas?.nama_kelas ?? null,
    }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'santri',
    action: 'update',
    fiturHref: '/dashboard/santri',
    logKind: 'update',
    entityType: 'santri',
    entityId: id,
    entityLabel: String(beforeSantri.nama_lengkap || afterSantri.nama_lengkap || id),
    summary: `Memperbarui data santri ${String(beforeSantri.nama_lengkap || afterSantri.nama_lengkap || id)}`,
    details: {
      changed_fields: changedFields,
    },
  })

  const redirectTo = String(formData.get('redirect_to') || '')
  const target = redirectTo === '/dashboard/psb' ? redirectTo : '/dashboard/santri'

  revalidatePath('/dashboard/santri')
  revalidatePath('/dashboard/santri/atur-kelas')
  revalidatePath('/dashboard/psb')
  revalidatePath(`/dashboard/santri/${id}`)
  redirect(target)
}
