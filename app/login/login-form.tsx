'use client'

import { useState } from "react"
import { Mail, Lock, ArrowRight, ShieldCheck, Loader2, Eye, EyeOff, Sparkles, UserCheck } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { login } from "./actions"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await login(formData)

      if (result?.error) {
        setIsSubmitting(false)
        toast.error("Login Gagal", { description: result.error })
      }
    } catch (err: any) {
      if (err?.digest?.startsWith('NEXT_REDIRECT')) return
      setIsSubmitting(false)
      toast.error("Login Gagal", { description: 'Tidak dapat terhubung ke server.' })
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 flex items-center justify-center p-6 selection:bg-teal-500/30 overflow-hidden relative">

      {/* ── Background Elements ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.05]" 
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.2\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Aspect: Branding */}
        <div className="hidden lg:flex flex-col space-y-10 animate-in fade-in slide-in-from-left-10 duration-1000">
          <div className="flex items-center gap-5">
             <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl shadow-2xl">
               <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
             </div>
             <div>
               <h1 className="text-2xl font-black uppercase tracking-[.3em] leading-none mb-1 text-white">Sukahideng</h1>
               <span className="text-teal-500 font-black text-[10px] uppercase tracking-widest leading-none">Intelligence Hub</span>
             </div>
          </div>

          <div className="space-y-6">
             <Badge variant="outline" className="h-8 px-5 rounded-full border-teal-500/20 bg-teal-500/5 text-teal-400 font-black text-[10px] uppercase tracking-[.3em] gap-2 shadow-2xl backdrop-blur-md">
                <ShieldCheck className="w-3.5 h-3.5" /> SECURE GATEWAY
             </Badge>
             <h2 className="text-6xl font-black text-white leading-[0.95] tracking-tighter uppercase">
               Authorized <br/>
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">Access Only.</span>
             </h2>
             <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm italic">
               "Silakan masuk menggunakan kredensial resmi untuk mengelola ekosistem akademik dan operasional Pesantren."
             </p>
          </div>

          <div className="flex items-center gap-8 pt-6">
             <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-[#020617] bg-slate-800 flex items-center justify-center text-[10px] font-black">{i}</div>
                ))}
                <div className="w-10 h-10 rounded-full border-2 border-[#020617] bg-teal-500 flex items-center justify-center text-[10px] font-black text-white">+7</div>
             </div>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Role Otoritas <br/> Terintegrasi</p>
          </div>
        </div>

        {/* Right Aspect: Form */}
        <div className="animate-in fade-in slide-in-from-right-10 duration-1000">
          <Card className="p-1 px-1 bg-white/[0.03] border-white/10 backdrop-blur-3xl rounded-[3rem] shadow-2xl overflow-hidden group">
            <div className="p-8 md:p-12 space-y-8 bg-black/40 rounded-[2.8rem] border border-white/5 transition-all group-hover:border-teal-500/20">
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Kredensial Akun</h3>
                <p className="text-slate-500 text-xs font-semibold tracking-wide">Input email dan password terdaftar Anda.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-teal-500 uppercase tracking-[.25em] ml-1">Electronic Mail</label>
                    <div className="relative group">
                       <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
                       <Input 
                        name="email"
                        type="email"
                        required
                        placeholder="admin@sukahideng.link"
                        disabled={isSubmitting}
                        className="h-14 pl-11 bg-white/[0.03] border-white/10 rounded-2xl focus:ring-teal-500/50 focus:border-teal-500/50 text-white font-medium shadow-inner"
                       />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-teal-500 uppercase tracking-[.25em] ml-1">Password Authentication</label>
                    <div className="relative group">
                       <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
                       <Input 
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        disabled={isSubmitting}
                        className="h-14 pl-11 pr-12 bg-white/[0.03] border-white/10 rounded-2xl focus:ring-teal-500/50 focus:border-teal-500/50 text-white font-medium shadow-inner"
                       />
                       <button
                         type="button"
                         onClick={() => setShowPassword(!showPassword)}
                         className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                       >
                         {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </button>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs gap-3 shadow-[0_20px_50px_rgba(20,184,166,0.2)] transition-all active:scale-[0.98]"
                >
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifikasi...</> : <><UserCheck className="w-4 h-4" /> Unlock Dashboard</>}
                </Button>
              </form>

              <div className="pt-6 border-t border-white/5 flex flex-col items-center gap-4">
                 <Link href="https://wa.me/6282218943383" target="_blank" className="text-[10px] font-black text-slate-500 hover:text-teal-500 uppercase tracking-widest transition-all">Forgot your credentials? Contact IT Support</Link>
                 <Link href="/" className="text-[9px] font-black text-slate-700 hover:text-slate-400 uppercase tracking-[.3em] transition-all">← Back to Portal Home</Link>
              </div>

            </div>
          </Card>
        </div>

      </div>

      {/* Footer minimal */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10 hidden md:block">
         <p className="text-[10px] font-black text-slate-800 uppercase tracking-[.4em]">Sukahideng App · Intelligent Governance</p>
      </div>

    </div>
  )
}
