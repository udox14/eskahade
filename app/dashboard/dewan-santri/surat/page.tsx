'use client'

import { useState, useRef, useEffect } from 'react'
import { cariSantri, cekTunggakanSantri, catatSuratKeluar, getRiwayatSurat, hapusRiwayatSurat } from './actions'
import { SuratView } from './surat-view'
import { useReactToPrint } from 'react-to-print'
import { Printer, Search, FileText, ArrowLeft, Loader2, History, Filter, Calendar, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

export default function LayananSuratPage() {
  // State Navigasi Generator
  const [step, setStep] = useState(1) 
  const [jenisSurat, setJenisSurat] = useState<'MONDOK' | 'IZIN' | 'BERHENTI' | 'TAGIHAN' | null>(null)
  
  // State Data Generator
  const [search, setSearch] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [dataTambahan, setDataTambahan] = useState<any>({})
  const [dataTunggakan, setDataTunggakan] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  // State Riwayat
  const [riwayat, setRiwayat] = useState<any[]>([])
  const [filterBulan, setFilterBulan] = useState(new Date().getMonth() + 1)
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear())
  const [loadingRiwayat, setLoadingRiwayat] = useState(true)

  const printRef = useRef(null)
  
  // Hook Print
  const triggerPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Surat_${jenisSurat}_${selectedSantri?.nama_lengkap}`,
    onAfterPrint: () => {
        setIsPrinting(false)
        toast.success("Dokumen dikirim ke printer")
    }
  })

  // Load Riwayat saat filter berubah
  useEffect(() => {
    loadRiwayat()
  }, [filterBulan, filterTahun])

  const loadRiwayat = async () => {
    setLoadingRiwayat(true)
    const res = await getRiwayatSurat(filterBulan, filterTahun)
    setRiwayat(res)
    setLoadingRiwayat(false)
  }

  // STEP 1: PILIH JENIS
  const selectJenis = (jenis: any) => {
    setJenisSurat(jenis)
    setStep(2)
  }

  // STEP 2: CARI SANTRI
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (search.length < 3) return toast.warning("Ketik minimal 3 huruf")
    setLoading(true)
    const res = await cariSantri(search)
    setHasilCari(res)
    setLoading(false)
  }

  const selectSantri = async (s: any) => {
    setSelectedSantri(s)
    
    if (jenisSurat === 'TAGIHAN') {
       const tunggakan = await cekTunggakanSantri(s.id)
       setDataTunggakan(tunggakan)
       if (!tunggakan.adaTunggakan) toast.success("Santri ini LUNAS (Tidak ada tunggakan)")
    }

    if (jenisSurat === 'MONDOK' || jenisSurat === 'TAGIHAN') {
       setStep(4) 
    } else {
       setStep(3) 
    }
  }

  // STEP 3: INPUT TAMBAHAN
  const handleInputTambahan = (e: React.FormEvent) => {
    e.preventDefault()
    setStep(4)
  }

  // STEP 4: PROSES CETAK & CATAT
  const handlePrintProcess = async () => {
    setIsPrinting(true)
    
    // 1. Catat ke Database dulu
    const info = jenisSurat === 'IZIN' ? dataTambahan.alasan :
                 jenisSurat === 'TAGIHAN' ? `Total Rp ${dataTunggakan?.total?.toLocaleString('id-ID')}` : 
                 jenisSurat === 'BERHENTI' ? "Pengunduran Diri" : "Keterangan Aktif"

    const res = await catatSuratKeluar(selectedSantri.id, jenisSurat!, info)
    
    if (res?.error) {
        toast.error("Gagal mencatat riwayat surat", { description: "Tapi proses cetak tetap dilanjutkan." })
    } else {
        loadRiwayat() // Refresh tabel bawah
    }

    // 2. Trigger Print Dialog
    triggerPrint()
  }

  // HAPUS RIWAYAT
  const handleDeleteRiwayat = async (id: string) => {
    if (!confirm("Hapus catatan surat ini?")) return
    
    const toastId = toast.loading("Menghapus...")
    const res = await hapusRiwayatSurat(id)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal hapus", { description: res.error })
    } else {
        toast.success("Berhasil dihapus")
        loadRiwayat()
    }
  }

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-20">
       
       {/* HEADER (Sembunyikan saat print) */}
       <div className="flex items-center gap-4 print:hidden">
        {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-6 h-6 text-gray-600"/></button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Layanan Surat</h1>
          <p className="text-gray-500 text-sm">Generator surat otomatis & Arsip surat keluar.</p>
        </div>
      </div>

      {/* --- BAGIAN GENERATOR --- */}
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 print:border-none print:p-0 print:bg-white">
          
          {/* STEP 1: PILIH JENIS (Sembunyikan saat print) */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in print:hidden">
                <MenuCard title="Ket. Mondok" desc="Surat aktif santri" icon={FileText} color="bg-blue-600" onClick={() => selectJenis('MONDOK')} />
                <MenuCard title="Izin Pulang" desc="Surat jalan & perizinan" icon={FileText} color="bg-purple-600" onClick={() => selectJenis('IZIN')} />
                <MenuCard title="Surat Tagihan" desc="Pemberitahuan tunggakan SPP" icon={FileText} color="bg-orange-600" onClick={() => selectJenis('TAGIHAN')} />
                <MenuCard title="Berhenti / Pindah" desc="Surat keterangan keluar" icon={FileText} color="bg-red-600" onClick={() => selectJenis('BERHENTI')} />
            </div>
          )}

          {/* STEP 2: CARI SANTRI (Sembunyikan saat print) */}
          {step === 2 && (
            <div className="bg-white p-6 rounded-xl border shadow-sm max-w-xl mx-auto animate-in slide-in-from-right-4 print:hidden">
                <h3 className="font-bold text-lg mb-4 text-center">Cari Santri</h3>
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nama / NIS..." className="flex-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
                    <button disabled={loading} className="bg-blue-600 text-white px-4 rounded-lg">{loading ? <Loader2 className="animate-spin w-5 h-5"/> : <Search className="w-5 h-5"/>}</button>
                </form>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {hasilCari.map(s => (
                        <div key={s.id} onClick={() => selectSantri(s)} className="p-3 border rounded hover:bg-blue-50 cursor-pointer">
                            <p className="font-bold">{s.nama_lengkap}</p>
                            <p className="text-xs text-gray-500">{s.asrama} - Kamar {s.kamar}</p>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {/* STEP 3: INPUT TAMBAHAN (Sembunyikan saat print) */}
          {step === 3 && (
            <div className="bg-white p-6 rounded-xl border shadow-sm max-w-xl mx-auto animate-in slide-in-from-right-4 print:hidden">
                <h3 className="font-bold text-lg mb-4">Detail Surat {jenisSurat}</h3>
                <form onSubmit={handleInputTambahan} className="space-y-4">
                    {jenisSurat === 'IZIN' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500">Dari Tanggal</label><input type="date" required onChange={e=>setDataTambahan({...dataTambahan, tglMulai: e.target.value})} className="w-full p-2 border rounded"/></div>
                                <div><label className="text-xs font-bold text-gray-500">Sampai Tanggal</label><input type="date" required onChange={e=>setDataTambahan({...dataTambahan, tglSelesai: e.target.value})} className="w-full p-2 border rounded"/></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-500">Keperluan</label><textarea required onChange={e=>setDataTambahan({...dataTambahan, alasan: e.target.value})} className="w-full p-2 border rounded" rows={3}></textarea></div>
                        </>
                    )}
                    {jenisSurat === 'BERHENTI' && (
                        <div><label className="text-xs font-bold text-gray-500">Alasan Berhenti</label><textarea required onChange={e=>setDataTambahan({...dataTambahan, alasan: e.target.value})} className="w-full p-2 border rounded" rows={3}></textarea></div>
                    )}
                    <button className="w-full bg-green-600 text-white py-2 rounded-lg font-bold">Lanjut Preview</button>
                </form>
            </div>
          )}

          {/* STEP 4: PREVIEW */}
          {step === 4 && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in">
                {/* Tombol Aksi (Sembunyikan saat print) */}
                <div className="flex gap-4 print:hidden">
                    <button onClick={() => setStep(1)} disabled={isPrinting} className="px-4 py-2 border bg-white rounded-lg hover:bg-gray-50">Batal / Ganti</button>
                    <button onClick={() => handlePrintProcess()} disabled={isPrinting} className="px-6 py-2 bg-green-700 text-white rounded-lg font-bold shadow hover:bg-green-800 flex items-center gap-2 disabled:opacity-50">
                        {isPrinting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4"/>} Cetak & Simpan
                    </button>
                </div>
                
                {/* Dokumen yang akan dicetak */}
                <div className="bg-gray-200 p-8 border rounded-xl overflow-auto max-w-full print:p-0 print:bg-white print:border-none print:w-full print:overflow-visible">
                    <div ref={printRef} className="bg-white shadow-2xl print:shadow-none print:w-full">
                        <SuratView 
                            jenis={jenisSurat!} 
                            dataSantri={selectedSantri} 
                            dataTambahan={dataTambahan}
                            dataTunggakan={dataTunggakan}
                        />
                    </div>
                </div>
            </div>
          )}
      </div>

      {/* --- BAGIAN RIWAYAT (TABEL BAWAH) (Sembunyikan saat print) --- */}
      <div className="border-t pt-8 print:hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <History className="w-6 h-6 text-orange-600"/> Agenda Surat Keluar
              </h2>
              
              {/* Filter */}
              <div className="flex gap-2">
                  <select value={filterBulan} onChange={e => setFilterBulan(Number(e.target.value))} className="p-2 border rounded-lg text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                      {BULAN_LIST.map((b, i) => <option key={i} value={i+1}>{b}</option>)}
                  </select>
                  <select value={filterTahun} onChange={e => setFilterTahun(Number(e.target.value))} className="p-2 border rounded-lg text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                  </select>
              </div>
          </div>

          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
             {loadingRiwayat ? (
                 <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400"/></div>
             ) : riwayat.length === 0 ? (
                 <div className="text-center py-12 text-gray-400 text-sm">Belum ada surat keluar bulan ini.</div>
             ) : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                            <tr>
                                <th className="px-6 py-3">Tanggal</th>
                                <th className="px-6 py-3">Jenis Surat</th>
                                <th className="px-6 py-3">Atas Nama</th>
                                <th className="px-6 py-3">Asrama</th>
                                <th className="px-6 py-3">Keterangan</th>
                                <th className="px-6 py-3">Admin</th>
                                <th className="px-6 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {riwayat.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-mono text-xs text-gray-500">{format(new Date(row.created_at), 'dd/MM/yyyy HH:mm', {locale:id})}</td>
                                    <td className="px-6 py-3">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                            row.jenis_surat === 'IZIN' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                            row.jenis_surat === 'TAGIHAN' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                            'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                            {row.jenis_surat}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 font-bold text-gray-800">{row.santri?.nama_lengkap}</td>
                                    <td className="px-6 py-3 text-xs text-gray-500">{row.santri?.asrama}</td>
                                    <td className="px-6 py-3 text-xs italic text-gray-600 max-w-xs truncate">{row.detail_info}</td>
                                    <td className="px-6 py-3 text-xs text-gray-500">{row.admin?.full_name}</td>
                                    <td className="px-6 py-3 text-right">
                                        <button 
                                            onClick={() => handleDeleteRiwayat(row.id)}
                                            className="text-gray-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                                            title="Hapus Arsip"
                                        >
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
             )}
          </div>
      </div>

    </div>
  )
}

function MenuCard({ title, desc, icon: Icon, color, onClick }: any) {
  return (
    <div onClick={onClick} className={`${color} text-white p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-transform flex flex-col items-center text-center justify-center h-40`}>
       <Icon className="w-10 h-10 mb-3 opacity-80"/>
       <h3 className="font-bold text-lg">{title}</h3>
       <p className="text-xs opacity-80">{desc}</p>
    </div>
  )
}