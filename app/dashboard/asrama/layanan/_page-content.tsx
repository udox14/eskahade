"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Search, Filter, Save, Utensils, Shirt, Settings, X, Plus, Trash2, CheckCircle2, Download, UploadCloud, FileSpreadsheet, Lock, Home } from "lucide-react";
import { 
    getDaftarAsrama, 
    getDaftarKamar, 
    getMasterJasa, 
    getSantriLayanan, 
    simpanBatchLayanan, 
    tambahMasterJasa,
    tambahMasterJasaBatch, 
    hapusMasterJasa,
    getClientRestriction
} from "./actions";
import { useConfirm } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export default function LayananAsramaPage() {
  const confirm = useConfirm()
    // --- STATE FILTER ---
    const [asramaList, setAsramaList] = useState<string[]>([]);
    const [kamarList, setKamarList] = useState<string[]>([]);
    const [restrictedAsrama, setRestrictedAsrama] = useState<string | null>(null);
    const [selectedAsrama, setSelectedAsrama] = useState<string>("");
    const [selectedKamar, setSelectedKamar] = useState<string>("");
    const [belumDitempatkan, setBelumDitempatkan] = useState<boolean>(false);

    // --- STATE MASTER JASA ---
    const [masterJasa, setMasterJasa] = useState<any[]>([]);
    const [showModalJasa, setShowModalJasa] = useState(false);
    
    // Formulir Cepat
    const [inputNamaJasa, setInputNamaJasa] = useState("");
    const [inputJenisJasa, setInputJenisJasa] = useState("Makan");
    const [isSubmittingJasa, setIsSubmittingJasa] = useState(false);

    // Import File Excel
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // --- STATE DATA SANTRI (LAZY LOAD) ---
    const [santriData, setSantriData] = useState<any[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);

    // --- STATE BATCH EDITS ---
    const [pendingChanges, setPendingChanges] = useState<Record<string, { tempat_makan_id?: string | null, tempat_mencuci_id?: string | null }>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [toastMsg, setToastMsg] = useState("");

    // 1. Initial Load
    useEffect(() => {
        getDaftarAsrama().then(list => {
            setAsramaList(list);
            // Kalau hanya 1 asrama (pengurus_asrama) → langsung set
            if (list.length === 1) setSelectedAsrama(list[0]);
        }).catch(console.error);
        getMasterJasa().then(setMasterJasa).catch(console.error);
        // Cek restriction
        getClientRestriction().then(r => {
            if (r) {
               setRestrictedAsrama(r);
               setSelectedAsrama(r);
            }
        }).catch(console.error);
    }, []);

    // 2. Refresh Kamar jika Asrama Berubah
    useEffect(() => {
        if (selectedAsrama) {
            getDaftarKamar(selectedAsrama).then(setKamarList).catch(console.error);
            setSelectedKamar("");
            resetAndFetch(0);
        } else {
            setSantriData([]);
            setKamarList([]);
        }
    }, [selectedAsrama]);

    // 3. Reset & Fetch data
    useEffect(() => {
        if (selectedAsrama) resetAndFetch(0);
    }, [selectedKamar, belumDitempatkan]);

    const resetAndFetch = async (newPage: number) => {
        setIsLoading(true);
        try {
            const limit = 20;
            const res = await getSantriLayanan({
                asrama: selectedAsrama,
                kamar: selectedKamar,
                belumDitempatkan,
                page: newPage,
                limit
            });

            if (newPage === 0) {
                setSantriData(res.data || []);
            } else {
                setSantriData(prev => [...prev, ...(res.data || [])]);
            }
            
            setHasMore((res.data?.length || 0) === limit);
            setPage(newPage);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. Lazy Load Observer
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading && selectedAsrama) {
                resetAndFetch(page + 1);
            }
        }, { threshold: 0.1 });

        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [hasMore, isLoading, selectedAsrama, page]);

    // --- HANDLERS ---
    const handleSelectChange = (santriId: string, type: 'tempat_makan_id' | 'tempat_mencuci_id', value: string | null) => {
        setPendingChanges(prev => {
            const updated = { ...prev };
            if (!updated[santriId]) updated[santriId] = {};
            updated[santriId][type] = (value === "null" || value === null) ? null : value;
            return updated;
        });
    };

    const handleSimpanBatch = async () => {
        setIsSaving(true);
        try {
            await simpanBatchLayanan(pendingChanges);
            setToastMsg(`${Object.keys(pendingChanges).length} data berhasil disimpan!`);
            setPendingChanges({});
            setTimeout(() => setToastMsg(""), 3000);
            
            const updatedData = santriData.map(s => {
                if(pendingChanges[s.id]) return { ...s, ...pendingChanges[s.id] };
                return s;
            });
            setSantriData(updatedData);
        } catch (error) {
            toast.error("Gagal menyimpan data.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleTambahCepat = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!inputNamaJasa.trim()) return;
        setIsSubmittingJasa(true);
        try {
            await tambahMasterJasa(inputNamaJasa, inputJenisJasa);
            const freshMaster = await getMasterJasa();
            setMasterJasa(freshMaster);
            setInputNamaJasa("");
            setToastMsg("Berhasil ditambahkan.");
            setTimeout(() => setToastMsg(""), 3000);
        } catch (e) {
            toast.error("Gagal menambahkan data.");
        } finally {
            setIsSubmittingJasa(false);
        }
    };

    // Download Template Excel Asli
    const downloadTemplateExcel = async () => {
        try {
            const XLSX = await import('xlsx');
            
            // Data sampel
            const dataTemplate = [
                { "Nama Penyedia Jasa": "Bu Yayat", "Jenis Layanan (Makan/Cuci)": "Makan" },
                { "Nama Penyedia Jasa": "Laundry Berkah", "Jenis Layanan (Makan/Cuci)": "Cuci" },
                { "Nama Penyedia Jasa": "Kantin Utama", "Jenis Layanan (Makan/Cuci)": "Makan" }
            ];

            const ws = XLSX.utils.json_to_sheet(dataTemplate);
            ws['!cols'] = [{ wch: 25 }, { wch: 25 }];
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Template Penyedia");
            
            XLSX.writeFile(wb, "Template_Penyedia_Jasa.xlsx");
        } catch (error) {
            toast.error("Gagal membuat template Excel.");
            console.error(error);
        }
    };

    // Parse Excel File dari Upload
    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const XLSX = await import('xlsx');
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

            // Transformasi hasil Excel ke array yang diharapkan server
            const dataBatch: { nama_jasa: string, jenis: string }[] = [];
            
            jsonData.forEach(row => {
                const values = Object.values(row);
                if(values.length > 0) {
                    const nama = String(values[0]).trim();
                    let jenis = 'Makan'; // default
                    
                    if (values.length > 1) {
                        const j = String(values[1]).trim().toLowerCase();
                        if (j.includes('cuci') || j.includes('laundry')) jenis = 'Cuci';
                    }
                    
                    if(nama) dataBatch.push({ nama_jasa: nama, jenis });
                }
            });

            if (dataBatch.length === 0) throw new Error("File kosong atau format salah");

            await tambahMasterJasaBatch(dataBatch);
            const freshMaster = await getMasterJasa();
            setMasterJasa(freshMaster);
            
            setToastMsg(`${dataBatch.length} Jasa berhasil diimpor.`);
            setTimeout(() => setToastMsg(""), 4000);
        } catch (error) {
            console.error(error);
            toast.error("Gagal memproses data Excel. Pastikan format sesuai template.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleHapusJasa = async (id: string) => {
        if(!await confirm("Yakin hapus penyedia jasa ini?")) return;
        try {
            await hapusMasterJasa(id);
            const freshMaster = await getMasterJasa();
            setMasterJasa(freshMaster);
        } catch (e) {
            toast.error("Gagal menghapus jasa", { description: "Mungkin data ini masih digunakan oleh santri." });
        }
    };

    const getDisplayValue = (santriId: string, type: 'tempat_makan_id' | 'tempat_mencuci_id', originalValue: string | null | undefined) => {
        if (pendingChanges[santriId] && pendingChanges[santriId][type] !== undefined) {
            return pendingChanges[santriId][type] === null ? "null" : pendingChanges[santriId][type] as string;
        }
        return (originalValue as string) || "null";
    };

    const totalChanges = Object.keys(pendingChanges).length;
    const jasaMakan = masterJasa.filter(m => m.jenis === 'Makan');
    const jasaCuci = masterJasa.filter(m => m.jenis === 'Cuci');

    return (
        <div className="p-0 sm:p-4 max-w-6xl mx-auto space-y-6 pb-28 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 sm:px-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                          <Utensils className="w-6 h-6" />
                        </div>
                        Katering & Laundry
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Pemetaan tempat makan dan mencuci santri (Batch Mode).</p>
                </div>
                <Button 
                    onClick={() => setShowModalJasa(true)}
                    className="flex items-center gap-2 shadow-sm rounded-xl h-11"
                >
                    <Settings className="w-4 h-4" />
                    <span className="font-bold">Penyedia Jasa</span>
                </Button>
            </div>

            {/* Filter Section */}
            <Card className="mx-4 sm:mx-0 shadow-sm border-border bg-card">
                <CardContent className="p-4 sm:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                               {restrictedAsrama ? <Lock className="w-3 h-3 text-emerald-500"/> : <Home className="w-3 h-3 text-muted-foreground"/>}
                               Asrama
                            </label>
                            <Select 
                                value={selectedAsrama} 
                                onValueChange={(val) => { if (val) setSelectedAsrama(val) }}
                                disabled={!!restrictedAsrama}
                            >
                               <SelectTrigger className="w-full h-11 rounded-xl bg-background border-border shadow-sm font-bold">
                                  <SelectValue placeholder="-- Pilih Asrama --" />
                               </SelectTrigger>
                               <SelectContent>
                                  {asramaList.map(a => <SelectItem key={a} value={a} className="font-bold">{a}</SelectItem>)}
                               </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Kamar (Opsional)</label>
                            <Select 
                                value={selectedKamar} 
                                onValueChange={(val) => { if (val) setSelectedKamar(val === "null" ? "" : val) }}
                                disabled={!selectedAsrama}
                            >
                               <SelectTrigger className="w-full h-11 rounded-xl bg-background border-border shadow-sm font-bold">
                                  <SelectValue placeholder="-- Semua Kamar --" />
                               </SelectTrigger>
                               <SelectContent>
                                  {/* Allow empty selection by providing a clear option or just empty value */}
                                  <SelectItem value="null" className="text-muted-foreground italic">Semua Kamar</SelectItem>
                                  {kamarList.map(k => <SelectItem key={k} value={k} className="font-bold">Kamar {k}</SelectItem>)}
                               </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end pb-1 w-full md:w-auto">
                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-muted/40 hover:bg-muted/60 transition-colors rounded-xl border border-border/50 w-full select-none">
                                <Checkbox 
                                  checked={belumDitempatkan} 
                                  onCheckedChange={(c) => setBelumDitempatkan(c as boolean)}
                                  className="w-5 h-5 rounded data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white"
                                />
                                <span className="text-sm font-bold text-foreground">Tampilkan yang belum ditempatkan</span>
                            </label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Content List */}
            <div className="px-4 sm:px-0">
               {!selectedAsrama ? (
                   <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed border-border/60">
                       <Filter className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                       <h3 className="text-sm font-bold text-muted-foreground">Pilih asrama terlebih dahulu</h3>
                   </div>
               ) : (
                   <>
                       {/* DESKTOP VIEW */}
                       <div className="hidden md:block rounded-2xl border bg-card shadow-sm overflow-hidden">
                           <Table>
                               <TableHeader className="bg-muted/50">
                                   <TableRow className="hover:bg-transparent">
                                       <TableHead className="w-[40%] font-black uppercase text-xs tracking-widest text-muted-foreground">Nama Santri & NIS</TableHead>
                                       <TableHead className="w-[30%] font-black uppercase text-xs tracking-widest text-muted-foreground">
                                           <div className="flex items-center gap-2"><Utensils className="w-3.5 h-3.5"/> Tempat Makan</div>
                                       </TableHead>
                                       <TableHead className="w-[30%] font-black uppercase text-xs tracking-widest text-muted-foreground">
                                           <div className="flex items-center gap-2"><Shirt className="w-3.5 h-3.5"/> Tempat Cuci</div>
                                       </TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {santriData.map(santri => (
                                       <TableRow key={santri.id} className={cn("hover:bg-muted/30", pendingChanges[santri.id] && "bg-emerald-500/5 dark:bg-emerald-500/10")}>
                                           <TableCell className="p-4">
                                               <div className="font-bold text-foreground text-sm leading-tight mb-1">{santri.nama_lengkap}</div>
                                               <div className="text-[11px] font-mono text-muted-foreground">{santri.nis} • Kamar {santri.kamar}</div>
                                           </TableCell>
                                           <TableCell className="p-4">
                                              <Select 
                                                value={getDisplayValue(santri.id, 'tempat_makan_id', santri.tempat_makan_id)} 
                                                onValueChange={(v) => handleSelectChange(santri.id, 'tempat_makan_id', v)}
                                              >
                                                <SelectTrigger className={cn("w-full h-10 rounded-xl shadow-none", pendingChanges[santri.id]?.tempat_makan_id !== undefined ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold" : "border-border bg-background font-medium text-foreground")}>
                                                   <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                   <SelectItem value="null" className="text-muted-foreground italic">- Belum Ada -</SelectItem>
                                                   {jasaMakan.map(j => <SelectItem key={j.id} value={j.id} className="font-bold">{j.nama_jasa}</SelectItem>)}
                                                </SelectContent>
                                              </Select>
                                           </TableCell>
                                           <TableCell className="p-4">
                                              <Select 
                                                value={getDisplayValue(santri.id, 'tempat_mencuci_id', santri.tempat_mencuci_id)} 
                                                onValueChange={(v) => handleSelectChange(santri.id, 'tempat_mencuci_id', v)}
                                              >
                                                <SelectTrigger className={cn("w-full h-10 rounded-xl shadow-none", pendingChanges[santri.id]?.tempat_mencuci_id !== undefined ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold" : "border-border bg-background font-medium text-foreground")}>
                                                   <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                   <SelectItem value="null" className="text-muted-foreground italic">- Belum Ada -</SelectItem>
                                                   {jasaCuci.map(j => <SelectItem key={j.id} value={j.id} className="font-bold">{j.nama_jasa}</SelectItem>)}
                                                </SelectContent>
                                              </Select>
                                           </TableCell>
                                       </TableRow>
                                   ))}
                               </TableBody>
                           </Table>
                       </div>
   
                       {/* MOBILE VIEW */}
                       <div className="md:hidden space-y-3">
                           {santriData.map(santri => (
                               <Card key={santri.id} className={cn("p-4 shadow-sm relative overflow-hidden transition-all", pendingChanges[santri.id] ? "border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20" : "border-border bg-card")}>
                                   {pendingChanges[santri.id] && <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-500"></div>}
                                   
                                   <div className="mb-4 pt-1">
                                      <h3 className="font-bold text-foreground leading-tight mb-1">{santri.nama_lengkap}</h3>
                                      <p className="text-[11px] font-mono text-muted-foreground">{santri.nis} • Kamar {santri.kamar}</p>
                                   </div>
                                   
                                   <div className="space-y-3">
                                       <div className="flex flex-col gap-1.5">
                                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                             <Utensils className="w-3.5 h-3.5"/> Makan Di
                                           </label>
                                           <Select 
                                              value={getDisplayValue(santri.id, 'tempat_makan_id', santri.tempat_makan_id)} 
                                              onValueChange={(v) => handleSelectChange(santri.id, 'tempat_makan_id', v)}
                                            >
                                              <SelectTrigger className={cn("w-full h-11 rounded-xl shadow-sm border", pendingChanges[santri.id]?.tempat_makan_id !== undefined ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold" : "border-border bg-background font-medium")}>
                                                 <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                 <SelectItem value="null" className="text-muted-foreground italic">- Belum Ada -</SelectItem>
                                                 {jasaMakan.map(j => <SelectItem key={j.id} value={j.id} className="font-bold">{j.nama_jasa}</SelectItem>)}
                                              </SelectContent>
                                            </Select>
                                       </div>
                                       <div className="flex flex-col gap-1.5">
                                           <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                             <Shirt className="w-3.5 h-3.5"/> Nyuci Di
                                           </label>
                                           <Select 
                                              value={getDisplayValue(santri.id, 'tempat_mencuci_id', santri.tempat_mencuci_id)} 
                                              onValueChange={(v) => handleSelectChange(santri.id, 'tempat_mencuci_id', v)}
                                            >
                                              <SelectTrigger className={cn("w-full h-11 rounded-xl shadow-sm border", pendingChanges[santri.id]?.tempat_mencuci_id !== undefined ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold" : "border-border bg-background font-medium")}>
                                                 <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                 <SelectItem value="null" className="text-muted-foreground italic">- Belum Ada -</SelectItem>
                                                 {jasaCuci.map(j => <SelectItem key={j.id} value={j.id} className="font-bold">{j.nama_jasa}</SelectItem>)}
                                              </SelectContent>
                                            </Select>
                                       </div>
                                   </div>
                               </Card>
                           ))}
                       </div>
   
                       {/* Lazy Load Indicator */}
                       <div ref={loaderRef} className="py-8 flex justify-center">
                           {isLoading && <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />}
                           {!isLoading && !hasMore && santriData.length > 0 && (
                               <Badge variant="outline" className="shadow-none text-muted-foreground">Semua data dimuat</Badge>
                           )}
                           {!isLoading && santriData.length === 0 && (
                               <span className="text-muted-foreground text-sm font-medium">Tidak ada santri ditemukan.</span>
                           )}
                       </div>
                   </>
               )}
            </div>

            {/* FLOATING ACTION BAR */}
            {totalChanges > 0 && (
                <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe pt-4 bg-background/80 backdrop-blur-md border-t border-border/50 z-40">
                  <div className="max-w-2xl mx-auto mb-2 sm:mb-4 bg-emerald-600 shadow-xl shadow-emerald-900/20 rounded-2xl flex items-center justify-between p-2 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-3 px-3 py-2 w-full sm:w-auto">
                        <Badge className="bg-emerald-800 text-white font-black text-sm h-8 px-3 rounded-lg pointer-events-none border-none">
                            {totalChanges}
                        </Badge>
                        <span className="font-bold text-sm text-emerald-50 leading-tight">Perubahan<br className="sm:hidden"/> belum disimpan</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 sm:p-0 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setPendingChanges({})}
                            disabled={isSaving}
                            className="text-emerald-100 hover:text-white hover:bg-emerald-700/50 rounded-xl h-10"
                        >
                            Batal
                        </Button>
                        <Button 
                            onClick={handleSimpanBatch}
                            disabled={isSaving}
                            className="bg-white text-emerald-700 hover:bg-emerald-50 h-10 rounded-xl font-black shadow-sm"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            SIP, SIMPAN!
                        </Button>
                    </div>
                  </div>
                </div>
            )}

            {/* TOAST NOTIFICATION STYLED WITH SHADCN IN-APP - optional, we use sonner mostly but keeping original logic visually adjusted */}
            {toastMsg && (
                <div className="fixed top-4 right-4 sm:top-6 sm:right-6 bg-emerald-500 text-white border-none px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-50 animate-in fade-in slide-in-from-top-6">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-bold text-sm">{toastMsg}</span>
                </div>
            )}

            {/* MODAL MASTER PENYEDIA JASA */}
            <Dialog open={showModalJasa} onOpenChange={setShowModalJasa}>
                <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-background rounded-2xl border-none shadow-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader className="p-5 sm:p-6 border-b bg-muted/30 text-left shrink-0">
                       <DialogTitle className="text-xl font-black text-foreground">Master Penyedia Jasa</DialogTitle>
                       <DialogDescription className="text-xs font-medium">Kelola daftar tempat makan dan mencuci.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                            
                            {/* 1. Formulir Tambah Cepat */}
                            <Card className="shadow-sm border-border">
                               <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                                  <CardTitle className="text-sm font-black flex items-center gap-2 text-primary">
                                    <Plus className="w-4 h-4"/> Input Manual
                                  </CardTitle>
                               </CardHeader>
                               <CardContent className="pt-4 space-y-4">
                                <form onSubmit={handleTambahCepat} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nama Jasa</label>
                                        <Input 
                                            placeholder="Misal: Bu Yayat" 
                                            className="focus-visible:ring-emerald-500 h-10 shadow-none bg-muted/20"
                                            value={inputNamaJasa}
                                            onChange={e => setInputNamaJasa(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jenis Layanan</label>
                                        <Select value={inputJenisJasa} onValueChange={(val) => { if (val) setInputJenisJasa(val) }}>
                                            <SelectTrigger className="focus-visible:ring-emerald-500 h-10 shadow-none bg-muted/20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Makan" className="font-bold">Jasa Katering / Makan</SelectItem>
                                                <SelectItem value="Cuci" className="font-bold">Jasa Laundry / Cuci</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button 
                                        type="submit"
                                        disabled={isSubmittingJasa}
                                        className="w-full h-11 font-bold shadow-sm rounded-xl"
                                    >
                                        {isSubmittingJasa ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2"/>}
                                        Simpan Jasa
                                    </Button>
                                </form>
                               </CardContent>
                            </Card>

                            {/* 2. Import Excel */}
                            <Card className="shadow-sm border-border flex flex-col">
                               <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                                  <CardTitle className="text-sm font-black flex items-center gap-2 text-primary">
                                    <FileSpreadsheet className="w-4 h-4"/> Import Excel
                                  </CardTitle>
                               </CardHeader>
                               <CardContent className="pt-4 flex flex-col flex-1">
                                <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">Gunakan template yang disediakan untuk memasukkan banyak penyedia jasa sekaligus tanpa harus input manual.</p>
                                
                                <div className="space-y-3">
                                    <Button 
                                        variant="outline" 
                                        onClick={downloadTemplateExcel}
                                        className="w-full h-11 border-dashed font-bold text-muted-foreground rounded-xl"
                                    >
                                        <Download className="w-4 h-4 mr-2" /> Download Template (.xlsx)
                                    </Button>
                                    
                                    <div className="relative w-full">
                                        <input 
                                            type="file" 
                                            accept=".xlsx, .xls"
                                            ref={fileInputRef}
                                            onChange={handleExcelUpload}
                                            className="hidden" 
                                            id="upload-excel"
                                        />
                                        <label 
                                            htmlFor="upload-excel" 
                                            className={cn("w-full h-11 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2 cursor-pointer shadow-sm", isUploading && 'opacity-50 pointer-events-none')}
                                        >
                                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                            {isUploading ? "Memproses..." : "Upload File Excel"}
                                        </label>
                                    </div>
                                </div>
                               </CardContent>
                            </Card>

                        </div>

                        {/* Daftar Existing */}
                        <Card className="shadow-sm border-border">
                            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Daftar Tersimpan</CardTitle>
                                <Badge className="shadow-none rounded-md px-2 bg-muted/60 text-muted-foreground hover:bg-muted/60">{masterJasa.length}</Badge>
                            </CardHeader>
                            <CardContent className="pt-0 px-0">
                              <div className="max-h-64 overflow-y-auto px-4 sm:px-6 pt-4 pb-2">
                                  {masterJasa.length === 0 && <p className="text-xs font-semibold text-muted-foreground italic text-center py-8 bg-muted/30 rounded-xl border border-dashed my-2">Belum ada data penyedia jasa.</p>}
                                  <div className="space-y-2">
                                    {masterJasa.map(jasa => (
                                        <div key={jasa.id} className="flex items-center justify-between p-3 border border-border/50 rounded-xl hover:bg-muted/50 bg-card transition-colors">
                                            <div className="flex items-center gap-3.5">
                                                <div className={cn("p-2.5 rounded-xl shrink-0 shadow-sm border border-border/50", jasa.jenis === 'Makan' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500' : 'bg-blue-500/10 text-blue-600 dark:text-blue-500')}>
                                                    {jasa.jenis === 'Makan' ? <Utensils className="w-4 h-4"/> : <Shirt className="w-4 h-4"/>}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="font-bold text-foreground text-sm leading-none">{jasa.nama_jasa}</p>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{jasa.jenis}</span>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleHapusJasa(jasa.id)}
                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-lg shrink-0"
                                                title="Hapus Data"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                  </div>
                              </div>
                            </CardContent>
                        </Card>

                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}