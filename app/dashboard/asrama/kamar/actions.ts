'use server'

import { execute, getDB, query, queryOne } from '@/lib/db'
import { assertFeature } from '@/lib/auth/feature'
import { hasRole, isAdmin, type SessionUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const KAMAR_PATH = '/dashboard/asrama/kamar'
const PERPINDAHAN_PATH = '/dashboard/asrama/perpindahan-kamar'

type SantriKamarRow = {
  id: string
  nis: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  sekolah: string | null
  kelas_sekolah: string | null
  kab_kota: string | null
  nama_kelas: string | null
}

type RoomOverviewRow = {
  nomor_kamar: string
  blok: string | null
  kuota: number
  reserved_baru: number
  total_anggota: number
  ketua_santri_id: string | null
  ketua_nama: string | null
  pembina_nama: string | null
}

async function ensureKamarSchema() {
  const db = await getDB()

  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_config (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama        TEXT NOT NULL,
        nomor_kamar   TEXT NOT NULL,
        kuota         INTEGER NOT NULL DEFAULT 10,
        reserved_baru INTEGER NOT NULL DEFAULT 0,
        blok          TEXT,
        created_at    TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, nomor_kamar)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_draft (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama      TEXT NOT NULL,
        santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        kamar_lama  TEXT,
        kamar_baru  TEXT NOT NULL,
        applied     INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, santri_id)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_ketua (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama      TEXT NOT NULL,
        nomor_kamar TEXT NOT NULL,
        santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        created_at  TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, nomor_kamar)
      )
    `),
  ])

  const kamarConfigColumns = await query<{ name: string }>('PRAGMA table_info(kamar_config)')
  if (!kamarConfigColumns.some((col) => col.name === 'blok')) {
    await execute('ALTER TABLE kamar_config ADD COLUMN blok TEXT')
  }
  if (!kamarConfigColumns.some((col) => col.name === 'reserved_baru')) {
    await execute('ALTER TABLE kamar_config ADD COLUMN reserved_baru INTEGER NOT NULL DEFAULT 0')
  }
}

async function ensureKepengurusanSchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS asrama_kepengurusan (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      asrama      TEXT NOT NULL,
      jabatan_key TEXT NOT NULL,
      kamar       TEXT,
      guru_id     INTEGER REFERENCES data_guru(id),
      nama        TEXT NOT NULL,
      urutan      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT
    )
  `)
}

async function getAccess(asrama?: string | null) {
  await ensureKamarSchema()
  await ensureKepengurusanSchema()
  const access = await assertFeature(KAMAR_PATH)
  if ('error' in access) return access

  const session = access as SessionUser
  const requestedAsrama = String(asrama ?? '').trim()

  if (!isAdmin(session)) {
    if (!hasRole(session, 'pengurus_asrama')) return { error: 'Unauthorized' }
    if (!session.asrama_binaan) return { error: 'Asrama binaan akun belum diset' }
    if (requestedAsrama && requestedAsrama !== session.asrama_binaan) {
      return { error: 'Anda hanya boleh mengakses asrama binaan Anda' }
    }
  }

  return { session, requestedAsrama }
}

async function getAllowedAsrama(session: SessionUser) {
  if (!isAdmin(session)) {
    return session.asrama_binaan ? [session.asrama_binaan] : []
  }

  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama
     FROM santri
     WHERE status_global = 'aktif'
       AND asrama IS NOT NULL
       AND TRIM(asrama) <> ''
     ORDER BY asrama`
  )
  return rows.map((row) => row.asrama)
}

function sortKamar(items: string[]) {
  return [...items].sort((a, b) => {
    const aNum = Number(a)
    const bNum = Number(b)
    const bothNumeric = Number.isFinite(aNum) && Number.isFinite(bNum)
    if (bothNumeric && aNum !== bNum) return aNum - bNum
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
}

function buildDemografi(santriList: SantriKamarRow[], totalKamar: number, ketuaTerisi: number) {
  const sekolahMap = new Map<string, number>()
  const kotaMap = new Map<string, number>()
  let belumBerkamar = 0

  for (const santri of santriList) {
    if (!santri.kamar || !santri.kamar.trim()) belumBerkamar += 1
    const sekolah = santri.sekolah?.trim() || 'Belum diisi'
    const kota = santri.kab_kota?.trim() || 'Belum diisi'
    sekolahMap.set(sekolah, (sekolahMap.get(sekolah) ?? 0) + 1)
    kotaMap.set(kota, (kotaMap.get(kota) ?? 0) + 1)
  }

  const topSekolah = [...sekolahMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([label, total]) => ({ label, total }))

  const topKota = [...kotaMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([label, total]) => ({ label, total }))

  return {
    totalSantri: santriList.length,
    totalKamar,
    ketuaTerisi,
    belumBerkamar,
    topSekolah,
    topKota,
  }
}

export async function getKamarOverview(asrama?: string | null) {
  const access = await getAccess(asrama)
  if ('error' in access) {
    return {
      error: access.error,
      asramaOptions: [] as string[],
      currentAsrama: '',
      rooms: [] as any[],
      demografi: {
        totalSantri: 0,
        totalKamar: 0,
        ketuaTerisi: 0,
        belumBerkamar: 0,
        topSekolah: [] as Array<{ label: string; total: number }>,
        topKota: [] as Array<{ label: string; total: number }>,
      },
    }
  }

  const asramaOptions = await getAllowedAsrama(access.session)
  const currentAsrama = access.requestedAsrama || asramaOptions[0] || ''

  if (!currentAsrama) {
    return {
      asramaOptions,
      currentAsrama: '',
      rooms: [],
      demografi: {
        totalSantri: 0,
        totalKamar: 0,
        ketuaTerisi: 0,
        belumBerkamar: 0,
        topSekolah: [],
        topKota: [],
      },
    }
  }

  const [roomRows, santriRows] = await Promise.all([
    query<RoomOverviewRow>(
      `SELECT kamar.nomor_kamar,
              kc.blok,
              COALESCE(kc.kuota, COUNT(s.id)) AS kuota,
              COALESCE(kc.reserved_baru, 0) AS reserved_baru,
              COUNT(s.id) AS total_anggota,
              kk.santri_id AS ketua_santri_id,
              ks.nama_lengkap AS ketua_nama,
              ak.nama AS pembina_nama
       FROM (
         SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
         UNION
         SELECT TRIM(kamar) AS nomor_kamar
         FROM santri
         WHERE status_global = 'aktif'
           AND asrama = ?
           AND kamar IS NOT NULL
           AND TRIM(kamar) <> ''
       ) kamar
       LEFT JOIN kamar_config kc
         ON kc.asrama = ?
        AND kc.nomor_kamar = kamar.nomor_kamar
       LEFT JOIN santri s
         ON s.asrama = ?
        AND s.status_global = 'aktif'
        AND TRIM(COALESCE(s.kamar, '')) = kamar.nomor_kamar
       LEFT JOIN kamar_ketua kk
         ON kk.asrama = ?
        AND kk.nomor_kamar = kamar.nomor_kamar
       LEFT JOIN santri ks
         ON ks.id = kk.santri_id
        AND ks.status_global = 'aktif'
        AND ks.asrama = ?
       LEFT JOIN asrama_kepengurusan ak
         ON ak.asrama = ?
        AND ak.jabatan_key = 'pembina_kamar'
        AND ak.kamar = kamar.nomor_kamar
       GROUP BY kamar.nomor_kamar, kc.blok, kc.kuota, kc.reserved_baru, kk.santri_id, ks.nama_lengkap, ak.nama
       ORDER BY CAST(kamar.nomor_kamar AS INTEGER), kamar.nomor_kamar`,
      [currentAsrama, currentAsrama, currentAsrama, currentAsrama, currentAsrama, currentAsrama, currentAsrama]
    ),
    query<SantriKamarRow>(
      `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.kab_kota,
              k.nama_kelas
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.status_global = 'aktif' AND s.asrama = ?`,
      [currentAsrama]
    ),
  ])

  const rooms = sortKamar(roomRows.map((row) => row.nomor_kamar)).map((nomor_kamar) => {
    const row = roomRows.find((item) => item.nomor_kamar === nomor_kamar)!
    return {
      nomor_kamar,
      blok: row.blok ?? null,
      kuota: Number(row.kuota ?? 0),
      reserved_baru: Number(row.reserved_baru ?? 0),
      total_anggota: Number(row.total_anggota ?? 0),
      ketua: row.ketua_santri_id ? {
        nomor_kamar,
        santri_id: row.ketua_santri_id,
        nama_lengkap: row.ketua_nama || '-',
      } : null,
      pembina_nama: row.pembina_nama ?? null,
    }
  })

  return {
    asramaOptions,
    currentAsrama,
    rooms,
    demografi: buildDemografi(
      santriRows,
      rooms.length,
      rooms.filter((room) => room.ketua).length
    ),
  }
}

export async function getKamarDetail(asrama: string, nomorKamar: string) {
  const access = await getAccess(asrama)
  if ('error' in access) {
    return {
      error: access.error,
      room: null as any,
    }
  }

  const targetAsrama = access.requestedAsrama
  const targetKamar = String(nomorKamar ?? '').trim()
  if (!targetKamar) return { error: 'Kamar wajib dipilih', room: null as any }

  const [roomRow, members] = await Promise.all([
    queryOne<RoomOverviewRow>(
      `SELECT kamar.nomor_kamar,
              kc.blok,
              COALESCE(kc.kuota, kamar.total_anggota) AS kuota,
              COALESCE(kc.reserved_baru, 0) AS reserved_baru,
              kamar.total_anggota,
              kk.santri_id AS ketua_santri_id,
              ks.nama_lengkap AS ketua_nama,
              ak.nama AS pembina_nama
       FROM (
         SELECT ? AS nomor_kamar,
                COUNT(*) AS total_anggota
         FROM santri
         WHERE status_global = 'aktif'
           AND asrama = ?
           AND TRIM(COALESCE(kamar, '')) = ?
       ) kamar
       LEFT JOIN kamar_config kc
         ON kc.asrama = ?
        AND kc.nomor_kamar = kamar.nomor_kamar
       LEFT JOIN kamar_ketua kk
         ON kk.asrama = ?
        AND kk.nomor_kamar = kamar.nomor_kamar
       LEFT JOIN santri ks
         ON ks.id = kk.santri_id
        AND ks.status_global = 'aktif'
        AND ks.asrama = ?
       LEFT JOIN asrama_kepengurusan ak
         ON ak.asrama = ?
        AND ak.jabatan_key = 'pembina_kamar'
        AND ak.kamar = kamar.nomor_kamar`,
      [targetKamar, targetAsrama, targetKamar, targetAsrama, targetAsrama, targetAsrama, targetAsrama]
    ),
    query<SantriKamarRow>(
      `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.kab_kota,
              k.nama_kelas
       FROM santri s
       LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON k.id = rp.kelas_id
       WHERE s.status_global = 'aktif'
         AND s.asrama = ?
         AND TRIM(COALESCE(s.kamar, '')) = ?
       ORDER BY s.nama_lengkap`,
      [targetAsrama, targetKamar]
    ),
  ])

  const kamarExists = roomRow && (Number(roomRow.total_anggota) > 0 || roomRow.kuota || roomRow.pembina_nama || roomRow.ketua_santri_id)
  if (!kamarExists) return { error: 'Kamar tidak ditemukan', room: null as any }

  return {
    room: {
      nomor_kamar: targetKamar,
      blok: roomRow?.blok ?? null,
      kuota: Number(roomRow?.kuota ?? 0),
      reserved_baru: Number(roomRow?.reserved_baru ?? 0),
      total_anggota: Number(roomRow?.total_anggota ?? 0),
      ketua: roomRow?.ketua_santri_id ? {
        nomor_kamar: targetKamar,
        santri_id: roomRow.ketua_santri_id,
        nama_lengkap: roomRow.ketua_nama || '-',
      } : null,
      pembina_nama: roomRow?.pembina_nama ?? null,
      members: members.map((row) => ({
        ...row,
        alamat_ringkas: row.kab_kota?.trim() || '-',
      })),
    },
  }
}

export async function updateKetuaKamarLangsung(params: {
  asrama: string
  nomorKamar: string
  santriId: string | null
}) {
  const access = await getAccess(params.asrama)
  if ('error' in access) return access

  const asrama = access.requestedAsrama
  const nomorKamar = String(params.nomorKamar ?? '').trim()
  if (!nomorKamar) return { error: 'Nomor kamar wajib diisi' }

  const adaKamar = await queryOne<{ nomor_kamar: string }>(
    `SELECT nomor_kamar
     FROM (
       SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
       UNION
       SELECT TRIM(kamar) AS nomor_kamar
       FROM santri
       WHERE status_global = 'aktif' AND asrama = ? AND kamar IS NOT NULL AND TRIM(kamar) <> ''
     ) kamar
     WHERE nomor_kamar = ?
     LIMIT 1`,
    [asrama, asrama, nomorKamar]
  )
  if (!adaKamar) return { error: 'Kamar tidak ditemukan pada asrama ini' }

  if (!params.santriId) {
    await execute('DELETE FROM kamar_ketua WHERE asrama = ? AND nomor_kamar = ?', [asrama, nomorKamar])
  } else {
    const santri = await queryOne<{ id: string }>(
      `SELECT id
       FROM santri
       WHERE id = ? AND status_global = 'aktif' AND asrama = ? AND kamar = ?`,
      [params.santriId, asrama, nomorKamar]
    )
    if (!santri) return { error: 'Santri bukan penghuni aktif kamar ini' }

    const db = await getDB()
    await db.batch([
      db.prepare('DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id = ? AND nomor_kamar <> ?')
        .bind(asrama, params.santriId, nomorKamar),
      db.prepare(`
        INSERT INTO kamar_ketua (asrama, nomor_kamar, santri_id)
        VALUES (?, ?, ?)
        ON CONFLICT(asrama, nomor_kamar) DO UPDATE SET santri_id = excluded.santri_id
      `).bind(asrama, nomorKamar, params.santriId),
    ])
  }

  revalidatePath(KAMAR_PATH)
  revalidatePath(PERPINDAHAN_PATH)
  return { success: true }
}

export async function mutasiKamarDalamAsrama(params: {
  asrama: string
  santriId: string
  kamarTujuan: string
}) {
  const access = await getAccess(params.asrama)
  if ('error' in access) return access

  const asrama = access.requestedAsrama
  const kamarTujuan = String(params.kamarTujuan ?? '').trim()
  if (!kamarTujuan) return { error: 'Kamar tujuan wajib dipilih' }

  const santri = await queryOne<{
    id: string
    kamar: string | null
    nama_lengkap: string
  }>(
    `SELECT id, kamar, nama_lengkap
     FROM santri
     WHERE id = ? AND status_global = 'aktif' AND asrama = ?`,
    [params.santriId, asrama]
  )
  if (!santri) return { error: 'Santri tidak ditemukan di asrama ini' }

  const adaKamarTujuan = await queryOne<{ nomor_kamar: string }>(
    `SELECT nomor_kamar
     FROM (
       SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
       UNION
       SELECT TRIM(kamar) AS nomor_kamar
       FROM santri
       WHERE status_global = 'aktif' AND asrama = ? AND kamar IS NOT NULL AND TRIM(kamar) <> ''
     ) kamar
     WHERE nomor_kamar = ?
     LIMIT 1`,
    [asrama, asrama, kamarTujuan]
  )
  if (!adaKamarTujuan) return { error: 'Kamar tujuan tidak tersedia di asrama ini' }

  const kamarAsal = String(santri.kamar ?? '').trim()
  if (kamarAsal === kamarTujuan) return { error: 'Santri sudah berada di kamar tersebut' }

  const db = await getDB()
  await db.batch([
    db.prepare(`UPDATE santri SET kamar = ?, updated_at = datetime('now') WHERE id = ?`).bind(kamarTujuan, params.santriId),
    db.prepare(`DELETE FROM kamar_draft WHERE asrama = ? AND santri_id = ?`).bind(asrama, params.santriId),
    db.prepare(`DELETE FROM kamar_ketua WHERE asrama = ? AND santri_id = ? AND nomor_kamar <> ?`)
      .bind(asrama, params.santriId, kamarTujuan),
  ])

  revalidatePath(KAMAR_PATH)
  revalidatePath(PERPINDAHAN_PATH)
  return { success: true, kamarAsal: kamarAsal || null }
}
