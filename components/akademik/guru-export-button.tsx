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
    <button ref={trigger} type="button" aria-label="Export Excel" onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
      <Download className="h-4 w-4" /><span><span className="hidden sm:inline">Export </span>Excel</span>
    </button>
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
  const [mapelIds, setMapelIds] = useState<number[]>([])
  const [sesiIds, setSesiIds] = useState<string[]>([])
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
      setMapelIds(chosenMapel ? [chosenMapel.id] : [])
      setSesiIds(chosenSesi ? [chosenSesi.id] : [])
      setJenis(chosenJenis?.key ?? '')
      setScope(props.module === 'nilai' ? chosenSesi ? 'sesi' : chosenMapel ? 'mapel' : 'semua' : chosenJenis ? 'jenis' : 'semua')
    }).catch(() => { if (valid) setError('Pilihan ekspor belum berhasil dimuat. Silakan coba lagi.') })
      .finally(() => { if (valid) setLoading(false) })
    return () => { valid = false }
    // Defaults are captured when opening; changing options must not reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.module, props.kelasId, attempt])

  const blocked = props.getBlocked()
  const empty = options && (props.module === 'nilai' ? options.sesi.length === 0 : options.jenis.length === 0)
  const validSelection = scope === 'semua' || (props.module === 'hafalan' ? !!jenis : scope === 'mapel' ? mapelIds.length > 0 : sesiIds.length > 0)
  const summary = scope === 'semua' ? (props.module === 'nilai' ? 'Seluruh mapel dan sesi' : 'Seluruh jenis hafalan')
    : scope === 'jenis' ? options?.jenis.find(t => t.key === jenis)?.label
      : scope === 'mapel' ? `${mapelIds.length} mapel dipilih · Semua sesi` : `${sesiIds.length} sesi dipilih`

  async function download() {
    if (busyRef.current || !options || !validSelection || props.getBlocked() || empty) return
    busyRef.current = true; setBusy(true); setError('')
    const request: ExportRequest = props.module === 'nilai'
      ? scope === 'semua' ? { module: 'nilai', kelasId: props.kelasId, scope: 'semua' }
        : scope === 'sesi' ? { module: 'nilai', kelasId: props.kelasId, scope: 'sesi', sesiIds }
          : { module: 'nilai', kelasId: props.kelasId, scope: 'mapel', mapelIds }
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
          {props.module === 'nilai' && scope === 'mapel' && <fieldset disabled={busy} className="space-y-2">
            <legend className="text-sm font-semibold">Pilih mapel</legend>
            <div className="flex justify-end">
              <button type="button" onClick={() => setMapelIds(mapelIds.length === options.mapel.length ? [] : options.mapel.map(m => m.id))} className="text-xs font-semibold text-emerald-700">{mapelIds.length === options.mapel.length ? 'Kosongkan' : 'Pilih semua'}</button></div>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
              {options.mapel.map(m => <label key={m.id} className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={mapelIds.includes(m.id)} onChange={e => setMapelIds(ids => e.target.checked ? [...ids, m.id] : ids.filter(id => id !== m.id))} className="h-4 w-4 accent-emerald-600" />{m.nama}
              </label>)}
            </div>
          </fieldset>}
          {scope === 'sesi' && <fieldset disabled={busy} className="space-y-2">
            <legend className="text-sm font-semibold">Pilih sesi</legend>
            <div className="flex justify-end">
              <button type="button" onClick={() => setSesiIds(sesiIds.length === options.sesi.length ? [] : options.sesi.map(s => s.id))} className="text-xs font-semibold text-emerald-700">{sesiIds.length === options.sesi.length ? 'Kosongkan' : 'Pilih semua'}</button></div>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
              {options.sesi.map(s => <label key={s.id} className="flex cursor-pointer items-start gap-3 p-3 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={sesiIds.includes(s.id)} onChange={e => setSesiIds(ids => e.target.checked ? [...ids, s.id] : ids.filter(id => id !== s.id))} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" />
                <span>{s.nama_sesi}<span className="mt-0.5 block text-xs text-slate-500">{options.mapel.find(m => m.id === s.mapel_id)?.nama} · {s.tanggal}</span></span>
              </label>)}
            </div>
          </fieldset>}
          {scope === 'jenis' && <label className="block text-sm font-semibold">Jenis hafalan
            <select value={jenis} disabled={busy} onChange={e => setJenis(e.target.value)} className={selectClass}>
              <option value="">Pilih jenis</option>{options.jenis.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>}
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{summary}. Satu baris per santri.{props.module === 'nilai'
            ? ' Nilai setiap sesi ditampilkan dalam kolom. Jika lebih dari satu mapel/sesi, tersedia sheet masing-masing dan Gabungan.'
            : ' Ringkasan tiap jenis dipisah dalam sheet, disertai Gabungan jika lebih dari satu jenis. Hanya materi marhalah saat ini.'}</p>
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
