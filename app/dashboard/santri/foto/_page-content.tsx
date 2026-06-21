'use client'

import React from 'react'

import { useState, useRef } from 'react'
import { getSantriForFoto, uploadFotoSantri } from './actions'
import { Search, Upload, RefreshCw, Loader2, Home, Filter } from 'lucide-react'
import { toast } from '@/lib/toast'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { Button, TextInput, NativeSelect, ActionIcon } from '@mantine/core'

const ASRAMA_LIST = ["SEMUA", "AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function ManajemenFotoPage() {
  // Filter State
  const [asrama, setAsrama] = useState('SEMUA')
  const [kamar, setKamar] = useState('SEMUA')
  const [search, setSearch] = useState('')
  
  // Data State
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false) // Penanda Lazy Load

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
        
        // Resize logic (Max 600px)
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
    <div className="space-y-6 pb-20">
      
      {/* HEADER & FILTER */}
      <div className="border-b pb-4">
        <DashboardPageHeader
          title="Manajemen Foto Santri"
          description="Mode cepat upload foto dengan kompresi otomatis."
        />
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-end">
          
          {/* Asrama */}
          <div className="w-full md:w-1/4">
            <NativeSelect
              label={<span className="text-xs font-bold text-slate-500 uppercase">Asrama</span>}
              value={asrama}
              onChange={(e) => { setAsrama(e.target.value); setKamar('SEMUA'); }}
              data={ASRAMA_LIST.map(a => ({ label: a, value: a }))}
            />
          </div>

          {/* Kamar */}
          <div className="w-full md:w-1/6">
            <NativeSelect
              label={<span className="text-xs font-bold text-slate-500 uppercase">Kamar</span>}
              value={kamar}
              onChange={(e) => setKamar(e.target.value)}
              disabled={asrama === 'SEMUA'}
              data={[
                { label: 'Semua', value: 'SEMUA' },
                ...Array.from({length: 30}, (_, i) => i + 1).map(k => ({ label: String(k), value: String(k) })),
              ]}
            />
          </div>

          {/* Search */}
          <div className="w-full md:flex-1">
            <TextInput
              placeholder="Cari Nama..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadData()}
              leftSection={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Tombol Tampilkan */}
          <Button onClick={loadData} loading={loading} color="pink">
            Tampilkan
          </Button>
      </div>

      {/* INPUT FILE TERSEMBUNYI */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*"
      />

      {/* LIST SANTRI */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
         {!hasSearched ? (
             <div className="flex flex-col items-center justify-center h-full py-32 text-slate-400">
                <Filter className="w-16 h-16 mb-4 text-slate-200"/>
                <p>Silakan pilih Asrama/Kamar dan klik <b>Tampilkan</b>.</p>
             </div>
         ) : loading ? (
             <div className="py-32 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-pink-500"/></div>
         ) : data.length === 0 ? (
             <div className="py-32 text-center text-slate-400">Tidak ada data santri ditemukan.</div>
         ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                 {data.map((s) => (
                     <div key={s.id} className={`flex items-center gap-4 p-3 border rounded-xl transition-all ${s.foto_url ? 'bg-white border-slate-200' : 'bg-orange-50 border-orange-200'}`}>
                         
                         {/* PREVIEW FOTO */}
                         <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-sm bg-slate-100 relative">
                             {s.foto_url ? (
                                 <img 
                                    src={s.foto_url} 
                                    alt="Foto" 
                                    className="w-full h-full object-cover"
                                 />
                             ) : (
                                 <UserPlaceholder />
                             )}
                         </div>

                         {/* INFO */}
                         <div className="flex-1 min-w-0">
                             <p className="font-bold text-slate-800 truncate">{s.nama_lengkap}</p>
                             <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Home className="w-3 h-3"/> {s.asrama} / {s.kamar}
                             </p>
                             <p className="text-[10px] text-slate-400 font-mono mt-0.5">{s.nis}</p>
                         </div>

                         {/* TOMBOL AKSI */}
                         <ActionIcon
                            onClick={() => handleTriggerUpload(s.id)}
                            loading={uploadingId === s.id}
                            variant={s.foto_url ? 'light' : 'filled'}
                            color={s.foto_url ? 'gray' : 'pink'}
                            size="lg"
                            title={s.foto_url ? "Ganti Foto" : "Upload Foto"}
                         >
                            {s.foto_url ? <RefreshCw className="w-5 h-5"/> : <Upload className="w-5 h-5"/>}
                         </ActionIcon>

                     </div>
                 ))}
             </div>
         )}
      </div>

    </div>
  )
}

function UserPlaceholder() {
    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        </div>
    )
}
