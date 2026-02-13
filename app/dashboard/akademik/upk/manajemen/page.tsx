'use client'

import { useState, useEffect } from 'react'
import { getListTransaksi, getRekapGudang, serahkanBarang, serahkanBarangPartial, selesaikanKeuangan } from './actions'
// PERBAIKAN: Menambahkan 'Calendar' ke dalam import
import { Search, Package, CheckCircle, AlertCircle, ShoppingBag, Truck, DollarSign, RefreshCw, Loader2, Printer, X, CheckSquare, Square, Calendar, ArrowRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

export default function ManajemenUPKPage() {
  const [tab, setTab] = useState<'DISTRIBUSI' | 'GUDANG'>('DISTRIBUSI')
  
  // State Distribusi
  const [listTrx, setListTrx] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('SEMUA')
  const [loading, setLoading] = useState(false)

  // State Modal Partial Delivery
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTrx, setSelectedTrx] = useState<any>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([]) 
  const [isProcessing, setIsProcessing] = useState(false)

  // State Gudang
  const [rekapGudang, setRekapGudang] = useState<any[]>([])

  // State Mobile View (List vs Detail) - Opsional, jika mau detail full screen di HP
  // Saat ini pakai Card di list utama sudah cukup mobile friendly.

  useEffect(() => {
    if (tab === 'DISTRIBUSI') loadDistribusi()
    if (tab === 'GUDANG') loadGudang()
  }, [tab, filterStatus]) 

  const loadDistribusi = async () => {
    setLoading(true)
    const res = await getListTransaksi(search, filterStatus)
    setListTrx(res)
    setLoading(false)
  }

  const loadGudang = async () => {
    setLoading(true)
    const res = await getRekapGudang()
    setRekapGudang(res)
    setLoading(false)
  }

  // --- ACTIONS ---
  
  const openSerahModal = (trx: any) => {
      setSelectedTrx(trx)
      const pendingItems = trx.items_detail.filter((i:any) => i.status_serah === 'BELUM')
      setSelectedItems(pendingItems.map((i:any) => i.id))
      setIsModalOpen(true)
  }

  const toggleItemSelection = (itemId: string) => {
      if (selectedItems.includes(itemId)) {
          setSelectedItems(prev => prev.filter(id => id !== itemId))
      } else {
          setSelectedItems(prev => [...prev, itemId])
      }
  }

  const handleProcessSerah = async () => {
      if (selectedItems.length === 0) return toast.warning("Pilih minimal satu kitab")
      
      setIsProcessing(true)
      const res = await serahkanBarangPartial(selectedItems)
      setIsProcessing(false)
      
      if(res?.error) {
          toast.error(res.error)
      } else {
          toast.success("Barang Diserahkan")
          setIsModalOpen(false)
          loadDistribusi()
      }
  }

  const handleLunas = async (id: string, nama: string) => {
    if(!confirm(`Terima pelunasan hutang dari ${nama}?`)) return
    const res = await selesaikanKeuangan(id, 'LUNAS')
    if(res?.error) toast.error(res.error)
    else { toast.success("Hutang Lunas"); loadDistribusi(); }
  }

  const handleAmbilKembalian = async (id: string, nama: string) => {
    if(!confirm(`Serahkan uang kembalian kepada ${nama}?`)) return
    const res = await selesaikanKeuangan(id, 'AMBIL_KEMBALIAN')
    if(res?.error) toast.error(res.error)
    else { toast.success("Kembalian Diserahkan"); loadDistribusi(); }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Package className="w-6 h-6 text-orange-600"/> Manajemen UPK
           </h1>
           <p className="text-gray-500 text-sm">Distribusi kitab, penyelesaian keuangan, dan rekap belanja.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
           <button onClick={() => setTab('DISTRIBUSI')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${tab === 'DISTRIBUSI' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             <Truck className="w-4 h-4"/> Distribusi
           </button>
           <button onClick={() => setTab('GUDANG')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${tab === 'GUDANG' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             <ShoppingBag className="w-4 h-4"/> Gudang
           </button>
        </div>
      </div>

      {/* --- TAB 1: DISTRIBUSI & KEUANGAN --- */}
      {tab === 'DISTRIBUSI' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
           
           {/* FILTER */}
           <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input 
                    placeholder="Cari Pemesan..." 
                    className="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadDistribusi()}
                  />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                 <button onClick={()=>setFilterStatus('SEMUA')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap flex-shrink-0 ${filterStatus === 'SEMUA' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white text-gray-500'}`}>Semua</button>
                 <button onClick={()=>setFilterStatus('PENDING_BARANG')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap flex-shrink-0 ${filterStatus === 'PENDING_BARANG' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white text-gray-500'}`}>Belum Terima</button>
                 <button onClick={()=>setFilterStatus('HUTANG')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap flex-shrink-0 ${filterStatus === 'HUTANG' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white text-gray-500'}`}>Hutang</button>
                 <button onClick={()=>setFilterStatus('KEMBALIAN')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap flex-shrink-0 ${filterStatus === 'KEMBALIAN' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white text-gray-500'}`}>Kembalian</button>
              </div>
              <button onClick={loadDistribusi} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><RefreshCw className="w-4 h-4 text-gray-600"/></button>
           </div>

           {/* LIST TRANSAKSI */}
           {loading ? (
               <div className="text-center py-20 bg-white rounded-xl border"><Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500"/></div>
           ) : listTrx.length === 0 ? (
               <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-dashed">Data tidak ditemukan.</div>
           ) : (
               <div className="grid grid-cols-1 gap-4">
                  {listTrx.map(trx => (
                      <div key={trx.id} className="bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                          {/* Header Card */}
                          <div className="flex justify-between items-start mb-3">
                              <div>
                                  <h3 className="font-bold text-gray-800 text-lg">{trx.nama_pemesan}</h3>
                                  <p className="text-xs text-gray-500">{trx.info_tambahan}</p>
                              </div>
                              <div className="text-right">
                                  <span className="text-[10px] text-gray-400 flex items-center gap-1 justify-end">
                                    <Calendar className="w-3 h-3"/> {format(new Date(trx.created_at), 'dd MMM yy')}
                                  </span>
                                  {trx.sisa_tunggakan === 0 && trx.sisa_kembalian === 0 && trx.item_belum === 0 && (
                                     <span className="inline-block mt-1 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold">SELESAI</span>
                                  )}
                              </div>
                          </div>

                          {/* Status Section */}
                          <div className="space-y-2 mb-4">
                              {/* Status Barang */}
                              {trx.item_belum > 0 ? (
                                 <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                                    <div className="flex items-center gap-2 text-blue-700 font-bold text-xs mb-1">
                                        <Package className="w-3 h-3"/> Belum Terima: {trx.item_belum} Item
                                    </div>
                                    <p className="text-[10px] text-blue-600 italic">{trx.list_barang_belum}</p>
                                 </div>
                              ) : (
                                 <div className="flex items-center gap-1 text-green-600 text-xs font-bold bg-green-50 p-2 rounded-lg w-fit">
                                    <CheckCircle className="w-3 h-3"/> Barang Sudah Diterima
                                 </div>
                              )}

                              {/* Status Keuangan */}
                              <div className="flex flex-wrap gap-2">
                                {trx.sisa_tunggakan > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">
                                        <AlertCircle className="w-3 h-3"/> Hutang: Rp {trx.sisa_tunggakan.toLocaleString()}
                                    </span>
                                )}
                                {trx.sisa_kembalian > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100">
                                        <DollarSign className="w-3 h-3"/> Kembali: Rp {trx.sisa_kembalian.toLocaleString()}
                                    </span>
                                )}
                              </div>
                          </div>

                          {/* Actions Footer */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t">
                              {trx.item_belum > 0 && (
                                  <button onClick={() => openSerahModal(trx)} className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 active:scale-95 transition-transform">
                                     <Truck className="w-3 h-3"/> Serahkan Barang
                                  </button>
                              )}
                              
                              {trx.sisa_tunggakan > 0 && (
                                  <button onClick={() => handleLunas(trx.id, trx.nama_pemesan)} className="flex items-center justify-center gap-2 w-full bg-red-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-red-700 active:scale-95 transition-transform">
                                     <DollarSign className="w-3 h-3"/> Lunasi Hutang
                                  </button>
                              )}
                              
                              {trx.sisa_kembalian > 0 && (
                                  <button onClick={() => handleAmbilKembalian(trx.id, trx.nama_pemesan)} className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 active:scale-95 transition-transform">
                                     <DollarSign className="w-3 h-3"/> Beri Kembalian
                                  </button>
                              )}
                          </div>
                      </div>
                  ))}
               </div>
           )}
        </div>
      )}

      {/* --- TAB 2: GUDANG (REKAP BELANJA) --- */}
      {tab === 'GUDANG' && (
         <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
            
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                <div className="bg-blue-200 p-3 rounded-full text-blue-700"><Printer className="w-6 h-6"/></div>
                <div>
                    <h3 className="font-bold text-blue-900 text-lg">Rekap Kebutuhan Belanja</h3>
                    <p className="text-sm text-blue-700 mt-1 mb-3">
                        Daftar kitab yang <b>sudah dipesan santri tapi barangnya belum ada/belum diserahkan</b>.
                        <br/>Gunakan data ini sebagai acuan belanja ke toko kitab.
                    </p>
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow hover:bg-blue-700 w-full sm:w-auto">
                        Cetak Laporan
                    </button>
                </div>
            </div>

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                {/* Tampilan Desktop: Tabel */}
                <div className="hidden md:block">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                            <tr>
                                <th className="p-4">Nama Kitab</th>
                                <th className="p-4">Marhalah</th>
                                <th className="p-4 text-center">Jumlah Butuh</th>
                                <th className="p-4 text-center">Jatah Gratis</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? <tr><td colSpan={4} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></td></tr> : 
                             rekapGudang.length === 0 ? <tr><td colSpan={4} className="text-center py-10 text-gray-400">Stok Aman.</td></tr> :
                             rekapGudang.map((item: any) => (
                                 <tr key={item.id} className="hover:bg-gray-50">
                                     <td className="p-4 font-bold text-gray-800">{item.nama}</td>
                                     <td className="p-4 text-gray-500">{item.marhalah}</td>
                                     <td className="p-4 text-center">
                                         <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-extrabold text-sm">
                                            {item.total_butuh} Pcs
                                         </span>
                                     </td>
                                     <td className="p-4 text-center text-gray-500">
                                         {item.total_gratis > 0 ? <span className="text-green-600 font-bold">{item.total_gratis} Gratis</span> : '-'}
                                     </td>
                                 </tr>
                             ))
                            }
                        </tbody>
                    </table>
                </div>

                {/* Tampilan Mobile: List Card Simple */}
                <div className="md:hidden divide-y">
                    {loading ? <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></div> : 
                     rekapGudang.length === 0 ? <div className="text-center py-10 text-gray-400">Stok Aman.</div> :
                     rekapGudang.map((item: any) => (
                         <div key={item.id} className="p-4 flex justify-between items-center">
                             <div>
                                 <p className="font-bold text-gray-800">{item.nama}</p>
                                 <p className="text-xs text-gray-500">{item.marhalah}</p>
                                 {item.total_gratis > 0 && <p className="text-[10px] text-green-600 mt-1">Termasuk {item.total_gratis} gratis</p>}
                             </div>
                             <div className="text-right">
                                 <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold text-sm block">
                                     {item.total_butuh}
                                 </span>
                             </div>
                         </div>
                     ))
                    }
                </div>
            </div>
         </div>
      )}

      {/* MODAL SERAH TERIMA PARTIAL */}
      {isModalOpen && selectedTrx && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
              <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                 <div>
                    <h3 className="text-lg font-bold text-gray-800">Serah Terima Kitab</h3>
                    <p className="text-xs text-gray-500">{selectedTrx.nama_pemesan}</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-400"/></button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1 space-y-2">
                 <p className="text-xs font-bold text-blue-600 mb-2 uppercase">Centang barang yang ada:</p>
                 {selectedTrx.items_detail
                    .filter((item: any) => item.status_serah === 'BELUM')
                    .map((item: any) => (
                        <div 
                            key={item.id} 
                            onClick={() => toggleItemSelection(item.id)}
                            className={`p-3 border rounded-lg cursor-pointer flex justify-between items-center transition-colors ${selectedItems.includes(item.id) ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'}`}
                        >
                            <span className="text-sm font-medium text-gray-700">{item.kitab?.nama_kitab}</span>
                            {selectedItems.includes(item.id) 
                                ? <CheckSquare className="w-5 h-5 text-blue-600"/>
                                : <Square className="w-5 h-5 text-gray-300"/>
                            }
                        </div>
                    ))
                 }
                 {selectedTrx.items_detail.every((i:any) => i.status_serah === 'SUDAH') && (
                     <div className="text-center py-10 text-green-600 font-bold">Semua barang sudah diserahkan!</div>
                 )}
              </div>

              <div className="p-4 border-t bg-gray-50 flex gap-2">
                  <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 text-gray-600 font-bold border rounded-lg hover:bg-gray-100 text-sm">Batal</button>
                  <button 
                    onClick={handleProcessSerah} 
                    disabled={isProcessing || selectedItems.length === 0}
                    className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Truck className="w-4 h-4"/>}
                    Serahkan ({selectedItems.length})
                  </button>
              </div>
           </div>
         </div>
      )}

    </div>
  )
}