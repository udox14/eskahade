'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getMasterPelanggaran, tambahMasterPelanggaran, editMasterPelanggaran,
  hapusMasterPelanggaran, cariSantri, simpanPelanggaran, hapusPelanggaran,
  getDaftarPelanggar, getDetailSantri,
} from './actions'
import {
  ShieldAlert, Plus, Search, Loader2, X, Trash2, Edit2,
  ChevronLeft, ChevronRight, BookOpen, Camera,
  Image as ImageIcon, Filter, Eye, Users, ChevronDown,
  CheckSquare, Square,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

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
  RINGAN: 'bg-slate-400', SEDANG: 'bg-amber-400', BERAT: 'bg-rose-500',
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
        canvas.width = img.width * ratio; canvas.height = img.height * ratio
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject; img.src = e.target?.result as string
    }
    reader.onerror = reject; reader.readAsDataURL(file)
  })
}
async function uploadFoto(base64: string): Promise<string> {
  const res = await fetch('/api/upload-foto', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, folder: 'bukti-pelanggaran' }),
  })
  const data = await res.json()
  if (!data.url) throw new Error('Upload gagal')
  return data.url
}

// MODAL INPUT PELANGGARAN
function ModalInputPelanggaran({ masterList, onClose, onSuccess }: {
  masterList: any[]; onClose: () => void; onSuccess: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [keyword, setKeyword] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [jenisSearch, setJenisSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [fotoBase64, setFotoBase64] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedItem = masterList.find(m => String(m.id) === selectedMasterId)
  const filteredMaster = jenisSearch.trim()
    ? masterList.filter(m => m.nama_pelanggaran.toLowerCase().includes(jenisSearch.toLowerCase()) || m.kategori.toLowerCase().includes(jenisSearch.toLowerCase()))
    : masterList

  useEffect(() => {
    function h(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 2) return
    setSearching(true)
    const res = await cariSantri(keyword)
    setHasilCari(res); setSearching(false)
    if (!res.length) toast.info('Santri tidak ditemukan')
  }
  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { setFotoBase64(await kompresGambar(file)) }
    catch { toast.error('Gagal memproses foto') }
    finally { setUploading(false) }
  }
  const handleSimpan = async () => {
    if (!selectedSantri) { toast.error('Pilih santri dulu'); return }
    if (!selectedMasterId) { toast.error('Pilih jenis pelanggaran'); return }
    setSaving(true)
    try {
      let fotoUrl: string | undefined
      if (fotoBase64) { try { fotoUrl = await uploadFoto(fotoBase64) } catch { toast.error('Foto gagal diupload, data tetap disimpan tanpa foto') } }
      const res = await simpanPelanggaran({ santriId: selectedSantri.id, masterId: Number(selectedMasterId), deskripsiTambahan: deskripsi || undefined, tanggal, fotoUrl })
      if ('error' in res) { toast.error(res.error); return }
      toast.success(`Pelanggaran ${selectedSantri.nama_lengkap} berhasil dicatat`)
      onSuccess(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Catat Pelanggaran</p>
              <p className="text-[10px] text-slate-400">{step === 1 ? 'Langkah 1 — Pilih santri' : 'Langkah 2 — Detail pelanggaran'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex px-5 pt-4 pb-0 gap-2 shrink-0">
          {[1, 2].map(s => <div key={s} className={cn('flex-1 h-1 rounded-full transition-colors', s <= step ? 'bg-rose-500' : 'bg-slate-100')} />)}
        </div>
        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="p-5 space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" autoFocus placeholder="Cari nama atau NIS santri..." value={keyword} onChange={e => setKeyword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50 focus:bg-white transition-all" />
                </div>
                <button type="submit" disabled={searching || keyword.length < 2}
                  className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Cari
                </button>
              </form>
              {hasilCari.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hasil Pencarian</p>
                  {hasilCari.map(s => (
                    <button key={s.id} onClick={() => { setSelectedSantri(s); setStep(2) }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl text-left transition-all group">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-rose-100 flex items-center justify-center text-sm font-black text-slate-600 group-hover:text-rose-700 transition-colors shrink-0">{s.nama_lengkap.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{s.nama_lengkap}</p>
                        <p className="text-xs text-slate-400">{s.nis} · {s.asrama} / {s.kamar}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {!hasilCari.length && keyword.length < 2 && (
                <div className="flex flex-col items-center py-8 text-slate-300 gap-2">
                  <Users className="w-10 h-10" />
                  <p className="text-xs text-slate-400">Ketik minimal 2 karakter lalu klik Cari</p>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-sm font-black text-rose-700 shrink-0">{selectedSantri?.nama_lengkap.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-rose-800 text-sm truncate">{selectedSantri?.nama_lengkap}</p>
                  <p className="text-xs text-rose-500">{selectedSantri?.nis} · {selectedSantri?.asrama} / {selectedSantri?.kamar}</p>
                </div>
                <button onClick={() => { setStep(1); setSelectedSantri(null); setSelectedMasterId(''); setJenisSearch('') }}
                  className="p-1.5 text-rose-400 hover:bg-rose-100 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Jenis Pelanggaran <span className="text-rose-500">*</span></label>
                <div className="relative" ref={dropdownRef}>
                  <button type="button" onClick={() => { setShowDropdown(v => !v); setTimeout(() => searchRef.current?.focus(), 50) }}
                    className={cn('w-full flex items-center justify-between px-3 py-2.5 border rounded-xl text-sm transition-all bg-slate-50 text-left', showDropdown ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 hover:border-slate-300')}>
                    {selectedItem ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', KATEGORI_DOT[selectedItem.kategori])} />
                        <span className="font-semibold text-slate-800 truncate">{selectedItem.nama_pelanggaran}</span>
                        <span className="text-xs font-bold text-rose-600 shrink-0">+{selectedItem.poin}p</span>
                      </div>
                    ) : <span className="text-slate-400">Ketik untuk mencari pelanggaran...</span>}
                    <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform shrink-0 ml-2', showDropdown && 'rotate-180')} />
                  </button>
                  {showDropdown && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input ref={searchRef} type="text" placeholder="Cari jenis pelanggaran..." value={jenisSearch} onChange={e => setJenisSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400" />
                          {jenisSearch && <button onClick={() => setJenisSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-slate-400" /></button>}
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredMaster.length === 0 ? <p className="text-xs text-slate-400 text-center py-6 italic">Tidak ada yang cocok</p>
                          : jenisSearch.trim()
                            ? filteredMaster.map(m => (
                              <button key={m.id} onClick={() => { setSelectedMasterId(String(m.id)); setShowDropdown(false); setJenisSearch('') }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-rose-50 transition-colors text-left border-b border-slate-50 last:border-0">
                                <span className={cn('w-2 h-2 rounded-full shrink-0', KATEGORI_DOT[m.kategori])} />
                                <span className="flex-1 text-sm font-medium text-slate-800 truncate">{m.nama_pelanggaran}</span>
                                <span className="text-xs font-bold text-rose-600 shrink-0">+{m.poin}p</span>
                              </button>
                            ))
                            : ['RINGAN', 'SEDANG', 'BERAT'].flatMap(kat => {
                              const items = masterList.filter(m => m.kategori === kat)
                              if (!items.length) return []
                              return [
                                <div key={`hdr-${kat}`} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                                  <span className={cn('w-2 h-2 rounded-full', KATEGORI_DOT[kat])} />
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{kat}</span>
                                </div>,
                                ...items.map(m => (
                                  <button key={m.id} onClick={() => { setSelectedMasterId(String(m.id)); setShowDropdown(false) }}
                                    className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-rose-50 transition-colors text-left border-b border-slate-50 last:border-0', selectedMasterId === String(m.id) && 'bg-rose-50')}>
                                    <span className="flex-1 text-sm font-medium text-slate-800 truncate">{m.nama_pelanggaran}</span>
                                    <span className="text-xs font-bold text-rose-600 shrink-0">+{m.poin}p</span>
                                    {selectedMasterId === String(m.id) && <span className="text-rose-500 text-xs shrink-0">✓</span>}
                                  </button>
                                ))
                              ]
                            })
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Kejadian</label>
                <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} max={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Keterangan Tambahan <span className="text-slate-400 font-normal normal-case">(opsional)</span></label>
                <textarea value={deskripsi} onChange={e => setDeskripsi(e.target.value)} placeholder="Detail kejadian, saksi, lokasi, dsb..." rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50 focus:bg-white resize-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Foto Bukti <span className="text-slate-400 font-normal normal-case">(opsional · auto kompres)</span></label>
                {fotoBase64 ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    <img src={fotoBase64} className="w-full max-h-36 object-cover" alt="Bukti" />
                    <button onClick={() => { setFotoBase64(null); if (fileRef.current) fileRef.current.value = '' }}
                      className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-500 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full border-2 border-dashed border-slate-200 rounded-xl py-5 flex flex-col items-center gap-1.5 text-slate-400 hover:border-rose-300 hover:bg-rose-50/50 transition-all">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    <span className="text-xs font-medium">{uploading ? 'Memproses...' : 'Klik untuk pilih foto'}</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          {step === 1
            ? <p className="text-xs text-slate-400 text-center">Pilih santri dari hasil pencarian di atas</p>
            : <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors">← Kembali</button>
              <button onClick={handleSimpan} disabled={saving || !selectedMasterId}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                {saving ? 'Menyimpan...' : 'Catat Pelanggaran'}
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  )
}

// MODAL DETAIL SANTRI
function ModalDetail({ santriId, onClose }: { santriId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dtab, setDtab] = useState<'pelanggaran' | 'riwayat'>('pelanggaran')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { getDetailSantri(santriId).then(d => { setData(d); setLoading(false) }) }, [santriId])

  const handleHapus = async (id: string) => {
    if (!await confirm('Hapus data pelanggaran ini?')) return
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {loading ? <div className="h-4 w-40 bg-slate-100 rounded-lg animate-pulse" /> : (
              <>
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-sm font-black text-rose-700 shrink-0">{data?.profil?.nama_lengkap?.charAt(0)}</div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{data?.profil?.nama_lengkap}</p>
                  <p className="text-[11px] text-slate-400">{data?.profil?.nis} · {data?.profil?.asrama}/{data?.profil?.kamar}</p>
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-0.5 bg-slate-100 p-1 mx-4 mt-3 rounded-xl shrink-0">
          {([
            { key: 'pelanggaran', label: 'Pelanggaran', count: data?.pelanggaran?.length ?? 0 },
            { key: 'riwayat', label: 'Riwayat SP', count: (data?.suratPernyataan?.length ?? 0) + (data?.suratPerjanjian?.length ?? 0) },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setDtab(t.key)}
              className={cn('flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5', dtab === t.key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
              {t.label}
              {t.count > 0 && <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', dtab === t.key ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500')}>{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
            : dtab === 'pelanggaran' ? (
              <div className="space-y-3">
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
                {data.pelanggaran.length === 0 ? <p className="text-center py-8 text-slate-400 text-sm">Belum ada catatan pelanggaran</p>
                  : data.pelanggaran.map((p: any) => (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border', KATEGORI_COLOR[p.jenis] ?? KATEGORI_COLOR.RINGAN)}>{p.jenis}</span>
                            <span className="text-xs font-black text-rose-600">+{p.poin}p</span>
                            <span className="text-[10px] text-slate-400">{fmtTgl(p.tanggal)}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800">{p.deskripsi}</p>
                          {p.penindak_nama && <p className="text-[10px] text-slate-400 mt-0.5">Dicatat: {p.penindak_nama}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {p.foto_url && <a href={p.foto_url} target="_blank" rel="noreferrer" className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg transition-colors"><ImageIcon className="w-3.5 h-3.5" /></a>}
                          <button onClick={() => handleHapus(p.id)} disabled={deleting === p.id}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(data.suratPernyataan.length + data.suratPerjanjian.length) === 0
                  ? <p className="text-center py-8 text-slate-400 text-sm">Belum ada riwayat SP / Pernyataan</p>
                  : <>
                    {data.suratPernyataan.map((sp: any) => (
                      <div key={sp.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                          <CheckSquare className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">Surat Pernyataan</p>
                          <p className="text-xs text-slate-400">{fmtTgl(sp.tanggal)} · {sp.dibuat_oleh_nama || '—'}</p>
                        </div>
                      </div>
                    ))}
                    {data.suratPerjanjian.map((sp: any) => (
                      <div key={sp.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
                        <span className={cn('text-xs font-black px-2.5 py-2 rounded-xl border shrink-0', SP_COLOR[sp.level] ?? 'bg-slate-100 text-slate-600')}>{sp.level}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{sp.level === 'SK' ? 'SK Pengeluaran' : `Surat Perjanjian ${sp.level}`}</p>
                          <p className="text-xs text-slate-400">{fmtTgl(sp.tanggal)} · {sp.dibuat_oleh_nama || '—'}</p>
                          {sp.catatan && <p className="text-xs text-slate-500 mt-0.5 italic">\"{sp.catatan}\"</p>}
                        </div>
                      </div>
                    ))}
                  </>}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

// TAB DAFTAR PELANGGAR
function TabDaftar({ masterList }: { masterList: any[] }) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [modalId, setModalId] = useState<string | null>(null)
  const [showModalInput, setShowModalInput] = useState(false)

  const load = useCallback(async (pg = 1, s = search) => {
    setLoading(true)
    try {
      const res = await getDaftarPelanggar({ search: s || undefined, page: pg })
      setRows(res.rows); setTotal(res.total); setTotalPages(res.totalPages); setPage(pg)
      setHasLoaded(true)
    } finally { setLoading(false) }
  }, [search])

  const handleTampilkan = () => { setSearch(searchInput); load(1, searchInput) }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <form onSubmit={e => { e.preventDefault(); handleTampilkan() }} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Cari nama atau NIS (kosongkan untuk semua)..." value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white transition-all" />
          </div>
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-60 flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
            Tampilkan
          </button>
        </form>
        <button onClick={() => setShowModalInput(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors shadow-sm whitespace-nowrap">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Catat Pelanggaran</span>
          <span className="sm:hidden">Catat</span>
        </button>
      </div>

      {!hasLoaded && !loading ? (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 border-dashed text-center">
          <ShieldAlert className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 text-sm font-medium">Data belum dimuat</p>
          <p className="text-xs text-slate-400">Klik <strong>Tampilkan</strong> untuk memuat daftar pelanggar</p>
          <button onClick={handleTampilkan}
            className="mt-1 px-5 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors shadow-sm">
            Tampilkan Semua
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <ShieldAlert className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 text-sm font-medium">Tidak ada data pelanggar</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 px-0.5"><strong className="text-slate-700">{total}</strong> santri tercatat pernah melanggar</p>
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['No', 'Nama Santri', 'Asrama / Kamar', 'Kasus', 'Total Poin', 'SP Terakhir', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors cursor-pointer group" onClick={() => setModalId(r.id)}>
                    <td className="px-4 py-3 text-xs text-slate-300">{(page - 1) * 30 + i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 group-hover:text-rose-700 transition-colors">{r.nama_lengkap}</p>
                      <p className="text-xs text-slate-400">{r.nis}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.asrama}/{r.kamar}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">{r.jumlah_pelanggaran}x</td>
                    <td className="px-4 py-3"><span className="text-sm font-black text-rose-600">{r.total_poin}</span><span className="text-xs text-slate-400"> poin</span></td>
                    <td className="px-4 py-3">
                      {r.sp_terakhir ? <span className={cn('text-[10px] font-bold px-2 py-1 rounded-lg border', SP_COLOR[r.sp_terakhir])}>{r.sp_terakhir}</span> : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3"><Eye className="w-4 h-4 text-slate-200 group-hover:text-rose-400 transition-colors" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-2">
            {rows.map(r => (
              <button key={r.id} onClick={() => setModalId(r.id)}
                className="w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-left hover:border-rose-200 active:scale-[0.98] transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{r.nama_lengkap}</p>
                    <p className="text-xs text-slate-400">{r.nis} · {r.asrama}/{r.kamar}</p>
                  </div>
                  {r.sp_terakhir && <span className={cn('shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border', SP_COLOR[r.sp_terakhir])}>{r.sp_terakhir}</span>}
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
              <button onClick={() => load(page - 1)} disabled={page <= 1 || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <span className="text-xs text-slate-500">Hal {page}/{totalPages}</span>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
      {modalId && <ModalDetail santriId={modalId} onClose={() => setModalId(null)} />}
      {showModalInput && <ModalInputPelanggaran masterList={masterList} onClose={() => setShowModalInput(false)} onSuccess={() => load(1, search)} />}
    </div>
  )
}

// TAB KAMUS PELANGGARAN
function TabKamus({ masterList, onRefresh }: { masterList: any[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ kategori: 'RINGAN', nama: '', poin: 10, deskripsi: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleSimpan = async () => {
    if (!form.nama.trim()) { toast.error('Nama pelanggaran wajib diisi'); return }
    setSaving(true)
    const res = editId ? await editMasterPelanggaran(editId, form) : await tambahMasterPelanggaran(form)
    setSaving(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success(editId ? 'Diperbarui' : 'Ditambahkan')
    setForm({ kategori: 'RINGAN', nama: '', poin: 10, deskripsi: '' }); setEditId(null)
    onRefresh()
  }
  const handleHapus = async (id: number) => {
    if (!await confirm('Hapus jenis pelanggaran ini?')) return
    setDeleting(id)
    const res = await hapusMasterPelanggaran(id)
    setDeleting(null)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Dihapus'); onRefresh()
  }
  const grouped = ['RINGAN', 'SEDANG', 'BERAT'].reduce((acc, k) => {
    acc[k] = masterList.filter((m: any) => m.kategori === k); return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{editId ? '✎ Edit Jenis Pelanggaran' : '+ Tambah Jenis Pelanggaran'}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Kategori</label>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {(['RINGAN', 'SEDANG', 'BERAT'] as const).map(k => (
                <button key={k} onClick={() => setForm(f => ({ ...f, kategori: k }))}
                  className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all', form.kategori === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>{k}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Poin</label>
            <input type="number" value={form.poin} onChange={e => setForm(f => ({ ...f, poin: Number(e.target.value) }))} min={1} max={100}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-slate-50" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Nama Pelanggaran</label>
            <input type="text" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="Contoh: Merokok, Berkelahi, Pencurian..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-slate-50" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Deskripsi <span className="font-normal normal-case text-slate-400">(opsional)</span></label>
            <input type="text" value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} placeholder="Keterangan singkat..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-slate-50" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleSimpan} disabled={saving}
            className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah'}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ kategori: 'RINGAN', nama: '', poin: 10, deskripsi: '' }) }}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">Batal</button>
          )}
        </div>
      </div>
      {['RINGAN', 'SEDANG', 'BERAT'].map(kat => (
        <div key={kat}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className={cn('w-2 h-2 rounded-full shrink-0', KATEGORI_DOT[kat])} />
            <span className={cn('text-[10px] font-bold uppercase tracking-[0.14em]', { RINGAN: 'text-slate-500', SEDANG: 'text-amber-600', BERAT: 'text-rose-600' }[kat])}>{kat}</span>
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[10px] text-slate-400 font-medium">{grouped[kat]?.length ?? 0}</span>
          </div>
          {!grouped[kat]?.length ? <p className="text-xs text-slate-400 italic pl-3">Belum ada</p>
            : <div className="space-y-1.5">
              {grouped[kat].map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{m.nama_pelanggaran}</p>
                    {m.deskripsi && <p className="text-xs text-slate-400 truncate">{m.deskripsi}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">+{m.poin}p</span>
                  <button onClick={() => { setEditId(m.id); setForm({ kategori: m.kategori, nama: m.nama_pelanggaran, poin: m.poin, deskripsi: m.deskripsi || '' }) }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleHapus(m.id)} disabled={deleting === m.id}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>}
        </div>
      ))}
    </div>
  )
}

// MAIN PAGE
export default function KeamananPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<'daftar' | 'kamus'>('daftar')
  const [masterList, setMasterList] = useState<any[]>([])
  const [loadingMaster, setLoadingMaster] = useState(true)

  const loadMaster = useCallback(async () => {
    setLoadingMaster(true)
    setMasterList(await getMasterPelanggaran())
    setLoadingMaster(false)
  }, [])

  useEffect(() => { loadMaster() }, [loadMaster])

  const TABS = [
    { key: 'daftar', label: 'Daftar Pelanggar', shortLabel: 'Daftar', icon: ShieldAlert },
    { key: 'kamus',  label: 'Kamus Pelanggaran', shortLabel: 'Kamus', icon: BookOpen },
  ] as const

  return (
    <div className="space-y-5 pb-16">
      <DashboardPageHeader
        title="Pelanggaran"
        description="Catatan disiplin santri."
      />
      <div className="flex gap-0.5 bg-slate-100 p-1 rounded-2xl">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-1 justify-center', tab === t.key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.shortLabel}</span>
          </button>
        ))}
      </div>
      {tab === 'daftar' && <TabDaftar masterList={masterList} />}
      {tab === 'kamus' && (
        loadingMaster
          ? <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          : <TabKamus masterList={masterList} onRefresh={loadMaster} />
      )}
    </div>
  )
}
