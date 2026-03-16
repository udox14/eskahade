'use server'

import { query, execute } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { generateId, now } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// ─── Antrian verifikasi absen ─────────────────────────────────────────────────
// Fix row reads:
// 1. Tambah filter verif IS NULL atau verif = 'BELUM' — tidak fetch yang sudah OK
// 2. Tambah LIMIT 3 bulan terakhir — tidak scan data lama yang harusnya sudah diverifikasi
// 3. Pakai INNER JOIN ke santri aktif — tidak fetch data santri yang sudah arsip
export async function getAntrianVerifikasi() {
  // Batas waktu: 3 bulan terakhir — data alfa lama yang masih belum diverif
  // kemungkinan memang sudah tidak relevan / sudah diproses manual
  const batas = new Date()
  batas.setMonth(batas.getMonth() - 3)
  const batasStr = batas.toISOString().slice(0, 10)

  const rawData = await query<any>(`
    SELECT ah.id, ah.tanggal,
           ah.shubuh, ah.ashar, ah.maghrib,
           ah.verif_shubuh, ah.verif_ashar, ah.verif_maghrib,
           s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM absensi_harian ah
    INNER JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
      AND rp.status_riwayat = 'aktif'
    INNER JOIN santri s ON s.id = rp.santri_id
      AND s.status_global = 'aktif'
    WHERE ah.tanggal >= ?
      AND (
        (ah.shubuh  = 'A' AND (ah.verif_shubuh  IS NULL OR ah.verif_shubuh  = 'BELUM'))
        OR
        (ah.ashar   = 'A' AND (ah.verif_ashar   IS NULL OR ah.verif_ashar   = 'BELUM'))
        OR
        (ah.maghrib = 'A' AND (ah.verif_maghrib IS NULL OR ah.verif_maghrib = 'BELUM'))
      )
    ORDER BY ah.tanggal DESC
    LIMIT 2000
  `, [batasStr])

  const groupedMap = new Map<string, any>()

  rawData.forEach((row: any) => {
    const sessions = ['shubuh', 'ashar', 'maghrib'] as const
    sessions.forEach(sess => {
      const isAlfa    = row[sess] === 'A'
      const belumVerif = row[`verif_${sess}`] == null || row[`verif_${sess}`] === 'BELUM'
      if (isAlfa && belumVerif) {
        if (!groupedMap.has(row.santri_id)) {
          groupedMap.set(row.santri_id, {
            santri_id: row.santri_id,
            nama:      row.nama_lengkap,
            nis:       row.nis,
            info:      `${row.asrama || '-'} / ${row.kamar || '-'}`,
            items:     [],
          })
        }
        groupedMap.get(row.santri_id).items.push({
          absen_id:    row.id,
          tanggal:     row.tanggal,
          sesi:        sess,
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
      const totalSesi  = items.length
      const totalPoin  = totalSesi * 10
      const detailString = items
        .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
        .map(i => {
          const tgl = new Date(i.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
          return `${tgl} (${i.sesi})`
        })
        .join(', ')

      violationsToInsert.push({
        id:         generateId(),
        santri_id:  santriId,
        tanggal:    now(),
        jenis:      'ALFA_PENGAJIAN',
        deskripsi:  `Akumulasi Alfa Pengajian (${totalSesi} Sesi).\nDetail: ${detailString}`,
        poin:       totalPoin,
        penindak_id: session?.id ?? null,
      })

      for (const item of items) {
        await execute(
          `UPDATE absensi_harian SET ${getVerifColumn(item.sesi)} = 'OK' WHERE id = ?`,
          [item.absen_id]
        )
      }
    } else if (vonis === 'BELUM') {
      for (const item of items) {
        await execute(
          `UPDATE absensi_harian SET ${getVerifColumn(item.sesi)} = 'BELUM' WHERE id = ?`,
          [item.absen_id]
        )
      }
    } else {
      const newStatus = vonis === 'SAKIT' ? 'S' : vonis === 'IZIN' ? 'I' : 'H'
      for (const item of items) {
        await execute(
          `UPDATE absensi_harian SET ${getSesiColumn(item.sesi)} = ?, ${getVerifColumn(item.sesi)} = NULL WHERE id = ?`,
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
