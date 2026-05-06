import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { createJWTToken } from '@/lib/auth/session'
import { getDemoCredentials, getDemoSessionUser, validateDemoLogin } from '@/lib/auth/demo'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi.' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    const demoCredentials = getDemoCredentials()
    if (normalizedEmail === demoCredentials.email) {
      const validation = validateDemoLogin(password)
      if (!validation.ok) {
        return NextResponse.json(
          { error: validation.error },
          { status: validation.error === 'Email atau Password salah.' ? 401 : 400 }
        )
      }

      const demoUser = getDemoSessionUser()
      const token = await createJWTToken(demoUser)

      const demoResponse = NextResponse.json({ success: true, demo: true })
      demoResponse.cookies.set({
        name: 'eskahade_session',
        value: token,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })

      return demoResponse
    }

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
      return NextResponse.json(
        { error: 'Email atau Password salah.' },
        { status: 401 }
      )
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
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

    return response

  } catch (err: any) {
    console.error('[API Login Error]', err?.message)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server.' },
      { status: 500 }
    )
  }
}
