#!/usr/bin/env node
/**
 * Runner idempoten migrasi 0135 POSKESTREN (alur pemeriksaan → penyerahan obat).
 *
 * Kenapa skrip, bukan file SQL murni?
 * - D1 selalu menegakkan foreign key; DROP TABLE poskestren_visit (yang
 *   direferensikan poskestren_prescription/visit_revision) dapat gagal.
 *   Karena itu migrasi memakai ALTER ADD COLUMN (tanpa rebuild tabel).
 * - ALTER ADD COLUMN tidak memiliki IF NOT EXISTS di SQLite, sehingga
 *   perlu cek kondisi per kolom agar aman dijalankan ulang (idempoten).
 * - Skrip juga membersihkan sisa tabel dari percobaan migrasi lama yang
 *   gagal (poskestren_visit_new / _legacy / _old).
 *
 * Pemakaian:
 *   node scripts/migrate-0135-obat-flow.mjs                 # DB produksi
 *   node scripts/migrate-0135-obat-flow.mjs --local         # D1 lokal
 *   node scripts/migrate-0135-obat-flow.mjs --db <nama> --remote
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

const args = process.argv.slice(2)
const isLocal = args.includes('--local')
const dbIndex = args.indexOf('--db')
const dbName = dbIndex >= 0 ? args[dbIndex + 1] : 'eskahade-db'

const COLUMNS = [
  ['temperature_celsius', 'REAL', ''],
  ['systolic_pressure', 'INTEGER', ''],
  ['diastolic_pressure', 'INTEGER', ''],
  ['weight_kg', 'REAL', ''],
  ['awaiting_medicine', 'INTEGER', 'NOT NULL DEFAULT 0 CHECK (awaiting_medicine IN (0,1))'],
]

function runWrangler(command) {
  const result = spawnSync(
    process.execPath,
    [wrangler, 'd1', 'execute', dbName, ...(isLocal ? ['--local'] : ['--remote']), '--json', '--command', command],
    { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 }
  )
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim().slice(0, 800)
    throw new Error(`wrangler gagal (${result.status}): ${detail}`)
  }
  let parsed
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    throw new Error(`Output wrangler bukan JSON: ${result.stdout.slice(0, 400)}`)
  }
  const first = parsed?.[0]
  if (first && first.success === false) {
    throw new Error(`Eksekusi SQL gagal: ${JSON.stringify(first.error || first).slice(0, 500)}`)
  }
  return first?.results ?? []
}

function tableExists(name) {
  return runWrangler(
    `SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = '${name}'`
  ).length > 0
}

function existingColumns(table) {
  return runWrangler(`SELECT name FROM pragma_table_info('${table}')`).map(row => row.name)
}

function apply(sql, label) {
  process.stdout.write(`• ${label} ... `)
  try {
    runWrangler(sql)
    process.stdout.write('OK\n')
  } catch (error) {
    process.stdout.write(`GAGAL: ${error.message}\n`)
    throw error
  }
}

async function main() {
  const target = `${isLocal ? 'lokal' : 'remote'} ${dbName}`
  console.log(`Migrasi 0135 POSKESTREN (alur obat) → ${target}\n`)

  if (!tableExists('poskestren_visit')) {
    console.error('✗ Tabel poskestren_visit tidak ditemukan.')
    console.error('  Modul POSKESTREN belum ada di database ini (mis. DB demo), migrasi dilewati.')
    process.exit(1)
  }

  // 1. Bersihkan sisa tabel dari percobaan migrasi rebuild lama (jika ada).
  for (const leftover of ['poskestren_visit_new', 'poskestren_visit_legacy', 'poskestren_visit_old']) {
    if (tableExists(leftover)) {
      const count = runWrangler(`SELECT COUNT(*) AS n FROM ${leftover}`)[0]?.n ?? 0
      console.log(`! Sisa tabel ${leftover} ditemukan (${count} baris).`)
      if (Number(count) > 0) {
        console.log('  Barisnya salinan dari poskestren_visit yang masih utuh — aman dibuang.')
      }
      apply(`DROP TABLE IF EXISTS ${leftover}`, `hapus sisa tabel ${leftover}`)
    }
  }

  // 2. Tambahkan kolom yang belum ada satu per satu (idempoten).
  const current = new Set(existingColumns('poskestren_visit'))
  let added = 0
  for (const [name, type, extra] of COLUMNS) {
    if (current.has(name)) {
      console.log(`= Kolom ${name} sudah ada — dilewati.`)
      continue
    }
    apply(
      `ALTER TABLE poskestren_visit ADD COLUMN ${name} ${type}${extra ? ' ' + extra : ''}`,
      `tambah kolom ${name}`
    )
    added++
  }

  // 3. Verifikasi akhir.
  const final = existingColumns('poskestren_visit')
  const missing = COLUMNS.filter(([name]) => !final.includes(name))
  if (missing.length) {
    console.error(`\n✗ Verifikasi gagal, kolom belum lengkap: ${missing.map(([n]) => n).join(', ')}`)
    process.exit(1)
  }

  console.log(`\n✓ Migrasi selesai. Kolom ditambahkan: ${added}, sudah ada: ${COLUMNS.length - added}.`)
  console.log('  Status: ALTER ADD COLUMN tidak menghapus data apa pun.')
  process.exit(0)
}

main().catch(error => {
  console.error(`\n✗ Migrasi gagal: ${error.message}`)
  process.exit(1)
})
