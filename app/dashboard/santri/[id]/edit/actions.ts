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

  const now = new Date().toISOString()
  const kategoriSantri = normalizeKategoriSantriDasar(formData.get('kategori_santri'))
  const sekolah = kategoriSantri === 'SADESA' ? null : formData.get('sekolah') || null
  const kelasSekolah = kategoriSantri === 'SADESA' ? null : formData.get('kelas_sekolah') || null
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
      changed_fields: diffWhitelistedFields(beforeSantri, afterSantri, [
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
      ]),
    },
  })

  const redirectTo = String(formData.get('redirect_to') || '')
  const target = redirectTo === '/dashboard/psb' ? redirectTo : '/dashboard/santri'

  revalidatePath('/dashboard/santri')
  revalidatePath('/dashboard/psb')
  revalidatePath(`/dashboard/santri/${id}`)
  redirect(target)
}
