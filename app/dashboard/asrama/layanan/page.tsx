"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Search, Filter, Save, Utensils, Shirt, Settings, X, Plus, Trash2, CheckCircle2, Download, UploadCloud, FileSpreadsheet } from "lucide-react";
import { 
    getDaftarAsrama, 
    getDaftarKamar, 
    getMasterJasa, 
    getSantriLayanan, 
    simpanBatchLayanan, 
    tambahMasterJasa,
    tambahMasterJasaBatch, 
    hapusMasterJasa 
} from "./actions";

// Memastikan interface TypeScript untuk Library XLSX via window
declare global {
  interface Window {
    XLSX: any;
  }
}

export default function LayananAsramaPage() {
    // --- STATE FILTER ---
    const [asramaList, setAsramaList] = useState<string[]>([]);
    const [kamarList, setKamarList] = useState<string[]>([]);
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
        getDaftarAsrama().then(setAsramaList).catch(console.error);
        getMasterJasa().then(setMasterJasa).catch(console.error);
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

    // --- HELPER UNTUK LOAD EXCEL CDN (SHEETJS) ---
    const loadSheetJS = async () => {
        if (window.XLSX) return window.XLSX;
        
        // Memuat skrip CDN secara dinamis
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
            script.onload = () => resolve(window.XLSX);
            script.onerror = reject;
            document.body.appendChild(script);
        });
    };

    // --- HANDLERS ---
    const handleSelectChange = (santriId: string, type: 'tempat_makan_id' | 'tempat_mencuci_id', value: string) => {
        setPendingChanges(prev => {
            const updated = { ...prev };
            if (!updated[santriId]) updated[santriId] = {};
            updated[santriId][type] = value === "null" ? null : value;
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
            alert("Gagal menyimpan data.");
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
            alert("Gagal menambahkan data.");
        } finally {
            setIsSubmittingJasa(false);
        }
    };

    // Download Template Excel Asli
    const downloadTemplateExcel = async () => {
        try {
            const XLSX = await loadSheetJS();
            
            // Data sampel
            const dataTemplate = [
                { "Nama Penyedia Jasa": "Bu Yayat", "Jenis Layanan (Makan/Cuci)": "Makan" },
                { "Nama Penyedia Jasa": "Laundry Berkah", "Jenis Layanan (Makan/Cuci)": "Cuci" },
                { "Nama Penyedia Jasa": "Kantin Utama", "Jenis Layanan (Makan/Cuci)": "Makan" }
            ];

            const ws = XLSX.utils.json_to_sheet(dataTemplate);
            // Lebarkan kolom biar rapi
            ws['!cols'] = [{ wch: 25 }, { wch: 25 }];
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Template Penyedia");
            
            // Generate dan trigger download
            XLSX.writeFile(wb, "Template_Penyedia_Jasa.xlsx");
        } catch (error) {
            alert("Gagal membuat template Excel.");
            console.error(error);
        }
    };

    // Parse Excel File dari Upload
    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const XLSX = await loadSheetJS();
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

                    // Transformasi hasil Excel ke array yang diharapkan server
                    const dataBatch: { nama_jasa: string, jenis: string }[] = [];
                    
                    jsonData.forEach(row => {
                        // Mengambil nilai berdasarkan key atau indeks bebas agar aman dari typo header
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
                    alert("Gagal memproses data Excel. Pastikan format sesuai template.");
                } finally {
                    setIsUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                }
            };
            
            reader.readAsArrayBuffer(file);

        } catch (err) {
            alert("Gagal memuat sistem Excel. Coba periksa koneksi internet.");
            setIsUploading(false);
        }
    };

    const handleHapusJasa = async (id: string) => {
        if(!confirm("Yakin hapus penyedia jasa ini?")) return;
        try {
            await hapusMasterJasa(id);
            const freshMaster = await getMasterJasa();
            setMasterJasa(freshMaster);
        } catch (e) {
            alert("Gagal menghapus jasa. Mungkin data ini masih digunakan oleh santri.");
        }
    };

    const getDisplayValue = (santriId: string, type: 'tempat_makan_id' | 'tempat_mencuci_id', originalValue: string) => {
        if (pendingChanges[santriId] && pendingChanges[santriId][type] !== undefined) {
            return pendingChanges[santriId][type] === null ? "null" : pendingChanges[santriId][type];
        }
        return originalValue || "null";
    };

    const totalChanges = Object.keys(pendingChanges).length;
    const jasaMakan = masterJasa.filter(m => m.jenis === 'Makan');
    const jasaCuci = masterJasa.filter(m => m.jenis === 'Cuci');

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                        <Utensils className="w-8 h-8 text-emerald-600" />
                        Katering & Laundry
                    </h1>
                    <p className="text-slate-500 mt-1">Pemetaan tempat makan dan mencuci santri (Batch Mode).</p>
                </div>
                <button 
                    onClick={() => setShowModalJasa(true)}
                    className="flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-lg hover:bg-slate-700 transition"
                >
                    <Settings className="w-4 h-4" />
                    <span className="font-semibold text-sm">Penyedia Jasa</span>
                </button>
            </div>

            {/* Filter Section */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pilih Asrama (Wajib)</label>
                    <select 
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-emerald-500"
                        value={selectedAsrama}
                        onChange={e => setSelectedAsrama(e.target.value)}
                    >
                        <option value="">-- Pilih Asrama --</option>
                        {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pilih Kamar (Opsional)</label>
                    <select 
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                        value={selectedKamar}
                        onChange={e => setSelectedKamar(e.target.value)}
                        disabled={!selectedAsrama}
                    >
                        <option value="">-- Semua Kamar --</option>
                        {kamarList.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                </div>
                <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 w-full transition">
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 text-emerald-600 rounded"
                            checked={belumDitempatkan}
                            onChange={e => setBelumDitempatkan(e.target.checked)}
                        />
                        <span className="text-sm font-medium text-slate-700">Tampilkan yang belum ditempatkan</span>
                    </label>
                </div>
            </div>

            {/* Content List */}
            {!selectedAsrama ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Filter className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-slate-500">Pilih asrama terlebih dahulu</h3>
                </div>
            ) : (
                <>
                    {/* DESKTOP VIEW */}
                    <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                                    <th className="p-4 w-[40%]">Nama Santri & NIS</th>
                                    <th className="p-4 w-[30%]"><div className="flex items-center gap-2"><Utensils className="w-4 h-4"/> Tempat Makan</div></th>
                                    <th className="p-4 w-[30%]"><div className="flex items-center gap-2"><Shirt className="w-4 h-4"/> Tempat Cuci</div></th>
                                </tr>
                            </thead>
                            <tbody>
                                {santriData.map(santri => (
                                    <tr key={santri.id} className={`border-b border-slate-100 hover:bg-slate-50 transition ${pendingChanges[santri.id] ? 'bg-amber-50/30' : ''}`}>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{santri.nama_lengkap}</div>
                                            <div className="text-xs font-medium text-slate-500 mt-0.5">{santri.nis} • Kamar {santri.kamar}</div>
                                        </td>
                                        <td className="p-4">
                                            <select 
                                                className={`w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 ${pendingChanges[santri.id]?.tempat_makan_id !== undefined ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}
                                                value={getDisplayValue(santri.id, 'tempat_makan_id', santri.tempat_makan_id)}
                                                onChange={e => handleSelectChange(santri.id, 'tempat_makan_id', e.target.value)}
                                            >
                                                <option value="null">- Belum Ada -</option>
                                                {jasaMakan.map(j => <option key={j.id} value={j.id}>{j.nama_jasa}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <select 
                                                className={`w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 ${pendingChanges[santri.id]?.tempat_mencuci_id !== undefined ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}
                                                value={getDisplayValue(santri.id, 'tempat_mencuci_id', santri.tempat_mencuci_id)}
                                                onChange={e => handleSelectChange(santri.id, 'tempat_mencuci_id', e.target.value)}
                                            >
                                                <option value="null">- Belum Ada -</option>
                                                {jasaCuci.map(j => <option key={j.id} value={j.id}>{j.nama_jasa}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* MOBILE VIEW */}
                    <div className="md:hidden space-y-3">
                        {santriData.map(santri => (
                            <div key={santri.id} className={`bg-white border rounded-xl p-4 shadow-sm relative ${pendingChanges[santri.id] ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}>
                                {pendingChanges[santri.id] && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>}
                                
                                <h3 className="font-bold text-slate-800 text-lg leading-tight">{santri.nama_lengkap}</h3>
                                <p className="text-xs font-semibold text-slate-500 mt-1 mb-3 bg-slate-100 w-fit px-2 py-0.5 rounded-md">{santri.nis} • Kamar {santri.kamar}</p>
                                
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1"><Utensils className="w-3.5 h-3.5"/> Makan Di:</label>
                                        <select 
                                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50"
                                            value={getDisplayValue(santri.id, 'tempat_makan_id', santri.tempat_makan_id)}
                                            onChange={e => handleSelectChange(santri.id, 'tempat_makan_id', e.target.value)}
                                        >
                                            <option value="null">- Belum Ada -</option>
                                            {jasaMakan.map(j => <option key={j.id} value={j.id}>{j.nama_jasa}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1"><Shirt className="w-3.5 h-3.5"/> Nyuci Di:</label>
                                        <select 
                                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50"
                                            value={getDisplayValue(santri.id, 'tempat_mencuci_id', santri.tempat_mencuci_id)}
                                            onChange={e => handleSelectChange(santri.id, 'tempat_mencuci_id', e.target.value)}
                                        >
                                            <option value="null">- Belum Ada -</option>
                                            {jasaCuci.map(j => <option key={j.id} value={j.id}>{j.nama_jasa}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Lazy Load Indicator */}
                    <div ref={loaderRef} className="py-6 flex justify-center">
                        {isLoading && <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />}
                        {!isLoading && !hasMore && santriData.length > 0 && (
                            <span className="text-slate-400 text-sm font-medium">-- Semua data telah dimuat --</span>
                        )}
                        {!isLoading && santriData.length === 0 && (
                            <span className="text-slate-400 text-sm font-medium">Tidak ada santri ditemukan.</span>
                        )}
                    </div>
                </>
            )}

            {/* FLOATING ACTION BAR */}
            {totalChanges > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] md:w-auto md:min-w-[400px] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between z-40 animate-in slide-in-from-bottom-5">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-500 w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-900">
                            {totalChanges}
                        </div>
                        <span className="font-medium text-sm md:text-base">Perubahan belum disimpan</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setPendingChanges({})}
                            disabled={isSaving}
                            className="text-slate-300 hover:text-white px-3 py-2 text-sm font-medium transition"
                        >
                            Batal
                        </button>
                        <button 
                            onClick={handleSimpanBatch}
                            disabled={isSaving}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Simpan</span>
                        </button>
                    </div>
                </div>
            )}

            {/* TOAST NOTIFICATION */}
            {toastMsg && (
                <div className="fixed top-4 right-4 bg-emerald-100 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-top-5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold">{toastMsg}</span>
                </div>
            )}

            {/* MODAL MASTER PENYEDIA JASA */}
            {showModalJasa && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col animate-in zoom-in-95">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Master Penyedia Jasa</h2>
                                <p className="text-sm text-slate-500">Kelola daftar tempat makan dan mencuci.</p>
                            </div>
                            <button onClick={() => setShowModalJasa(false)} className="text-slate-400 hover:text-rose-500 transition p-2 rounded-full hover:bg-rose-50">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-5 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* 1. Formulir Tambah Cepat */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                    <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        <Plus className="w-4 h-4 text-emerald-600"/> Input Manual
                                    </h3>
                                    <form onSubmit={handleTambahCepat} className="space-y-3">
                                        <div>
                                            <input 
                                                type="text" 
                                                placeholder="Nama (Misal: Bu Yayat)" 
                                                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                value={inputNamaJasa}
                                                onChange={e => setInputNamaJasa(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <select 
                                                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                value={inputJenisJasa}
                                                onChange={e => setInputJenisJasa(e.target.value)}
                                            >
                                                <option value="Makan">Jasa Katering / Makan</option>
                                                <option value="Cuci">Jasa Laundry / Cuci</option>
                                            </select>
                                        </div>
                                        <button 
                                            type="submit"
                                            disabled={isSubmittingJasa}
                                            className="w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 transition disabled:opacity-50 flex justify-center items-center"
                                        >
                                            {isSubmittingJasa ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Data"}
                                        </button>
                                    </form>
                                </div>

                                {/* 2. Import Excel Asli */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                                    <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-600"/> Import Excel (.xlsx)
                                    </h3>
                                    <p className="text-xs text-slate-500 mb-4 flex-1">Gunakan template yang disediakan untuk memasukkan data sekaligus.</p>
                                    
                                    <div className="space-y-2">
                                        <button 
                                            onClick={downloadTemplateExcel}
                                            className="w-full border border-slate-300 text-slate-700 hover:bg-slate-50 py-2 rounded-lg text-sm font-medium transition flex justify-center items-center gap-2"
                                        >
                                            <Download className="w-4 h-4" /> Download Template
                                        </button>
                                        
                                        <div className="relative">
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
                                                className={`w-full border border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-lg text-sm font-semibold transition flex justify-center items-center gap-2 cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                                            >
                                                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                                {isUploading ? "Memproses Excel..." : "Upload File Excel"}
                                            </label>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Daftar Existing */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-slate-700 mb-3 border-b pb-2">Daftar Tersimpan ({masterJasa.length})</h3>
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                    {masterJasa.length === 0 && <p className="text-sm text-slate-500 italic text-center py-6">Belum ada data penyedia jasa.</p>}
                                    {masterJasa.map(jasa => (
                                        <div key={jasa.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 group transition">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-md ${jasa.jenis === 'Makan' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                                                    {jasa.jenis === 'Makan' ? <Utensils className="w-4 h-4 text-amber-600"/> : <Shirt className="w-4 h-4 text-blue-600"/>}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm leading-none">{jasa.nama_jasa}</p>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 inline-block ${jasa.jenis === 'Makan' ? 'text-amber-700' : 'text-blue-700'}`}>{jasa.jenis}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleHapusJasa(jasa.id)}
                                                className="text-slate-300 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-md transition"
                                                title="Hapus Data"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}