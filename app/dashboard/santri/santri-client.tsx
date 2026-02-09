'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'

// Hook Debounce Manual
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}

export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [text, setText] = useState(searchParams.get('q') || '')
  
  const query = useDebounce(text, 500)
  const isMounted = useRef(false)

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }

    const currentQuery = searchParams.get('q') || ''
    if (query === currentQuery) return

    const params = new URLSearchParams(searchParams.toString())
    if (query) {
      params.set('q', query)
    } else {
      params.delete('q')
    }
    
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [query, router, searchParams])

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
      <input 
        type="text" 
        placeholder="Cari nama santri atau NIS..." 
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  )
}

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
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span className="hidden sm:inline">Tampilkan:</span>
      <select 
        value={limit} 
        onChange={handleChange}
        className="border border-gray-300 rounded-md p-1.5 focus:ring-2 focus:ring-green-500 outline-none bg-white"
      >
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </select>
    </div>
  )
}

export function PaginationControls({ total, limit, page }: { total: number, limit: number, page: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const totalPages = Math.ceil(total / limit)

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center justify-between px-2">
      <div className="text-sm text-gray-500">
        Hal. <b>{page}</b> dari <b>{totalPages}</b> (Total: {total})
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handlePageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// --- KOMPONEN FILTER BARU ---

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
const SEKOLAH_LIST = ["MTSU", "MTSN", "MAN", "SMK", "SMA", "SMP", "SADESA", "LAINNYA"]

export function SantriFilter({ marhalahList, kelasList }: { marhalahList: any[], kelasList: any[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  // State Lokal
  const [asrama, setAsrama] = useState(searchParams.get('asrama') || '')
  const [kamar, setKamar] = useState(searchParams.get('kamar') || '')
  const [sekolah, setSekolah] = useState(searchParams.get('sekolah') || '')
  const [kelasSekolah, setKelasSekolah] = useState(searchParams.get('kelas_sekolah') || '')
  const [marhalah, setMarhalah] = useState(searchParams.get('marhalah') || '')
  const [kelasPesantren, setKelasPesantren] = useState(searchParams.get('kelas') || '')

  // Filter Kelas Pesantren berdasarkan Marhalah yang dipilih
  const filteredKelasPesantren = kelasList.filter(k => 
    !marhalah || k.marhalah_id.toString() === marhalah
  )

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
    setAsrama(''); setKamar('');
    setSekolah(''); setKelasSekolah('');
    setMarhalah(''); setKelasPesantren('');
    
    const params = new URLSearchParams(searchParams.toString())
    params.delete('asrama'); params.delete('kamar');
    params.delete('sekolah'); params.delete('kelas_sekolah');
    params.delete('marhalah'); params.delete('kelas');
    
    router.replace(`?${params.toString()}`, { scroll: false })
    setIsOpen(false)
  }

  // Hitung jumlah filter aktif
  const activeCount = [asrama, kamar, sekolah, kelasSekolah, marhalah, kelasPesantren].filter(Boolean).length

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
          activeCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Filter className="w-4 h-4" />
        Filter {activeCount > 0 && <span className="bg-blue-600 text-white text-[10px] px-1.5 rounded-full">{activeCount}</span>}
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-80 md:w-[480px] bg-white border border-gray-200 shadow-xl rounded-xl p-5 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h3 className="font-bold text-gray-800">Filter Data Santri</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button>
          </div>

          <div className="space-y-4">
            
            {/* GROUP 1: ASRAMA */}
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase mb-2 block">Tempat Tinggal</span>
              <div className="flex gap-2">
                <select value={asrama} onChange={e => { setAsrama(e.target.value); setKamar('') }} className="w-2/3 p-2 border rounded text-sm outline-none focus:border-blue-500">
                  <option value="">Semua Asrama</option>
                  {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select value={kamar} onChange={e => setKamar(e.target.value)} disabled={!asrama} className="w-1/3 p-2 border rounded text-sm outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400">
                  <option value="">Kamar</option>
                  {Array.from({length: 50}, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            {/* GROUP 2: SEKOLAH */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <span className="text-xs font-bold text-blue-700 uppercase mb-2 block">Sekolah Formal</span>
              <div className="flex gap-2">
                <select 
                  value={sekolah} 
                  onChange={e => setSekolah(e.target.value)} // UPDATE: Tidak mereset kelas saat sekolah berubah/kosong
                  className="w-2/3 p-2 border rounded text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Semua Sekolah</option>
                  {SEKOLAH_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input 
                  type="number" // UPDATE: Ubah type jadi number agar muncul numpad di HP
                  value={kelasSekolah} 
                  onChange={e => setKelasSekolah(e.target.value)} 
                  // disabled={!sekolah} <-- UPDATE: Dihapus agar selalu aktif
                  placeholder="Kls (Ex: 7)" // UPDATE: Placeholder disesuaikan
                  className="w-1/3 p-2 border rounded text-sm outline-none focus:border-blue-500" // UPDATE: Hapus style disabled
                />
              </div>
            </div>

            {/* GROUP 3: MARHALAH (PESANTREN) */}
            <div className="bg-green-50 p-3 rounded-lg border border-green-100">
              <span className="text-xs font-bold text-green-700 uppercase mb-2 block">Kelas Pesantren</span>
              <div className="flex gap-2">
                <select value={marhalah} onChange={e => { setMarhalah(e.target.value); setKelasPesantren('') }} className="w-1/2 p-2 border rounded text-sm outline-none focus:border-green-500">
                  <option value="">Semua Marhalah</option>
                  {marhalahList.map((m: any) => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
                <select value={kelasPesantren} onChange={e => setKelasPesantren(e.target.value)} disabled={!marhalah} className="w-1/2 p-2 border rounded text-sm outline-none focus:border-green-500 disabled:bg-gray-100">
                  <option value="">Semua Kelas</option>
                  {filteredKelasPesantren.map((k: any) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </div>
            </div>

          </div>

          <div className="flex gap-2 mt-6 pt-4 border-t">
            <button onClick={handleReset} className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors">Reset</button>
            <button onClick={handleApply} className="flex-1 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shadow-sm font-medium">Terapkan Filter</button>
          </div>
        </div>
      )}
    </div>
  )
}