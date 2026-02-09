'use client'

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client"; 
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/app/login/actions"; 
import { User, Lock, ArrowRight, ShieldCheck, LayoutDashboard, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function LandingPage() {
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirected = searchParams.get('redirected');

  // 1. Cek User di Client Side
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setAuthChecking(false);
      
      // Auto Redirect hanya jika user ada DAN tidak baru saja ditendang (redirected)
      if (user && !redirected) {
         router.push("/dashboard");
      }
    };

    checkSession();
  }, [redirected, router]);

  // Handler Login
  const handleLogin = async (formData: FormData) => {
    setIsSubmitting(true);
    
    // Panggil Server Action
    const res = await login(formData);
    
    if (res?.error) {
      setIsSubmitting(false);
      if (res.error.includes("Invalid login") || res.error.includes("Invalid credentials")) {
        toast.error("Login Gagal", { description: "Email atau kata sandi salah." });
      } else {
        toast.error("Terjadi Kesalahan", { description: res.error });
      }
    } else {
       // Sukses
       toast.success("Berhasil Login", { description: "Mengalihkan ke dashboard..." });
       router.refresh();
       router.push("/dashboard");
    }
  };

  // Handler Logout (Ganti Akun)
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/"; // Hard reload untuk bersihkan state
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans">
      
      {/* BAGIAN KIRI: BRANDING */}
      <div className="lg:w-1/2 bg-gradient-to-br from-green-800 to-emerald-950 text-white p-10 lg:p-20 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

        <div className="relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-5 mb-8">
             <img src="/logo.png" alt="Logo Pondok" className="w-20 h-20 object-contain drop-shadow-2xl" />
            <div className="flex flex-col">
              <span className="font-bold tracking-[0.2em] text-xs text-yellow-400 uppercase mb-1">Sistem Informasi Manajemen</span>
              <span className="font-bold text-green-100 text-sm opacity-80">Terpadu & Terintegrasi</span>
            </div>
          </div>
          <h1 className="text-4xl lg:text-6xl font-serif font-bold leading-tight mb-6 drop-shadow-lg">
            Pondok Pesantren <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">Sukahideng</span>
          </h1>
          <p className="text-green-50 text-lg max-w-md leading-relaxed opacity-90 border-l-4 border-yellow-500 pl-4">
            Membangun generasi Qur'ani yang berakhlak mulia, cerdas, dan mandiri melalui sistem pendidikan terpadu.
          </p>
        </div>

        <div className="relative z-10 mt-10 lg:mt-0 text-xs text-green-300/60 font-mono">
          &copy; 2024 Sukahideng App v1.0 • Built for excellence.
        </div>
      </div>

      {/* BAGIAN KANAN: FORM */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-20 bg-white relative">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
          
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Selamat Datang</h2>
            <p className="text-slate-500 mt-2">Silakan masuk untuk mengakses dashboard manajemen.</p>
          </div>

          {/* KONDISI: SUDAH LOGIN vs BELUM */}
          {user ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center space-y-4 animate-in zoom-in-95">
               <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600 font-bold text-2xl shadow-sm">
                 {user.email?.[0].toUpperCase()}
               </div>
               <div>
                 <p className="text-sm text-gray-500">Anda sudah login sebagai:</p>
                 <p className="font-bold text-gray-800">{user.email}</p>
               </div>
               
               <button 
                 onClick={() => router.push("/dashboard")}
                 className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2"
               >
                 <LayoutDashboard className="w-5 h-5"/> Lanjut Ke Dashboard
               </button>

               <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 hover:underline mt-4 block w-full py-2">Bukan Anda? Keluar</button>
            </div>
          ) : (
            /* FORM LOGIN */
            <form action={handleLogin} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block" htmlFor="email">Email Pengguna</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-5 w-5 text-slate-400 group-focus-within:text-green-600 transition-colors" />
                        </div>
                        <input id="email" name="email" type="email" required placeholder="admin@pesantren.com" className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:ring-2 focus:ring-green-500 outline-none transition-all shadow-sm" disabled={isSubmitting}/>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block" htmlFor="password">Kata Sandi</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-green-600 transition-colors" />
                        </div>
                        <input id="password" name="password" type="password" required placeholder="••••••••" className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:ring-2 focus:ring-green-500 outline-none transition-all shadow-sm" disabled={isSubmitting}/>
                    </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <ArrowRight className="w-5 h-5" />} 
                  {isSubmitting ? "Memproses..." : "Masuk Aplikasi"}
                </button>
            </form>
          )}

          <div className="text-center pt-4">
            <p className="text-xs text-slate-400">
                Lupa kata sandi? Hubungi <a href="https://wa.me/6282218943383" target="_blank" className="text-green-600 font-bold cursor-pointer hover:underline">Tim IT Pesantren</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}