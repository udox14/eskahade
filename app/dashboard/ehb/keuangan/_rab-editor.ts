import { saveRabItems, type KeuanganSigners, type RabItem, type RabItemInput } from './actions'
import type { RabSaveRequest } from './rab-write'

export type DraftRabItem = RabItemInput & { draft_id: string; dbId?: number }
type EditorState = {
  drafts: DraftRabItem[]
  signers: KeuanganSigners
  status: 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict'
  error?: string
}

export function rowsToDrafts(rows: RabItem[]): DraftRabItem[] {
  return rows.map(row => ({
    draft_id: row.client_key ?? String(row.id),
    dbId: row.id,
    kategori: row.kategori,
    nama_barang: row.nama_barang,
    qty: Number(row.qty),
    harga: Number(row.harga),
    keterangan: row.keterangan || '',
    is_system: row.is_system,
    system_key: row.system_key,
    urutan: row.urutan,
  }))
}

const signerKeys = ['ketua', 'bendahara', 'wakil_akademik', 'wakil_keuangan'] as const

function rowValues(item: DraftRabItem) {
  return {
    kategori: item.kategori,
    nama_barang: item.nama_barang.trim(),
    qty: item.qty,
    harga: item.harga,
    keterangan: item.keterangan?.trim() || '',
    is_system: item.is_system || 0,
    system_key: item.system_key ?? null,
    urutan: item.urutan ?? 0,
  }
}

export function createRabEditor(
  eventId: number,
  actorId: string,
  initial: { drafts: DraftRabItem[]; signers: KeuanganSigners; revision: string },
  onSaved: (result: { rows: RabItem[]; signers: KeuanganSigners; revision: string; previous: DraftRabItem[] }) => void,
) {
  let state: EditorState = { drafts: initial.drafts, signers: initial.signers, status: 'idle' }
  let baseline = initial
  let pending: RabSaveRequest | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<boolean> | undefined
  let lastEdit = 0
  const listeners = new Set<() => void>()

  function warnPending(event: BeforeUnloadEvent) {
    event.preventDefault()
    event.returnValue = ''
  }

  function setState(patch: Partial<EditorState>) {
    state = { ...state, ...patch }
    if (typeof window !== 'undefined') {
      if (dirty()) window.addEventListener('beforeunload', warnPending)
      else window.removeEventListener('beforeunload', warnPending)
    }
    listeners.forEach(listener => listener())
  }

  function changes() {
    const oldById = new Map(baseline.drafts.filter(row => row.dbId).map(row => [row.dbId, row]))
    const editingIds = new Set(state.drafts.map(row => row.dbId))
    const upserts = state.drafts.flatMap(row => {
      const values = rowValues(row)
      if (!values.nama_barang) return []
      const old = oldById.get(row.dbId)
      if (old && JSON.stringify(rowValues(old)) === JSON.stringify(values)) return []
      return [{ ...values, id: row.dbId ?? null, clientKey: row.draft_id }]
    })
    const deletes = [...oldById.keys()].flatMap(id => id && !editingIds.has(id) ? [id] : [])
    const signers: Partial<KeuanganSigners> = {}
    for (const key of signerKeys) {
      if (state.signers[key].trim() !== baseline.signers[key]) signers[key] = state.signers[key].trim()
    }
    return { upserts, deletes, signers }
  }

  function incomplete() {
    return state.drafts.some(item => !item.nama_barang.trim())
  }

  function dirty() {
    return state.status === 'pending' || state.status === 'saving' || state.status === 'error'
      || state.status === 'conflict' || incomplete()
  }

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(() => { void flush() }, Math.max(0, 2000 - (Date.now() - lastEdit)))
  }

  function edit(patch: Partial<Pick<EditorState, 'drafts' | 'signers'>>) {
    if (Object.entries(patch).every(([key, value]) => state[key as keyof EditorState] === value)) return
    lastEdit = Date.now()
    const conflict = state.status === 'conflict'
    setState({ ...patch, status: conflict ? 'conflict' : 'pending', error: conflict ? state.error : undefined })
    if (!conflict) schedule()
  }

  async function persist(): Promise<boolean> {
    if (!pending) {
      const diff = changes()
      const clearedFirstRecommendations = !baseline.revision && baseline.drafts.some(row => !row.dbId)
        && !state.drafts.some(row => row.nama_barang.trim())
      if (!diff.upserts.length && !diff.deletes.length && !Object.keys(diff.signers).length && !clearedFirstRecommendations) {
        setState({ status: 'saved', error: undefined })
        return true
      }
      pending = { ...diff, revision: baseline.revision, requestId: crypto.randomUUID() }
    }
    const request = pending
    setState({ status: 'saving', error: undefined })
    try {
      const result = await saveRabItems(eventId, actorId, request)
      if (!result.ok) {
        pending = undefined
        setState({ status: result.conflict ? 'conflict' : 'error', error: result.error })
        return false
      }
      pending = undefined
      const previous = baseline.drafts
      const persisted = rowsToDrafts(result.rows)
      const signers = { ...baseline.signers, ...request.signers }
      baseline = { drafts: persisted, signers, revision: result.revision }
      const idByKey = new Map(persisted.map(row => [row.draft_id, row.dbId]))
      const drafts = state.drafts.map(row => {
        const dbId = idByKey.get(row.draft_id)
        return dbId && !row.dbId ? { ...row, dbId } : row
      })
      setState({ drafts, status: 'saved' })
      onSaved({ ...result, signers, previous })
      const next = changes()
      if (next.upserts.length || next.deletes.length || Object.keys(next.signers).length) {
        setState({ status: 'pending' })
        schedule()
      }
      return true
    } catch {
      // Keep the request ID: the database may have committed before the connection failed.
      setState({ status: 'error', error: 'Koneksi terputus saat menyimpan RAB. Coba lagi.' })
      return false
    }
  }

  function flush() {
    clearTimeout(timer)
    if (inFlight) return inFlight
    if (state.status === 'conflict') return Promise.resolve(false)
    inFlight = persist().finally(() => { inFlight = undefined })
    return inFlight
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    editDrafts(update: (drafts: DraftRabItem[]) => DraftRabItem[]) {
      edit({ drafts: update(state.drafts) })
    },
    editSigner(key: keyof KeuanganSigners, value: string) {
      edit({ signers: { ...state.signers, [key]: value } })
    },
    replace(next: typeof initial) {
      if (dirty()) return
      baseline = next
      setState({ drafts: next.drafts, signers: next.signers, status: 'idle', error: undefined })
    },
    discard() {
      if (inFlight) return false
      clearTimeout(timer)
      pending = undefined
      setState({ drafts: baseline.drafts, signers: baseline.signers, status: 'idle', error: undefined })
      return true
    },
    dirty,
    async finish() {
      if (incomplete()) return false
      while (dirty()) {
        if (!(await flush()) || incomplete()) return false
      }
      return true
    },
    flush,
  }
}

export type RabEditor = ReturnType<typeof createRabEditor>
