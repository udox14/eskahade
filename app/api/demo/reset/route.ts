// app/api/demo/reset/route.ts
//
// Reset MANUAL data dummy di DEMO_DB.
// - Hanya bisa dijalankan oleh ADMIN ASLI (bukan akun demo).
// - Beroperasi LANGSUNG ke env.DEMO_DB (tidak lewat getDB(), karena getDB()
//   untuk admin mengembalikan DB asli).
// - Menghapus data sandbox lalu mengisi ulang seed dummy.
// - Menyinkronkan user demo dari DB asli ke DEMO_DB (id harus sama agar
//   hydrateSessionFromDb menemukan user saat session demo aktif).
//
// Pakai: POST /api/demo/reset  (login sebagai admin)

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getSession, isAdmin } from '@/lib/auth/session'

type Stmt = { sql: string; params?: unknown[] }

// Tabel data yang dibersihkan saat reset (urutan aman thd FK).
// users TIDAK dihapus di sini — disinkronkan terpisah di bawah.
const DATA_TABLES = [
  'absensi_harian', 'absensi_guru', 'absen_asrama', 'absen_sakit',
  'nilai_akademik', 'nilai_akhlak', 'ranking',
  'pelanggaran', 'perizinan', 'hasil_tes_klasifikasi',
  'spp_log', 'spp_setoran', 'pembayaran_tahunan', 'tabungan_log',
  'upk_item', 'upk_transaksi', 'riwayat_surat',
  'riwayat_pendidikan', 'santri',
  'kelas', 'data_guru', 'tahun_ajaran',
]

function seedStatements(): Stmt[] {
  const s: Stmt[] = []

  // Tahun ajaran aktif
  s.push({ sql: `INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '1446-1447 H', 1)` })

  // Guru
  s.push({ sql: `INSERT INTO data_guru (id, nama_lengkap, gelar, kode_guru) VALUES
    (1, 'Ust. Demo Fulan', 'S.Pd', 'G-DEMO-1'),
    (2, 'Ust. Demo Ahmad', 'Lc', 'G-DEMO-2')` })

  // Kelas (id TEXT). marhalah_id mengacu seed migrasi 0005.
  s.push({ sql: `INSERT INTO kelas (id, tahun_ajaran_id, marhalah_id, nama_kelas, jenis_kelamin) VALUES
    ('demo-kelas-1', 1, 1, 'Tamhidiyyah 1A', 'L'),
    ('demo-kelas-2', 1, 4, 'Ibtidaiyyah 1A', 'L')` })

  // Santri + riwayat pendidikan
  const santri = [
    ['demo-s-1', '99001', 'Demo Santri Satu', 'AL-FALAH', 'demo-kelas-1'],
    ['demo-s-2', '99002', 'Demo Santri Dua', 'AL-FALAH', 'demo-kelas-1'],
    ['demo-s-3', '99003', 'Demo Santri Tiga', 'AS-SALAM', 'demo-kelas-1'],
    ['demo-s-4', '99004', 'Demo Santri Empat', 'AS-SALAM', 'demo-kelas-2'],
    ['demo-s-5', '99005', 'Demo Santri Lima', 'BAHAGIA', 'demo-kelas-2'],
    ['demo-s-6', '99006', 'Demo Santri Enam', 'BAHAGIA', 'demo-kelas-2'],
  ]
  for (const [id, nis, nama, asrama, kelasId] of santri) {
    s.push({
      sql: `INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, tahun_masuk)
            VALUES (?, ?, ?, 'L', 'aktif', ?, 2024)`,
      params: [id, nis, nama, asrama],
    })
    s.push({
      sql: `INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat)
            VALUES (?, ?, ?, 'aktif')`,
      params: [`demo-rp-${id}`, id, kelasId],
    })
  }

  // Contoh data keuangan & pelanggaran biar menu tidak kosong
  s.push({ sql: `INSERT INTO spp_log (id, santri_id, bulan, tahun, nominal_bayar, keterangan)
    VALUES ('demo-spp-1', 'demo-s-1', 1, 2025, 70000, 'Demo'),
           ('demo-spp-2', 'demo-s-2', 1, 2025, 70000, 'Demo')` })
  s.push({ sql: `INSERT INTO pelanggaran (id, santri_id, jenis, deskripsi, poin)
    VALUES ('demo-plg-1', 'demo-s-3', 'RINGAN', 'Terlambat (data demo)', 5)` })

  return s
}

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  // PENTING: hanya admin asli. Akun demo TIDAK boleh reset (isAdmin cek role 'admin').
  if (!isAdmin(session)) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })

  const { env } = await getCloudflareContext({ async: true })
  const demoDb = env.DEMO_DB
  const realDb = env.DB

  if (!demoDb) {
    return NextResponse.json(
      { error: 'DEMO_DB belum dikonfigurasi. Isi binding di wrangler.jsonc.' },
      { status: 500 }
    )
  }

  try {
    // 1. Bersihkan data sandbox
    for (const t of DATA_TABLES) {
      try {
        await demoDb.prepare(`DELETE FROM ${t}`).run()
      } catch {
        // Tabel mungkin belum ada di DEMO_DB (migrasi belum lengkap) — lewati
      }
    }

    // 2. Isi seed dummy
    const stmts = seedStatements()
    for (const { sql, params = [] } of stmts) {
      await demoDb.prepare(sql).bind(...params).run()
    }

    // 3. Sinkron user demo dari DB asli → DEMO_DB (id sama!)
    let syncedUsers = 0
    try {
      const { results } = await realDb
        .prepare(
          `SELECT id, email, password_hash, full_name, role, roles
           FROM users
           WHERE role = 'demo' OR roles LIKE '%"demo"%'`
        )
        .all<{
          id: string; email: string; password_hash: string
          full_name: string | null; role: string; roles: string | null
        }>()

      for (const u of results ?? []) {
        await demoDb
          .prepare(
            `INSERT OR REPLACE INTO users (id, email, password_hash, full_name, role, roles)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(u.id, u.email, u.password_hash, u.full_name, u.role, u.roles ?? '["demo"]')
          .run()
        syncedUsers++
      }
    } catch (e: any) {
      return NextResponse.json(
        { error: `Seed sukses tapi sync user demo gagal: ${e?.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Data demo di-reset.',
      seeded: stmts.length,
      syncedUsers,
    })
  } catch (err: any) {
    console.error('[demo/reset] ERROR:', err?.message)
    return NextResponse.json({ error: `Reset gagal: ${err?.message}` }, { status: 500 })
  }
}
