'use client'

import { useState } from 'react'
import { User, MapPin, Calendar, School, Home, BookOpen, AlertTriangle, Clock, CreditCard, Wallet, Trophy, CheckCircle, XCircle, AlertCircle, Users, Utensils, Shirt } from 'lucide-react'
import { format, isValid } from 'date-fns'
import { id } from 'date-fns/locale'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// ── Helper: format tanggal aman, tidak crash jika null/invalid ────────────────
function safeFormat(value: string | null | undefined, fmt: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (!isValid(date)) return '-'
  try {
    return format(date, fmt, { locale: id })
  } catch {
    return '-'
  }
}

export function SantriProfileView({ 
  santri, 
  akademik, 
  pelanggaran, 
  perizinan, 
  spp, 
  tabungan 
}: any) {
  const [activeTab, setActiveTab] = useState<'PROFIL' | 'AKADEMIK' | 'KEUANGAN' | 'DISIPLIN'>('PROFIL')

  return (
    <div className="space-y-6">
      
      {/* 1. KARTU IDENTITAS UTAMA */}
      <Card className="rounded-2xl shadow-sm overflow-hidden relative border-border">
         <div className="h-32 bg-gradient-to-r from-emerald-500 to-emerald-800 dark:from-emerald-900 dark:to-emerald-950"></div>
         <div className="px-5 sm:px-8 pb-5 sm:pb-8">
            <div className="flex flex-col md:flex-row gap-5 sm:gap-6 items-start -mt-12 sm:-mt-16">
               
               {/* FOTO PROFIL */}
               <div className="w-28 h-36 sm:w-32 sm:h-40 md:w-40 md:h-52 rounded-xl border-4 border-background shadow-lg bg-muted overflow-hidden flex-shrink-0 relative">
                  {santri.foto_url ? (
                    <img src={santri.foto_url} alt={santri.nama_lengkap} className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted/50"><User className="w-12 h-12 md:w-16 md:h-16 opacity-50"/></div>
                  )}
               </div>

               {/* INFO NAMA */}
               <div className="flex-1 pt-2 md:pt-16">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">{santri.nama_lengkap}</h2>
                  <div className="flex flex-wrap gap-2 sm:gap-3 mt-3 text-sm">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 font-mono font-bold">NIS: {santri.nis}</Badge>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">{santri.info_kelas}</Badge>
                      <Badge variant="outline" className="bg-muted/50 text-muted-foreground font-medium">{santri.asrama} - {santri.kamar}</Badge>
                  </div>
               </div>
            </div>
         </div>
      </Card>

      {/* 2. KONTEN TABS */}
      <Tabs defaultValue="PROFIL" value={activeTab} onValueChange={(val: string) => setActiveTab(val as any)} className="w-full">
         <div className="overflow-x-auto pb-2 scrollbar-none">
           <TabsList className="h-auto p-1 bg-muted/50 inline-flex w-max min-w-full justify-start rounded-xl gap-1">
              <TabsTrigger value="PROFIL" className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"><User className="w-4 h-4"/> Biodata Lengkap</TabsTrigger>
              <TabsTrigger value="AKADEMIK" className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"><BookOpen className="w-4 h-4"/> Akademik</TabsTrigger>
              <TabsTrigger value="KEUANGAN" className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"><CreditCard className="w-4 h-4"/> Keuangan</TabsTrigger>
              <TabsTrigger value="DISIPLIN" className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"><AlertTriangle className="w-4 h-4"/> Kedisiplinan</TabsTrigger>
           </TabsList>
         </div>

         {/* --- TAB PROFIL (LENGKAP) --- */}
         <TabsContent value="PROFIL" className="mt-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
              
              {/* KOLOM 1: DATA PRIBADI */}
              <Card className="shadow-sm">
                 <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                    <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                      <User className="w-5 h-5 text-blue-600 dark:text-blue-400"/> Informasi Pribadi
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6 space-y-5">
                    <div className="space-y-4 text-sm">
                      <InfoRow label="NIS (Nomor Induk Santri)" value={santri.nis} isMono />
                      <InfoRow label="NIK" value={santri.nik} isMono />
                      <InfoRow label="Nama Lengkap" value={santri.nama_lengkap} isBold />
                      <InfoRow label="Jenis Kelamin" value={santri.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                      <InfoRow 
                          label="Tempat, Tanggal Lahir" 
                          value={`${santri.tempat_lahir || '-'}, ${safeFormat(santri.tanggal_lahir, 'dd MMMM yyyy')}`} 
                      />
                      <InfoRow label="Golongan Darah" value={santri.gol_darah} />
                      <InfoRow 
                          label="Status Santri" 
                          value={
                              <Badge variant={santri.status_global === 'aktif' ? 'default' : 'destructive'} className="text-[10px] uppercase tracking-wider py-0 px-2 h-5">
                                  {santri.status_global}
                              </Badge>
                          } 
                          isCustom 
                      />
                      <InfoRow label="Tanggal Masuk" value={safeFormat(santri.tanggal_masuk, 'dd MMMM yyyy')} />
                      {santri.tanggal_keluar && (
                        <InfoRow label="Tanggal Keluar" value={safeFormat(santri.tanggal_keluar, 'dd MMMM yyyy')} />
                      )}
                    </div>

                    {/* ALAMAT */}
                    <div className="pt-2 border-t border-border/50 space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/> Alamat</p>
                      {santri.alamat_lengkap ? (
                        <div>
                          <p className="text-xs text-muted-foreground/80 mb-1">Alamat Lengkap</p>
                          <p className="text-sm text-foreground bg-muted/40 p-3 rounded-lg border border-border/50 leading-relaxed font-medium">{santri.alamat_lengkap}</p>
                        </div>
                      ) : santri.alamat ? (
                        <p className="text-sm text-foreground bg-muted/40 p-3 rounded-lg border border-border/50 leading-relaxed font-medium">{santri.alamat}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Alamat belum diisi.</p>
                      )}
                      {(santri.kecamatan || santri.kab_kota || santri.provinsi) && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-muted/30 p-2 rounded-lg border border-border/40 text-center">
                            <p className="text-muted-foreground uppercase font-bold mb-0.5 text-[10px] tracking-wider">Kecamatan</p>
                            <p className="text-foreground font-medium">{santri.kecamatan || '-'}</p>
                          </div>
                          <div className="bg-muted/30 p-2 rounded-lg border border-border/40 text-center">
                            <p className="text-muted-foreground uppercase font-bold mb-0.5 text-[10px] tracking-wider">Kab/Kota</p>
                            <p className="text-foreground font-medium">{santri.kab_kota || '-'}</p>
                          </div>
                          <div className="bg-muted/30 p-2 rounded-lg border border-border/40 text-center">
                            <p className="text-muted-foreground uppercase font-bold mb-0.5 text-[10px] tracking-wider">Provinsi</p>
                            <p className="text-foreground font-medium">{santri.provinsi || '-'}</p>
                          </div>
                        </div>
                      )}
                      {santri.jemaah && <InfoRow label="Jemaah" value={santri.jemaah} />}
                    </div>
                 </CardContent>
              </Card>

              {/* KOLOM 2: KELUARGA & PONDOK */}
              <Card className="shadow-sm">
                 <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                    <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                      <School className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/> Keluarga & Institusi
                    </CardTitle>
                 </CardHeader>
                 
                 <CardContent className="p-6 space-y-4">
                    <div className="bg-orange-500/5 p-4 rounded-xl border border-orange-500/10 space-y-3 dark:bg-orange-950/20">
                       <p className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider flex items-center gap-2"><Users className="w-4 h-4"/> Data Orang Tua</p>
                       <InfoRow label="Nama Ayah" value={santri.nama_ayah} />
                       <InfoRow label="Nama Ibu" value={santri.nama_ibu} />
                    </div>

                    <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/10 space-y-3 dark:bg-blue-950/20">
                       <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2"><School className="w-4 h-4"/> Pendidikan Formal</p>
                       <InfoRow label="Sekolah" value={santri.sekolah} />
                       <InfoRow label="Kelas Sekolah" value={santri.kelas_sekolah} />
                    </div>

                    <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 space-y-3 dark:bg-emerald-950/20">
                       <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2"><Home className="w-4 h-4"/> Data Pondok</p>
                       <InfoRow label="Asrama" value={santri.asrama} />
                       <InfoRow label="Kamar" value={santri.kamar} />
                       <InfoRow label="Kelas Diniyah" value={santri.info_kelas} isBold />
                       
                       <div className="pt-3 mt-1 border-t border-emerald-500/10 dark:border-emerald-500/20 space-y-3">
                           <InfoRow 
                               label={<span className="flex items-center gap-1.5"><Utensils className="w-3.5 h-3.5"/> Tempat Makan</span>} 
                               value={santri.nama_tempat_makan || 'Belum diatur'} 
                           />
                           <InfoRow 
                               label={<span className="flex items-center gap-1.5"><Shirt className="w-3.5 h-3.5"/> Tempat Cuci</span>} 
                               value={santri.nama_tempat_mencuci || 'Belum diatur'} 
                           />
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>
         </TabsContent>

         {/* --- TAB AKADEMIK --- */}
         <TabsContent value="AKADEMIK" className="mt-4">
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              {akademik.length === 0 ? <EmptyState text="Belum ada riwayat pendidikan."/> : akademik.map((riwayat: any) => (
                <Card key={riwayat.id} className="shadow-sm overflow-hidden border-border bg-card">
                   <div className="bg-blue-500/5 dark:bg-blue-900/10 p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                         <h3 className="font-bold text-foreground text-lg">{riwayat.kelas?.nama_kelas}</h3>
                         <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{riwayat.kelas?.marhalah?.nama} • {riwayat.kelas?.tahun_ajaran?.nama || 'Tahun Ajar Aktif'}</p>
                      </div>
                      {riwayat.ranking?.[0] && (
                        <div className="text-right bg-background px-3 py-1.5 rounded-lg border border-border/60 shadow-sm shrink-0">
                           <span className="text-sm font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5"><Trophy className="w-4 h-4"/> Peringkat {riwayat.ranking[0].ranking_kelas}</span>
                           <span className="text-xs text-muted-foreground mt-0.5 block">Nilai Rata-rata: {riwayat.ranking[0].rata_rata}</span>
                        </div>
                      )}
                   </div>
                   
                   {/* Tabel Nilai */}
                   {riwayat.nilai_detail.length > 0 ? (
                     <div className="overflow-x-auto w-full">
                       <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="w-[60%] pl-6">Mata Pelajaran</TableHead>
                              <TableHead className="text-center min-w-[100px]">Semester 1</TableHead>
                              <TableHead className="text-center min-w-[100px]">Semester 2</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                             {Array.from(new Set(riwayat.nilai_detail.map((n:any) => n.mapel_nama))).map((mapelNama: any) => {
                                 const s1 = riwayat.nilai_detail.find((n:any) => n.mapel_nama === mapelNama && n.semester === 1)?.nilai
                                 const s2 = riwayat.nilai_detail.find((n:any) => n.mapel_nama === mapelNama && n.semester === 2)?.nilai
                                 return (
                                   <TableRow key={mapelNama}>
                                       <TableCell className="pl-6 font-medium text-foreground">{mapelNama}</TableCell>
                                       <TableCell className="text-center font-mono opacity-80">{s1 ?? '-'}</TableCell>
                                       <TableCell className="text-center font-mono opacity-80">{s2 ?? '-'}</TableCell>
                                   </TableRow>
                                 )
                             })}
                          </TableBody>
                       </Table>
                     </div>
                   ) : <div className="p-10 text-center text-muted-foreground text-sm italic w-full border-t border-dashed">Belum ada data nilai di kelas ini.</div>}
                </Card>
              ))}
           </div>
         </TabsContent>

         {/* --- TAB KEUANGAN --- */}
         <TabsContent value="KEUANGAN" className="mt-4">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
              {/* SPP */}
              <Card className="shadow-sm overflow-hidden h-fit">
                 <div className="bg-emerald-500/5 dark:bg-emerald-900/10 p-4 border-b flex justify-between items-center">
                     <h3 className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2"><CreditCard className="w-5 h-5"/> Riwayat SPP</h3>
                     <Badge variant="outline" className="text-[10px] bg-background text-emerald-600 dark:text-emerald-400 border-emerald-500/20">{spp.length} Transaksi</Badge>
                 </div>
                 <div className="max-h-96 overflow-y-auto">
                   {spp.length === 0 ? <EmptyState text="Belum ada pembayaran SPP."/> : (
                     <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead>Periode</TableHead>
                            <TableHead className="text-right">Nominal</TableHead>
                            <TableHead className="text-right">Tanggal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                           {spp.map((s:any) => (
                              <TableRow key={s.id}>
                                 <TableCell className="font-medium text-foreground">{s.bulan}/{s.tahun}</TableCell>
                                 <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">Rp {Number(s.nominal_bayar || 0).toLocaleString()}</TableCell>
                                 <TableCell className="text-right text-xs text-muted-foreground">{safeFormat(s.tanggal_bayar, 'dd/MM/yy')}</TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                   )}
                 </div>
              </Card>

              {/* TABUNGAN */}
              <Card className="shadow-sm overflow-hidden h-fit">
                 <div className="bg-orange-500/5 dark:bg-orange-900/10 p-4 border-b flex justify-between items-center">
                     <h3 className="font-bold text-orange-800 dark:text-orange-400 flex items-center gap-2"><Wallet className="w-5 h-5"/> Mutasi Tabungan</h3>
                     <Badge variant="outline" className="text-[10px] bg-background text-orange-600 dark:text-orange-400 border-orange-500/20">{tabungan.length} Mutasi</Badge>
                 </div>
                 <div className="max-h-96 overflow-y-auto">
                   {tabungan.length === 0 ? <EmptyState text="Belum ada transaksi tabungan."/> : (
                     <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead>Keterangan</TableHead>
                            <TableHead className="text-right">Nominal</TableHead>
                            <TableHead className="text-right">Tanggal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                           {tabungan.map((t:any) => (
                              <TableRow key={t.id}>
                                 <TableCell className="flex items-center gap-2 sm:gap-3 py-3">
                                    {t.jenis==='MASUK'?<CheckCircle className="w-4 h-4 text-green-500 shrink-0"/>:<XCircle className="w-4 h-4 text-red-500 shrink-0"/>}
                                    <span className="truncate max-w-[120px] sm:max-w-[200px]" title={t.keterangan}>{t.keterangan}</span>
                                 </TableCell>
                                 <TableCell className={`text-right font-mono font-bold whitespace-nowrap ${t.jenis==='MASUK'?'text-green-600 dark:text-green-400':'text-red-600 dark:text-red-400'}`}>
                                    {t.jenis==='MASUK'?'+':'-'} {Number(t.nominal || 0).toLocaleString()}
                                 </TableCell>
                                 <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">{safeFormat(t.created_at, 'dd/MM/yy')}</TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                   )}
                 </div>
              </Card>
           </div>
         </TabsContent>

         {/* --- TAB DISIPLIN --- */}
         <TabsContent value="DISIPLIN" className="mt-4">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
              {/* PERIZINAN */}
              <Card className="shadow-sm overflow-hidden h-fit">
                 <div className="bg-purple-500/5 dark:bg-purple-900/10 p-4 border-b">
                   <h3 className="font-bold text-purple-800 dark:text-purple-400 flex items-center gap-2"><Clock className="w-5 h-5"/> Riwayat Izin</h3>
                 </div>
                 <div className="divide-y divide-border/60 max-h-[500px] overflow-y-auto">
                    {perizinan.length===0?<EmptyState text="Belum ada riwayat izin."/>:perizinan.map((p:any)=>(
                       <div key={p.id} className="p-4 sm:p-5 hover:bg-muted/30 transition-colors">
                          <div className="flex justify-between items-center mb-2.5">
                             <Badge variant={p.status==='KEMBALI' ? 'outline' : 'secondary'} className={`text-[10px] uppercase tracking-wider py-0 px-2 h-5 ${p.status==='KEMBALI'?'text-emerald-600 border-emerald-500/30 bg-emerald-500/5':'text-amber-600 border-amber-500/30 bg-amber-500/5'}`}>
                               {p.status}
                             </Badge>
                             <span className="text-xs text-muted-foreground font-medium">{safeFormat(p.created_at, 'dd MMM yyyy')}</span>
                          </div>
                          <p className="font-medium text-foreground text-sm mb-1.5 leading-snug">{p.alasan}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> {p.jenis}</p>
                       </div>
                    ))}
                 </div>
              </Card>
              
              {/* PELANGGARAN */}
              <Card className="shadow-sm overflow-hidden h-fit">
                 <div className="bg-red-500/5 dark:bg-red-900/10 p-4 border-b">
                   <h3 className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Riwayat Pelanggaran</h3>
                 </div>
                 <div className="divide-y divide-border/60 max-h-[500px] overflow-y-auto">
                    {pelanggaran.length===0?<EmptyState text="Alhamdulillah, nihil pelanggaran. Pertahankan prestasimu!"/>:pelanggaran.map((p:any)=>(
                       <div key={p.id} className="p-4 sm:p-5 hover:bg-muted/30 transition-colors">
                          <div className="flex justify-between items-center mb-2.5">
                             <Badge variant="destructive" className="font-bold text-[10px] py-0 h-5">+{p.poin} Poin</Badge>
                             <span className="text-xs text-muted-foreground font-medium">{safeFormat(p.tanggal, 'dd MMM yyyy')}</span>
                          </div>
                          <p className="font-medium text-foreground text-sm mb-1.5 leading-snug">{p.deskripsi}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 opacity-70"/> {p.jenis}</p>
                       </div>
                    ))}
                 </div>
              </Card>
           </div>
         </TabsContent>

      </Tabs>
      
    </div>
  )
}

function InfoRow({ label, value, isBold, isMono, isCustom }: any) {
    if (isCustom) {
        return <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2.5 border-b border-border/40 last:border-0 gap-1 sm:gap-4"><span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider min-w-[35%] shrink-0">{label}</span><div>{value}</div></div>
    }
    return <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start py-2.5 border-b border-border/40 last:border-0 gap-1 sm:gap-4"><span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider min-w-[35%] shrink-0 pt-0.5">{label}</span><span className={`text-sm text-foreground sm:text-right ${isBold ? 'font-bold' : 'font-medium'} ${isMono ? 'font-mono' : ''}`}>{value || '-'}</span></div>
}

function EmptyState({ text }: any) {
    return <div className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground italic text-sm border-2 border-dashed border-border/40 rounded-xl m-4 bg-muted/10 gap-2"><Clock className="w-8 h-8 opacity-20"/> {text}</div>
}