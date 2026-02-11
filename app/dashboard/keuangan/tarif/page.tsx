'use client'

import { useState, useEffect } from 'react'
import { getDaftarTarif, getTarifByTahun, simpanTarif } from './actions'
import { Save, Settings, DollarSign, History, Loader2, Edit } from 'lucide-react'
import { toast } from 'sonner'

export default function TarifPage() {
  // State Form
  const [tahunInput, setTahunInput] = useState(new Date().getFullYear())
  const [nominal, setNominal] = useState({
    BANGUNAN: 0,
    KESEHATAN: 0,
    EHB: 0,
    EKSKUL: 0
  })
  
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // State List
  const [listTarif, setListTarif] = useState<any[]>([])

  // Init Load List
  useEffect(() => {
    refreshList()
  }, [])

  // Auto Load saat Tahun diubah (Cek apakah sudah ada tarif?)
  useEffect(() => {
    async function checkExisting() {
        setLoading(true)
        const res = await getTarifByTahun(tahunInput)
        setNominal(res)
        setLoading(false)
    }
    checkExisting()
  }, [tahunInput])

  const refreshList = async () => {
    const data = await getDaftarTarif()
    setListTarif(data)
  }

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const toastId = toast.loading("Menyimpan tarif...")

    const res = await simpanTarif(tahunInput, nominal)
    
    setIsSaving(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal", { description: res.error })
    } else {
        toast.success("Tarif Berhasil Disimpan", { description: `Angkatan ${tahunInput} telah diperbarui.` })
        refreshList()
    }
  }

  // Format Rupiah Helper
  const rp = (val: number) => "Rp " + (val || 0).toLocaleString('id-ID')

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <div className="bg-emerald-100 p-3 rounded-full text-emerald-700">
          <Settings className="w-6 h-6"/>
        </div>
        <div>
           <h1 className="text-2xl font-bold text-gray-800">Pengaturan Tarif Angkatan</h1>
           <p className="text-gray-500 text-sm">Tentukan besaran biaya masuk & tahunan berdasarkan tahun masuk santri.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* KOLOM KIRI: FORM INPUT */}
         <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-24">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                    <Edit className="w-5 h-5 text-emerald-600"/> Edit / Baru
                </h3>
                
                <form onSubmit={handleSimpan} className="space-y-5">
                    
                    {/* Tahun Selector */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tahun Angkatan (Masuk)</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setTahunInput(t => t - 1)} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 font-bold">-</button>
                            <input 
                                type="number" 
                                className="flex-1 text-center font-bold text-lg border rounded bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500"
                                value={tahunInput}
                                onChange={(e) => setTahunInput(Number(e.target.value))}
                            />
                            <button type="button" onClick={() => setTahunInput(t => t + 1)} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 font-bold">+</button>
                        </div>
                    </div>

                    <hr className="border-dashed"/>

                    {/* Input Biaya */}
                    {loading ? (
                        <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400"/></div>
                    ) : (
                        <>
                            <InputDuit label="Uang Bangunan (Sekali)" value={nominal.BANGUNAN} onChange={v => setNominal({...nominal, BANGUNAN: v})} />
                            <InputDuit label="Infaq Kesehatan (Tahunan)" value={nominal.KESEHATAN} onChange={v => setNominal({...nominal, KESEHATAN: v})} />
                            <InputDuit label="Uang EHB (Tahunan)" value={nominal.EHB} onChange={v => setNominal({...nominal, EHB: v})} />
                            <InputDuit label="Ekstrakurikuler (Tahunan)" value={nominal.EKSKUL} onChange={v => setNominal({...nominal, EKSKUL: v})} />
                        </>
                    )}

                    <button 
                        disabled={isSaving || loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-transform active:scale-95"
                    >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                        SIMPAN TARIF
                    </button>

                </form>
            </div>
         </div>

         {/* KOLOM KANAN: TABEL RIWAYAT */}
         <div className="lg:col-span-2">
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <History className="w-5 h-5"/> Daftar Tarif Tersimpan
                    </h3>
                </div>
                
                {listTarif.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 italic">Belum ada data tarif yang diatur.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-500 border-b uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4">Angkatan</th>
                                    <th className="px-6 py-4 text-right">Bangunan</th>
                                    <th className="px-6 py-4 text-right">Kesehatan</th>
                                    <th className="px-6 py-4 text-right">EHB</th>
                                    <th className="px-6 py-4 text-right">Ekskul</th>
                                    <th className="px-4 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {listTarif.map((item: any) => (
                                    <tr key={item.tahun} className={`hover:bg-emerald-50 transition-colors ${item.tahun === tahunInput ? 'bg-emerald-50/50' : ''}`}>
                                        <td className="px-6 py-4 font-bold text-lg text-emerald-800">{item.tahun}</td>
                                        <td className="px-6 py-4 text-right font-mono">{rp(item.BANGUNAN)}</td>
                                        <td className="px-6 py-4 text-right font-mono">{rp(item.KESEHATAN)}</td>
                                        <td className="px-6 py-4 text-right font-mono">{rp(item.EHB)}</td>
                                        <td className="px-6 py-4 text-right font-mono">{rp(item.EKSKUL)}</td>
                                        <td className="px-4 py-4 text-center">
                                            <button 
                                                onClick={() => setTahunInput(item.tahun)}
                                                className="text-xs bg-white border border-emerald-200 text-emerald-600 px-3 py-1 rounded-full hover:bg-emerald-600 hover:text-white transition-colors"
                                            >
                                                Edit
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
    </div>
  )
}

// Sub Component: Input Duit
function InputDuit({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
    return (
        <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{label}</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 font-bold">Rp</span>
                </div>
                <input 
                    type="text" // Text biar bisa format ribuan kalau mau (tapi raw number dulu biar simpel)
                    className="w-full pl-10 pr-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-right"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                />
            </div>
        </div>
    )
}