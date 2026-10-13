/* eslint-disable @typescript-eslint/no-require-imports -- Isolated client regression harness. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/dashboard/santri/santri-client.tsx'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function mount(initialQuery = 'q=Ahmad&limit=20&page=3') {
  const listeners = new Map(), entries = [{ state: { __NA: true, tree: 'next-router-tree' }, query: initialQuery }]
  const pendingBack = [], navigations = []
  let position = 0, pushes = 0, active, cursor
  const history = {
    get state() { return entries[position].state },
    pushState(state) {
      entries.splice(position + 1)
      entries.push({ state, query: entries[position].query })
      position++
      pushes++
    },
    replaceState(state) { entries[position].state = state },
    back() {
      pendingBack.push(() => {
        position = Math.max(0, position - 1)
        for (const listener of [...(listeners.get('popstate') || [])]) listener({ state: history.state })
      })
    },
  }
  const window = {
    history,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn) },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
  }
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const react = {
    useState(initial) {
      const hooks = active.hooks, index = cursor++
      if (!hooks[index]) hooks[index] = { value: initial }
      return [hooks[index].value, value => { hooks[index].value = value }]
    },
    useRef(initial) {
      const hooks = active.hooks, index = cursor++
      if (!hooks[index]) hooks[index] = { current: initial }
      return hooks[index]
    },
    useCallback(fn, deps) {
      const hooks = active.hooks, index = cursor++
      if (!hooks[index] || !sameDeps(hooks[index].deps, deps)) hooks[index] = { value: fn, deps }
      return hooks[index].value
    },
    useEffect(fn, deps) {
      const hooks = active.hooks, index = cursor++
      if (!hooks[index] || !sameDeps(hooks[index].deps, deps)) {
        const previous = hooks[index]
        hooks[index] = { deps, fn, cleanup: previous?.cleanup }
        active.effects.push(() => { hooks[index].cleanup?.(); hooks[index].cleanup = fn() })
      }
    },
  }
  const router = {
    replace(url) { navigations.push(url); entries[position].query = url.replace(/^\?/, '') },
  }
  const jsx = (type, props) => ({ type, props })
  const stubs = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': { useRouter: () => router, useSearchParams: () => new URLSearchParams(entries[position].query) },
    '@phosphor-icons/react': new Proxy({}, { get: (_, key) => key }),
    '@/components/ui/dropdown-menu': {},
  }
  const mod = { exports: {} }
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports, window, URLSearchParams,
    require(name) { assert.ok(stubs[name], `Missing stub ${name}`); return stubs[name] },
  })
  const props = {
    marhalahList: [{ id: 1, nama: 'Marhalah 1' }],
    kelasList: [{ id: 2, nama_kelas: 'Kelas 2', marhalah_id: 1 }],
    userAsrama: null,
    filterOptions: {
      asramaKamar: [{ asrama: 'A', kamar: '1' }], asramaList: ['A'], kategoriSantriList: ['LAMA'],
      sekolahList: [], kelasSekolahList: [], statusList: ['aktif', 'keluar'], golDarahList: [],
      tahunMasukList: [], provinsiList: [], kabKotaList: [], kecamatanList: [], jemaahList: [],
    },
  }
  const parent = { hooks: [], effects: [] }
  let child, tree, modal
  function renderComponent(component, componentProps, instance) {
    active = instance; cursor = 0; instance.effects = []
    const result = component(componentProps)
    instance.effects.forEach(effect => effect())
    return result
  }
  function render() {
    tree = renderComponent(mod.exports.SantriFilter, props, parent)
    modal = nodes(tree).find(n => typeof n.type === 'function' && n.type.name === 'SantriFilterModalContent')
    if (modal) {
      child ||= { hooks: [], effects: [] }
      return renderComponent(modal.type, modal.props, child)
    }
    child = undefined
    return tree
  }
  render()
  return {
    open() { nodes(tree).find(n => n.props?.['aria-label'] === 'Filter santri').props.onClick(); return render() },
    render,
    select(label, value) { const body = render(); nodes(body).find(n => n.props?.label === label).props.onChange(value) },
    click(label) { nodes(render()).find(n => n.type === 'button' && n.props.children === label).props.onClick() },
    close() { modal.props.onClose() },
    escape() { for (const fn of listeners.get('keydown') || []) fn({ key: 'Escape' }) },
    back() { history.back() },
    flushBack() { while (pendingBack.length) pendingBack.shift()(); render() },
    replayEffects() { parent.hooks.filter(h => h.fn).forEach(h => { h.cleanup?.(); h.cleanup = h.fn() }) },
    get query() { return new URLSearchParams(entries[position].query) },
    get pushes() { return pushes },
    get pendingBack() { return pendingBack.length },
    get isOpen() { return Boolean(modal) },
    history, navigations,
  }
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}

const client = mount()
client.open()
assert.equal(client.history.state.__NA, true)
assert.equal(client.history.state.tree, 'next-router-tree')
client.render()
assert.equal(client.pendingBack, 0, 'Rerender must not close the modal or navigate back')
assert.equal(client.pushes, 1)
client.replayEffects()
assert.equal(client.pendingBack, 0, 'Strict Mode cleanup must not navigate')
assert.equal(client.pushes, 1, 'Strict Mode replay must reuse the modal entry')
client.select('Asrama', 'A')
client.select('Kamar', '1')
client.select('Status Santri', 'all')
client.click('Terapkan Filter')
client.click('Terapkan Filter')
assert.equal(client.pendingBack, 1, 'Repeated apply must close only once')
assert.equal(client.navigations.length, 0, 'URL navigation must wait until modal history is popped')
client.flushBack()
assert.equal(client.isOpen, false)
assert.equal(client.query.get('asrama'), 'A')
assert.equal(client.query.get('kamar'), '1')
assert.equal(client.query.get('status'), 'all')
assert.equal(client.query.get('q'), 'Ahmad')
assert.equal(client.query.get('limit'), '20')
assert.equal(client.query.get('page'), '1')
assert.equal(client.navigations.length, 1)
assert.equal(client.pendingBack, 0)

client.open()
assert.equal(nodes(client.render()).find(n => n.props?.label === 'Asrama').props.value, 'A')
client.click('Reset Filter')
assert.equal(client.navigations.length, 1)
client.flushBack()
assert.equal(client.query.get('asrama'), null)
assert.equal(client.query.get('kamar'), null)
assert.equal(client.query.get('status'), null)
assert.equal(client.query.get('q'), 'Ahmad')
assert.equal(client.query.get('limit'), '20')

for (const dismiss of ['close', 'escape', 'back']) {
  client.open()
  client.select('Asrama', 'A')
  client[dismiss]()
  client.flushBack()
  assert.equal(client.isOpen, false, `${dismiss} must close the modal`)
  assert.equal(client.query.get('asrama'), null, `${dismiss} must discard unapplied changes`)
  assert.equal(client.navigations.length, 2)
  assert.equal(client.pendingBack, 0)
}
console.log('Santri filter regression checks passed (apply, reset, rerender, effect replay, duplicate click, close, Escape, mobile Back).')
