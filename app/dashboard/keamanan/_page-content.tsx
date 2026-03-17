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
  Printer, CheckSquare, Square, Eye
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTgl(s: string) {
  try { return format(new Date(s.replace(' ', 'T')), 'dd MMM yyyy', { locale: idLocale }) }
  catch { return s }
}
const KATEGORI_COLOR: Record<string, string> = {
  RINGAN: 'bg-slate-100 text-slate-700 border-slate-200',
  SEDANG: 'bg-amber-100 text-amber-700 border-amber-200',
  BERAT:  'bg-rose-100 text-rose-700 border-rose-200',
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
// TAB 1 — INPUT PELANGGARAN
// ═══════════════════════════════════════════════════════════════════════════════
function TabInput({ masterList }: { masterList: any[] }) {
  const [keyword, setKeyword]           = useState('')
  const [hasilCari, setHasilCari]       = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [jenisSearch, setJenisSearch]   = useState('')
  const [deskripsi, setDeskripsi]       = useState('')
  const [tanggal, setTanggal]           = useState(new Date().toISOString().slice(0, 10))
  const [fotoBase64, setFotoBase64]     = useState<string | null>(null)
  const [uploading, setUploading]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedItem = masterList.find(m => String(m.id) === selectedMasterId)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.length < 2) return
    const res = await cariSantri(keyword)
    setHasilCari(res)
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
        santriId: selectedSantri.id, masterId: Number(selectedMasterId),
        deskripsiTambahan: deskripsi || undefined, tanggal, fotoUrl,
      })
      if ('error' in res) { toast.error(res.error); return }
      toast.success('Pelanggaran berhasil dicatat')
      setSelectedSantri(null); setKeyword(''); setHasilCari([])
      setSelectedMasterId(''); setDeskripsi(''); setFotoBase64(null); setJenisSearch('')
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Cari santri */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">1. Pilih Santri</p>
        {selectedSantri ? (
          <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <div>
              <p className="font-bold text-emerald-800">{selectedSantri.nama_lengkap}</p>
              <p className="text-xs text-emerald-600">{selectedSantri.nis} · {selectedSantri.asrama}/{selectedSantri.kamar}</p>
            </div>
            <button onClick={() => { setSelectedSantri(null); setHasilCari([]) }}
              className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" placeholder="Cari nama atau NIS..." value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
              </div>
              <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900">
                Cari
              </button>
            </form>
            {hasilCari.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
                {hasilCari.map(s => (
                  <button key={s.id} onClick={() => { setSelectedSantri(s); setHasilCari([]) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600">
                      {s.nama_lengkap.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{s.nama_lengkap}</p>
                      <p className="text-xs text-slate-400">{s.nis} · {s.asrama}/{s.kamar}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pilih jenis pelanggaran */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">2. Jenis Pelanggaran</p>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input type="text" placeholder="Ketik untuk cari jenis pelanggaran..."
            value={jenisSearch} onChange={e => setJenisSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
          {jenisSearch && (
            <button onClick={() => setJenisSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-3 max-h-56 overflow-y-auto pr-0.5">
          {masterList.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6 italic">Belum ada kamus pelanggaran.</p>
          ) : jenisSearch.trim() ? (
            (() => {
              const q = jenisSearch.toLowerCase()
              const filtered = masterList.filter(m =>
                m.nama_pelanggaran.toLowerCase().includes(q) ||
                (m.deskripsi ?? '').toLowerCase().includes(q)
              )
              return filtered.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 italic">Tidak ada yang cocok</p>
              ) : (
                <div className="space-y-1">
                  {filtered.map(m => (
                    <button key={m.id} onClick={() => { setSelectedMasterId(String(m.id)); setJenisSearch('') }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all ${selectedMasterId === String(m.id) ? 'border-rose-400 bg-rose-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-semibold ${selectedMasterId === String(m.id) ? 'text-rose-800' : 'text-slate-800'}`}>{m.nama_pelanggaran}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${KATEGORI_COLOR[m.kategori]}`}>{m.kategori}</span>
                        </div>
                        {m.deskripsi && <p className="text-xs text-slate-400 mt-0.5">{m.deskripsi}</p>}
                      </div>
                      <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg border ml-2 ${selectedMasterId === String(m.id) ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>+{m.poin}p</span>
                    </button>
                  ))}
                </div>
              )
            })()
          ) : (
            (['RINGAN', 'SEDANG', 'BERAT'] as const).map(kat => {
              const items = masterList.filter(m => m.kategori === kat)
              if (!items.length) return null
              return (
                <div key={kat}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${KATEGORI_COLOR[kat]}`}>{kat}</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="space-y-1">
                    {items.map(m => (
                      <button key={m.id} onClick={() => setSelectedMasterId(String(m.id))}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all ${selectedMasterId === String(m.id) ? 'border-rose-400 bg-rose-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                        <div className="text-left">
                          <p className={`font-semibold leading-tight ${selectedMasterId === String(m.id) ? 'text-rose-800' : 'text-slate-800'}`}>{m.nama_pelanggaran}</p>
                          {m.deskripsi && <p className="text-xs text-slate-400 mt-0.5">{m.deskripsi}</p>}
                        </div>
                        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg border ml-2 ${selectedMasterId === String(m.id) ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>+{m.poin}p</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">3. Detail & Bukti</p>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Tanggal Kejadian</label>
          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Keterangan Tambahan <span className="text-slate-400">(opsional)</span></label>
          <textarea value={deskripsi} onChange={e => setDeskripsi(e.target.value)}
            placeholder="Detail kejadian, saksi, dsb..." rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Foto Bukti <span className="text-slate-400">(opsional, auto kompres)</span></label>
          {fotoBase64 ? (
            <div className="relative">
              <img src={fotoBase64} className="w-full max-h-40 object-cover rounded-xl border border-slate-200" alt="Bukti" />
              <button onClick={() => { setFotoBase64(null); if (fileRef.current) fileRef.current.value = '' }}
                className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-500 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
              <span className="absolute bottom-2 left-2 text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">✓ Terkompresi</span>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl py-6 flex flex-col items-center gap-2 text-slate-400 hover:border-slate-300 hover:bg-slate-50 transition-colors">
              {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
              <span className="text-xs font-medium">{uploading ? 'Memproses...' : 'Klik untuk pilih foto'}</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
        </div>
      </div>

      <button onClick={handleSimpan} disabled={saving || !selectedSantri || !selectedMasterId}
        className="w-full py-3 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
        {saving ? 'Menyimpan...' : 'Catat Pelanggaran'}
      </button>

      {selectedItem && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm">
          <p className="text-rose-700 font-semibold">{selectedItem.nama_pelanggaran}</p>
          <p className="text-rose-500 text-xs">Kategori: {selectedItem.kategori} · Poin: +{selectedItem.poin}</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL DETAIL SANTRI
// ═══════════════════════════════════════════════════════════════════════════════
function ModalDetail({ santriId, onClose }: { santriId: string; onClose: () => void }) {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState<'pelanggaran' | 'pernyataan' | 'perjanjian'>('pelanggaran')
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

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
          <div>
            {loading ? <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" /> : (
              <>
                <p className="font-bold text-slate-900">{data?.profil?.nama_lengkap}</p>
                <p className="text-xs text-slate-400">{data?.profil?.nis} · {data?.profil?.asrama}/{data?.profil?.kamar}</p>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 mx-4 mt-3 rounded-xl shrink-0">
          {([
            { key: 'pelanggaran', label: 'Pelanggaran',      count: data?.pelanggaran?.length ?? 0 },
            { key: 'pernyataan',  label: 'Surat Pernyataan', count: data?.suratPernyataan?.length ?? 0 },
            { key: 'perjanjian',  label: 'SP',               count: data?.suratPerjanjian?.length ?? 0 },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${tab === t.key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500'}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : tab === 'pelanggaran' ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                  <p className="text-xs text-rose-400 font-medium">Total Poin</p>
                  <p className="text-xl font-black text-rose-700">{data.pelanggaran.reduce((a: number, p: any) => a + (p.poin ?? 0), 0)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs text-slate-400 font-medium">Jumlah Kasus</p>
                  <p className="text-xl font-black text-slate-700">{data.pelanggaran.length}x</p>
                </div>
              </div>
              {data.pelanggaran.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">Belum ada catatan pelanggaran</p>
              ) : data.pelanggaran.map((p: any) => (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${KATEGORI_COLOR[p.jenis] ?? KATEGORI_COLOR.RINGAN}`}>{p.jenis}</span>
                        <span className="text-[10px] font-bold text-rose-600">+{p.poin}p</span>
                        <span className="text-[10px] text-slate-400">{fmtTgl(p.tanggal)}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.deskripsi}</p>
                      {p.penindak_nama && <p className="text-[10px] text-slate-400 mt-0.5">Dicatat oleh: {p.penindak_nama}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.foto_url && (
                        <a href={p.foto_url} target="_blank" rel="noreferrer" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                          <ImageIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => handleHapus(p.id)} disabled={deleting === p.id}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : tab === 'pernyataan' ? (
            <div className="space-y-2">
              {data.suratPernyataan.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">Belum ada surat pernyataan</p>
              ) : data.suratPernyataan.map((sp: any) => (
                <div key={sp.id} className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Surat Pernyataan</p>
                      <p className="text-xs text-slate-400">{fmtTgl(sp.tanggal)} · {sp.dibuat_oleh_nama || '—'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{JSON.parse(sp.pelanggaran_ids || '[]').length} pelanggaran dicantumkan</p>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-lg">Pernyataan</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {data.suratPerjanjian.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">Belum ada surat perjanjian</p>
              ) : data.suratPerjanjian.map((sp: any) => (
                <div key={sp.id} className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{sp.level}</p>
                      <p className="text-xs text-slate-400">{fmtTgl(sp.tanggal)} · {sp.dibuat_oleh_nama || '—'}</p>
                      {sp.catatan && <p className="text-xs text-slate-500 mt-0.5 italic">"{sp.catatan}"</p>}
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${SP_COLOR[sp.level] ?? 'bg-slate-100 text-slate-600'}`}>{sp.level}</span>
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
// TAB 2 — DAFTAR PELANGGAR
// ═══════════════════════════════════════════════════════════════════════════════
function TabDaftar() {
  const [rows, setRows]           = useState<any[]>([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]       = useState('')
  const [modalId, setModalId]     = useState<string | null>(null)

  const load = useCallback(async (pg = 1, s = search) => {
    setLoading(true)
    try {
      const res = await getDaftarPelanggar({ search: s || undefined, page: pg })
      setRows(res.rows); setTotal(res.total); setTotalPages(res.totalPages)
      setPage(pg); setHasLoaded(true)
    } finally { setLoading(false) }
  }, [search])

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); load(1, searchInput) }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Cari nama atau NIS..."
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
          <button type="submit" className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Tampilkan
          </button>
        </form>
      </div>

      {!hasLoaded ? (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <ShieldAlert className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 text-sm">Klik <strong>Tampilkan</strong> untuk memuat daftar pelanggar</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm">
          Tidak ada data pelanggar.
        </div>
      ) : (
        <>
          <div className="text-xs text-slate-500 px-0.5">
            <strong className="text-slate-700">{total}</strong> santri tercatat pernah melanggar
          </div>

          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['No','Nama Santri','Asrama/Kamar','Kasus','Total Poin','SP Terakhir',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setModalId(r.id)}>
                    <td className="px-4 py-3 text-xs text-slate-300">{(page-1)*30+i+1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{r.nama_lengkap}</p>
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
                        ? <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${SP_COLOR[r.sp_terakhir]}`}>{r.sp_terakhir}</span>
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Eye className="w-4 h-4 text-slate-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {rows.map(r => (
              <button key={r.id} onClick={() => setModalId(r.id)}
                className="w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-left hover:border-slate-300 active:scale-[0.98] transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{r.nama_lengkap}</p>
                    <p className="text-xs text-slate-400">{r.nis} · {r.asrama}/{r.kamar}</p>
                  </div>
                  {r.sp_terakhir && (
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border ${SP_COLOR[r.sp_terakhir]}`}>{r.sp_terakhir}</span>
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
              <button onClick={() => load(page-1)} disabled={page<=1||loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <span className="text-xs text-slate-500">Hal {page}/{totalPages}</span>
              <button onClick={() => load(page+1)} disabled={page>=totalPages||loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {modalId && <ModalDetail santriId={modalId} onClose={() => setModalId(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — CETAK SURAT PERNYATAAN
// ═══════════════════════════════════════════════════════════════════════════════
function TabCetakPernyataan() {
  const [keyword, setKeyword]       = useState('')
  const [hasilCari, setHasilCari]   = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [detail, setDetail]         = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [checked, setChecked]       = useState<Set<string>>(new Set())
  const [preview, setPreview]       = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [tanggal, setTanggal]       = useState(new Date().toISOString().slice(0, 10))
  const printRef = useRef<HTMLDivElement>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await getDaftarPelanggar({ search: keyword })
    setHasilCari(res.rows)
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
    setChecked(checked.size === detail.pelanggaran.length ? new Set() : new Set(detail.pelanggaran.map((p: any) => p.id)))
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
    toast.success('Surat pernyataan tersimpan di riwayat')
    window.print()
  }

  return (
    <div className="max-w-3xl space-y-4">
      {!selectedSantri ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pilih Santri Pelanggar</p>
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" placeholder="Cari nama atau NIS..."
                value={keyword} onChange={e => setKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
            </div>
            <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold">Cari</button>
          </form>
          {hasilCari.map(s => (
            <button key={s.id} onClick={() => selectSantri(s)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border border-slate-200 rounded-xl mb-1.5 text-left">
              <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-xs font-black text-rose-700">{s.nama_lengkap.charAt(0)}</div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">{s.nama_lengkap}</p>
                <p className="text-xs text-slate-400">{s.nis} · {s.jumlah_pelanggaran}x · {s.total_poin}p</p>
              </div>
              {s.sp_terakhir && <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${SP_COLOR[s.sp_terakhir]}`}>{s.sp_terakhir}</span>}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4">
            <div>
              <p className="font-bold text-slate-900">{selectedSantri.nama_lengkap}</p>
              <p className="text-xs text-slate-400">{selectedSantri.nis}</p>
            </div>
            <button onClick={() => { setSelectedSantri(null); setDetail(null); setPreview(null); setChecked(new Set()) }}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingDetail ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : detail && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pilih Pelanggaran</p>
                <button onClick={toggleAll} className="text-xs text-slate-500 hover:text-slate-700 font-medium">
                  {checked.size === detail.pelanggaran.length ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {detail.pelanggaran.map((p: any) => (
                  <button key={p.id} onClick={() => setChecked(prev => {
                    const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n
                  })} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${checked.has(p.id) ? 'border-slate-700 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    {checked.has(p.id) ? <CheckSquare className="w-4 h-4 text-slate-700 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.deskripsi}</p>
                      <p className="text-xs text-slate-400">{fmtTgl(p.tanggal)} · {p.jenis} · +{p.poin}p</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tanggal Surat</label>
                  <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
                </div>
                <button onClick={handlePreview} disabled={checked.size === 0 || loadingPreview}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 self-end">
                  {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  Pratinjau
                </button>
              </div>
            </div>
          )}

          {preview && (
            <>
              <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-3 print:hidden">
                <p className="text-sm font-bold text-slate-700">Preview Surat Pernyataan</p>
                <button onClick={handleCetak} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Simpan & Cetak
                </button>
              </div>

              <div ref={printRef} className="bg-white shadow-xl print:shadow-none mx-auto"
                style={{ width: '215mm', minHeight: '330mm', padding: '2cm 2.5cm 1.5cm', fontFamily: 'Times New Roman, serif', fontSize: '12pt', lineHeight: '1.8', color: '#000' }}>
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
                      ['Nama',            preview.profil?.nama_lengkap ?? ''],
                      ['Asrama/ Kamar',   [preview.profil?.asrama, preview.profil?.kamar].filter(Boolean).join(' / ')],
                      ['Kelas Pengajian', preview.profil?.nama_kelas ?? ''],
                      ['Alamat',          preview.profil?.alamat ?? ''],
                      ['',               ''],
                      ['Nama Orang Tua',  preview.profil?.nama_ayah ?? ''],
                      ['No Telpon',       ''],
                    ] as [string,string][]).map(([lbl, val], idx) => (
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
              <style>{`@media print { .print\\:hidden { display: none !important } @page { size: 215mm 330mm; margin: 0; } }`}</style>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — CETAK SP
// ═══════════════════════════════════════════════════════════════════════════════
function TabCetakSP() {
  const [keyword, setKeyword]     = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [detail, setDetail]       = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [level, setLevel]         = useState<'SP1'|'SP2'|'SP3'|'SK'>('SP1')
  const [suggestLevel, setSuggestLevel] = useState<string>('SP1')
  const [tanggal, setTanggal]     = useState(new Date().toISOString().slice(0, 10))
  const [catatan, setCatatan]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const tglCetak = format(new Date(tanggal), 'dd MMMM yyyy', { locale: idLocale })
  const profil   = detail?.profil

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await getDaftarPelanggar({ search: keyword })
    setHasilCari(res.rows)
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
    toast.success(level + ' tersimpan')
    window.print()
  }

  return (
    <div className="max-w-3xl space-y-4">
      {!selectedSantri ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pilih Santri</p>
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" placeholder="Cari nama atau NIS..."
                value={keyword} onChange={e => setKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
            </div>
            <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold">Cari</button>
          </form>
          {hasilCari.map(s => (
            <button key={s.id} onClick={() => selectSantri(s)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border border-slate-200 rounded-xl mb-1.5 text-left">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600">{s.nama_lengkap.charAt(0)}</div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">{s.nama_lengkap}</p>
                <p className="text-xs text-slate-400">{s.nis} · {s.total_poin}p</p>
              </div>
              {s.sp_terakhir && <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${SP_COLOR[s.sp_terakhir]}`}>{s.sp_terakhir}</span>}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4">
            <div>
              <p className="font-bold text-slate-900">{selectedSantri.nama_lengkap}</p>
              <p className="text-xs text-slate-400">{selectedSantri.nis} · {selectedSantri.total_poin}p</p>
            </div>
            <button onClick={() => { setSelectedSantri(null); setDetail(null); setShowPreview(false) }}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl">
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingDetail ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
              {detail?.suratPerjanjian?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Riwayat SP</p>
                  <div className="flex gap-2 flex-wrap">
                    {detail.suratPerjanjian.map((sp: any) => (
                      <span key={sp.id} className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${SP_COLOR[sp.level]}`}>
                        {sp.level} — {fmtTgl(sp.tanggal)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Level SP {suggestLevel && <span className="ml-2 text-emerald-600 normal-case font-normal">Saran: {suggestLevel}</span>}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(['SP1','SP2','SP3','SK'] as const).map(l => (
                    <button key={l} onClick={() => setLevel(l)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${level === l ? SP_COLOR[l] : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Tanggal Surat</label>
                  <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Catatan</label>
                  <input type="text" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Opsional..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowPreview(true)}
                  className="flex-1 py-2.5 border border-slate-200 bg-slate-50 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-100 flex items-center justify-center gap-2">
                  <Eye className="w-4 h-4" /> Pratinjau
                </button>
                <button onClick={handleCetak} disabled={saving}
                  className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Simpan & Cetak
                </button>
              </div>
            </div>
          )}

          {showPreview && profil && (
            <>
              <div className="bg-white shadow-xl print:shadow-none mx-auto"
                style={{ width: '215mm', minHeight: '330mm', padding: '2cm 2.5cm 1.5cm', fontFamily: 'Times New Roman, serif', fontSize: '12pt', lineHeight: '1.7', color: '#000' }}>
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
                  <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline', margin: 0 }}>SURAT PERJANJIAN {level}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '11pt' }}>NO: ....../ A.10/ KMN-DSN-SKH/....../202..</p>
                </div>
                <p style={{ marginBottom: '12px' }}>Yang bertanda tangan di bawah ini:</p>
                <table style={{ width: '100%', marginBottom: '12px', borderCollapse: 'collapse' }}>
                  <tbody>
                    {([
                      ['Nama',            profil.nama_lengkap],
                      ['Asrama / Kamar',  [profil.asrama, profil.kamar].filter(Boolean).join(' / ')],
                      ['Kelas Pengajian', profil.nama_kelas],
                      ['Alamat',          profil.alamat],
                      ['Nama Orang Tua',  profil.nama_ayah],
                    ] as [string,string][]).map(([lbl, val]) => (
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
                  {['KEAMANAN','DEWAN SANTRI','PENGURUS ASRAMA'].map(lbl => (
                    <div key={lbl} style={{ textAlign: 'center' }}>
                      <p style={{ borderBottom: '1px solid black', marginBottom: '4px', paddingBottom: '48px' }}>&nbsp;</p>
                      <p style={{ fontWeight: 'bold', fontSize: '10pt' }}>{lbl}</p>
                    </div>
                  ))}
                </div>
              </div>
              <style>{`@media print { .print\\:hidden { display: none !important } @page { size: 215mm 330mm; margin: 0; } }`}</style>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5 — KAMUS PELANGGARAN
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

  const grouped = ['RINGAN','SEDANG','BERAT'].reduce((acc, k) => {
    acc[k] = masterList.filter((m: any) => m.kategori === k)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="max-w-3xl space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          {editId ? 'Edit Jenis Pelanggaran' : 'Tambah Jenis Pelanggaran'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Kategori</label>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {(['RINGAN','SEDANG','BERAT'] as const).map(k => (
                <button key={k} onClick={() => setForm(f => ({ ...f, kategori: k }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.kategori === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>{k}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Poin</label>
            <input type="number" value={form.poin} onChange={e => setForm(f => ({ ...f, poin: Number(e.target.value) }))}
              min={1} max={100}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 block mb-1">Nama Pelanggaran</label>
            <input type="text" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
              placeholder="Contoh: Merokok, Berkelahi, Pencurian..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 block mb-1">Deskripsi <span className="text-slate-400">(opsional)</span></label>
            <input type="text" value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
              placeholder="Keterangan singkat..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSimpan} disabled={saving}
            className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah'}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ kategori: 'RINGAN', nama: '', poin: 10, deskripsi: '' }) }}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50">
              Batal
            </button>
          )}
        </div>
      </div>

      {['RINGAN','SEDANG','BERAT'].map(kat => (
        <div key={kat}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${KATEGORI_COLOR[kat]}`}>{kat}</span>
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] text-slate-400">{grouped[kat]?.length ?? 0}</span>
          </div>
          {!grouped[kat]?.length ? (
            <p className="text-xs text-slate-400 italic pl-1">Belum ada</p>
          ) : (
            <div className="space-y-1.5">
              {grouped[kat].map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{m.nama_pelanggaran}</p>
                    {m.deskripsi && <p className="text-xs text-slate-400 truncate">{m.deskripsi}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">+{m.poin}p</span>
                  <button onClick={() => { setEditId(m.id); setForm({ kategori: m.kategori, nama: m.nama_pelanggaran, poin: m.poin, deskripsi: m.deskripsi || '' }) }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleHapus(m.id)} disabled={deleting === m.id}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
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
  const [tab, setTab]               = useState<'input'|'daftar'|'pernyataan'|'sp'|'kamus'>('input')
  const [masterList, setMasterList] = useState<any[]>([])
  const [loadingMaster, setLoadingMaster] = useState(true)

  const loadMaster = useCallback(async () => {
    setLoadingMaster(true)
    setMasterList(await getMasterPelanggaran())
    setLoadingMaster(false)
  }, [])

  useEffect(() => { loadMaster() }, [loadMaster])

  const TABS = [
    { key: 'input',      label: 'Input',         icon: Plus },
    { key: 'daftar',     label: 'Daftar',        icon: ShieldAlert },
    { key: 'pernyataan', label: 'Srt Pernyataan',icon: FileText },
    { key: 'sp',         label: 'SP',            icon: Gavel },
    { key: 'kamus',      label: 'Kamus',         icon: BookOpen },
  ] as const

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-rose-600" /> Pelanggaran & SP
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Catatan disiplin, surat pernyataan, dan surat perjanjian santri</p>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${tab === t.key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'input'      && <TabInput masterList={masterList} />}
      {tab === 'daftar'     && <TabDaftar />}
      {tab === 'pernyataan' && <TabCetakPernyataan />}
      {tab === 'sp'         && <TabCetakSP />}
      {tab === 'kamus'      && <TabKamus masterList={masterList} onRefresh={loadMaster} />}
    </div>
  )
}
