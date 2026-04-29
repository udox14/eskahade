'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Home,
  Loader2,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  cariSantriSakit,
  getDaftarAsramaSakit,
  getDataSakit,
  getRiwayatSakit,
  getSessionInfo,
  hapusDataSakit,
  simpanDataSakit,
  tandaiSembuh,
  type DataSakitRow,
  type RiwayatSakitItem,
  type SantriSakitOption,
  type SesiSakit,
  type SessionInfo,
} from './actions'

const SESI_OPTIONS: Array<{
  value: SesiSakit
  label: string
  description: string
  active: string
  inactive: string
  text: string
}> = [
  {
    value: 'PAGI',
    label: 'Pagi',
    description: 'Sebelum sekolah',
    active: 'bg-sky-600 border-sky-600 shadow-sky-100',
    inactive: 'bg-sky-50 border-sky-100 hover:border-sky-300',
    text: 'text-sky-700',
  },
  {
    value: 'SORE',
    label: 'Sore',
    description: 'Sebelum Ashar',
    active: 'bg-amber-500 border-amber-500 shadow-amber-100',
    inactive: 'bg-amber-50 border-amber-100 hover:border-amber-300',
    text: 'text-amber-700',
  },
  {
    value: 'MALAM',
    label: 'Malam',
    description: 'Sebelum Maghrib',
    active: 'bg-indigo-600 border-indigo-600 shadow-indigo-100',
    inactive: 'bg-indigo-50 border-indigo-100 hover:border-indigo-300',
    text: 'text-indigo-700',
  },
]

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

function localDateTimeNow() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function getDefaultSesi(): SesiSakit {
  const hour = new Date().getHours()
  if (hour >= 17) return 'MALAM'
  if (hour >= 12) return 'SORE'
  return 'PAGI'
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sesiLabel(value: SesiSakit) {
  return SESI_OPTIONS.find(item => item.value === value)?.label || value
}

export default function DataSakitPage() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [asramaList, setAsramaList] = useState<string[]>([])
  const [selectedAsrama, setSelectedAsrama] = useState('')
  const [tanggal, setTanggal] = useState(todayKey())
  const [sesi, setSesi] = useState<SesiSakit>(getDefaultSesi())
  const [rows, setRows] = useState<DataSakitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableSearch, setTableSearch] = useState('')

  const [showCatatModal, setShowCatatModal] = useState(false)
  const [santriSearch, setSantriSearch] = useState('')
  const [hasilCari, setHasilCari] = useState<SantriSakitOption[]>([])
  const [selectedSantri, setSelectedSantri] = useState<SantriSakitOption | null>(null)
  const [sakitApa, setSakitApa] = useState('')
  const [beliSurat, setBeliSurat] = useState(false)
  const [mulaiAt, setMulaiAt] = useState(localDateTimeNow())

  const [detailSantri, setDetailSantri] = useState<DataSakitRow | null>(null)
  const [riwayat, setRiwayat] = useState<RiwayatSakitItem[]>([])
  const [loadingRiwayat, setLoadingRiwayat] = useState(false)
  const [deletingEpisodeId, setDeletingEpisodeId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const confirm = useConfirm()

  const loadBootstrap = async () => {
    const [info, asramas] = await Promise.all([getSessionInfo(), getDaftarAsramaSakit()])
    setSessionInfo(info)
    setAsramaList(asramas)
    setSelectedAsrama(info?.asrama_binaan || asramas[0] || '')
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBootstrap()
  }, [])

  const loadData = useCallback(async () => {
    if (!selectedAsrama) return
    setLoading(true)
    const data = await getDataSakit({ asrama: selectedAsrama })
    setRows(data)
    setLoading(false)
  }, [selectedAsrama])

  useEffect(() => {
    if (selectedAsrama) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData()
    }
  }, [selectedAsrama, loadData])

  const filteredRows = useMemo(() => {
    const needle = tableSearch.trim().toLowerCase()
    if (!needle) return rows

    return rows.filter(row => [
      row.nama_lengkap,
      row.nis,
      row.kamar,
      row.asrama,
      row.sakit_apa,
      row.beli_surat ? 'beli surat surat sakit' : 'tanpa surat',
    ].some(value => String(value || '').toLowerCase().includes(needle)))
  }, [rows, tableSearch])

  const resetModal = () => {
    setSantriSearch('')
    setHasilCari([])
    setSelectedSantri(null)
    setSakitApa('')
    setBeliSurat(false)
    setMulaiAt(localDateTimeNow())
    setSesi(getDefaultSesi())
    setTanggal(todayKey())
  }

  const openCatatModal = () => {
    resetModal()
    setShowCatatModal(true)
  }

  const closeCatatModal = () => {
    setShowCatatModal(false)
    resetModal()
  }

  const handleSearchSantri = async () => {
    if (santriSearch.trim().length < 2) {
      toast.warning('Ketik minimal 2 huruf nama atau NIS')
      return
    }

    const res = await cariSantriSakit(santriSearch, selectedAsrama)
    setHasilCari(res)
    if (res.length === 0) toast.info('Santri tidak ditemukan')
  }

  const handlePilihSantri = (santri: SantriSakitOption) => {
    setSelectedSantri(santri)
    setHasilCari([])
    setSantriSearch(santri.nama_lengkap)

    const current = rows.find(row => row.santri_id === santri.id)
    if (current) {
      setSakitApa(current.sakit_apa === '-' ? '' : current.sakit_apa)
      setBeliSurat(current.beli_surat === 1)
      if (current.mulai_at) {
        const date = new Date(current.mulai_at)
        if (!Number.isNaN(date.getTime())) {
          date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
          setMulaiAt(date.toISOString().slice(0, 16))
        }
      }
    } else {
      setSakitApa('')
      setBeliSurat(false)
      setMulaiAt(localDateTimeNow())
    }
  }

  const openUpdateModal = (row: DataSakitRow) => {
    setShowCatatModal(true)
    handlePilihSantri({
      id: row.santri_id,
      nama_lengkap: row.nama_lengkap,
      nis: row.nis,
      kamar: row.kamar,
      asrama: row.asrama,
    })
  }

  const handleSimpan = () => {
    if (!selectedSantri) {
      toast.error('Pilih santri dulu')
      return
    }

    startTransition(async () => {
      const res = await simpanDataSakit({
        santriId: selectedSantri.id,
        tanggal,
        sesi,
        mulaiAt,
        sakitApa,
        beliSurat,
      })

      if ('error' in res) {
        toast.error(res.error)
        return
      }

      toast.success(res.updated ? 'Data sakit diperbarui' : 'Data sakit dicatat', {
        description: selectedSantri.nama_lengkap,
      })
      closeCatatModal()
      await loadData()
    })
  }

  const openDetail = async (row: DataSakitRow) => {
    setDetailSantri(row)
    setLoadingRiwayat(true)
    const data = await getRiwayatSakit(row.santri_id)
    setRiwayat(data)
    setLoadingRiwayat(false)
  }

  const handleSembuh = (row: DataSakitRow) => {
    startTransition(async () => {
      const res = await tandaiSembuh({
        episodeId: row.episode_id,
        tanggal: todayKey(),
        sesi,
        sembuhAt: localDateTimeNow(),
      })

      if ('error' in res) {
        toast.error(res.error)
        return
      }

      toast.success('Santri ditandai sembuh', { description: row.nama_lengkap })
      await loadData()
    })
  }

  const handleHapus = async (row: DataSakitRow) => {
    if (!await confirm(`Hapus data sakit ${row.nama_lengkap}?\n\nSemua catatan episode ini akan dihapus.`)) return

    setDeletingEpisodeId(row.episode_id)
    const res = await hapusDataSakit({ episodeId: row.episode_id })
    setDeletingEpisodeId(null)

    if ('error' in res) {
      toast.error('Gagal menghapus data', { description: res.error })
      return
    }

    toast.success('Data sakit dihapus', { description: row.nama_lengkap })
    if (detailSantri?.episode_id === row.episode_id) {
      setDetailSantri(null)
      setRiwayat([])
    }
    await loadData()
  }

  const selectedActiveRow = selectedSantri ? rows.find(row => row.santri_id === selectedSantri.id) : null

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Sakit</h1>
          <p className="text-sm text-slate-500 mt-1">Input sekali, update bila ada perubahan, lalu tandai sembuh ketika sudah pulih.</p>
        </div>
        <button
          onClick={openCatatModal}
          disabled={!selectedAsrama}
          className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" /> Catat Sakit
        </button>
      </div>

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-slate-50 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-800">Santri Sakit Aktif</h2>
              <p className="text-sm text-slate-500">Daftar santri yang belum ditandai sembuh.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className={`border rounded-xl px-3 py-2 bg-white flex items-center gap-2 ${sessionInfo?.asrama_binaan ? 'border-emerald-200 bg-emerald-50' : ''}`}>
                {sessionInfo?.asrama_binaan ? <Lock className="w-4 h-4 text-emerald-700" /> : <Home className="w-4 h-4 text-slate-400" />}
                <select
                  value={selectedAsrama}
                  onChange={e => setSelectedAsrama(e.target.value)}
                  disabled={Boolean(sessionInfo?.asrama_binaan)}
                  className="bg-transparent outline-none text-sm font-bold text-slate-700 disabled:cursor-not-allowed"
                >
                  {asramaList.map(asrama => <option key={asrama} value={asrama}>{asrama}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              placeholder="Cari nama, kamar, atau sakitnya"
              className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-bold min-w-[240px]">Santri</th>
                <th className="px-4 py-3 text-left font-bold w-40">Asrama</th>
                <th className="px-4 py-3 text-left font-bold min-w-[180px]">Mulai</th>
                <th className="px-4 py-3 text-left font-bold min-w-[220px]">Sakit</th>
                <th className="px-4 py-3 text-left font-bold w-32">Surat</th>
                <th className="px-4 py-3 text-right font-bold w-44">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Tidak ada santri sakit aktif.
                  </td>
                </tr>
              ) : filteredRows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button onClick={() => openDetail(row)} className="text-left">
                      <p className="font-bold text-slate-800 hover:text-emerald-700">{row.nama_lengkap}</p>
                      <p className="text-xs text-slate-400">{row.nis || '-'} - Kamar {row.kamar || '-'}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.asrama || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(row.mulai_at)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.sakit_apa}</td>
                  <td className="px-4 py-3">
                    {row.beli_surat ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-full">
                        <FileText className="w-3 h-3" /> Beli Surat
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                        Tanpa Surat
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openUpdateModal(row)} className="text-xs font-bold text-emerald-700 hover:text-emerald-900 mr-3">
                      Update
                    </button>
                    <button onClick={() => handleSembuh(row)} disabled={pending} className="text-xs font-bold text-sky-700 hover:text-sky-900 disabled:text-slate-400">
                      Sembuh
                    </button>
                    <button
                      onClick={() => handleHapus(row)}
                      disabled={pending || deletingEpisodeId === row.episode_id}
                      className="text-xs font-bold text-rose-700 hover:text-rose-900 disabled:text-slate-400 ml-3 inline-flex items-center gap-1"
                      title="Hapus data sakit"
                    >
                      {deletingEpisodeId === row.episode_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCatatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800">Catat Sakit</h2>
                <p className="text-sm text-slate-500">Catatan {formatDate(tanggal)} - {sesiLabel(sesi)}</p>
              </div>
              <button onClick={closeCatatModal} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid sm:grid-cols-[1fr_auto] gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Catatan</label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Sesi Catatan</label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {SESI_OPTIONS.map(item => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setSesi(item.value)}
                        className={`rounded-xl border px-3 py-2 text-left transition-all ${
                          sesi === item.value
                            ? `${item.active} text-white shadow-sm`
                            : `${item.inactive} ${item.text}`
                        }`}
                      >
                        <span className="block text-xs font-bold">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Cari Santri</label>
                <div className="flex gap-2">
                  <input
                    value={santriSearch}
                    onChange={e => setSantriSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchSantri()}
                    placeholder="Nama atau NIS"
                    className="flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                  />
                  <button onClick={handleSearchSantri} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-xl">
                    <Search className="w-4 h-4" />
                  </button>
                </div>

                {hasilCari.length > 0 ? (
                  <div className="border rounded-xl overflow-hidden">
                    {hasilCari.map(santri => (
                      <button
                        key={santri.id}
                        onClick={() => handlePilihSantri(santri)}
                        className="w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-emerald-50"
                      >
                        <p className="font-bold text-sm text-slate-800">{santri.nama_lengkap}</p>
                        <p className="text-xs text-slate-500">{santri.asrama || '-'} / Kamar {santri.kamar || '-'}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {selectedSantri ? (
                <div className="border rounded-2xl p-4 bg-emerald-50 border-emerald-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-emerald-700 uppercase">Santri Dipilih</p>
                      <p className="font-bold text-slate-900 mt-0.5">{selectedSantri.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{selectedSantri.asrama || '-'} / Kamar {selectedSantri.kamar || '-'}</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
              ) : null}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Mulai Sakit</label>
                <input
                  type="datetime-local"
                  value={mulaiAt}
                  onChange={e => setMulaiAt(e.target.value)}
                  disabled={Boolean(selectedActiveRow)}
                  className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                />
                {selectedActiveRow ? (
                  <p className="text-xs text-slate-500 mt-1">Mulai sakit dikunci karena santri ini masih dalam episode sakit aktif.</p>
                ) : null}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Sakit Apa</label>
                <textarea
                  value={sakitApa}
                  onChange={e => setSakitApa(e.target.value)}
                  rows={3}
                  placeholder="Contoh: demam, pusing, sakit perut..."
                  className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                />
              </div>

              <label className="flex items-center justify-between gap-3 border rounded-2xl p-4 cursor-pointer hover:bg-slate-50">
                <span>
                  <span className="block font-bold text-sm text-slate-800">Beli surat sakit</span>
                  <span className="block text-xs text-slate-500 mt-0.5">Aktifkan kalau santri membeli surat sakit.</span>
                </span>
                <input
                  type="checkbox"
                  checked={beliSurat}
                  onChange={e => setBeliSurat(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600"
                />
              </label>
            </div>

            <div className="p-5 border-t bg-white">
              <button
                onClick={handleSimpan}
                disabled={pending || !selectedSantri}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Simpan Data Sakit
              </button>
            </div>
          </div>
        </div>
      )}

      {detailSantri && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800">{detailSantri.nama_lengkap}</h2>
                <p className="text-sm text-slate-500">{detailSantri.asrama || '-'} / Kamar {detailSantri.kamar || '-'}</p>
              </div>
              <button onClick={() => setDetailSantri(null)} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {loadingRiwayat ? (
                <div className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
              ) : riwayat.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Belum ada riwayat sakit.</div>
              ) : (
                <div className="space-y-3">
                  {riwayat.map(item => (
                    <div key={item.id} className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                            item.status_sakit === 'SEMBUH'
                              ? 'text-sky-700 bg-sky-50'
                              : 'text-emerald-700 bg-emerald-50'
                          }`}>
                            <Clock className="w-3 h-3" /> {sesiLabel(item.sesi)}
                          </span>
                          {item.status_sakit === 'SEMBUH' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Sembuh
                            </span>
                          ) : null}
                          {item.beli_surat ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-full">
                              <FileText className="w-3 h-3" /> Beli Surat
                            </span>
                          ) : null}
                        </div>
                        <p className="font-bold text-slate-800 mt-2">{item.sakit_apa}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDate(item.tanggal)} - dicatat oleh {item.pencatat_nama || '-'}
                        </p>
                        {item.sembuh_at ? (
                          <p className="text-xs text-sky-600 mt-1">Sembuh: {formatDateTime(item.sembuh_at)}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 self-start md:self-center">
                        <button
                          onClick={() => handleHapus(item)}
                          disabled={pending || deletingEpisodeId === item.episode_id}
                          className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-900 disabled:text-slate-400 bg-rose-50 hover:bg-rose-100 px-2.5 py-2 rounded-xl"
                          title="Hapus episode sakit"
                        >
                          {deletingEpisodeId === item.episode_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          Hapus
                        </button>
                        <BookOpen className="w-5 h-5 text-slate-300 hidden md:block" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
