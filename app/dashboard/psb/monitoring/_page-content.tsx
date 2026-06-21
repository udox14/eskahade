'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Loader2, Search } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button, TextInput, NativeSelect, Pagination as MantinePagination } from '@mantine/core'

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
const STATUS_COLOR: Record<PsbStatus, string> = {
  VERIFICATION: 'bg-slate-100 text-slate-600',
  VERIFIED: 'bg-emerald-50 text-emerald-700',
  PLACED_ASRAMA: 'bg-emerald-100 text-emerald-800',
  PLACED_KAMAR: 'bg-green-100 text-green-800',
  PAID: 'bg-green-200 text-green-900',
  DONE: 'bg-green-700 text-white',
}
const TIMELINE_GRADIENT = ['bg-emerald-100', 'bg-emerald-200', 'bg-green-300', 'bg-green-500', 'bg-green-600', 'bg-green-800']

export default function PsbMonitoringContent() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ q: '', sekolah: '', asrama: '', status: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

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
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [filters.q, filters.sekolah, filters.asrama, filters.status])

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
          <TextInput
            value={filters.q}
            onChange={e => setFilters(prev => ({ ...prev, q: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Cari nama atau NIS"
            leftSection={<Search className="h-4 w-4"/>}
          />
          <NativeSelect
            value={filters.sekolah}
            onChange={e => setFilters(prev => ({ ...prev, sekolah: e.target.value }))}
            data={[{ label: 'Semua sekolah', value: '' }, ...(data?.sekolahList?.map((item: string) => ({ label: item, value: item })) ?? [])]}
          />
          <NativeSelect
            value={filters.asrama}
            onChange={e => setFilters(prev => ({ ...prev, asrama: e.target.value }))}
            data={[{ label: 'Semua asrama', value: '' }, ...(data?.asramaList?.map((item: string) => ({ label: item, value: item })) ?? [])]}
          />
          <NativeSelect
            value={filters.status}
            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
            data={[{ label: 'Semua status', value: '' }, ...STATUS_LIST.map(status => ({ label: STATUS_LABEL[status], value: status }))]}
          />
          <Button onClick={() => { setPage(1); load() }} color="dark">Tampilkan</Button>
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
          <>
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
                  {pagedRows.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{row.nama_lengkap}</p>
                        <p className="text-xs text-slate-500">{row.nis} · {row.jenis_kelamin}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.sekolah || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.asrama || '-'} {row.kamar ? `· ${row.kamar}` : ''}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_COLOR[row.status as PsbStatus]}`}>
                          {STATUS_LABEL[row.status as PsbStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {STATUS_LIST.map((status, index) => {
                            const active = STATUS_LIST.indexOf(row.status) >= index
                            const isVerification = status === 'VERIFICATION'
                            return (
                              <span
                                key={status}
                                title={STATUS_LABEL[status]}
                                className={`h-2 flex-1 rounded-full transition-colors ${
                                  active
                                    ? isVerification
                                      ? 'bg-slate-400'
                                      : TIMELINE_GRADIENT[index]
                                    : 'bg-slate-200'
                                }`}
                              />
                            )
                          })}
                        </div>
                        <div className="mt-1 grid grid-cols-6 gap-1 text-[9px] font-bold uppercase text-slate-400">
                          <span>Verif</span>
                          <span>OK</span>
                          <span>Asrama</span>
                          <span>Kamar</span>
                          <span>Bayar</span>
                          <span>Selesai</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Menampilkan <b>{rows.length ? (safePage - 1) * pageSize + 1 : 0}</b>–<b>{Math.min(safePage * pageSize, rows.length)}</b> dari <b>{rows.length}</b> santri
              </p>
              <div className="flex items-center gap-2">
                <NativeSelect
                  value={String(pageSize)}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                  size="xs"
                  data={[
                    { label: '10 / halaman', value: '10' },
                    { label: '20 / halaman', value: '20' },
                    { label: '50 / halaman', value: '50' },
                    { label: '100 / halaman', value: '100' },
                  ]}
                />
                <MantinePagination
                  value={safePage}
                  onChange={setPage}
                  total={totalPages}
                  withEdges
                  size="sm"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <BarChart3 className="h-4 w-4" />
        Monitoring ini hanya baca data, tidak mengubah progress santri.
      </div>
    </div>
  )
}
