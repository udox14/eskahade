import { NextRequest, NextResponse } from 'next/server'
import { execute, financeQueryOne, generateId, getFinanceDB, queryOne } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createPortalToken, portalCookieOptions } from '@/lib/portal/session'
import { logActivity } from '@/lib/activity-log'
import { syncFinanceStudentSnapshot } from '@/lib/finance/snapshots'

// Password default saat kredensial belum pernah dibuat: NIS itu sendiri,
// atau tanggal lahir format DDMMYYYY (santri.tanggal_lahir = 'YYYY-MM-DD').
function birthDatePassword(tanggalLahir: string | null): string | null {
  const m = String(tanggalLahir || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return `${m[3]}${m[2]}${m[1]}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const nis = String(body?.nis ?? '').trim()
    const password = String(body?.password ?? '').trim()
    const requestInfo = {
      ipAddress: request.headers.get('cf-connecting-ip')
        ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? null,
      userAgent: request.headers.get('user-agent'),
    }

    if (!nis || !password) {
      return NextResponse.json({ error: 'NIS dan password wajib diisi.' }, { status: 400 })
    }

    const santri = await queryOne<{
      id: string
      nis: string
      nama_lengkap: string
      tanggal_lahir: string | null
      status_global: string
    }>(
      `SELECT id, nis, nama_lengkap, tanggal_lahir, status_global FROM santri WHERE nis = ?`,
      [nis]
    )

    const fail = async (reason: string, label?: string) => {
      await logActivity({
        actor: { name: label || nis },
        module: 'portal_ortu',
        action: 'login',
        entityType: 'portal_session',
        entityLabel: label || nis,
        summary: `Login portal ortu gagal untuk NIS ${nis}`,
        details: { reason, nis, channel: 'portal' },
        status: 'failed',
        requestInfo,
      })
      return NextResponse.json({ error: 'NIS atau password salah.' }, { status: 401 })
    }

    if (!santri) return fail('santri_not_found')
    if (santri.status_global !== 'aktif') return fail('santri_not_active', santri.nama_lengkap)

    const cred = await queryOne<{
      santri_id: string
      password_hash: string
      is_active: number
      must_change_password: number
    }>(
      `SELECT santri_id, password_hash, is_active, must_change_password
       FROM portal_ortu_credentials WHERE santri_id = ?`,
      [santri.id]
    )

    let mustChangePassword = false
    if (cred) {
      if (Number(cred.is_active) === 0) {
        await logActivity({
          actor: { name: santri.nama_lengkap },
          module: 'portal_ortu',
          action: 'login',
          entityType: 'portal_session',
          entityId: santri.id,
          entityLabel: santri.nama_lengkap,
          summary: `Login portal ortu diblokir untuk ${santri.nama_lengkap}`,
          details: { reason: 'credential_blocked', nis, channel: 'portal' },
          status: 'failed',
          requestInfo,
        })
        return NextResponse.json(
          { error: 'Akses portal untuk santri ini sedang diblokir. Hubungi admin pesantren.' },
          { status: 403 }
        )
      }
      const valid = await verifyPassword(password, cred.password_hash)
      if (!valid) return fail('invalid_password', santri.nama_lengkap)
      mustChangePassword = Number(cred.must_change_password) === 1
    } else {
      // Login pertama: terima password default lalu provision kredensial
      const defaultBirth = birthDatePassword(santri.tanggal_lahir)
      if (password !== santri.nis && password !== defaultBirth) {
        return fail('invalid_default_password', santri.nama_lengkap)
      }
      await execute(
        `INSERT INTO portal_ortu_credentials (santri_id, password_hash, must_change_password)
         VALUES (?, ?, 1)`,
        [santri.id, await hashPassword(password)]
      )
      mustChangePassword = true
    }

    await execute(
      `UPDATE portal_ortu_credentials
       SET last_login_at = datetime('now'), updated_at = datetime('now')
       WHERE santri_id = ?`,
      [santri.id]
    )

    // Migrasi kompatibel: kredensial lama tetap dapat login, lalu dibuatkan akun
    // wali baru. Petugas dapat menautkan anak lain ke akun ini kemudian.
    let guardianId: string | undefined
    try {
      await syncFinanceStudentSnapshot(santri.id)
      const existingGuardian = await financeQueryOne<{ id: string }>(`SELECT id FROM finance_guardians WHERE legacy_santri_id=? LIMIT 1`, [santri.id])
      guardianId = existingGuardian?.id || generateId()
      if (!existingGuardian) {
        const currentHash = cred?.password_hash || (await queryOne<{ password_hash: string }>(`SELECT password_hash FROM portal_ortu_credentials WHERE santri_id=?`, [santri.id]))?.password_hash
        if (currentHash) {
          const db = await getFinanceDB()
          await db.batch([
            db.prepare(`INSERT INTO finance_guardians(id,display_name,password_hash,status,legacy_santri_id) VALUES(?,?,?,'ACTIVE',?)`).bind(guardianId, `Wali ${santri.nama_lengkap}`, currentHash, santri.id),
            db.prepare(`INSERT OR IGNORE INTO finance_guardian_students(guardian_id,santri_id,relationship,access_level,verified_at)
              VALUES(?,?,'WALI',CASE WHEN EXISTS(SELECT 1 FROM finance_guardian_students WHERE santri_id=? AND access_level='PRIMARY_FINANCE') THEN 'VIEW' ELSE 'PRIMARY_FINANCE' END,datetime('now'))`).bind(guardianId, santri.id, santri.id),
          ])
        }
      }
    } catch (migrationError) {
      console.warn('[portal] guardian migration deferred', migrationError)
      guardianId = undefined
    }

    const token = await createPortalToken({
      kind: 'portal_ortu',
      ...(guardianId ? { guardian_id: guardianId } : {}),
      santri_id: santri.id,
      nis: santri.nis,
      nama: santri.nama_lengkap,
    })

    const response = NextResponse.json({ success: true, mustChangePassword })
    response.cookies.set({ ...portalCookieOptions(), value: token })

    await logActivity({
      actor: { name: santri.nama_lengkap },
      module: 'portal_ortu',
      action: 'login',
      entityType: 'portal_session',
      entityId: santri.id,
      entityLabel: santri.nama_lengkap,
      summary: `Login portal ortu berhasil (${santri.nama_lengkap})`,
      details: { nis, channel: 'portal', first_login: !cred },
      status: 'success',
      requestInfo,
    })

    return response
  } catch (err: any) {
    console.error('[Portal Login Error]', err?.message)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
