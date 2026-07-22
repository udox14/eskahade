'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { financeQueryOne, queryOne } from '@/lib/db'
import { createPortalToken, getPortalSession, portalCookieOptions } from '@/lib/portal/session'

export async function switchPortalStudent(formData: FormData) {
  const session = await getPortalSession()
  if (!session?.guardian_id) throw new Error('Akun wali belum dimigrasikan.')
  const santriId = String(formData.get('santriId') || '')
  const link = await financeQueryOne<{ santri_id: string }>(`SELECT santri_id FROM finance_guardian_students WHERE guardian_id=? AND santri_id=?`, [session.guardian_id, santriId])
  if (!link) throw new Error('Santri tidak terhubung dengan akun wali ini.')
  const target = await queryOne<{ id: string; nis: string; nama_lengkap: string }>(`SELECT id,nis,nama_lengkap FROM santri WHERE id=? AND status_global='aktif'`, [santriId])
  if (!target) throw new Error('Santri tidak aktif atau tidak ditemukan.')
  const token = await createPortalToken({ kind: 'portal_ortu', guardian_id: session.guardian_id, santri_id: target.id, nis: target.nis, nama: target.nama_lengkap })
  ;(await cookies()).set({ ...portalCookieOptions(), value: token })
  redirect('/portal-ortu/keuangan')
}
