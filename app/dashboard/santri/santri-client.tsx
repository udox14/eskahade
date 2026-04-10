'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Pagination from '@/components/ui/pagination'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
      <Input
        type="text"
        placeholder="Cari nama atau NIS..."
        className="w-full pl-9 pr-4 rounded-xl border-border bg-background shadow-sm"
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

  const handleChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limit', val)
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <Select value={limit} onValueChange={(val) => { if (val) handleChange(val) }}>
      <SelectTrigger className="w-[100px] rounded-xl shadow-sm">
        <SelectValue placeholder="Baris" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="10">10 Baris</SelectItem>
        <SelectItem value="20">20 Baris</SelectItem>
        <SelectItem value="50">50 Baris</SelectItem>
        <SelectItem value="100">100 Baris</SelectItem>
        <SelectItem value="9999">Semua</SelectItem>
      </SelectContent>
    </Select>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function PaginationControls({ total, limit, page }: { total: number; limit: number; page: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const totalPages = limit === 999999 ? 1 : Math.ceil(total / limit)

  const onPageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const onPageSizeChange = (newSize: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limit', newSize === 0 ? '9999' : newSize.toString())
    params.set('page', '1')
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <Pagination 
      currentPage={page} 
      totalPages={totalPages} 
      pageSize={limit === 999999 ? 0 : limit} 
      total={total} 
      onPageChange={onPageChange} 
      onPageSizeChange={onPageSizeChange} 
    />
  )
}

// ── Filter ────────────────────────────────────────────────────────────────────
const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]
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
    if (asrama && asrama !== 'semua') params.set('asrama', asrama); else params.delete('asrama')
    if (kamar && kamar !== 'semua') params.set('kamar', kamar); else params.delete('kamar')
    if (sekolah && sekolah !== 'semua') params.set('sekolah', sekolah); else params.delete('sekolah')
    if (kelasSekolah && kelasSekolah !== 'semua') params.set('kelas_sekolah', kelasSekolah); else params.delete('kelas_sekolah')
    if (marhalah && marhalah !== 'semua') params.set('marhalah', marhalah); else params.delete('marhalah')
    if (kelasPesantren && kelasPesantren !== 'semua') params.set('kelas', kelasPesantren); else params.delete('kelas')
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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger
        render={
          <Button
            variant={activeCount > 0 ? "secondary" : "outline"}
            className={cn("flex items-center gap-2 rounded-xl shadow-sm", activeCount > 0 && "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20")}
          />
        }
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Filter</span>
        {activeCount > 0 && (
          <Badge variant="default" className="w-5 h-5 flex items-center justify-center p-0 rounded-full leading-none ml-1">
            {activeCount}
          </Badge>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-5 border-b">
          <SheetTitle className="text-left">
            Filter Santri
            {activeCount > 0 && (
              <span className="block text-xs font-normal text-muted-foreground mt-1">
                {activeCount} filter aktif diterapkan
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Tempat Tinggal */}
          <div className="bg-muted/40 rounded-xl p-4 border border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Tempat Tinggal</p>
            <div className="space-y-3">
              <Select value={asrama} onValueChange={(val) => { if (val) { setAsrama(val); setKamar('') } }}>
                <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Semua Asrama" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Asrama</SelectItem>
                  {ASRAMA_LIST.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              
              <Select disabled={!asrama || asrama === 'semua'} value={kamar} onValueChange={(val) => { if (val) setKamar(val) }}>
                <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Semua Kamar" /></SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  <SelectItem value="semua">Semua Kamar</SelectItem>
                  {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                    <SelectItem key={n} value={String(n)}>Kamar {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sekolah Formal */}
          <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/10 dark:bg-blue-900/10">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">Sekolah Formal</p>
            <div className="space-y-3">
              <Select value={sekolah} onValueChange={(val) => { if (val) setSekolah(val) }}>
                <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Semua Sekolah" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Sekolah</SelectItem>
                  {SEKOLAH_LIST.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={kelasSekolah}
                onChange={e => setKelasSekolah(e.target.value)}
                placeholder="Kelas (contoh: 7, 8, 10)"
                className="w-full bg-background"
              />
            </div>
          </div>

          {/* Kelas Pesantren */}
          <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/10 dark:bg-emerald-900/10">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3">Kelas Pesantren</p>
            <div className="space-y-3">
              <Select value={marhalah} onValueChange={(val) => { if (val) { setMarhalah(val); setKelasPesantren('') } }}>
                <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Semua Marhalah" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Marhalah</SelectItem>
                  {marhalahList.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.nama}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select disabled={!marhalah || marhalah === 'semua'} value={kelasPesantren} onValueChange={(val) => { if (val) setKelasPesantren(val) }}>
                <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Kelas</SelectItem>
                  {filteredKelas.map((k: any) => <SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="p-5 border-t bg-muted/20 flex gap-3 mt-auto">
          <Button variant="outline" onClick={handleReset} className="flex-1 rounded-xl">
            Reset
          </Button>
          <Button onClick={handleApply} className="flex-2 w-full rounded-xl shadow-sm">
            Terapkan Filter
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
