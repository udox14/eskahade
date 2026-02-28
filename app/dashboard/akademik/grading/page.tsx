'use client'

import { useState, useEffect, useRef } from 'react'
import { getKelasList, getDataGrading, simpanGradingBatch } from './actions'
import { Loader2, Save, Filter, BookOpen, AlertCircle, TrendingUp, CheckCircle2, AlertTriangle, Download, UploadCloud, FileSpreadsheet } from 'lucide-react'

// Memastikan interface TypeScript untuk Library XLSX via window
declare global {
  interface Window {
    XLSX: any;
  }
}

export default function GradingKelasPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState<string>('')
  
  const [dataGrading, setDataGrading] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isProcessingExcel, setIsProcessingExcel] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  // State untuk menyimpan perubahan yang dilakukan Wali Kelas sebelum disave
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Load Daftar Kelas dengan Natural Sort
  useEffect(() => {
    getKelasList().then(res => {
      // Terapkan Natural Sort agar 1-10 berada setelah 1-9, bukan setelah 1-1
      const sortedKelas = res.sort((a, b) => 
        a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
      );
      
      setKelasList(sortedKelas)
      if (sortedKelas.length === 1) {
        // Jika Wali Kelas (hanya 1 kelas), otomatis pilih kelas tersebut
        setSelectedKelas(sortedKelas[0].id)
      }
    })
  }, [])

  // 2. Load Data Santri & Nilai jika kelas dipilih
  useEffect(() => {
    if (selectedKelas) {
      loadGradingData(selectedKelas)
    } else {
      setDataGrading([])
      setPendingChanges({})
    }
  }, [selectedKelas])

  const loadGradingData = async (kelasId: string) => {
    setLoading(true)
    setPendingChanges({})
    try {
      const res = await getDataGrading(kelasId)
      setDataGrading(res)
    } catch (error) {
      console.error(error)
      alert("Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }

  // 3. Handler Dropdown Perubahan Grade
  const handleGradeChange = (riwayatId: string, newGrade: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [riwayatId]: newGrade
    }))
  }

  // 4. Handler Simpan Batch
  const handleSimpanBatch = async () => {
    const totalChanges = Object.keys(pendingChanges).length
    if (totalChanges === 0) {
      return alert("Belum ada perubahan yang perlu disimpan.")
    }

    if (!confirm(`Simpan keputusan grading untuk ${totalChanges} santri?`)) return

    setIsSaving(true)
    try {
      const payload = Object.entries(pendingChanges).map(([id, grade]) => ({
        riwayat_id: id,
        grade: grade
      }))

      await simpanGradingBatch(payload)
      
      setToastMsg(`Berhasil menyimpan ${totalChanges} grading!`)
      setTimeout(() => setToastMsg(""), 4000)
      
      setDataGrading(prev => prev.map(item => {
        if (pendingChanges[item.riwayat_id]) {
          return { ...item, grade_final: pendingChanges[item.riwayat_id] }
        }
        return item
      }))
      setPendingChanges({})

    } catch (error) {
      alert("Terjadi kesalahan saat menyimpan data.")
    } finally {
      setIsSaving(false)
    }
  }

  // --- EXCEL INTEGRATION (CDN) ---
  const loadSheetJS = async () => {
    if (window.XLSX) return window.XLSX;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
      script.onload = () => resolve(window.XLSX);
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  const handleDownloadTemplate = async () => {
    if (dataGrading.length === 0) return alert("Belum ada data santri untuk diunduh.");
    
    setIsProcessingExcel(true);
    try {
      const XLSX = await loadSheetJS();
      
      // Siapkan data untuk Excel
      const dataTemplate = dataGrading.map(s => ({
        "ID_SYSTEM_JANGAN_DIUBAH": s.riwayat_id,
        "NIS": s.nis,
        "Nama Lengkap": s.nama,
        "Rata-Rata Nilai": s.rata_rata,
        "Rekomendasi Sistem": s.rekomendasi,
        "Grade Final (Ketik: Grade A / Grade B / Grade C)": getDisplayGrade(s.riwayat_id, s.grade_final)
      }));

      const ws = XLSX.utils.json_to_sheet(dataTemplate);
      // Atur lebar kolom biar rapi
      ws['!cols'] = [{ hidden: true }, { wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 20 }, { wch: 45 }];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Grading Kelas");
      
      const namaKelas = kelasList.find(k => k.id === selectedKelas)?.nama_kelas || "Kelas";
      XLSX.writeFile(wb, `Template_Grading_${namaKelas.replace(/ /g, "_")}.xlsx`);
      
    } catch (error) {
      alert("Gagal membuat template Excel.");
      console.error(error);
    } finally {
      setIsProcessingExcel(false);
    }
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingExcel(true);
    try {
      const XLSX = await loadSheetJS();
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

          let validChanges = 0;
          const newPendingObj = { ...pendingChanges };

          jsonData.forEach(row => {
            const id = row["ID_SYSTEM_JANGAN_DIUBAH"];
            let rawGrade = row["Grade Final (Ketik: Grade A / Grade B / Grade C)"];

            if (id && rawGrade) {
              // Normalisasi ketikan (Misal ngetik cuma "a" atau "GRADE B")
              let finalGrade = String(rawGrade).trim().toUpperCase();
              if (finalGrade === 'A' || finalGrade.includes('GRADE A')) finalGrade = 'Grade A';
              else if (finalGrade === 'B' || finalGrade.includes('GRADE B')) finalGrade = 'Grade B';
              else if (finalGrade === 'C' || finalGrade.includes('GRADE C')) finalGrade = 'Grade C';
              else return; // Skip jika format tidak valid sama sekali

              // Pastikan ID ini ada di kelas yang sedang dibuka
              const santri = dataGrading.find(s => s.riwayat_id === id);
              if (santri && santri.grade_final !== finalGrade) {
                newPendingObj[id] = finalGrade;
                validChanges++;
              }
            }
          });

          setPendingChanges(newPendingObj);
          
          if (validChanges > 0) {
            setToastMsg(`${validChanges} perubahan diimpor! Silakan review dan klik Simpan.`);
            setTimeout(() => setToastMsg(""), 5000);
          } else {
            alert("Tidak ada perubahan baru yang terdeteksi dari file Excel.");
          }

        } catch (error) {
          console.error(error);
          alert("Gagal memproses data Excel. Pastikan format kolom tidak diubah.");
        } finally {
          setIsProcessingExcel(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (err) {
      alert("Gagal memuat sistem Excel. Periksa koneksi internet.");
      setIsProcessingExcel(false);
    }
  };

  // Helper
  const getDisplayGrade = (riwayatId: string, originalGrade: string) => {
    return pendingChanges[riwayatId] !== undefined ? pendingChanges[riwayatId] : originalGrade
  }

  const totalPerubahan = Object.keys(pendingChanges).length

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-indigo-600" />
            Grading
          </h1>
          <p className="text-gray-500 text-sm mt-1">Sistem Rekomendasi Penentuan Grade Nahwu & Sharaf (A/B/C)</p>
        </div>
      </div>

      {/* FILTER KELAS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
        <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Kelas</label>
        <select 
          className="w-full md:w-1/3 border border-gray-300 rounded-xl p-3 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          value={selectedKelas}
          onChange={e => setSelectedKelas(e.target.value)}
        >
          <option value="">-- Pilih Kelas --</option>
          {kelasList.map(k => (
            <option key={k.id} value={k.id}>{k.nama_kelas}</option>
          ))}
        </select>
      </div>

      {/* CONTENT */}
      {!selectedKelas ? (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-500">Pilih kelas untuk mulai melakukan grading</h3>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
           <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-600"/>
           <p className="font-medium">Mengkalkulasi rata-rata 2 semester...</p>
        </div>
      ) : dataGrading.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400">
          <p className="font-medium">Tidak ada data santri aktif di kelas ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* ACTION BAR (INFO + EXCEL) */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Panduan */}
            <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5"/>
               <div className="text-sm text-indigo-900">
                  <p className="font-bold mb-1">Panduan Grading Otomatis:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-indigo-800/80">
                    <li><b>Grade A:</b> Rata-rata $\ge$ 70</li>
                    <li><b>Grade B:</b> 50 $\le$ Rata-rata &lt; 70</li>
                    <li><b>Grade C:</b> Rata-rata &lt; 50</li>
                  </ul>
               </div>
            </div>

            {/* Excel Actions */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3 shrink-0 shadow-sm">
              <div className="text-sm font-bold text-gray-700 w-full sm:w-auto flex items-center gap-2 mb-2 sm:mb-0 mr-2 border-b sm:border-b-0 sm:border-r border-gray-200 pb-2 sm:pb-0 sm:pr-4">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600"/>
                Excel Mode
              </div>
              
              <button 
                onClick={handleDownloadTemplate}
                disabled={isProcessingExcel}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isProcessingExcel ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                Download Template
              </button>

              <div className="relative w-full sm:w-auto">
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  ref={fileInputRef}
                  onChange={handleUploadExcel}
                  className="hidden" 
                  id="upload-grading"
                />
                <label 
                  htmlFor="upload-grading" 
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${isProcessingExcel ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <UploadCloud className="w-4 h-4"/>
                  Upload Template
                </label>
              </div>
            </div>
          </div>

          {/* DESKTOP VIEW (Table) */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Nama Santri & NIS</th>
                  <th className="px-6 py-4 text-center">Rata-rata<br/>(Nahwu/Sharaf)</th>
                  <th className="px-6 py-4 text-center">Rekomendasi<br/>Sistem</th>
                  <th className="px-6 py-4">Keputusan Final <br/><span className="text-[10px] text-gray-400 font-normal lowercase">(Hak Veto Wali Kelas)</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataGrading.map(s => {
                  const currentGrade = getDisplayGrade(s.riwayat_id, s.grade_final)
                  const isOverridden = currentGrade !== s.rekomendasi && s.rekomendasi !== '-'

                  return (
                    <tr key={s.riwayat_id} className={`hover:bg-indigo-50/30 transition-colors ${pendingChanges[s.riwayat_id] ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           {pendingChanges[s.riwayat_id] && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>}
                           <div>
                              <p className="font-bold text-gray-900 text-base">{s.nama}</p>
                              <p className="text-gray-500 font-mono text-xs mt-0.5">{s.nis}</p>
                           </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-black text-lg text-indigo-700">{s.rata_rata}</span>
                          <span className="text-[10px] text-gray-400 font-medium">Dari {s.jumlah_komponen_nilai} Nilai</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        {s.rekomendasi === '-' ? (
                          <span className="text-xs text-gray-400 italic">Nilai Kosong</span>
                        ) : (
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${
                            s.rekomendasi === 'Grade A' ? 'bg-green-50 text-green-700 border-green-200' :
                            s.rekomendasi === 'Grade B' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-orange-50 text-orange-700 border-orange-200'
                          }`}>
                            {s.rekomendasi}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                          <select 
                            className={`p-2.5 border rounded-xl text-sm font-bold shadow-sm focus:ring-2 outline-none transition-all cursor-pointer ${
                              pendingChanges[s.riwayat_id] ? 'border-amber-400 ring-4 ring-amber-100 text-amber-900 bg-amber-50' : 
                              'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100 text-gray-800 bg-white'
                            }`}
                            value={currentGrade}
                            onChange={e => handleGradeChange(s.riwayat_id, e.target.value)}
                          >
                            <option value="Grade A">Grade A</option>
                            <option value="Grade B">Grade B</option>
                            <option value="Grade C">Grade C</option>
                          </select>
                          
                          {/* Indikator Veto */}
                          {isOverridden && (
                            <span className="flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-md border border-purple-200 animate-in zoom-in">
                              <AlertTriangle className="w-3 h-3"/> VETO
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE VIEW (Cards) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {dataGrading.map(s => {
              const currentGrade = getDisplayGrade(s.riwayat_id, s.grade_final)
              const isOverridden = currentGrade !== s.rekomendasi && s.rekomendasi !== '-'

              return (
                <div key={s.riwayat_id} className={`bg-white rounded-2xl border p-4 shadow-sm relative overflow-hidden transition-all ${pendingChanges[s.riwayat_id] ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-200'}`}>
                  
                  {pendingChanges[s.riwayat_id] && <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>}
                  
                  <div className="border-b border-gray-100 pb-3 mb-3">
                    <h3 className="font-bold text-gray-900 text-base leading-tight pr-4">{s.nama}</h3>
                    <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">{s.nis}</span>
                  </div>

                  <div className="flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-50 mb-3">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Rata-rata</p>
                      <p className="font-black text-xl text-indigo-700">{s.rata_rata}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Sistem</p>
                      {s.rekomendasi === '-' ? (
                        <span className="text-xs text-gray-400 italic">Kosong</span>
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                          s.rekomendasi === 'Grade A' ? 'bg-green-100 text-green-700 border-green-200' :
                          s.rekomendasi === 'Grade B' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          'bg-orange-100 text-orange-700 border-orange-200'
                        }`}>
                          {s.rekomendasi}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 flex justify-between items-center mb-1.5">
                      <span>Keputusan Final Wali Kelas:</span>
                      {isOverridden && <span className="text-[9px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">VETO</span>}
                    </label>
                    <select 
                      className={`w-full p-3 border rounded-xl text-sm font-bold shadow-sm focus:ring-2 outline-none transition-all cursor-pointer ${
                        pendingChanges[s.riwayat_id] ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-800'
                      }`}
                      value={currentGrade}
                      onChange={e => handleGradeChange(s.riwayat_id, e.target.value)}
                    >
                      <option value="Grade A">Grade A</option>
                      <option value="Grade B">Grade B</option>
                      <option value="Grade C">Grade C</option>
                    </select>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}

      {/* FLOATING ACTION BAR (Hanya muncul jika ada perubahan manual/dari excel) */}
      {totalPerubahan > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] md:w-auto md:min-w-[400px] bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between z-40 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="bg-amber-400 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-black text-slate-900 text-xs md:text-sm">
              {totalPerubahan}
            </div>
            <span className="font-semibold text-xs md:text-sm">Draft belum disimpan</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button 
              onClick={() => setPendingChanges({})}
              disabled={isSaving}
              className="text-slate-300 hover:text-white px-2 py-2 text-xs md:text-sm font-bold transition"
            >
              Batal
            </button>
            <button 
              onClick={handleSimpanBatch}
              disabled={isSaving}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 md:py-2 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50 text-xs md:text-sm shadow-lg shadow-indigo-500/30"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Simpan Data</span>
            </button>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed top-4 right-4 bg-emerald-100 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-top-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold text-sm">{toastMsg}</span>
        </div>
      )}

    </div>
  )
}