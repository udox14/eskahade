'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getMasterPelanggaran, tambahMasterPelanggaran, editMasterPelanggaran,
  hapusMasterPelanggaran, cariSantri, simpanPelanggaran, hapusPelanggaran,
  getDaftarPelanggar, getDetailSantri, simpanSuratPernyataan, simpanSuratPerjanjian,
  getDataSuratPernyataan, getSuggestLevelSP
} from './actions'
import {
  ShieldAlert, Plus, Search, Loader2, X, Trash2, Edit2,
  ChevronLeft, ChevronRight, FileText, Gavel,
  BookOpen, Camera, Image as ImageIcon, Filter,
  Printer, CheckSquare, Square, Eye, AlertTriangle,
  Users, ScrollText, ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTgl(s: string) {
  try { return format(new Date(s.replace(' ', 'T')), 'dd MMM yyyy', { locale: idLocale }) }
  catch { return s }
}

const KATEGORI_COLOR: Record<string, string> = {
  RINGAN: 'bg-slate-100 text-slate-600 border-slate-200',
  SEDANG: 'bg-amber-100 text-amber-700 border-amber-200',
  BERAT:  'bg-rose-100 text-rose-700 border-rose-200',
}
const KATEGORI_DOT: Record<string, string> = {
  RINGAN: 'bg-slate-400',
  SEDANG: 'bg-amber-400',
  BERAT:  'bg-rose-500',
}
const SP_COLOR: Record<string, string> = {
  SP1: 'bg-amber-100 text-amber-700 border-amber-200',
  SP2: 'bg-orange-100 text-orange-700 border-orange-200',
  SP3: 'bg-rose-100 text-rose-700 border-rose-200',
  SK:  'bg-red-900 text-white border-red-900',
}

async function kompresGambar(file: File, maxW = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new window.Image()
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxW / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadFoto(base64: string): Promise<string> {
  const res = await fetch('/api/upload-foto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, folder: 'bukti-pelanggaran' }),
  })
  const data = await res.json()
  if (!data.url) throw new Error('Upload gagal')
  return data.url
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL INPUT PELANGGARAN
// ═══════════════════════════════════════════════════════════════════════════════
function ModalInputPelanggaran({
  masterList,
  onClose,
  onSuccess,
}: {
  masterList: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1: pilih santri
  const [keyword, setKeyword]       = useState('')
  const [hasilCari, setHasilCari]   = useState<any[]>([])
  const [searching, setSearching]   = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)

  // Step 2: isi detail
  const [jenisSearch, setJenisSearch]   = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [deskripsi, setDeskripsi]       = useState('')
  const [tanggal, setTanggal]           = useState(new Date().toISOString().slice(0, 10))
  const [fotoBase64, setFotoBase64]     = useState<string | null>(null)
  const [uploading, setUploading]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedItem = masterList.find(m => String(m.id) === selectedMasterId)

  // Filter dropdown pelanggaran
  const filteredMaster = jenisSearch.trim()
    ? masterList.filter(m =>
        m.nama_pelanggaran.toLowerCase().includes(jenisSearch.toLowerCase()) ||
        m.kategori.toLowerCase().includes(jenisSearch.toLowerCase())
      )
    : masterList

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 2) return
    setSearching(true)
    const res = await cariSantri(keyword)
    setHasilCari(res)
    setSearching(false)
    if (!res.length) toast.info('Santri tidak ditemukan')
  }

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const b64 = await kompresGambar(file)
      setFotoBase64(b64)
    } catch { toast.error('Gagal memproses foto') }
    finally { setUploading(false) }
  }

  const handleSimpan = async () => {
    if (!selectedSantri) { toast.error('Pilih santri dulu'); return }
    if (!selectedMasterId) { toast.error('Pilih jenis pelanggaran'); return }
    setSaving(true)
    try {
      let fotoUrl: string | undefined
      if (fotoBase64) {
        try { fotoUrl = await uploadFoto(fotoBase64) }
        catch { toast.error('Foto gagal diupload, data tetap disimpan tanpa foto') }
      }
      const res = await simpanPelanggaran({
        santriId: selectedSantri.id,
        masterId: Number(selectedMasterId),
        deskripsiTambahan: deskripsi || undefined,
        tanggal,
        fotoUrl,
      })
      if ('error' in res) { toast.error(res.error); return }
      toast.success(`Pelanggaran ${selectedSantri.nama_lengkap} berhasil dicatat`)
      onSuccess()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Catat Pelanggaran</p>
              <p className="text-[10px] text-slate-400">
                {step === 1 ? 'Langkah 1 — Pilih santri' : `Langkah 2 — Detail pelanggaran`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 pt-4 pb-0 gap-2 shrink-0">
          {[1, 2].map(s => (
            <div key={s} className={cn(
              'flex-1 h-1 rounded-full transition-colors duration-300',
              s <= step ? 'bg-rose-500' : 'bg-slate-100'
            )} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── STEP 1: PILIH SANTRI ── */}
          {step === 1 && (
            <div className="p-5 space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Cari nama atau NIS santri..."
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || keyword.length < 2}
                  className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Cari
                </button>
              </form>

              {hasilCari.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hasil Pencarian</p>
                  {hasilCari.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedSantri(s); setStep(2) }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl text-left transition-all group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-rose-100 flex items-center justify-center text-sm font-black text-slate-600 group-hover:text-rose-700 transition-colors shrink-0">
                        {s.nama_lengkap.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{s.nama_lengkap}</p>
                        <p className="text-xs text-slate-400">{s.nis} · {s.asrama} / {s.kamar}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-rose-400 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {hasilCari.length === 0 && keyword.length < 2 && (
                <div className="flex flex-col items-center py-8 text-slate-300 gap-2">
                  <Users className="w-10 h-10" />
                  <p className="text-xs text-slate-400">Ketik minimal 2 karakter lalu klik Cari</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: DETAIL PELANGGARAN ── */}
          {step === 2 && (
            <div className="p-5 space-y-4">

              {/* Santri terpilih */}
              <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-sm font-black text-rose-700 shrink-0">
                  {selectedSantri?.nama_lengkap.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-rose-800 text-sm truncate">{selectedSantri?.nama_lengkap}</p>
                  <p className="text-xs text-rose-500">{selectedSantri?.nis} · {selectedSantri?.asrama} / {selectedSantri?.kamar}</p>
                </div>
                <button
                  onClick={() => { setStep(1); setSelectedSantri(null); setSelectedMasterId(''); setJenisSearch('') }}
                  className="p-1.5 text-rose-400 hover:bg-rose-100 rounded-lg transition-colors"
                  title="Ganti santri"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Dropdown Jenis Pelanggaran */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Jenis Pelanggaran <span className="text-rose-500">*</span>
                </label>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => { setShowDropdown(v => !v); setTimeout(() => searchRef.current?.focus(), 50) }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 border rounded-xl text-sm transition-all bg-slate-50 focus:bg-white text-left',
                      showDropdown ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {selectedItem ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', KATEGORI_DOT[selectedItem.kategori])} />
                        <span className="font-semibold text-slate-800 truncate">{selectedItem.nama_pelanggaran}</span>
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0', KATEGORI_COLOR[selectedItem.kategori])}>
                          {selectedItem.kategori}
                        </span>
                        <span className="text-xs font-bold text-rose-600 shrink-0">+{selectedItem.poin}p</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">Ketik untuk mencari pelanggaran...</span>
                    )}
                    <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform shrink-0 ml-2', showDropdown && 'rotate-180')} />
                  </button>

                  {showDropdown && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            ref={searchRef}
                            type="text"
                            placeholder="Cari jenis pelanggaran..."
                            value={jenisSearch}
                            onChange={e => setJenisSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent"
                          />
                          {jenisSearch && (
                            <button onClick={() => setJenisSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredMaster.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-6 italic">Tidak ada yang cocok</p>
                        ) : (
                          (() => {
                            const grouped = ['RINGAN', 'SEDANG', 'BERAT']
                            if (jenisSearch.trim()) {
                              return filteredMaster.map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => { setSelectedMasterId(String(m.id)); setShowDropdown(false); setJenisSearch('') }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-rose-50 transition-colors text-left border-b border-slate-50 last:border-0"
                                >
                                  <span className={cn('w-2 h-2 rounded-full shrink-0', KATEGORI_DOT[m.kategori])} />
                                  <span className="flex-1 text-sm font-medium text-slate-800 truncate">{m.nama_pelanggaran}</span>
                                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0', KATEGORI_COLOR[m.kategori])}>{m.kategori}</span>
                                  <span className="text-xs font-bold text-rose-600 shrink-0">+{m.poin}p</span>
                                </button>
                              ))
                            }
                            return grouped.flatMap(kat => {
                              const items = masterList.filter(m => m.kategori === kat)
                              if (!items.length) return []
                              return [
                                <div key={`hdr-${kat}`} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                                  <span className={cn('w-2 h-2 rounded-full', KATEGORI_DOT[kat])} />
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{kat}</span>
                                </div>,
                                ...items.map(m => (
                                  <button
                                    key={m.id}
                                    onClick={() => { setSelectedMasterId(String(m.id)); setShowDropdown(false) }}
                                    className={cn(
                                      'w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-rose-50 transition-colors text-left border-b border-slate-50 last:border-0',
                                      selectedMasterId === String(m.id) && 'bg-rose-50'
                                    )}
                                  >
                                    <span className="flex-1 text-sm font-medium text-slate-800 truncate">{m.nama_pelanggaran}</span>
                                    <span className="text-xs font-bold text-rose-600 shrink-0">+{m.poin}p</span>
                                    {selectedMasterId === String(m.id) && (
                                      <span className="text-rose-500 shrink-0">✓</span>
                                    )}
                                  </button>
                                ))
                              ]
                            })
                          })()
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tanggal */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Kejadian</label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50 focus:bg-white transition-all"
                />
              </div>

              {/* Keterangan tambahan */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Keterangan Tambahan <span className="text-slate-400 font-normal normal-case">(opsional)</span>
                </label>
                <textarea
                  value={deskripsi}
                  onChange={e => setDeskripsi(e.target.value)}
                  placeholder="Detail kejadian, saksi, lokasi, dsb..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50 focus:bg-white resize-none transition-all"
                />
              </div>

              {/* Foto bukti */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Foto Bukti <span className="text-slate-400 font-normal normal-case">(opsional · auto kompres)</span>
                </label>
                {fotoBase64 ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    <img src={fotoBase64} className="w-full max-h-36 object-cover" alt="Bukti" />
                    <button
                      onClick={() => { setFotoBase64(null); if (fileRef.current) fileRef.current.value = '' }}
                      className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-2 left-2 text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">✓ Terkompresi</span>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full border-2 border-dashed border-slate-200 rounded-xl py-5 flex flex-col items-center gap-1.5 text-slate-400 hover:border-rose-300 hover:bg-rose-50/50 transition-all"
                  >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    <span className="text-xs font-medium">{uploading ? 'Memproses...' : 'Klik untuk pilih foto'}</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          {step === 1 ? (
            <p className="text-xs text-slate-400 text-center">Pilih santri dari hasil pencarian di atas</p>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors"
              >
                ← Kembali
              </button>
              <button
                onClick={handleSimpan}
                disabled={saving || !selectedMasterId}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                {saving ? 'Menyimpan...' : 'Catat Pelanggaran'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL DETAIL SANTRI
// ═══════════════════════════════════════════════════════════════════════════════
function ModalDetail({ santriId, onClose }: { santriId: string; onClose: () => void }) {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dtab, setDtab]     = useState<'pelanggaran' | 'pernyataan' | 'perjanjian'>('pelanggaran')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    getDetailSantri(santriId).then(d => { setData(d); setLoading(false) })
  }, [santriId])

  const handleHapus = async (id: string) => {
    if (!confirm('Hapus data pelanggaran ini?')) return
    setDeleting(id)
    const res = await hapusPelanggaran(id)
    setDeleting(null)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Dihapus')
    setData((prev: any) => ({ ...prev, pelanggaran: prev.pelanggaran.filter((p: any) => p.id !== id) }))
  }

  const totalPoin = data?.pelanggaran?.reduce((a: number, p: any) => a + (p.poin ?? 0), 0) ?? 0

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="h-4 w-40 bg-slate-100 rounded-lg animate-pulse" />
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-sm font-black text-rose-700 shrink-0">
                  {data?.profil?.nama_lengkap?.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{data?.profil?.nama_lengkap}</p>
                  <p className="text-[11px] text-slate-400">{data?.profil?.nis} · {data?.profil?.asrama}/{data?.profil?.kamar}</p>
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 bg-slate-100 p-1 mx-4 mt-3 rounded-xl shrink-0">
          {([
            { key: 'pelanggaran', label: 'Pelanggaran',      count: data?.pelanggaran?.length ?? 0 },
            { key: 'pernyataan',  label: 'Srt. Pernyataan',  count: data?.suratPernyataan?.length ?? 0 },
            { key: 'perjanjian',  label: 'SP / SK',          count: data?.suratPerjanjian?.length ?? 0 },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setDtab(t.key)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                dtab === t.key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px]', dtab === t.key ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500')}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : dtab === 'pelanggaran' ? (
            <div className="space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                  <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Total Poin</p>
                  <p className="text-2xl font-black text-rose-700 mt-0.5">{totalPoin}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Jumlah Kasus</p>
                  <p className="text-2xl font-black text-slate-700 mt-0.5">{data.pelanggaran.length}<span className="text-sm font-semibold ml-0.5">x</span></p>
                </div>
              </div>
              {data.pelanggaran.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">Belum ada catatan pelanggaran</p>
              ) : data.pelanggaran.map((p: any) => (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border', KATEGORI_COLOR[p.jenis] ?? KATEGORI_COLOR.RINGAN)}>
                          {p.jenis}
                        </span>
                        <span className="text-xs font-black text-rose-600">+{p.poin}p</span>
                        <span className="text-[10px] text-slate-400">{fmtTgl(p.tanggal)}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{p.deskripsi}</p>
                      {p.penindak_nama && <p className="text-[10px] text-slate-400 mt-0.5">Dicatat: {p.penindak_nama}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.foto_url && (
                        <a href={p.foto_url} target="_blank" rel="noreferrer" className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg transition-colors">
                          <ImageIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleHapus(p.id)}
                        disabled={deleting === p.id}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : dtab === 'pernyataan' ? (
            <div className="space-y-2">
              {data.suratPernyataan.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">Belum ada surat pernyataan</p>
              ) : data.suratPernyataan.map((sp: any) => (
                <div key={sp.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <ScrollText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">Surat Pernyataan</p>
                    <p className="text-xs text-slate-400">{fmtTgl(sp.tanggal)} · {sp.dibuat_oleh_nama || '—'}</p>
                    <p className="text-[10px] text-slate-400">{JSON.parse(sp.pelanggaran_ids || '[]').length} pelanggaran</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {data.suratPerjanjian.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">Belum ada SP / SK Pengeluaran</p>
              ) : data.suratPerjanjian.map((sp: any) => (
                <div key={sp.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
                  <span className={cn('text-xs font-black px-2.5 py-2 rounded-xl border shrink-0', SP_COLOR[sp.level] ?? 'bg-slate-100 text-slate-600')}>
                    {sp.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{sp.level === 'SK' ? 'SK Pengeluaran' : `Surat Perjanjian ${sp.level}`}</p>
                    <p className="text-xs text-slate-400">{fmtTgl(sp.tanggal)} · {sp.dibuat_oleh_nama || '—'}</p>
                    {sp.catatan && <p className="text-xs text-slate-500 mt-0.5 italic">"{sp.catatan}"</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL SURAT PERNYATAAN
// ═══════════════════════════════════════════════════════════════════════════════
function ModalSuratPernyataan({ onClose }: { onClose: () => void }) {
  const [keyword, setKeyword]       = useState('')
  const [hasilCari, setHasilCari]   = useState<any[]>([])
  const [searching, setSearching]   = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [detail, setDetail]         = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [checked, setChecked]       = useState<Set<string>>(new Set())
  const [preview, setPreview]       = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [tanggal, setTanggal]       = useState(new Date().toISOString().slice(0, 10))

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 2) return
    setSearching(true)
    const res = await getDaftarPelanggar({ search: keyword })
    setHasilCari(res.rows)
    setSearching(false)
    if (!res.rows.length) toast.info('Tidak ditemukan')
  }

  const selectSantri = async (s: any) => {
    setSelectedSantri(s); setHasilCari([])
    setLoadingDetail(true)
    const d = await getDetailSantri(s.id)
    setDetail(d); setChecked(new Set())
    setLoadingDetail(false)
  }

  const toggleAll = () => {
    if (!detail) return
    setChecked(checked.size === detail.pelanggaran.length
      ? new Set()
      : new Set(detail.pelanggaran.map((p: any) => p.id)))
  }

  const handlePreview = async () => {
    if (!selectedSantri || checked.size === 0) return
    setLoadingPreview(true)
    const d = await getDataSuratPernyataan(selectedSantri.id, [...checked])
    setPreview(d); setLoadingPreview(false)
  }

  const handleCetak = async () => {
    if (!selectedSantri || checked.size === 0) return
    setSaving(true)
    await simpanSuratPernyataan(selectedSantri.id, [...checked], tanggal)
    setSaving(false)
    toast.success('Surat pernyataan tersimpan')
    window.print()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm print:hidden">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <ScrollText className="w-4 h-4 text-slate-600" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Buat Surat Pernyataan</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!selectedSantri ? (
            <>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text" autoFocus placeholder="Cari santri pelanggar..."
                    value={keyword} onChange={e => setKeyword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50"
                  />
                </div>
                <button type="submit" disabled={searching || keyword.length < 2}
                  className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 flex items-center gap-1.5">
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Cari
                </button>
              </form>
              {hasilCari.map(s => (
                <button key={s.id} onClick={() => selectSantri(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-left transition-all">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-black text-slate-600 shrink-0">
                    {s.nama_lengkap.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{s.nama_lengkap}</p>
                    <p className="text-xs text-slate-400">{s.nis} · {s.jumlah_pelanggaran}x kasus · {s.total_poin}p</p>
                  </div>
                  {s.sp_terakhir && <span className={cn('text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0', SP_COLOR[s.sp_terakhir])}>{s.sp_terakhir}</span>}
                </button>
              ))}
            </>
          ) : (
            <>
              {/* Santri terpilih */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{selectedSantri.nama_lengkap}</p>
                  <p className="text-xs text-slate-400">{selectedSantri.nis}</p>
                </div>
                <button onClick={() => { setSelectedSantri(null); setDetail(null); setPreview(null); setChecked(new Set()) }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
              ) : detail && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Pelanggaran yang Dicantumkan</p>
                      <button onClick={toggleAll} className="text-xs text-slate-500 hover:text-slate-700 font-semibold">
                        {checked.size === detail.pelanggaran.length ? 'Batal Semua' : 'Pilih Semua'}
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {detail.pelanggaran.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-6">Tidak ada data pelanggaran</p>
                      ) : detail.pelanggaran.map((p: any) => (
                        <button key={p.id}
                          onClick={() => setChecked(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                            checked.has(p.id) ? 'border-slate-700 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                          )}>
                          {checked.has(p.id) ? <CheckSquare className="w-4 h-4 text-slate-700 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{p.deskripsi}</p>
                            <p className="text-xs text-slate-400">{fmtTgl(p.tanggal)} · {p.jenis} · +{p.poin}p</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Surat</label>
                      <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50" />
                    </div>
                    <button onClick={handlePreview} disabled={checked.size === 0 || loadingPreview}
                      className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50">
                      {loadingPreview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                      Pratinjau
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {preview && selectedSantri && (
          <div className="px-5 pb-4 shrink-0 border-t border-slate-100 pt-4">
            <button onClick={handleCetak} disabled={saving || checked.size === 0}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Simpan & Cetak Surat Pernyataan
            </button>
          </div>
        )}
      </div>

      {/* Print area — hanya muncul saat print */}
      {preview && (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
          <div style={{ width: '215mm', minHeight: '330mm', padding: '2cm 2.5cm 1.5cm', fontFamily: 'Times New Roman, serif', fontSize: '12pt', lineHeight: '1.8', color: '#000', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '72px', height: '72px', objectFit: 'contain', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '9.5pt', margin: 0 }}>LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG</p>
                <p style={{ fontSize: '17pt', fontWeight: 'bold', margin: '1px 0', lineHeight: 1.1 }}>SEKSI KEAMANAN DEWAN SANTRI</p>
                <p style={{ fontSize: '9pt', margin: 0 }}>SUKARAPIH SUKARAME TASIKMALAYA</p>
                <p style={{ fontSize: '9pt', margin: 0 }}>MASA BAKTI 2025-2026</p>
              </div>
            </div>
            <div style={{ borderTop: '3px solid black', borderBottom: '1.5px solid black', paddingTop: '2px', marginBottom: '18px' }} />
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline', margin: 0 }}>SURAT PERNYATAAN</p>
              <p style={{ margin: '3px 0 0', fontSize: '11pt' }}>NO: ....../ A.10/ KMN-DSN-SKH/....../202..</p>
            </div>
            <p style={{ marginBottom: '10px' }}>Saya yang bertanda tangan dibawah ini,</p>
            <table style={{ width: '100%', marginBottom: '14px', borderCollapse: 'collapse' }}>
              <tbody>
                {([
                  ['Nama', preview.profil?.nama_lengkap ?? ''],
                  ['Asrama/ Kamar', [preview.profil?.asrama, preview.profil?.kamar].filter(Boolean).join(' / ')],
                  ['Kelas Pengajian', preview.profil?.nama_kelas ?? ''],
                  ['Alamat', preview.profil?.alamat ?? ''],
                  ['', ''],
                  ['Nama Orang Tua', preview.profil?.nama_ayah ?? ''],
                  ['No Telpon', ''],
                ] as [string, string][]).map(([lbl, val], idx) => (
                  <tr key={idx}>
                    <td style={{ width: '135px', verticalAlign: 'top', paddingBottom: '3px', whiteSpace: 'nowrap' }}>{lbl}</td>
                    <td style={{ width: '12px', verticalAlign: 'top', paddingBottom: '3px' }}>{lbl ? ':' : ''}</td>
                    <td style={{ verticalAlign: 'top', paddingBottom: '3px', borderBottom: '1px solid black' }}>{val}&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginBottom: '6px', textIndent: '36px' }}>
              Menyatakan sesungguhnya bahwa pada hari{' '}
              <span style={{ borderBottom: '1px solid black', display: 'inline-block', minWidth: '180px' }}>&nbsp;</span>
              {' '}saya telah melanggar salah satu peraturan Pesantren Sukahideng, yaitu:
            </p>
            <div style={{ marginBottom: '14px' }}>
              {preview.pelanggaran.map((p: any) => (
                <p key={p.id} style={{ borderBottom: '1px solid black', marginBottom: '4px', minHeight: '24px', paddingBottom: '2px' }}>{p.deskripsi}</p>
              ))}
              {Array.from({ length: Math.max(0, 4 - preview.pelanggaran.length) }).map((_, i) => (
                <p key={i} style={{ borderBottom: '1px solid black', marginBottom: '4px', minHeight: '24px' }}>&nbsp;</p>
              ))}
            </div>
            <p style={{ textAlign: 'justify', textIndent: '36px', marginBottom: '4px' }}>
              Saya mengaku bersalah dan berjanji tidak akan mengulanginya. Apabila dikemudian hari saya kembali melanggar salah satu peraturan Pesantren, maka saya bersedia menerima sanksi yang seberat-beratnya tanpa mempersulit pihak siapapun.
            </p>
            <p style={{ textAlign: 'justify', marginBottom: '24px' }}>Demikian surat pernyataan ini saya buat dalam keadaan sehat dan tanpa paksaan dari siapapun.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
              <div style={{ textAlign: 'center', minWidth: '220px' }}>
                <p style={{ marginBottom: '0' }}>Sukahideng, .................................20...</p>
                <p style={{ fontWeight: 'bold', marginBottom: '72px' }}>YANG MEMBUAT PERNYATAAN</p>
                <p style={{ borderBottom: '1px solid black', paddingBottom: '2px' }}>&nbsp;</p>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: '52px' }}><p>Mengetahui:</p></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              {['KEAMANAN', 'PENGURUS ASRAMA'].map(lbl => (
                <div key={lbl} style={{ textAlign: 'center', minWidth: '180px' }}>
                  <p style={{ borderBottom: '1px solid black' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</p>
                  <p style={{ fontWeight: 'bold' }}>{lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <style>{`@media print { .print\\:hidden { display: none !important } @page { size: 215mm 330mm; margin: 0; } }`}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL SP / SK PENGELUARAN
// ═══════════════════════════════════════════════════════════════════════════════
function ModalSP({ onClose }: { onClose: () => void }) {
  const [keyword, setKeyword]     = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [detail, setDetail]       = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [level, setLevel]         = useState<'SP1' | 'SP2' | 'SP3' | 'SK'>('SP1')
  const [suggestLevel, setSuggestLevel] = useState<string>('SP1')
  const [tanggal, setTanggal]     = useState(new Date().toISOString().slice(0, 10))
  const [catatan, setCatatan]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const tglCetak = format(new Date(tanggal), 'dd MMMM yyyy', { locale: idLocale })
  const profil   = detail?.profil

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 2) return
    setSearching(true)
    const res = await getDaftarPelanggar({ search: keyword })
    setHasilCari(res.rows)
    setSearching(false)
    if (!res.rows.length) toast.info('Tidak ditemukan')
  }

  const selectSantri = async (s: any) => {
    setSelectedSantri(s); setHasilCari([])
    setLoadingDetail(true)
    const [d, suggest] = await Promise.all([getDetailSantri(s.id), getSuggestLevelSP(s.id)])
    setDetail(d); setLevel(suggest as any); setSuggestLevel(suggest)
    setLoadingDetail(false)
  }

  const handleCetak = async () => {
    setSaving(true)
    const res = await simpanSuratPerjanjian(selectedSantri.id, level, tanggal, catatan)
    setSaving(false)
    if ('error' in res) { toast.error((res as any).error); return }
    toast.success(`${level === 'SK' ? 'SK Pengeluaran' : level} tersimpan`)
    window.print()
  }

  const SP_LEVELS = ['SP1', 'SP2', 'SP3', 'SK'] as const
  const SP_LABEL: Record<string, string> = { SP1: 'SP 1', SP2: 'SP 2', SP3: 'SP 3', SK: 'SK Pengeluaran' }

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm print:hidden">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
              <Gavel className="w-4 h-4 text-rose-600" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Buat SP / SK Pengeluaran</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!selectedSantri ? (
            <>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text" autoFocus placeholder="Cari santri pelanggar..."
                    value={keyword} onChange={e => setKeyword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50"
                  />
                </div>
                <button type="submit" disabled={searching || keyword.length < 2}
                  className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 flex items-center gap-1.5">
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Cari
                </button>
              </form>
              {hasilCari.map(s => (
                <button key={s.id} onClick={() => selectSantri(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition-all">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-black text-slate-600 shrink-0">
                    {s.nama_lengkap.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{s.nama_lengkap}</p>
                    <p className="text-xs text-slate-400">{s.nis} · {s.total_poin}p</p>
                  </div>
                  {s.sp_terakhir && <span className={cn('text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0', SP_COLOR[s.sp_terakhir])}>{s.sp_terakhir}</span>}
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{selectedSantri.nama_lengkap}</p>
                  <p className="text-xs text-slate-400">{selectedSantri.nis} · {selectedSantri.total_poin}p</p>
                </div>
                <button onClick={() => { setSelectedSantri(null); setDetail(null); setShowPreview(false) }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
              ) : (
                <div className="space-y-4">
                  {detail?.suratPerjanjian?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Riwayat SP</p>
                      <div className="flex gap-2 flex-wrap">
                        {detail.suratPerjanjian.map((sp: any) => (
                          <span key={sp.id} className={cn('text-xs font-bold px-2.5 py-1 rounded-lg border', SP_COLOR[sp.level])}>
                            {sp.level === 'SK' ? 'SK Pengeluaran' : sp.level} — {fmtTgl(sp.tanggal)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Pilih Level
                      {suggestLevel && (
                        <span className="ml-2 text-emerald-600 normal-case font-normal">
                          (Saran sistem: {suggestLevel === 'SK' ? 'SK Pengeluaran' : suggestLevel})
                        </span>
                      )}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {SP_LEVELS.map(l => (
                        <button
                          key={l}
                          onClick={() => setLevel(l)}
                          className={cn(
                            'py-2 rounded-xl text-xs font-bold border transition-all text-center',
                            level === l ? SP_COLOR[l] : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          )}
                        >
                          {SP_LABEL[l]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Surat</label>
                      <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Catatan <span className="font-normal normal-case text-slate-400">(opsional)</span></label>
                      <input type="text" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Opsional..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {selectedSantri && !loadingDetail && (
          <div className="px-5 pb-4 pt-3 border-t border-slate-100 shrink-0 flex gap-2">
            <button onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-slate-50 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-100">
              <Eye className="w-3.5 h-3.5" /> Pratinjau
            </button>
            <button onClick={handleCetak} disabled={saving}
              className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Simpan & Cetak
            </button>
          </div>
        )}
      </div>

      {/* Print area */}
      {showPreview && profil && (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
          <div style={{ width: '215mm', minHeight: '330mm', padding: '2cm 2.5cm 1.5cm', fontFamily: 'Times New Roman, serif', fontSize: '12pt', lineHeight: '1.7', color: '#000', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '72px', height: '72px', objectFit: 'contain', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '9.5pt', margin: 0 }}>LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG</p>
                <p style={{ fontSize: '17pt', fontWeight: 'bold', margin: '1px 0', lineHeight: 1.1 }}>SEKSI KEAMANAN DEWAN SANTRI</p>
                <p style={{ fontSize: '9pt', margin: 0 }}>SUKARAPIH SUKARAME TASIKMALAYA · MASA BAKTI 2025-2026</p>
              </div>
            </div>
            <div style={{ borderTop: '3px solid black', borderBottom: '1.5px solid black', paddingTop: '2px', marginBottom: '18px' }} />
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline', margin: 0 }}>
                {level === 'SK' ? 'SURAT KEPUTUSAN PENGELUARAN' : `SURAT PERJANJIAN ${level}`}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '11pt' }}>NO: ....../ A.10/ KMN-DSN-SKH/....../202..</p>
            </div>
            <p style={{ marginBottom: '12px' }}>Yang bertanda tangan di bawah ini:</p>
            <table style={{ width: '100%', marginBottom: '12px', borderCollapse: 'collapse' }}>
              <tbody>
                {([
                  ['Nama', profil.nama_lengkap],
                  ['Asrama / Kamar', [profil.asrama, profil.kamar].filter(Boolean).join(' / ')],
                  ['Kelas Pengajian', profil.nama_kelas],
                  ['Alamat', profil.alamat],
                  ['Nama Orang Tua', profil.nama_ayah],
                ] as [string, string][]).map(([lbl, val]) => (
                  <tr key={lbl}>
                    <td style={{ width: '150px', verticalAlign: 'top', paddingBottom: '6px' }}>{lbl}</td>
                    <td style={{ verticalAlign: 'top', paddingBottom: '6px' }}>
                      : {val || <span style={{ borderBottom: '1px solid black', paddingRight: '160px' }}>&nbsp;</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ textAlign: 'justify', marginBottom: '12px', textIndent: '36px' }}>Dengan ini menyatakan berjanji dan bersanggup untuk:</p>
            <ol style={{ paddingLeft: '24px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Mentaati seluruh peraturan yang berlaku di Pondok Pesantren Sukahideng.</li>
              <li style={{ marginBottom: '8px' }}>Tidak akan mengulangi pelanggaran yang telah dilakukan.</li>
              <li style={{ marginBottom: '8px' }}>Bersedia menerima sanksi yang lebih berat apabila melanggar kembali.</li>
              {(level === 'SP3' || level === 'SK') && (
                <li style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                  {level === 'SK'
                    ? 'Apabila melanggar kembali, bersedia dikeluarkan dari Pondok Pesantren Sukahideng.'
                    : 'Ini adalah peringatan terakhir. Pelanggaran berikutnya akan berakibat pengeluaran dari pesantren.'}
                </li>
              )}
            </ol>
            {catatan && <p style={{ marginBottom: '12px', fontStyle: 'italic' }}>Catatan: {catatan}</p>}
            <p style={{ marginBottom: '32px' }}>Demikian surat perjanjian ini dibuat dengan sesungguhnya dan penuh kesadaran.</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ textAlign: 'center' }}>
                <p>Orang Tua / Wali,</p>
                <div style={{ height: '64px' }} />
                <p style={{ borderTop: '1px solid black', paddingTop: '4px', minWidth: '160px' }}>{profil.nama_ayah || '(................................)'}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p>Sukahideng, {tglCetak}</p>
                <p style={{ fontWeight: 'bold' }}>Yang Berjanji,</p>
                <div style={{ height: '48px' }} />
                <p style={{ borderTop: '1px solid black', paddingTop: '4px', minWidth: '160px' }}>{profil.nama_lengkap}</p>
              </div>
            </div>
            <p style={{ fontWeight: 'bold', margin: '24px 0 40px' }}>Mengetahui:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {['KEAMANAN', 'DEWAN SANTRI', 'PENGURUS ASRAMA'].map(lbl => (
                <div key={lbl} style={{ textAlign: 'center' }}>
                  <p style={{ borderBottom: '1px solid black', marginBottom: '4px', paddingBottom: '48px' }}>&nbsp;</p>
                  <p style={{ fontWeight: 'bold', fontSize: '10pt' }}>{lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <style>{`@media print { .print\\:hidden { display: none !important } @page { size: 215mm 330mm; margin: 0; } }`}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — DAFTAR PELANGGAR (main tab)
// ═══════════════════════════════════════════════════════════════════════════════
function TabDaftar({
  masterList,
  onRefreshNeeded,
}: {
  masterList: any[]
  onRefreshNeeded: () => void
}) {
  const [rows, setRows]             = useState<any[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]         = useState('')
  const [modalId, setModalId]       = useState<string | null>(null)
  const [showModalInput, setShowModalInput] = useState(false)

  const load = useCallback(async (pg = 1, s = search) => {
    setLoading(true)
    try {
      const res = await getDaftarPelanggar({ search: s || undefined, page: pg })
      setRows(res.rows); setTotal(res.total); setTotalPages(res.totalPages)
      setPage(pg)
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load(1, '') }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    load(1, searchInput)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau NIS..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white transition-all"
            />
          </div>
          <button type="submit"
            className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
        </form>
        <button
          onClick={() => setShowModalInput(true)}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Catat Pelanggaran</span>
          <span className="sm:hidden">Catat</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <ShieldAlert className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 text-sm font-medium">Tidak ada data pelanggar</p>
          {search && <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian</p>}
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 px-0.5">
            <strong className="text-slate-700">{total}</strong> santri tercatat pernah melanggar
          </p>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-10">No</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Santri</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asrama / Kamar</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kasus</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Poin</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">SP Terakhir</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    onClick={() => setModalId(r.id)}
                  >
                    <td className="px-4 py-3 text-xs text-slate-300">{(page - 1) * 30 + i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 group-hover:text-rose-700 transition-colors">{r.nama_lengkap}</p>
                      <p className="text-xs text-slate-400">{r.nis}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.asrama}/{r.kamar}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">{r.jumlah_pelanggaran}x</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-black text-rose-600">{r.total_poin}</span>
                      <span className="text-xs text-slate-400"> poin</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.sp_terakhir
                        ? <span className={cn('text-[10px] font-bold px-2 py-1 rounded-lg border', SP_COLOR[r.sp_terakhir])}>{r.sp_terakhir}</span>
                        : <span className="text-xs text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <Eye className="w-4 h-4 text-slate-200 group-hover:text-rose-400 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map(r => (
              <button
                key={r.id}
                onClick={() => setModalId(r.id)}
                className="w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-left hover:border-rose-200 active:scale-[0.98] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{r.nama_lengkap}</p>
                    <p className="text-xs text-slate-400">{r.nis} · {r.asrama}/{r.kamar}</p>
                  </div>
                  {r.sp_terakhir && (
                    <span className={cn('shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border', SP_COLOR[r.sp_terakhir])}>{r.sp_terakhir}</span>
                  )}
                </div>
                <div className="mt-2.5 flex gap-3 text-xs">
                  <span className="text-slate-500">{r.jumlah_pelanggaran}x kasus</span>
                  <span className="font-black text-rose-600">{r.total_poin} poin</span>
                  <span className="text-slate-400">· {fmtTgl(r.terakhir)}</span>
                </div>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <span className="text-xs text-slate-500">Hal {page}/{totalPages}</span>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= totalPages || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {modalId && <ModalDetail santriId={modalId} onClose={() => setModalId(null)} />}
      {showModalInput && (
        <ModalInputPelanggaran
          masterList={masterList}
          onClose={() => setShowModalInput(false)}
          onSuccess={() => load(1, search)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — SURAT
// ═══════════════════════════════════════════════════════════════════════════════
function TabSurat() {
  const [showModalPernyataan, setShowModalPernyataan] = useState(false)
  const [showModalSP, setShowModalSP] = useState(false)

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-600 leading-relaxed">
          <span className="font-bold text-slate-700">Surat Pernyataan</span> dibuat saat santri mengakui pelanggaran.{' '}
          <span className="font-bold text-slate-700">SP (Surat Perjanjian)</span> dan{' '}
          <span className="font-bold text-slate-700">SK Pengeluaran</span> adalah eskalasi disiplin berikutnya.
        </div>
      </div>

      {/* Dua tombol utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Surat Pernyataan */}
        <button
          onClick={() => setShowModalPernyataan(true)}
          className="group flex flex-col items-start gap-3 p-5 bg-white border-2 border-slate-200 hover:border-slate-400 rounded-2xl text-left transition-all hover:shadow-md active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors">
            <ScrollText className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Surat Pernyataan</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Buat dan cetak surat pernyataan untuk santri yang melanggar peraturan.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 flex items-center gap-1 transition-colors">
            Buat Surat <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* SP & SK Pengeluaran */}
        <button
          onClick={() => setShowModalSP(true)}
          className="group flex flex-col items-start gap-3 p-5 bg-white border-2 border-rose-200 hover:border-rose-400 rounded-2xl text-left transition-all hover:shadow-md active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-50 group-hover:bg-rose-100 flex items-center justify-center transition-colors">
            <Gavel className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">SP & SK Pengeluaran</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Buat SP 1, SP 2, SP 3, atau Surat Keputusan Pengeluaran santri.
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['SP 1', 'SP 2', 'SP 3', 'SK'].map(l => (
              <span key={l} className={cn(
                'text-[9px] font-bold px-1.5 py-0.5 rounded border',
                l === 'SK' ? 'bg-red-900 text-white border-red-900' : 'bg-rose-100 text-rose-700 border-rose-200'
              )}>
                {l}
              </span>
            ))}
          </div>
        </button>
      </div>

      {showModalPernyataan && <ModalSuratPernyataan onClose={() => setShowModalPernyataan(false)} />}
      {showModalSP && <ModalSP onClose={() => setShowModalSP(false)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — KAMUS PELANGGARAN
// ═══════════════════════════════════════════════════════════════════════════════
function TabKamus({ masterList, onRefresh }: { masterList: any[]; onRefresh: () => void }) {
  const [form, setForm]     = useState({ kategori: 'RINGAN', nama: '', poin: 10, deskripsi: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleSimpan = async () => {
    if (!form.nama.trim()) { toast.error('Nama pelanggaran wajib diisi'); return }
    setSaving(true)
    const res = editId
      ? await editMasterPelanggaran(editId, form)
      : await tambahMasterPelanggaran(form)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success(editId ? 'Diperbarui' : 'Ditambahkan')
    setForm({ kategori: 'RINGAN', nama: '', poin: 10, deskripsi: '' }); setEditId(null)
    onRefresh()
  }

  const handleHapus = async (id: number) => {
    if (!confirm('Hapus jenis pelanggaran ini?')) return
    setDeleting(id)
    const res = await hapusMasterPelanggaran(id)
    setDeleting(null)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Dihapus'); onRefresh()
  }

  const grouped = ['RINGAN', 'SEDANG', 'BERAT'].reduce((acc, k) => {
    acc[k] = masterList.filter((m: any) => m.kategori === k)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
          {editId ? '✎ Edit Jenis Pelanggaran' : '+ Tambah Jenis Pelanggaran'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Kategori</label>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {(['RINGAN', 'SEDANG', 'BERAT'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setForm(f => ({ ...f, kategori: k }))}
                  className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all', form.kategori === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Poin</label>
            <input
              type="number" value={form.poin}
              onChange={e => setForm(f => ({ ...f, poin: Number(e.target.value) }))}
              min={1} max={100}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Nama Pelanggaran</label>
            <input
              type="text" value={form.nama}
              onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
              placeholder="Contoh: Merokok, Berkelahi, Pencurian..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Deskripsi <span className="font-normal normal-case text-slate-400">(opsional)</span>
            </label>
            <input
              type="text" value={form.deskripsi}
              onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
              placeholder="Keterangan singkat..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-slate-50"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSimpan}
            disabled={saving}
            className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah'}
          </button>
          {editId && (
            <button
              onClick={() => { setEditId(null); setForm({ kategori: 'RINGAN', nama: '', poin: 10, deskripsi: '' }) }}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
          )}
        </div>
      </div>

      {/* List per kategori */}
      {['RINGAN', 'SEDANG', 'BERAT'].map(kat => (
        <div key={kat}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className={cn('w-2 h-2 rounded-full shrink-0', KATEGORI_DOT[kat])} />
            <span className={cn('text-[10px] font-bold uppercase tracking-[0.14em]', {
              RINGAN: 'text-slate-500',
              SEDANG: 'text-amber-600',
              BERAT: 'text-rose-600',
            }[kat])}>
              {kat}
            </span>
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[10px] text-slate-400 font-medium">{grouped[kat]?.length ?? 0}</span>
          </div>
          {!grouped[kat]?.length ? (
            <p className="text-xs text-slate-400 italic pl-3">Belum ada</p>
          ) : (
            <div className="space-y-1.5">
              {grouped[kat].map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{m.nama_pelanggaran}</p>
                    {m.deskripsi && <p className="text-xs text-slate-400 truncate">{m.deskripsi}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">+{m.poin}p</span>
                  <button
                    onClick={() => { setEditId(m.id); setForm({ kategori: m.kategori, nama: m.nama_pelanggaran, poin: m.poin, deskripsi: m.deskripsi || '' }) }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleHapus(m.id)}
                    disabled={deleting === m.id}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function KeamananPage() {
  const [tab, setTab]             = useState<'daftar' | 'surat' | 'kamus'>('daftar')
  const [masterList, setMasterList] = useState<any[]>([])
  const [loadingMaster, setLoadingMaster] = useState(true)

  const loadMaster = useCallback(async () => {
    setLoadingMaster(true)
    setMasterList(await getMasterPelanggaran())
    setLoadingMaster(false)
  }, [])

  useEffect(() => { loadMaster() }, [loadMaster])

  const TABS = [
    { key: 'daftar', label: 'Daftar Pelanggar', icon: Users },
    { key: 'surat',  label: 'Surat',            icon: FileText },
    { key: 'kamus',  label: 'Kamus Pelanggaran',icon: BookOpen },
  ] as const

  return (
    <div className="space-y-5 pb-16">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </span>
            Pelanggaran & SP
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-10">Catatan disiplin, surat pernyataan, dan SP santri</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 bg-slate-100 p-1 rounded-2xl">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-1 justify-center',
              tab === t.key
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.key === 'daftar' ? 'Daftar' : t.key === 'surat' ? 'Surat' : 'Kamus'}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'daftar' && (
        <TabDaftar
          masterList={masterList}
          onRefreshNeeded={loadMaster}
        />
      )}
      {tab === 'surat' && <TabSurat />}
      {tab === 'kamus' && (
        loadingMaster
          ? <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          : <TabKamus masterList={masterList} onRefresh={loadMaster} />
      )}
    </div>
  )
}
