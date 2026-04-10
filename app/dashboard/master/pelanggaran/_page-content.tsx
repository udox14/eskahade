'use client'

import React, { useState } from 'react'
import { tambahJenisPelanggaran, hapusJenisPelanggaran } from './actions'
import { Trash2, Plus, ShieldAlert, Gavel, Database, Loader2, AlertTriangle, ShieldCheck, CheckCircle2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface PelanggaranItem {
  id: string
  kategori: 'RINGAN' | 'SEDANG' | 'BERAT'
  nama_pelanggaran: string
  poin: number
}

export default function MasterPelanggaranContent({ initialData }: { initialData: PelanggaranItem[] }) {
  const confirm = useConfirm()
  const [list, setList] = useState<PelanggaranItem[]>(initialData)
  const [loading, setLoading] = useState(false)

  const handleTambah = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const toastId = toast.loading("Menambahkan aturan...")
    setLoading(true)

    try {
      const res = await tambahJenisPelanggaran(formData)
      toast.dismiss(toastId)
      
      if (res && 'error' in res) {
        toast.error(String(res.error))
      } else {
        toast.success("Aturan pelanggaran ditambahkan")
        // Note: Refreshing page or refetching is better, but here we expect data update from server actions.
        // For simplicity in this app, we can reload OR update state.
        window.location.reload() 
      }
    } finally {
      setLoading(false)
    }
  }

  const handleHapus = async (id: string) => {
    if (!await confirm("Hapus jenis pelanggaran ini? Data poin santri mungkin terdampak.")) return
    const toastId = toast.loading("Menghapus...")
    
    try {
      const res = await hapusJenisPelanggaran(Number(id))
      toast.dismiss(toastId)
      
      if (res && 'error' in res) {
        toast.error("Gagal", { description: String(res.error) })
      } else {
        toast.success("Aturan berhasil dihapus")
        setList(prev => prev.filter(item => item.id !== id))
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem")
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 shadow-sm border border-indigo-500/10">
            <Gavel className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Master Kedisiplinan</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Standarisasi Poin & Jenis Pelanggaran</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-indigo-500"/>
          {list.length} Aturan Terdaftar
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* FORM TAMBAH */}
        <div className="lg:col-span-4">
           <Card className="border-border shadow-xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000"/>
              <CardHeader className="bg-muted/30 border-b">
                 <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600"/> Registrasi Aturan
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                 <form onSubmit={handleTambah} className="space-y-5">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Kategori Pelanggaran</Label>
                       <Select name="kategori" defaultValue="RINGAN">
                          <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-border font-bold">
                             <SelectValue placeholder="Pilih Kategori"/>
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="RINGAN" className="font-bold">RINGAN (Green)</SelectItem>
                             <SelectItem value="SEDANG" className="font-bold">SEDANG (Amber)</SelectItem>
                             <SelectItem value="BERAT" className="font-bold">BERAT (Red)</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Nama / Deskripsi Pelanggaran</Label>
                       <Input name="nama_pelanggaran" required placeholder="Ex: Tidak mengikuti jamaah" className="h-11 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500"/>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Bobot Poin</Label>
                       <Input name="poin" type="number" required defaultValue={5} className="h-11 rounded-xl bg-muted/20 border-border font-black focus-visible:ring-indigo-500"/>
                    </div>

                    <Button disabled={loading} className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/20 gap-2">
                       {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} SIMPAN ATURAN
                    </Button>
                 </form>
              </CardContent>
           </Card>

           <div className="mt-6 bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000"/>
              <ShieldCheck className="w-10 h-10 mb-4 opacity-50"/>
              <h4 className="font-black text-sm uppercase tracking-tight">Standard Disiplin</h4>
              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1 leading-relaxed">Sistem poin membantu memonitor perkembangan perilaku santri secara objektif & terukur.</p>
           </div>
        </div>

        {/* TABEL LIST */}
        <div className="lg:col-span-8">
           <Card className="border-border shadow-sm overflow-hidden min-h-[500px]">
              <CardHeader className="bg-muted/30 border-b py-4">
                 <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                    <Database className="w-4 h-4"/> Database Aturan Kedisiplinan
                 </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                 <Table>
                    <TableHeader className="bg-muted/10">
                       <TableRow>
                          <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Kategori</TableHead>
                          <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest">Deskripsi Pelanggaran</TableHead>
                          <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest text-center">Poin</TableHead>
                          <TableHead className="px-6 h-12 text-[10px] font-black uppercase tracking-widest text-right px-8">Aksi</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {list.length === 0 ? (
                          <TableRow>
                             <TableCell colSpan={4} className="py-32 text-center opacity-30">
                                <ShieldAlert className="w-12 h-12 mx-auto mb-3"/>
                                <p className="text-[10px] font-black uppercase tracking-widest">Belum ada aturan terdaftar</p>
                             </TableCell>
                          </TableRow>
                       ) : (
                          list.map((item) => (
                             <TableRow key={item.id} className="hover:bg-indigo-500/[0.03] transition-colors group">
                                <TableCell className="px-6 py-4">
                                   <Badge variant="outline" className={cn(
                                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border-0 transition-transform group-hover:scale-105",
                                      item.kategori === 'BERAT' ? 'bg-rose-500/10 text-rose-700' : 
                                      item.kategori === 'SEDANG' ? 'bg-amber-500/10 text-amber-700' : 'bg-blue-500/10 text-blue-700'
                                   )}>
                                      {item.kategori}
                                   </Badge>
                                </TableCell>
                                <TableCell className="px-6 py-4">
                                   <div className="font-black text-foreground text-sm tracking-tight uppercase group-hover:text-indigo-600 transition-colors">{item.nama_pelanggaran}</div>
                                </TableCell>
                                <TableCell className="px-6 py-4 text-center">
                                   <div className="w-9 h-9 mx-auto rounded-full bg-muted flex items-center justify-center font-black text-xs tabular-nums border group-hover:bg-background transition-colors">
                                      {item.poin}
                                   </div>
                                </TableCell>
                                <TableCell className="px-6 py-4 text-right pr-8">
                                   <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleHapus(item.id)}
                                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                   >
                                      <Trash2 className="w-4 h-4"/>
                                   </Button>
                                </TableCell>
                             </TableRow>
                          ))
                       )}
                    </TableBody>
                 </Table>
              </div>
           </Card>
        </div>

      </div>
    </div>
  )
}
