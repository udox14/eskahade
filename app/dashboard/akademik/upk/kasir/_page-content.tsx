'use client'

import React, { useState, useEffect } from 'react'
import { getDaftarKitab, cariSantri, simpanTransaksiUPK } from './actions'
import { Search, ShoppingCart, User, Package, Check, Trash2, Loader2, Save, Gift, X, ArrowLeft, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function KasirUPKPage() {
  const confirm = useConfirm()
  const [katalog, setKatalog] = useState<Record<string, any[]>>({})
  const [loadingKatalog, setLoadingKatalog] = useState(true)
  const [modeUser, setModeUser] = useState<'SANTRI' | 'UMUM'>('SANTRI')
  const [search, setSearch] = useState('')
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [selectedSantri, setSelectedSantri] = useState<any>(null)
  const [namaUmum, setNamaUmum] = useState('')
  const [cart, setCart] = useState<any[]>([])
  const [uangBayar, setUangBayar] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [mobileView, setMobileView] = useState<'CATALOG' | 'CART'>('CART')

  const totalTagihan = cart.reduce((sum, item) => sum + (item.isGratis ? 0 : item.hargaAsli), 0)

  useEffect(() => {
    getDaftarKitab().then(data => {
      setKatalog(Array.isArray(data) && data.length === 0 ? {} : data as Record<string, any[]>)
      setLoadingKatalog(false)
    })
  }, [])

  useEffect(() => {
    if (totalTagihan > 0) setUangBayar(totalTagihan.toString())
    else setUangBayar('')
  }, [totalTagihan])

  const addToCart = (kitab: any) => {
    if (cart.some(c => c.id === kitab.id)) return
    setCart(prev => [...prev, { ...kitab, hargaAsli: kitab.harga, isGratis: false }])
    toast.success("Ditambahkan ke keranjang")
  }
  const addPaket = (listKitab: any[]) => {
    const newItems = listKitab.filter(k => !cart.some(c => c.id === k.id)).map(k => ({ ...k, hargaAsli: k.harga, isGratis: false }))
    setCart(prev => [...prev, ...newItems]); toast.success(`${newItems.length} kitab ditambahkan`)
  }
  const toggleGratis = (id: number) => setCart(prev => prev.map(c => c.id === id ? { ...c, isGratis: !c.isGratis } : c))
  const removeFromCart = (id: number) => setCart(prev => prev.filter(c => c.id !== id))

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (search.length < 3) return toast.warning("Ketik minimal 3 huruf")
    const res = await cariSantri(search)
    setHasilCari(res)
    if (res.length === 0) toast.info("Tidak ditemukan")
  }

  const bayar = parseInt(uangBayar.replace(/\./g, '')) || 0
  const diff = bayar - totalTagihan
  const kembalian = diff > 0 ? diff : 0
  const tunggakan = diff < 0 ? Math.abs(diff) : 0

  const handleSimpan = async () => {
    if (cart.length === 0) return toast.warning("Keranjang kosong!")
    if (modeUser === 'SANTRI' && !selectedSantri) return toast.warning("Pilih santri dulu!")
    if (modeUser === 'UMUM' && !namaUmum) return toast.warning("Isi nama pemesan!")
    let pesanKonfirmasi = `Total: Rp ${totalTagihan.toLocaleString()}\nBayar: Rp ${bayar.toLocaleString()}`
    if (tunggakan > 0) pesanKonfirmasi += `\n\n⚠️ Sisa: Rp ${tunggakan.toLocaleString()} (Hutang)`
    if (!await confirm(`Simpan Transaksi?\n${pesanKonfirmasi}`)) return
    setIsSaving(true)
    const toastId = toast.loading("Memproses transaksi...")
    const payload = { santriId: selectedSantri?.id || null, namaPemesan: selectedSantri ? selectedSantri.nama_lengkap : namaUmum, infoTambahan: selectedSantri ? `${selectedSantri.asrama} - ${selectedSantri.kamar}` : 'Umum/Guru', totalTagihan, totalBayar: bayar, items: cart }
    const res = await simpanTransaksiUPK(payload)
    setIsSaving(false); toast.dismiss(toastId)
    if ('error' in res) {
      toast.error((res as any).error)
    } else {
      toast.success("Transaksi Berhasil Disimpan!")
      setCart([]); setUangBayar(''); setSelectedSantri(null); setNamaUmum(''); setSearch(''); setHasilCari([]); setMobileView('CART')
    }
  }

  return (
    <div className="space-y-5 max-w-[95vw] mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600"><ShoppingCart className="w-5 h-5"/></div>
        <div>
          <h1 className="text-xl font-black text-foreground">Kasir UPK</h1>
          <p className="text-sm text-muted-foreground">Pemesanan & Distribusi Kitab.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT: Data Pemesan & Cart */}
        <div className={cn('lg:col-span-1 space-y-4', mobileView === 'CATALOG' ? 'hidden lg:block' : 'block')}>

          {/* Mobile Step Indicator */}
          <div className="lg:hidden bg-blue-500/10 border border-blue-400/20 px-3 py-2 rounded-xl text-sm font-bold text-blue-700 dark:text-blue-400 flex justify-between items-center">
            <span>Langkah 1: Data Pemesan</span>
            {cart.length > 0 && <Badge className="bg-blue-600/20 text-blue-700 font-black border-none">{cart.length} Item</Badge>}
          </div>

          {/* Identitas */}
          <Card className="border-blue-400/30 shadow-sm">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><User className="w-3.5 h-3.5 text-blue-500"/> Identitas Pemesan</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {/* Mode Toggle */}
              <div className="flex gap-1 bg-muted/50 border border-border p-1.5 rounded-xl">
                {(['SANTRI', 'UMUM'] as const).map(m => (
                  <button key={m} onClick={() => setModeUser(m)}
                    className={cn('flex-1 py-2 text-xs font-black rounded-lg transition-all', modeUser === m ? 'bg-background shadow-sm text-blue-700' : 'text-muted-foreground hover:text-foreground')}>
                    {m === 'SANTRI' ? 'Santri' : 'Umum/Guru'}
                  </button>
                ))}
              </div>

              {modeUser === 'SANTRI' ? (
                !selectedSantri ? (
                  <div className="relative">
                    <form onSubmit={handleSearch} className="flex gap-2">
                      <Input
                        className="pr-12 focus-visible:ring-blue-500 shadow-none bg-muted/20"
                        placeholder="Cari Nama / NIS..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                      <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-700 rounded-xl shrink-0"><Search className="w-4 h-4"/></Button>
                    </form>
                    {hasilCari.length > 0 && (
                      <div className="absolute top-11 w-full bg-background border border-border rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                        {hasilCari.map(s => (
                          <div key={s.id} onClick={() => { setSelectedSantri(s); setHasilCari([]); setSearch('') }}
                            className="p-3 hover:bg-muted/50 cursor-pointer border-b border-border/40 text-sm last:border-0">
                            <p className="font-bold text-foreground">{s.nama_lengkap}</p>
                            <p className="text-xs text-muted-foreground">{s.asrama}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-400/20 p-3 rounded-xl flex justify-between items-center animate-in zoom-in-95">
                    <div>
                      <p className="font-black text-foreground text-sm">{selectedSantri.nama_lengkap}</p>
                      <p className="text-xs text-emerald-600">{selectedSantri.asrama} ({selectedSantri.nis})</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedSantri(null)} className="h-8 w-8 rounded-lg hover:bg-emerald-100 text-emerald-600">
                      <X className="w-4 h-4"/>
                    </Button>
                  </div>
                )
              ) : (
                <Input
                  className="focus-visible:ring-blue-500 shadow-none bg-muted/20"
                  placeholder="Nama Pemesan (Guru/Keluarga)..."
                  value={namaUmum}
                  onChange={e => setNamaUmum(e.target.value)}
                />
              )}
            </CardContent>
          </Card>

          {/* Buka Katalog (Mobile) */}
          <Button onClick={() => setMobileView('CATALOG')} className="lg:hidden w-full bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl gap-2 shadow-sm h-12">
            <BookOpen className="w-5 h-5"/> Pilih Kitab (Katalog)
          </Button>

          {/* Keranjang */}
          <Card className="border-border shadow-sm overflow-hidden flex flex-col lg:h-[500px]">
            <div className="bg-muted/30 px-4 py-3 border-b border-border/60 font-black text-foreground text-xs flex justify-between items-center uppercase tracking-widest">
              <span>Keranjang</span>
              <Badge variant="outline" className="font-black border-border">{cart.length} Item</Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
              {cart.length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-sm flex flex-col items-center gap-2">
                  <ShoppingCart className="w-8 h-8 opacity-20"/>Belum ada kitab
                </div>
              )}
              {cart.map(item => (
                <div key={item.id} className={cn('p-3 rounded-xl border flex justify-between items-center shadow-sm transition-colors', item.isGratis ? 'bg-emerald-500/10 border-emerald-400/30' : 'bg-background border-border')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{item.nama}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={cn('text-xs font-mono font-black', item.isGratis ? 'line-through text-muted-foreground' : 'text-foreground')}>
                        Rp {item.hargaAsli.toLocaleString()}
                      </p>
                      {item.isGratis && <span className="text-[9px] bg-emerald-500/20 text-emerald-700 px-1.5 py-0.5 rounded font-black">GRATIS</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="icon" onClick={() => toggleGratis(item.id)} title="Gratiskan"
                      className={cn('h-8 w-8 rounded-lg', item.isGratis ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'hover:bg-emerald-100 hover:text-emerald-600')}>
                      <Gift className="w-4 h-4"/>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)}
                      className="h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4"/>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Bayar */}
            <div className="p-4 border-t border-border/60 bg-muted/20 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-black text-foreground">Total Tagihan</span>
                <span className="font-black text-foreground text-lg tabular-nums">Rp {totalTagihan.toLocaleString()}</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Uang Diterima</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-sm">Rp</span>
                  <Input type="number" className="pl-10 font-mono text-lg font-black shadow-none bg-background h-12 focus-visible:ring-blue-500" placeholder="0" value={uangBayar} onChange={e => setUangBayar(e.target.value)}/>
                </div>
              </div>
              {(kembalian > 0 || tunggakan > 0) && (
                <div className="flex justify-between text-xs font-black gap-2">
                  {kembalian > 0 && <span className="flex-1 text-center bg-emerald-500/10 text-emerald-700 border border-emerald-400/30 px-3 py-2 rounded-xl">Kembali: Rp {kembalian.toLocaleString()}</span>}
                  {tunggakan > 0 && <span className="flex-1 text-center bg-destructive/10 text-destructive border border-destructive/20 px-3 py-2 rounded-xl">Kurang: Rp {tunggakan.toLocaleString()}</span>}
                </div>
              )}
              <Button onClick={handleSimpan} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl h-12 gap-2 shadow-sm">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                SIMPAN TRANSAKSI
              </Button>
            </div>
          </Card>
        </div>

        {/* RIGHT: Katalog */}
        <div className={cn('lg:col-span-2 space-y-4', mobileView === 'CART' ? 'hidden lg:block' : 'block')}>

          {/* Mobile Back */}
          <div className="lg:hidden flex items-center justify-between mb-2">
            <Button variant="outline" onClick={() => setMobileView('CART')} className="rounded-xl font-bold gap-2 shadow-none">
              <ArrowLeft className="w-4 h-4"/> Kembali ke Kasir
            </Button>
            <Badge className="bg-blue-500/10 text-blue-700 border-blue-400/30 font-black border">Keranjang: {cart.length} Item</Badge>
          </div>

          <Card className="border-border shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-4 py-3 border-b border-border/60 font-black text-foreground text-xs uppercase tracking-widest flex justify-between items-center sticky top-0 z-10">
              Katalog Kitab
              <span className="text-[10px] font-normal text-muted-foreground normal-case hidden sm:inline">Klik item untuk menambahkan</span>
            </div>
            <div className="p-2 md:p-4 space-y-4 overflow-y-auto" style={{ height: 'calc(100vh - 220px)', maxHeight: '600px' }}>
              {loadingKatalog ? (
                <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground/40"/></div>
              ) : (
                Object.entries(katalog).map(([marhalah, items]) => (
                  <Card key={marhalah} className="border-border shadow-sm overflow-hidden">
                    <div className="bg-blue-500/10 border-b border-blue-400/20 px-4 py-3 flex justify-between items-center">
                      <h3 className="font-black text-blue-800 dark:text-blue-400 text-sm">{marhalah}</h3>
                      <Button size="sm" onClick={() => addPaket(items as any[])} className="bg-blue-600 hover:bg-blue-700 text-white font-black rounded-full h-7 px-3 text-xs gap-1 shadow-sm">
                        <Package className="w-3 h-3"/> Paket
                      </Button>
                    </div>
                    <div className="divide-y divide-border/40">
                      {(items as any[]).map(k => {
                        const isInCart = cart.some(c => c.id === k.id)
                        return (
                          <div key={k.id} onClick={() => !isInCart && addToCart(k)}
                            className={cn('px-4 py-3 flex justify-between items-center transition-colors', isInCart ? 'bg-muted/30 opacity-60 cursor-default' : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer')}>
                            <span className="text-sm font-medium text-foreground line-clamp-2 flex-1">{k.nama}</span>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <span className="text-sm font-mono font-black text-foreground/70">
                                {k.harga > 0 ? (k.harga / 1000) + 'k' : 'Free'}
                              </span>
                              {isInCart
                                ? <Check className="w-5 h-5 text-emerald-600"/>
                                : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30"/>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}