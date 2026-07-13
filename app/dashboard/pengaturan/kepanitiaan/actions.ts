'use server'

import { execute, query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export type PanitiaMember = {
  id: string
  full_name: string
  email: string
  roles: string
  source_type: string | null
  asrama_binaan: string | null
  jabatan: string | null
  psb_verifikasi_akses: number
  psb_asrama_akses: number
  psb_bayar_akses: number
  upk_panitia_akses: number
}

// === PSB ===
export async function getPanitiaPsb() {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  const rows = await query<PanitiaMember>(
    `SELECT id, full_name, email, roles, source_type, asrama_binaan, structural_jabatan as jabatan, psb_verifikasi_akses, psb_asrama_akses, psb_bayar_akses, upk_panitia_akses
     FROM users 
     WHERE psb_verifikasi_akses = 1 OR psb_asrama_akses = 1 OR psb_bayar_akses = 1
     ORDER BY full_name ASC`,
    []
  )
  return rows
}

export async function addPanitiaPsb(userIds: string[], divisi: 'verifikasi' | 'asrama' | 'bayar') {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (userIds.length === 0) return { error: 'Tidak ada user yang dipilih' }

  const column = 
    divisi === 'verifikasi' ? 'psb_verifikasi_akses' : 
    divisi === 'asrama' ? 'psb_asrama_akses' : 'psb_bayar_akses'

  const placeholders = userIds.map(() => '?').join(',')
  await execute(`UPDATE users SET ${column} = 1 WHERE id IN (${placeholders})`, userIds)

  revalidatePath('/dashboard/pengaturan/kepanitiaan')
  revalidatePath('/dashboard/psb')
  return { success: true }
}

export async function removePanitiaPsb(userId: string, divisi: 'verifikasi' | 'asrama' | 'bayar' | 'all') {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  if (divisi === 'all') {
    await execute('UPDATE users SET psb_verifikasi_akses = 0, psb_asrama_akses = 0, psb_bayar_akses = 0 WHERE id = ?', [userId])
  } else {
    const column = 
      divisi === 'verifikasi' ? 'psb_verifikasi_akses' : 
      divisi === 'asrama' ? 'psb_asrama_akses' : 'psb_bayar_akses'
    await execute(`UPDATE users SET ${column} = 0 WHERE id = ?`, [userId])
  }

  revalidatePath('/dashboard/pengaturan/kepanitiaan')
  return { success: true }
}

export async function resetPanitiaPsb() {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await execute('UPDATE users SET psb_verifikasi_akses = 0, psb_asrama_akses = 0, psb_bayar_akses = 0 WHERE psb_verifikasi_akses = 1 OR psb_asrama_akses = 1 OR psb_bayar_akses = 1', [])
  revalidatePath('/dashboard/pengaturan/kepanitiaan')
  return { success: true }
}

// === UPK ===
export async function getPanitiaUpk() {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  const rows = await query<PanitiaMember>(
    `SELECT id, full_name, email, roles, source_type, asrama_binaan, structural_jabatan as jabatan, psb_verifikasi_akses, psb_asrama_akses, psb_bayar_akses, upk_panitia_akses
     FROM users 
     WHERE upk_panitia_akses = 1
     ORDER BY full_name ASC`,
    []
  )
  return rows
}

export async function addPanitiaUpk(userIds: string[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (userIds.length === 0) return { error: 'Tidak ada user yang dipilih' }

  const placeholders = userIds.map(() => '?').join(',')
  await execute(`UPDATE users SET upk_panitia_akses = 1 WHERE id IN (${placeholders})`, userIds)

  revalidatePath('/dashboard/pengaturan/kepanitiaan')
  return { success: true }
}

export async function removePanitiaUpk(userId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await execute('UPDATE users SET upk_panitia_akses = 0 WHERE id = ?', [userId])

  revalidatePath('/dashboard/pengaturan/kepanitiaan')
  return { success: true }
}

export async function resetPanitiaUpk() {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await execute('UPDATE users SET upk_panitia_akses = 0 WHERE upk_panitia_akses = 1', [])
  revalidatePath('/dashboard/pengaturan/kepanitiaan')
  return { success: true }
}

// === KEPENGURUSAN ASRAMA ===
export async function getKepengurusanAsrama() {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  const rows = await query<PanitiaMember>(
    `SELECT id, full_name, email, roles, source_type, asrama_binaan, structural_jabatan as jabatan, psb_verifikasi_akses, psb_asrama_akses, psb_bayar_akses, upk_panitia_akses
     FROM users 
     WHERE structural_jabatan IN ('ketua', 'sekretaris', 'bendahara')
       AND (roles LIKE '%pengurus_asrama%' OR role = 'pengurus_asrama')
     ORDER BY structural_jabatan ASC, full_name ASC`,
    []
  )
  return rows
}

export async function addKepengurusanAsrama(userIds: string[], jabatan: 'ketua' | 'sekretaris' | 'bendahara') {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (userIds.length === 0) return { error: 'Tidak ada user yang dipilih' }

  const jabatanKey = jabatan === 'ketua' ? 'rois' : jabatan

  for (const uid of userIds) {
    const u = (await query<{ id: string, full_name: string, role: string, roles: string, asrama_binaan: string | null, guru_id: number | null }>('SELECT id, full_name, role, roles, asrama_binaan, guru_id FROM users WHERE id = ?', [uid]))[0]
    if (!u) continue

    let rolesArray: string[] = []
    try { rolesArray = JSON.parse(u.roles) } catch {}
    
    if (!Array.isArray(rolesArray)) rolesArray = []
    
    // Pastikan dia punya role pengurus_asrama
    let needsUpdateRoles = false
    if (!rolesArray.includes('pengurus_asrama') && u.role !== 'pengurus_asrama') {
      rolesArray.push('pengurus_asrama')
      needsUpdateRoles = true
    }
    
    if (needsUpdateRoles) {
      await execute('UPDATE users SET structural_jabatan = ?, roles = ? WHERE id = ?', [jabatan, JSON.stringify(rolesArray), uid])
    } else {
      await execute('UPDATE users SET structural_jabatan = ? WHERE id = ?', [jabatan, uid])
    }

    // SYNC TO OLD MENU
    if (u.asrama_binaan) {
      // cari urutan terakhir
      const urutanQ = await query<{ max_u: number }>('SELECT MAX(urutan) as max_u FROM asrama_kepengurusan WHERE asrama = ? AND jabatan_key = ?', [u.asrama_binaan, jabatanKey])
      const nextUrutan = (urutanQ[0]?.max_u || 0) + 1
      
      await execute(
        'INSERT INTO asrama_kepengurusan (asrama, jabatan_key, guru_id, nama, urutan, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        [u.asrama_binaan, jabatanKey, u.guru_id, u.full_name, nextUrutan]
      )
    }
  }

  revalidatePath('/dashboard/pengaturan/kepanitiaan')
  revalidatePath('/dashboard/asrama/kepengurusan')
  return { success: true }
}

export async function removeKepengurusanAsrama(userId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const u = (await query<{ asrama_binaan: string | null, full_name: string, guru_id: number | null }>('SELECT asrama_binaan, full_name, guru_id FROM users WHERE id = ?', [userId]))[0]

  await execute("UPDATE users SET structural_jabatan = 'anggota' WHERE id = ?", [userId])

  if (u && u.asrama_binaan) {
    if (u.guru_id) {
      await execute('DELETE FROM asrama_kepengurusan WHERE asrama = ? AND guru_id = ? AND jabatan_key IN ("rois", "wakil_rois", "sekretaris", "bendahara")', [u.asrama_binaan, u.guru_id])
    } else {
      await execute('DELETE FROM asrama_kepengurusan WHERE asrama = ? AND nama = ? AND jabatan_key IN ("rois", "wakil_rois", "sekretaris", "bendahara")', [u.asrama_binaan, u.full_name])
    }
  }

  revalidatePath('/dashboard/pengaturan/kepanitiaan')
  revalidatePath('/dashboard/asrama/kepengurusan')
  return { success: true }
}

export async function resetKepengurusanAsrama() {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await execute("UPDATE users SET structural_jabatan = 'anggota' WHERE structural_jabatan IN ('ketua', 'sekretaris', 'bendahara') AND (roles LIKE '%pengurus_asrama%' OR role = 'pengurus_asrama')", [])
  
  // SYNC TO OLD MENU: Hapus semua rois, wakil_rois, sekretaris, bendahara dari semua asrama
  await execute('DELETE FROM asrama_kepengurusan WHERE jabatan_key IN ("rois", "wakil_rois", "sekretaris", "bendahara")', [])

  revalidatePath('/dashboard/pengaturan/kepanitiaan')
  revalidatePath('/dashboard/asrama/kepengurusan')
  return { success: true }
}

export async function searchUsers(q: string) {
  if (!q.trim()) return []
  const searchTerm = \`%\${q.toLowerCase()}%\`
  const rows = await query<{ id: string, full_name: string, email: string, roles: string, source_type: string }>(
    \`SELECT id, full_name, email, roles, source_type 
     FROM users 
     WHERE lower(full_name) LIKE ? OR lower(email) LIKE ? 
     ORDER BY full_name ASC LIMIT 50\`,
    [searchTerm, searchTerm]
  )
  return rows
}
