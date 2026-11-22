// Akses peran Koperasi pada menu keuangan (temuan audit 2026-11-19 #2–#4) + migration 0199.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { DatabaseSync } = require('node:sqlite')
const { harness } = require('./finance-remediation-fixture.cjs')

const h = harness()
let count = 0
async function test(name, fn) { await fn(); count++; console.log('PASS ' + name) }
const as = (role) => { h.state.session = { id: 'u-' + role, role, roles: [role], full_name: role }; h.state.feature = true }

async function main() {
  const tarif = h.load('app/dashboard/keuangan/tarif/actions.ts')
  const penyaluran = h.load('app/dashboard/keuangan/penyaluran/actions.ts')

  await test('Admin Koperasi: Jalur Pembayaran/BRIVA-Koperasi editable, tarif/pembebasan/limit read-only', async () => {
    as('admin_koperasi')
    const data = await tarif.getPengaturanKeuanganData()
    assert.equal(data.userPermissions.canMutate, false)
    assert.equal(data.userPermissions.canConfigureKoperasi, true)
    const limit = await tarif.updateGlobalDailyLimitAction(50000)
    assert.equal(limit.success, false); assert.match(String(limit.error ?? ''), /Admin atau Bendahara/)
    const res = await tarif.createTariffAction({ item_type: 'SPP', nominal: 100000, effective_from: '2026-07-01' })
    assert.equal(res.success, false)
    assert.match(String(res.error ?? ''), /Admin atau Bendahara/)
  })

  await test('Petugas Koperasi cannot change general finance settings either', async () => {
    as('petugas_koperasi')
    const data = await tarif.getPengaturanKeuanganData()
    assert.equal(data.userPermissions.canMutate, false)
    assert.equal(data.userPermissions.canConfigureKoperasi, false)
    const limit = await tarif.updateGlobalDailyLimitAction(50000)
    assert.equal(limit.success, false); assert.match(String(limit.error ?? ''), /Admin atau Bendahara/)
  })

  await test('Bendahara keeps tarif rights; Koperasi fee settings stay Admin/Admin Koperasi', async () => {
    as('bendahara')
    // revalidatePath is unavailable outside Next.js; the permission check and the write still happen first.
    const saved = await tarif.updateGlobalDailyLimitAction(80000)
    assert.doesNotMatch(String(saved.error ?? ''), /Admin atau Bendahara/)
    assert.equal(h.db.prepare("SELECT value FROM app_settings WHERE key='uang_jajan_global_daily_limit'").get().value, '80000')
    const data = await tarif.getPengaturanKeuanganData()
    assert.equal(data.userPermissions.canMutate, true)
    assert.equal(data.userPermissions.canConfigureKoperasi, false)
    as('pimpinan')
    const viewer = await tarif.getPengaturanKeuanganData()
    assert.equal(viewer.userPermissions.canMutate, false)
    assert.equal(viewer.userPermissions.canConfigureKoperasi, false)
  })

  await test('Penyaluran permissions match the server rules per role', async () => {
    const expected = {
      admin: [true, true, true],
      bendahara: [true, true, true],
      petugas_koperasi: [true, false, false],
      admin_koperasi: [false, false, true],
      pimpinan: [false, false, false],
    }
    for (const [role, [disburse, transfer, accounts]] of Object.entries(expected)) {
      as(role)
      const { permissions } = await penyaluran.authorizeUser()
      assert.deepEqual([permissions.canDisburse, permissions.canTransfer, permissions.canManageAccounts], [disburse, transfer, accounts], role)
    }
  })

  await test('migration 0199 only appends missing Koperasi roles and is idempotent', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE fitur_akses (href TEXT UNIQUE, roles TEXT)`)
    db.exec(`INSERT INTO fitur_akses VALUES
      ('/dashboard/keuangan/tarif','["admin","bendahara","pimpinan"]'),
      ('/dashboard/keuangan/laporan','["admin","bendahara","pimpinan","admin_koperasi"]'),
      ('/dashboard/keuangan/penyaluran','["admin","bendahara","pimpinan","custom_role"]'),
      ('/dashboard/keuangan/rekonsiliasi','["admin","bendahara","pimpinan"]')`)
    const sql = fs.readFileSync('migrations/0199_finance_koperasi_menu_access.sql', 'utf8')
    db.exec(sql); db.exec(sql)
    const roles = href => JSON.parse(db.prepare('SELECT roles FROM fitur_akses WHERE href=?').get(href).roles)
    assert.deepEqual(roles('/dashboard/keuangan/tarif'), ['admin', 'bendahara', 'pimpinan', 'admin_koperasi'])
    assert.deepEqual(roles('/dashboard/keuangan/laporan'), ['admin', 'bendahara', 'pimpinan', 'admin_koperasi'])
    assert.deepEqual(roles('/dashboard/keuangan/penyaluran'), ['admin', 'bendahara', 'pimpinan', 'custom_role', 'admin_koperasi', 'petugas_koperasi'])
    assert.deepEqual(roles('/dashboard/keuangan/rekonsiliasi'), ['admin', 'bendahara', 'pimpinan'])
  })

  await test('migration 0201 adds the Kas Bank menu once and keeps customised roles', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE fitur_akses (id INTEGER PRIMARY KEY, group_name TEXT, title TEXT, href TEXT UNIQUE, icon TEXT, roles TEXT, is_active INTEGER, urutan INTEGER)`)
    const sql = fs.readFileSync('migrations/0201_finance_kas_bank_menu.sql', 'utf8')
    db.exec(sql); db.exec(sql)
    const row = db.prepare(`SELECT * FROM fitur_akses WHERE href='/dashboard/koperasi/kas-bank'`).get()
    assert.equal(row.group_name, 'Operasional'); assert.equal(row.icon, 'Landmark'); assert.equal(row.is_active, 1)
    assert.deepEqual(JSON.parse(row.roles), ['admin', 'bendahara', 'admin_koperasi', 'petugas_koperasi', 'pimpinan'])
    assert.equal(db.prepare('SELECT COUNT(*) n FROM fitur_akses').get().n, 1)
    db.exec(`UPDATE fitur_akses SET roles='["admin"]', is_active=0`)
    db.exec(sql)
    const after = db.prepare(`SELECT roles, is_active FROM fitur_akses`).get()
    assert.equal(after.roles, '["admin"]'); assert.equal(after.is_active, 1)
  })

  console.log(`koperasi menu access: ${count} passed`)
}
main().catch(error => { console.error(error); process.exit(1) })
