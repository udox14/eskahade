#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Recovery Gelombang 2: Deteksi santri yang tertimpa import 8 Jul 2026
//
// Membandingkan dua SQL dump (snapshot lama vs backup baru) untuk menemukan
// santri yang UUID-nya sama tapi nama_lengkap berubah — tanda overwrite.
// Menghasilkan SQL recovery + laporan JSON.
//
// CARA PAKAI:
//   node scripts/recovery-wave2.mjs
//
// INPUT (di-root repo):
//   old-snapshot-pre8jul.sql   — Snapshot sebelum overwrite
//   now-backup-20260711-075010.sql — Backup setelah overwrite
//
// OUTPUT:
//   scripts/out/wave2-recovery.sql    — SQL statement untuk recovery
//   scripts/out/wave2-report.json     — Laporan detail per korban
// ─────────────────────────────────────────────────────────────────────────────

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(__dirname, 'out')

const OLD_DUMP = join(ROOT, 'old-snapshot-pre8jul.sql')
const NEW_DUMP = join(ROOT, 'now-backup-20260711-075010.sql')

// UUIDs korban gelombang 1 (sudah ditangani recovery sebelumnya)
const WAVE1_VICTIM_IDS = new Set()
try {
  const raw = readFileSync(join(OUT_DIR, 'victim_ids.txt'), 'utf8')
  for (const match of raw.matchAll(/'([a-f0-9-]+)'/g)) {
    WAVE1_VICTIM_IDS.add(match[1])
  }
} catch { /* file mungkin tidak ada */ }

// ── Parser SQL VALUES ────────────────────────────────────────────────────────
function parseSqlValues(line) {
  const idx = line.indexOf('VALUES(')
  if (idx === -1) return null
  const start = idx + 7
  const end = line.lastIndexOf(');')
  if (end === -1 || end <= start) return null

  const str = line.substring(start, end)
  const values = []
  let i = 0

  while (i < str.length) {
    while (i < str.length && str[i] === ' ') i++
    if (i >= str.length) break

    if (str[i] === "'") {
      i++
      let val = ''
      while (i < str.length) {
        if (str[i] === "'" && i + 1 < str.length && str[i + 1] === "'") {
          val += "'"
          i += 2
        } else if (str[i] === "'") {
          i++
          break
        } else {
          val += str[i]
          i++
        }
      }
      values.push(val)
    } else if (str.substring(i, i + 4) === 'NULL') {
      values.push(null)
      i += 4
    } else {
      let val = ''
      while (i < str.length && str[i] !== ',') {
        val += str[i]
        i++
      }
      const trimmed = val.trim()
      const num = Number(trimmed)
      values.push(Number.isFinite(num) ? num : trimmed)
    }

    // skip comma
    while (i < str.length && str[i] === ' ') i++
    if (i < str.length && str[i] === ',') i++
  }

  return values
}

function parseSqlColumns(line) {
  const match = line.match(/INSERT INTO "(\w+)" \((.+?)\) VALUES/)
  if (!match) return null
  const cols = match[2].split(',').map(c => c.trim().replace(/"/g, ''))
  return { table: match[1], cols }
}

function lineToRecord(line, tableName) {
  if (!line.includes(`INSERT INTO "${tableName}"`)) return null
  const meta = parseSqlColumns(line)
  if (!meta || meta.table !== tableName) return null
  const vals = parseSqlValues(line)
  if (!vals || vals.length !== meta.cols.length) return null
  const record = {}
  for (let i = 0; i < meta.cols.length; i++) {
    record[meta.cols[i]] = vals[i]
  }
  return record
}

// ── Scan SQL dump file → extract records for given tables ─────────────────
async function scanDump(filePath, tables, filterIds = null) {
  const results = {}
  for (const t of tables) results[t] = []

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    for (const t of tables) {
      if (!line.includes(`INSERT INTO "${t}"`)) continue
      const record = lineToRecord(line, t)
      if (!record) continue
      // Jika ada filterIds, hanya ambil record yang santri_id-nya match
      const idCol = t === 'santri' ? 'id' : 'santri_id'
      if (filterIds && !filterIds.has(record[idCol])) continue
      results[t].push(record)
    }
  }

  return results
}

// ── Escape SQL string ────────────────────────────────────────────────────────
function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Langkah 1/4: Memindai santri dari snapshot lama...')
  const oldData = await scanDump(OLD_DUMP, ['santri'])
  const oldSantriMap = new Map(oldData.santri.map(s => [s.id, s]))
  console.log(`  → ${oldSantriMap.size} santri ditemukan di snapshot lama`)

  console.log('Langkah 2/4: Memindai santri dari backup baru...')
  const newData = await scanDump(NEW_DUMP, ['santri'])
  const newSantriMap = new Map(newData.santri.map(s => [s.id, s]))
  console.log(`  → ${newSantriMap.size} santri ditemukan di backup baru`)

  // ── Deteksi korban: UUID sama, nama_lengkap berbeda ──────────────────────
  const victims = []
  for (const [uuid, oldRow] of oldSantriMap) {
    if (WAVE1_VICTIM_IDS.has(uuid)) continue // skip gelombang 1
    const newRow = newSantriMap.get(uuid)
    if (!newRow) continue // santri dihapus (bukan overwrite)
    const oldName = (oldRow.nama_lengkap || '').trim().toUpperCase()
    const newName = (newRow.nama_lengkap || '').trim().toUpperCase()
    if (oldName === newName) continue // sama — bukan overwrite
    if (!oldName || !newName) continue
    victims.push({ uuid, oldRow, newRow })
  }

  console.log(`\nKorban terdeteksi (gelombang 2): ${victims.length}`)
  if (victims.length === 0) {
    console.log('Tidak ada korban baru. Selesai.')
    writeFileSync(join(OUT_DIR, 'wave2-report.json'), '[]')
    writeFileSync(join(OUT_DIR, 'wave2-recovery.sql'), '-- Tidak ada korban gelombang 2.\n')
    return
  }

  for (const v of victims) {
    console.log(`  ${v.oldRow.nama_lengkap}  →  ditimpa oleh  ${v.newRow.nama_lengkap}`)
  }

  // ── Scan child tables untuk UUID korban ──────────────────────────────────
  const victimIds = new Set(victims.map(v => v.uuid))
  const CHILD_TABLES = [
    'hasil_tes_klasifikasi',
    'pembayaran_tahunan',
    'psb_flow',
    'psb_payment_receipt',
    'tes_klasifikasi_plotting',
    'penempatan_draft',
    'spp_log',
    'riwayat_pendidikan',
    'absen_asrama',
    'perizinan',
  ]

  console.log('\nLangkah 3/4: Memindai record anak dari kedua snapshot...')
  const oldChildren = await scanDump(OLD_DUMP, CHILD_TABLES, victimIds)
  const newChildren = await scanDump(NEW_DUMP, CHILD_TABLES, victimIds)
  console.log('  → Selesai')

  // ── PK columns per table ────────────────────────────────────────────────
  const PK_COL = {
    hasil_tes_klasifikasi: 'id',
    pembayaran_tahunan: 'id',
    psb_flow: 'id',
    psb_payment_receipt: 'id',
    tes_klasifikasi_plotting: 'id',
    penempatan_draft: 'id',
    spp_log: 'id',
    riwayat_pendidikan: 'id',
    absen_asrama: 'id',
    perizinan: 'id',
  }

  // ── Generate recovery SQL ───────────────────────────────────────────────
  console.log('\nLangkah 4/4: Membuat SQL recovery...')
  const sqlLines = [
    '-- ═══════════════════════════════════════════════════════════════════════',
    '-- RECOVERY GELOMBANG 2 — santri tertimpa import massal 8 Jul 2026',
    '-- Generated: ' + new Date().toISOString(),
    '-- REVIEW dulu sebelum dijalankan ke prod.',
    '-- Backup wajib sudah dibuat sebelum menjalankan ini.',
    '-- ═══════════════════════════════════════════════════════════════════════',
    '',
  ]

  const report = []

  for (const v of victims) {
    const { uuid, oldRow, newRow } = v
    const newUuid = randomUUID()

    sqlLines.push(`-- ═══ Korban uuid ${uuid}`)
    sqlLines.push(`--     asli (snapshot) : ${oldRow.nama_lengkap}`)
    sqlLines.push(`--     penimpa (prod)  : ${newRow.nama_lengkap}`)
    sqlLines.push(`--     ${newRow.nama_lengkap} dipindah ke uuid baru ${newUuid}`)
    sqlLines.push('')

    // 1) INSERT baris santri baru untuk PENIMPA = salinan penuh row prod, uuid + nis diganti
    const tempNis = `TMP-${newUuid.slice(0, 8)}`
    const cols = Object.keys(newRow)
    const vals = cols.map(c => {
      if (c === 'id') return sqlStr(newUuid)
      if (c === 'nis') return sqlStr(tempNis)
      return sqlStr(newRow[c])
    })
    sqlLines.push(
      `INSERT INTO santri (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')});`
    )
    sqlLines.push('')

    // 2) Pindahkan record anak MILIK PENIMPA (ada di prod, tak ada di snapshot) ke uuid baru
    const perTable = []

    for (const table of CHILD_TABLES) {
      const pkCol = PK_COL[table] || 'id'
      const prodRows = (newChildren[table] || []).filter(r => r.santri_id === uuid)
      const snapRows = (oldChildren[table] || []).filter(r => r.santri_id === uuid)

      if (prodRows.length === 0) continue

      const snapPKs = new Set(snapRows.map(r => String(r[pkCol])))

      const belongsPenimpa = prodRows.filter(r => !snapPKs.has(String(r[pkCol])))
      const shared = prodRows.filter(r => snapPKs.has(String(r[pkCol])))

      // Cek konflik: PK sama tapi isi berbeda (kemungkinan data korban ditimpa in-place)
      const conflicts = []
      for (const prodRow of shared) {
        const snapRow = snapRows.find(r => String(r[pkCol]) === String(prodRow[pkCol]))
        if (snapRow && JSON.stringify(prodRow) !== JSON.stringify(snapRow)) {
          conflicts.push({ pk: prodRow[pkCol], prod: prodRow, snapshot: snapRow })
        }
      }

      if (belongsPenimpa.length > 0) {
        const inList = belongsPenimpa.map(r => sqlStr(r[pkCol])).join(', ')
        sqlLines.push(
          `UPDATE "${table}" SET santri_id = ${sqlStr(newUuid)} ` +
          `WHERE santri_id = ${sqlStr(uuid)} AND "${pkCol}" IN (${inList});  ` +
          `-- ${belongsPenimpa.length} baris → ${newRow.nama_lengkap}`
        )
      }

      if (conflicts.length > 0) {
        sqlLines.push(
          `-- ⚠ KONFLIK ${table}: ${conflicts.length} baris ketimpa in-place (PK sama, isi beda).`
        )
        // Restore data asli korban dari snapshot
        for (const conflict of conflicts) {
          const snapRow = conflict.snapshot
          const setClauses = Object.keys(snapRow)
            .filter(c => c !== pkCol)
            .map(c => `"${c}" = ${sqlStr(snapRow[c])}`)
            .join(', ')
          sqlLines.push(
            `UPDATE "${table}" SET ${setClauses} WHERE "${pkCol}" = ${sqlStr(conflict.pk)};  ` +
            `-- restore data asli ${oldRow.nama_lengkap}`
          )
        }
      }

      perTable.push({
        table,
        milik_penimpa: belongsPenimpa.length,
        milik_korban: shared.length - conflicts.length,
        konflik_inplace: conflicts.length,
      })
    }
    sqlLines.push('')

    // 3) Kembalikan identitas korban ke uuid asli (dari snapshot)
    const idCols = Object.keys(oldRow).filter(c => c !== 'id')
    const setClause = idCols.map(c => `"${c}" = ${sqlStr(oldRow[c])}`).join(', ')
    sqlLines.push(
      `UPDATE santri SET ${setClause} WHERE id = ${sqlStr(uuid)};  -- pulihkan ${oldRow.nama_lengkap}`
    )
    sqlLines.push('')

    report.push({
      uuid,
      korban_asli: oldRow.nama_lengkap,
      korban_nis_asli: oldRow.nis,
      penimpa: newRow.nama_lengkap,
      penimpa_nis: newRow.nis,
      penimpa_uuid_baru: newUuid,
      tabel: perTable,
    })
  }



  writeFileSync(join(OUT_DIR, 'wave2-recovery.sql'), sqlLines.join('\n'))
  writeFileSync(join(OUT_DIR, 'wave2-report.json'), JSON.stringify(report, null, 2))

  const conflictCount = report.reduce(
    (n, r) => n + (r.tabel?.reduce((m, t) => m + (t.konflik_inplace || 0), 0) || 0), 0,
  )

  console.log(`\n════════════════════════════════════════════`)
  console.log(`Korban terdeteksi (gelombang 2) : ${report.length}`)
  console.log(`Konflik in-place               : ${conflictCount}`)
  console.log(`Output:`)
  console.log(`  scripts/out/wave2-recovery.sql`)
  console.log(`  scripts/out/wave2-report.json`)
  console.log(`════════════════════════════════════════════`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
