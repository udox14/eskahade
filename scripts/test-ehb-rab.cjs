/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test harness for transpiled server actions. */
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')
const { Miniflare } = require('miniflare')

const root = path.join(__dirname, '..')
const keuangan = 'app/dashboard/ehb/keuangan'
const signers = { ketua: '', bendahara: '', wakil_akademik: '', wakil_keuangan: '' }
const item = { kategori: 'atk_administrasi', nama_barang: 'Kertas', qty: 2, harga: 5000, is_system: 0, urutan: 1 }

function loader(stubs, globals = {}) {
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }
    cache.set(file, mod)
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    })
    vm.runInNewContext(outputText, {
      module: mod, exports: mod.exports, crypto, TextEncoder, console, setTimeout, clearTimeout,
      require(name) {
        if (Object.hasOwn(stubs, name)) return stubs[name]
        if (name.startsWith('@/')) return load(name.slice(2) + '.ts')
        if (name.startsWith('./')) return load(path.posix.join(path.posix.dirname(file), name + '.ts'))
        throw new Error(`Unexpected import: ${name}`)
      },
      ...globals,
    }, { filename: file })
    return mod.exports
  }
  return load
}

test('D1 RAB counts, migration, reference integrity, conflicts and retries', async () => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("test EHB"); } }',
    compatibilityDate: '2026-06-02',
    d1Databases: ['DB'],
  })
  try {
    const db = await mf.getD1Database('DB')
    const execute = (sql, params = []) => db.prepare(sql).bind(...params).run()
    const query = async (sql, params = []) => (await db.prepare(sql).bind(...params).all()).results
    const queryOne = (sql, params = []) => db.prepare(sql).bind(...params).first()
    const batch = statements => db.batch(statements.map(({ sql, params = [] }) => db.prepare(sql).bind(...params)))
    const migrate = async name => {
      const sql = fs.readFileSync(path.join(root, 'migrations', name), 'utf8').replace(/^\s*--.*$/gm, '')
      for (const statement of sql.split(';').map(text => text.trim()).filter(Boolean)) await execute(statement)
    }
    for (const migration of [
      '0001_schema.sql', '0004_kitab_tahun_ajaran.sql', '0011_fitur_akses.sql', '0021_multi_role.sql',
      '0024_ehb_module.sql', '0026_ehb_event_tanggal.sql', '0030_ehb_kepanitiaan.sql', '0032_ehb_keuangan.sql',
      '0033_ehb_absensi_pengawas.sql', '0034_ehb_honor_panitia.sql', '0056_user_source_link.sql', '0072_ehb_keuangan_signer.sql',
    ]) await migrate(migration)
    const seed = [
      "INSERT INTO tahun_ajaran (id, nama) VALUES (50,'Uji'),(51,'Lama')",
      "INSERT INTO ehb_event (id,tahun_ajaran_id,nama,is_active,tanggal_mulai) VALUES (1,50,'Aktif',1,'2026-11-07'),(2,51,'Lama',0,'2025-11-05')",
      "INSERT INTO ehb_rab_item (id,ehb_event_id,kategori,nama_barang,qty,harga) VALUES (91,1,'atk_administrasi','Kertas',2,5000),(92,2,'konsumsi','Snack',87,1000)",
      "INSERT INTO ehb_keuangan_transaksi (ehb_event_id,tipe,tanggal,kategori,uraian,rab_item_id) VALUES (1,'pengeluaran','2026-11-07','ATK','Kertas',91)",
      "INSERT INTO marhalah (id,nama,urutan) VALUES (50,'Ibtidaiyyah 1',1),(51,'Mutawassithah',2),(52,'Mutaqaddimah',3)",
      "INSERT INTO data_guru (id,nama_lengkap) VALUES (50,'Guru Rapor'),(51,'Guru Pemeriksa')",
      "INSERT INTO kelas (id,tahun_ajaran_id,marhalah_id,nama_kelas,jenis_kelamin,guru_maghrib_id) VALUES ('a',50,50,'A','L',50),('b',50,51,'B','L',50),('c',50,52,'C','L',50),('d',50,50,'D','L',50),('e',51,50,'E','L',50)",
      "INSERT INTO ehb_kelas_jam (ehb_event_id,kelas_id,jam_group) VALUES (1,'a','1'),(1,'b','1'),(1,'c','1'),(1,'e','1')",
      "INSERT INTO santri (id,nis,nama_lengkap,jenis_kelamin,status_global,kelas_sekolah) VALUES ('s1','u1','Satu','L','aktif',NULL),('s2','u2','Dua','L','nonaktif_sementara','9'),('s3','u3','Tiga','L','nonaktif_sementara','8'),('s4','u4','Empat','L','arsip',NULL),('s5','u5','Lima','L','aktif',NULL),('s6','u6','Enam','L','aktif',NULL),('s7','u7','Tujuh','L','aktif',NULL),('s8','u8','Delapan','L','aktif',NULL)",
      "INSERT INTO riwayat_pendidikan (id,santri_id,kelas_id) VALUES ('r1','s1','a'),('r1b','s1','a'),('r2','s2','a'),('r3','s3','a'),('r4','s4','a'),('r5','s5','b'),('r6','s6','c'),('r7','s7','d'),('r8','s8','e')",
      "INSERT INTO mapel (id,nama) VALUES (50,'Nahwu'),(51,'Sharaf')",
      "INSERT INTO kitab (id,tahun_ajaran_id,mapel_id,marhalah_id,nama_kitab) VALUES (50,50,50,50,'Nahwu'),(51,50,50,50,'Nahwu kedua')",
      "INSERT INTO ehb_sesi (id,ehb_event_id,nomor_sesi,label,jam_group) VALUES (1,1,1,'Maghrib','1')",
      "INSERT INTO ehb_jadwal (ehb_event_id,tanggal,sesi_id,kelas_id,mapel_id) VALUES (1,'2026-11-07',1,'a',50),(1,'2026-11-08',1,'a',50),(1,'2026-11-09',1,'a',51),(1,'2026-11-07',1,'b',50),(1,'2026-11-07',1,'c',50)",
      "INSERT INTO ehb_ruangan (id,ehb_event_id,nomor_ruangan) VALUES (1,1,1)",
      "INSERT INTO ehb_pengawas (id,ehb_event_id,nama_pengawas) VALUES (1,1,'Pengawas')",
      "INSERT INTO ehb_jadwal_pengawas (id,ehb_event_id,pengawas_id,ruangan_id,tanggal,sesi_id) VALUES (1,1,1,1,'2026-11-07',1)",
    ]
    await db.batch(seed.map(sql => db.prepare(sql)))
    await migrate('0197_ehb_rab_autosave.sql')
    assert.equal((await queryOne('SELECT rab_item_id FROM ehb_keuangan_transaksi')).rab_item_id, 91)

    let session = { id: 'operator' }
    const logs = []
    const load = loader({
      '@/lib/db': { execute, query, queryOne, batch, getDB: async () => db },
      '@/lib/auth/session': { getSession: async () => session },
      '@/lib/auth/feature': { assertFeature: async () => session ?? { error: 'Akses ditolak' } },
      '@/lib/akademik/guru-jadwal': { getHariIndexFromDate: () => 0 },
      '@/lib/activity-log': { actorFromSession: value => value, logActivity: async value => logs.push(value) },
      'next/cache': { revalidatePath() {} },
    }, { console: { error() {} } })
    const actions = load(keuangan + '/actions.ts')
    await load('lib/akademik/guru-kitab.ts').ensureGuruKitabSchema()
    await execute("INSERT INTO guru_kitab_assignment (tahun_ajaran_id,kelas_id,sesi,guru_id,kitab_id) VALUES (50,'a','maghrib',50,50),(50,'a','maghrib',51,51)")
    const { autoBasis: basis } = await actions.getRabData(1)
    assert.equal(basis.raporSantri, 2)
    assert.equal(basis.totalHasilUjian, 5)
    assert.equal(basis.totalPemeriksaan, 7)
    const honor = await actions.getHonorDetailData(1)
    assert.equal(honor.rows.find(row => row.jenis === 'pengisian_rapor').qty, 2)
    assert.equal(honor.rows.filter(row => row.jenis === 'pemeriksaan_hasil').length, 2)
    assert.ok(honor.rows.filter(row => row.jenis === 'pemeriksaan_hasil').every(row => row.qty === 2))
    assert.equal(honor.rows.some(row => row.jenis === 'pengawasan'), false)
    await execute("INSERT INTO ehb_absensi_pengawas (ehb_event_id,jadwal_pengawas_id,status) VALUES (1,1,'HADIR')")
    assert.equal((await actions.getHonorDetailData(1)).rows.find(row => row.jenis === 'pengawasan').qty, 1)
    for (const [student, seat] of [['s1', 1], ['s2', 2], ['s5', 3]]) {
      await execute("INSERT INTO ehb_plotting_santri (ehb_event_id,ruangan_id,santri_id,nomor_kursi,jam_group) VALUES (1,1,?,?,'1')", [student, seat])
      assert.equal(JSON.stringify((await actions.getRabData(1)).autoBasis), JSON.stringify(basis))
      const afterPlot = await actions.getHonorDetailData(1)
      assert.equal(afterPlot.rows.find(row => row.jenis === 'pengisian_rapor').qty, 2)
      assert.ok(afterPlot.rows.filter(row => row.jenis === 'pemeriksaan_hasil').every(row => row.qty === 2))
    }
    assert.equal((await actions.getPriorRabEvents(1))[0].id, 2)
    assert.equal('qty' in (await actions.getRabTemplate(1, 2))[0], false)

    const request = (revision, patch = {}) => ({ revision, requestId: randomUUID(), upserts: [], deletes: [], signers: {}, ...patch })
    const change = (id, clientKey, patch = {}) => ({ ...item, id, clientKey, ...patch })
    const first = request('', { upserts: [change(91, '91', { qty: 3 }), change(null, 'new-1')], signers: { ketua: 'Ketua Baru' } })
    const saved = await actions.saveRabItems(1, 'operator', first)
    assert.equal(saved.ok, true)
    assert.equal(saved.rows.find(row => row.id === 91).qty, 3)
    assert.equal((await actions.getRabData(1)).snapshot.signers.ketua, 'Ketua Baru')
    const insertedId = saved.rows.find(row => row.client_key === 'new-1').id
    const retry = await actions.saveRabItems(1, 'operator', first)
    assert.equal(retry.revision, saved.revision)
    assert.equal(retry.rows.find(row => row.client_key === 'new-1').id, insertedId)
    assert.equal(logs.length, 1)
    assert.equal((await actions.saveRabItems(1, 'operator', request(saved.revision, { deletes: [91] }))).ok, false)
    assert.equal((await actions.saveRabItems(1, 'operator', request(saved.revision, { deletes: [92] }))).ok, false)
    assert.equal((await queryOne('SELECT rab_item_id FROM ehb_keuangan_transaksi')).rab_item_id, 91)
    const oldRAB = (await actions.getRabData(1)).snapshot
    await assert.rejects(() => actions.saveRabItems(1, 'operator', request(saved.revision, {
      upserts: [change(91, '91', { qty: 100 }), change(null, 'new-1')],
      deletes: [],
      signers: { ketua: 'Should roll back' },
    })), /UNIQUE constraint/)
    assert.equal(JSON.stringify((await actions.getRabData(1)).snapshot), JSON.stringify(oldRAB))
    const edit = value => request(saved.revision, { upserts: [change(91, '91', { qty: value })] })
    const results = await Promise.all([actions.saveRabItems(1, 'operator', edit(4)), actions.saveRabItems(1, 'operator', edit(5))])
    assert.equal(results.filter(result => result.ok).length, 1)
    assert.equal(results.filter(result => result.conflict).length, 1)
    const staleRetry = await actions.saveRabItems(1, 'operator', first)
    assert.equal(staleRetry.conflict, true)
    assert.equal((await queryOne("SELECT COUNT(*) AS n FROM ehb_rab_item WHERE client_key = 'new-1'")).n, 1)
    assert.equal((await actions.saveRabItems(1, 'wrong-user', edit(8))).ok, false)
    assert.equal((await actions.saveRabItems(2, 'operator', request('', { upserts: [change(92, '92')] }))).ok, false)
    assert.equal((await actions.saveRabItems(1, 'operator', request('', { upserts: [change(91, '91', { qty: 0.25, harga: 1 })] }))).ok, false)
    const failedBukuKas = await actions.saveTransaksiItems(1, [{
      tipe: 'pengeluaran', tanggal: '2026-11-07', kategori: 'ATK', uraian: 'Draf usang', qty: 1, harga: 5000, rab_item_id: 99999,
    }])
    assert.ok(failedBukuKas.error)
    assert.equal((await queryOne('SELECT rab_item_id FROM ehb_keuangan_transaksi')).rab_item_id, 91)
    session = null
    await assert.rejects(() => actions.getPriorRabEvents(1), /Akses ditolak/)
    assert.equal((await query('PRAGMA foreign_key_check')).length, 0)
  } finally {
    await mf.dispose()
  }
})

test('template preserves current QTY and price, recalculates new system items and never adds duplicates', () => {
  const { planRabTemplate } = loader({})(keuangan + '/rab-template.ts')
  const active = [
    { ...item, draft_id: 'hvs', system_key: 'hvs', qty: 4, harga: 8000 },
    { ...item, draft_id: 'honor', system_key: 'honor', qty: 120, harga: 0 },
    { ...item, draft_id: 'spidol', nama_barang: '  Spidol   Hitam  ', qty: 3 },
  ]
  const source = [
    { ...item, system_key: 'hvs', qty: 99 },
    { ...item, system_key: 'honor', qty: 199, harga: 10000 },
    { ...item, system_key: 'buram', qty: 99 },
    { ...item, nama_barang: 'Konsumsi', kategori: 'konsumsi', qty: 99 },
    { ...item, nama_barang: 'spidol hitam', qty: 77 },
  ]
  const recommended = new Map([['buram', 7]])
  const result = planRabTemplate(active, source, recommended)
  assert.equal(result.additions.length, 2)
  assert.equal(result.additions[0].qty, 7)
  assert.equal(result.additions[1].qty, 0)
  assert.equal(result.prices.length, 1)
  assert.equal(result.prices[0].id, 'honor')
  const applied = [
    ...active.map(row => row.draft_id === 'honor' ? { ...row, harga: result.prices[0].harga } : row),
    ...result.additions,
  ]
  assert.equal(applied[0].qty, 4)
  assert.equal(applied[0].harga, 8000)
  assert.equal(applied[1].qty, 120)
  assert.equal(planRabTemplate(applied, source, recommended).additions.length, 0)
  assert.equal(planRabTemplate(applied, source, recommended).prices.length, 0)
  const combined = { ...item, draft_id: 'combined', system_key: 'honor_pemeriksaan_hasil', harga: 0 }
  const legacy = [
    { ...item, system_key: 'honor_pemeriksaan_header', harga: 0 },
    { ...item, system_key: 'honor_pemeriksaan_50', harga: 2000 },
    { ...item, system_key: 'honor_pemeriksaan_51', harga: 3000 },
  ]
  const differentRates = planRabTemplate([combined], legacy, recommended)
  assert.equal(differentRates.additions.length + differentRates.prices.length, 0)
  assert.equal(differentRates.skippedInspectionPrice, true)
  const uniform = planRabTemplate([combined], legacy.slice(0, 2), recommended)
  assert.equal(uniform.additions.length, 0)
  assert.equal(uniform.prices[0].harga, 2000)
})

test('cache deduplicates requests, reads a warm tab without fetching, and never restores an older response', async () => {
  let now = 0
  const { readCached, KEUANGAN_CACHE_MS } = loader({}, { Date: { now: () => now } })(keuangan + '/_cache.ts')
  const cache = new Map()
  const rabKey = 'operator:1:rab'
  const honorKey = 'operator:1:honor_detail'
  let fetches = 0
  let finish
  const fetch = () => {
    fetches++
    return new Promise(resolve => { finish = resolve })
  }
  const rab = readCached(cache, rabKey, fetch)
  const simultaneous = readCached(cache, rabKey, fetch)
  assert.equal(fetches, 1)
  finish('RAB 1')
  assert.equal(await rab, 'RAB 1')
  assert.equal(await simultaneous, 'RAB 1')
  assert.equal(await readCached(cache, rabKey, fetch), 'RAB 1')
  assert.equal(await readCached(cache, honorKey, async () => 'Honor 1'), 'Honor 1')
  assert.equal(await readCached(cache, 'other:1:rab', async () => 'RAB other user'), 'RAB other user')
  assert.equal(fetches, 1)
  now += KEUANGAN_CACHE_MS
  const expiring = readCached(cache, rabKey, fetch)
  assert.equal(fetches, 2)
  cache.set(rabKey, { value: 'RAB saved', promise: Promise.resolve('RAB saved'), expiresAt: Infinity })
  finish('Old response')
  assert.equal(await expiring, 'RAB saved')
  cache.delete(rabKey)
  assert.equal(await readCached(cache, rabKey, async () => 'RAB synced'), 'RAB synced')
})

test('autosave debounces, survives unsubscription, serializes edits and retries lost replies', async () => {
  let now = 0
  let timer
  let started = 0
  const requests = []
  const responses = []
  const load = loader({
    './actions': {
      saveRabItems: async (eventId, actorId, request) => {
        assert.equal(eventId, 1)
        assert.equal(actorId, 'operator')
        started++
        requests.push(request)
        return new Promise((resolve, reject) => responses.push({ resolve, reject }))
      },
    },
  }, {
    Date: { now: () => now },
    setTimeout(callback, delay) { timer = { callback, due: now + delay }; return timer },
    clearTimeout(id) { if (timer === id) timer = undefined },
  })
  const { createRabEditor } = load(keuangan + '/_rab-editor.ts')
  const editor = createRabEditor(1, 'operator', { drafts: [], signers, revision: '' }, () => {})
  const unsubscribe = editor.subscribe(() => {})
  const settled = () => new Promise(resolve => setImmediate(resolve))
  const advance = async time => {
    now = time
    if (timer && timer.due <= now) {
      const { callback } = timer
      timer = undefined
      callback()
    }
    await settled()
  }
  const add = { ...item, draft_id: 'first' }
  const blank = { ...item, draft_id: 'blank', nama_barang: '' }
  editor.editDrafts(() => [add, blank])
  await advance(1000)
  editor.editDrafts(() => [{ ...add, qty: 6 }, blank])
  unsubscribe()
  await advance(2999)
  assert.equal(started, 0)
  await advance(3000)
  assert.equal(started, 1)
  assert.equal(requests[0].upserts.length, 1)
  assert.equal(requests[0].upserts[0].qty, 6)
  await advance(3100)
  editor.editDrafts(() => [{ ...add, qty: 8 }, blank])
  await advance(5100)
  assert.equal(started, 1)
  const row = { ...item, id: 1, client_key: 'first', qty: 6 }
  responses[0].resolve({ ok: true, revision: 'r1', rows: [row] })
  await settled()
  await advance(5100)
  assert.equal(started, 2)
  assert.equal(requests[1].revision, 'r1')
  assert.equal(requests[1].upserts[0].id, 1)
  assert.equal(requests[1].upserts[0].qty, 8)
  responses[1].reject(new Error('Reply lost'))
  await settled()
  assert.equal(editor.getSnapshot().status, 'error')
  const retry = editor.flush()
  assert.equal(requests[1].requestId, requests[2].requestId)
  responses[2].resolve({ ok: true, revision: 'r2', rows: [{ ...row, qty: 8 }] })
  assert.equal(await retry, true)
  assert.equal(editor.getSnapshot().drafts[0].qty, 8)
  assert.equal(editor.getSnapshot().drafts[1].nama_barang, '')
})
