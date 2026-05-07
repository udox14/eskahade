import { batch, execute, generateId, now, query, queryOne } from '@/lib/db'
import { getSession, hasRole, isAdmin, type SessionUser } from '@/lib/auth/session'
import { deleteFromR2 } from '@/lib/r2/upload'
import { revalidateTag } from 'next/cache'

export const OPERASIONAL_RECIPIENT_FEATURE = '/dashboard/operasional'
export const OPERASIONAL_BENDAHARA_FEATURE = '/dashboard/keuangan/operasional'

export type OperasionalUnitKind = 'ASRAMA' | 'SEKPEN' | 'KEAMANAN'
export type OperasionalTipe = 'PEMASUKAN' | 'PENGELUARAN' | 'PENYESUAIAN'
export type OperasionalSumberPemasukan = 'ALOKASI_BENDAHARA' | 'LAINNYA'
export type OperasionalAllocationStatus = 'draft' | 'posted' | 'cancelled'

export type OperasionalUnit = {
  id: string
  kind: OperasionalUnitKind
  code: string
  name: string
  asrama_name: string | null
  is_active: number
}

export type OperasionalAllocationRow = {
  id: string
  tahun: number
  bulan: number
  unit_id: string
  nominal: number
  catatan: string | null
  status: OperasionalAllocationStatus
  created_by: string | null
  created_at: string
  updated_at: string | null
  posted_by: string | null
  posted_at: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  unit_name: string
  creator_name: string | null
  posted_by_name: string | null
}

export type OperasionalTransactionRow = {
  id: string
  tanggal: string
  periode_tahun: number
  periode_bulan: number
  unit_id: string
  unit_name: string
  tipe: OperasionalTipe
  sumber_pemasukan: OperasionalSumberPemasukan | null
  kategori: string | null
  uraian: string
  qty: number
  harga_satuan: number
  nominal: number
  partner_name: string | null
  catatan: string | null
  receipt_url: string | null
  alokasi_id: string | null
  is_system: number
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string | null
}

export type OperasionalScope = {
  canManageAll: boolean
  lockedUnitId: string | null
  defaultUnitId: string | null
  unitOptions: OperasionalUnit[]
  roles: string[]
}

export type OperasionalDashboardRow = {
  unit_id: string
  unit_name: string
  saldo_awal: number
  alokasi_bendahara: number
  pemasukan_lain: number
  pengeluaran: number
  penyesuaian: number
  saldo_akhir: number
  ada_bukti: number
  tanpa_bukti: number
}

export type OperasionalLedgerData = {
  unit: OperasionalUnit
  saldoAwal: number
  saldoAkhir: number
  totals: {
    alokasi_bendahara: number
    pemasukan_lain: number
    pengeluaran: number
    penyesuaian: number
  }
  transactions: OperasionalTransactionRow[]
  allocations: OperasionalAllocationRow[]
}

export type OperasionalPrintPreference = {
  id?: number
  unit_id: string
  report_type: string
  scope_key: string
  slot1_label: string
  slot1_nama: string
  slot1_jabatan: string
  slot2_label: string
  slot2_nama: string
  slot2_jabatan: string
  slot3_label: string
  slot3_nama: string
  slot3_jabatan: string
}

export type SaveOperasionalAlokasiPayload = {
  id?: string
  tahun: number
  bulan: number
  unitId: string
  nominal: number
  catatan?: string | null
}

export type SaveOperasionalTransaksiPayload = {
  id?: string
  tanggal: string
  unitId: string
  tipe: OperasionalTipe
  sumberPemasukan?: OperasionalSumberPemasukan | null
  kategori?: string | null
  uraian: string
  qty?: number
  hargaSatuan?: number
  nominal?: number
  partnerName?: string | null
  catatan?: string | null
  receiptUrl?: string | null
}

let operasionalSchemaReady: Promise<void> | null = null

function sanitizeAsramaUnitId(asrama: string) {
  return `ASRAMA:${asrama.trim().toUpperCase()}`
}

function parseNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseInteger(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getPeriodeKey(tahun: number, bulan: number) {
  return tahun * 100 + bulan
}

function getDefaultTransactionDate(tahun: number, bulan: number) {
  return `${tahun}-${String(bulan).padStart(2, '0')}-01`
}

function getTransactionEffect(row: Pick<OperasionalTransactionRow, 'tipe' | 'nominal'>) {
  if (row.tipe === 'PENGELUARAN') return -Number(row.nominal || 0)
  return Number(row.nominal || 0)
}

export async function ensureOperasionalSchema() {
  operasionalSchemaReady ??= ensureOperasionalSchemaOnce().catch(error => {
    operasionalSchemaReady = null
    throw error
  })
  await operasionalSchemaReady
}

async function ensureOperasionalSchemaOnce() {
  await execute(`
    CREATE TABLE IF NOT EXISTS operasional_unit (
      id            TEXT PRIMARY KEY,
      kind          TEXT NOT NULL,
      code          TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      asrama_name   TEXT,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS operasional_alokasi_bulanan (
      id            TEXT PRIMARY KEY,
      tahun         INTEGER NOT NULL,
      bulan         INTEGER NOT NULL,
      unit_id       TEXT NOT NULL REFERENCES operasional_unit(id),
      nominal       INTEGER NOT NULL DEFAULT 0,
      catatan       TEXT,
      status        TEXT NOT NULL DEFAULT 'draft',
      created_by    TEXT REFERENCES users(id),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT,
      posted_by     TEXT REFERENCES users(id),
      posted_at     TEXT,
      cancelled_by  TEXT REFERENCES users(id),
      cancelled_at  TEXT,
      UNIQUE(tahun, bulan, unit_id)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_operasional_alokasi_periode
    ON operasional_alokasi_bulanan(tahun, bulan, unit_id, status)
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS operasional_transaksi (
      id                TEXT PRIMARY KEY,
      tanggal           TEXT NOT NULL,
      periode_tahun     INTEGER NOT NULL,
      periode_bulan     INTEGER NOT NULL,
      unit_id           TEXT NOT NULL REFERENCES operasional_unit(id),
      tipe              TEXT NOT NULL,
      sumber_pemasukan  TEXT,
      kategori          TEXT,
      uraian            TEXT NOT NULL,
      qty               REAL NOT NULL DEFAULT 1,
      harga_satuan      INTEGER NOT NULL DEFAULT 0,
      nominal           INTEGER NOT NULL DEFAULT 0,
      partner_name      TEXT,
      catatan           TEXT,
      receipt_url       TEXT,
      alokasi_id        TEXT REFERENCES operasional_alokasi_bulanan(id) ON DELETE SET NULL,
      is_system         INTEGER NOT NULL DEFAULT 0,
      is_deleted        INTEGER NOT NULL DEFAULT 0,
      deleted_by        TEXT REFERENCES users(id),
      deleted_at        TEXT,
      created_by        TEXT REFERENCES users(id),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_operasional_transaksi_periode
    ON operasional_transaksi(periode_tahun, periode_bulan, unit_id, tipe, is_deleted)
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_operasional_transaksi_alokasi
    ON operasional_transaksi(alokasi_id, is_deleted)
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS operasional_ttd_pref (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id         TEXT NOT NULL,
      report_type     TEXT NOT NULL,
      scope_key       TEXT NOT NULL,
      slot1_label     TEXT NOT NULL DEFAULT '',
      slot1_nama      TEXT NOT NULL DEFAULT '',
      slot1_jabatan   TEXT NOT NULL DEFAULT '',
      slot2_label     TEXT NOT NULL DEFAULT '',
      slot2_nama      TEXT NOT NULL DEFAULT '',
      slot2_jabatan   TEXT NOT NULL DEFAULT '',
      slot3_label     TEXT NOT NULL DEFAULT '',
      slot3_nama      TEXT NOT NULL DEFAULT '',
      slot3_jabatan   TEXT NOT NULL DEFAULT '',
      updated_by      TEXT REFERENCES users(id),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT,
      UNIQUE(unit_id, report_type, scope_key)
    )
  `)
  await execute(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES
      ('Operasional', 'Kas Operasional Unit', '/dashboard/operasional', 'WalletCards', '["pengurus_asrama","sekpen","keamanan"]', 1, 0),
      ('Keuangan Pusat', 'Operasional Unit', '/dashboard/keuangan/operasional', 'Wallet', '["admin","bendahara"]', 1, 3)
  `)
  await execute(`DELETE FROM fitur_akses WHERE href IN ('/dashboard/operasional/cetak', '/dashboard/keuangan/operasional/cetak')`)
  try {
    revalidateTag('fitur-akses', 'everything')
  } catch {}
  await syncOperasionalUnits()
}

async function syncOperasionalUnits() {
  const asramaRows = await query<{ asrama: string }>(`
    SELECT DISTINCT TRIM(asrama) as asrama
    FROM santri
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL
      AND TRIM(asrama) <> ''
      AND UPPER(TRIM(asrama)) <> 'AL-BAGHORY'
    ORDER BY TRIM(asrama)
  `)

  const baseUnits: Array<Pick<OperasionalUnit, 'id' | 'kind' | 'code' | 'name' | 'asrama_name'>> = [
    { id: 'SEKPEN', kind: 'SEKPEN', code: 'SEKPEN', name: 'Sekpen', asrama_name: null },
    { id: 'KEAMANAN', kind: 'KEAMANAN', code: 'KEAMANAN', name: 'Keamanan', asrama_name: null },
    ...asramaRows.map(row => {
      const asrama = row.asrama.trim()
      return {
        id: sanitizeAsramaUnitId(asrama),
        kind: 'ASRAMA' as const,
        code: sanitizeAsramaUnitId(asrama),
        name: asrama,
        asrama_name: asrama,
      }
    }),
  ]

  if (baseUnits.length > 0) {
    await batch(baseUnits.map(unit => ({
      sql: `
        INSERT INTO operasional_unit (id, kind, code, name, asrama_name, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          code = excluded.code,
          name = excluded.name,
          asrama_name = excluded.asrama_name,
          is_active = 1,
          updated_at = excluded.updated_at
      `,
      params: [unit.id, unit.kind, unit.code, unit.name, unit.asrama_name, now()],
    })))
  }
}

async function getOperasionalUnits() {
  await ensureOperasionalSchema()
  await syncOperasionalUnits()
  return query<OperasionalUnit>(`
    SELECT id, kind, code, name, asrama_name, is_active
    FROM operasional_unit
    WHERE is_active = 1
    ORDER BY
      CASE kind WHEN 'SEKPEN' THEN 0 WHEN 'KEAMANAN' THEN 1 ELSE 2 END,
      asrama_name,
      name
  `)
}

export async function getOperasionalScope(sessionArg?: SessionUser | null): Promise<OperasionalScope | null> {
  await ensureOperasionalSchema()
  const session = sessionArg ?? await getSession()
  if (!session) return null

  const units = await getOperasionalUnits()
  const accessibleIds = new Set<string>()

  if (isAdmin(session) || hasRole(session, 'bendahara')) {
    units.forEach(unit => accessibleIds.add(unit.id))
  } else {
    if (hasRole(session, 'sekpen')) accessibleIds.add('SEKPEN')
    if (hasRole(session, 'keamanan')) accessibleIds.add('KEAMANAN')
    if (hasRole(session, 'pengurus_asrama') && session.asrama_binaan) {
      accessibleIds.add(sanitizeAsramaUnitId(session.asrama_binaan))
    }
  }

  const unitOptions = units.filter(unit => accessibleIds.has(unit.id))
  if (unitOptions.length === 0) return null

  const canManageAll = isAdmin(session) || hasRole(session, 'bendahara')
  return {
    canManageAll,
    lockedUnitId: canManageAll || unitOptions.length !== 1 ? null : unitOptions[0].id,
    defaultUnitId: unitOptions[0].id,
    unitOptions,
    roles: session.roles ?? [session.role],
  }
}

async function requireOperasionalScope() {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  const scope = await getOperasionalScope(session)
  if (!scope) throw new Error('Akses ke kas operasional tidak tersedia untuk akun ini.')
  return { session, scope }
}

function requireBendaharaScope(session: SessionUser, scope: OperasionalScope) {
  if (!(scope.canManageAll || isAdmin(session) || hasRole(session, 'bendahara'))) {
    throw new Error('Hanya bendahara yang bisa mengelola alokasi.')
  }
}

function ensureUnitAllowed(scope: OperasionalScope, unitId: string) {
  if (!scope.canManageAll && !scope.unitOptions.some(unit => unit.id === unitId)) {
    throw new Error('Unit ledger di luar jangkauan akun ini.')
  }
}

async function getUnitById(unitId: string) {
  await ensureOperasionalSchema()
  return queryOne<OperasionalUnit>(
    'SELECT id, kind, code, name, asrama_name, is_active FROM operasional_unit WHERE id = ? LIMIT 1',
    [unitId]
  )
}

async function getUnitBalance(unitId: string) {
  const row = await queryOne<{ saldo: number }>(`
    SELECT COALESCE(SUM(
      CASE
        WHEN tipe = 'PENGELUARAN' THEN -nominal
        ELSE nominal
      END
    ), 0) as saldo
    FROM operasional_transaksi
    WHERE unit_id = ? AND is_deleted = 0
  `, [unitId])
  return parseInteger(row?.saldo)
}

async function getSaldoAwalByUnits(unitIds: string[], tahun: number, bulan: number) {
  if (!unitIds.length) return new Map<string, number>()
  const placeholders = unitIds.map(() => '?').join(',')
  const params: unknown[] = [...unitIds, getPeriodeKey(tahun, bulan)]
  const rows = await query<{ unit_id: string; saldo: number }>(`
    SELECT unit_id, COALESCE(SUM(
      CASE
        WHEN tipe = 'PENGELUARAN' THEN -nominal
        ELSE nominal
      END
    ), 0) AS saldo
    FROM operasional_transaksi
    WHERE unit_id IN (${placeholders})
      AND is_deleted = 0
      AND (periode_tahun * 100 + periode_bulan) < ?
    GROUP BY unit_id
  `, params)
  return new Map(rows.map(row => [row.unit_id, parseInteger(row.saldo)]))
}

async function getAllocationRows(tahun: number, bulan: number, unitIds: string[]) {
  if (!unitIds.length) return [] as OperasionalAllocationRow[]
  const placeholders = unitIds.map(() => '?').join(',')
  const params: unknown[] = [tahun, bulan, ...unitIds]
  return query<OperasionalAllocationRow>(`
    SELECT
      a.id, a.tahun, a.bulan, a.unit_id, a.nominal, a.catatan, a.status, a.created_by,
      a.created_at, a.updated_at, a.posted_by, a.posted_at, a.cancelled_by, a.cancelled_at,
      u.name as unit_name,
      creator.full_name as creator_name,
      poster.full_name as posted_by_name
    FROM operasional_alokasi_bulanan a
    JOIN operasional_unit u ON u.id = a.unit_id
    LEFT JOIN users creator ON creator.id = a.created_by
    LEFT JOIN users poster ON poster.id = a.posted_by
    WHERE a.tahun = ? AND a.bulan = ? AND a.unit_id IN (${placeholders})
    ORDER BY u.name
  `, params)
}

export async function getOperasionalDashboard(params: {
  tahun: number
  bulan: number
  unitId?: string | null
}) {
  const { scope } = await requireOperasionalScope()
  const requestedUnitId = String(params.unitId || '').trim()
  const unitIds = requestedUnitId ? [requestedUnitId] : scope.unitOptions.map(unit => unit.id)
  if (requestedUnitId) ensureUnitAllowed(scope, requestedUnitId)

  const units = scope.unitOptions.filter(unit => unitIds.includes(unit.id))
  const saldoAwalMap = await getSaldoAwalByUnits(unitIds, params.tahun, params.bulan)
  const allocations = await getAllocationRows(params.tahun, params.bulan, unitIds)
  const placeholders = unitIds.map(() => '?').join(',')
  const txRows = unitIds.length === 0 ? [] : await query<{
    unit_id: string
    alokasi_bendahara: number
    pemasukan_lain: number
    pengeluaran: number
    penyesuaian: number
    ada_bukti: number
    tanpa_bukti: number
  }>(`
    SELECT
      unit_id,
      COALESCE(SUM(CASE WHEN tipe = 'PEMASUKAN' AND sumber_pemasukan = 'ALOKASI_BENDAHARA' THEN nominal ELSE 0 END), 0) as alokasi_bendahara,
      COALESCE(SUM(CASE WHEN tipe = 'PEMASUKAN' AND COALESCE(sumber_pemasukan, 'LAINNYA') <> 'ALOKASI_BENDAHARA' THEN nominal ELSE 0 END), 0) as pemasukan_lain,
      COALESCE(SUM(CASE WHEN tipe = 'PENGELUARAN' THEN nominal ELSE 0 END), 0) as pengeluaran,
      COALESCE(SUM(CASE WHEN tipe = 'PENYESUAIAN' THEN nominal ELSE 0 END), 0) as penyesuaian,
      COALESCE(SUM(CASE WHEN tipe = 'PENGELUARAN' AND receipt_url IS NOT NULL AND TRIM(receipt_url) <> '' THEN 1 ELSE 0 END), 0) as ada_bukti,
      COALESCE(SUM(CASE WHEN tipe = 'PENGELUARAN' AND (receipt_url IS NULL OR TRIM(receipt_url) = '') THEN 1 ELSE 0 END), 0) as tanpa_bukti
    FROM operasional_transaksi
    WHERE periode_tahun = ? AND periode_bulan = ? AND is_deleted = 0 AND unit_id IN (${placeholders})
    GROUP BY unit_id
  `, [params.tahun, params.bulan, ...unitIds])

  const txMap = new Map(txRows.map(row => [row.unit_id, row]))
  const allocationMap = new Map<string, number>()
  for (const allocation of allocations) {
    if (allocation.status === 'posted') {
      allocationMap.set(allocation.unit_id, (allocationMap.get(allocation.unit_id) ?? 0) + parseInteger(allocation.nominal))
    }
  }

  return units.map(unit => {
    const tx = txMap.get(unit.id)
    const saldoAwal = saldoAwalMap.get(unit.id) ?? 0
    const alokasi = tx ? parseInteger(tx.alokasi_bendahara) : allocationMap.get(unit.id) ?? 0
    const pemasukanLain = tx ? parseInteger(tx.pemasukan_lain) : 0
    const pengeluaran = tx ? parseInteger(tx.pengeluaran) : 0
    const penyesuaian = tx ? parseInteger(tx.penyesuaian) : 0
    return {
      unit_id: unit.id,
      unit_name: unit.name,
      saldo_awal: saldoAwal,
      alokasi_bendahara: alokasi,
      pemasukan_lain: pemasukanLain,
      pengeluaran,
      penyesuaian,
      saldo_akhir: saldoAwal + alokasi + pemasukanLain + penyesuaian - pengeluaran,
      ada_bukti: tx ? parseInteger(tx.ada_bukti) : 0,
      tanpa_bukti: tx ? parseInteger(tx.tanpa_bukti) : 0,
    } satisfies OperasionalDashboardRow
  })
}

export async function getOperasionalLedger(params: {
  tahun: number
  bulan: number
  unitId: string
}): Promise<OperasionalLedgerData> {
  const { scope } = await requireOperasionalScope()
  ensureUnitAllowed(scope, params.unitId)

  const unit = await getUnitById(params.unitId)
  if (!unit) throw new Error('Unit operasional tidak ditemukan.')

  const saldoAwalMap = await getSaldoAwalByUnits([params.unitId], params.tahun, params.bulan)
  const allocations = await getAllocationRows(params.tahun, params.bulan, [params.unitId])
  const transactions = await query<OperasionalTransactionRow>(`
    SELECT
      t.id, t.tanggal, t.periode_tahun, t.periode_bulan, t.unit_id, u.name as unit_name, t.tipe,
      t.sumber_pemasukan, t.kategori, t.uraian, t.qty, t.harga_satuan, t.nominal,
      t.partner_name, t.catatan, t.receipt_url, t.alokasi_id, t.is_system, t.created_by,
      creator.full_name as created_by_name, t.created_at, t.updated_at
    FROM operasional_transaksi t
    JOIN operasional_unit u ON u.id = t.unit_id
    LEFT JOIN users creator ON creator.id = t.created_by
    WHERE t.unit_id = ? AND t.periode_tahun = ? AND t.periode_bulan = ? AND t.is_deleted = 0
    ORDER BY t.tanggal ASC, t.created_at ASC
  `, [params.unitId, params.tahun, params.bulan])

  const totals = transactions.reduce((acc, row) => {
    if (row.tipe === 'PEMASUKAN' && row.sumber_pemasukan === 'ALOKASI_BENDAHARA') acc.alokasi_bendahara += parseInteger(row.nominal)
    else if (row.tipe === 'PEMASUKAN') acc.pemasukan_lain += parseInteger(row.nominal)
    else if (row.tipe === 'PENGELUARAN') acc.pengeluaran += parseInteger(row.nominal)
    else if (row.tipe === 'PENYESUAIAN') acc.penyesuaian += parseInteger(row.nominal)
    return acc
  }, { alokasi_bendahara: 0, pemasukan_lain: 0, pengeluaran: 0, penyesuaian: 0 })

  const saldoAwal = saldoAwalMap.get(params.unitId) ?? 0
  return {
    unit,
    saldoAwal,
    saldoAkhir: saldoAwal + totals.alokasi_bendahara + totals.pemasukan_lain + totals.penyesuaian - totals.pengeluaran,
    totals,
    transactions,
    allocations,
  }
}

export async function saveOperasionalAlokasi(payload: SaveOperasionalAlokasiPayload) {
  const { session, scope } = await requireOperasionalScope()
  requireBendaharaScope(session, scope)
  ensureUnitAllowed(scope, payload.unitId)
  const unit = await getUnitById(payload.unitId)
  if (!unit) return { error: 'Unit tidak ditemukan.' }

  const tahun = parseInteger(payload.tahun)
  const bulan = parseInteger(payload.bulan)
  const nominal = Math.max(0, Math.round(parseNumber(payload.nominal)))
  if (tahun < 2000 || bulan < 1 || bulan > 12) return { error: 'Periode alokasi tidak valid.' }
  if (nominal <= 0) return { error: 'Nominal alokasi harus lebih dari 0.' }

  const existing = payload.id
    ? await queryOne<{ id: string; status: OperasionalAllocationStatus; unit_id: string }>(
        'SELECT id, status, unit_id FROM operasional_alokasi_bulanan WHERE id = ? LIMIT 1',
        [payload.id]
      )
    : await queryOne<{ id: string; status: OperasionalAllocationStatus; unit_id: string }>(
        'SELECT id, status, unit_id FROM operasional_alokasi_bulanan WHERE tahun = ? AND bulan = ? AND unit_id = ? LIMIT 1',
        [tahun, bulan, payload.unitId]
      )

  if (existing && payload.id && existing.status === 'posted') {
    return { error: 'Alokasi yang sudah diposting tidak bisa diubah langsung.' }
  }
  if (existing && existing.status === 'cancelled') {
    return { error: 'Alokasi yang sudah dibatalkan tidak bisa diubah.' }
  }
  if (existing && !payload.id && existing.id) {
    payload.id = existing.id
  }

  if (payload.id) {
    await execute(`
      UPDATE operasional_alokasi_bulanan
      SET tahun = ?, bulan = ?, unit_id = ?, nominal = ?, catatan = ?, updated_at = ?
      WHERE id = ?
    `, [tahun, bulan, payload.unitId, nominal, payload.catatan?.trim() || null, now(), payload.id])
    return { success: true, id: payload.id, unitName: unit.name }
  }

  const id = generateId()
  await execute(`
    INSERT INTO operasional_alokasi_bulanan
      (id, tahun, bulan, unit_id, nominal, catatan, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
  `, [id, tahun, bulan, payload.unitId, nominal, payload.catatan?.trim() || null, session.id, now(), now()])
  return { success: true, id, unitName: unit.name }
}

export async function postOperasionalAlokasi(id: string) {
  const { session, scope } = await requireOperasionalScope()
  requireBendaharaScope(session, scope)

  const allocation = await queryOne<OperasionalAllocationRow>(
    `SELECT a.id, a.tahun, a.bulan, a.unit_id, a.nominal, a.catatan, a.status, a.created_by,
            a.created_at, a.updated_at, a.posted_by, a.posted_at, a.cancelled_by, a.cancelled_at,
            u.name as unit_name, NULL as creator_name, NULL as posted_by_name
     FROM operasional_alokasi_bulanan a
     JOIN operasional_unit u ON u.id = a.unit_id
     WHERE a.id = ? LIMIT 1`,
    [id]
  )
  if (!allocation) return { error: 'Alokasi tidak ditemukan.' }
  ensureUnitAllowed(scope, allocation.unit_id)
  if (allocation.status === 'cancelled') return { error: 'Alokasi yang dibatalkan tidak bisa diposting.' }
  if (allocation.status === 'posted') return { error: 'Alokasi ini sudah diposting.' }

  const existingTx = await queryOne<{ id: string }>(
    'SELECT id FROM operasional_transaksi WHERE alokasi_id = ? AND is_deleted = 0 LIMIT 1',
    [id]
  )
  if (existingTx) return { error: 'Transaksi alokasi sudah pernah dibuat.' }

  const txId = generateId()
  await batch([
    {
      sql: `
        UPDATE operasional_alokasi_bulanan
        SET status = 'posted', posted_by = ?, posted_at = ?, updated_at = ?
        WHERE id = ?
      `,
      params: [session.id, now(), now(), id],
    },
    {
      sql: `
        INSERT INTO operasional_transaksi
          (id, tanggal, periode_tahun, periode_bulan, unit_id, tipe, sumber_pemasukan, kategori,
           uraian, qty, harga_satuan, nominal, partner_name, catatan, receipt_url, alokasi_id,
           is_system, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'PEMASUKAN', 'ALOKASI_BENDAHARA', 'Alokasi Bendahara',
                ?, 1, ?, ?, ?, ?, NULL, ?, 1, ?, ?, ?)
      `,
      params: [
        txId,
        getDefaultTransactionDate(allocation.tahun, allocation.bulan),
        allocation.tahun,
        allocation.bulan,
        allocation.unit_id,
        `Alokasi operasional ${allocation.unit_name}`,
        allocation.nominal,
        allocation.nominal,
        session.full_name,
        allocation.catatan,
        id,
        session.id,
        now(),
        now(),
      ],
    },
  ])

  return { success: true, transactionId: txId }
}

export async function cancelOperasionalAlokasi(id: string) {
  const { session, scope } = await requireOperasionalScope()
  requireBendaharaScope(session, scope)

  const allocation = await queryOne<{ id: string; unit_id: string; status: OperasionalAllocationStatus }>(
    'SELECT id, unit_id, status FROM operasional_alokasi_bulanan WHERE id = ? LIMIT 1',
    [id]
  )
  if (!allocation) return { error: 'Alokasi tidak ditemukan.' }
  ensureUnitAllowed(scope, allocation.unit_id)
  if (allocation.status === 'cancelled') return { error: 'Alokasi ini sudah dibatalkan.' }

  const statements: { sql: string; params?: unknown[] }[] = [{
    sql: `
      UPDATE operasional_alokasi_bulanan
      SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?, updated_at = ?
      WHERE id = ?
    `,
    params: [session.id, now(), now(), id],
  }]

  if (allocation.status === 'posted') {
    statements.push({
      sql: `
        UPDATE operasional_transaksi
        SET is_deleted = 1, deleted_by = ?, deleted_at = ?, updated_at = ?
        WHERE alokasi_id = ? AND is_deleted = 0
      `,
      params: [session.id, now(), now(), id],
    })
  }

  await batch(statements)
  return { success: true }
}

async function findEditableTransaction(id: string) {
  return queryOne<OperasionalTransactionRow>(`
    SELECT
      t.id, t.tanggal, t.periode_tahun, t.periode_bulan, t.unit_id, u.name as unit_name, t.tipe,
      t.sumber_pemasukan, t.kategori, t.uraian, t.qty, t.harga_satuan, t.nominal,
      t.partner_name, t.catatan, t.receipt_url, t.alokasi_id, t.is_system, t.created_by,
      creator.full_name as created_by_name, t.created_at, t.updated_at
    FROM operasional_transaksi t
    JOIN operasional_unit u ON u.id = t.unit_id
    LEFT JOIN users creator ON creator.id = t.created_by
    WHERE t.id = ? AND t.is_deleted = 0
    LIMIT 1
  `, [id])
}

export async function saveOperasionalTransaksi(payload: SaveOperasionalTransaksiPayload) {
  const { session, scope } = await requireOperasionalScope()
  ensureUnitAllowed(scope, payload.unitId)

  const unit = await getUnitById(payload.unitId)
  if (!unit) return { error: 'Unit transaksi tidak ditemukan.' }

  const tipe = payload.tipe
  const tanggal = String(payload.tanggal || '').trim()
  if (!tanggal) return { error: 'Tanggal transaksi wajib diisi.' }

  const [yearPart, monthPart] = tanggal.split('-')
  const periodeTahun = parseInteger(yearPart)
  const periodeBulan = parseInteger(monthPart)
  if (periodeTahun < 2000 || periodeBulan < 1 || periodeBulan > 12) {
    return { error: 'Tanggal transaksi tidak valid.' }
  }

  const qtyRaw = parseNumber(payload.qty ?? 1)
  const qty = qtyRaw > 0 ? qtyRaw : 1
  const hargaSatuan = Math.max(0, Math.round(parseNumber(payload.hargaSatuan)))
  const nominalInput = Math.round(parseNumber(payload.nominal))
  let nominal = nominalInput

  if (tipe === 'PENGELUARAN') {
    nominal = Math.max(0, Math.round((qty * hargaSatuan) || nominalInput))
  } else if (tipe === 'PEMASUKAN') {
    nominal = Math.max(0, nominalInput)
  }

  if (tipe !== 'PENYESUAIAN' && nominal <= 0) {
    return { error: 'Nominal transaksi harus lebih dari 0.' }
  }
  if (tipe === 'PENYESUAIAN' && nominal === 0) {
    return { error: 'Nominal penyesuaian tidak boleh 0.' }
  }

  const existing = payload.id ? await findEditableTransaction(payload.id) : null
  if (existing?.is_system) return { error: 'Transaksi sistem tidak bisa diubah manual.' }
  if (existing) ensureUnitAllowed(scope, existing.unit_id)

  const currentBalance = await getUnitBalance(payload.unitId)
  const oldEffect = existing ? getTransactionEffect(existing) : 0
  const newEffect = getTransactionEffect({ tipe, nominal } as Pick<OperasionalTransactionRow, 'tipe' | 'nominal'>)
  const nextBalance = currentBalance - oldEffect + newEffect
  if (nextBalance < 0) {
    return { error: 'Saldo unit tidak cukup. Pengeluaran atau penyesuaian ini membuat saldo menjadi minus.' }
  }

  const nextReceiptUrl = payload.receiptUrl?.trim() || null
  if (existing && existing.receipt_url && existing.receipt_url !== nextReceiptUrl) {
    await deleteFromR2(existing.receipt_url)
  }

  const kategori = payload.kategori?.trim() || null
  const uraian = payload.uraian?.trim()
  if (!uraian) return { error: 'Uraian transaksi wajib diisi.' }
  const source = tipe === 'PEMASUKAN'
    ? (payload.sumberPemasukan === 'ALOKASI_BENDAHARA' ? 'ALOKASI_BENDAHARA' : 'LAINNYA')
    : null

  if (payload.id) {
    await execute(`
      UPDATE operasional_transaksi
      SET tanggal = ?, periode_tahun = ?, periode_bulan = ?, unit_id = ?, tipe = ?, sumber_pemasukan = ?,
          kategori = ?, uraian = ?, qty = ?, harga_satuan = ?, nominal = ?, partner_name = ?, catatan = ?,
          receipt_url = ?, updated_at = ?
      WHERE id = ?
    `, [
      tanggal,
      periodeTahun,
      periodeBulan,
      payload.unitId,
      tipe,
      source,
      kategori,
      uraian,
      qty,
      hargaSatuan,
      nominal,
      payload.partnerName?.trim() || null,
      payload.catatan?.trim() || null,
      nextReceiptUrl,
      now(),
      payload.id,
    ])
    return { success: true, id: payload.id, unitName: unit.name }
  }

  const id = generateId()
  await execute(`
    INSERT INTO operasional_transaksi
      (id, tanggal, periode_tahun, periode_bulan, unit_id, tipe, sumber_pemasukan, kategori, uraian,
       qty, harga_satuan, nominal, partner_name, catatan, receipt_url, alokasi_id, is_system,
       created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?)
  `, [
    id,
    tanggal,
    periodeTahun,
    periodeBulan,
    payload.unitId,
    tipe,
    source,
    kategori,
    uraian,
    qty,
    hargaSatuan,
    nominal,
    payload.partnerName?.trim() || null,
    payload.catatan?.trim() || null,
    nextReceiptUrl,
    session.id,
    now(),
    now(),
  ])

  return { success: true, id, unitName: unit.name }
}

export async function deleteOperasionalTransaksi(id: string) {
  const { session, scope } = await requireOperasionalScope()
  const transaction = await findEditableTransaction(id)
  if (!transaction) return { error: 'Transaksi tidak ditemukan.' }
  if (transaction.is_system) return { error: 'Transaksi sistem tidak bisa dihapus.' }
  ensureUnitAllowed(scope, transaction.unit_id)

  const currentBalance = await getUnitBalance(transaction.unit_id)
  const nextBalance = currentBalance - getTransactionEffect(transaction)
  if (nextBalance < 0) {
    return { error: 'Transaksi ini tidak bisa dihapus karena akan membuat saldo akhir minus.' }
  }

  await execute(`
    UPDATE operasional_transaksi
    SET is_deleted = 1, deleted_by = ?, deleted_at = ?, updated_at = ?
    WHERE id = ?
  `, [session.id, now(), now(), id])

  return { success: true }
}

export async function getOperasionalPrintPreferences(params: {
  unitId: string
  reportType: string
  scopeKey?: string | null
}) {
  const { session, scope } = await requireOperasionalScope()
  ensureUnitAllowed(scope, params.unitId)
  const scopeKey = String(params.scopeKey || `${session.id}:${params.unitId}`).trim()
  const row = await queryOne<OperasionalPrintPreference>(`
    SELECT
      id, unit_id, report_type, scope_key,
      slot1_label, slot1_nama, slot1_jabatan,
      slot2_label, slot2_nama, slot2_jabatan,
      slot3_label, slot3_nama, slot3_jabatan
    FROM operasional_ttd_pref
    WHERE unit_id = ? AND report_type = ? AND scope_key = ?
    LIMIT 1
  `, [params.unitId, params.reportType, scopeKey])

  return row ?? {
    unit_id: params.unitId,
    report_type: params.reportType,
    scope_key: scopeKey,
    slot1_label: '',
    slot1_nama: '',
    slot1_jabatan: '',
    slot2_label: '',
    slot2_nama: '',
    slot2_jabatan: '',
    slot3_label: '',
    slot3_nama: '',
    slot3_jabatan: '',
  }
}

export async function saveOperasionalPrintPreferences(payload: OperasionalPrintPreference) {
  const { session, scope } = await requireOperasionalScope()
  ensureUnitAllowed(scope, payload.unit_id)
  const scopeKey = payload.scope_key?.trim() || `${session.id}:${payload.unit_id}`

  await execute(`
    INSERT INTO operasional_ttd_pref
      (unit_id, report_type, scope_key,
       slot1_label, slot1_nama, slot1_jabatan,
       slot2_label, slot2_nama, slot2_jabatan,
       slot3_label, slot3_nama, slot3_jabatan,
       updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(unit_id, report_type, scope_key) DO UPDATE SET
      slot1_label = excluded.slot1_label,
      slot1_nama = excluded.slot1_nama,
      slot1_jabatan = excluded.slot1_jabatan,
      slot2_label = excluded.slot2_label,
      slot2_nama = excluded.slot2_nama,
      slot2_jabatan = excluded.slot2_jabatan,
      slot3_label = excluded.slot3_label,
      slot3_nama = excluded.slot3_nama,
      slot3_jabatan = excluded.slot3_jabatan,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `, [
    payload.unit_id,
    payload.report_type,
    scopeKey,
    payload.slot1_label?.trim() || '',
    payload.slot1_nama?.trim() || '',
    payload.slot1_jabatan?.trim() || '',
    payload.slot2_label?.trim() || '',
    payload.slot2_nama?.trim() || '',
    payload.slot2_jabatan?.trim() || '',
    payload.slot3_label?.trim() || '',
    payload.slot3_nama?.trim() || '',
    payload.slot3_jabatan?.trim() || '',
    session.id,
    now(),
    now(),
  ])

  return { success: true }
}

export async function getOperasionalPrintData(params: {
  tahun: number
  bulan: number
  unitId: string
  reportType: string
  scopeKey?: string | null
}) {
  const ledger = await getOperasionalLedger({
    tahun: params.tahun,
    bulan: params.bulan,
    unitId: params.unitId,
  })
  const preferences = await getOperasionalPrintPreferences({
    unitId: params.unitId,
    reportType: params.reportType,
    scopeKey: params.scopeKey,
  })
  return { ledger, preferences }
}
