'use server'

import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    const supabase = await createClient()

    // Login ke Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("Supabase Auth Error:", error.message)
      return { error: "Email atau Password salah." }
    }

    return { success: true }

  } catch (err: any) {
    // Tangkap error koneksi (Fetch Failed / Timeout)
    console.error("Connection Error:", err)

    if (err.message?.includes("fetch failed") || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return { error: "Koneksi ke server database terputus. Periksa internet Anda." }
    }
    
    return { error: "Terjadi kesalahan sistem. Coba lagi nanti." }
  }
}