/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function loadTs(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('require', 'exports', compiled)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  }, exports)
  return exports
}

async function main() {
  const catalog = loadTs('lib/dashboard/catalog.ts')
  let roleRows = []
  let selectedIds = []
  const db = {
    query: async (sql) => sql.includes('dashboard_role_widgets') ? roleRows : selectedIds.map(fitur_id => ({ fitur_id })),
    queryOne: async () => ({ user_id: 'user-1' }),
  }
  const config = loadTs('lib/dashboard/config.ts', {
    '@/lib/db': db,
    './catalog': catalog,
  })
  const allowed = [
    { id: 1, href: '/dashboard/keamanan/perizinan', is_active: true },
    { id: 2, href: '/dashboard/akademik/absensi', is_active: true },
  ]
  roleRows = [
    { role: 'pengurus_asrama', widget_key: 'permissions', position: 0, enabled: 1 },
    { role: 'pengurus_asrama', widget_key: 'activity', position: 1, enabled: 0 },
    { role: 'wali_kelas', widget_key: 'attendance', position: 0, enabled: 1 },
    { role: 'wali_kelas', widget_key: 'activity', position: 1, enabled: 0 },
  ]
  assert.deepEqual(await config.getDashboardWidgetKeys(
    ['pengurus_asrama', 'jabatan:ketua', 'wali_kelas'], allowed,
  ), ['permissions', 'attendance'])
  assert.deepEqual(await config.getDashboardWidgetKeys(
    ['pengurus_asrama', 'jabatan:ketua', 'wali_kelas'], allowed.slice(1),
  ), ['attendance'])

  selectedIds = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const menus = selectedIds.map(id => ({ id, href: `/dashboard/menu-${id}`, is_active: true }))
  assert.equal((await config.getDashboardShortcuts('user-1', menus)).length, 8)
  const afterRevocation = await config.getDashboardShortcuts('user-1', menus.slice(1))
  assert.equal(afterRevocation.length, 8)
  assert.ok(afterRevocation.every(item => item.id !== 1))
  selectedIds = []
  assert.deepEqual(await config.getDashboardShortcuts('user-1', menus), [])
  assert.equal(config.parseHeroConfig('{"imageUrl":"https://invalid.example/image.jpg"}').imageUrl,
    config.DEFAULT_HERO.imageUrl)
  assert.ok(config.parseTickerConfig(null).text.length > 0)
  let session = null
  let writes = 0
  let audits = 0
  let widgetStatements = []
  db.execute = async () => { writes += 1 }
  db.batch = async statements => { widgetStatements = statements }
  const adminActions = loadTs('app/dashboard/pengaturan/dashboard/actions.ts', {
    'next/cache': { revalidatePath: () => {} },
    '@/lib/db': db,
    '@/lib/auth/session': { getSession: async () => session, isAdmin: user => user?.role === 'admin' },
    '@/lib/activity-log': { actorFromSession: () => ({}), logActivity: async () => { audits += 1 } },
    '@/lib/dashboard/catalog': catalog,
    '@/lib/dashboard/config': config,
  })
  await assert.rejects(adminActions.saveDashboardTicker({
    text: 'Rahasia', backgroundColor: '#12372a', textColor: '#ffffff',
  }), /Akses ditolak/)
  session = { id: 'admin-1', role: 'admin' }
  await assert.rejects(adminActions.saveDashboardTicker({
    text: 'Tidak terbaca', backgroundColor: '#ffffff', textColor: '#ffffff',
  }), /Kontras/)
  const savedTicker = await adminActions.saveDashboardTicker({
    text: ' Pengumuman ', backgroundColor: '#12372a', textColor: '#ffffff',
  })
  assert.equal(savedTicker.text, 'Pengumuman')
  const savedHero = await adminActions.saveDashboardHero({
    textColor: 'black', desktop: { x: 999, y: -5, zoom: 10 }, mobile: { x: 25, y: 40, zoom: 1.2 },
  })
  assert.deepEqual(savedHero.desktop, { x: 100, y: 0, zoom: 2.5 })
  await adminActions.saveDashboardRoleWidgets('guru', ['schedule', 'activity'])
  assert.equal(widgetStatements.length, 1 + catalog.DASHBOARD_WIDGETS.length)
  assert.equal(writes, 2)
  assert.equal(audits, 3)
  const deletedUrls = []
  let uploads = 0
  const heroRoute = loadTs('app/api/dashboard/hero/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({
      status: options.status ?? 200, body,
    }) } },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/auth/session': { getSession: async () => session, isAdmin: user => user?.role === 'admin' },
    '@/lib/db': db,
    '@/lib/activity-log': { actorFromSession: () => ({}), logActivity: async () => { audits += 1 } },
    '@/lib/dashboard/config': {
      getDashboardAppearance: async () => ({
        hero: { ...config.DEFAULT_HERO, imageUrl: '/api/file/dashboard/old.png' },
      }),
      parseHeroConfig: config.parseHeroConfig,
    },
    '@/lib/r2/upload': {
      uploadBufferToR2: async () => { uploads += 1; return { url: '/api/file/dashboard/new.png' } },
      deleteFromR2: async url => { deletedUrls.push(url) },
    },
  })
  const form = new FormData()
  form.set('file', new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    'hero.png', { type: 'image/png' }))
  form.set('config', JSON.stringify({
    textColor: 'black', desktop: { x: 40, y: 60, zoom: 1.5 },
    mobile: { x: 55, y: 45, zoom: 2 },
  }))
  const request = () => new Request('https://eskahade.test/api/dashboard/hero', {
    method: 'POST', headers: { origin: 'https://eskahade.test' }, body: form,
  })
  session = null
  assert.equal((await heroRoute.POST(request())).status, 403)
  assert.equal(uploads, 0)
  session = { id: 'admin-1', role: 'admin' }
  const uploaded = await heroRoute.POST(request())
  assert.equal(uploaded.status, 200)
  assert.equal(uploaded.body.hero.textColor, 'black')
  assert.equal(uploaded.body.hero.desktop.zoom, 1.5)
  assert.deepEqual(deletedUrls, ['/api/file/dashboard/old.png'])
  assert.equal(uploads, 1)
  assert.equal(writes, 3)
  assert.equal(audits, 4)
  console.log('Dashboard config: role union, revocation, eight-shortcut cap, and safe defaults, admin gate, contrast, crop, audit PASS')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
