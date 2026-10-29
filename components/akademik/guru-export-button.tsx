'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { getGuruExportData, getGuruExportOptions } from '@/lib/akademik/guru-export-actions'
import type { ExportModule, ExportOptions, ExportRequest } from '@/lib/akademik/guru-export'

type Props = {
  module: ExportModule; kelasId: string; kelasNama: string; tahunAjaran: string
  mapelId?: number | null; sesiId?: string | null; jenis?: string | null
  getBlocked: () => boolean
}
const selectClass = 'mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500'

export function GuruExportButton(props: Props) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  if (!props.kelasId) return null
  return <>
    <div className="flex justify-end">
      <button ref={trigger} type="button" onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
        <Download className="h-4 w-4" /> Export Excel
      </button>
    </div>
    {open && <ExportDialog key={`${props.module}:${props.kelasId}`} {...props} onClose={() => { setOpen(false); trigger.current?.focus() }} />}
  </>
}

function ExportDialog(props: Props & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const active = useRef(true)
  const busyRef = useRef(false)
  const currentProps = useRef(props)
  currentProps.current = props
  const [options, setOptions] = useState<ExportOptions | null>(null)
  const [scope, setScope] = useState('semua')
  const [mapelId, setMapelId] = useState('')
  const [sesiId, setSesiId] = useState('')
  const [jenis, setJenis] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  function closeModal() {
    active.current = false
    dialog.current?.close()
    props.onClose()
  }

  useEffect(() => {
    active.current = true
    const element = dialog.current
    element?.showModal()
    return () => { active.current = false; element?.close() }
  }, [])

  useEffect(() => {
    let valid = true
    setLoading(true); setError('')
    getGuruExportOptions(props.module, props.kelasId).then(result => {
      if (!valid) return
      if (!result.ok) { setError(result.error); return }
      setOptions(result.data)
      const chosenMapel = result.data.mapel.find(m => m.id === props.mapelId)
      const chosenSesi = result.data.sesi.find(s => s.id === props.sesiId && s.mapel_id === chosenMapel?.id)
      const chosenJenis = result.data.jenis.find(t => t.key === props.jenis)
      setMapelId(chosenMapel ? String(chosenMapel.id) : '')
      setSesiId(chosenSesi?.id ?? '')
      setJenis(chosenJenis?.key ?? '')
      setScope(props.module === 'nilai' ? chosenSesi ? 'sesi' : chosenMapel ? 'mapel' : 'semua' : chosenJenis ? 'jenis' : 'semua')
    }).catch(() => { if (valid) setError('Pilihan ekspor belum berhasil dimuat. Silakan coba lagi.') })
      .finally(() => { if (valid) setLoading(false) })
    return () => { valid = false }
    // Defaults are captured when opening; changing options must not reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.module, props.kelasId, attempt])

  const blocked = props.getBlocked()
  const sessions = options?.sesi.filter(s => String(s.mapel_id) === mapelId) ?? []
  const empty = options && (props.module === 'nilai' ? options.sesi.length === 0 : options.jenis.length === 0)
  const validSelection = scope === 'semua' || (props.module === 'hafalan' ? !!jenis : !!mapelId && (scope !== 'sesi' || !!sesiId))
  const summary = scope === 'semua' ? (props.module === 'nilai' ? 'Seluruh mapel dan sesi' : 'Seluruh jenis hafalan')
    : scope === 'jenis' ? options?.jenis.find(t => t.key === jenis)?.label
      : `${options?.mapel.find(m => String(m.id) === mapelId)?.nama ?? 'Pilih mapel'}${scope === 'sesi' ? ` · ${sessions.find(s => s.id === sesiId)?.nama_sesi ?? 'Pilih sesi'}` : ' · Semua sesi'}`

  async function download() {
    if (busyRef.current || !options || !validSelection || props.getBlocked() || empty) return
    busyRef.current = true; setBusy(true); setError('')
    const request: ExportRequest = props.module === 'nilai'
      ? scope === 'semua' ? { module: 'nilai', kelasId: props.kelasId, scope: 'semua' }
        : scope === 'sesi' ? { module: 'nilai', kelasId: props.kelasId, scope: 'sesi', mapelId: Number(mapelId), sesiId }
          : { module: 'nilai', kelasId: props.kelasId, scope: 'mapel', mapelId: Number(mapelId) }
      : scope === 'semua' ? { module: 'hafalan', kelasId: props.kelasId, scope: 'semua' }
        : { module: 'hafalan', kelasId: props.kelasId, scope: 'jenis', jenis }
    try {
      const result = await getGuruExportData(request)
      if (!active.current) return
      if (!result.ok) { setError(result.error); return }
      const { downloadGuruWorkbook } = await import('@/lib/akademik/guru-export-workbook')
      if (!active.current) return
      if (currentProps.current.getBlocked()) { setError('Tunggu hingga seluruh perubahan berhasil tersimpan.'); return }
      const downloaded = await downloadGuruWorkbook(result.data, () => active.current && !currentProps.current.getBlocked())
      if (active.current) {
        if (downloaded) closeModal()
        else setError('Tunggu hingga seluruh perubahan berhasil tersimpan.')
      }
    } catch {
      if (active.current) setError('File Excel belum berhasil dibuat. Silakan coba lagi.')
    } finally {
      busyRef.current = false
      if (active.current) setBusy(false)
    }
  }

  return <dialog ref={dialog} aria-labelledby="guru-export-title" onCancel={event => { event.preventDefault(); closeModal() }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40">
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
      <h2 id="guru-export-title" className="text-lg font-bold">Export Excel {props.module === 'nilai' ? 'Nilai Harian' : 'Hafalan'}</h2>
      <button autoFocus type="button" aria-label="Tutup opsi ekspor" onClick={closeModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
    </div>
    <div className="space-y-4 p-5">
      <div className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold">{props.kelasNama}</p><p className="mt-1 text-slate-500">Tahun ajaran {props.tahunAjaran || '-'}</p></div>
      {loading ? <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat pilihan ekspor…</p> : <>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {!options && <button type="button" onClick={() => setAttempt(v => v + 1)} className="text-sm font-semibold text-emerald-700">Coba lagi</button>}
        {empty ? <p className="text-sm text-slate-500">Belum ada {props.module === 'nilai' ? 'sesi nilai harian' : 'materi hafalan'} yang dapat diekspor.</p> : options && <>
          <label className="block text-sm font-semibold">Cakupan ekspor
            <select value={scope} disabled={busy} onChange={e => setScope(e.target.value)} className={selectClass}>
              <option value="semua">{props.module === 'nilai' ? 'Seluruh Mapel' : 'Seluruh Jenis'}</option>
              {props.module === 'nilai' ? <><option value="mapel">Per Mapel</option><option value="sesi">Per Sesi</option></> : <option value="jenis">Per Jenis</option>}
            </select>
          </label>
          {props.module === 'nilai' && scope !== 'semua' && <label className="block text-sm font-semibold">Mapel
            <select value={mapelId} disabled={busy} onChange={e => { setMapelId(e.target.value); setSesiId('') }} className={selectClass}>
              <option value="">Pilih mapel</option>{options.mapel.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </label>}
          {scope === 'sesi' && <label className="block text-sm font-semibold">Sesi
            <select value={sesiId} disabled={busy || !mapelId} onChange={e => setSesiId(e.target.value)} className={selectClass}>
              <option value="">Pilih sesi</option>{sessions.map(s => <option key={s.id} value={s.id}>{s.nama_sesi} · {s.tanggal}</option>)}
            </select>
          </label>}
          {scope === 'jenis' && <label className="block text-sm font-semibold">Jenis hafalan
            <select value={jenis} disabled={busy} onChange={e => setJenis(e.target.value)} className={selectClass}>
              <option value="">Pilih jenis</option>{options.jenis.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>}
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{summary}. File berisi lembar Rekap dan Detail.{props.module === 'hafalan' && ' Hanya materi marhalah saat ini.'}</p>
        </>}
      </>}
      {blocked && <p role="status" className="text-sm text-amber-800">Tunggu hingga seluruh perubahan berhasil tersimpan. Jika penyimpanan gagal, gunakan Coba lagi pada halaman input terlebih dahulu.</p>}
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
      <button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold">Batal</button>
      <button type="button" disabled={loading || busy || blocked || !options || !validSelection || !!empty} onClick={download}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Menyiapkan Excel…' : 'Unduh Excel'}
      </button>
    </div>
  </dialog>
}
