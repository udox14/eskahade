#!/usr/bin/env node
/**
 * reset-kredensial-cards.cjs
 *
 * Membersihkan data KREDENSIAL KARTU & PIN hasil uji coba (terbit kartu, cetak,
 * reset PIN) sebelum sistem keuangan baru dipakai secara resmi.
 *
 * RUANG LINGKUP (dan alasannya):
 *
 *   DIHAPUS  -- finance_credentials      data kartu fisik (token QR, status, riwayat terbit)
 *           -- finance_student_pins      hash PIN santri (opsional, --include-pins)
 *           -- finance_pin_audit_logs    audit set/reset/lock/unlock PIN (opsional, --include-audit)
 *
 *   TIDAK PERNAH DISENTUH -- finance_wallet_ledger     buku besar uang jajan
 *                         -- finance_payments          pembayaran
 *                         -- finance_payment_allocations, finance_payments_*,
 *                            finance_cash_sessions, finance_distributions, dll.
 *
 *   Alasan: ketiga tabel pertama adalah data operasional keamanan (bukan transaksi
 *   finansial). Tabel sisanya adalah transaksi finansial yang dilarang dihapus
 *   (AGENTS.md poin 6 & 7). Tidak ada foreign key yang menunjuk ke
 *   finance_credentials.id, sehingga penghapusan aman secara relasional --
 *   riwayat uang tetap terhubung ke santri.
 *
 * CATATAN: `finance_wallet_ledger.reference_id` berisi id pembayaran/koreksi,
 * BUKAN id kartu. Script tetap melaporkannya sebagai pengingat bila ada mutasi
 * uang jajan yang terkait dengan santri yang kartunya dihapus.
 *
 * PEMAKAIAN:
 *   node scripts/reset-kredensial-cards.cjs                          # dry-run (default, tidak mengubah apa pun)
 *   node scripts/reset-kredensial-cards.cjs --db eskahade-demo-db    # dry-run pada DB sandbox demo
 *   node scripts/reset-kredensial-cards.cjs --apply --confirm eskahade-db
 *
 * FLAG:
 *   --db <nama>          Target database D1. Default: eskahade-db (produksi).
 *   --apply              Benar-benar menjalankan penghapusan. Tanpa ini = dry-run.
 *   --confirm <token>    Wajib saat --apply. Token harus sama persis dengan --db.
 *   --include-pins       Ikut menghapus finance_student_pins (hash PIN).
 *   --include-audit      Ikut menghapus finance_pin_audit_logs.
 *   --remote             Default. Gunakan D1 remote.
 *   --local              Gunakan D1 lokal (untuk uji coba script).
 *   --force              Lanjut walau ada mutasi uang jajan santri terdampak.
 *   --json               Keluarkan laporan mesin (JSON) saja.
 *
 * URUTAN AMAN: jalankan dry-run, periksa angkanya, baru jalankan --apply.
 * Setiap --apply otomatis membuat backup JSON di scratch/reset-kredensial/.
 */

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_DB = 'eskahade-db'
const BACKUP_DIR = path.join(__dirname, '..', 'scratch', 'reset-kredensial')

// Tabel yang menjadi target pembersihan, dengan flag pengaktifnya.
const PURGE_TABLES = [
  {
    table: 'finance_credentials',
    label: 'Kartu fisik (token QR, status, riwayat terbit)',
    always: true,
    // Termasuk kartu ACTIVE maupun yang sudah REVOKED/LOST/BLOCKED.
    rowsSql: 'SELECT * FROM finance_credentials',
    countSql: 'SELECT COUNT(*) AS n FROM finance_credentials',
  },
  {
    table: 'finance_student_pins',
    label: 'Hash PIN santri (PBKDF2)',
    flag: 'includePins',
    rowsSql: 'SELECT * FROM finance_student_pins',
    countSql: 'SELECT COUNT(*) AS n FROM finance_student_pins',
  },
  {
    table: 'finance_pin_audit_logs',
    label: 'Audit log set/reset/lock/unlock PIN',
    flag: 'includeAudit',
    rowsSql: 'SELECT * FROM finance_pin_audit_logs',
    countSql: 'SELECT COUNT(*) AS n FROM finance_pin_audit_logs',
  },
]

function parseArgs(argv) {
  const opts = {
    db: DEFAULT_DB,
    apply: false,
    confirm: null,
    includePins: false,
    includeAudit: false,
    remote: true,
    force: false,
    json: false,
    config: null,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '--db':
        opts.db = argv[++i]
        break
      case '--apply':
        opts.apply = true
        break
      case '--confirm':
        opts.confirm = argv[++i]
        break
      case '--include-pins':
        opts.includePins = true
        break
      case '--include-audit':
        opts.includeAudit = true
        break
      case '--local':
        opts.remote = false
        break
      case '--remote':
        opts.remote = true
        break
      case '--force':
        opts.force = true
        break
      case '--json':
        opts.json = true
        break
      case '--config':
        opts.config = argv[++i]
        break
      case '--help':
      case '-h':
        opts.help = true
        break
      default:
        if (arg.startsWith('--')) {
          fail(`Argumen tidak dikenal: ${arg}. Jalankan dengan --help untuk daftar flag.`)
        }
    }
  }

  return opts
}

function fail(message) {
  console.error(`\n  GAGAL: ${message}\n`)
  process.exit(1)
}

/**
 * Menemukan wrangler yang bisa dieksekusi.
 * Prioritas: entry JS lokal (dijalankan via node) -> shim .cmd lokal -> PATH.
 * Entry JS dipakai lebih dulu karena:
 *  - tidak bergantung pada shim shell (wrangler.cmd / wrangler.ps1), dan
 *  - Node >= 18 tanpa shell menolak mengeksekusi berkas .cmd (EINVAL),
 * sehingga argumen SQL tetap terkirim utuh sebagai satu argumen.
 */
function resolveWrangler() {
  const repoRoot = path.join(__dirname, '..')

  const localEntry = path.join(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  if (fs.existsSync(localEntry)) {
    return { command: process.execPath, prefixArgs: [localEntry] }
  }

  const localBin = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'
  )
  if (fs.existsSync(localBin)) {
    return { command: localBin, prefixArgs: [], needsShell: process.platform === 'win32' }
  }

  return { command: 'wrangler', prefixArgs: [] }
}

const WRANGLER = resolveWrangler()

/**
 * Menjalankan query dan mengembalikan baris hasil.
 * Melempar Error bila gagal -- pemanggil yang memutuskan apakah kegagalan itu fatal.
 */
function queryRows(opts, sql) {
  const args = [
    ...WRANGLER.prefixArgs,
    'd1',
    'execute',
    opts.db,
    opts.remote ? '--remote' : '--local',
    '--json',
    '--command',
    sql,
  ]
  if (opts.config) args.push('--config', opts.config)

  const result = spawnSync(WRANGLER.command, args, {
    encoding: 'utf8',
    // Tanpa shell: SQL dikirim sebagai satu argumen utuh. Dengan shell, spasi di
    // dalam --command akan dipecah oleh cmd.exe menjadi banyak argumen.
    shell: WRANGLER.needsShell === true,
    maxBuffer: 64 * 1024 * 1024,
  })

  if (result.error) {
    throw new Error(
      `Tidak dapat menjalankan wrangler: ${result.error.message}\n` +
        '  Pastikan wrangler terpasang (npm i) dan Anda sudah login (npx wrangler login).'
    )
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim()
    throw new Error(`wrangler d1 execute gagal (exit ${result.status}).\n${detail}`)
  }

  const stdout = (result.stdout || '').trim()
  if (!stdout) return []

  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error(
      `Keluaran wrangler bukan JSON yang valid. Pastikan wrangler terpasang dan sudah login.\nCuplikan: ${stdout.slice(0, 400)}`
    )
  }

  // Bentuk keluaran: [{ results: [...], success: true, meta: {...} }, ...]
  const first = Array.isArray(parsed) ? parsed[0] : parsed
  if (first && first.success === false) {
    throw new Error(`Query ditolak oleh D1: ${JSON.stringify(first).slice(0, 400)}`)
  }
  return (first && first.results) || []
}

/** Versi queryRows yang menghentikan script bila query gagal. */
function runWrangler(opts, sql) {
  try {
    return queryRows(opts, sql)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

/** Cek tabel ada; query akan gagal bila tabel tidak eksis. */
function tableExists(opts, table) {
  try {
    queryRows(opts, `SELECT COUNT(*) AS n FROM ${table}`)
    return true
  } catch {
    return false
  }
}

function numberedList(rows, columns, limit = 8) {
  return rows.slice(0, limit).map((row, index) => {
    const parts = columns
      .filter((c) => row[c] !== null && row[c] !== undefined && row[c] !== '')
      .map((c) => `${c}=${String(row[c]).slice(0, 40)}`)
    return `      ${index + 1}. ${parts.join('  ')}`
  })
}

function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) {
    console.log(
      [
        '',
        '  Reset data kredensial kartu & PIN (hasil uji coba) sebelum go-live.',
        '',
        '  node scripts/reset-kredensial-cards.cjs [opsi]',
        '',
        '  --db <nama>        Target D1 (default: eskahade-db)',
        '  --apply            Eksekusi penghapusan (default: dry-run)',
        '  --confirm <token>  Wajib saat --apply; harus sama dengan nilai --db',
        '  --include-pins     Ikut hapus hash PIN santri',
        '  --include-audit    Ikut hapus audit log PIN',
        '  --local            Pakai D1 lokal, bukan remote',
        '  --force            Lanjut walau ada mutasi uang jajan santri terdampak',
        '  --json             Keluaran JSON saja',
        '  --config <path>    Path wrangler config (opsional, untuk uji coba)',
        '',
      ].join('\n')
    )
    return
  }

  // --- Gerbang 1: konfirmasi eksplisit sebelum menulis ---------------------
  if (opts.apply && opts.confirm !== opts.db) {
    fail(
      `Mode --apply butuh konfirmasi yang cocok.\n` +
        `  Target  : ${opts.db}\n` +
        `  Perintah: node scripts/reset-kredensial-cards.cjs --db ${opts.db} --apply --confirm ${opts.db}`
    )
  }

  const log = opts.json ? () => {} : (...args) => console.log(...args)
  const report = {
    target: opts.db,
    mode: opts.remote ? 'remote' : 'local',
    apply: opts.apply,
    generatedAt: new Date().toISOString(),
    tables: [],
    walletImpact: null,
    backupPath: null,
  }

  log('')
  log('  ================================================================')
  log('   RESET DATA KREDENSIAL KARTU & PIN')
  log('  ================================================================')
  log(`   Target database : ${opts.db} (${opts.remote ? 'remote' : 'local'})`)
  log(`   Mode            : ${opts.apply ? 'APPLY (menghapus data)' : 'DRY-RUN (tidak mengubah apa pun)'}`)
  log('')

  // --- Kumpulkan rencana pembersihan -------------------------------------
  const planned = PURGE_TABLES.filter((t) => t.always || opts[t.flag])

  log('   Tabel yang akan dibersihkan:')
  for (const target of planned) {
    if (!tableExists(opts, target.table)) {
      log(`     - ${target.table} -- dilewati (tabel tidak ada)`)
      continue
    }
    const countRows = runWrangler(opts, target.countSql)
    const count = Number(countRows[0]?.n ?? 0)
    const sampleRows = count > 0 ? runWrangler(opts, `${target.rowsSql} LIMIT 8`) : []
    const sampleColumns = sampleRows.length > 0 ? Object.keys(sampleRows[0]) : []

    report.tables.push({ table: target.table, label: target.label, rows: count })
    log(`     - ${target.table} : ${count} baris  (${target.label})`)
    if (sampleRows.length > 0) {
      log(`       contoh: ${sampleRows.length} baris pertama dari ${count}:`)
      numberedList(sampleRows, sampleColumns, 8).forEach((line) => log(line))
    }
  }

  const totalRows = report.tables.reduce((sum, t) => sum + t.rows, 0)

  if (!opts.includePins && tableExists(opts, 'finance_student_pins')) {
    const pinRows = runWrangler(opts, 'SELECT COUNT(*) AS n FROM finance_student_pins')
    const pinCount = Number(pinRows[0]?.n ?? 0)
    if (pinCount > 0) {
      log('')
      log(`   CATATAN: ${pinCount} PIN santri TIDAK ikut dihapus.`)
      log('            Tambahkan --include-pins bila PIN hasil uji juga ingin dibersihkan.')
    }
  }

  if (!opts.includeAudit && tableExists(opts, 'finance_pin_audit_logs')) {
    const auditRows = runWrangler(opts, 'SELECT COUNT(*) AS n FROM finance_pin_audit_logs')
    const auditCount = Number(auditRows[0]?.n ?? 0)
    if (auditCount > 0) {
      log('')
      log(`   CATATAN: ${auditCount} baris audit log PIN TIDAK ikut dihapus.`)
      log('            Tambahkan --include-audit bila ingin ikut dibersihkan.')
    }
  }

  const allTablesPresent = tableExists(opts, 'finance_credentials')

  // --- Pemeriksaan dampak keuangan (tidak pernah dihapus) ----------------
  log('')
  log('   Pemeriksaan data KEUANGAN (tidak akan dihapus):')

  let walletRows = []
  if (!allTablesPresent) {
    log('     - Tabel finance_credentials tidak ada pada database ini. Tidak ada yang dibersihkan.')
  } else if (!tableExists(opts, 'finance_wallet_ledger')) {
    log('     - Tabel finance_wallet_ledger tidak ada pada database ini; pemeriksaan dilewati.')
  } else {
    walletRows = runWrangler(
      opts,
      `SELECT wl.santri_id,
              COUNT(*) AS mutasi,
              COALESCE(SUM(CASE WHEN wl.direction = 'IN' THEN wl.amount ELSE -wl.amount END), 0) AS saldo
       FROM finance_wallet_ledger wl
       WHERE wl.santri_id IN (SELECT DISTINCT santri_id FROM finance_credentials)
       GROUP BY wl.santri_id
       ORDER BY mutasi DESC`
    )
  }

  report.walletImpact = {
    santriTerdampak: walletRows.length,
    catatan:
      'Buku besar uang jajan TIDAK dihapus. Saldo uang jajan santri tetap utuh setelah kartu diterbitkan ulang.',
  }

  if (walletRows.length === 0) {
    log('     - Tidak ada mutasi uang jajan pada santri yang kartunya akan dihapus.')
  } else {
    log(`     - ${walletRows.length} santri punya mutasi uang jajan. Saldo mereka TETAP AMAN (tidak dihapus).`)
    walletRows.slice(0, 8).forEach((row, index) => {
      log(`       ${index + 1}. santri=${String(row.santri_id).slice(0, 20)}  mutasi=${row.mutasi}  saldo=${row.saldo}`)
    })
    log('     - Mutasi uang jajan adalah catatan finansial; DILARANG dihapus (AGENTS.md poin 6 & 7).')
  }

  // --- Ringkasan ---------------------------------------------------------
  log('')
  log(`   Total baris kredensial yang akan dihapus: ${totalRows}`)
  log('')

  if (!opts.apply) {
    log('   DRY-RUN selesai. Tidak ada data yang diubah.')
    log('   Untuk benar-benar menghapus, jalankan ulang dengan:')
    log('')
    log(`     node scripts/reset-kredensial-cards.cjs --db ${opts.db} --apply --confirm ${opts.db}${opts.includePins ? ' --include-pins' : ''}${opts.includeAudit ? ' --include-audit' : ''}`)
    log('')

    if (opts.json) console.log(JSON.stringify(report, null, 2))
    return
  }

  if (walletRows.length > 0 && !opts.force) {
    fail(
      `Ada ${walletRows.length} santri dengan mutasi uang jajan pada kartu yang akan dihapus.\n` +
        '  Mutasi tersebut TIDAK akan dihapus, tetapi kartu akan hilang.\n' +
        '  Periksa daftar di atas, lalu ulangi dengan --force bila sudah yakin.'
    )
  }

  // --- Gerbang 2: backup wajib sebelum menghapus -------------------------
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(BACKUP_DIR, `backup-${opts.db}-${stamp}.json`)

  const backup = { target: opts.db, mode: report.mode, createdAt: report.generatedAt, tables: {} }
  for (const target of planned) {
    if (!tableExists(opts, target.table)) continue
    backup.tables[target.table] = runWrangler(opts, target.rowsSql)
  }
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8')
  report.backupPath = backupPath

  log(`   Backup dibuat: ${backupPath}`)
  log('')

  // --- Gerbang 3: eksekusi dalam satu batch atomik -----------------------
  // D1 batch bersifat transaksional: semua pernyataan berhasil atau tidak sama sekali.
  const purgedTables = planned.filter((target) => tableExists(opts, target.table))

  if (purgedTables.length === 0) {
    log('   Tidak ada tabel yang bisa dibersihkan pada database ini. Selesai.')
    if (opts.json) console.log(JSON.stringify(report, null, 2))
    return
  }

  const deleteStatements = purgedTables
    .map((target) => `DELETE FROM ${target.table} WHERE 1=1;`)
    .join('\n')

  log('   Mengeksekusi penghapusan...')
  runWrangler(opts, deleteStatements)

  // Verifikasi dijalankan sebagai query terpisah supaya hasilnya benar-benar
  // terbaca (keluaran batch bisa tidak memuat results, sehingga klaim "bersih"
  // tidak boleh hanya bersandar pada batch).
  log('')
  log('   Hasil verifikasi setelah penghapusan:')

  let allClean = true
  const verification = []
  for (const target of purgedTables) {
    const rows = queryRows(
      opts,
      `SELECT '${target.table}' AS tabel, COUNT(*) AS sisa FROM ${target.table}`
    )
    const remaining = Number(rows[0]?.sisa ?? -1)
    verification.push({ tabel: target.table, sisa: remaining })
    if (remaining !== 0) allClean = false
    const status = remaining === 0 ? 'BERSIH' : `MASIH ADA ${remaining} BARIS`
    log(`     - ${target.table} : ${status}`)
  }
  report.verification = verification
  report.allClean = allClean

  if (!allClean) {
    fail(
      'Penghapusan tidak tuntas: masih ada baris tersisa pada tabel di atas.\n' +
        '  Backup tetap tersimpan di: ' +
        backupPath +
        '\n  Jangan lanjut go-live sebelum ini bersih.'
    )
  }

  if (!opts.json) {
    log('')
    log('   SELESAI. Modul kredensial kembali ke kondisi belum pernah dipakai.')
    log('   Semua santri akan tampil "Belum Ada Kartu" pada modul Kredensial.')
    log(`   Backup: ${backupPath}`)
    log('')
  }

  if (opts.json) console.log(JSON.stringify(report, null, 2))
}

if (require.main === module) {
  main()
}

module.exports = { PURGE_TABLES, parseArgs }
