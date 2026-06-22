'use client'

import React from 'react'

import { useState, useEffect, useRef } from 'react'
import { getKelasList, getDataGrading, simpanGradingBatch, getGradingSekpen, setGradeSantri, setGradeBanyak, simpanUrutanGrade, type GradingSekpenItem } from './actions'
import { Loader2, Save, Filter, BookOpen, AlertCircle, TrendingUp, CheckCircle2, AlertTriangle, Download, UploadCloud, FileSpreadsheet, Check, X, LayoutGrid, List as ListIcon, ChevronDown, ChevronUp, GripVertical, CornerDownLeft } from 'lucide-react'
import { type Grade } from '@/lib/akademik/grade'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

// Wrapper: sekpen/admin dapat view 3 kolom (default), bisa beralih ke tabel klasik.
// Wali kelas tetap pakai tabel klasik (dropdown + veto + batch save).
export default function GradingPage({ isSekpen = false }: { isSekpen?: boolean }) {
  const [view, setView] = useState<'kolom' | 'tabel'>(isSekpen ? 'kolom' : 'tabel')

  if (!isSekpen) return <GradingWaliView />

  const toggle = (
    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
      <button
        onClick={() => setView('kolom')}
        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${view === 'kolom' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
      >
        <LayoutGrid className="w-4 h-4" /> 3 Kolom
      </button>
      <button
        onClick={() => setView('tabel')}
        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${view === 'tabel' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
      >
        <ListIcon className="w-4 h-4" /> Tabel
      </button>
    </div>
  )

  return view === 'kolom'
    ? <GradingSekpenView toggle={toggle} />
    : <GradingWaliView headerExtra={toggle} />
}

function GradingWaliView({ headerExtra }: { headerExtra?: React.ReactNode } = {}) {
  const confirm = useConfirm()
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

    if (!await confirm(`Simpan keputusan grading untuk ${totalChanges} santri?`)) return

    setIsSaving(true)
    try {
      const payload = Object.entries(pendingChanges).map(([id, grade]) => ({
        riwayat_id: id,
        grade: grade as string
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

  // --- EXCEL INTEGRATION ---
  const handleDownloadTemplate = async () => {
    if (dataGrading.length === 0) return alert("Belum ada data santri untuk diunduh.");
    
    setIsProcessingExcel(true);
    try {
      const XLSX = await import('xlsx');
      
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
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
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

  // Helper
  const getDisplayGrade = (riwayatId: string, originalGrade: string) => {
    return pendingChanges[riwayatId] !== undefined ? pendingChanges[riwayatId] : originalGrade
  }

  const totalPerubahan = Object.keys(pendingChanges).length

  return (
    <div className="space-y-6 w-full pb-24">

      {/* HEADER */}
      <DashboardPageHeader
        title="Grading"
        description="Sistem rekomendasi penentuan grade Nahwu dan Sharaf (A/B/C)."
      />

      {/* FILTER KELAS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="w-full md:w-1/3">
          <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Kelas</label>
          <select
            className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={selectedKelas}
            onChange={e => setSelectedKelas(e.target.value)}
          >
            <option value="">-- Pilih Kelas --</option>
            {kelasList.map(k => (
              <option key={k.id} value={k.id}>{k.nama_kelas}</option>
            ))}
          </select>
        </div>
        {headerExtra}
      </div>

      {/* CONTENT */}
      {!selectedKelas ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <Filter className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-500">Pilih kelas untuk mulai melakukan grading</h3>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm">
           <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-600"/>
           <p className="font-medium">Mengkalkulasi rata-rata 2 semester...</p>
        </div>
      ) : dataGrading.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm text-slate-400">
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
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3 shrink-0 shadow-sm">
              <div className="text-sm font-bold text-slate-700 w-full sm:w-auto flex items-center gap-2 mb-2 sm:mb-0 mr-2 border-b sm:border-b-0 sm:border-r border-slate-200 pb-2 sm:pb-0 sm:pr-4">
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
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Nama Santri & NIS</th>
                  <th className="px-6 py-4 text-center">Rata-rata<br/>(Nahwu/Sharaf)</th>
                  <th className="px-6 py-4 text-center">Rekomendasi<br/>Sistem</th>
                  <th className="px-6 py-4">Keputusan Final <br/><span className="text-[10px] text-slate-400 font-normal lowercase">(Hak Veto Wali Kelas)</span></th>
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
                              <p className="font-bold text-slate-900 text-base">{s.nama}</p>
                              <p className="text-slate-500 font-mono text-xs mt-0.5">{s.nis}</p>
                           </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-black text-lg text-indigo-700">{s.rata_rata}</span>
                          <span className="text-[10px] text-slate-400 font-medium">Dari {s.jumlah_komponen_nilai} Nilai</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        {s.rekomendasi === '-' ? (
                          <span className="text-xs text-slate-400 italic">Nilai Kosong</span>
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

                      <td className="px-6 py-4 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <select 
                            className={`p-2.5 border rounded-xl text-sm font-bold shadow-sm focus:ring-2 outline-none transition-all cursor-pointer ${
                              pendingChanges[s.riwayat_id] ? 'border-amber-400 ring-4 ring-amber-100 text-amber-900 bg-amber-50' : 
                              'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100 text-slate-800 bg-white'
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
                <div key={s.riwayat_id} className={`bg-white rounded-2xl border p-4 shadow-sm relative overflow-hidden transition-all ${pendingChanges[s.riwayat_id] ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'}`}>
                  
                  {pendingChanges[s.riwayat_id] && <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>}
                  
                  <div className="border-b border-slate-100 pb-3 mb-3">
                    <h3 className="font-bold text-slate-900 text-base leading-tight pr-4">{s.nama}</h3>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block">{s.nis}</span>
                  </div>

                  <div className="flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-50 mb-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Rata-rata</p>
                      <p className="font-black text-xl text-indigo-700">{s.rata_rata}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Sistem</p>
                      {s.rekomendasi === '-' ? (
                        <span className="text-xs text-slate-400 italic">Kosong</span>
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
                    <label className="text-xs font-bold text-slate-700 flex justify-between items-center mb-1.5">
                      <span>Keputusan Final Wali Kelas:</span>
                      {isOverridden && <span className="text-[9px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">VETO</span>}
                    </label>
                    <select 
                      className={`w-full p-3 border rounded-xl text-sm font-bold shadow-sm focus:ring-2 outline-none transition-all cursor-pointer ${
                        pendingChanges[s.riwayat_id] ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-800'
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
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 md:py-2 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50 text-xs md:text-sm shadow-sm shadow-indigo-500/30"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Simpan Data</span>
            </button>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed top-4 right-4 bg-emerald-100 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl shadow-sm flex items-center gap-3 z-50 animate-in slide-in-from-top-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold text-sm">{toastMsg}</span>
        </div>
      )}

    </div>
  )
}

// ── VIEW SEKPEN: 3 kolom (A/B/C), isi via combobox, simpan per-item (auto-save) ──

const GRADE_COLS: { key: Grade; label: string; head: string; chip: string }[] = [
  { key: 'A', label: 'Grade A', head: 'bg-green-50 text-green-800 border-green-200', chip: 'bg-green-100 text-green-800 border-green-200' },
  { key: 'B', label: 'Grade B', head: 'bg-blue-50 text-blue-800 border-blue-200', chip: 'bg-blue-100 text-blue-800 border-blue-200' },
  { key: 'C', label: 'Grade C', head: 'bg-orange-50 text-orange-800 border-orange-200', chip: 'bg-orange-100 text-orange-800 border-orange-200' },
]

function GradingSekpenView({ toggle }: { toggle?: React.ReactNode } = {}) {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [items, setItems] = useState<GradingSekpenItem[]>([])
  const [loading, setLoading] = useState(false)
  // riwayat_id -> status simpan per-item
  const [rowStatus, setRowStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})
  // accordion pool "belum ada grade" (default terlipat — utamakan kolom)
  const [poolOpen, setPoolOpen] = useState(false)
  // drag-reorder dalam kolom
  const [dragId, setDragId] = useState<string | null>(null)

  useEffect(() => {
    getKelasList().then(res => {
      const sorted = res.sort((a: any, b: any) =>
        a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
      )
      setKelasList(sorted)
    })
  }, [])

  useEffect(() => {
    if (!selectedKelas) { setItems([]); return }
    setLoading(true)
    getGradingSekpen(selectedKelas)
      .then(setItems)
      .catch(() => alert('Gagal memuat data'))
      .finally(() => setLoading(false))
  }, [selectedKelas])

  const belum = items.filter(i => i.grade === null)
  // urutan manual (kecil=atas) duluan, sisanya (urutan null) alfabet di bawah
  const byGrade = (g: Grade) => items
    .filter(i => i.grade === g)
    .sort((a, b) => {
      const ua = a.urutan ?? Number.MAX_SAFE_INTEGER
      const ub = b.urutan ?? Number.MAX_SAFE_INTEGER
      if (ua !== ub) return ua - ub
      return a.nama.localeCompare(b.nama, undefined, { sensitivity: 'base' })
    })

  // Simpan grade satu santri seketika; update state lokal optimistik + indikator.
  const assign = async (riwayatId: string, grade: Grade | null) => {
    setItems(prev => prev.map(i => i.riwayat_id === riwayatId ? { ...i, grade } : i))
    setRowStatus(s => ({ ...s, [riwayatId]: 'saving' }))
    try {
      const res = await setGradeSantri(riwayatId, grade)
      if (res?.error) {
        setRowStatus(s => ({ ...s, [riwayatId]: 'error' }))
        return
      }
      setRowStatus(s => ({ ...s, [riwayatId]: 'saved' }))
      setTimeout(() => setRowStatus(s => { const c = { ...s }; delete c[riwayatId]; return c }), 1500)
    } catch {
      setRowStatus(s => ({ ...s, [riwayatId]: 'error' }))
    }
  }

  // Masukkan semua yang belum ke satu grade (mis. grading A & B dulu, sisanya C).
  const assignAllBelum = async (grade: Grade) => {
    const ids = belum.map(s => s.riwayat_id)
    if (ids.length === 0) return
    setItems(prev => prev.map(i => i.grade === null ? { ...i, grade } : i))
    const res = await setGradeBanyak(ids, grade)
    if (res?.error) {
      alert(res.error)
      getGradingSekpen(selectedKelas).then(setItems)
    }
  }

  // Drag ala kanban: drop ke kolom grade (targetId=chip tujuan, atau null=akhir kolom).
  // Dalam kolom = reorder. Antar kolom = pindah grade + posisikan.
  const moveToColumn = async (grade: Grade, targetId: string | null) => {
    const id = dragId
    setDragId(null)
    if (!id || id === targetId) return
    const dragged = items.find(i => i.riwayat_id === id)
    if (!dragged) return

    // Urutan baru kolom tujuan: tanpa item yang didrag, sisipkan di posisi target.
    const colIds = byGrade(grade).map(s => s.riwayat_id).filter(x => x !== id)
    let insertAt = colIds.length
    if (targetId) {
      const ti = colIds.indexOf(targetId)
      if (ti >= 0) insertAt = ti
    }
    colIds.splice(insertAt, 0, id)

    const sameGrade = dragged.grade === grade

    // Optimistik: set grade (jika pindah) + urutan kolom tujuan.
    setItems(prev => prev.map(it => {
      const base = it.riwayat_id === id ? { ...it, grade } : it
      const idx = colIds.indexOf(base.riwayat_id)
      return idx >= 0 ? { ...base, urutan: idx } : base
    }))

    // Simpan grade dulu (kalau pindah kolom), lalu urutan.
    if (!sameGrade) {
      setRowStatus(s => ({ ...s, [id]: 'saving' }))
      const res = await setGradeSantri(id, grade)
      if (res?.error) {
        setRowStatus(s => ({ ...s, [id]: 'error' }))
        getGradingSekpen(selectedKelas).then(setItems)
        return
      }
      setRowStatus(s => ({ ...s, [id]: 'saved' }))
      setTimeout(() => setRowStatus(s => { const c = { ...s }; delete c[id]; return c }), 1500)
    }
    simpanUrutanGrade(colIds)
  }

  // Alternatif drag: geser satu posisi naik/turun dalam kolom.
  const move = (grade: Grade, riwayatId: string, dir: 'up' | 'down') => {
    const ids = byGrade(grade).map(s => s.riwayat_id)
    const i = ids.indexOf(riwayatId)
    const j = dir === 'up' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    setItems(prev => prev.map(it => {
      const idx = ids.indexOf(it.riwayat_id)
      return idx >= 0 ? { ...it, urutan: idx } : it
    }))
    simpanUrutanGrade(ids)
  }

  return (
    <div className="space-y-6 w-full pb-24">
      <DashboardPageHeader
        title="Grading (Sekpen)"
        description="Tetapkan grade tiap santri ke kolom A/B/C. Tersimpan otomatis per santri — bisa menimpa vonis wali kelas."
      />

      {/* FILTER KELAS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="w-full md:w-1/3">
          <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Kelas</label>
          <select
            className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={selectedKelas}
            onChange={e => setSelectedKelas(e.target.value)}
          >
            <option value="">-- Pilih Kelas --</option>
            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>
        {toggle}
      </div>

      {!selectedKelas ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <Filter className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-500">Pilih kelas untuk mulai grading</h3>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
          <p className="font-medium">Memuat santri...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm text-slate-400">
          <p className="font-medium">Tidak ada santri aktif di kelas ini.</p>
        </div>
      ) : (
        <>
          {/* 3 KOLOM A / B / C */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {GRADE_COLS.map(col => {
              const list = byGrade(col.key)
              return (
                <div key={col.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className={`px-4 py-3 border-b font-black uppercase tracking-wider text-sm flex items-center justify-between ${col.head}`}>
                    <span>{col.label}</span>
                    <span className="text-xs font-bold opacity-70">{list.length}</span>
                  </div>

                  {/* Combobox tambah santri ke kolom ini (multi-pick, tutup saat klik luar) */}
                  <KolomCombobox colKey={col.key} items={items} onAssign={assign} />

                  {/* Tombol: masukkan semua sisa (yang belum) ke kolom ini */}
                  {belum.length > 0 && (
                    <button
                      onClick={() => assignAllBelum(col.key)}
                      className="mx-3 mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                      Masukkan {belum.length} sisa ke {col.label}
                    </button>
                  )}

                  {/* Daftar chip santri di kolom ini — drag reorder / pindah grade (kanban) */}
                  <div
                    className="p-3 space-y-2 min-h-[120px] flex-1"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => moveToColumn(col.key, null)}
                  >
                    {list.length === 0 ? (
                      <p className="text-xs text-slate-300 italic text-center py-6 pointer-events-none">Seret santri ke sini</p>
                    ) : list.map((s, idx) => (
                      <div
                        key={s.riwayat_id}
                        draggable
                        onDragStart={() => setDragId(s.riwayat_id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.stopPropagation(); moveToColumn(col.key, s.riwayat_id) }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-grab active:cursor-grabbing ${col.chip} ${dragId === s.riwayat_id ? 'opacity-40' : ''}`}
                      >
                        <span className="text-[10px] font-black opacity-50 w-4 text-right shrink-0">{idx + 1}</span>
                        <GripVertical className="w-4 h-4 opacity-40 shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-bold text-sm truncate">{s.nama}</p>
                          <p className="text-[10px] font-mono opacity-60">{s.nis}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {rowStatus[s.riwayat_id] === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {rowStatus[s.riwayat_id] === 'saved' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                          {rowStatus[s.riwayat_id] === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          <button
                            onClick={() => move(col.key, s.riwayat_id, 'up')}
                            disabled={idx === 0}
                            title="Naik"
                            className="text-slate-400 hover:text-indigo-700 hover:bg-white/60 rounded-md p-0.5 disabled:opacity-25 disabled:hover:bg-transparent"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => move(col.key, s.riwayat_id, 'down')}
                            disabled={idx === list.length - 1}
                            title="Turun"
                            className="text-slate-400 hover:text-indigo-700 hover:bg-white/60 rounded-md p-0.5 disabled:opacity-25 disabled:hover:bg-transparent"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => assign(s.riwayat_id, null)}
                            title="Keluarkan dari grade ini"
                            className="text-slate-400 hover:text-red-600 hover:bg-white/60 rounded-md p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* POOL: BELUM ADA GRADE (accordion, di bawah, default terlipat) */}
          {belum.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setPoolOpen(o => !o)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-amber-50"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-sm font-bold text-amber-800">Belum Ada Grade ({belum.length})</span>
                <span className="text-xs text-amber-700/70 hidden sm:inline">— pilih grade lewat tombol untuk menempatkan</span>
                <ChevronDown className={`w-4 h-4 text-amber-600 ml-auto transition-transform ${poolOpen ? 'rotate-180' : ''}`} />
              </button>
              {poolOpen && (
                <div className="flex flex-wrap gap-2 p-4 pt-0">
                  {belum.map(s => (
                    <div key={s.riwayat_id} className="bg-white border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm">
                      <div>
                        <p className="font-bold text-slate-800 text-sm leading-tight">{s.nama}</p>
                        <p className="text-[10px] font-mono text-slate-400">{s.nis}</p>
                      </div>
                      <div className="flex gap-1">
                        {(['A', 'B', 'C'] as Grade[]).map(g => (
                          <button
                            key={g}
                            onClick={() => assign(s.riwayat_id, g)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 text-xs font-black transition-colors"
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                      {rowStatus[s.riwayat_id] === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Combobox custom: pilih banyak santri cepat. Klik nama -> langsung assign (nama hilang),
// dropdown tetap terbuka. Tutup hanya saat klik di luar area combobox.
function KolomCombobox({
  colKey, items, onAssign,
}: {
  colKey: Grade
  items: GradingSekpenItem[]
  onAssign: (riwayatId: string, grade: Grade) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const candidates = items.filter(
    i => i.grade !== colKey && i.nama.toLowerCase().includes(q.trim().toLowerCase())
  )

  return (
    <div ref={ref} className="p-3 border-b border-slate-100 relative">
      <input
        type="text"
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Ketik / pilih nama…"
        className="w-full p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
      />
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {candidates.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400 italic">Tidak ada santri</p>
          ) : candidates.map(i => (
            <button
              key={i.riwayat_id}
              type="button"
              onClick={() => onAssign(i.riwayat_id, colKey)}
              className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm flex items-center gap-2"
            >
              <span className="font-semibold text-slate-800">{i.nama}</span>
              <span className="text-[10px] font-mono text-slate-400">{i.nis}</span>
              {i.grade && <span className="ml-auto text-[10px] font-bold text-slate-400">[{i.grade}]</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
