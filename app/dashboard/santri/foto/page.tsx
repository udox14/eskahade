'use client'

import { useState, useRef } from 'react'
import { getSantriForFoto, uploadFotoSantri } from './actions'
import { Search, Upload, Image as ImageIcon, RefreshCw, Loader2, Home, Filter } from 'lucide-react'
import { toast } from 'sonner'

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
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <ImageIcon className="w-6 h-6 text-pink-600"/> Manajemen Foto Santri
           </h1>
           <p className="text-gray-500 text-sm">Mode cepat upload foto (Kompresi Otomatis).</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-end">
          
          {/* Asrama */}
          <div className="w-full md:w-1/4">
             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Asrama</label>
             <select 
                value={asrama} 
                onChange={(e) => { setAsrama(e.target.value); setKamar('SEMUA'); }}
                className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-pink-500 outline-none"
             >
                {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
             </select>
          </div>

          {/* Kamar */}
          <div className="w-full md:w-1/6">
             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Kamar</label>
             <select 
                value={kamar} 
                onChange={(e) => setKamar(e.target.value)}
                disabled={asrama === 'SEMUA'}
                className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-pink-500 outline-none disabled:bg-gray-100"
             >
                <option value="SEMUA">Semua</option>
                {Array.from({length: 30}, (_, i) => i + 1).map(k => (
                    <option key={k} value={k}>{k}</option>
                ))}
             </select>
          </div>

          {/* Search */}
          <div className="w-full md:flex-1 relative">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
             <input 
                 placeholder="Cari Nama..." 
                 className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && loadData()}
             />
          </div>

          {/* Tombol Tampilkan */}
          <button 
             onClick={loadData}
             disabled={loading}
             className="bg-pink-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2 h-[38px]"
          >
             {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Tampilkan"}
          </button>
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
             <div className="flex flex-col items-center justify-center h-full py-32 text-gray-400">
                <Filter className="w-16 h-16 mb-4 text-gray-200"/>
                <p>Silakan pilih Asrama/Kamar dan klik <b>Tampilkan</b>.</p>
             </div>
         ) : loading ? (
             <div className="py-32 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-pink-500"/></div>
         ) : data.length === 0 ? (
             <div className="py-32 text-center text-gray-400">Tidak ada data santri ditemukan.</div>
         ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                 {data.map((s) => (
                     <div key={s.id} className={`flex items-center gap-4 p-3 border rounded-xl transition-all ${s.foto_url ? 'bg-white border-gray-200' : 'bg-orange-50 border-orange-200'}`}>
                         
                         {/* PREVIEW FOTO */}
                         <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-sm bg-gray-100 relative">
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
                             <p className="font-bold text-gray-800 truncate">{s.nama_lengkap}</p>
                             <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Home className="w-3 h-3"/> {s.asrama} / {s.kamar}
                             </p>
                             <p className="text-[10px] text-gray-400 font-mono mt-0.5">{s.nis}</p>
                         </div>

                         {/* TOMBOL AKSI */}
                         <button 
                            onClick={() => handleTriggerUpload(s.id)}
                            disabled={uploadingId === s.id}
                            className={`p-2 rounded-lg shadow-sm flex-shrink-0 transition-colors ${
                                s.foto_url 
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                                : 'bg-pink-600 text-white hover:bg-pink-700'
                            }`}
                            title={s.foto_url ? "Ganti Foto" : "Upload Foto"}
                         >
                            {uploadingId === s.id ? (
                                <Loader2 className="w-5 h-5 animate-spin"/>
                            ) : s.foto_url ? (
                                <RefreshCw className="w-5 h-5"/>
                            ) : (
                                <Upload className="w-5 h-5"/>
                            )}
                         </button>

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
        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        </div>
    )
}