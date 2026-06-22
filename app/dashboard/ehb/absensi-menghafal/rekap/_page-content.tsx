'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ClipboardList,
  Filter,
  Loader2,
  Search,
} from 'lucide-react'
import { fullDateWib, shortDateWib } from '../../_date-utils'
import {
  getActiveEventLight,
  getRekapFilterOptions,
  getRekapMenghafalTidakHadir,
  type RekapMenghafalRow,
  type SesiMenghafal,
} from '../actions'

type BlokOption = {
  blok_key: string
  blok_label: string
}

const STATUS_LABEL: Record<string, string> = {
  A: 'Alfa',
  I: 'Izin',
  S: 'Sakit',
}

function statusClass(status: string | null) {
  if (status === 'A') return 'bg-red-100 text-red-700'
  if (status === 'I') return 'bg-blue-100 text-blue-700'
  return 'bg-amber-100 text-amber-700'
}

export default function RekapAbsensiMenghafalPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPath = searchParams.get('from')
  const [event, setEvent] = useState<{ id: number, nama: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<RekapMenghafalRow[]>([])
  const [sesiList, setSesiList] = useState<SesiMenghafal[]>([])
  const [tanggalList, setTanggalList] = useState<string[]>([])
  const [blokList, setBlokList] = useState<BlokOption[]>([])
  const [kamarList, setKamarList] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const [tanggal, setTanggal] = useState('')
  const [sesiId, setSesiId] = useState('')
  const [blokKey, setBlokKey] = useState('')
  const [kamar, setKamar] = useState('')
  const [status, setStatus] = useState('')

  const loadOptions = useCallback(async () => {
    setLoading(true)
    const evt = await getActiveEventLight()
    setEvent(evt || null)
    if (evt) {
      const options = await getRekapFilterOptions(evt.id)
      setSesiList(options.sesiList)
      setTanggalList(options.tanggalList)
      setBlokList(options.blokList)
      setKamarList(options.kamarList)
      const initialTanggal = options.tanggalList[0] || ''
      setTanggal(initialTanggal)
      const data = await getRekapMenghafalTidakHadir({ eventId: evt.id, tanggal: initialTanggal })
      setRows(data)
    }
    setLoading(false)
  }, [])

  const loadRows = useCallback(async () => {
    if (!event) return
    setLoading(true)
    const data = await getRekapMenghafalTidakHadir({
      eventId: event.id,
      tanggal,
      sesiId: sesiId ? Number(sesiId) : '',
      blokKey,
      kamar,
      status,
    })
    setRows(data)
    setLoading(false)
  }, [blokKey, event, kamar, sesiId, status, tanggal])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  useEffect(() => {
    if (event) loadRows()
  }, [event, loadRows])

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(row => [
      row.nama_lengkap,
      row.nis,
      row.nama_kelas,
      row.asrama,
      row.blok,
      row.kamar,
      row.sesi_label,
      STATUS_LABEL[row.status_absen || ''],
    ].some(value => String(value || '').toLowerCase().includes(needle)))
  }, [rows, search])

  const handleBack = () => {
    if (fromPath && fromPath.startsWith('/dashboard')) {
      router.push(fromPath)
      return
    }
    router.push('/dashboard/ehb/absensi-menghafal')
  }

  if (loading && !event) {
    return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
  }

  if (!event) {
    return (
      <div className="max-w-6xl mx-auto py-10 px-4">
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Belum ada event EHB yang aktif.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="h-10 w-10 rounded-full border bg-white flex items-center justify-center hover:bg-slate-50">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-teal-700" />
              Rekap Menghafal
            </h1>
            <p className="text-sm text-slate-500">{event.nama}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-teal-50 px-4 py-3 text-teal-800">
          <p className="text-xs font-bold uppercase">Tidak Hadir</p>
          <p className="text-2xl font-black">{filteredRows.length}</p>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Filter className="w-4 h-4 text-teal-700" />
          Filter Rekap
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-11 rounded-xl border px-3 text-sm bg-white">
            <option value="">Semua tanggal</option>
            {tanggalList.map(item => <option key={item} value={item}>{shortDateWib(item, false)}</option>)}
          </select>
          <select value={sesiId} onChange={e => setSesiId(e.target.value)} className="h-11 rounded-xl border px-3 text-sm bg-white">
            <option value="">Semua sesi</option>
            {sesiList.map(sesi => (
              <option key={`${sesi.tanggal}-${sesi.sesi_id}`} value={sesi.sesi_id}>
                {sesi.label} - {shortDateWib(sesi.tanggal, false)}
              </option>
            ))}
          </select>
          <select value={blokKey} onChange={e => setBlokKey(e.target.value)} className="h-11 rounded-xl border px-3 text-sm bg-white">
            <option value="">Semua blok</option>
            {blokList.map(blok => <option key={blok.blok_key} value={blok.blok_key}>{blok.blok_label}</option>)}
          </select>
          <select value={kamar} onChange={e => setKamar(e.target.value)} className="h-11 rounded-xl border px-3 text-sm bg-white">
            <option value="">Semua kamar</option>
            {kamarList.map(item => <option key={item} value={item}>Kamar {item}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-11 rounded-xl border px-3 text-sm bg-white">
            <option value="">A/I/S</option>
            <option value="A">Alfa</option>
            <option value="I">Izin</option>
            <option value="S">Sakit</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..." className="w-full h-11 rounded-xl border pl-9 pr-3 text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-500">Tidak ada data tidak hadir</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Santri</th>
                  <th className="px-4 py-3 text-left">Kelas</th>
                  <th className="px-4 py-3 text-left">Asrama</th>
                  <th className="px-4 py-3 text-left">Jadwal</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map(row => (
                  <tr key={`${row.santri_id}-${row.tanggal}-${row.sesi_id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{row.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{row.nis || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{row.nama_kelas || '-'}</p>
                      <p className="text-xs text-slate-500">{row.marhalah_nama || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{row.asrama || '-'}</p>
                      <p className="text-xs text-slate-500">Blok {row.blok || 'Tanpa Blok'} - Kamar {row.kamar || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{row.sesi_label}</p>
                      <p className="text-xs text-slate-500">{fullDateWib(row.tanggal)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${statusClass(row.status_absen)}`}>
                        {STATUS_LABEL[row.status_absen || ''] || row.status_absen}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.updated_at || row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
