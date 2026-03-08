'use server'

import { query, execute, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

async function getUserRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

export async function getDashboardTabungan(asramaRequest: string) {
  const restrictedAsrama = await getUserRestriction()
  const targetAsrama = restrictedAsrama || asramaRequest

  const santriList = await query<any>(`
    SELECT id, nama_lengkap, nis, kamar, asrama
    FROM santri
    WHERE asrama = ? AND status_global = 'aktif'
    ORDER BY kamar, nama_lengkap
  `, [targetAsrama])

  if (!santriList.length) return { santri: [], stats: null }

  const santriIds = santriList.map((s: any) => s.id)
  const ph = santriIds.map(() => '?').join(',')

  const logs = await query<any>(
    `SELECT santri_id, jenis, nominal, created_at FROM tabungan_log WHERE santri_id IN (${ph})`,
    santriIds
  )

  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  let totalUangFisik = 0, masukBulanIni = 0, keluarBulanIni = 0

  const dataFinal = santriList.map((s: any) => {
    const trans = logs.filter((l: any) => l.santri_id === s.id)
    let saldo = 0
    trans.forEach((t: any) => {
      if (t.jenis === 'MASUK') {
        saldo += t.nominal
        if (t.created_at >= startMonth) masukBulanIni += t.nominal
      } else {
        saldo -= t.nominal
        if (t.created_at >= startMonth) keluarBulanIni += t.nominal
      }
    })
    totalUangFisik += saldo
    return { ...s, saldo, kamar_norm: parseInt(s.kamar) || 999 }
  })

  return {
    santri: dataFinal,
    stats: { uang_fisik: totalUangFisik, masuk_bulan_ini: masukBulanIni, keluar_bulan_ini: keluarBulanIni },
  }
}

export async function simpanTopup(santriId: string, nominal: number, keterangan: string) {
  const session = await getSession()

  await execute(
    `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at)
     VALUES (?, ?, 'MASUK', ?, ?, ?, ?)`,
    [generateId(), santriId, nominal, keterangan || 'Topup Saldo', session?.id ?? null, new Date().toISOString()]
  )

  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true }
}

export async function simpanJajanMassal(listTransaksi: { santriId: string; nominal: number }[]) {
  const session = await getSession()
  if (!listTransaksi.length) return { error: 'Tidak ada data.' }

  for (const item of listTransaksi) {
    await execute(
      `INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at)
       VALUES (?, ?, 'KELUAR', ?, 'Jajan Harian', ?, ?)`,
      [generateId(), item.santriId, item.nominal, session?.id ?? null, new Date().toISOString()]
    )
  }

  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true, count: listTransaksi.length }
}

export async function getRiwayatTabunganSantri(santriId: string) {
  return query<any>(`
    SELECT tl.*, u.full_name AS admin_nama
    FROM tabungan_log tl
    LEFT JOIN users u ON u.id = tl.created_by
    WHERE tl.santri_id = ?
    ORDER BY tl.created_at DESC
    LIMIT 10
  `, [santriId])
}

export async function hapusTransaksi(id: string) {
  await execute('DELETE FROM tabungan_log WHERE id = ?', [id])
  revalidatePath('/dashboard/asrama/uang-jajan')
  return { success: true }
}

export async function getClientRestriction() {
  return getUserRestriction()
}