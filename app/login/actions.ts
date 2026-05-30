'use server'

import { queryOne } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { ensureUserStructuralJabatanColumn, setSession } from '@/lib/auth/session'
import { getRequestAuditContext, logActivity } from '@/lib/activity-log'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const normalizedEmail = String(email || '').toLowerCase().trim()
  const requestInfo = await getRequestAuditContext()

  console.log('[LOGIN] Step 1: email=', email ? email.substring(0, 5) + '***' : 'EMPTY')

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' }
  }

  let user: {
    id: string
    email: string
    password_hash: string
    full_name: string
    role: string
    roles: string | null
    asrama_binaan: string | null
    structural_jabatan: string | null
  } | null = null

  try {
    await ensureUserStructuralJabatanColumn()
    user = await queryOne(
      'SELECT id, email, password_hash, full_name, role, roles, asrama_binaan, structural_jabatan FROM users WHERE email = ?',
      [normalizedEmail]
    )
    console.log('[LOGIN] Step 2: user found=', !!user, 'role=', user?.role)
  } catch (err: any) {
    console.error('[LOGIN] Step 2 ERROR:', err?.message)
    return { error: 'Gagal terhubung ke database. Coba lagi nanti.' }
  }

  if (!user) {
    console.log('[LOGIN] Step 2: user NOT FOUND')
    await logActivity({
      actor: { email: normalizedEmail },
      module: 'auth',
      action: 'login',
      entityType: 'session',
      entityLabel: normalizedEmail || 'unknown',
      summary: `Login gagal untuk ${normalizedEmail || 'email kosong'}`,
      details: { reason: 'user_not_found', email: normalizedEmail },
      status: 'failed',
      requestInfo,
    })
    return { error: 'Email atau Password salah.' }
  }

  let valid = false
  try {
    console.log('[LOGIN] Step 3: hash preview=', user.password_hash?.substring(0, 10))
    valid = await verifyPassword(password, user.password_hash)
    console.log('[LOGIN] Step 3: password valid=', valid)
  } catch (err: any) {
    console.error('[LOGIN] Step 3 ERROR:', err?.message)
    return { error: 'Terjadi kesalahan saat verifikasi. Coba lagi.' }
  }

  if (!valid) {
    await logActivity({
      actor: { id: user.id, name: user.full_name, email: user.email, roles: [user.role] },
      module: 'auth',
      action: 'login',
      entityType: 'session',
      entityId: user.id,
      entityLabel: user.full_name || user.email,
      summary: `Login gagal untuk ${user.full_name || user.email}`,
      details: { reason: 'invalid_password', email: user.email },
      status: 'failed',
      requestInfo,
    })
    return { error: 'Email atau Password salah.' }
  }

  // Parse multi-role: jika kolom roles ada (JSON array), gunakan itu.
  // Jika null/kosong, fallback ke [role].
  let rolesArray: string[] = []
  try {
    if (user.roles) {
      rolesArray = JSON.parse(user.roles)
      if (!Array.isArray(rolesArray) || rolesArray.length === 0) {
        rolesArray = [user.role]
      }
    } else {
      rolesArray = [user.role]
    }
  } catch {
    rolesArray = [user.role]
  }

  try {
    console.log('[LOGIN] Step 4: setting session for roles=', rolesArray)
    await setSession({
      id: user.id,
      email: user.email,
      full_name: user.full_name || '',
      role: rolesArray[0],        // role utama = elemen pertama
      roles: rolesArray,          // semua role
      asrama_binaan: user.asrama_binaan,
      structural_jabatan: user.structural_jabatan,
    })
    console.log('[LOGIN] Step 4: session set OK')
  } catch (err: any) {
    console.error('[LOGIN] Step 4 ERROR:', err?.message)
    return { error: 'Gagal menyimpan sesi: ' + err?.message }
  }

  await logActivity({
    actor: {
      id: user.id,
      name: user.full_name,
      email: user.email,
      roles: rolesArray,
    },
    module: 'auth',
    action: 'login',
    entityType: 'session',
    entityId: user.id,
    entityLabel: user.full_name || user.email,
    summary: 'Login berhasil',
    details: {
      email: user.email,
      primary_role: rolesArray[0],
    },
    status: 'success',
    requestInfo,
  })

  console.log('[LOGIN] Step 5: redirecting to /dashboard')
  redirect('/dashboard')
}
