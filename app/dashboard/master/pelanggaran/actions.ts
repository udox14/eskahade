'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function tambahJenisPelanggaran(formData: FormData) {
  const supabase = await createClient()

  const kategori = formData.get('kategori')
  const nama = formData.get('nama_pelanggaran')
  const poin = formData.get('poin')

  const { error } = await supabase.from('master_pelanggaran').insert({
    kategori,
    nama_pelanggaran: nama,
    poin: Number(poin)
  })

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/pelanggaran')
  return { success: true }
}

export async function hapusJenisPelanggaran(id: number) {
  const supabase = await createClient()
  await supabase.from('master_pelanggaran').delete().eq('id', id)
  revalidatePath('/dashboard/master/pelanggaran')
}