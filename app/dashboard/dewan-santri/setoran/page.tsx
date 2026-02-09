'use client'

import { useState, useEffect } from 'react'
import { getDetailSetoranBulan, terimaSetoran, batalkanSetoran } from './actions'
import { Loader2, CheckCircle, XCircle, Calendar, ArrowLeft, ChevronDown, ChevronRight, DollarSign, Edit, Save, Trash2, AlertCircle, User } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

export default function MonitoringSetoranPage() {
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [expandedBulan, setExpandedBulan] = useState<number | null>(new Date().getMonth() + 1)
  
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-6 h-6 text-gray-600"/></Link>
            <div>
            <h1 className="text-2xl font-bold text-gray-800">Audit Setoran Asrama</h1>
            <p className="text-gray-500 text-sm">Rekonsiliasi uang masuk sistem vs uang fisik diterima.</p>
            </div>
        </div>

        <div className="flex items-center gap-2 bg-white border rounded-lg p-1 shadow-sm">
            <button onClick={() => setTahun(t => t - 1)} className="px-3 py-1 hover:bg-gray-100 rounded text-sm font-bold">-</button>
            <span className="px-2 font-mono font-bold text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4"/> {tahun}
            </span>
            <button onClick={() => setTahun(t => t + 1)} className="px-3 py-1 hover:bg-gray-100 rounded text-sm font-bold">+</button>
        </div>
      </div>

      {/* LIST BULAN (ACCORDION) */}
      <div className="space-y-4">
        {BULAN_LIST.map((namaBulan, idx) => {
           const bulanNum = idx + 1
           const isOpen = expandedBulan === bulanNum

           return (
             <div key={bulanNum} className={`bg-white rounded-xl border transition-all ${isOpen ? 'ring-2 ring-blue-500 shadow-md' : 'shadow-sm hover:border-blue-300'}`}>
                
                {/* HEADER BULAN */}
                <button 
                  onClick={() => setExpandedBulan(isOpen ? null : bulanNum)}
                  className="w-full flex items-center justify-between p-4"
                >
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isOpen ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                         <Calendar className="w-5 h-5"/>
                      </div>
                      <span className="font-bold text-lg text-gray-800">{namaBulan}</span>
                   </div>
                   
                   {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400"/> : <ChevronRight className="w-5 h-5 text-gray-400"/>}
                </button>

                {/* CONTENT DETAIL (LAZY LOAD COMPONENT) */}
                {isOpen && (
                   <DetailBulan bulan={bulanNum} tahun={tahun} />
                )}

             </div>
           )
        })}
      </div>
    </div>
  )
}

// --- SUB-COMPONENT: Detail Tabel per Bulan ---
function DetailBulan({ bulan, tahun }: { bulan: number, tahun: number }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // State Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAsrama, setSelectedAsrama] = useState<any>(null)
  const [inputAktual, setInputAktual] = useState(0)
  const [inputPenyetor, setInputPenyetor] = useState('')
  const [inputCatatan, setInputCatatan] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [bulan, tahun])

  const loadData = async () => {
    setLoading(true)
    const res = await getDetailSetoranBulan(bulan, tahun)
    setData(res)
    setLoading(false)
  }

  // --- HANDLERS ---
  const handleOpenForm = (item: any) => {
    setSelectedAsrama(item)
    setInputAktual(item.is_done ? item.total_aktual : item.total_sistem) 
    setInputPenyetor(item.penyetor !== '-' ? item.penyetor : '')
    setInputCatatan(item.catatan || '')
    setIsModalOpen(true)
  }

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const loadingToast = toast.loading("Menyimpan setoran...")
    
    // Server action otomatis mengambil ID user login sebagai penerima
    const res = await terimaSetoran(
        selectedAsrama.asrama, 
        bulan, 
        tahun, 
        selectedAsrama.total_sistem,
        inputAktual, 
        inputPenyetor,
        inputCatatan
    )

    toast.dismiss(loadingToast)
    setIsSaving(false)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Setoran Diterima!")
        setIsModalOpen(false)
        loadData()
    }
  }

  const handleBatal = async (item: any) => {
    if (!confirm(`Batalkan/Hapus data setoran ${item.asrama}?`)) return
    const res = await batalkanSetoran(item.asrama, bulan, tahun)
    if (res?.success) {
        toast.success("Data dihapus")
        loadData()
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400 flex justify-center items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Memuat data transaksi...</div>

  return (
    <div className="border-t p-4 bg-gray-50/50 animate-in slide-in-from-top-2">
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-4 py-3">Asrama</th>
                <th className="px-4 py-3 text-right">Target (Sistem)</th>
                <th className="px-4 py-3 text-right">Aktual (Disetor)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Penyetor & Penerima</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                  <tr key={row.asrama} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800">{row.asrama}</td>
                    
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                        Rp {row.total_sistem.toLocaleString('id-ID')}
                    </td>

                    <td className={`px-4 py-3 text-right font-mono font-bold ${
                        row.status === 'MATCH' ? 'text-green-600' :
                        row.status === 'MINUS' ? 'text-red-600' :
                        row.status === 'PLUS' ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                        {row.is_done ? `Rp ${row.total_aktual.toLocaleString('id-ID')}` : '-'}
                    </td>

                    <td className="px-4 py-3 text-center">
                        <StatusBadge status={row.status} />
                    </td>

                    <td className="px-4 py-3 text-xs">
                        <div className="font-bold text-slate-700">{row.penyetor}</div>
                        {row.is_done && (
                          <div className="text-[10px] text-green-600 font-medium flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3"/> Diterima: {row.penerima || 'Sistem'}
                          </div>
                        )}
                        {row.catatan && <span className="block text-[10px] text-orange-600 italic max-w-[150px] truncate mt-0.5">{row.catatan}</span>}
                    </td>

                    <td className="px-4 py-3 text-right">
                        {row.is_done ? (
                          <div className="flex justify-end gap-1">
                              <button onClick={() => handleOpenForm(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit"><Edit className="w-4 h-4"/></button>
                              <button onClick={() => handleBatal(row)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Hapus"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        ) : (
                          <button 
                              onClick={() => handleOpenForm(row)}
                              disabled={row.total_sistem === 0}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              Terima Uang
                          </button>
                        )}
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FORM TERIMA UANG */}
      {isModalOpen && selectedAsrama && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b bg-gray-50">
                 <h3 className="text-lg font-bold text-gray-800">Terima Setoran: {selectedAsrama.asrama}</h3>
                 <p className="text-sm text-gray-500">Rekonsiliasi uang fisik dengan sistem.</p>
              </div>
              
              <form onSubmit={handleSimpan} className="p-6 space-y-4">
                 
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">Total Tercatat di Sistem</p>
                    <p className="text-2xl font-extrabold text-blue-800 font-mono">Rp {selectedAsrama.total_sistem.toLocaleString('id-ID')}</p>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Uang Fisik Diterima (Rp)</label>
                    <input 
                        type="number" 
                        required
                        className="w-full p-3 border-2 border-gray-200 rounded-xl font-bold text-lg focus:border-green-500 outline-none"
                        value={inputAktual}
                        onChange={(e) => setInputAktual(Number(e.target.value))}
                    />
                    {/* Indikator Selisih Realtime */}
                    {inputAktual !== selectedAsrama.total_sistem && (
                        <p className={`text-xs mt-1 font-bold ${inputAktual < selectedAsrama.total_sistem ? 'text-red-500' : 'text-blue-500'}`}>
                            {inputAktual < selectedAsrama.total_sistem ? `Kurang Rp ${(selectedAsrama.total_sistem - inputAktual).toLocaleString()}` : `Lebih Rp ${(inputAktual - selectedAsrama.total_sistem).toLocaleString()}`}
                        </p>
                    )}
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Penyetor (Pengurus)</label>
                    <input 
                        type="text" 
                        required
                        placeholder="Contoh: Ustadz Ahmad"
                        className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                        value={inputPenyetor}
                        onChange={(e) => setInputPenyetor(e.target.value)}
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Catatan (Opsional)</label>
                    <textarea 
                        className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        placeholder="Alasan selisih, dll..."
                        rows={2}
                        value={inputCatatan}
                        onChange={(e) => setInputCatatan(e.target.value)}
                    />
                 </div>

                 <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                    <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-200 disabled:opacity-70">
                        {isSaving ? "Menyimpan..." : "Simpan & Terima"}
                    </button>
                 </div>

              </form>
           </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'MATCH') return <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold"><CheckCircle className="w-3 h-3"/> PAS</span>
    if (status === 'MINUS') return <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold"><XCircle className="w-3 h-3"/> KURANG</span>
    if (status === 'PLUS') return <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold"><DollarSign className="w-3 h-3"/> LEBIH</span>
    if (status === 'EMPTY') return <span className="text-gray-400 text-[10px] italic">Kosong</span>
    return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-[10px] font-bold">BELUM</span>
}