'use server'

import { query, execute } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { generateId, now } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getAntrianVerifikasi() {
  const rawData = await query<any>(`
    SELECT ah.id, ah.tanggal,
           ah.shubuh, ah.ashar, ah.maghrib,
           ah.verif_shubuh, ah.verif_ashar, ah.verif_maghrib,
           s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    WHERE ah.shubuh = 'A' OR ah.ashar = 'A' OR ah.maghrib = 'A'
    ORDER BY ah.tanggal DESC
  `, [])

  const groupedMap = new Map<string, any>()

  rawData.forEach((row: any) => {
    const sessions = ['shubuh', 'ashar', 'maghrib'] as const
    sessions.forEach(sess => {
      if (row[sess] === 'A' && row[`verif_${sess}`] !== 'OK') {
        if (!groupedMap.has(row.santri_id)) {
          groupedMap.set(row.santri_id, {
            santri_id: row.santri_id,
            nama: row.nama_lengkap,
            nis: row.nis,
            info: `${row.asrama || '-'} / ${row.kamar || '-'}`,
            items: [],
          })
        }
        groupedMap.get(row.santri_id).items.push({
          absen_id: row.id,
          tanggal: row.tanggal,
          sesi: sess,
          status_verif: row[`verif_${sess}`],
        })
      }
    })
  })

  return Array.from(groupedMap.values())
}

type VonisItem = {
  santriId: string
  items: { absen_id: string; sesi: string; tanggal: string }[]
  vonis: 'ALFA_MURNI' | 'SAKIT' | 'IZIN' | 'KESALAHAN' | 'BELUM'
}

const VALID_SESI = ['shubuh', 'ashar', 'maghrib'] as const
function getVerifColumn(sesi: string): string {
  if (!VALID_SESI.includes(sesi as any)) throw new Error(`Sesi tidak valid: ${sesi}`)
  return `verif_${sesi}`
}
function getSesiColumn(sesi: string): string {
  if (!VALID_SESI.includes(sesi as any)) throw new Error(`Sesi tidak valid: ${sesi}`)
  return sesi
}

export async function simpanVerifikasiMassal(daftarVonis: VonisItem[]) {
  const session = await getSession()
  if (!daftarVonis || daftarVonis.length === 0) return { error: 'Tidak ada data untuk disimpan' }

  const violationsToInsert: any[] = []

  for (const data of daftarVonis) {
    const { santriId, items, vonis } = data

    if (vonis === 'ALFA_MURNI') {
      const totalSesi = items.length
      const totalPoin = totalSesi * 10
      const detailString = items
        .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
        .map(i => {
          const tgl = new Date(i.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
          return `${tgl} (${i.sesi})`
        })
        .join(', ')

      const deskripsiFinal = `Akumulasi Alfa Pengajian (${totalSesi} Sesi).\nDetail: ${detailString}`

      violationsToInsert.push({
        id: generateId(),
        santri_id: santriId,
        tanggal: now(),
        jenis: 'ALFA_PENGAJIAN',
        deskripsi: deskripsiFinal,
        poin: totalPoin,
        penindak_id: session?.id ?? null,
      })

      for (const item of items) {
        const verifCol = getVerifColumn(item.sesi)
        await execute(
          `UPDATE absensi_harian SET ${verifCol} = 'OK' WHERE id = ?`,
          [item.absen_id]
        )
      }
    } else if (vonis === 'BELUM') {
      for (const item of items) {
        const verifCol = getVerifColumn(item.sesi)
        await execute(
          `UPDATE absensi_harian SET ${verifCol} = 'BELUM' WHERE id = ?`,
          [item.absen_id]
        )
      }
    } else {
      const newStatus = vonis === 'SAKIT' ? 'S' : vonis === 'IZIN' ? 'I' : 'H'
      for (const item of items) {
        const sesiCol = getSesiColumn(item.sesi)
        const verifCol = getVerifColumn(item.sesi)
        await execute(
          `UPDATE absensi_harian SET ${sesiCol} = ?, ${verifCol} = NULL WHERE id = ?`,
          [newStatus, item.absen_id]
        )
      }
    }
  }

  for (const v of violationsToInsert) {
    await execute(`
      INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [v.id, v.santri_id, v.tanggal, v.jenis, v.deskripsi, v.poin, v.penindak_id])
  }

  revalidatePath('/dashboard/akademik/absensi/verifikasi')
  revalidatePath('/dashboard/keamanan')
  return { success: true, count: daftarVonis.length }
}