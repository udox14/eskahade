'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'

import { getPsbMonitoring, type PsbStatus } from '../actions'

const STATUS_LABEL: Record<PsbStatus, string> = {
  VERIFICATION: 'Belum Verifikasi',
  VERIFIED: 'Sudah Verifikasi',
  PLACED_ASRAMA: 'Sudah Asrama',
  PLACED_KAMAR: 'Sudah Kamar',
  PAID: 'Sudah Bayar',
  DONE: 'Selesai',
}

const STATUS_LIST: PsbStatus[] = ['VERIFICATION', 'VERIFIED', 'PLACED_ASRAMA', 'PLACED_KAMAR', 'PAID', 'DONE']

export default function PsbMonitoringContent() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ q: '', sekolah: '', asrama: '', status: '' })

  const load = async () => {
    setLoading(true)
    const result = await getPsbMonitoring(filters)
    setLoading(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setData(result)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => data?.rows ?? [], [data])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-6">
        {STATUS_LIST.map(status => (
          <div key={status} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-slate-500">{STATUS_LABEL[status]}</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{data?.summary?.[status] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-[1fr_160px_190px_190px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.q}
              onChange={e => setFilters(prev => ({ ...prev, q: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && load()}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Cari nama atau NIS"
            />
          </div>
          <select
            value={filters.sekolah}
            onChange={e => setFilters(prev => ({ ...prev, sekolah: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua sekolah</option>
            {data?.sekolahList?.map((item: string) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select
            value={filters.asrama}
            onChange={e => setFilters(prev => ({ ...prev, asrama: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua asrama</option>
            {data?.asramaList?.map((item: string) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select
            value={filters.status}
            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua status</option>
            {STATUS_LIST.map(status => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
          </select>
          <button onClick={load} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Tampilkan</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-blue-500" />
            Memuat monitoring...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-slate-400">Data tidak ditemukan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Santri</th>
                  <th className="px-4 py-3">Sekolah</th>
                  <th className="px-4 py-3">Asrama</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{row.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{row.nis} · {row.jenis_kelamin}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.sekolah || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.asrama || '-'} {row.kamar ? `· ${row.kamar}` : ''}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{STATUS_LABEL[row.status as PsbStatus]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {STATUS_LIST.map(status => {
                          const active = STATUS_LIST.indexOf(row.status) >= STATUS_LIST.indexOf(status)
                          return (
                            <span
                              key={status}
                              title={STATUS_LABEL[status]}
                              className={`h-2 flex-1 rounded-full ${active ? 'bg-blue-600' : 'bg-slate-200'}`}
                            />
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <BarChart3 className="h-4 w-4" />
        Monitoring ini hanya baca data, tidak mengubah progress santri.
      </div>
    </div>
  )
}
