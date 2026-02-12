'use client'

import { useState, useEffect } from 'react'
import { getKelasForCetak, getDataBlanko, getMarhalahForCetak, getDataBlankoMassal } from './actions'
import { Printer, Loader2, Search, FileText, Layers, List } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

// --- KOMPONEN KERTAS ABSENSI (REUSABLE) ---
function BlankoSheet({ data }: { data: any }) {
  const daysHeader = [
    { name: 'Rabu', colspan: 3, sessions: ['S', 'A', 'M'] },
    { name: 'Kamis', colspan: 2, sessions: ['S', 'A'] }, 
    { name: 'J', colspan: 1, sessions: ['M'] }, 
    { name: 'Sabtu', colspan: 3, sessions: ['S', 'A', 'M'] },
    { name: 'Ahad', colspan: 3, sessions: ['S', 'A', 'M'] },
    { name: 'Senin', colspan: 3, sessions: ['S', 'A', 'M'] },
    { name: 'Selasa', colspan: 2, sessions: ['S', 'A'] }, 
  ]
  const agendaShubuh = ['Rabu', 'Kamis', 'Sabtu', 'Ahad', 'Senin', 'Selasa']
  const agendaAshar = ['Rabu', 'Kamis', 'Sabtu', 'Ahad', 'Senin', 'Selasa']
  const agendaMaghrib = ['Rabu', 'Jumat', 'Sabtu', 'Ahad', 'Senin']

  const getNamaGuru = (dataGuru: any) => {
    if (!dataGuru) return '............................'
    if (Array.isArray(dataGuru)) return dataGuru[0]?.nama_lengkap || '............................'
    return dataGuru.nama_lengkap || '............................'
  }

  const formatAsrama = (asrama: string, kamar: string) => {
    if (!asrama) return '-'
    let code = asrama.toUpperCase().replace('ASY-SYIFA', 'ASY').replace('BAHAGIA', 'BHG').replace('AL-FALAH', 'ALF').replace('AS-SALAM', 'ASAS').trim()
    return `${code}/${kamar || '-'}`
  }

  const formatSekolah = (sekolah: string, kelas: string) => {
      const skl = sekolah ? sekolah.toUpperCase().replace('MTS', 'MTS').replace('SMP', 'SMP').split(' ')[0] : '-'
      return `${skl}/${kelas || '-'}`
  }

  return (
    <div className="print-area bg-white text-black mx-auto shadow-2xl border mb-8 print:mb-0 print:break-after-page" style={{ width: '21.59cm', minHeight: '33.02cm', padding: '1cm' }}>
      {/* HEADER */}
      <div className="flex justify-between items-end mb-2 border-b-2 border-black pb-1 print-header">
          <h2 className="text-xl font-black uppercase tracking-wider">{data.kelas.nama_kelas}</h2>
          <div className="font-bold flex gap-8">
              <span>BULAN : ___________________</span>
              <span>MINGGU KE : _____</span>
          </div>
      </div>

      {/* TABEL SANTRI */}
      <table className="print-table w-full mb-4 text-[10px]">
          <thead className="bg-gray-100 font-bold text-center">
              <tr>
                  <th rowSpan={2} className="w-5">NO</th>
                  <th rowSpan={2} className="w-[12rem] text-left px-2">NAMA SANTRI</th>
                  <th rowSpan={2} className="w-12">ASRAMA</th>
                  <th rowSpan={2} className="w-12">SEKOLAH</th>
                  {daysHeader.map(d => <th key={d.name} colSpan={d.colspan}>{d.name.toUpperCase()}</th>)}
              </tr>
              <tr>
                  {daysHeader.map(d => d.sessions.map((s, i) => <th key={d.name+s+i} className="w-4 px-0">{s}</th>))}
              </tr>
          </thead>
          <tbody>
              {data.santriList.length === 0 ? (
                  <tr><td colSpan={21} className="text-center py-4 italic text-gray-500">Tidak ada data santri</td></tr>
              ) : data.santriList.map((s: any, idx: number) => (
                  <tr key={s.id || idx}>
                      <td className="text-center">{idx + 1}</td>
                      <td className="font-normal whitespace-nowrap overflow-hidden text-ellipsis max-w-[12rem] px-1">{s.nama_lengkap}</td>
                      <td className="text-center whitespace-nowrap">{formatAsrama(s.gedung || s.asrama, s.kamar)}</td>
                      <td className="text-center whitespace-nowrap">{formatSekolah(s.sekolah, s.kelas_sekolah)}</td>
                      {Array.from({length: 17}).map((_, i) => <td key={i} className="h-4"></td>)}
                  </tr>
              ))}
          </tbody>
      </table>

      {/* AGENDA - FIX LAYOUT */}
      <div className="agenda-section flex gap-3 w-full">
          {[
            { label: 'SHUBUH', guru: data.kelas.guru_shubuh, days: agendaShubuh },
            { label: 'ASHAR', guru: data.kelas.guru_ashar, days: agendaAshar },
            { label: 'MAGHRIB', guru: data.kelas.guru_maghrib, days: agendaMaghrib }
          ].map((sesi, idx) => (
            <div key={idx} className="flex-1">
                <div className="font-bold mb-0.5 border border-black p-0.5 text-center bg-gray-100 text-[9px]">
                    {sesi.label}<br/><span className="font-normal normal-case">{getNamaGuru(sesi.guru)}</span>
                </div>
                <table className="print-table w-full text-center text-[9px]">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="w-14">Hari/Tanggal</th>
                            <th className="w-14">Pelajaran</th>
                            <th>Materi</th>
                            <th className="w-14">Paraf</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sesi.days.map(hari => (
                            <tr key={hari} className="h-5">
                                <td className="text-left px-1 align-middle whitespace-nowrap">
                                    <div className="flex items-center">
                                        <span className="w-8 font-medium">{hari}</span> {/* Lebar tetap agar garis miring lurus */}
                                        <span className="mx-1">/</span>
                                        <span>___</span>
                                    </div>
                                </td>
                                <td></td><td></td><td></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          ))}
      </div>
      <div className="mt-2 text-[8px] text-right italic text-gray-500 no-print">Dicetak pada {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
    </div>
  )
}

// --- PAGE UTAMA ---
export default function CetakBlankoPage() {
  const [mode, setMode] = useState<'SATUAN' | 'MASSAL'>('SATUAN')
  
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState('')

  const [loading, setLoading] = useState(false)
  
  // Data Hasil
  const [singleData, setSingleData] = useState<any>(null)
  const [massalData, setMassalData] = useState<any[] | null>(null)

  useEffect(() => {
    getKelasForCetak().then(setKelasList)
    getMarhalahForCetak().then(setMarhalahList)
  }, [])

  const handleGenerate = async () => {
    setLoading(true)
    setSingleData(null)
    setMassalData(null)

    if (mode === 'SATUAN') {
        if (!selectedKelas) { toast.error("Pilih kelas dulu"); setLoading(false); return }
        const res = await getDataBlanko(selectedKelas)
        if (res.error) toast.error(res.error)
        else setSingleData(res)
    } else {
        if (!selectedMarhalah) { toast.error("Pilih marhalah dulu"); setLoading(false); return }
        const res = await getDataBlankoMassal(selectedMarhalah)
        if (res.error) {
            toast.error(res.error)
        } else {
            // FIX: Pastikan res.massal tidak undefined, gunakan array kosong sebagai fallback
            setMassalData(res.massal || [])
        }
    }
    setLoading(false)
  }

  const handlePrint = () => window.print()

  const hasData = singleData || (massalData && massalData.length > 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      
      {/* STYLE PRINT (Global) */}
      <style dangerouslySetInnerHTML={{__html: `
          @media print {
              @page { size: 21.59cm 33.02cm; margin: 0.5cm; }
              body { background: white; }
              .no-print { display: none !important; }
              .print-area { box-shadow: none !important; border: none !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
              table { page-break-inside: auto; border-collapse: collapse; width: 100%; }
              tr { page-break-inside: avoid; }
              .agenda-section { page-break-inside: avoid; }
          }
          .print-table th, .print-table td { border: 1px solid black; padding: 1px 2px; }
          .print-header { font-size: 11px; }
      `}} />

      {/* KONTROL PANEL (No Print) */}
      <div className="no-print bg-white p-6 rounded-xl border shadow-sm space-y-4">
         <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b pb-4">
             <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-indigo-600"/> Cetak Blanko Absen
                </h1>
                <p className="text-gray-500 text-sm">Pilih mode cetak: Satuan per kelas atau Massal per marhalah.</p>
             </div>
             
             {/* MODE TOGGLE */}
             <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => { setMode('SATUAN'); setSingleData(null); setMassalData(null); }}
                    className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${mode === 'SATUAN' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <List className="w-4 h-4"/> Per Kelas
                </button>
                <button 
                    onClick={() => { setMode('MASSAL'); setSingleData(null); setMassalData(null); }}
                    className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${mode === 'MASSAL' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Layers className="w-4 h-4"/> Per marhalah
                </button>
             </div>
         </div>

         {/* FILTER & ACTIONS */}
         <div className="flex flex-col md:flex-row gap-4 items-end">
             {mode === 'SATUAN' ? (
                 <div className="flex-1 w-full">
                     <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Pilih Kelas</label>
                     <select 
                        value={selectedKelas} 
                        onChange={e => setSelectedKelas(e.target.value)}
                        className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                     >
                         <option value="">-- Pilih Kelas --</option>
                         {kelasList.map(k => (
                         <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                         ))}
                     </select>
                 </div>
             ) : (
                 <div className="flex-1 w-full">
                     <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Pilih Tingkat (Marhalah)</label>
                     <select 
                        value={selectedMarhalah} 
                        onChange={e => setSelectedMarhalah(e.target.value)}
                        className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-green-500"
                     >
                         <option value="">-- Pilih Tingkat --</option>
                         {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                     </select>
                 </div>
             )}

             <div className="flex gap-2 w-full md:w-auto">
                 <button 
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold shadow hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>} 
                    {loading ? "Memuat..." : "Tampilkan"}
                 </button>
                 
                 {hasData && (
                     <button onClick={handlePrint} className="flex-1 bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold shadow hover:bg-green-700 flex items-center justify-center gap-2">
                         <Printer className="w-4 h-4"/> Cetak
                     </button>
                 )}
             </div>
         </div>
      </div>

      {/* RENDER AREA */}
      <div>
          {mode === 'SATUAN' && singleData && <BlankoSheet data={singleData} />}
          
          {mode === 'MASSAL' && massalData && (
              <div>
                  <div className="no-print mb-4 p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200 text-sm text-center">
                      Berhasil memuat <b>{massalData.length} kelas</b>. Klik tombol <b>Cetak</b> di atas untuk mencetak semua sekaligus.
                  </div>
                  {massalData.map((item: any, idx: number) => (
                      <div key={idx}>
                          <BlankoSheet data={item} />
                          {/* Page break otomatis ditangani CSS print:break-after-page */}
                      </div>
                  ))}
              </div>
          )}
      </div>

    </div>
  )
}