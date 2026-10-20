import { NextRequest, NextResponse } from 'next/server'
import { findLoginAccount } from '@/lib/auth/login-account'
import { verifyPassword } from '@/lib/auth/password'
import {
  createJWTToken,
  SESSION_COOKIE,
  STAFF_SESSION_COOKIE_MAX_AGE,
} from '@/lib/auth/session'
import { logActivity } from '@/lib/activity-log'

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !('email' in body) || typeof body.email !== 'string'
      || !('password' in body) || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 })
    }
    const { email, password } = body
    const requestInfo = {
      ipAddress: request.headers.get('cf-connecting-ip')
        ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? null,
      userAgent: request.headers.get('user-agent'),
    }

    if (!email.trim() || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi.' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    const account = await findLoginAccount(normalizedEmail)
    const user = account?.user ?? null
    const loggedInFromSandbox = account?.demoSandbox ?? false

    if (!account || !user) {
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
      // Worker environment, never the previous cookie, determines this identity.
      demoSandbox: loggedInFromSandbox,
      environment: account.environment,
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
