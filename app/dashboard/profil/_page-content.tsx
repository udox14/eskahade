'use client'

import { useState, useEffect, useRef } from 'react'
import { getProfilData, updateProfil, updatePassword, uploadAvatar, toggleShowBottomNav } from './actions'
import {
  User, Camera, Save, Lock, Phone, Mail, Shield,
  Loader2, CheckCircle, Eye, EyeOff, Building2, Smartphone,
  ExternalLink, KeyRound, Palette
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', wali_kelas: 'Wali Kelas', pengurus_asrama: 'Pengurus Asrama',
  akademik: 'Akademik', keamanan: 'Keamanan', dewan_santri: 'Dewan Santri', bendahara: 'Bendahara',
}

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
  pengurus_asrama: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  keamanan: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  akademik: 'bg-violet-500/10 text-violet-700 border-violet-500/20',
  wali_kelas: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  dewan_santri: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
  bendahara: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
}

export default function ProfilPage() {
  const [profil, setProfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [nama, setNama] = useState('')
  const [phone, setPhone] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)

  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showBottomNav, setShowBottomNav] = useState(true)
  const [togglingNav, setTogglingNav] = useState(false)

  useEffect(() => {
    getProfilData().then(data => {
      if (data) {
        setProfil(data); setNama(data.full_name || ''); setPhone(data.phone || '')
        setAvatarPreview(data.avatar_url || null)
        setShowBottomNav(data.show_bottomnav !== 0)
      }
      setLoading(false)
    })
  }, [])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return toast.error('Ukuran file maksimal 2MB')
    
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    
    setUploadingAvatar(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await uploadAvatar(fd)
    setUploadingAvatar(false)
    
    if ('error' in res) { 
      toast.error(res.error as string)
      setAvatarPreview(profil?.avatar_url || null)
      return 
    }
    toast.success('Foto profil diperbarui!')
    setProfil((p: any) => ({ ...p, avatar_url: (res as any).url }))
  }

  const handleSaveInfo = async () => {
    setSavingInfo(true)
    const res = await updateProfil({ full_name: nama, phone })
    setSavingInfo(false)
    if ('error' in res) return toast.error(res.error as string)
    toast.success('Profil berhasil diperbaharui!')
    setProfil((p: any) => ({ ...p, full_name: nama, phone }))
  }

  const handleChangePassword = async () => {
    if (!pwCurrent || !pwNew || !pwConfirm) return toast.warning('Semua field harus diisi')
    if (pwNew !== pwConfirm) return toast.error('Konfirmasi password baru tidak cocok')
    
    setSavingPw(true)
    const res = await updatePassword({ current: pwCurrent, new: pwNew, confirm: pwConfirm })
    setSavingPw(false)
    if ('error' in res) return toast.error(res.error as string)
    toast.success('Password berhasil diubah!')
    setPwCurrent(''); setPwNew(''); setPwConfirm('')
  }

  const handleToggleNav = async (next: boolean) => {
    setTogglingNav(true)
    setShowBottomNav(next)
    await toggleShowBottomNav(next)
    setTogglingNav(false)
    toast.success(`Navigasi bawah ${next ? 'diaktifkan' : 'dinonaktifkan'}`)
  }

  const initials = (profil?.full_name || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
  const pwStrength = pwNew.length === 0 ? 0 : pwNew.length < 6 ? 1 : pwNew.length < 10 ? 2 : 3

  if (loading) {
    return (
      <div className="flex flex-col h-64 items-center justify-center gap-4 animate-in fade-in duration-500">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500/50" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Authenticating Identity...</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* HEADER SECTION */}
      <div className="flex items-center gap-4 px-2">
        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 shadow-sm border border-emerald-500/10">
          <User className="w-6 h-6"/>
        </div>
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight uppercase">Manajemen Profil</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">Pengaturan Identitas & Keamanan Akun</p>
        </div>
      </div>

      {/* IDENTITY CARD (PREMIUM STYLED) */}
      <Card className="border-border shadow-2xl overflow-hidden relative group">
        <div className="h-28 bg-gradient-to-br from-emerald-600 to-emerald-900 relative">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] group-hover:scale-150 transition-transform duration-1000" />
          <div className="absolute -bottom-1 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent" />
        </div>
        <CardContent className="px-6 pb-6 -mt-14 relative z-10">
          <div className="flex items-end justify-between">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-card shadow-2xl rounded-3xl bg-emerald-100">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} alt="Avatar" className="object-cover" />
                ) : (
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 text-2xl font-black">{initials}</AvatarFallback>
                )}
              </Avatar>
              <button 
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-9 h-9 bg-white hover:bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-lg border border-border transition-all active:scale-90"
              >
                {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin"/> : <Camera className="w-4 h-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="mb-2">
              <Badge variant="outline" className={cn("px-4 py-1.5 rounded-xl border font-black text-[10px] uppercase tracking-widest shadow-sm", ROLE_COLOR[profil?.role])}>
                <Shield className="w-3 h-3 mr-2" /> {ROLE_LABEL[profil?.role] || profil?.role}
              </Badge>
            </div>
          </div>
          
          <div className="mt-4 space-y-1">
            <h2 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none">{profil?.full_name || 'Anonymous User'}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 font-bold">
               <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 tracking-wider">
                  <Mail className="w-3.5 h-3.5 text-emerald-600"/> {profil?.email}
               </div>
               {profil?.asrama_binaan && (
                 <div className="text-[10px] text-emerald-700 uppercase flex items-center gap-1.5 tracking-wider">
                    <Building2 className="w-3.5 h-3.5"/> {profil.asrama_binaan}
                 </div>
               )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="opacity-50" />

      {/* FORMS SECTION */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* ACCOUNT INFORMATION */}
        <Card className="border-border shadow-sm overflow-hidden bg-muted/5">
          <CardHeader className="bg-muted/30 border-b py-5">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-emerald-700">
               <User className="w-4 h-4"/> Informasi Akun
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Perbarui data personal dan kontak darurat Anda.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nama Lengkap</Label>
                <Input 
                  value={nama} onChange={e => setNama(e.target.value)}
                  className="h-11 rounded-xl bg-background border-border font-black focus-visible:ring-emerald-500" 
                  placeholder="Nama Lengkap" 
                />
              </div>
              <div className="space-y-1.5 opacity-60 grayscale cursor-not-allowed">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Alamat Email (Locked)</Label>
                <Input value={profil?.email || ''} disabled className="h-11 rounded-xl bg-muted border-border font-bold text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1">No. HP / WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                  <Input 
                    value={phone} onChange={e => setPhone(e.target.value)}
                    className="h-11 pl-10 rounded-xl bg-background border-border font-black focus-visible:ring-emerald-500" 
                    placeholder="08xxxxxxxxxx" type="tel" 
                  />
                </div>
              </div>
            </div>
            <Button 
               onClick={handleSaveInfo} 
               disabled={savingInfo} 
               className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-500/20 gap-2 transition-transform active:scale-95"
            >
              {savingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} SIMPAN PERUBAHAN
            </Button>
          </CardContent>
        </Card>

        {/* SETTINGS / DISPLAY */}
        <Card className="border-border shadow-sm overflow-hidden bg-muted/5">
          <CardHeader className="bg-muted/30 border-b py-5">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-indigo-700">
               <Palette className="w-4 h-4"/> Pengaturan Tampilan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-6 p-4 rounded-2xl bg-white border border-border shadow-sm">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-100">
                  <Smartphone className="w-5 h-5"/>
                </div>
                <div>
                  <p className="text-sm font-black text-foreground tracking-tight uppercase">Bottom Navigation Bar</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Tampilkan pintasan navigasi saat layar mode mobile.</p>
                </div>
              </div>
              <Switch checked={showBottomNav} onCheckedChange={handleToggleNav} disabled={togglingNav} />
            </div>
          </CardContent>
        </Card>

        {/* SECURITY / PASSWORD */}
        <Card className="border-border shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <CardHeader className="bg-muted/30 border-b py-5">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-amber-600">
               <KeyRound className="w-4 h-4"/> Keamanan Akun
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Demi keamanan, gunakan kombinasi password yang kuat.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Password Saat Ini</Label>
                <div className="relative">
                   <Input 
                      type={showPw ? 'text' : 'password'} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)}
                      className="h-11 rounded-xl bg-background border-border font-black focus-visible:ring-amber-500 pr-10" 
                      placeholder="••••••••" 
                   />
                </div>
              </div>
              
              <Separator className="opacity-30" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 text-amber-600">Password Baru</Label>
                    <div className="relative">
                      <Input 
                         type={showPw ? 'text' : 'password'} value={pwNew} onChange={e => setPwNew(e.target.value)}
                         className="h-11 rounded-xl bg-background border-border font-black focus-visible:ring-amber-500 pr-10" 
                         placeholder="••••••••" 
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors">
                        {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 text-amber-600">Konfirmasi Password Baru</Label>
                    <Input 
                      type={showPw ? 'text' : 'password'} value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                      className="h-11 rounded-xl bg-background border-border font-black focus-visible:ring-amber-500" 
                      placeholder="••••••••" 
                    />
                 </div>
              </div>

              {pwNew && (
                <div className="p-3 bg-white border border-border rounded-xl space-y-2 group animate-in zoom-in-95 duration-300">
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={cn(
                        "h-1.5 flex-1 rounded-full transition-all duration-500 shadow-inner",
                        pwStrength >= i 
                          ? (i === 1 ? 'bg-rose-500' : i === 2 ? 'bg-amber-400' : 'bg-emerald-500 shadow-emerald-500/20') 
                          : 'bg-muted'
                      )} />
                    ))}
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    {pwStrength === 1 ? <><span className="text-rose-500 animate-pulse">●</span> Lemah — Tambahkan angka atau simbol</> : 
                     pwStrength === 2 ? <><span className="text-amber-500">●</span> Cukup — Masih bisa diperkuat</> : 
                     <><span className="text-emerald-600">●</span> Sangat Kuat — Syukron Jazaakallah!</>}
                  </p>
                </div>
              )}
            </div>

            <Button 
               onClick={handleChangePassword} 
               disabled={savingPw || !pwNew} 
               className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black shadow-lg shadow-amber-500/20 gap-2 transition-transform active:scale-95"
            >
              {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} GANTI PASSWORD SEKARANG
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
