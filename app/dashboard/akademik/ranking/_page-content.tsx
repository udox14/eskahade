'use client'

import { useState, useRef } from 'react'
import { getJuaraUmum } from './actions'
import { Trophy, Loader2, Printer, Search, Medal } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

export default function JuaraUmumPage() {
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [tahunAjaran, setTahunAjaran] = useState('2025/2026') 
  const [rankingData, setRankingData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Referensi untuk area yang akan dicetak
  const printRef = useRef<HTMLDivElement>(null)

  // Fungsi React-to-Print (Update untuk v3.x)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Lampiran_Kejuaraan_Semester_${selectedSemester === '1' ? 'Ganjil' : 'Genap'}`,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getJuaraUmum(Number(selectedSemester))
      setRankingData(res)
      // Dinamis: Ambil tahun ajaran dari data siswa (jika tersedia)
      if (res.length > 0 && res[0].tahun_ajaran) {
          setTahunAjaran(res[0].tahun_ajaran)
      }
    } catch (error) {
      alert("Gagal memuat data kejuaraan.")
    } finally {
      setLoading(false)
    }
  }

  // Logika Grouping (Untuk menggabungkan kolom Nomor dan Kelas pakai rowSpan di tabel cetak)
  const groupedData: any[] = []
  let currentClass = ""
  let classIndex = 0

  rankingData.forEach(item => {
    if (item.kelas_nama !== currentClass) {
      currentClass = item.kelas_nama
      classIndex++
      groupedData.push({
        ...item,
        isFirst: true,
        classIndex,
        rowSpan: rankingData.filter(d => d.kelas_nama === currentClass).length
      })
    } else {
      groupedData.push({
        ...item,
        isFirst: false
      })
    }
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Medal className="w-8 h-8 text-yellow-500" />
            Kejuaraan & Prestasi
          </h1>
          <p className="text-gray-500 text-sm mt-1">Rekapitulasi dan Cetak Lampiran Juara Umum 1, 2, dan 3 Seluruh Kelas.</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-end gap-4">
        <div className="w-full sm:w-auto">
          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Pilih Semester EHB</label>
          <select 
            className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            <option value="1">Semester Ganjil (1)</option>
            <option value="2">Semester Genap (2)</option>
          </select>
        </div>
        
        <button 
          onClick={loadData}
          disabled={loading}
          className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm font-bold"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Search className="w-5 h-5"/>}
          Tarik Data Juara
        </button>

        {rankingData.length > 0 && (
          <button 
            onClick={handlePrint}
            className="w-full sm:w-auto ml-auto bg-blue-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg font-bold"
          >
            <Printer className="w-5 h-5"/>
            Cetak PDF / Print
          </button>
        )}
      </div>

      {/* EMPTY STATE / LOADING */}
      {loading ? (
         <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500 mb-3"/> <p className="text-gray-500 font-medium">Memindai data juara...</p></div>
      ) : rankingData.length === 0 ? (
         <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
           <Trophy className="w-14 h-14 text-gray-300 mx-auto mb-3"/>
           <h3 className="text-lg font-bold text-gray-600">Pilih semester dan klik Tarik Data.</h3>
           <p className="text-sm text-gray-500">Pastikan Wali Kelas sudah mengkalkulasi ranking di fitur Leger Nilai.</p>
         </div>
      ) : (
         
         /* PREVIEW AREA (KERTAS F4 SIMULASI NARROW MARGIN) */
         <div className="bg-gray-200 p-4 md:p-8 rounded-2xl overflow-x-auto shadow-inner border border-gray-300">
            <div className="text-center mb-4">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-200">Preview Dokumen Cetak</span>
            </div>

            {/* KERTAS PUTIH MURNI UNTUK DICETAK (Tanpa Kop, Font Arial 11pt, Kertas F4, Margin Sempit) */}
            <div 
                ref={printRef} 
                className="bg-white mx-auto shadow-xl relative text-black"
                style={{ 
                  width: '215mm', 
                  minHeight: '330mm', 
                  padding: '10mm', /* Margin narrow (1cm) */
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '11pt'
                }}
            >
                {/* CSS Khusus Print untuk mereset margin browser dan memaksakan font Arial serta ukuran F4 narrow */}
                <style type="text/css" media="print">
                    {`
                      @page { size: 215mm 330mm portrait; margin: 10mm; }
                      body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact; 
                        font-family: Arial, Helvetica, sans-serif !important;
                        font-size: 11pt !important;
                      }
                    `}
                </style>

                {/* JUDUL DOKUMEN (Langsung ke Judul) */}
                <div className="text-center mb-6">
                    <h2 className="font-bold underline tracking-wide uppercase">LAMPIRAN KEPUTUSAN KEJUARAAN EHB</h2>
                    <p className="font-bold uppercase mt-1">
                        SEMESTER {selectedSemester === '1' ? 'GANJIL' : 'GENAP'} TAHUN AJARAN {tahunAjaran}
                    </p>
                </div>

                {/* TABEL DATA JUARA */}
                <table className="w-full border-collapse border border-black">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 w-[5%] text-center">No</th>
                            <th className="border border-black p-2 w-[20%] text-center">Tingkat / Kelas</th>
                            <th className="border border-black p-2 w-[5%] text-center">Juara</th>
                            {/* Kolom nama tidak diberi lebar fixed agar otomatis melebar semaksimal mungkin */}
                            <th className="border border-black p-2 w-auto">Nama Santri</th>
                            <th className="border border-black p-2 w-[22%]">Asrama / Kamar</th>
                            <th className="border border-black p-2 w-[8%] text-center">Jml Nilai</th>
                            <th className="border border-black p-2 w-[8%] text-center">Rata-rata</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedData.map((item, idx) => (
                            <tr key={idx}>
                                {/* Penggabungan Sel (RowSpan) agar rapi per kelas */}
                                {item.isFirst && (
                                    <td rowSpan={item.rowSpan} className="border border-black p-2 text-center align-top">
                                        {item.classIndex}
                                    </td>
                                )}
                                {item.isFirst && (
                                    <td rowSpan={item.rowSpan} className="border border-black p-2 align-top text-center whitespace-nowrap">
                                        <div>{item.kelas_nama}</div>
                                        <div className="text-[9pt] mt-1 capitalize text-gray-800">{item.wali_kelas}</div>
                                    </td>
                                )}
                                
                                {/* Data Spesifik Santri (Tanpa Bold, Satu Baris) */}
                                <td className="border border-black p-2 text-center">{item.rank}</td>
                                <td className="border border-black p-2 uppercase whitespace-nowrap">{item.santri_nama}</td>
                                <td className="border border-black p-2 whitespace-nowrap">
                                  {item.asrama ? `${item.asrama} / ${item.kamar}` : ''}
                                </td>
                                <td className="border border-black p-2 text-center">{item.jumlah}</td>
                                <td className="border border-black p-2 text-center">{item.rata}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>
      )}
    </div>
  )
}