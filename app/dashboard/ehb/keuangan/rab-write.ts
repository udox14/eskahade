import type { KeuanganSigners, RabItemInput } from './actions'

export type RabChange = RabItemInput & { id: number | null; clientKey: string }

export type RabSaveRequest = {
  revision: string
  requestId: string
  upserts: RabChange[]
  deletes: number[]
  signers: Partial<KeuanganSigners>
}

const categories = new Set(['atk_administrasi', 'konsumsi', 'honorarium'])
const signerRoles = new Set(['ketua', 'bendahara', 'wakil_akademik', 'wakil_keuangan'])

export function normalizeRabSave(input: RabSaveRequest) {
  if (!input || typeof input.revision !== 'string' || !/^[a-f0-9-]{36}$/.test(input.requestId)
    || !Array.isArray(input.upserts) || !Array.isArray(input.deletes)
    || !input.signers || typeof input.signers !== 'object' || Array.isArray(input.signers)) {
    throw new Error('Perubahan RAB tidak valid.')
  }
  const ids = new Set<number>()
  for (const id of [...input.deletes, ...input.upserts.flatMap(row => row?.id === null ? [] : [row?.id])]) {
    if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id)) throw new Error('ID item RAB tidak valid.')
    ids.add(id)
  }
  const clientKeys = new Set<string>()
  const upserts = input.upserts.map(row => {
    const qtyHundredths = Math.round(row.qty * 100)
    const name = typeof row.nama_barang === 'string' ? row.nama_barang.trim() : ''
    if (!name || !categories.has(row.kategori)
      || !Number.isFinite(row.qty) || row.qty < 0 || !Number.isSafeInteger(qtyHundredths) || qtyHundredths / 100 !== row.qty
      || !Number.isSafeInteger(row.harga) || row.harga < 0
      || !Number.isSafeInteger(row.urutan) || row.urutan! < 0
      || (row.is_system !== 0 && row.is_system !== 1)
      || (row.system_key != null && typeof row.system_key !== 'string')
      || (row.keterangan != null && typeof row.keterangan !== 'string')
      || typeof row.clientKey !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(row.clientKey)
      || clientKeys.has(row.clientKey)) {
      throw new Error('Periksa nama, QTY, dan harga item RAB.')
    }
    const total = BigInt(qtyHundredths) * BigInt(row.harga)
    const rupiahScale = BigInt(100)
    if (row.system_key !== 'honor_panitia' && (total % rupiahScale !== BigInt(0) || total / rupiahScale > BigInt(Number.MAX_SAFE_INTEGER))) {
      throw new Error(`Subtotal ${name} harus berupa Rupiah utuh dan dalam batas yang valid.`)
    }
    clientKeys.add(row.clientKey)
    return {
      id: row.id,
      clientKey: row.clientKey,
      kategori: row.kategori,
      nama_barang: name,
      qty: row.qty,
      harga: row.harga,
      keterangan: row.keterangan?.trim() || null,
      is_system: row.is_system,
      system_key: row.system_key ?? null,
      urutan: row.urutan,
    }
  })
  const signers = Object.entries(input.signers).sort().map(([role, name]) => {
    if (!signerRoles.has(role) || typeof name !== 'string') throw new Error('Penandatangan RAB tidak valid.')
    return { role, name: name.trim() }
  })
  return { upserts, deletes: input.deletes, signers, ids: [...ids] }
}

export const linkedRabItemsSql = `
  SELECT 1 FROM ehb_keuangan_transaksi
  WHERE rab_item_id IN (SELECT value FROM json_each(?))
`

export function rabWriteStatements(
  eventId: number,
  request: RabSaveRequest,
  changes: ReturnType<typeof normalizeRabSave>,
  revision: string,
  hash: string,
) {
  // Only the attempt that changed the revision may write. A losing or retried
  // request can read the outcome in the same batch without changing any rows.
  const accepted = 'EXISTS (SELECT 1 FROM ehb_rab_revision WHERE ehb_event_id = ? AND revision = ?)'
  const rows = JSON.stringify(changes.upserts)
  const deletes = JSON.stringify(changes.deletes)
  const statements = [{
    sql: `
      INSERT INTO ehb_rab_revision (ehb_event_id, revision, request_id, request_hash)
      SELECT e.id, ?, ?, ? FROM ehb_event e
      LEFT JOIN ehb_rab_revision r ON r.ehb_event_id = e.id
      WHERE e.id = ? AND e.is_active = 1 AND COALESCE(r.revision, '') = ?
        AND COALESCE(r.request_id, '') <> ?
        AND (SELECT COUNT(*) FROM ehb_rab_item
          WHERE ehb_event_id = e.id AND id IN (SELECT value FROM json_each(?))) = ?
        AND NOT EXISTS (${linkedRabItemsSql})
      ON CONFLICT(ehb_event_id) DO UPDATE SET revision = excluded.revision,
        request_id = excluded.request_id, request_hash = excluded.request_hash
    `,
    params: [revision, request.requestId, hash, eventId, request.revision, request.requestId,
      JSON.stringify(changes.ids), changes.ids.length, deletes] as unknown[],
  }]
  if (changes.upserts.some(row => row.id !== null)) {
    statements.push({
      sql: `
        UPDATE ehb_rab_item AS r SET
          kategori = j.value ->> '$.kategori', nama_barang = j.value ->> '$.nama_barang',
          qty = j.value ->> '$.qty', harga = j.value ->> '$.harga', keterangan = j.value ->> '$.keterangan',
          is_system = j.value ->> '$.is_system', system_key = j.value ->> '$.system_key',
          urutan = j.value ->> '$.urutan', updated_at = datetime('now')
        FROM json_each(?) AS j
        WHERE r.ehb_event_id = ? AND r.id = j.value ->> '$.id' AND ${accepted}
      `,
      params: [rows, eventId, eventId, revision],
    })
  }
  if (changes.upserts.some(row => row.id === null)) {
    statements.push({
      sql: `
        INSERT INTO ehb_rab_item
          (ehb_event_id, client_key, kategori, nama_barang, qty, harga, keterangan, is_system, system_key, urutan)
        SELECT ?, j.value ->> '$.clientKey', j.value ->> '$.kategori', j.value ->> '$.nama_barang', j.value ->> '$.qty',
          j.value ->> '$.harga', j.value ->> '$.keterangan', j.value ->> '$.is_system', j.value ->> '$.system_key',
          j.value ->> '$.urutan'
        FROM json_each(?) AS j WHERE j.value ->> '$.id' IS NULL AND ${accepted}
      `,
      params: [eventId, rows, eventId, revision],
    })
  }
  if (changes.deletes.length) {
    statements.push({
      sql: `DELETE FROM ehb_rab_item WHERE ehb_event_id = ?
        AND id IN (SELECT value FROM json_each(?)) AND ${accepted}`,
      params: [eventId, deletes, eventId, revision],
    })
  }
  if (changes.signers.length) {
    statements.push({
      sql: `
        INSERT INTO ehb_keuangan_signer (ehb_event_id, role, nama, updated_at)
        SELECT ?, j.value ->> '$.role', j.value ->> '$.name', datetime('now')
        FROM json_each(?) AS j WHERE ${accepted}
        ON CONFLICT(ehb_event_id, role) DO UPDATE SET nama = excluded.nama, updated_at = excluded.updated_at
      `,
      params: [eventId, JSON.stringify(changes.signers), eventId, revision],
    })
  }
  return statements
}
