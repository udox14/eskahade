'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cariSantri, cekTunggakanSantri, catatSuratKeluar, getRiwayatSurat, hapusRiwayatSurat } from './actions'
import { SuratView } from './surat-view'
import { useReactToPrint } from 'react-to-print'
import { Printer, Search, FileText, ArrowLeft, Loader2, History, Filter, Calendar, Trash2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Clock, Zap, FileJson, Mail, Scaling, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

export default function LayananSuratPage() {
  const confirm = useConfirm()
  
  // --- STATE GENERATOR ---
  const [step, setStep] = useState(1) 
  const [jenisSurat, setJenisSurat] = useState<'MONDOK' | 'IZIN' | 'BERHENTI' | 'TAGIHAN' | null>(null)
  const [search, setSearch] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [dataTambahan, setDataTambahan] = useState<any>({})
  const [dataTunggakan, setDataTunggakan] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  // --- STATE RIWAYAT ---
  const [riwayat, setRiwayat] = useState<any[]>([])
  const [filterBulan, setFilterBulan] = useState(new Date().getMonth() + 1)
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear())
  const [loadingRiwayat, setLoadingRiwayat] = useState(true)

  const printRef = useRef(null)
  
  const triggerPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Surat_${jenisSurat}_${selectedSantri?.nama_lengkap}`,
    onAfterPrint: () => {
        setIsPrinting(false)
        toast.success("Dokumen dikirim ke printer")
    }
  })

  useEffect(() => {
    loadRiwayat()
  }, [filterBulan, filterTahun])

  const loadRiwayat = async () => {
    setLoadingRiwayat(true)
    const res = await getRiwayatSurat(filterBulan, filterTahun)
    setRiwayat(res)
    setLoadingRiwayat(false)
  }

  const selectJenis = (jenis: any) => {
    setJenisSurat(jenis)
    setStep(2)
  }

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
       if (!tunggakan.adaTunggakan) toast.success("Santri ini LUNAS", { description: "Tidak ada tanggakan terdeteksi." })
    }
    if (jenisSurat === 'MONDOK' || jenisSurat === 'TAGIHAN') setStep(4) 
    else setStep(3) 
  }

  const handleInputTambahan = (e: React.FormEvent) => {
    e.preventDefault()
    setStep(4)
  }

  const handlePrintProcess = async () => {
    setIsPrinting(true)
    const info = jenisSurat === 'IZIN' ? dataTambahan.alasan :
                 jenisSurat === 'TAGIHAN' ? `Total Rp ${dataTunggakan?.total?.toLocaleString('id-ID')}` : 
                 jenisSurat === 'BERHENTI' ? "Pengunduran Diri" : "Keterangan Aktif"

    const res = await catatSuratKeluar(selectedSantri.id, jenisSurat!, info)
    if (res && 'error' in res) {
        toast.warning("Gagal mencatat riwayat", { description: "Proses cetak tetap dilanjutkan." })
    } else {
        loadRiwayat()
    }
    triggerPrint()
  }

  const handleDeleteRiwayat = async (id: string) => {
    if (!await confirm("Hapus catatan surat ini?")) return
    const toastId = toast.loading("Menghapus...")
    const res = await hapusRiwayatSurat(id)
    toast.dismiss(toastId)
    if (res && 'error' in res) toast.error("Gagal", { description: (res as any).error })
    else {
        toast.success("Berhasil dihapus")
        loadRiwayat()
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-24 animate-in fade-in duration-500">
       
       {/* HEADER */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
          <div className="flex items-center gap-4">
             {step > 1 ? (
               <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)} className="rounded-full h-12 w-12 hover:bg-muted">
                 <ArrowLeft className="w-6 h-6"/>
               </Button>
             ) : (
               <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-600 shadow-sm border border-purple-500/10">
                 <Mail className="w-6 h-6"/>
               </div>
             )}
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Layanan Surat Menyurat</h1>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Generator Surat Otomatis & Arsip Digital</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-muted/50 border p-1 rounded-2xl shadow-inner group print:hidden">
             <div className="px-5 py-2 flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full", step >= 1 ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" : "bg-muted")}/>
                <div className={cn("w-2 h-2 rounded-full", step >= 2 ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" : "bg-muted")}/>
                <div className={cn("w-2 h-2 rounded-full", step >= 3 ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" : "bg-muted")}/>
                <div className={cn("w-2 h-2 rounded-full", step >= 4 ? "bg-purple-500 shadow-[0_0_8_8px_rgba(168,85,247,0.5)]" : "bg-muted")}/>
             </div>
          </div>
       </div>

       {/* --- GENERATOR SECTION --- */}
       <div className="print:p-0 print:border-none">
          
          {/* STEP 1: PILIH JENIS */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500 print:hidden">
                <MenuCard title="Ket. Mondok" desc="Surat aktif santri" icon={CheckCircle2} color="indigo" onClick={() => selectJenis('MONDOK')} />
                <MenuCard title="Izin Pulang" desc="Izin jalan & perpulangan" icon={Scaling} color="purple" onClick={() => selectJenis('IZIN')} />
                <MenuCard title="Tagihan SPP" desc="Pemberitahuan tunggakan" icon={AlertCircle} color="orange" onClick={() => selectJenis('TAGIHAN')} />
                <MenuCard title="Pindah/Keluar" desc="Surat keterangan berhenti" icon={Trash2} color="rose" onClick={() => selectJenis('BERHENTI')} />
            </div>
          )}

          {/* STEP 2: CARI SANTRI */}
          {step === 2 && (
            <Card className="max-w-xl mx-auto border-border shadow-xl animate-in slide-in-from-right-8 duration-500 print:hidden overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                   <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <Search className="w-4 h-4 text-purple-600"/> Cari Data Santri
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <Input 
                           value={search} 
                           onChange={e=>setSearch(e.target.value)} 
                           placeholder="Ketik nama atau NIS..." 
                           className="h-11 rounded-xl bg-muted/20 border-border font-bold focus-visible:ring-purple-500 pl-4"
                        />
                        <Button disabled={loading} className="h-11 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20">
                           {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Search className="w-4 h-4"/>}
                        </Button>
                    </form>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {hasilCari.length === 0 && !loading && search.length > 0 && (
                          <div className="py-10 text-center opacity-40 italic text-[10px] font-bold uppercase">Data tidak ditemukan</div>
                        )}
                        {hasilCari.map(s => (
                            <button 
                               key={s.id} 
                               onClick={() => selectSantri(s)} 
                               className="w-full text-left p-4 border rounded-2xl hover:bg-purple-500/5 hover:border-purple-200 transition-all group flex items-center justify-between"
                            >
                                <div>
                                   <p className="font-black text-foreground group-hover:text-purple-700 transition-colors uppercase tracking-tight">{s.nama_lengkap}</p>
                                   <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60 mt-0.5 tracking-widest">{s.asrama} · Kamar {s.kamar}</p>
                                </div>
                                <Zap className="w-4 h-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-all"/>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>
          )}

          {/* STEP 3: INPUT TAMBAHAN */}
          {step === 3 && (
            <Card className="max-w-xl mx-auto border-border shadow-xl animate-in slide-in-from-right-8 duration-500 print:hidden overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                   <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-purple-600"/> Lengkapi Detail Surat
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <form onSubmit={handleInputTambahan} className="space-y-6">
                        {jenisSurat === 'IZIN' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                       <Label className="text-[10px] font-black uppercase tracking-widest px-1">Mulai Perizinan</Label>
                                       <Input type="date" required onChange={e=>setDataTambahan({...dataTambahan, tglMulai: e.target.value})} className="h-11 rounded-xl bg-muted/20 border-border font-bold text-xs"/>
                                    </div>
                                    <div className="space-y-2">
                                       <Label className="text-[10px] font-black uppercase tracking-widest px-1">Target Kembali</Label>
                                       <Input type="date" required onChange={e=>setDataTambahan({...dataTambahan, tglSelesai: e.target.value})} className="h-11 rounded-xl bg-muted/20 border-border font-bold text-xs"/>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black uppercase tracking-widest px-1">Keperluan / Alasan</Label>
                                   <Textarea required onChange={e=>setDataTambahan({...dataTambahan, alasan: e.target.value})} className="rounded-xl bg-muted/20 border-border font-bold text-sm min-h-[100px]" placeholder="Sebutkan keperluan secara mendetail..."/>
                                </div>
                            </>
                        )}
                        {jenisSurat === 'BERHENTI' && (
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest px-1">Alasan Berhenti</Label>
                              <Textarea required onChange={e=>setDataTambahan({...dataTambahan, alasan: e.target.value})} className="rounded-xl bg-muted/20 border-border font-bold text-sm min-h-[100px]" placeholder="Alasan pengunduran diri..."/>
                           </div>
                        )}
                        <Button type="submit" className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-lg shadow-purple-600/20 gap-2">
                           Lanjut ke Preview <ChevronRight className="w-4 h-4"/>
                        </Button>
                    </form>
                </CardContent>
            </Card>
          )}

          {/* STEP 4: PREVIEW */}
          {step === 4 && (
            <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
                <div className="flex gap-4 print:hidden px-4 py-2 bg-muted/30 border rounded-3xl shadow-inner backdrop-blur-sm">
                    <Button variant="ghost" onClick={() => setStep(1)} disabled={isPrinting} className="h-11 rounded-2xl font-black text-xs uppercase text-muted-foreground hover:text-rose-600">
                       <X className="w-4 h-4 mr-2"/> Batal
                    </Button>
                    <Separator orientation="vertical" className="h-11"/>
                    <Button onClick={handlePrintProcess} disabled={isPrinting} className="h-11 px-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 gap-3">
                        {isPrinting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4"/>} Cetak & Simpan Digital
                    </Button>
                </div>
                
                <div className="bg-slate-200 p-4 md:p-12 border rounded-[40px] shadow-inner overflow-auto max-w-full flex justify-center print:p-0 print:bg-white print:border-none print:w-full print:overflow-visible">
                    <div ref={printRef} className="bg-white shadow-2xl print:shadow-none print:w-full min-w-[21cm] transform-gpu">
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

       {/* --- HISTORY SECTION --- */}
       <div className="space-y-6 pt-12 border-t border-border/60 print:hidden animate-in slide-in-from-bottom-8 duration-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                 <div className="p-2.5 bg-orange-500/10 rounded-xl text-orange-600 border border-orange-500/10">
                    <History className="w-5 h-5"/>
                 </div>
                 <div>
                    <h2 className="text-lg font-black text-foreground tracking-tight uppercase">Agenda Surat Keluar</h2>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Arsip digital surat yang pernah diterbitkan</p>
                 </div>
              </div>
              
              <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-2xl border">
                  <Select value={String(filterBulan)} onValueChange={v => setFilterBulan(Number(v))}>
                    <SelectTrigger className="h-10 w-36 bg-background border-border rounded-xl font-bold text-xs focus:ring-orange-500">
                       <SelectValue placeholder="Bulan"/>
                    </SelectTrigger>
                    <SelectContent>
                       {BULAN_LIST.map((b, i) => <SelectItem key={i} value={String(i+1)} className="font-bold">{b}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={String(filterTahun)} onValueChange={v => setFilterTahun(Number(v))}>
                    <SelectTrigger className="h-10 w-24 bg-background border-border rounded-xl font-bold text-xs focus:ring-orange-500">
                       <SelectValue placeholder="Tahun"/>
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="2024" className="font-bold">2024</SelectItem>
                       <SelectItem value="2025" className="font-bold">2025</SelectItem>
                       <SelectItem value="2026" className="font-bold">2026</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
          </div>

          <Card className="border-border shadow-sm overflow-hidden">
             {loadingRiwayat ? (
                 <div className="py-24 flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-orange-500 opacity-50"/>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Loading archives...</p>
                 </div>
             ) : riwayat.length === 0 ? (
                 <div className="py-24 text-center">
                    <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground/10"/>
                    <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Belum ada arsip surat untuk periode ini</p>
                 </div>
             ) : (
                 <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Tanggal / Sesi</TableHead>
                                <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Jenis Surat</TableHead>
                                <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Atas Nama Santri</TableHead>
                                <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Informasi / Detail</TableHead>
                                <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Admin</TableHead>
                                <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {riwayat.map((row) => (
                                <tr key={row.id} className="hover:bg-orange-500/5 transition-colors group">
                                    <td className="px-6 py-4">
                                       <div className="text-[10px] font-black text-foreground tabular-nums opacity-80 uppercase leading-none mb-1">
                                          {format(new Date(row.created_at), 'dd MMM yyyy', {locale:id})}
                                       </div>
                                       <div className="text-[9px] font-black text-muted-foreground opacity-40 uppercase tabular-nums">
                                          {format(new Date(row.created_at), 'HH:mm')} WIB
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge className={cn(
                                            "font-black text-[9px] uppercase px-2 py-0.5 rounded-lg shadow-none border-0",
                                            row.jenis_surat === 'IZIN' ? 'bg-purple-500/10 text-purple-700' :
                                            row.jenis_surat === 'TAGIHAN' ? 'bg-orange-500/10 text-orange-700' :
                                            'bg-blue-500/10 text-blue-700'
                                        )}>
                                            {row.jenis_surat}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                       <p className="font-black text-foreground text-sm tracking-tight">{row.santri?.nama_lengkap}</p>
                                       <p className="text-[10px] font-black text-muted-foreground uppercase opacity-50 italic">{row.santri?.asrama}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                       <p className="text-[10px] font-bold text-muted-foreground max-w-[200px] line-clamp-2 uppercase leading-relaxed">{row.detail_info}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-black text-[9px] text-muted-foreground opacity-60 uppercase">
                                             {row.admin?.full_name?.charAt(0) || 'A'}
                                          </div>
                                          <span className="text-[10px] font-black text-muted-foreground uppercase opacity-70">{row.admin?.full_name?.split(' ')[0]}</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            onClick={() => handleDeleteRiwayat(row.id)}
                                            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4"/>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
             )}
          </Card>
       </div>

    </div>
  )
}

function MenuCard({ title, desc, icon: Icon, color, onClick }: any) {
  const variants: any = {
      blue: "bg-blue-600 shadow-blue-600/20",
      indigo: "bg-indigo-600 shadow-indigo-600/20",
      purple: "bg-purple-600 shadow-purple-600/20",
      orange: "bg-orange-500 shadow-orange-500/20",
      rose: "bg-rose-600 shadow-rose-600/20"
  }
  const c = variants[color] || variants.blue
  
  return (
    <Card 
       onClick={onClick} 
       className={cn(
         "group cursor-pointer relative overflow-hidden h-40 border-0 shadow-lg text-white transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl active:scale-95",
         c
       )}
    >
       <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000"/>
       <CardContent className="p-6 flex flex-col items-center text-center justify-center h-full relative z-10">
          <Icon className="w-10 h-10 mb-4 opacity-70 group-hover:scale-110 group-hover:opacity-100 transition-all duration-500"/>
          <h3 className="font-black text-base uppercase tracking-tight">{title}</h3>
          <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest mt-1">{desc}</p>
       </CardContent>
    </Card>
  )
}