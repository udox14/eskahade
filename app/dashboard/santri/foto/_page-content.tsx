'use client'

import { useState, useRef } from 'react'
import { getSantriForFoto, uploadFotoSantri } from './actions'
import { Search, Upload, Image as ImageIcon, RefreshCw, Loader2, Home, Filter, ShieldAlert, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

const ASRAMA_LIST = ["SEMUA", "AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function ManajemenFotoPage() {
  // Filter State
  const [asrama, setAsrama] = useState('SEMUA')
  const [kamar, setKamar] = useState('SEMUA')
  const [search, setSearch] = useState('')
  
  // Data State
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false) 

  // Upload State
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // LOGIC LOAD DATA
  const loadData = async () => {
    setLoading(true)
    setHasSearched(true)
    const res = await getSantriForFoto(search, asrama, kamar)
    setData(res)
    setLoading(false)
  }

  // --- LOGIC KOMPRESI GAMBAR ---
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      img.src = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        const MAX_SIZE = 600
        let width = img.width
        let height = img.height
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height
            height = MAX_SIZE
          }
        }

        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error("Kompresi gagal"))
          },
          'image/jpeg',
          0.7 
        )
      }
      img.onerror = (err) => reject(err)
    })
  }

  // --- HANDLER UPLOAD ---
  const handleTriggerUpload = (santriId: string) => {
    setSelectedId(santriId)
    if (fileInputRef.current) {
        fileInputRef.current.value = '' 
        fileInputRef.current.click() 
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedId) return

    setUploadingId(selectedId)
    const toastId = toast.loading("Mengompres & Upload...")

    try {
        const compressedBlob = await compressImage(file)
        
        const formData = new FormData()
        formData.append('file', compressedBlob, 'foto.jpg')
        formData.append('santriId', selectedId)

        const res = await uploadFotoSantri(formData)

        if (res.error) {
            toast.error("Gagal", { description: res.error })
        } else {
            toast.success("Berhasil", { description: "Foto tersimpan." })
            setData(prev => prev.map(s => {
                if (s.id === selectedId) return { ...s, foto_url: res.url }
                return s
            }))
        }
    } catch (error) {
        toast.error("Gagal memproses gambar")
    } finally {
        toast.dismiss(toastId)
        setUploadingId(null)
        setSelectedId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Hero */}
      <div className="relative bg-rose-950 border border-rose-900/50 text-rose-50 px-6 pt-6 pb-8 rounded-[2.5rem] shadow-xl shadow-rose-900/10 overflow-hidden mb-2">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-rose-500/10 rounded-full blur-[40px] pointer-events-none"/>
        <h1 className="text-2xl font-black flex items-center gap-3 mb-1">
          <ImageIcon className="w-6 h-6 text-rose-400"/> Manajemen Foto Santri
        </h1>
        <p className="text-rose-200/60 text-xs font-medium max-w-md">Perbarui foto profil santri secara cepat dengan kompresi otomatis untuk menjaga performa sistem.</p>
      </div>

      {/* FILTER BAR */}
      <Card className="p-5 rounded-[2rem] border-border shadow-sm bg-card">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          
          <div className="md:col-span-3 space-y-2">
             <label className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] block ml-1">Asrama</label>
             <Select value={asrama} onValueChange={(v) => { setAsrama(v ?? ''); setKamar('SEMUA'); }}>
                <SelectTrigger className="h-11 bg-background border-border rounded-2xl font-bold focus:ring-rose-500">
                  <SelectValue placeholder="Pilih Asrama" />
                </SelectTrigger>
                <SelectContent>
                  {ASRAMA_LIST.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
                </SelectContent>
             </Select>
          </div>

          <div className="md:col-span-2 space-y-2">
             <label className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] block ml-1">Kamar</label>
             <Select value={kamar} onValueChange={(v) => setKamar(v ?? '')} disabled={asrama === 'SEMUA'}>
                <SelectTrigger className="h-11 bg-background border-border rounded-2xl font-bold focus:ring-rose-500">
                  <SelectValue placeholder="Kamar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEMUA" className="font-bold">SEMUA</SelectItem>
                  {Array.from({length: 30}, (_, i) => i + 1).map(k => (
                      <SelectItem key={k} value={String(k)} className="font-bold">{k}</SelectItem>
                  ))}
                </SelectContent>
             </Select>
          </div>

          <div className="md:col-span-4 space-y-2">
             <label className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] block ml-1">Pencarian Nama</label>
             <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input 
                    placeholder="Ketik nama santri..." 
                    className="h-11 pl-11 bg-background border-border rounded-2xl text-sm focus:ring-rose-500 font-medium"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadData()}
                />
             </div>
          </div>

          <div className="md:col-span-3">
            <Button 
               onClick={loadData}
               disabled={loading}
               className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black gap-2 shadow-lg shadow-rose-500/20 transition-all active:scale-[0.98]"
            >
               {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4" />}
               Tampilkan Data
            </Button>
          </div>
        </div>
      </Card>

      {/* INPUT FILE TERSEMBUNYI */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*"
      />

      {/* LIST SANTRI */}
      <div className="min-h-[400px]">
         {!hasSearched ? (
             <div className="bg-card border-border border border-dashed rounded-[3rem] p-20 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Filter className="w-10 h-10 text-muted-foreground/30"/>
                </div>
                <div className="space-y-1">
                  <p className="text-foreground font-black uppercase tracking-widest text-sm">Cari Data Santri</p>
                  <p className="text-muted-foreground text-[11px] font-medium">Silakan pilih Asrama/Kamar dan ketuk tombol Cari.</p>
                </div>
             </div>
         ) : loading ? (
             <div className="py-40 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-12 h-12 animate-spin text-rose-500"/>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Mengambil Data Santri...</p>
             </div>
         ) : data.length === 0 ? (
             <div className="bg-card border-border border rounded-[3rem] p-20 text-center space-y-4">
                <ShieldAlert className="w-12 h-12 text-rose-500/30 mx-auto"/>
                <p className="text-muted-foreground font-medium text-sm italic">Tidak ada data ditemukan.</p>
             </div>
         ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {data.map((s, idx) => (
                     <Card 
                        key={s.id} 
                        className={cn(
                          "group p-4 rounded-3xl border-border flex items-center gap-4 transition-all duration-300 hover:shadow-xl hover:shadow-rose-500/5 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4",
                          { "delay-75": idx % 3 === 1, "delay-150": idx % 3 === 2 }
                        )}
                     >
                         {/* PREVIEW FOTO */}
                         <div className="relative shrink-0">
                            <Avatar className="w-16 h-16 border-2 border-background shadow-md">
                              <AvatarImage src={s.foto_url} className="object-cover" />
                              <AvatarFallback className="bg-muted text-muted-foreground">
                                <ImageIcon className="w-6 h-6 opacity-20" />
                              </AvatarFallback>
                            </Avatar>
                            {!s.foto_url && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-background">
                                <div className="absolute inset-0 animate-ping bg-orange-500 rounded-full opacity-75" />
                              </div>
                            )}
                         </div>

                         {/* INFO */}
                         <div className="flex-1 min-w-0">
                             <p className="font-black text-foreground text-sm truncate uppercase tracking-tight">{s.nama_lengkap}</p>
                             <div className="flex items-center gap-2 mt-1">
                               <Badge variant="outline" className="text-[9px] font-black px-1.5 h-4 bg-muted border-transparent uppercase">
                                 <Home className="w-2.5 h-2.5 mr-1"/> {s.asrama} • {s.kamar}
                               </Badge>
                             </div>
                             <p className="text-[10px] text-muted-foreground font-mono mt-1 tabular-nums">{s.nis}</p>
                         </div>

                         {/* TOMBOL AKSI */}
                         <Button 
                            size="icon"
                            onClick={() => handleTriggerUpload(s.id)}
                            disabled={uploadingId === s.id}
                            className={cn(
                              "w-10 h-10 rounded-2xl shrink-0 transition-all active:scale-90 shadow-md",
                              s.foto_url 
                                ? 'bg-muted text-foreground hover:bg-background border border-border' 
                                : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-500/20'
                            )}
                         >
                            {uploadingId === s.id ? (
                                <Loader2 className="w-5 h-5 animate-spin"/>
                            ) : s.foto_url ? (
                                <RefreshCw className="w-5 h-5"/>
                            ) : (
                                <Upload className="w-5 h-5"/>
                            )}
                         </Button>
                     </Card>
                 ))}
             </div>
         )}
      </div>

    </div>
  )
}