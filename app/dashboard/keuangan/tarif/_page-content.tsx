'use client'

import React, { useState, useEffect } from 'react'
import { getDaftarTarif, getTarifByTahun, simpanTarif } from './actions'
import { Save, Settings, DollarSign, History, Loader2, Edit, ChevronLeft, ChevronRight, Coins } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

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

    if (res && 'error' in res) {
        toast.error("Gagal", { description: (res as any).error })
    } else {
        toast.success("Tarif Berhasil Disimpan", { description: `Angkatan ${tahunInput} telah diperbarui.` })
        refreshList()
    }
  }

  // Format Rupiah Helper
  const rp = (val: number) => "Rp " + (val || 0).toLocaleString('id-ID')

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 shadow-sm border border-indigo-500/10">
            <Settings className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Pengaturan Tarif Angkatan</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Manajemen Biaya Masuk & Tagihan Tahunan</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
         
         {/* KOLOM KIRI: FORM INPUT */}
         <div className="lg:col-span-1 lg:sticky lg:top-24">
            <Card className="border-border shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"/>
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Edit className="w-4 h-4 text-indigo-500"/> Edit / Baru
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <form onSubmit={handleSimpan} className="space-y-6">
                        {/* Tahun Selector */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Tahun Angkatan (Masuk)</Label>
                            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-2xl border shadow-inner">
                                <Button type="button" variant="ghost" size="icon" onClick={() => setTahunInput(t => t - 1)} className="h-10 w-10 rounded-xl hover:bg-background">
                                  <ChevronLeft className="w-4 h-4"/>
                                </Button>
                                <Input 
                                    type="number" 
                                    className="border-0 bg-transparent text-center font-black text-lg focus-visible:ring-0 shadow-none h-10"
                                    value={tahunInput}
                                    onChange={(e) => setTahunInput(Number(e.target.value))}
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => setTahunInput(t => t + 1)} className="h-10 w-10 rounded-xl hover:bg-background">
                                  <ChevronRight className="w-4 h-4"/>
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {loading ? (
                                <div className="py-12 flex flex-col items-center gap-3">
                                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500 opacity-50"/>
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Checking data...</p>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <InputDuit label="Uang Bangunan (Sekali)" value={nominal.BANGUNAN} onChange={v => setNominal({...nominal, BANGUNAN: v})} />
                                    <InputDuit label="Infaq Kesehatan (Tahunan)" value={nominal.KESEHATAN} onChange={v => setNominal({...nominal, KESEHATAN: v})} />
                                    <InputDuit label="Uang EHB (Tahunan)" value={nominal.EHB} onChange={v => setNominal({...nominal, EHB: v})} />
                                    <InputDuit label="Ekstrakurikuler (Tahunan)" value={nominal.EKSKUL} onChange={v => setNominal({...nominal, EKSKUL: v})} />
                                </div>
                            )}
                        </div>

                        <Button 
                            type="submit"
                            disabled={isSaving || loading}
                            className={cn(
                              "w-full h-12 font-black rounded-2xl shadow-lg transition-all active:scale-95 gap-2",
                              "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                            )}
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                            SIMPAN TARIF
                        </Button>
                    </form>
                </CardContent>
            </Card>
         </div>

         {/* KOLOM KANAN: TABEL RIWAYAT */}
         <div className="lg:col-span-2">
            <Card className="border-border shadow-sm overflow-hidden">
                <CardHeader className="p-5 bg-muted/30 border-b flex flex-row justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <History className="w-4 h-4 text-muted-foreground"/> Daftar Tarif Tersimpan
                    </CardTitle>
                </CardHeader>
                
                {listTarif.length === 0 ? (
                    <div className="py-24 text-center">
                        <Coins className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20"/>
                        <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Belum ada data tarif tersimpan</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="px-6 h-12 font-black text-[10px] uppercase tracking-wider">Angkatan</TableHead>
                                    <TableHead className="px-6 h-12 font-black text-[10px] uppercase tracking-wider text-right">Bangunan</TableHead>
                                    <TableHead className="px-6 h-12 font-black text-[10px] uppercase tracking-wider text-right">Tahunan (Total)</TableHead>
                                    <TableHead className="px-6 h-12 font-black text-[10px] uppercase tracking-wider text-center">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {listTarif.map((item: any) => {
                                    const totalTahunan = item.KESEHATAN + item.EHB + item.EKSKUL
                                    const isActive = item.tahun === tahunInput
                                    return (
                                        <TableRow 
                                          key={item.tahun} 
                                          className={cn(
                                            'transition-colors hover:bg-indigo-500/5',
                                            isActive ? 'bg-indigo-500/5' : ''
                                          )}
                                        >
                                            <TableCell className="px-6 py-4">
                                              <span className="font-black text-lg text-indigo-600 tabular-nums">{item.tahun}</span>
                                            </TableCell>
                                            <TableCell className="px-6 py-4 text-right">
                                              <p className="font-bold text-sm tracking-tight">{rp(item.BANGUNAN)}</p>
                                            </TableCell>
                                            <TableCell className="px-6 py-4 text-right">
                                              <p className="font-bold text-sm tracking-tight">{rp(totalTahunan)}</p>
                                              <p className="text-[9px] font-bold text-muted-foreground uppercase italic opacity-50">KES+EHB+EKS</p>
                                            </TableCell>
                                            <TableCell className="px-4 py-4 text-center">
                                                <Button 
                                                    variant={isActive ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setTahunInput(item.tahun)}
                                                    className={cn(
                                                      'rounded-xl text-[10px] font-black uppercase h-8 px-4',
                                                      isActive ? 'bg-indigo-600 hover:bg-indigo-700' : 'border-indigo-400 text-indigo-600 hover:bg-indigo-50'
                                                    )}
                                                >
                                                    {isActive ? 'Active' : 'Edit'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </Card>
         </div>

      </div>
    </div>
  )
}

// Sub Component: Input Duit
function InputDuit({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">{label}</Label>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-muted-foreground font-black text-xs scale-90">RP</span>
                </div>
                <Input 
                    type="number"
                    className="pl-11 h-11 border-border bg-muted/20 focus-visible:ring-indigo-500 font-bold text-right tabular-nums rounded-xl px-4"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                />
            </div>
        </div>
    )
}