'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle,
  Crown,
  Home,
  Loader2,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { ROOM_REQUIRED_ASRAMA_LIST } from '@/lib/asrama'
import {
  buatDraftManual,
  getDataPlottingManual,
  hapusSantriDariDraft,
  setKetuaKamarManual,
  simpanKonfigurasiManual,
  tambahSantriKeKamar,
  terapkanPlottingManual,
} from './actions'

type KamarConfig = {
  nomor_kamar: string
  kuota: number
  reserved_baru: number
  kuota_lama: number
  kuota_baru: number
  blok?: string | null
}

type SantriData = {
  id: string
  nama_lengkap: string
  nis: string
  jenis_kelamin: string
  kamar_asli: string | null
  sekolah: string | null
  kelas_sekolah: string | null
  marhalah_nama: string | null
  nama_kelas: string | null
  kategori_santri: string
  kategori_efektif: string
}

type DraftItem = {
  santri_id: string
  kamar_lama: string | null
  kamar_baru: string
  applied: number
}

type KetuaItem = {
  nomor_kamar: string
  santri_id: string
  nama_lengkap: string
}

type DataResult =
  | {
      error: string
      configs: KamarConfig[]
      drafts: DraftItem[]
      ketuaList: KetuaItem[]
      santriList: SantriData[]
      defaultConfigs: KamarConfig[]
    }
  | {
      configs: KamarConfig[]
      drafts: DraftItem[]
      ketuaList: KetuaItem[]
      santriList: SantriData[]
      defaultConfigs: KamarConfig[]
    }

const ASRAMA_LIST = ROOM_REQUIRED_ASRAMA_LIST

function statusClass(isi: number, kuota: number) {
  if (isi > kuota) return 'bg-red-100 text-red-700'
  if (isi === kuota) return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export default function PlottingKamarManualClient({
  userRole,
  asramaBinaan,
}: {
  userRole: string
  asramaBinaan: string | null
}) {
  const isAdmin = userRole === 'admin'
  const asramaOptions = asramaBinaan ? [asramaBinaan] : ASRAMA_LIST
  const [asrama, setAsrama] = useState(asramaOptions[0] ?? '')
  const [configs, setConfigs] = useState<KamarConfig[]>([])
  const [localKamar, setLocalKamar] = useState<KamarConfig[]>([])
  const [santriList, setSantriList] = useState<SantriData[]>([])
  const [draftMap, setDraftMap] = useState<Record<string, DraftItem>>({})
  const [ketuaMap, setKetuaMap] = useState<Record<string, KetuaItem>>({})
  const [loading, setLoading] = useState(true)
  const [configOpen, setConfigOpen] = useState(true)
  const [panelKamar, setPanelKamar] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const load = useCallback(async () => {
    if (!asrama) return
    setLoading(true)
    const result = (await getDataPlottingManual(asrama)) as DataResult
    if ('error' in result) {
      toast.error(result.error)
      setConfigs([])
      setLocalKamar([])
      setSantriList([])
      setDraftMap({})
      setKetuaMap({})
      setLoading(false)
      return
    }

    setConfigs(result.configs)
    setLocalKamar((result.configs.length ? result.configs : result.defaultConfigs).map((item) => ({ ...item })))
    setSantriList(result.santriList)
    setDraftMap(Object.fromEntries(result.drafts.map((draft) => [draft.santri_id, draft])))
    setKetuaMap(Object.fromEntries(result.ketuaList.map((ketua) => [ketua.nomor_kamar, ketua])))
    setConfigOpen(result.configs.length === 0)
    setLoading(false)
  }, [asrama, setConfigOpen, setConfigs, setDraftMap, setKetuaMap, setLoading, setLocalKamar, setSantriList])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const drafts = useMemo(() => Object.values(draftMap), [draftMap])
  const hasDraft = drafts.length > 0
  const placedIds = useMemo(() => new Set(Object.keys(draftMap)), [draftMap])
  const availableSantri = useMemo(() => {
    const q = search.trim().toLowerCase()
    return santriList.filter((santri) => {
      if (placedIds.has(santri.id)) return false
      if (!q) return true
      return [
        santri.nama_lengkap,
        santri.nis,
        santri.nama_kelas,
        santri.sekolah,
        santri.kelas_sekolah,
        santri.kategori_efektif,
      ].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [placedIds, santriList, search])

  const getSantriDiKamar = useCallback((nomorKamar: string) => {
    return santriList
      .filter((santri) => draftMap[santri.id]?.kamar_baru === nomorKamar)
      .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
  }, [draftMap, santriList])

  const updateLocalKamar = (index: number, key: keyof KamarConfig, value: string | number) => {
    setLocalKamar((prev) => prev.map((item, idx) => idx === index ? { ...item, [key]: value } : item))
  }

  const handleSaveConfig = () => {
    startTransition(async () => {
      const payload = localKamar.map((kamar) => ({
        nomor_kamar: kamar.nomor_kamar,
        kuota_lama: kamar.kuota_lama,
        kuota_baru: kamar.kuota_baru,
        blok: kamar.blok || '',
      }))
      const result = await simpanKonfigurasiManual(asrama, payload)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Konfigurasi kamar disimpan')
      await load()
    })
  }

  const handleCreateDraft = (mode: 'prefill' | 'empty') => {
    const label = mode === 'prefill' ? 'mengikuti kamar sekarang' : 'mulai kosong'
    if (!window.confirm(`Buat ulang draft ${label}? Draft lama akan diganti.`)) return
    startTransition(async () => {
      const result = await buatDraftManual(asrama, mode)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(mode === 'prefill' ? `Draft dibuat untuk ${result.total} santri` : 'Draft kosong siap diisi')
      await load()
    })
  }

  const handleAddSantri = () => {
    if (!panelKamar) return
    const ids = Array.from(selectedIds)
    startTransition(async () => {
      const result = await tambahSantriKeKamar(asrama, panelKamar, ids)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${result.total} santri ditambahkan ke kamar ${panelKamar}`)
      setSelectedIds(new Set())
      setSearch('')
      await load()
    })
  }

  const handleRemoveSantri = (santriId: string) => {
    startTransition(async () => {
      const result = await hapusSantriDariDraft(asrama, santriId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Santri dikembalikan ke daftar tersedia')
      await load()
    })
  }

  const handleSetKetua = (nomorKamar: string, santriId: string | null) => {
    startTransition(async () => {
      const result = await setKetuaKamarManual(asrama, nomorKamar, santriId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(santriId ? 'Ketua kamar ditentukan' : 'Ketua kamar dibersihkan')
      await load()
    })
  }

  const handleApply = () => {
    if (!window.confirm(`Terapkan plotting untuk ${drafts.length} santri di asrama ${asrama}?\n\nSantri aktif yang tidak masuk draft akan dikosongkan kamarnya.`)) return
    startTransition(async () => {
      const result = await terapkanPlottingManual(asrama)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Plotting diterapkan untuk ${result.count} santri. ${result.clearedCount} santri dikosongkan kamarnya.`)
      await load()
    })
  }

  const toggleSelected = (santriId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(santriId)) next.delete(santriId)
      else next.add(santriId)
      return next
    })
  }

  const handlePrint = (mode: 'all' | string) => {
    const printRooms = configs
      .filter((cfg) => mode === 'all' || cfg.nomor_kamar === mode)
      .map((cfg) => ({
        cfg,
        ketua: ketuaMap[cfg.nomor_kamar],
        members: getSantriDiKamar(cfg.nomor_kamar),
      }))

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Plotting Kamar ${escapeHtml(asrama)}</title>
  <style>
    @page { size: 210mm 330mm; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
    .page { min-height: 306mm; page-break-after: always; display: flex; flex-direction: column; }
    .page:last-child { page-break-after: avoid; }
    .header { border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 10px; }
    h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: .04em; text-transform: uppercase; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px; font-size: 11px; }
    .box { border: 1px solid #d1d5db; padding: 6px 8px; border-radius: 6px; }
    .label { color: #6b7280; font-size: 9px; text-transform: uppercase; font-weight: bold; }
    .value { font-weight: bold; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 7px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; }
    .center { text-align: center; }
    .ketua { background: #fffbeb; font-weight: bold; }
    .footer { margin-top: auto; padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 11px; }
    .sign { text-align: center; padding-top: 42px; border-top: 1px solid transparent; }
  </style>
</head>
<body>
${printRooms.map(({ cfg, ketua, members }) => {
  const totalBaru = members.filter((santri) => santri.kategori_efektif === 'BARU').length
  const totalLama = members.length - totalBaru
  return `
  <section class="page">
    <div class="header">
      <h1>Asrama ${escapeHtml(asrama)} - Kamar ${escapeHtml(cfg.nomor_kamar)}</h1>
      <div>Daftar penduduk kamar hasil plotting manual</div>
      <div class="meta">
        <div class="box"><div class="label">Kuota lama</div><div class="value">${cfg.kuota_lama}</div></div>
        <div class="box"><div class="label">Kuota baru</div><div class="value">${cfg.kuota_baru}</div></div>
        <div class="box"><div class="label">Penghuni lama</div><div class="value">${totalLama}</div></div>
        <div class="box"><div class="label">Penghuni baru</div><div class="value">${totalBaru}</div></div>
        <div class="box"><div class="label">Ketua kamar</div><div class="value">${escapeHtml(ketua?.nama_lengkap || '-')}</div></div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th class="center" style="width:32px">No</th>
          <th>Nama Santri</th>
          <th style="width:90px">NIS</th>
          <th>Kelas</th>
          <th>Sekolah</th>
          <th class="center" style="width:72px">Kategori</th>
          <th class="center" style="width:64px">Ket</th>
        </tr>
      </thead>
      <tbody>
        ${members.length ? members.map((santri, index) => {
          const isKetua = ketua?.santri_id === santri.id
          return `<tr class="${isKetua ? 'ketua' : ''}">
            <td class="center">${index + 1}</td>
            <td>${escapeHtml(santri.nama_lengkap)}</td>
            <td>${escapeHtml(santri.nis)}</td>
            <td>${escapeHtml(santri.nama_kelas || santri.kelas_sekolah || '-')}</td>
            <td>${escapeHtml([santri.sekolah, santri.kelas_sekolah ? `Kls ${santri.kelas_sekolah}` : ''].filter(Boolean).join(' ') || '-')}</td>
            <td class="center">${escapeHtml(santri.kategori_efektif || santri.kategori_santri || 'REGULER')}</td>
            <td class="center">${isKetua ? 'Ketua' : ''}</td>
          </tr>`
        }).join('') : '<tr><td colspan="7" class="center">Belum ada santri di kamar ini.</td></tr>'}
      </tbody>
    </table>
    <div class="footer">
      <div class="sign">Pengurus Asrama</div>
      <div class="sign">Pembina/Ketua Kamar</div>
    </div>
  </section>
`}).join('')}
  <script>window.onload = () => setTimeout(() => window.print(), 250)</script>
</body>
</html>`

    const popup = window.open('', '_blank')
    if (!popup) {
      toast.error('Popup cetak diblokir browser')
      return
    }
    popup.document.write(html)
    popup.document.close()
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat plotting kamar...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <DashboardPageHeader
          title="Plotting Kamar Manual"
          description="Susun kuota, penghuni, ketua kamar, lalu cetak daftar penduduk kamar baru."
          className="flex-1"
        />
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <select
              value={asrama}
              onChange={(event) => setAsrama(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {asramaOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              {asrama}
            </div>
          )}
          <button
            type="button"
            onClick={() => setConfigOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" /> Kuota
          </button>
          <button
            type="button"
            disabled={!configs.length}
            onClick={() => handlePrint('all')}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:bg-slate-300"
          >
            <Printer className="h-4 w-4" /> Cetak Semua
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-slate-800">{configs.length}</p>
          <p className="mt-1 text-xs text-slate-400">Kamar</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-indigo-700">{drafts.length}</p>
          <p className="mt-1 text-xs text-slate-400">Sudah ditempatkan</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-amber-600">{santriList.length - drafts.length}</p>
          <p className="mt-1 text-xs text-slate-400">Belum ditempatkan</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-emerald-600">{configs.reduce((sum, item) => sum + item.kuota_baru, 0)}</p>
          <p className="mt-1 text-xs text-slate-400">Kuota santri baru</p>
        </div>
      </div>

      {configOpen ? (
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-black text-slate-800">Konfigurasi Kuota Kamar</h2>
              <p className="text-sm text-slate-500">Kuota santri baru hanya disimpan sebagai slot kosong.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLocalKamar((prev) => [...prev, { nomor_kamar: '', kuota_lama: 0, kuota_baru: 0, kuota: 0, reserved_baru: 0, blok: '' }])}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" /> Tambah Kamar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleSaveConfig}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:bg-indigo-300"
              >
                <Save className="h-4 w-4" /> Simpan Kuota
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-white text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Kamar</th>
                  <th className="px-4 py-3 text-left">Blok</th>
                  <th className="px-4 py-3 text-left">Kuota Santri Lama</th>
                  <th className="px-4 py-3 text-left">Kuota Santri Baru</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {localKamar.map((kamar, index) => (
                  <tr key={`${kamar.nomor_kamar}-${index}`}>
                    <td className="px-4 py-3">
                      <input
                        value={kamar.nomor_kamar}
                        onChange={(event) => updateLocalKamar(index, 'nomor_kamar', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Nomor"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={kamar.blok || ''}
                        onChange={(event) => updateLocalKamar(index, 'blok', event.target.value.toUpperCase())}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Opsional"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        value={kamar.kuota_lama}
                        onChange={(event) => updateLocalKamar(index, 'kuota_lama', Number(event.target.value))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        value={kamar.kuota_baru}
                        onChange={(event) => updateLocalKamar(index, 'kuota_baru', Number(event.target.value))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center font-black text-slate-700">{Number(kamar.kuota_lama || 0) + Number(kamar.kuota_baru || 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setLocalKamar((prev) => prev.filter((_, idx) => idx !== index))}
                        className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-black text-slate-800">Draft Plotting</h2>
            <p className="text-sm text-slate-500">Pilih cara mulai draft, lalu isi kamar dari tombol Tambah Santri.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !configs.length}
              onClick={() => handleCreateDraft('prefill')}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              <Home className="h-4 w-4" /> Prefill Kamar Sekarang
            </button>
            <button
              type="button"
              disabled={pending || !configs.length}
              onClick={() => handleCreateDraft('empty')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> Mulai Kosong
            </button>
            <button
              type="button"
              disabled={pending || !hasDraft}
              onClick={handleApply}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300"
            >
              <CheckCircle className="h-4 w-4" /> Terapkan Plotting
            </button>
          </div>
        </div>
      </div>

      {!configs.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center text-slate-400">
          Simpan konfigurasi kamar dulu untuk mulai plotting manual.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {configs.map((cfg) => {
            const members = getSantriDiKamar(cfg.nomor_kamar)
            const ketua = ketuaMap[cfg.nomor_kamar]
            const totalBaru = members.filter((santri) => santri.kategori_efektif === 'BARU').length
            const totalLama = members.length - totalBaru
            const isOver = totalLama > cfg.kuota_lama || totalBaru > cfg.kuota_baru
            const isFull = totalLama >= cfg.kuota_lama && totalBaru >= cfg.kuota_baru
            return (
              <div key={cfg.nomor_kamar} className={`rounded-2xl border bg-white shadow-sm ${isOver ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-800">Kamar {cfg.nomor_kamar}</h3>
                      {cfg.blok ? <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">Blok {cfg.blok}</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                      <span>Lama {totalLama}/{cfg.kuota_lama}</span>
                      <span>Baru {totalBaru}/{cfg.kuota_baru}</span>
                      <span className={`rounded-full px-2 py-0.5 ${statusClass(totalLama + totalBaru, cfg.kuota_lama + cfg.kuota_baru)}`}>
                        {isOver ? 'Over' : isFull ? 'Penuh' : 'Tersedia'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePrint(cfg.nomor_kamar)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    title="Cetak kamar ini"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </div>

                <div className="border-b bg-amber-50/60 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                    <Crown className="h-4 w-4" /> Ketua Kamar
                  </div>
                  <select
                    value={ketua?.santri_id || ''}
                    disabled={pending || members.length === 0}
                    onChange={(event) => handleSetKetua(cfg.nomor_kamar, event.target.value || null)}
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
                  >
                    <option value="">Belum ditentukan</option>
                    {members.map((santri) => <option key={santri.id} value={santri.id}>{santri.nama_lengkap}</option>)}
                  </select>
                </div>

                <div className="space-y-2 p-3">
                  <button
                    type="button"
                    disabled={pending || isFull}
                    onClick={() => {
                      setPanelKamar(cfg.nomor_kamar)
                      setSelectedIds(new Set())
                      setSearch('')
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <Plus className="h-4 w-4" /> Tambah Santri
                  </button>

                  <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {members.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400">Belum ada santri di draft kamar ini.</div>
                    ) : members.map((santri) => {
                      const isKetua = ketua?.santri_id === santri.id
                      return (
                        <div key={santri.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${isKetua ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-bold text-slate-800">{santri.nama_lengkap}</p>
                              {isKetua ? <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : null}
                              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black ${santri.kategori_efektif === 'BARU' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                {santri.kategori_efektif || santri.kategori_santri || 'REGULER'}
                              </span>
                            </div>
                            <p className="truncate text-[10px] text-slate-400">{santri.nis} - {santri.nama_kelas || santri.sekolah || '-'}</p>
                          </div>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleRemoveSantri(santri.id)}
                            className="rounded-md p-1.5 text-rose-500 hover:bg-rose-100 disabled:opacity-50"
                            title="Hapus dari draft"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {panelKamar ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setPanelKamar(null)}>
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">Tambah ke Kamar {panelKamar}</h3>
                <p className="text-sm text-slate-500">Santri yang sudah ditempatkan tidak muncul di sini.</p>
              </div>
              <button type="button" onClick={() => setPanelKamar(null)} className="rounded-full p-2 hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="border-b p-4">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nama, NIS, kelas..."
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {availableSantri.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  Tidak ada santri tersedia.
                </div>
              ) : availableSantri.map((santri) => {
                const checked = selectedIds.has(santri.id)
                return (
                  <button
                    type="button"
                    key={santri.id}
                    onClick={() => toggleSelected(santri.id)}
                    className={`flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-indigo-50 ${checked ? 'bg-indigo-50' : 'bg-white'}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'}`}>
                      {checked ? <CheckCircle className="h-4 w-4" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{santri.nama_lengkap}</p>
                      <p className="truncate text-xs text-slate-400">{santri.nis} - {santri.nama_kelas || 'Belum masuk kelas'} - Kamar lama {santri.kamar_asli || '-'}</p>
                      <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-black ${santri.kategori_efektif === 'BARU' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {santri.kategori_efektif || santri.kategori_santri || 'REGULER'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between border-t bg-slate-50 px-5 py-4">
              <span className="text-sm font-semibold text-slate-500">{selectedIds.size} santri dipilih</span>
              <button
                type="button"
                disabled={pending || selectedIds.size === 0}
                onClick={handleAddSantri}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-slate-300"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Tambahkan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
