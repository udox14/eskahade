'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, Filter, X, SlidersHorizontal } from 'lucide-react'

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// ── Search Input ──────────────────────────────────────────────────────────────
export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [text, setText] = useState(searchParams.get('q') || '')
  const query = useDebounce(text, 500)
  const isMounted = useRef(false)

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    const currentQuery = searchParams.get('q') || ''
    if (query === currentQuery) return
    const params = new URLSearchParams(searchParams.toString())
    if (query) params.set('q', query); else params.delete('q')
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [query, router, searchParams])

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
      <input
        type="text"
        placeholder="Cari nama atau NIS..."
        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm bg-slate-50 focus:bg-white transition-colors"
        value={text}
        onChange={e => setText(e.target.value)}
      />
    </div>
  )
}

// ── Limit Selector ────────────────────────────────────────────────────────────
export function LimitSelector() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const limit = searchParams.get('limit') || '10'

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limit', e.target.value)
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <select
      value={limit}
      onChange={handleChange}
      className="border border-slate-200 rounded-xl px-2.5 py-2.5 text-sm focus:ring-2 focus:ring-green-500 outline-none bg-slate-50 focus:bg-white transition-colors"
    >
      <option value="10">10</option>
      <option value="20">20</option>
      <option value="50">50</option>
      <option value="100">100</option>
      <option value="9999">Semua</option>
    </select>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function PaginationControls({ total, limit, page }: { total: number; limit: number; page: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const totalPages = Math.ceil(total / limit)

  const go = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-slate-500">
        Hal. <b>{page}</b>/<b>{totalPages}</b> · {total} santri
      </p>
      <div className="flex gap-1.5">
        <button
          onClick={() => go(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        {/* Halaman sekitar current */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 2, totalPages - 4))
          const p = start + i
          return (
            <button
              key={p}
              onClick={() => go(p)}
              className={`w-8 h-8 text-xs rounded-lg border transition-colors font-medium ${
                p === page
                  ? 'bg-green-600 text-white border-green-600'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => go(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>
    </div>
  )
}

// ── Filter ────────────────────────────────────────────────────────────────────
const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"]
const SEKOLAH_LIST = ["MTSU", "MTSN", "MAN", "SMK", "SMA", "SMP", "SADESA", "LAINNYA"]

export function SantriFilter({ marhalahList, kelasList }: { marhalahList: any[]; kelasList: any[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  const [asrama, setAsrama] = useState(searchParams.get('asrama') || '')
  const [kamar, setKamar] = useState(searchParams.get('kamar') || '')
  const [sekolah, setSekolah] = useState(searchParams.get('sekolah') || '')
  const [kelasSekolah, setKelasSekolah] = useState(searchParams.get('kelas_sekolah') || '')
  const [marhalah, setMarhalah] = useState(searchParams.get('marhalah') || '')
  const [kelasPesantren, setKelasPesantren] = useState(searchParams.get('kelas') || '')

  const filteredKelas = kelasList.filter(k => !marhalah || k.marhalah_id.toString() === marhalah)

  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (asrama) params.set('asrama', asrama); else params.delete('asrama')
    if (kamar) params.set('kamar', kamar); else params.delete('kamar')
    if (sekolah) params.set('sekolah', sekolah); else params.delete('sekolah')
    if (kelasSekolah) params.set('kelas_sekolah', kelasSekolah); else params.delete('kelas_sekolah')
    if (marhalah) params.set('marhalah', marhalah); else params.delete('marhalah')
    if (kelasPesantren) params.set('kelas', kelasPesantren); else params.delete('kelas')
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
    setIsOpen(false)
  }

  const handleReset = () => {
    setAsrama(''); setKamar(''); setSekolah(''); setKelasSekolah(''); setMarhalah(''); setKelasPesantren('')
    const params = new URLSearchParams(searchParams.toString())
    ;['asrama','kamar','sekolah','kelas_sekolah','marhalah','kelas'].forEach(k => params.delete(k))
    router.replace(`?${params.toString()}`, { scroll: false })
    setIsOpen(false)
  }

  const activeCount = [asrama, kamar, sekolah, kelasSekolah, marhalah, kelasPesantren].filter(Boolean).length

  return (
    <>
      {/* Tombol Filter */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors whitespace-nowrap ${
          activeCount > 0
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Filter</span>
        {activeCount > 0 && (
          <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
            {activeCount}
          </span>
        )}
      </button>

      {/* Overlay + Drawer — fixed ke viewport, tidak terpotong */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel — bottom sheet di mobile, modal di desktop */}
          <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-slate-800">Filter Santri</h3>
                {activeCount > 0 && (
                  <p className="text-xs text-blue-600 mt-0.5">{activeCount} filter aktif</p>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Tempat Tinggal */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Tempat Tinggal</p>
                <div className="space-y-2">
                  <select
                    value={asrama}
                    onChange={e => { setAsrama(e.target.value); setKamar('') }}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Semua Asrama</option>
                    {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select
                    value={kamar}
                    onChange={e => setKamar(e.target.value)}
                    disabled={!asrama}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">Semua Kamar</option>
                    {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>Kamar {n}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sekolah Formal */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Sekolah Formal</p>
                <div className="space-y-2">
                  <select
                    value={sekolah}
                    onChange={e => setSekolah(e.target.value)}
                    className="w-full p-2.5 border border-blue-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Semua Sekolah</option>
                    {SEKOLAH_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input
                    type="number"
                    value={kelasSekolah}
                    onChange={e => setKelasSekolah(e.target.value)}
                    placeholder="Kelas (contoh: 7, 8, 10)"
                    className="w-full p-2.5 border border-blue-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* Kelas Pesantren */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-3">Kelas Pesantren</p>
                <div className="space-y-2">
                  <select
                    value={marhalah}
                    onChange={e => { setMarhalah(e.target.value); setKelasPesantren('') }}
                    className="w-full p-2.5 border border-green-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="">Semua Marhalah</option>
                    {marhalahList.map((m: any) => <option key={m.id} value={m.id}>{m.nama}</option>)}
                  </select>
                  <select
                    value={kelasPesantren}
                    onChange={e => setKelasPesantren(e.target.value)}
                    disabled={!marhalah}
                    className="w-full p-2.5 border border-green-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">Semua Kelas</option>
                    {filteredKelas.map((k: any) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                  </select>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t bg-slate-50 rounded-b-2xl flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="flex-2 w-full py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                Terapkan Filter
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
