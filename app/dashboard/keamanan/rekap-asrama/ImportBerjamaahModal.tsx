'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, X, AlertCircle, ArrowRight, Save, CheckCircle, Loader2, ChevronDown, Search } from 'lucide-react'
import { toast } from 'sonner'
import { importAbsenBerjamaahFingerprint } from './actions'

interface PresentLog {
  nama: string
  tanggal: string
  waktu: 'shubuh' | 'ashar'
}

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  santriList: any[] // array of { id, nama_lengkap, nis, kamar }
}

function parseExcelDate(dateVal: any): string {
  // Try mapping DD/MM/YYYY
  if (typeof dateVal === 'string') {
    const parts = dateVal.split('/')
    if (parts.length === 3) {
      // Assuming DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }
  // If it's excel serial date or Date object
  if (dateVal instanceof Date) {
    return dateVal.toISOString().split('T')[0]
  }
  return String(dateVal)
}

function expandName(str: string) {
  // Ubah variasi awalan/huruf M menjadi muhammad untuk skor lebih sinkron
  return str.toLowerCase()
    .replace(/\b(m|mo|moh|moch|muh|mohammad|mohamad|muhamad|mhd)\b/g, 'muhammad')
    .replace(/[^a-z0-9]/g, '')
}

function getBigrams(str: string) {
  const bigrams = new Set<string>()
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.slice(i, i + 2))
  }
  return bigrams
}

function stringSimilarity(str1: string, str2: string) {
  if (!str1 || !str2) return 0
  const s1 = expandName(str1)
  const s2 = expandName(str2)
  if (s1 === s2) return 1
  if (s1.length < 2 || s2.length < 2) return 0
  
  const set1 = getBigrams(s1)
  const set2 = getBigrams(s2)
  const intersection = Array.from(set1).filter(x => set2.has(x))
  return (2 * intersection.length) / (set1.size + set2.size)
}

// Komponen Combobox manual karena native <select> tidak bisa di-search
const SantriCombobox = ({ 
  candidates, 
  value, 
  onChange 
}: { 
  candidates: any[], 
  value: string, 
  onChange: (val: string) => void 
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = candidates.filter(c => 
    c.nama_lengkap.toLowerCase().includes(search.toLowerCase())
  )
  const selected = candidates.find(c => c.id === value)

  return (
    <div className="relative" ref={ref}>
      <div 
        onClick={() => setOpen(!open)}
        className="w-full bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg cursor-pointer flex justify-between items-center text-sm font-medium shadow-sm hover:border-slate-300"
      >
        <span className="truncate">{selected ? `${selected.nama_lengkap} (${selected.kamar})` : "❌ Abaikan & Buang Baris Ini"}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border shadow-xl rounded-lg flex flex-col overflow-hidden max-h-60">
          <div className="p-2 border-b bg-slate-50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
            <input 
              autoFocus 
              type="text" 
              placeholder="Cari nama spesifik..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="w-full px-1 py-1 text-sm bg-transparent outline-none" 
            />
          </div>
          <div className="overflow-y-auto">
            <div 
              onClick={() => { onChange(''); setOpen(false); setSearch('') }} 
              className="px-3 py-2 cursor-pointer hover:bg-red-50 text-red-600 font-bold text-sm border-b"
            >
              ❌ Abaikan & Buang Baris Ini
            </div>
            {filtered.map(c => (
              <div 
                key={c.id} 
                onClick={() => { onChange(c.id); setOpen(false); setSearch('') }} 
                className="px-3 py-2 cursor-pointer hover:bg-indigo-50 text-sm flex justify-between items-center group"
              >
                <span className="text-slate-700 font-medium group-hover:text-indigo-700 truncate">{c.nama_lengkap}</span>
                <span className="text-xs text-slate-400 whitespace-nowrap ml-2">({c.kamar}) • {(c.score * 100).toFixed(0)}%</span>
              </div>
            ))}
            {filtered.length === 0 && <div className="p-4 text-center text-sm text-slate-400">Pencarian tidak ditemukan</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ImportBerjamaahModal({ isOpen, onClose, onSuccess, santriList }: ImportModalProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [parsedRaw, setParsedRaw] = useState<PresentLog[]>([])
  
  const [unmappedNames, setUnmappedNames] = useState<string[]>([])
  const [mappings, setMappings] = useState<Record<string, string>>({}) // "Excel Name": "santri id"

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<any>(ws)

      if (!rows || rows.length === 0) {
        throw new Error("File Excel kosong atau format tidak sesuai")
      }

      const extracted: PresentLog[] = []
      rows.forEach(r => {
        const nama = r['Nama'] || r['NAMA'] || r['nama']
        const tgl = r['Tanggal'] || r['TANGGAL'] || r['tanggal']
        let wkt = String(r['waktu'] || r['WAKTU'] || r['Waktu'] || '').toUpperCase()
        
        if (nama && tgl && wkt) {
          if (wkt === 'SUBUH' || wkt === 'SHUBUH') wkt = 'shubuh'
          if (wkt === 'ASHAR') wkt = 'ashar'
          
          if (wkt === 'shubuh' || wkt === 'ashar') {
            extracted.push({
              nama: String(nama).trim(),
              tanggal: parseExcelDate(tgl),
              waktu: wkt as 'shubuh' | 'ashar'
            })
          }
        }
      })

      if (extracted.length === 0) {
        throw new Error("Tidak menemukan data yang valid (Pastikan kolom Nama, Tanggal, waktu ada dan sesuai)")
      }

      setParsedRaw(extracted)

      // Identifikasi unmapped names
      const uniqueNames = Array.from(new Set(extracted.map(x => x.nama)))
      const unmapped: string[] = []
      const initMaps: Record<string, string> = {}

      const normalize = (str: string) => expandName(str)

      uniqueNames.forEach(n => {
        const normN = normalize(n)
        // 1. Cari exact match
        let match = santriList.find(s => s.nama_lengkap.toLowerCase() === n.toLowerCase())
        // 2. Cari normalized match
        if (!match) match = santriList.find(s => normalize(s.nama_lengkap) === normN)
        // 3. Fuzzy matching jika masih tidak ada
        if (!match) {
          let bestScore = 0
          let bestCandidate: any = null
          santriList.forEach(s => {
            const score = stringSimilarity(n, s.nama_lengkap)
            if (score > bestScore) {
              bestScore = score
              bestCandidate = s
            }
          })
          // Otomatis pre-fill combobox dengan saran teratas agar user tinggal mantau
          if (bestScore > 0.05 && bestCandidate) {
            initMaps[n] = bestCandidate.id
          }
          unmapped.push(n) // Wajib masuk antrean review
        } else {
          initMaps[n] = match.id // Exact match langsung masuk
        }
      })

      setMappings(initMaps)
      setUnmappedNames(unmapped)

      if (unmapped.length > 0) {
        setStep(2) // Ke tahap mapping
      } else {
        setStep(3) // Langsung selesai mapping
      }

    } catch (err: any) {
      toast.error(err.message || 'Gagal membaca excel')
    } finally {
      const el = document.getElementById('import-file-upload') as HTMLInputElement
      if (el) el.value = ''
      setLoading(false)
    }
  }

  const handleNextToStep3 = () => {
    setStep(3)
  }

  const handleMulaiImport = async () => {
    setLoading(true)
    try {
      // Nama yang ada di Excel = ALFA langsung
      const alfaRowsMap: Record<string, { santri_id: string, tanggal: string, shubuh?: 'A', ashar?: 'A' }> = {}

      parsedRaw.forEach(log => {
        const santriId = mappings[log.nama]
        if (!santriId) return // Diabaikan user atau tidak ter-mapping
        const key = `${santriId}|${log.tanggal}`
        if (!alfaRowsMap[key]) alfaRowsMap[key] = { santri_id: santriId, tanggal: log.tanggal }
        if (log.waktu === 'shubuh') alfaRowsMap[key].shubuh = 'A'
        if (log.waktu === 'ashar') alfaRowsMap[key].ashar = 'A'
      })

      const finalAlfaRows = Object.values(alfaRowsMap)

      // 3. Post to server
      const res = await importAbsenBerjamaahFingerprint(finalAlfaRows)
      if (res?.success) {
        toast.success(`Selesai! Berhasil memproses absensi & mencatat alfa.`)
        onSuccess()
        onClose()
      } else {
        throw new Error(res?.error || 'Gagal menyimpan ke database')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-800">Import Absen Berjamaah</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* STEP 1: UPLOAD */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-sm leading-relaxed">
                <AlertCircle className="w-5 h-5 inline mr-2 -mt-1"/>
                Sistem hanya akan membaca kolom: <strong>Nama</strong>, <strong>Tanggal</strong>, dan <strong>waktu</strong>.
                Setiap nama yang muncul di Excel <strong>dianggap ALFA</strong>. Yang tidak ada di file = hadir.
              </div>
              <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl p-10 text-center relative group hover:bg-indigo-50/50 transition">
                <input 
                  id="import-file-upload"
                  type="file" 
                  accept=".xls,.xlsx,.xlsm"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                {loading ? (
                  <Loader2 className="w-10 h-10 mx-auto text-indigo-400 animate-spin mb-3"/>
                ) : (
                  <Upload className="w-10 h-10 mx-auto text-indigo-500 mb-3 group-hover:scale-110 transition"/>
                )}
                <p className="font-bold text-slate-700">Pilih atau Seret File Excel Kesini</p>
                <p className="text-sm text-slate-500 mt-1">Format didukung: .xlsx, .xlsm</p>
              </div>
            </div>
          )}

          {/* STEP 2: MAPPING */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl text-sm flex gap-3">
                <AlertCircle className="w-8 h-8 shrink-0 text-orange-500"/>
                <div>
                  <p className="font-bold mb-1">Ditemukan {unmappedNames.length} nama asing!</p>
                  <p>Nama-nama ini ada di mesin tetapi tidak sama persis dengan nama di database. Pilih nama asli santri tersebut pada dropdown, atau <strong>Kosongkan</strong> untuk menolaknya.</p>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto px-1 pb-4">
                {unmappedNames.map(name => {
                  // Hitung kemiripan dan singkirkan yang nilainya 0 (sama sekali tak mirip)
                  const candidatesWithScores = santriList.map(s => ({
                    ...s,
                    score: stringSimilarity(name, s.nama_lengkap)
                  }))
                  
                  const sortedCandidates = candidatesWithScores
                    .filter(s => s.score > 0.05) // Hanya yg mirip walau sedikit
                    .sort((a, b) => b.score - a.score)

                  const bestMatch = sortedCandidates[0]

                  return (
                    <div key={name} className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-800 text-sm uppercase">{name}</p>
                          {bestMatch && bestMatch.score > 0.4 && (
                            <span className="bg-indigo-50 text-indigo-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-indigo-100">
                              Kemiripan: {(bestMatch.score * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Nama di Excel</p>
                      </div>

                      <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-2.5">
                        <SantriCombobox 
                          candidates={sortedCandidates.length > 0 ? sortedCandidates : candidatesWithScores} 
                          value={mappings[name] || ''} 
                          onChange={(val) => setMappings({...mappings, [name]: val})} 
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end pt-4 gap-2">
                <button onClick={() => setStep(1)} className="px-5 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl text-sm">Batal</button>
                <button onClick={handleNextToStep3} className="px-5 py-2 text-white font-bold bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm flex items-center gap-2">
                  Lanjut <ArrowRight className="w-4 h-4"/>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & POST */}
          {step === 3 && (
            <div className="space-y-6 py-4 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto"/>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Semua Data Siap Diimpor</h3>
                <p className="text-slate-500 mt-2">
                  Total record terbaca : <strong>{parsedRaw.length} record ketukan jari</strong><br/>
                </p>
              </div>

              <div className="flex justify-center pt-2 gap-3">
                <button disabled={loading} onClick={() => {
                  if (unmappedNames.length > 0) setStep(2)
                  else setStep(1)
                }} className="px-5 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl text-sm">Kembali</button>
                <button 
                  disabled={loading} 
                  onClick={handleMulaiImport} 
                  className="px-8 py-2 text-white font-bold bg-green-600 hover:bg-green-700 rounded-xl text-sm shadow flex items-center gap-2 active:scale-95 transition"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                  {loading ? "Menyimpan ke Database..." : "Simpan & Proses Alfa Kharij"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
