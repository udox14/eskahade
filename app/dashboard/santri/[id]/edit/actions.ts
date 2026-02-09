'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getSantriById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('santri').select('*').eq('id', id).single()
  return { data, error }
}

export async function updateSantri(id: string, formData: FormData) {
  const supabase = await createClient()

  const dataUpdate = {
    nis: formData.get('nis') as string,
    nama_lengkap: formData.get('nama_lengkap') as string,
    nik: formData.get('nik') as string,
    tempat_lahir: formData.get('tempat_lahir') as string,
    tanggal_lahir: formData.get('tanggal_lahir') as string,
    jenis_kelamin: formData.get('jenis_kelamin') as string,
    nama_ayah: formData.get('nama_ayah') as string,
    nama_ibu: formData.get('nama_ibu') as string,
    alamat: formData.get('alamat') as string,
    status_global: formData.get('status_global') as string,
    // SEKOLAH
    sekolah: formData.get('sekolah') as string,
    kelas_sekolah: formData.get('kelas_sekolah') as string,
    // ASRAMA & KAMAR
    asrama: formData.get('asrama') as string,
    kamar: formData.get('kamar') as string,
  }

  const { error } = await supabase
    .from('santri')
    .update(dataUpdate)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/santri')
  revalidatePath(`/dashboard/santri/${id}`)
  
  redirect('/dashboard/santri')
}