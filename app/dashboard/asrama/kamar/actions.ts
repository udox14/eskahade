'use server'

import { execute, generateId, getDB, now, query, queryOne } from '@/lib/db'
import { assertFeature } from '@/lib/auth/feature'
import { getSession, hasRole, isAdmin, type SessionUser } from '@/lib/auth/session'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getKategoriSantriEfektifSql } from '@/lib/santri/kategori'
import { revalidatePath } from 'next/cache'

const KAMAR_PATH = '/dashboard/asrama/kamar'
const PERPINDAHAN_PATH = '/dashboard/asrama/perpindahan-kamar'

type SantriKamarRow = {
  id: string
  nis: string
  nama_lengkap: string
  foto_url: string | null
  asrama: string | null
  kamar: string | null
  sekolah: string | null
  kelas_sekolah: string | null
  no_wa_ortu: string | null
  kab_kota: string | null
  nama_kelas: string | null
  kategori_santri: string
  kategori_efektif: string
  pending_keluar_id: string | null
  pending_keluar_tanggal: string | null
  pending_keluar_catatan: string | null
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

async function ensureKeluarTandaiSchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS santri_keluar_tandai (
      id                TEXT PRIMARY KEY,
      santri_id         TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
      asrama            TEXT NOT NULL,
      kamar             TEXT,
      tanggal_tandai    TEXT NOT NULL,
      catatan           TEXT,
      status            TEXT NOT NULL DEFAULT 'pending',
      ditandai_oleh     TEXT REFERENCES users(id),
      diproses_oleh     TEXT REFERENCES users(id),
      diproses_at       TEXT,
      keputusan_catatan TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT
    )
  `)
}

async function getAccess(asrama?: string | null, action: 'read' | 'update' = 'read') {
  await ensureKamarSchema()
  await ensureKepengurusanSchema()
  await ensureKeluarTandaiSchema()
  const access = await assertFeature(KAMAR_PATH, action)
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
    return session.asrama_binaan && !isAsramaTanpaKamar(session.asrama_binaan) ? [session.asrama_binaan] : []
  }

  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama
     FROM santri
     WHERE status_global = 'aktif'
       AND asrama IS NOT NULL
       AND TRIM(asrama) <> ''
     ORDER BY asrama`
  )
  return rows.map((row) => row.asrama).filter((asrama) => !isAsramaTanpaKamar(asrama))
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

  if (isAsramaTanpaKamar(currentAsrama)) {
    return {
      asramaOptions,
      currentAsrama,
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
      `SELECT s.id, s.nis, s.nama_lengkap, s.foto_url, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.no_wa_ortu, s.kab_kota,
              k.nama_kelas,
              (
                SELECT sk.id
                FROM santri_keluar_tandai sk
                WHERE sk.santri_id = s.id AND sk.status = 'pending'
                ORDER BY sk.created_at DESC
                LIMIT 1
              ) AS pending_keluar_id,
              (
                SELECT sk.tanggal_tandai
                FROM santri_keluar_tandai sk
                WHERE sk.santri_id = s.id AND sk.status = 'pending'
                ORDER BY sk.created_at DESC
                LIMIT 1
              ) AS pending_keluar_tanggal,
              (
                SELECT sk.catatan
                FROM santri_keluar_tandai sk
                WHERE sk.santri_id = s.id AND sk.status = 'pending'
                ORDER BY sk.created_at DESC
                LIMIT 1
              ) AS pending_keluar_catatan
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
  const kategoriEfektifSql = getKategoriSantriEfektifSql('s')
  if (!targetKamar) return { error: 'Kamar wajib dipilih', room: null as any }
  if (isAsramaTanpaKamar(targetAsrama)) return { error: 'Asrama ini tidak memakai kamar', room: null as any }

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
      `SELECT s.id, s.nis, s.nama_lengkap, s.foto_url, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.no_wa_ortu, s.kab_kota,
              COALESCE(NULLIF(s.kategori_santri, ''), 'REGULER') AS kategori_santri,
              ${kategoriEfektifSql} AS kategori_efektif,
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
        pending_keluar: row.pending_keluar_id ? {
          id: row.pending_keluar_id,
          tanggal_tandai: row.pending_keluar_tanggal,
          catatan: row.pending_keluar_catatan,
        } : null,
      })),
    },
  }
}

export async function updateKetuaKamarLangsung(params: {
  asrama: string
  nomorKamar: string
  santriId: string | null
}) {
  const access = await getAccess(params.asrama, 'update')
  if ('error' in access) return access

  const asrama = access.requestedAsrama
  if (isAsramaTanpaKamar(asrama)) return { error: 'Asrama ini tidak memakai fitur kamar' }
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
    await logActivity({
      actor: actorFromSession(access.session),
      module: 'asrama_kamar',
      action: 'update',
      fiturHref: KAMAR_PATH,
      logKind: 'update',
      entityType: 'kamar_ketua',
      entityId: `${asrama}:${nomorKamar}`,
      entityLabel: `${asrama} kamar ${nomorKamar}`,
      summary: `Menghapus ketua kamar ${nomorKamar}`,
      details: {
        asrama,
        nomor_kamar: nomorKamar,
      },
    })
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
    const santriDetail = await queryOne<{ nama_lengkap: string | null }>(
      'SELECT nama_lengkap FROM santri WHERE id = ?',
      [params.santriId]
    )
    await logActivity({
      actor: actorFromSession(access.session),
      module: 'asrama_kamar',
      action: 'update',
      fiturHref: KAMAR_PATH,
      logKind: 'update',
      entityType: 'kamar_ketua',
      entityId: `${asrama}:${nomorKamar}`,
      entityLabel: `${asrama} kamar ${nomorKamar}`,
      summary: `Menetapkan ketua kamar ${nomorKamar}`,
      details: {
        asrama,
        nomor_kamar: nomorKamar,
        santri_id: params.santriId,
        nama_santri: santriDetail?.nama_lengkap || params.santriId,
      },
    })
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
  const access = await getAccess(params.asrama, 'update')
  if ('error' in access) return access

  const asrama = access.requestedAsrama
  if (isAsramaTanpaKamar(asrama)) return { error: 'Asrama ini tidak memakai fitur kamar' }
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

  await logActivity({
    actor: actorFromSession(access.session),
    module: 'asrama_kamar',
    action: 'update',
    fiturHref: KAMAR_PATH,
    logKind: 'update',
    entityType: 'mutasi_kamar',
    entityId: params.santriId,
    entityLabel: santri.nama_lengkap,
    summary: `Memindahkan kamar ${santri.nama_lengkap}`,
    details: {
      asrama,
      kamar_asal: kamarAsal || null,
      kamar_tujuan: kamarTujuan,
    },
  })

  revalidatePath(KAMAR_PATH)
  revalidatePath(PERPINDAHAN_PATH)
  return { success: true, kamarAsal: kamarAsal || null }
}

export async function updateNomorWaOrtuBatchKamar(params: {
  asrama: string
  nomorKamar: string
  items: Array<{ santriId: string; noWaOrtu: string }>
}) {
  const access = await getAccess(params.asrama, 'update')
  if ('error' in access) return access

  const asrama = access.requestedAsrama
  const nomorKamar = String(params.nomorKamar ?? '').trim()
  if (!nomorKamar) return { error: 'Nomor kamar wajib diisi' }

  const items = (params.items ?? [])
    .map((item) => ({
      santriId: String(item.santriId ?? '').trim(),
      noWaOrtu: String(item.noWaOrtu ?? '').trim() || null,
    }))
    .filter((item) => item.santriId)

  if (items.length === 0) return { error: 'Tidak ada nomor WA yang dikirim' }

  const members = await query<{ id: string; nama_lengkap: string; no_wa_ortu: string | null }>(
    `SELECT id, nama_lengkap, no_wa_ortu
     FROM santri
     WHERE status_global = 'aktif'
       AND asrama = ?
       AND TRIM(COALESCE(kamar, '')) = ?`,
    [asrama, nomorKamar]
  )
  const memberIds = new Set(members.map((member) => member.id))
  const allowedItems = items.filter((item) => memberIds.has(item.santriId))
  if (allowedItems.length === 0) return { error: 'Tidak ada santri yang cocok di kamar ini' }

  const db = await getDB()
  await db.batch(
    allowedItems.map((item) =>
      db.prepare(
        `UPDATE santri
         SET no_wa_ortu = ?,
             updated_at = datetime('now')
         WHERE id = ?
           AND status_global = 'aktif'
           AND asrama = ?
           AND TRIM(COALESCE(kamar, '')) = ?`
      ).bind(item.noWaOrtu, item.santriId, asrama, nomorKamar)
    )
  )

  await logActivity({
    actor: actorFromSession(access.session),
    module: 'asrama_kamar',
    action: 'update',
    fiturHref: KAMAR_PATH,
    logKind: 'update',
    entityType: 'kamar',
    entityId: `${asrama}/${nomorKamar}`,
    entityLabel: `Kamar ${nomorKamar}`,
    summary: `Memperbarui nomor WA orang tua kamar ${nomorKamar}`,
    details: {
      asrama,
      kamar: nomorKamar,
      total: allowedItems.length,
      santri_ids: allowedItems.map((item) => item.santriId),
    },
  })

  revalidatePath(KAMAR_PATH)
  return { success: true, total: allowedItems.length }
}

export async function tandaiSantriKeluarDariKamar(params: {
  asrama: string
  santriId: string
  catatan?: string
}) {
  const access = await getAccess(params.asrama, 'update')
  if ('error' in access) return access

  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const asrama = access.requestedAsrama
  const santri = await queryOne<{
    id: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    status_global: string
  }>(
    `SELECT id, nama_lengkap, asrama, kamar, status_global
     FROM santri
     WHERE id = ? AND asrama = ?`,
    [params.santriId, asrama]
  )

  if (!santri) return { error: 'Santri tidak ditemukan di asrama ini' }
  if (santri.status_global !== 'aktif') return { error: 'Santri sudah tidak aktif' }

  const existing = await queryOne<{ id: string }>(
    `SELECT id
     FROM santri_keluar_tandai
     WHERE santri_id = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.santriId]
  )

  const catatan = String(params.catatan ?? '').trim() || null
  const stampedAt = now()

  if (existing) {
    await execute(
      `UPDATE santri_keluar_tandai
       SET asrama = ?,
           kamar = ?,
           tanggal_tandai = ?,
           catatan = ?,
           ditandai_oleh = ?,
           updated_at = ?
       WHERE id = ?`,
      [asrama, santri.kamar, stampedAt, catatan, session.id, stampedAt, existing.id]
    )
  } else {
    await execute(
      `INSERT INTO santri_keluar_tandai (
        id, santri_id, asrama, kamar, tanggal_tandai, catatan, status, ditandai_oleh, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [generateId(), params.santriId, asrama, santri.kamar, stampedAt, catatan, session.id, stampedAt]
    )
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'asrama_kamar',
    action: 'update',
    fiturHref: KAMAR_PATH,
    logKind: 'update',
    entityType: 'santri_keluar_pengajuan',
    entityId: params.santriId,
    entityLabel: santri.nama_lengkap,
    summary: `Menandai santri keluar dari kamar: ${santri.nama_lengkap}`,
    details: {
      asrama,
      kamar: santri.kamar,
      catatan,
      mode: existing ? 'update' : 'create',
    },
  })

  revalidatePath(KAMAR_PATH)
  revalidatePath('/dashboard/santri/keluar')
  return { success: true }
}

export async function batalTandaiSantriKeluarDariKamar(params: {
  asrama: string
  santriId: string
}) {
  const access = await getAccess(params.asrama, 'update')
  if ('error' in access) return access

  const santri = await queryOne<{ nama_lengkap: string | null; kamar: string | null }>(
    'SELECT nama_lengkap, kamar FROM santri WHERE id = ? AND asrama = ?',
    [params.santriId, access.requestedAsrama]
  )

  await execute(
    `UPDATE santri_keluar_tandai
     SET status = 'dibatalkan',
         diproses_at = ?,
         updated_at = ?
     WHERE santri_id = ? AND asrama = ? AND status = 'pending'`,
    [now(), now(), params.santriId, access.requestedAsrama]
  )

  await logActivity({
    actor: actorFromSession(access.session),
    module: 'asrama_kamar',
    action: 'update',
    fiturHref: KAMAR_PATH,
    logKind: 'update',
    entityType: 'santri_keluar_pengajuan',
    entityId: params.santriId,
    entityLabel: santri?.nama_lengkap || params.santriId,
    summary: `Membatalkan tanda keluar dari kamar untuk ${santri?.nama_lengkap || params.santriId}`,
    details: {
      asrama: access.requestedAsrama,
      kamar: santri?.kamar || null,
    },
  })

  revalidatePath(KAMAR_PATH)
  revalidatePath('/dashboard/santri/keluar')
  return { success: true }
}
