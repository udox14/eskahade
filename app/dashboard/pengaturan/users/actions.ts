'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Ambil semua user profile + EMAIL
export async function getUsersList() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY belum disetting di .env.local")
    return []
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 1. Ambil data Profile
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (profileError || !profiles) return []

  // 2. Ambil data Auth Users
  const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  })

  if (authError) {
    console.error("Gagal ambil data auth:", authError)
    return profiles 
  }

  // 3. Gabungkan Data
  const mergedData = profiles.map(p => {
    const userAuth = authUsers.find(u => u.id === p.id)
    return {
      ...p,
      email: userAuth?.email || 'Email tidak ditemukan'
    }
  })
  
  return mergedData
}

// Update Role User
export async function updateUserRole(id: string, newRole: string, asrama?: string) {
  const supabase = await createClient()
  
  const updateData: any = { role: newRole }
  
  if (newRole === 'pengurus_asrama') {
    updateData.asrama_binaan = asrama
  } else {
    updateData.asrama_binaan = null
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

// Tambah User (Admin Only)
export async function createUser(formData: FormData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Server Key Error: SUPABASE_SERVICE_ROLE_KEY belum disetting." }
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as string
  const asrama = formData.get('asrama_binaan') as string

  // 1. Buat User di Auth Supabase
  const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })

  if (authError) return { error: authError.message }
  if (!user.user) return { error: "Gagal membuat user" }

  // 2. Update Profile
  const profileData: any = { 
    id: user.user.id,
    full_name: fullName,
    role: role
  }

  if (role === 'pengurus_asrama') {
    profileData.asrama_binaan = asrama
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert(profileData)

  if (profileError) {
    console.error("Gagal update profile:", profileError)
  }

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

// BARU: Tambah User Batch dari Excel
export async function createUsersBatch(usersData: any[]) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: "Server Key Error: SUPABASE_SERVICE_ROLE_KEY belum disetting." }
    }
  
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  
    let successCount = 0
    let errors: string[] = []
  
    // Loop dan proses satu per satu (agar jika satu gagal, yang lain tetap lanjut)
    for (const u of usersData) {
        // Validasi dasar
        if (!u.email || !u.password || !u.full_name) {
            errors.push(`Data tidak lengkap untuk ${u.full_name || 'Tanpa Nama'}`)
            continue
        }

        // 1. Create Auth User
        const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: String(u.password), // Pastikan string
            email_confirm: true,
            user_metadata: { full_name: u.full_name }
        })

        if (authError) {
            errors.push(`Gagal buat user ${u.email}: ${authError.message}`)
            continue
        }

        if (user.user) {
            // 2. Upsert Profile
            const profileData: any = {
                id: user.user.id,
                full_name: u.full_name,
                role: u.role || 'wali_kelas'
            }

            if (u.role === 'pengurus_asrama' && u.asrama_binaan) {
                profileData.asrama_binaan = u.asrama_binaan
            }

            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert(profileData)

            if (profileError) {
                errors.push(`User ${u.email} dibuat, tapi gagal set profil: ${profileError.message}`)
            } else {
                successCount++
            }
        }
    }
  
    revalidatePath('/dashboard/pengaturan/users')
    return { 
        success: true, 
        count: successCount, 
        errors: errors.length > 0 ? errors : null 
    }
  }

// Edit Detail User
export async function updateUserDetails(userId: string, fullName: string, email: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Server Key Error" }
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { 
      email: email, 
      email_confirm: true,
      user_metadata: { full_name: fullName } 
    }
  )

  if (authError) return { error: "Auth Error: " + authError.message }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId)

  if (profileError) return { error: "Profile Error: " + profileError.message }

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

// Reset Password
export async function resetUserPassword(userId: string, newPassword: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Server Key Error" }
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  )

  if (error) return { error: error.message }
  
  return { success: true }
}

// Hapus User
export async function deleteUser(userId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Server Key Error" }
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}