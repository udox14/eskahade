#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Recovery: santri ketimpa import massal (upsert-by-NIS)
//
// KONTEKS BUG:
//   Import santri massal mencocokkan baris HANYA berdasarkan NIS. Baris dengan
//   NIS kosong/duplikat "cocok" dengan santri lain → row santri-nya di-UPDATE
//   in-place (nama, NIK, ortu, dst tertimpa). uuid dipertahankan, jadi semua
//   record anak (spp_log, pembayaran, psb_flow, hasil tes, dll) masih nyantol
//   ke uuid itu — tapi sekarang kebaca atas nama orang yang menimpa.
//
// STRATEGI (non-destruktif, selective):
//   Snapshot D1 SEBELUM overwrite dipakai sebagai MANIFEST, bukan buat menimpa.
//   - Identitas asli (korban) diambil dari snapshot.
//   - Identitas penimpa diambil dari prod sekarang.
//   - Record anak yang ADA di prod tapi TIDAK ADA di snapshot = dibuat setelah
//     overwrite = milik penimpa → dipindah ke uuid baru.
//   - Record anak yang ada di dua-duanya dengan PK sama tapi ISI beda =
//     ketimpa in-place (mis. hasil_tes_klasifikasi UNIQUE(santri_id)) →
//     DILAPORKAN sebagai konflik untuk keputusan manual (tidak auto-generate).
//
// OUTPUT (tidak menyentuh prod):
//   scripts/out/recovery-report.json  — rincian per korban
//   scripts/out/recovery-review.sql   — statement bedah untuk bagian yang jelas
//
// CARA PAKAI:
//   1. Backup:  wrangler d1 export eskahade-db --remote --output=now.sql
//   2. Buat snapshot lama (lihat README di bawah), muat ke DB terpisah:
//        wrangler d1 create eskahade-recovery
//        wrangler d1 execute eskahade-recovery --remote --file=old.sql
//   3. node scripts/recovery-santri-overwrite.mjs
//   4. REVIEW recovery-review.sql + report, baru jalankan manual ke prod.
//
// Snapshot lama (langkah 2) via time-travel, prod balik utuh:
//   wrangler d1 time-travel info    eskahade-db                 # catat bookmark B_now
//   wrangler d1 time-travel restore eskahade-db --timestamp="2026-07-07T13:00:00Z"
//   wrangler d1 export              eskahade-db --remote --output=old.sql
//   wrangler d1 time-travel restore eskahade-db --bookmark=<B_now>
//   (timestamp = UTC; log tampil WIB/UTC+7. 07T13:00Z = 7 Jul 20.00 WIB,
//    setelah aktivitas sah Zani terakhir, sebelum import Akmani.)
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROD_DB     = process.env.PROD_DB     || 'eskahade-db'
const SNAPSHOT_DB = process.env.SNAPSHOT_DB || 'eskahade-recovery'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = join(__dirname, 'out')

// ── jalankan SQL read-only via wrangler, kembalikan rows ─────────────────────
function d1(db, sql) {
  const raw = execFileSync(
    'wrangler',
    ['d1', 'execute', db, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  // wrangler --json → array of { results, success, meta }
  const parsed = JSON.parse(raw)
  const first = Array.isArray(parsed) ? parsed[0] : parsed
  return first?.results ?? []
}

const sqlStr = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)

// ── temukan semua tabel dengan kolom santri_id + PK-nya ──────────────────────
function childTables(db) {
  const tables = d1(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .map((r) => r.name)
  const out = []
  for (const t of tables) {
    if (t === 'santri') continue
    const cols = d1(db, `PRAGMA table_info('${t}')`)
    const hasFk = cols.some((c) => c.name === 'santri_id')
    if (!hasFk) continue
    const pkCol = cols.find((c) => c.pk === 1)?.name || 'id'
    out.push({ table: t, pk: pkCol, cols: cols.map((c) => c.name) })
  }
  return out
}

// ── deteksi korban: satu uuid, >1 nama berbeda di activity_log ───────────────
function findVictims() {
  return d1(
    PROD_DB,
    `SELECT al.entity_id AS id,
            GROUP_CONCAT(DISTINCT al.entity_label) AS nama_log,
            COUNT(DISTINCT al.entity_label) AS n
     FROM activity_log al
     JOIN santri s ON s.id = al.entity_id
     WHERE al.entity_id IS NOT NULL AND al.entity_label IS NOT NULL
     GROUP BY al.entity_id
     HAVING n > 1`,
  )
}

function fetchSantri(db, id) {
  const rows = d1(db, `SELECT * FROM santri WHERE id = ${sqlStr(id)}`)
  return rows[0] || null
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const prodChildren = childTables(PROD_DB)
  const snapTableNames = new Set(childTables(SNAPSHOT_DB).map((t) => t.table))

  const victims = findVictims()
  const report = []
  const sqlLines = [
    '-- recovery-review.sql — REVIEW dulu sebelum dijalankan ke prod.',
    '-- Backup wajib sudah dibuat (now.sql). Semua statement reversible.',
    'PRAGMA foreign_keys = OFF;',
    'BEGIN TRANSACTION;',
    '',
  ]

  for (const v of victims) {
    const oldRow = fetchSantri(SNAPSHOT_DB, v.id) // identitas korban (asli)
    const nowRow = fetchSantri(PROD_DB, v.id)     // identitas penimpa (sekarang)
    if (!oldRow || !nowRow) {
      report.push({ id: v.id, skip: 'santri tidak ada di snapshot atau prod', nama_log: v.nama_log })
      continue
    }
    // bukan overwrite kalau nama sama (mis. sekadar edit sah)
    if ((oldRow.nama_lengkap || '') === (nowRow.nama_lengkap || '')) {
      report.push({ id: v.id, skip: 'nama snapshot == prod (bukan overwrite)', nama: nowRow.nama_lengkap })
      continue
    }

    const newUuid = randomUUID() // uuid baru untuk PENIMPA
    const perTable = []

    sqlLines.push(`-- ═══ Korban uuid ${v.id}`)
    sqlLines.push(`--     asli (snapshot) : ${oldRow.nama_lengkap}  | penimpa (prod): ${nowRow.nama_lengkap}`)
    sqlLines.push(`--     ${nowRow.nama_lengkap} dipindah ke uuid baru ${newUuid}`)

    // 1) baris santri baru untuk penimpa = salinan penuh row prod, uuid diganti
    const cols = Object.keys(nowRow)
    const vals = cols.map((c) => (c === 'id' ? sqlStr(newUuid) : sqlStr(nowRow[c])))
    sqlLines.push(
      `INSERT INTO santri (${cols.join(', ')}) VALUES (${vals.join(', ')});`,
    )

    // 2) pindahkan record anak MILIK PENIMPA (ada di prod, tak ada di snapshot)
    for (const { table, pk } of prodChildren) {
      if (!snapTableNames.has(table)) continue
      const prodRows = d1(PROD_DB, `SELECT ${pk} AS k FROM ${table} WHERE santri_id = ${sqlStr(v.id)}`)
      if (prodRows.length === 0) continue
      const snapRows = d1(SNAPSHOT_DB, `SELECT ${pk} AS k FROM ${table} WHERE santri_id = ${sqlStr(v.id)}`)
      const snapKeys = new Set(snapRows.map((r) => String(r.k)))

      const belongsPenimpa = prodRows.map((r) => String(r.k)).filter((k) => !snapKeys.has(k))   // prod-only
      const shared = prodRows.map((r) => String(r.k)).filter((k) => snapKeys.has(k))             // perlu cek konflik isi

      // konflik: PK sama di dua DB → mungkin ketimpa in-place (UNIQUE(santri_id))
      const conflicts = []
      for (const k of shared) {
        const a = d1(PROD_DB, `SELECT * FROM ${table} WHERE ${pk} = ${sqlStr(k)}`)[0]
        const b = d1(SNAPSHOT_DB, `SELECT * FROM ${table} WHERE ${pk} = ${sqlStr(k)}`)[0]
        if (JSON.stringify(a) !== JSON.stringify(b)) conflicts.push({ pk: k, prod: a, snapshot: b })
      }

      if (belongsPenimpa.length > 0) {
        const inList = belongsPenimpa.map(sqlStr).join(', ')
        sqlLines.push(
          `UPDATE ${table} SET santri_id = ${sqlStr(newUuid)} ` +
          `WHERE santri_id = ${sqlStr(v.id)} AND ${pk} IN (${inList});  -- ${belongsPenimpa.length} baris → ${nowRow.nama_lengkap}`,
        )
      }
      if (conflicts.length > 0) {
        sqlLines.push(
          `-- ⚠ KONFLIK ${table}: ${conflicts.length} baris ketimpa in-place (PK sama, isi beda). ` +
          `Butuh keputusan manual — lihat report. PK: ${conflicts.map((c) => c.pk).join(', ')}`,
        )
      }
      perTable.push({
        table,
        milik_penimpa: belongsPenimpa.length,
        milik_korban: shared.length - conflicts.length,
        konflik_inplace: conflicts,
      })
    }

    // 3) kembalikan identitas korban ke uuid asli (dari snapshot)
    const idCols = Object.keys(oldRow).filter((c) => c !== 'id')
    const setClause = idCols.map((c) => `${c} = ${sqlStr(oldRow[c])}`).join(', ')
    sqlLines.push(`UPDATE santri SET ${setClause} WHERE id = ${sqlStr(v.id)};  -- pulihkan ${oldRow.nama_lengkap}`)
    sqlLines.push('')

    report.push({
      id: v.id,
      korban_asli: oldRow.nama_lengkap,
      penimpa: nowRow.nama_lengkap,
      penimpa_uuid_baru: newUuid,
      tabel: perTable,
    })
  }

  sqlLines.push('COMMIT;')
  sqlLines.push('PRAGMA foreign_keys = ON;')

  writeFileSync(join(OUT_DIR, 'recovery-report.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(OUT_DIR, 'recovery-review.sql'), sqlLines.join('\n'))

  const conflictCount = report.reduce(
    (n, r) => n + (r.tabel?.reduce((m, t) => m + (t.konflik_inplace?.length || 0), 0) || 0), 0,
  )
  console.log(`Korban terdeteksi : ${report.filter((r) => !r.skip).length}`)
  console.log(`Dilewati          : ${report.filter((r) => r.skip).length}`)
  console.log(`Konflik in-place  : ${conflictCount} (butuh keputusan manual — cek report)`)
  console.log(`Output            : scripts/out/recovery-report.json + recovery-review.sql`)
}

main()
