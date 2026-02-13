'use client'

import { useState, useEffect } from 'react'
import { getDaftarKitab, cariSantri, simpanTransaksiUPK } from './actions'
import { Search, ShoppingCart, User, Package, Check, Trash2, Loader2, Save, Gift, X, ArrowRight, ArrowLeft, BookOpen } from 'lucide-react'
import { toast } from 'sonner'

export default function KasirUPKPage() {
  // Data Master
  const [katalog, setKatalog] = useState<Record<string, any[]>>({})
  const [loadingKatalog, setLoadingKatalog] = useState(true)

  // State Transaksi
  const [modeUser, setModeUser] = useState<'SANTRI' | 'UMUM'>('SANTRI')
  const [search, setSearch] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [namaUmum, setNamaUmum] = useState('')
  
  // Keranjang
  const [cart, setCart] = useState<any[]>([])
  
  // Pembayaran
  const [uangBayar, setUangBayar] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // State Mobile View
  // DEFAULT: CART (Agar user input nama dulu di HP)
  const [mobileView, setMobileView] = useState<'CATALOG' | 'CART'>('CART')

  // HITUNG TOTAL
  const totalTagihan = cart.reduce((sum, item) => sum + (item.isGratis ? 0 : item.hargaAsli), 0)
  const totalItems = cart.length
  
  // INIT DATA
  useEffect(() => {
    getDaftarKitab().then(data => {
        if (Array.isArray(data) && data.length === 0) {
            setKatalog({})
        } else {
            setKatalog(data as Record<string, any[]>)
        }
        setLoadingKatalog(false)
    })
  }, [])

  // Auto Fill Uang Bayar
  useEffect(() => {
    if (totalTagihan > 0) {
        setUangBayar(totalTagihan.toString())
    } else {
        setUangBayar('')
    }
  }, [totalTagihan])


  // --- LOGIC CART ---
  const addToCart = (kitab: any) => {
    if (cart.some(c => c.id === kitab.id)) return 
    setCart(prev => [...prev, { ...kitab, hargaAsli: kitab.harga, isGratis: false }])
    toast.success("Ditambahkan")
  }

  const addPaket = (listKitab: any[]) => {
    const newItems = listKitab.filter(k => !cart.some(c => c.id === k.id))
        .map(k => ({ ...k, hargaAsli: k.harga, isGratis: false }))
    setCart(prev => [...prev, ...newItems])
    toast.success(`${newItems.length} kitab ditambahkan`)
  }

  const toggleGratis = (id: number) => {
    setCart(prev => prev.map(c => {
        if (c.id === id) return { ...c, isGratis: !c.isGratis }
        return c
    }))
  }

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(c => c.id !== id))
  }

  // --- LOGIC SEARCH SANTRI ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (search.length < 3) return toast.warning("Ketik minimal 3 huruf")
    const res = await cariSantri(search)
    setHasilCari(res)
    if(res.length === 0) toast.info("Tidak ditemukan")
  }

  // --- HITUNG KEMBALIAN/HUTANG ---
  const bayar = parseInt(uangBayar.replace(/\./g, '')) || 0
  const diff = bayar - totalTagihan
  const kembalian = diff > 0 ? diff : 0
  const tunggakan = diff < 0 ? Math.abs(diff) : 0

  // --- SIMPAN ---
  const handleSimpan = async () => {
    if (cart.length === 0) return toast.warning("Keranjang kosong!")
    if (modeUser === 'SANTRI' && !selectedSantri) return toast.warning("Pilih santri dulu!")
    if (modeUser === 'UMUM' && !namaUmum) return toast.warning("Isi nama pemesan!")

    let pesanKonfirmasi = `Total: Rp ${totalTagihan.toLocaleString()}\nBayar: Rp ${bayar.toLocaleString()}`
    if (tunggakan > 0) pesanKonfirmasi += `\n\n⚠️ Sisa Tunggakan: Rp ${tunggakan.toLocaleString()} (Hutang)`
    
    if (!confirm(`Simpan Transaksi?\n${pesanKonfirmasi}`)) return

    setIsSaving(true)
    const toastId = toast.loading("Memproses transaksi...")

    const payload = {
        santriId: selectedSantri?.id || null,
        namaPemesan: selectedSantri ? selectedSantri.nama_lengkap : namaUmum,
        infoTambahan: selectedSantri ? `${selectedSantri.asrama} - ${selectedSantri.kamar}` : 'Umum/Guru',
        totalTagihan,
        totalBayar: bayar,
        items: cart
    }

    const res = await simpanTransaksiUPK(payload)
    setIsSaving(false)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error(res.error)
    } else {
        toast.success("Transaksi Berhasil Disimpan!")
        // Reset Form
        setCart([])
        setUangBayar('')
        setSelectedSantri(null)
        setNamaUmum('')
        setSearch('')
        setHasilCari([])
        setMobileView('CART') // Balik ke input santri
    }
  }

  return (
    <div className="space-y-6 max-w-[95vw] mx-auto pb-32">
      
      {/* HEADER (Sticky Dihapus) */}
      <div className="flex items-center gap-4 border-b pb-4 pt-2">
        <div className="bg-blue-100 p-3 rounded-full text-blue-700 hidden md:block">
            <ShoppingCart className="w-6 h-6"/>
        </div>
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Kasir UPK</h1>
            <p className="text-gray-500 text-sm">Pemesanan & Distribusi Kitab.</p>
        </div>
      </div>

      {/* GRID UTAMA (KIRI: PEMESAN, KANAN: KATALOG) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* KOLOM KIRI (1/3): DATA PEMESAN & KERANJANG (STEP 1) */}
         {/* Di Mobile: Sembunyi jika sedang view CATALOG */}
         <div className={`lg:col-span-1 space-y-6 ${mobileView === 'CATALOG' ? 'hidden lg:block' : 'block'}`}>
            
            {/* Header Step Mobile */}
            <div className="lg:hidden mb-2 bg-blue-50 text-blue-800 px-3 py-2 rounded-lg text-sm font-bold flex justify-between items-center">
                <span>Langkah 1: Data Pemesan</span>
                {cart.length > 0 && <span className="text-xs bg-white px-2 py-0.5 rounded-full border">{cart.length} Item</span>}
            </div>

            {/* 1. DATA PEMESAN */}
            <div className="bg-white p-4 md:p-5 rounded-xl border shadow-sm ring-1 ring-blue-100">
                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <User className="w-4 h-4 text-blue-500"/> Identitas
                </h3>
                <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setModeUser('SANTRI')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${modeUser === 'SANTRI' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>Santri</button>
                    <button onClick={() => setModeUser('UMUM')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${modeUser === 'UMUM' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>Umum/Guru</button>
                </div>

                {modeUser === 'SANTRI' ? (
                    !selectedSantri ? (
                        <div className="relative">
                            <input 
                                className="w-full p-3 border rounded-xl pr-12 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                placeholder="Cari Nama / NIS..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch(e)}
                            />
                            <button onClick={handleSearch} className="absolute right-1 top-1 bottom-1 px-3 bg-blue-600 text-white rounded-lg"><Search className="w-4 h-4"/></button>
                            {hasilCari.length > 0 && (
                                <div className="absolute top-12 w-full bg-white border rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                                    {hasilCari.map(s => (
                                        <div key={s.id} onClick={() => { setSelectedSantri(s); setHasilCari([]); setSearch(''); }} className="p-3 hover:bg-gray-50 cursor-pointer border-b text-sm last:border-0">
                                            <p className="font-bold text-gray-800">{s.nama_lengkap}</p>
                                            <p className="text-xs text-gray-500">{s.asrama}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-green-50 p-3 rounded-xl border border-green-200 flex justify-between items-center animate-in zoom-in-95">
                            <div>
                                <p className="font-bold text-green-900 text-sm">{selectedSantri.nama_lengkap}</p>
                                <p className="text-xs text-green-700">{selectedSantri.asrama} ({selectedSantri.nis})</p>
                            </div>
                            <button onClick={() => setSelectedSantri(null)} className="p-2 hover:bg-green-100 rounded-full"><X className="w-4 h-4 text-green-600"/></button>
                        </div>
                    )
                ) : (
                    <input 
                        className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="Nama Pemesan (Guru/Keluarga)..."
                        value={namaUmum}
                        onChange={e => setNamaUmum(e.target.value)}
                    />
                )}
            </div>

            {/* Tombol Buka Katalog (Mobile Only) */}
            <button 
                onClick={() => setMobileView('CATALOG')}
                className="lg:hidden w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-md flex items-center justify-center gap-2"
            >
                <BookOpen className="w-5 h-5"/> Pilih Kitab (Katalog)
            </button>

            {/* 2. RINCIAN BELANJA (CART) */}
            <div className="bg-white p-0 rounded-xl border shadow-sm overflow-hidden flex flex-col h-auto lg:h-[500px]">
                <div className="bg-gray-50 p-3 border-b font-bold text-gray-700 text-sm flex justify-between items-center">
                    <span>Keranjang</span>
                    <span className="bg-white px-2 py-0.5 rounded text-xs border">{cart.length} Item</span>
                </div>
                
                {/* List Item */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[150px]">
                    {cart.length === 0 && <div className="text-center text-gray-400 py-10 text-sm flex flex-col items-center gap-2"><ShoppingCart className="w-8 h-8 opacity-20"/>Belum ada kitab</div>}
                    {cart.map(item => (
                        <div key={item.id} className={`p-3 rounded-lg border flex justify-between items-center shadow-sm ${item.isGratis ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-gray-800">{item.nama}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className={`text-xs font-mono ${item.isGratis ? 'line-through text-gray-400' : 'text-gray-600 font-bold'}`}>
                                        Rp {item.hargaAsli.toLocaleString()}
                                    </p>
                                    {item.isGratis && <span className="text-[10px] bg-green-200 text-green-800 px-1.5 rounded font-bold">GRATIS</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => toggleGratis(item.id)}
                                    className={`p-2 rounded-lg transition-colors ${item.isGratis ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'}`}
                                    title="Gratiskan Item Ini"
                                >
                                    <Gift className="w-4 h-4"/>
                                </button>
                                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* FOOTER BAYAR (DESKTOP & MOBILE CART VIEW) */}
                <div className="bg-gray-50 p-4 border-t space-y-4">
                    <div className="flex justify-between items-center text-lg font-bold text-gray-800">
                        <span>Total Tagihan</span>
                        <span>Rp {totalTagihan.toLocaleString()}</span>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Uang Diterima</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                            <input 
                                type="number" 
                                className="w-full pl-10 pr-3 py-3 border rounded-xl font-mono text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="0"
                                value={uangBayar}
                                onChange={e => setUangBayar(e.target.value)}
                            />
                        </div>
                    </div>

                    {(kembalian > 0 || tunggakan > 0) && (
                        <div className="flex justify-between text-xs font-bold pt-1">
                            {kembalian > 0 && <span className="text-green-700 bg-green-100 px-3 py-1.5 rounded-lg flex-1 text-center mr-2">Kembali: {kembalian.toLocaleString()}</span>}
                            {tunggakan > 0 && <span className="text-red-700 bg-red-100 px-3 py-1.5 rounded-lg flex-1 text-center">Kurang: {tunggakan.toLocaleString()}</span>}
                        </div>
                    )}

                    <button 
                        onClick={handleSimpan}
                        disabled={isSaving}
                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} 
                        SIMPAN TRANSAKSI
                    </button>
                </div>
            </div>

         </div>

         {/* KOLOM KANAN (2/3): KATALOG KITAB (STEP 2) */}
         {/* Di Mobile: Sembunyi jika sedang view CART */}
         <div className={`lg:col-span-2 space-y-6 ${mobileView === 'CART' ? 'hidden lg:block' : 'block'}`}>
            
            {/* Navigasi Mobile Back */}
            <div className="lg:hidden flex items-center gap-2 mb-4">
                <button onClick={() => setMobileView('CART')} className="flex items-center gap-2 text-sm font-bold text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                    <ArrowLeft className="w-4 h-4"/> Kembali ke Kasir
                </button>
                <div className="flex-1 text-right text-xs text-blue-600 font-bold">
                    Keranjang: {cart.length} Item
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="bg-gray-50 p-4 border-b font-bold text-gray-700 flex justify-between items-center sticky top-0 z-10">
                    <span>Katalog Kitab</span>
                    <span className="text-xs font-normal bg-white border px-2 py-1 rounded hidden sm:inline-block">Klik untuk tambah</span>
                </div>
                
                <div className="p-2 md:p-4 h-[calc(100vh-200px)] lg:h-[600px] overflow-y-auto space-y-4 md:space-y-6 scroll-smooth">
                    {loadingKatalog ? (
                        <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400"/></div>
                    ) : (
                        Object.entries(katalog).map(([marhalah, items]) => (
                            <div key={marhalah} className="border rounded-lg overflow-hidden shadow-sm">
                                <div className="bg-blue-50/80 p-3 flex justify-between items-center px-4">
                                    <h3 className="font-bold text-blue-900 text-sm">{marhalah}</h3>
                                    <button 
                                        onClick={() => addPaket(items)}
                                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 flex items-center gap-1 shadow-sm active:scale-95"
                                    >
                                        <Package className="w-3 h-3"/> Paket
                                    </button>
                                </div>
                                <div className="divide-y bg-white">
                                    {items.map(k => {
                                        const isInCart = cart.some(c => c.id === k.id)
                                        return (
                                            <div 
                                                key={k.id} 
                                                onClick={() => !isInCart && addToCart(k)}
                                                className={`p-3 md:p-4 flex justify-between items-center cursor-pointer transition-colors active:bg-blue-50 ${isInCart ? 'bg-gray-50/80 opacity-60 cursor-default' : 'hover:bg-blue-50'}`}
                                            >
                                                <span className="text-sm font-medium text-gray-800 line-clamp-2">{k.nama}</span>
                                                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 ml-2">
                                                    <span className="text-sm font-mono font-bold text-gray-600">
                                                        {k.harga > 0 ? (k.harga / 1000) + 'k' : 'Free'}
                                                    </span>
                                                    {isInCart ? <Check className="w-5 h-5 text-green-600"/> : <div className="w-5 h-5 rounded-full border border-gray-300"></div>}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
         </div>

      </div>

    </div>
  )
}