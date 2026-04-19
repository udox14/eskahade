'use client'

import React, { useState } from 'react'
import { Upload, X, AlertCircle, ArrowRight, Save, CheckCircle, Loader2 } from 'lucide-react'
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

function getBigrams(str: string) {
  const bigrams = new Set<string>()
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.slice(i, i + 2))
  }
  return bigrams
}

function stringSimilarity(str1: string, str2: string) {
  if (!str1 || !str2) return 0
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '')
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (s1 === s2) return 1
  if (s1.length < 2 || s2.length < 2) return 0
  
  const set1 = getBigrams(s1)
  const set2 = getBigrams(s2)
  const intersection = Array.from(set1).filter(x => set2.has(x))
  return (2 * intersection.length) / (set1.size + set2.size)
}

export default function ImportBerjamaahModal({ isOpen, onClose, onSuccess, santriList }: ImportModalProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [parsedRaw, setParsedRaw] = useState<PresentLog[]>([])
  
  const [unmappedNames, setUnmappedNames] = useState<string[]>([])
  const [mappings, setMappings] = useState<Record<string, string>>({}) // "Excel Name": "santri id"
  const [skipAllUnmapped, setSkipAllUnmapped] = useState(false)

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

      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')

      uniqueNames.forEach(n => {
        const normN = normalize(n)
        // 1. Cari exact match
        let match = santriList.find(s => s.nama_lengkap.toLowerCase() === n.toLowerCase())
        // 2. Cari normalized match (tanpa spasi/tanda baca)
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
          // Pre-fill dropdown jika kemiripan sangat tinggi, tapi biarkan user ACC
          if (bestScore > 0.85 && bestCandidate) {
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
    // Validasi apabila ada yang belum di-map tapi tidak dicentang skip
    const hasEmpty = unmappedNames.some(n => !mappings[n])
    if (hasEmpty && !skipAllUnmapped) {
      toast.warning("Masih ada nama yang belum dicocokkan! (Pilih nama atau centang Abaikan)")
      return
    }
    setStep(3)
  }

  const handleMulaiImport = async () => {
    setLoading(true)
    try {
      // 1. Build list of "Hadir" (berdasarkan ID)
      const hadirSet = new Set<string>() // format: id|tanggal|waktu
      const activeSessions = new Set<string>() // format: tanggal|waktu

      parsedRaw.forEach(log => {
        // Apakah namanya ada di map / tidak diskip?
        let assignedId = mappings[log.nama]
        if (!assignedId && skipAllUnmapped) {
           return // diskip
        }
        if (assignedId) {
          hadirSet.add(`${assignedId}|${log.tanggal}|${log.waktu}`)
          activeSessions.add(`${log.tanggal}|${log.waktu}`)
        }
      })

      // 2. Build list of "Alfa": santri active yang ga ada di hadirSet
      const alfaRowsMap: Record<string, { santri_id: string, tanggal: string, shubuh?: 'A', ashar?: 'A' }> = {}

      activeSessions.forEach(sess => {
        const [tanggal, waktu] = sess.split('|')
        santriList.forEach(santri => {
          const key = `${santri.id}|${tanggal}`
          if (!hadirSet.has(`${santri.id}|${tanggal}|${waktu}`)) {
            // Ini dia Alfa
            if (!alfaRowsMap[key]) {
              alfaRowsMap[key] = { santri_id: santri.id, tanggal }
            }
            if (waktu === 'shubuh') alfaRowsMap[key].shubuh = 'A'
            if (waktu === 'ashar') alfaRowsMap[key].ashar = 'A'
          }
        })
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
                Sistem menangkap status Hadir setiap ada baris waktu SUBUH/ASHAR. Santri yang tidak terekam otomatis dihitung ALFA.
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

              <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1 pb-4">
                {unmappedNames.map(name => {
                  // Urutkan dropdown berdasarkan tingkat kemiripan untuk nama ini
                  const sortedCandidates = [...santriList].map(s => ({
                    ...s,
                    score: stringSimilarity(name, s.nama_lengkap)
                  })).sort((a, b) => b.score - a.score)

                  // Pre-select the best match if there is no mapping yet (helps user click faster)
                  // Wait, if it wasn't > 0.85 it wasn't auto-mapped. But maybe we suggest it visually.
                  const bestMatch = sortedCandidates[0]

                  return (
                    <div key={name} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama di Excel</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-800 text-base uppercase">{name}</p>
                            {bestMatch && bestMatch.score > 0.4 && (
                              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-100">
                                Rating Kemiripan: {(bestMatch.score * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <p className="text-sm font-semibold text-slate-700 mb-2">Memilih Santri Tujuan</p>
                        <div className="relative">
                          <select 
                            value={mappings[name] || ''}
                            onChange={(e) => setMappings({...mappings, [name]: e.target.value})}
                            className="w-full appearance-none bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm font-medium"
                          >
                            <option value="">❌ Abaikan & Buang Baris Ini</option>
                            {sortedCandidates.map(s => (
                              <option key={s.id} value={s.id}>{s.nama_lengkap} ({s.kamar})</option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" 
                  checked={skipAllUnmapped} onChange={(e) => setSkipAllUnmapped(e.target.checked)}/>
                <span className="text-sm text-slate-600 font-medium">Abaikan sekaligus nama yang tidak saya cocokkan di atas</span>
              </label>

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
