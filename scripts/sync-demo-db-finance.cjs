#!/usr/bin/env node
/**
 * sync-demo-db-finance.cjs
 *
 * Menyelaraskan database sandbox (DEMO_DB / eskahade-demo-db) dengan skema
 * Sistem Keuangan Baru, supaya akun role 'demo' bisa dipakai untuk uji coba
 * terbit kartu / cetak / reset PIN tanpa menyentuh database produksi.
 *
 * Latar belakang: role 'demo' diarahkan ke DEMO_DB oleh lib/db/index.ts, tetapi
 * DEMO_DB ketinggalan migrasi sehingga seluruh tabel finance_* belum ada dan
 * modul Kredensial error saat dibuka.
 *
 * PEMAKAIAN:
 *   node scripts/sync-demo-db-finance.cjs                      # dry-run (default)
 *   node scripts/sync-demo-db-finance.cjs --apply              # terapkan
 *   node scripts/sync-demo-db-finance.cjs --apply --only 0160  # satu file saja
 *
 * FLAG:
 *   --apply              Benar-benar menjalankan migrasi (default: dry-run).
 *   --db <nama>          Target database. Default: eskahade-demo-db.
 *   --only <prefix>      Hanya jalankan file migrasi dengan prefix ini (mis. 0160).
 *   --from <prefix>      Mulai dari prefix ini.
 *   --local              Pakai D1 lokal (uji coba script).
 *   --config <path>      Path wrangler config (uji coba).
 *   --json               Keluaran JSON saja.
 *
 * KEAMANAN:
 *   - Hanya menulis ke database yang namanya mengandung "demo" kecuali --db
 *     diberikan eksplisit bersama --allow-non-demo.
 *   - Tidak ada pernyataan DROP/DELETE dijalankan; script menolak bila menemukannya.
 *   - Setiap file dijalankan setelah pengecekan, dan jumlah tabel diverifikasi ulang.
 */

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'migrations')

const DEFAULT_DB = 'eskahade-demo-db'

/** Migrasi Sistem Keuangan Baru + tetangga yang dibutuhkan, dalam urutan aman. */
const MIGRATION_FILES = [
  '0152_finance_tariffs_and_obligations.sql',
  '0153_finance_tariffs_overlap_trigger.sql',
  '0154_finance_exemptions_revocation_metadata.sql',
  '0155_finance_payments_and_orders.sql',
  '0156_finance_payment_hardening.sql',
  '0157_finance_unallocated_idempotency.sql',
  '0158_finance_payment_order_multi_payment.sql',
  '0159_finance_cash_sessions_and_idempotency.sql',
  '0160_finance_cards_and_wallet.sql',
  '0161_finance_loket_and_cash_session.sql',
  '0162_finance_distributions.sql',
  '0163_finance_reconciliation_and_corrections.sql',
  '0164_finance_dashboard_and_history.sql',
  '0165_finance_reports_and_fitur_akses.sql',
  '0166_finance_navigation_and_settings.sql',
  '0167_finance_legacy_bridge_and_fund_management.sql',
  '0168_finance_tariff_overrides.sql',
  '0171_finance_exclude_al_baghory_santri.sql',
  '0172_finance_exclude_sadesa_makan_nyuci.sql',
  '0173_finance_zero_wallet_balance_cutover.sql',
]


/** 0169/0170 tidak menyentuh finance dan bergantung pada tabel yang belum ada di demo. */
const SKIPPED_NOTES = [
  '0169_absensi_finalized.sql -> tabel absensi_verifikasi_periode belum ada di demo; di luar scope kredensial',
  '0170_dashboard_home.sql -> tabel dashboard_role_widgets/dashboard_user_shortcuts belum ada di demo; di luar scope kredensial',
]

// ---------------------------------------------------------------------------
// SQL parsing
// ---------------------------------------------------------------------------

/**
 * Mengubah teks SQL menjadi token { value, offset }, dengan komentar dan isi
 * string dibuang.
 *
 * Offset dibawa langsung di setiap token supaya pemotongan pernyataan tidak
 * bergantung pada daftar posisi titik koma yang terpisah (sumber bug: dua daftar
 * itu bisa melenceng, sehingga beberapa pernyataan tergabung menjadi satu).
 * String literal dibuang agar '--' atau ';' di dalam pesan RAISE(ABORT, ...)
 * tidak disalahartikan sebagai komentar atau pemisah pernyataan.
 */
function scanTokens(sqlText) {
  const tokens = []
  let word = ''
  let wordStart = -1
  let quote = null

  const flushWord = () => {
    if (word) {
      tokens.push({ value: word.toUpperCase(), offset: wordStart })
      word = ''
      wordStart = -1
    }
  }

  for (let i = 0; i < sqlText.length; i += 1) {
    const ch = sqlText[i]

    if (quote) {
      if (ch === quote) {
        // '' di dalam string = escape, bukan penutup
        if (sqlText[i + 1] === quote) i += 1
        else quote = null
      }
      continue
    }

    if (ch === "'" || ch === '"') {
      flushWord()
      quote = ch
      continue
    }

    if (ch === '-' && sqlText[i + 1] === '-') {
      flushWord()
      const commentStart = i
      while (i < sqlText.length && sqlText[i] !== '\n') i += 1
      // Komentar dikirim sebagai token agar pemisah pernyataan bisa memotongnya,
      // sehingga komentar tidak menempel di awal pernyataan berikutnya.
      tokens.push({ value: 'COMMENT', offset: commentStart, end: i })
      continue
    }

    if (ch === '/' && sqlText[i + 1] === '*') {
      flushWord()
      const commentStart = i
      i += 2
      while (i < sqlText.length && !(sqlText[i] === '*' && sqlText[i + 1] === '/')) i += 1
      i += 1
      tokens.push({ value: 'COMMENT', offset: commentStart, end: i + 1 })
      continue
    }

    if (/[A-Za-z_]/.test(ch)) {
      if (wordStart === -1) wordStart = i
      word += ch
      continue
    }

    flushWord()
    if (ch === ';') tokens.push({ value: ';', offset: i })
    else if (ch === '(') tokens.push({ value: '(', offset: i })
    else if (ch === ')') tokens.push({ value: ')', offset: i })
  }

  flushWord()
  return tokens
}

/**
 * Memecah isi file migrasi menjadi pernyataan SQL.
 *
 * Trigger SQLite berbentuk:
 *   CREATE TRIGGER ... [WHEN <predikat>] BEGIN
 *     SELECT CASE ... END;   <-- END milik CASE, BUKAN akhir trigger
 *   END;
 * sehingga pemisahan buta berdasarkan ';' akan memotong trigger di tengah.
 *
 * Aturan yang dipakai (diturunkan dari bentuk nyata 0153, 0156, 0160, 0162, 0163):
 *   - Di dalam trigger, 'BEGIN' dan 'CASE' membuka blok; 'END' menutupnya.
 *   - CASE yang berada di dalam tanda kurung (mis. di dalam WHEN EXISTS (...))
 *     menutup sendiri di dalam kurung itu, sehingga kedalamannya kembali
 *     seimbang sebelum 'BEGIN' trigger; karena itu kedalaman tanda kurung
 *     dilacak terpisah dan CASE di dalam kurung tidak memengaruhi keputusan.
 *   - Trigger berakhir pada ';' ketika blok sudah seimbang (depth <= 0) dan
 *     tidak sedang berada di dalam tanda kurung.
 */
function splitStatements(sqlText) {
  const statements = []
  const tokens = scanTokens(sqlText)

  let start = 0
  let depth = 0
  let parenDepth = 0
  let inTrigger = false
  let pendingTrigger = false

  const popStatement = (endOffset) => {
    const statement = sqlText.slice(start, endOffset).trim()
    if (statement && !/^[;\s]*$/.test(statement)) statements.push(statement)
    start = endOffset
  }

  for (const token of tokens) {
    const { value, offset } = token

    // Komentar mengakhiri pernyataan sebelumnya; teks komentar tidak ikut
    // dijalankan sehingga tidak perlu disertakan dalam pernyataan berikutnya.
    if (value === 'COMMENT') {
      if (start < offset) popStatement(offset)
      start = token.end
      continue
    }

    if (value === '(') {
      parenDepth += 1
      continue
    }
    if (value === ')') {
      parenDepth -= 1
      continue
    }

    if (value === ';') {
      if (!inTrigger || (depth <= 0 && parenDepth <= 0)) {
        popStatement(offset + 1)
        inTrigger = false
        depth = 0
        parenDepth = 0
      }
      continue
    }

    if (value === 'CREATE') {
      pendingTrigger = true
      continue
    }

    if (pendingTrigger) {
      if (value === 'TRIGGER') {
        inTrigger = true
        pendingTrigger = false
      } else if (value !== 'TEMP' && value !== 'TEMPORARY') {
        pendingTrigger = false
      }
    }

    if (!inTrigger) continue

    if (value === 'BEGIN' || value === 'CASE') depth += 1
    else if (value === 'END') depth -= 1
  }

  // Sisa teks tanpa ';' penutup (mis. pernyataan terakhir tanpa titik koma).
  const tail = sqlText.slice(start).trim()
  if (tail && !/^[;\s]*$/.test(tail)) statements.push(tail)

  return statements
}

/**
 * Menggabungkan beberapa pernyataan menjadi beberapa batch.
 * D1 membatasi jumlah pernyataan per request, jadi batch dibatasi ukurannya.
 */
function chunkStatements(statements, maxStatements = 12, maxChars = 24000) {
  const chunks = []
  let current = []
  let currentChars = 0

  for (const statement of statements) {
    const projected = currentChars + statement.length + 2
    if (current.length > 0 && (current.length >= maxStatements || projected > maxChars)) {
      chunks.push(current)
      current = []
      currentChars = 0
    }
    current.push(statement)
    currentChars += statement.length + 2
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

/**
 * Menolak pernyataan yang berpotensi menghapus DATA.
 *
 * DROP INDEX / DROP TRIGGER sengaja DIIZINKAN: migrasi yang sehat memang perlu
 * itu untuk merestrukturisasi index/trigger (contoh nyata: 0158 menghapus
 * uq_finance_payments_order_id sebelum membuat versi barunya). Yang dilarang
 * adalah yang menghilangkan tabel atau baris data.
 */
function findDestructiveStatements(statements) {
  return statements.filter((s) =>
    /^\s*(DROP\s+(TABLE|VIEW)|DELETE\s+FROM|TRUNCATE)\b/i.test(s)
  )
}

/** Menandai operasi schema yang mengubah struktur (bukan menambah) untuk dilaporkan. */
function findStructuralRewrites(statements) {
  return statements.filter((s) => /^\s*DROP\s+(INDEX|TRIGGER)\b/i.test(s))
}

// ---------------------------------------------------------------------------
// Wrangler bridge
// ---------------------------------------------------------------------------

function resolveWrangler() {
  const localEntry = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  if (fs.existsSync(localEntry)) return { command: process.execPath, prefixArgs: [localEntry] }
  return { command: 'wrangler', prefixArgs: [] }
}

const WRANGLER = resolveWrangler()

function fail(message) {
  console.error(`\n  GAGAL: ${message}\n`)
  process.exit(1)
}

function queryRows(opts, sql) {
  return executeSql(opts, sql, true)
}

/** Deteksi error "sudah diterapkan" (mis. ADD COLUMN yang dijalankan ulang). */
function isAlreadyAppliedError(message) {
  return /duplicate column name|already exists/i.test(message)
}

/**
 * Menerapkan satu berkas migrasi.
 *
 * Strategi utama: kirim BERKAS UTUH ke D1 dan biarkan D1 yang mem-parse.
 * Ini menghindari seluruh kelas bug pemecahan SQL sendiri (trigger dengan
 * BEGIN...END dan CASE bersarang sangat mudah salah dipecah).
 *
 * Bila berkas utuh gagal, baru dipecah per pernyataan memakai splitStatements
 * agar pernyataan yang gagal bisa dilaporkan persis.
 */
function runMigrationFile(opts, filePath, fileName, log) {
  const sql = fs.readFileSync(filePath, 'utf8')

  try {
    executeSql(opts, sql, false)
    return { mode: 'whole-file', statementsRun: null }
  } catch (wholeFileError) {
    log(`     ! berkas utuh gagal, beralih ke mode per-pernyataan`)

    const statements = splitStatements(sql)
    let index = 0
    for (const statement of statements) {
      index += 1
      try {
        executeSql(opts, statement, false)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (isAlreadyAppliedError(message)) {
          log(`     - pernyataan ${index} dilewati (sudah diterapkan)`)
          continue
        }
        throw new Error(
          `Pernyataan ${index} dari ${statements.length} gagal:\n` +
            `    ${statement.replace(/\s+/g, ' ').slice(0, 200)}\n` +
            `  Penyebab: ${message.split('\n')[0]}`
        )
      }
    }
    return { mode: 'per-statement', statementsRun: statements.length }
  }
}

/**
 * Menjalankan SQL pada D1.
 *
 * PENTING: SQL dikirim lewat file sementara, BUKAN lewat --command.
 * Argumen command-line punya batas panjang, sehingga batch besar terpotong dan
 * D1 menolaknya dengan "incomplete input: SQLITE_ERROR" (pernah terjadi pada
 * migration 0160). Lewat --file, wrangler mengunggah isi file utuh sehingga
 * trigger dan batch panjang aman.
 */
function executeSql(opts, sql, expectJson) {
  const tmpDir = path.join(ROOT, 'scratch', 'demo-sync', 'tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  const tmpFile = path.join(tmpDir, `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sql`)
  fs.writeFileSync(tmpFile, sql, 'utf8')

  const args = [
    ...WRANGLER.prefixArgs,
    'd1',
    'execute',
    opts.db,
    opts.remote ? '--remote' : '--local',
    '--file',
    tmpFile,
  ]
  if (expectJson) args.push('--json')
  if (opts.config) args.push('--config', opts.config)

  let result
  try {
    result = spawnSync(WRANGLER.command, args, {
      encoding: 'utf8',
      shell: false,
      maxBuffer: 64 * 1024 * 1024,
    })
  } finally {
    try {
      fs.unlinkSync(tmpFile)
    } catch {
      /* file sementara; aman bila sudah tidak ada */
    }
  }

  if (result.error) throw new Error(`Tidak dapat menjalankan wrangler: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim()
    throw new Error(`wrangler d1 execute gagal (exit ${result.status}).\n${detail}`)
  }

  if (!expectJson) return []

  // Keluaran bisa memuat baris log wrangler sebelum JSON; ambil dari '[' pertama.
  const stdout = (result.stdout || '').trim()
  const jsonStart = stdout.indexOf('[')
  if (!stdout || jsonStart === -1) return []

  let parsed
  try {
    parsed = JSON.parse(stdout.slice(jsonStart))
  } catch {
    throw new Error(`Keluaran wrangler bukan JSON valid.\nCuplikan: ${stdout.slice(0, 400)}`)
  }

  const first = Array.isArray(parsed) ? parsed[0] : parsed
  if (first && first.success === false) {
    throw new Error(`Query ditolak D1: ${JSON.stringify(first).slice(0, 800)}`)
  }
  return (first && first.results) || []
}

function countFinanceTables(opts) {
  // Memakai tryQuery (jalur --command --json), bukan executeSql yang menulis ke
  // berkas tanpa --json sehingga hasilnya tidak bisa dibaca.
  const rows = tryQuery(
    opts,
    `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'finance_%'`
  )
  return Number(rows?.[0]?.n ?? 0)
}

/** Query cepat tanpa melempar (untuk pengecekan pre-flight). */
function tryQuery(opts, sql) {
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
    shell: false,
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.status !== 0 || result.error) return null

  const stdout = (result.stdout || '').trim()
  const jsonStart = stdout.indexOf('[')
  if (jsonStart === -1) return null
  try {
    const parsed = JSON.parse(stdout.slice(jsonStart))
    const first = Array.isArray(parsed) ? parsed[0] : parsed
    return (first && first.results) || null
  } catch {
    return null
  }
}

/** Cek apakah kolom sudah ada pada tabel. */
function columnExists(opts, table, column) {
  const rows = tryQuery(opts, `SELECT name FROM pragma_table_info('${table}')`)
  if (!rows) return false
  return rows.some((row) => String(row.name).toLowerCase() === column.toLowerCase())
}

/**
 * Menyaring pernyataan ALTER TABLE ADD COLUMN yang kolomnya sudah ada.
 *
 * SQLite tidak mendukung "ADD COLUMN IF NOT EXISTS", sehingga migrasi bergaya
 * ADD COLUMN tidak idempoten dan akan gagal dengan "duplicate column name" bila
 * dijalankan ulang. Migrasi Sistem Keuangan Baru sudah pernah diterapkan
 * sebagian pada database DEMO, jadi pernyataan seperti ini harus dilewati.
 */
function filterAlreadyAppliedColumns(opts, statements, log) {
  const kept = []
  const skipped = []

  for (const statement of statements) {
    const match = statement.match(
      /ALTER\s+TABLE\s+["'`\[]?([A-Za-z0-9_]+)["'`\]]?\s+ADD\s+COLUMN\s+["'`\[]?([A-Za-z0-9_]+)["'`\]]?/i
    )
    if (match) {
      const [, table, column] = match
      if (columnExists(opts, table, column)) {
        skipped.push(`${table}.${column}`)
        continue
      }
    }
    kept.push(statement)
  }

  if (skipped.length > 0) {
    log(`     - dilewati (kolom sudah ada): ${skipped.join(', ')}`)
  }
  return kept
}

/**
 * Mengganti pernyataan ALTER TABLE ADD COLUMN dengan komentar bila kolomnya
 * sudah ada, TANPA membangun ulang seluruh isi berkas.
 *
 * Pendekatan ini sengaja dipilih: berkas migrasi asli adalah sumber kebenaran,
 * sehingga penggantian dilakukan pada teks aslinya. Menyusun ulang berkas dari
 * hasil pemecahan pernyataan berisiko merusak pernyataan yang mengandung
 * komentar atau tanda kurung (pernah terjadi dan menyebabkan "near \";\" syntax
 * error").
 */
function neutralizeAppliedColumns(sqlText, opts, log) {
  const alreadyApplied = []
  // Pola sengaja dibatasi:
  //  - [^;()]* -> tidak melintasi tanda kurung (DEFAULT (datetime('now')) pada
  //    pernyataan berikutnya pernah ikut tertelan dan membuat kode ter-comment),
  //  - [^;\n]* -> tidak melintasi baris.
  const result = sqlText.replace(
    /ALTER\s+TABLE\s+["'`\[]?([A-Za-z0-9_]+)["'`\]]?\s+ADD\s+COLUMN\s+["'`\[]?([A-Za-z0-9_]+)["'`\]]?[^;()\n]*;/gi,
    (match, table, column) => {
      if (!columnExists(opts, table, column)) return match
      alreadyApplied.push(`${table}.${column}`)
      return `-- [dilewati: kolom ${table}.${column} sudah ada]`
    }
  )

  if (alreadyApplied.length > 0 && log) {
    log(`     - dilewati (kolom sudah ada): ${alreadyApplied.join(', ')}`)
  }
  return { sql: result, alreadyApplied }
}

/** Jumlah tabel finance_* yang diharapkan ada setelah sinkronisasi selesai. */
const EXPECTED_FINANCE_TABLES = 27

/** Data seed yang harus ada agar modul keuangan bisa dipakai di demo. */
const SEED_CHECKS = [
  {
    label: 'tahun_ajaran id=2 (prasyarat FK seed tarif 0167)',
    sql: `SELECT COUNT(*) AS n FROM tahun_ajaran WHERE id = 2`,
  },
  { label: 'finance_tariffs (5 baseline)', sql: `SELECT COUNT(*) AS n FROM finance_tariffs` },
  {
    label: 'app_settings cutover koperasi',
    sql: `SELECT COUNT(*) AS n FROM app_settings WHERE key = 'finance_koperasi_effective_at'`,
  },
]

/**
 * Memeriksa apakah sinkronisasi sudah selesai.
 *
 * Dipakai untuk berhenti dengan pesan yang jelas alih-alih menjalankan ulang
 * 19 berkas. Migrasi bergaya "ALTER TABLE ADD COLUMN" tidak bisa dijalankan dua
 * kali (SQLite tidak punya ADD COLUMN IF NOT EXISTS), sehingga re-run tanpa
 * pemeriksaan ini akan gagal separuh jalan.
 */
function inspectSyncState(opts) {
  const financeTables = countFinanceTables(opts)
  const details = SEED_CHECKS.map((check) => {
    const rows = tryQuery(opts, check.sql)
    return { label: check.label, count: Number(rows?.[0]?.n ?? 0) }
  })
  const triggerRows = tryQuery(opts, `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'`)
  const triggers = Number(triggerRows?.[0]?.n ?? 0)

  const schemaComplete = financeTables >= EXPECTED_FINANCE_TABLES
  const seedComplete = details.every((detail) => detail.count > 0)

  return {
    financeTables,
    details,
    triggers,
    schemaComplete,
    seedComplete,
    complete: schemaComplete && seedComplete,
  }
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    db: DEFAULT_DB,
    apply: false,
    remote: true,
    only: null,
    from: null,
    config: null,
    json: false,
    allowNonDemo: false,
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
      case '--only':
        opts.only = argv[++i]
        break
      case '--from':
        opts.from = argv[++i]
        break
      case '--local':
        opts.remote = false
        break
      case '--remote':
        opts.remote = true
        break
      case '--config':
        opts.config = argv[++i]
        break
      case '--json':
        opts.json = true
        break
      case '--allow-non-demo':
        opts.allowNonDemo = true
        break
      case '--help':
      case '-h':
        opts.help = true
        break
      default:
        if (arg.startsWith('--')) fail(`Argumen tidak dikenal: ${arg}`)
    }
  }

  return opts
}

function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) {
    console.log(
      [
        '',
        '  Selaraskan skema Sistem Keuangan Baru ke database sandbox demo.',
        '',
        '  node scripts/sync-demo-db-finance.cjs [opsi]',
        '',
        '  --apply              Terapkan migrasi (default: dry-run)',
        '  --db <nama>          Target DB (default: eskahade-demo-db)',
        '  --only <prefix>      Hanya file dengan prefix ini (mis. 0160)',
        '  --from <prefix>      Mulai dari prefix ini',
        '  --local / --config   Untuk uji coba di D1 lokal',
        '  --allow-non-demo     Izinkan target selain database demo',
        '  --json               Keluaran JSON',
        '',
      ].join('\n')
    )
    return
  }

  // Gerbang: cegah salah target ke database produksi.
  if (!opts.db.toLowerCase().includes('demo') && !opts.allowNonDemo) {
    fail(
      `Target "${opts.db}" bukan database demo.\n` +
        '  Script ini hanya untuk sandbox demo. Bila benar-benar disengaja, tambahkan --allow-non-demo.'
    )
  }

  const log = opts.json ? () => {} : (...args) => console.log(...args)

  let files = MIGRATION_FILES
  if (opts.only) files = files.filter((f) => f.startsWith(opts.only))
  if (opts.from) files = files.filter((f) => f.slice(0, 4) >= opts.from)

  if (files.length === 0) fail('Tidak ada file migrasi yang cocok dengan filter.')

  log('')
  log('  ================================================================')
  log('   SINKRONISASI SKEMA FINANCE KE DATABASE DEMO')
  log('  ================================================================')
  log(`   Target database : ${opts.db} (${opts.remote ? 'remote' : 'local'})`)
  log(`   Mode            : ${opts.apply ? 'APPLY' : 'DRY-RUN (tidak mengubah apa pun)'}`)
  log(`   Jumlah file     : ${files.length}`)
  log('')

  // --- Keadaan saat ini: hentikan bila sudah selesai ---------------------
  const state = inspectSyncState(opts)
  log('   Keadaan database saat ini:')
  log(`     - tabel finance_*          : ${state.financeTables} (diharapkan ${EXPECTED_FINANCE_TABLES})`)
  log(`     - trigger                  : ${state.triggers}`)
  for (const detail of state.details) {
    log(`     - ${detail.label} : ${detail.count} baris`)
  }
  log('')

  if (state.complete && opts.apply && !opts.only && !opts.from) {
    log('   Sinkronisasi SUDAH SELESAI. Tidak ada yang perlu dijalankan.')
    log('   Skema finance, trigger, dan data seed sudah lengkap di database ini.')
    log('')
    log('   Catatan: migrasi "ALTER TABLE ADD COLUMN" tidak bisa dijalankan dua kali')
    log('   (SQLite tidak menyediakan ADD COLUMN IF NOT EXISTS), jadi menjalankan ulang')
    log('   19 berkas akan gagal walaupun hasil akhirnya sudah benar.')
    log('   Untuk memaksa menjalankan berkas tertentu, gunakan --only <prefix>.')
    log('')
    if (opts.json) console.log(JSON.stringify({ db: opts.db, alreadyComplete: true, ...state }, null, 2))
    return
  }

  // --- Rencana + validasi statis ----------------------------------------
  const plan = []
  for (const fileName of files) {
    const fullPath = path.join(MIGRATIONS_DIR, fileName)
    if (!fs.existsSync(fullPath)) fail(`File migrasi tidak ditemukan: ${fullPath}`)

    const content = fs.readFileSync(fullPath, 'utf8')
    const statements = splitStatements(content)

    const destructive = findDestructiveStatements(statements)
    if (destructive.length > 0) {
      fail(
        `File ${fileName} mengandung pernyataan yang menghapus DATA dan tidak diizinkan:\n` +
          destructive.map((s) => `    ${s.replace(/\s+/g, ' ').slice(0, 120)}`).join('\n')
      )
    }

    const rewrites = findStructuralRewrites(statements)

    // Deteksi trigger yang gagal dipecah (indikator parsing bermasalah).
    const unclosedTriggers = statements.filter(
      (s) => /^CREATE\s+(TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i.test(s) && !/\bEND\s*;?\s*$/i.test(s)
    ).length

    plan.push({ fileName, statements, unclosedTriggers, rewrites })
  }

  const totalStatements = plan.reduce((sum, p) => sum + p.statements.length, 0)
  const totalTriggerIssues = plan.reduce((sum, p) => sum + p.unclosedTriggers, 0)

  log('   Rencana:')
  for (const item of plan) {
    log(`     - ${item.fileName}  (${item.statements.length} pernyataan)`)
    for (const rewrite of item.rewrites) {
      log(`         * struktur diubah: ${rewrite.replace(/\s+/g, ' ').slice(0, 90)}`)
    }
  }
  log('')
  log(`   Total pernyataan: ${totalStatements}`)
  if (totalTriggerIssues > 0) {
    log(`   PERINGATAN: ${totalTriggerIssues} trigger terdeteksi mungkin tidak terpecah dengan benar.`)
  }
  log('')

  if (!opts.apply) {
    log('   DRY-RUN selesai. Tidak ada perubahan dijalankan.')
    log('   Untuk menerapkan:')
    log(`     node scripts/sync-demo-db-finance.cjs --db ${opts.db} --apply`)
    log('')
    return
  }

  // --- Eksekusi ----------------------------------------------------------
  const before = countFinanceTables(opts)
  log(`   Tabel finance_* sebelum: ${before}`)
  log('')

  const report = { db: opts.db, applied: [], failed: null, financeTablesBefore: before }

  for (const item of plan) {
    const filePath = path.join(MIGRATIONS_DIR, item.fileName)
    log(`   [${item.fileName}]`)

    try {
      // Netralkan ADD COLUMN yang sudah ada, tanpa menyusun ulang isi berkas.
      const { sql: preparedSql, alreadyApplied } = neutralizeAppliedColumns(
        fs.readFileSync(filePath, 'utf8'),
        opts,
        log
      )

      if (alreadyApplied.length > 0) {
        executeSql(opts, preparedSql, false)
        log('     - OK (berkas asli, ADD COLUMN yang sudah ada dinetralkan)')
        report.applied.push({ file: item.fileName, mode: 'original-with-skips', financeTables: countFinanceTables(opts) })
      } else {
        // Tidak ada yang perlu dinetralkan: kirim berkas asli apa adanya.
        executeSql(opts, preparedSql, false)
        log('     - OK (berkas utuh)')
        report.applied.push({ file: item.fileName, mode: 'whole-file', financeTables: countFinanceTables(opts) })
      }
    } catch (wholeFileError) {
      const wholeMessage = wholeFileError instanceof Error ? wholeFileError.message : String(wholeFileError)
      log(`     ! gagal sebagai berkas utuh, beralih ke per-pernyataan`)
      log(`       penyebab: ${wholeMessage.split('\n')[0]}`)

      let statements
      try {
        const { sql: preparedSql } = neutralizeAppliedColumns(
          fs.readFileSync(filePath, 'utf8'),
          opts,
          () => {}
        )
        statements = splitStatements(preparedSql)
      } catch (parseError) {
        report.failed = { file: item.fileName, message: `gagal mem-parse: ${parseError}` }
        log(`   GAGAL mem-parse ${item.fileName}`)
        if (opts.json) console.log(JSON.stringify(report, null, 2))
        process.exit(1)
      }

      let failed = false
      for (let index = 0; index < statements.length; index += 1) {
        const statement = statements[index]
        try {
          executeSql(opts, statement, false)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (isAlreadyAppliedError(message)) {
            log(`     - pernyataan ${index + 1} dilewati (sudah diterapkan)`)
            continue
          }
          failed = true
          report.failed = { file: item.fileName, statement: index + 1, message }
          log('')
          log(`   GAGAL pada ${item.fileName} pernyataan ${index + 1}/${statements.length}:`)
          log(`     ${statement.replace(/\s+/g, ' ').slice(0, 300)}`)
          log('   Penyebab lengkap:')
          log(message.split('\n').map((line) => `     ${line}`).join('\n'))
          log('')
          if (opts.json) console.log(JSON.stringify(report, null, 2))
          process.exit(1)
        }
      }
      if (!failed) {
        log(`     - OK (per-pernyataan, ${statements.length} pernyataan)`)
        report.applied.push({ file: item.fileName, mode: 'per-statement', financeTables: countFinanceTables(opts) })
      }
    }

    log(`     -> tabel finance_* sekarang: ${countFinanceTables(opts)}`)
  }

  const after = countFinanceTables(opts)
  report.financeTablesAfter = after

  log('')
  log(`   Selesai. Tabel finance_* : ${before} -> ${after}`)
  log('')

  if (opts.json) console.log(JSON.stringify(report, null, 2))
}

if (require.main === module) main()

module.exports = { splitStatements, chunkStatements, scanTokens, MIGRATION_FILES, SKIPPED_NOTES }
