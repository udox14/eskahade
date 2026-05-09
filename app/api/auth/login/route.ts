import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { createJWTToken } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity-log'

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
    const user = await queryOne<{
      id: string
      email: string
      password_hash: string
      full_name: string
      role: string
      roles: string | null
      asrama_binaan: string | null
    }>(
      'SELECT id, email, password_hash, full_name, role, roles, asrama_binaan FROM users WHERE email = ?',
      [normalizedEmail]
    )

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
      return NextResponse.json(
        { error: 'Email atau Password salah.' },
        { status: 401 }
      )
    }

    const valid = await verifyPassword(password, user.password_hash)
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
      return NextResponse.json(
        { error: 'Email atau Password salah.' },
        { status: 401 }
      )
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
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set({
      name: 'eskahade_session',
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
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
