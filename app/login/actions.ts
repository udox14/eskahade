'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // 1. Ambil data dari form
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  console.log("Mencoba login dengan:", email) // Debugging Log

  // 2. Kirim ke Supabase Auth
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Tampilkan error asli di Terminal VS Code agar kita tahu penyebabnya
    console.error("LOGIN GAGAL:", error.message)
    
    // Redirect kembali ke login dengan pesan error
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  console.log("Login Berhasil!")

  // 3. Jika sukses, refresh halaman dan pindah ke dashboard
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}