'use client'

import { useState, useRef } from 'react'
import { getJuaraUmum } from './actions'
import { Trophy, Loader2, Printer, Search, Medal } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function JuaraUmumPage() {
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [tahunAjaran, setTahunAjaran] = useState('2025/2026')
  const [rankingData, setRankingData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Lampiran_Kejuaraan_Semester_${selectedSemester === '1' ? 'Ganjil' : 'Genap'}`,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getJuaraUmum(Number(selectedSemester))
      setRankingData(res)
      if (res.length > 0 && res[0].tahun_ajaran) setTahunAjaran(res[0].tahun_ajaran)
    } catch { alert("Gagal memuat data kejuaraan.") }
    finally { setLoading(false) }
  }

  const groupedData: any[] = []
  let currentClass = ""
  let classIndex = 0
  rankingData.forEach(item => {
    if (item.kelas_nama !== currentClass) {
      currentClass = item.kelas_nama; classIndex++
      groupedData.push({ ...item, isFirst: true, classIndex, rowSpan: rankingData.filter(d => d.kelas_nama === currentClass).length })
    } else {
      groupedData.push({ ...item, isFirst: false })
    }
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4">

      {/* HEADER */}
      <div>
        <h1 className="text-xl font-black text-foreground flex items-center gap-2">
          <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600"><Medal className="w-5 h-5"/></div>
          Kejuaraan & Prestasi
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 ml-[3.25rem]">Rekapitulasi & Cetak Lampiran Juara Umum 1, 2, dan 3 Seluruh Kelas.</p>
      </div>

      {/* FILTER BAR */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-4">
          <div className="w-full sm:w-auto space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Pilih Semester EHB</label>
            <Select value={selectedSemester} onValueChange={(v) => { if (v) setSelectedSemester(v) }}>
              <SelectTrigger className="w-full sm:w-56 h-11 shadow-none focus:ring-amber-500 bg-muted/20 font-bold">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="font-bold">Semester Ganjil (1)</SelectItem>
                <SelectItem value="2" className="font-bold">Semester Genap (2)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={loadData} disabled={loading} className="w-full sm:w-auto font-black rounded-xl gap-2 shadow-sm h-11">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            Tarik Data Juara
          </Button>

          {rankingData.length > 0 && (
            <Button onClick={handlePrint} className="w-full sm:w-auto ml-auto bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl gap-2 shadow-sm h-11">
              <Printer className="w-4 h-4"/> Cetak PDF / Print
            </Button>
          )}
        </CardContent>
      </Card>

      {/* EMPTY STATE / LOADING */}
      {loading ? (
        <Card className="py-20 text-center border-border shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-500 mb-3"/>
          <p className="text-muted-foreground font-bold">Memindai data juara...</p>
        </Card>
      ) : rankingData.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border/60 rounded-2xl bg-muted/10">
          <Trophy className="w-14 h-14 text-muted-foreground/20 mx-auto mb-3"/>
          <h3 className="text-base font-black text-foreground">Pilih semester dan klik Tarik Data.</h3>
          <p className="text-sm text-muted-foreground mt-1">Pastikan Wali Kelas sudah mengkalkulasi ranking di fitur Leger Nilai.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/10 text-amber-700 border-amber-400/30 font-black border px-3 py-1">
              {rankingData.length} Data Juara Ditemukan
            </Badge>
          </div>

          {/* PREVIEW AREA */}
          <div className="bg-muted/50 border border-border p-4 md:p-8 rounded-2xl overflow-x-auto shadow-inner">
            <div className="text-center mb-4">
              <Badge className="bg-blue-500/10 text-blue-700 border-blue-400/30 font-black border tracking-widest uppercase">
                Preview Dokumen Cetak
              </Badge>
            </div>

            {/* PRINT AREA */}
            <div
              ref={printRef}
              className="bg-white mx-auto shadow-xl relative text-black"
              style={{ width: '215mm', minHeight: '330mm', padding: '10mm', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11pt' }}
            >
              <style type="text/css" media="print">
                {`@page { size: 215mm 330mm portrait; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Arial, Helvetica, sans-serif !important; font-size: 11pt !important; }`}
              </style>
              <div className="text-center mb-6">
                <h2 className="font-bold underline tracking-wide uppercase">LAMPIRAN KEPUTUSAN KEJUARAAN EHB</h2>
                <p className="font-bold uppercase mt-1">SEMESTER {selectedSemester === '1' ? 'GANJIL' : 'GENAP'} TAHUN AJARAN {tahunAjaran}</p>
              </div>
              <table className="w-full border-collapse border border-black">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-2 w-[5%] text-center">No</th>
                    <th className="border border-black p-2 w-[20%] text-center">Tingkat / Kelas</th>
                    <th className="border border-black p-2 w-[5%] text-center">Juara</th>
                    <th className="border border-black p-2 w-auto">Nama Santri</th>
                    <th className="border border-black p-2 w-[22%]">Asrama / Kamar</th>
                    <th className="border border-black p-2 w-[8%] text-center">Jml Nilai</th>
                    <th className="border border-black p-2 w-[8%] text-center">Rata-rata</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData.map((item, idx) => (
                    <tr key={idx}>
                      {item.isFirst && <td rowSpan={item.rowSpan} className="border border-black p-2 text-center align-top">{item.classIndex}</td>}
                      {item.isFirst && (
                        <td rowSpan={item.rowSpan} className="border border-black p-2 align-top text-center whitespace-nowrap">
                          <div>{item.kelas_nama}</div>
                          <div className="text-[9pt] mt-1 capitalize text-slate-800">{item.wali_kelas}</div>
                        </td>
                      )}
                      <td className="border border-black p-2 text-center">{item.rank}</td>
                      <td className="border border-black p-2 uppercase whitespace-nowrap">{item.santri_nama}</td>
                      <td className="border border-black p-2 whitespace-nowrap">{item.asrama ? `${item.asrama} / ${item.kamar}` : ''}</td>
                      <td className="border border-black p-2 text-center">{item.jumlah}</td>
                      <td className="border border-black p-2 text-center">{item.rata}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}