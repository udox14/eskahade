import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { queryOne } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import {
  createJWTToken,
  ensureUserStructuralJabatanColumn,
  SESSION_COOKIE,
  STAFF_SESSION_COOKIE_MAX_AGE,
} from '@/lib/auth/session'
import { logActivity } from '@/lib/activity-log'

type LoginUserRow = {
  id: string
  email: string
  password_hash: string
  full_name: string
  role: string
  roles: string | null
  asrama_binaan: string | null
  structural_jabatan: string | null
}

/**
 * Mencari akun demo pada database sandbox (DEMO_DB).
 *
 * Kenapa perlu terpisah: getDB() hanya mengarahkan query ke DEMO_DB ketika request
 * SUDAH membawa cookie session ber-role 'demo' (lihat lib/auth/demo-context.ts).
 * Pada saat login cookie itu belum ada, sehingga query biasa selalu membaca DB
 * produksi dan akun demo tidak akan pernah ditemukan — rute login jadi masalah
 * ayam-telur.
 *
 * Pengaman:
 *  - HANYA dijalankan bila akun tidak ditemukan di DB utama;
 *  - akun yang ditemukan WAJIB ber-role 'demo'. Akun non-demo di DEMO_DB ditolak,
 *    sehingga DEMO_DB tidak bisa dipakai untuk masuk sebagai admin/bendahara asli.
 */
async function findDemoAccount(email: string): Promise<LoginUserRow | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const demoDb = (env as { DEMO_DB?: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: () => Promise<unknown> } } } }).DEMO_DB
    if (!demoDb) return null

    const row = (await demoDb
      .prepare(
        'SELECT id, email, password_hash, full_name, role, roles, asrama_binaan, structural_jabatan FROM users WHERE email = ?'
      )
      .bind(email)
      .first()) as LoginUserRow | null

    if (!row) return null

    const hasDemoRole =
      row.role === 'demo' ||
      (() => {
        try {
          const parsed = row.roles ? JSON.parse(row.roles) : []
          return Array.isArray(parsed) && parsed.includes('demo')
        } catch {
          return false
        }
      })()

    return hasDemoRole ? row : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body
    const requestInfo = {
      ipAddress: request.headers.get('cf-connecting-ip')
        ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? null,
      userAgent: request.headers.get('user-agent'),
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi.' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    await ensureUserStructuralJabatanColumn()
    let user = await queryOne<LoginUserRow>(
      'SELECT id, email, password_hash, full_name, role, roles, asrama_binaan, structural_jabatan FROM users WHERE email = ?',
      [normalizedEmail]
    )

    // Fallback khusus akun demo (lihat findDemoAccount).
    // Login dari sandbox ditandai pada token agar hak tulis hanya berlaku di sandbox.
    let loggedInFromSandbox = false
    if (!user) {
      user = await findDemoAccount(normalizedEmail)
      loggedInFromSandbox = Boolean(user)
    }

    if (!user) {
      await logActivity({
        actor: { email: normalizedEmail },
        module: 'auth',
        action: 'login',
        entityType: 'session',
        entityLabel: normalizedEmail,
        summary: `Login gagal untuk ${normalizedEmail}`,
        details: { reason: 'user_not_found', email: normalizedEmail, channel: 'api' },
        status: 'failed',
        requestInfo,
      })
      const failResponse = NextResponse.json(
        { error: 'Email atau Password salah.' },
        { status: 401 }
      )
      failResponse.cookies.delete(SESSION_COOKIE)
      return failResponse
    }

    let valid = await verifyPassword(password, user.password_hash)
    if (!valid && password.trim() !== password) {
      valid = await verifyPassword(password.trim(), user.password_hash)
    }
    if (!valid) {
      await logActivity({
        actor: { id: user.id, name: user.full_name, email: user.email },
        module: 'auth',
        action: 'login',
        entityType: 'session',
        entityId: user.id,
        entityLabel: user.full_name || user.email,
        summary: `Login gagal untuk ${user.full_name || user.email}`,
        details: { reason: 'invalid_password', email: user.email, channel: 'api' },
        status: 'failed',
        requestInfo,
      })
      const failResponse = NextResponse.json(
        { error: 'Email atau Password salah.' },
        { status: 401 }
      )
      failResponse.cookies.delete(SESSION_COOKIE)
      return failResponse
    }

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

    const token = await createJWTToken({
      id: user.id,
      email: user.email,
      full_name: user.full_name || '',
      role: rolesArray[0],
      roles: rolesArray,
      asrama_binaan: user.asrama_binaan,
      structural_jabatan: user.structural_jabatan,
      // Selalu eksplisit: true hanya bila akun ini benar-benar berasal dari DEMO_DB.
      // Akun ber-role 'demo' yang ada di DB produksi TIDAK mendapat tanda ini,
      // sehingga hak tulisnya tetap ditolak.
      demoSandbox: loggedInFromSandbox,
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: STAFF_SESSION_COOKIE_MAX_AGE,
    })

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
      details: { email: user.email, primary_role: rolesArray[0], channel: 'api' },
      status: 'success',
      requestInfo,
    })

    return response

  } catch (err: any) {
    console.error('[API Login Error]', err?.message)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server.' },
      { status: 500 }
    )
  }
}
