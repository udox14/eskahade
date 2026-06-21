'use client'

import { useState, useEffect, useRef } from 'react'
import { getSessionRekap, getRekapBerjamaahAlfaRange, getKamarList, getSantriByAsrama, deleteAbsenBerjamaahRecords } from '../rekap-asrama/actions'
import ImportBerjamaahModal from '../rekap-asrama/ImportBerjamaahModal'
import { Flame, Home, Loader2, ChevronLeft, ChevronRight, Search, Upload, Save, Trash2, X, FileSpreadsheet } from 'lucide-react'
import { toast } from '@/lib/toast'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { ROOM_REQUIRED_ASRAMA_LIST, isAsramaTanpaKamar } from '@/lib/asrama'
import { Button, TextInput, NativeSelect, ActionIcon } from '@mantine/core'

const ASRAMA_LIST = ROOM_REQUIRED_ASRAMA_LIST
const ASRAMA_PUTRI = ['ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']
const WAKTU = ['shubuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as const
type Waktu = typeof WAKTU[number]
const WAKTU_LABEL: Record<Waktu, string> = { shubuh: 'SBH', dzuhur: 'DZH', ashar: 'ASR', maghrib: 'MAG', isya: 'ISYA' }
const WAKTU_COLOR: Record<Waktu, string> = {
  shubuh:  'bg-blue-500 hover:bg-blue-600 text-white',
  dzuhur:  'bg-sky-500 hover:bg-sky-600 text-white',
  ashar:   'bg-orange-400 hover:bg-orange-500 text-white',
  maghrib: 'bg-purple-500 hover:bg-purple-600 text-white',
  isya:    'bg-slate-600 hover:bg-slate-700 text-white',
}
const ITEMS_PER_PAGE = 20

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}
function getWednesdayOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day >= 3 ? day - 3 : day + 4
  const wednesday = new Date(d)
  wednesday.setDate(d.getDate() - diff)
  wednesday.setHours(0, 0, 0, 0)
  return wednesday
}
function thisWeekWednesday(): string {
  return toDateStr(getWednesdayOfWeek(new Date()))
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
function weekEnd(wednesday: string): string {
  return addDays(wednesday, 6)
}
function formatWeekLabel(wednesday: string): string {
  const start = new Date(wednesday)
  const end = new Date(addDays(wednesday, 6))
  const s = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  const e = end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}
function formatDayLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function RekapAbsenBerjamaahPage() {
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [asrama, setAsrama] = useState<string>(ASRAMA_LIST[0] || '')
  const [weekWednesday, setWeekWednesday] = useState(thisWeekWednesday())
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [filterKamar, setFilterKamar] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [availableKamars, setAvailableKamars] = useState<string[]>([])
  const [allSantri, setAllSantri] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const [santriList, setSantriList] = useState<any[]>([])
  const [detail, setDetail] = useState<Record<string, Record<string, any>>>({})
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const sessionInfoRef = useRef<any>(null)
  const asramaRef = useRef(asrama)
  const weekWednesdayRef = useRef(weekWednesday)

  useEffect(() => {
    asramaRef.current = asrama
    setFilterKamar('Semua')
    setPage(1)
    getKamarList(asrama).then(k => setAvailableKamars(k))
    getSantriByAsrama(asrama).then(s => setAllSantri(s))
  }, [asrama])

  useEffect(() => { weekWednesdayRef.current = weekWednesday }, [weekWednesday])

  const [sessionReady, setSessionReady] = useState(false)
  useEffect(() => {
    getSessionRekap().then(s => {
      setSessionInfo(s)
      sessionInfoRef.current = s
      if (s?.asrama_binaan) {
        setAsrama(s.asrama_binaan)
        asramaRef.current = s.asrama_binaan
      }
      setSessionReady(true)
    })
  }, [])

  useEffect(() => {
    if (sessionReady && sessionInfoRef.current?.asrama_binaan) load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady])

  async function load() {
    setLoading(true)
    setPendingDeletes(new Set())
    setPage(1)
    try {
      const wednesday = weekWednesdayRef.current
      const end = weekEnd(wednesday)
      const data = await getRekapBerjamaahAlfaRange(asramaRef.current, wednesday, end)
      setSantriList(data.santriList)
      setDetail(data.detail)
      setHasLoaded(true)
    } catch (err: any) {
      toast.error("Gagal memuat data: " + (err?.message || "Unknown error"))
    } finally {
      setLoading(false)
    }
  }

  function toggleDelete(santriId: string, tanggal: string, waktu: string) {
    const key = `${santriId}|${tanggal}|${waktu}`
    setPendingDeletes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSave() {
    if (pendingDeletes.size === 0) return
    setSaving(true)
    try {
      const records = Array.from(pendingDeletes).map(key => {
        const [santriId, tanggal, waktu] = key.split('|')
        return { santriId, tanggal, waktu }
      })
      const res = await deleteAbsenBerjamaahRecords(records)
      if (res?.success) {
        toast.success(`${res.count} record alfa berhasil dihapus.`)
        await load()
      } else {
        toast.error("Gagal menyimpan perubahan")
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan")
    } finally {
      setSaving(false)
    }
  }

  async function handleExportExcel() {
    if (filteredSantri.length === 0) {
      toast.info('Tidak ada data untuk diexport.')
      return
    }
    setExporting(true)
    const exportToast = toast.loading('Menyiapkan file Excel...')
    try {
      const XLSX = await import('xlsx')
      const activeSessions = daysArr.flatMap(tgl =>
        WAKTU.map(waktu => ({
          tanggal: tgl,
          waktu,
          label: `${formatDayLabel(tgl)} ${WAKTU_LABEL[waktu]}`,
        }))
      )
      const headers = [
        'Nama Santri', 'NIS', 'Asrama', 'Kamar', 'Total Alfa',
        ...activeSessions.map(session => session.label),
      ]
      const rows = filteredSantri.map(s => {
        const rowData: any[] = [
          s.nama_lengkap, s.nis || '-', asrama,
          s.kamar ? `Kamar ${s.kamar}` : 'Tanpa Kamar',
        ]
        let total = 0
        const statusValues = activeSessions.map(session => {
          const isAlfa = detail[s.id]?.[session.tanggal]?.[session.waktu] === 'A'
          const isDeleted = pendingDeletes.has(`${s.id}|${session.tanggal}|${session.waktu}`)
          if (isAlfa && !isDeleted) { total += 1; return 'A' }
          return ''
        })
        return [...rowData, total, ...statusValues]
      })
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      ws['!cols'] = headers.map((h, i) => ({
        wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i] || '').length)) + 2, i < 5 ? 32 : 18),
      }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Berjamaah')
      const tglAwal = weekWednesday.split('-').reverse().join('-')
      const tglAkhir = weekEnd(weekWednesday).split('-').reverse().join('-')
      const namaAsrama = asrama.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '')
      XLSX.writeFile(wb, `Rekap_Absen_Berjamaah_${namaAsrama}_${tglAwal}_sd_${tglAkhir}.xlsx`)
      toast.success('Berhasil export ke Excel')
    } catch (err) {
      console.error(err)
      toast.error('Gagal export ke Excel')
    } finally {
      toast.dismiss(exportToast)
      setExporting(false)
    }
  }

  const isPutri = ASRAMA_PUTRI.includes(asrama)
  const roomFeatureBlocked = isAsramaTanpaKamar(sessionInfo?.asrama_binaan ?? asrama)
  const daysArr = Array.from({ length: 7 }, (_, i) => addDays(weekWednesday, i))

  const filteredSantri = santriList.filter(s => {
    const matchKamar = filterKamar === 'Semua' || (s.kamar || 'Tanpa Kamar') === filterKamar
    const matchSearch = !searchQuery
      || s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase())
      || (s.nis || '').includes(searchQuery)
    return matchKamar && matchSearch
  })

  const totalPages = Math.ceil(filteredSantri.length / ITEMS_PER_PAGE)
  const paginated = filteredSantri.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const totalAlfa = filteredSantri.reduce((sum, s) => {
    const d = detail[s.id] || {}
    return sum + Object.entries(d).reduce((daySum, [tgl, dayData]) => {
      return daySum + WAKTU.filter(w => {
        return (dayData as any)[w] === 'A' && !pendingDeletes.has(`${s.id}|${tgl}|${w}`)
      }).length
    }, 0)
  }, 0)

  function getSantriAlfaDays(santriId: string) {
    const d = detail[santriId] || {}
    return daysArr.filter(tgl => {
      const dayData = d[tgl]
      if (!dayData) return false
      return WAKTU.some(w => (dayData as any)[w] === 'A')
    })
  }

  return (
    <div className="space-y-4 pb-20">

      <div className="flex flex-col gap-3 border-b pb-4">
        <div className="flex justify-between items-start gap-4">
          <DashboardPageHeader
            title="Rekap Absen Berjamaah"
            description="Verifikasi alfa shalat berjamaah per minggu."
            className="flex-1"
          />
          {hasLoaded && !loading && !isPutri && (
            <Button
              onClick={() => setShowImportModal(true)}
              leftSection={<Upload className="w-3.5 h-3.5" />}
              color="teal"
              variant="light"
              size="sm"
            >
              Import Excel
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1 bg-white border rounded-xl px-2 py-2 shadow-sm w-full">
            <ActionIcon
              onClick={() => setWeekWednesday(m => addDays(m, -7))}
              variant="subtle"
              color="gray"
              size="sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </ActionIcon>
            <span className="text-sm font-bold text-slate-700 text-center flex-1">{formatWeekLabel(weekWednesday)}</span>
            <ActionIcon
              onClick={() => setWeekWednesday(m => addDays(m, 7))}
              disabled={weekWednesday >= thisWeekWednesday()}
              variant="subtle"
              color="gray"
              size="sm"
            >
              <ChevronRight className="w-4 h-4" />
            </ActionIcon>
          </div>

          <div className="flex gap-2 items-center">
            {sessionInfo?.asrama_binaan
              ? <span className="bg-teal-100 text-teal-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap">
                  <Home className="w-3.5 h-3.5" /> {sessionInfo.asrama_binaan}
                </span>
              : <NativeSelect
                  value={asrama}
                  onChange={e => setAsrama(e.target.value)}
                  data={ASRAMA_LIST.map(a => ({ label: a, value: a }))}
                  className="flex-1"
                  size="sm"
                />
            }
            <NativeSelect
              value={filterKamar}
              onChange={e => { setFilterKamar(e.target.value); setPage(1) }}
              disabled={availableKamars.length === 0}
              data={[
                { label: 'Semua Kamar', value: 'Semua' },
                ...availableKamars.map(k => ({ label: k === 'Tanpa Kamar' ? k : `Kamar ${k}`, value: k })),
              ]}
              className="flex-1"
              size="sm"
            />
            <Button
              onClick={load}
              loading={loading}
              leftSection={loading ? null : <Search className="w-3.5 h-3.5" />}
              color={!hasLoaded ? 'teal' : 'gray'}
              variant={!hasLoaded ? 'filled' : 'light'}
              size="sm"
            >
              {hasLoaded ? 'Perbarui' : 'Tampilkan'}
            </Button>
          </div>
        </div>
      </div>

      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center">
            <Flame className="w-8 h-8 text-teal-300" />
          </div>
          <div>
            <p className="font-bold text-slate-500">Data belum dimuat</p>
            <p className="text-sm text-slate-400 mt-1">Pilih asrama & minggu lalu tekan <strong>Tampilkan</strong>.</p>
          </div>
          <Button onClick={load} color="teal">Tampilkan Sekarang</Button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
        </div>
      )}

      {hasLoaded && !loading && !roomFeatureBlocked && (
        <>
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <div className="bg-white border rounded-xl px-3 py-2 text-center shadow-sm min-w-[80px]">
                <p className="text-lg font-black text-slate-800">{filteredSantri.length}</p>
                <p className="text-[10px] text-slate-400">Santri Alfa</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-center shadow-sm min-w-[80px]">
                <p className="text-lg font-black text-red-600">{totalAlfa}</p>
                <p className="text-[10px] text-red-400">Total Alfa</p>
              </div>
              {pendingDeletes.size > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-center shadow-sm min-w-[80px]">
                  <p className="text-lg font-black text-orange-600">{pendingDeletes.size}</p>
                  <p className="text-[10px] text-orange-400">Akan Dihapus</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 items-center flex-1 min-w-[200px] justify-end">
              <Button
                onClick={handleExportExcel}
                loading={exporting}
                disabled={filteredSantri.length === 0}
                leftSection={<FileSpreadsheet className="w-3.5 h-3.5" />}
                color="green"
                variant="light"
                size="sm"
              >
                Export Excel
              </Button>
              <TextInput
                placeholder="Cari santri..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
                leftSection={<Search className="w-3.5 h-3.5" />}
                size="sm"
                className="flex-1 max-w-[200px]"
              />
            </div>
          </div>

          {pendingDeletes.size > 0 && (
            <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 gap-3">
              <p className="text-sm font-bold text-orange-700">
                {pendingDeletes.size} alfa ditandai untuk dihapus
              </p>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="xs"
                  leftSection={<X className="w-3 h-3" />}
                  onClick={() => setPendingDeletes(new Set())}
                >
                  Batal
                </Button>
                <Button
                  color="orange"
                  size="xs"
                  loading={saving}
                  leftSection={<Save className="w-3 h-3" />}
                  onClick={handleSave}
                >
                  Simpan Perubahan
                </Button>
              </div>
            </div>
          )}

          {filteredSantri.length === 0 && (
            <div className="py-16 text-center text-slate-400 bg-white border rounded-2xl">
              <Flame className="w-8 h-8 mx-auto text-slate-200 mb-3" />
              <p className="font-semibold">Tidak ada santri alfa minggu ini</p>
              <p className="text-sm mt-1">Coba pilih minggu lain atau impor data absensi.</p>
            </div>
          )}

          {paginated.length > 0 && (
            <div className="space-y-3">
              {paginated.map(s => {
                const alfaDays = getSantriAlfaDays(s.id)
                const activeAlfaCount = alfaDays.reduce((sum, tgl) => {
                  const dayData = detail[s.id]?.[tgl] || {}
                  return sum + WAKTU.filter(w => (dayData as any)[w] === 'A' && !pendingDeletes.has(`${s.id}|${tgl}|${w}`)).length
                }, 0)

                return (
                  <div key={s.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition ${activeAlfaCount === 0 ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-b">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{s.nama_lengkap}</p>
                        <p className="text-[11px] text-slate-400">{s.kamar ? `Kamar ${s.kamar}` : 'Tanpa Kamar'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-black px-2 py-1 rounded-full ${activeAlfaCount > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                          {activeAlfaCount} alfa
                        </span>
                      </div>
                    </div>
                    <div className="divide-y">
                      {alfaDays.map(tgl => {
                        const dayData = detail[s.id]?.[tgl] || {}
                        const alfaWaktus = WAKTU.filter(w => (dayData as any)[w] === 'A')
                        if (alfaWaktus.length === 0) return null
                        return (
                          <div key={tgl} className="px-4 py-3 flex items-center gap-3">
                            <p className="text-xs text-slate-500 font-semibold w-24 shrink-0">{formatDayLabel(tgl)}</p>
                            <div className="flex flex-wrap gap-2">
                              {WAKTU.map(w => {
                                const isAlfa = (dayData as any)[w] === 'A'
                                if (!isAlfa) {
                                  return <div key={w} className="px-3 py-1.5 rounded-full text-xs font-bold opacity-0 pointer-events-none select-none">{WAKTU_LABEL[w]}</div>
                                }
                                const delKey = `${s.id}|${tgl}|${w}`
                                const markedForDelete = pendingDeletes.has(delKey)
                                return (
                                  <button
                                    key={w}
                                    onClick={() => toggleDelete(s.id, tgl, w)}
                                    title={markedForDelete ? 'Batalkan penghapusan' : 'Tandai hapus'}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-90 select-none ${
                                      markedForDelete
                                        ? 'bg-slate-100 text-slate-400 line-through border border-dashed border-slate-300'
                                        : WAKTU_COLOR[w]
                                    }`}
                                  >
                                    {WAKTU_LABEL[w]}
                                    {markedForDelete
                                      ? <X className="w-3 h-3 shrink-0" />
                                      : <Trash2 className="w-3 h-3 shrink-0" />
                                    }
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-2">
              <Button
                variant="default"
                size="xs"
                leftSection={<ChevronLeft className="w-3.5 h-3.5" />}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <span className="text-xs text-slate-500 font-semibold">
                {page} / {totalPages} &nbsp;·&nbsp; {filteredSantri.length} santri
              </span>
              <Button
                variant="default"
                size="xs"
                rightSection={<ChevronRight className="w-3.5 h-3.5" />}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {hasLoaded && !loading && roomFeatureBlocked && (
        <div className="py-12 text-center text-slate-400 bg-white border rounded-2xl">
          Asrama ini tidak memakai kamar, jadi tidak ikut rekap absen berjamaah.
        </div>
      )}

      {showImportModal && (
        <ImportBerjamaahModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => load()}
          santriList={allSantri}
        />
      )}
    </div>
  )
}
