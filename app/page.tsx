import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { login } from "@/app/login/actions"; 
import { User, Lock, ArrowRight, ShieldCheck } from "lucide-react";

// Definisi tipe params untuk Next.js 15
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function LandingPage(props: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const searchParams = await props.searchParams;
  const errorMsg = searchParams.error as string;

  // 1. Cek apakah user sudah login?
  const { data: { user } } = await supabase.auth.getUser();

  // Jika sudah login, langsung lempar ke dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans">
      
      {/* BAGIAN KIRI: BRANDING PESANTREN (40-50% Lebar) */}
      <div className="lg:w-1/2 bg-gradient-to-br from-green-800 to-emerald-950 text-white p-10 lg:p-20 flex flex-col justify-between relative overflow-hidden">
        
        {/* Dekorasi Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

        {/* Logo & Header */}
        <div className="relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-5 mb-8">
             {/* LOGO PESANTREN (Tanpa Kotak) */}
             <img 
               src="/logo.png" 
               alt="Logo Pondok" 
               className="w-20 h-20 object-contain drop-shadow-2xl" 
             />
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

        {/* Footer Branding */}
        <div className="relative z-10 mt-10 lg:mt-0 text-xs text-green-300/60 font-mono">
          &copy; 2024 Sukahideng App v1.0 • Built for excellence.
        </div>
      </div>

      {/* BAGIAN KANAN: FORM LOGIN (50-60% Lebar) */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-20 bg-white relative">
        
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
          
          {/* Header Form */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Selamat Datang</h2>
            <p className="text-slate-500 mt-2">Silakan masuk untuk mengakses dashboard manajemen.</p>
          </div>

          {/* Form */}
          <form className="space-y-6">
            
            {/* Input Email */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 block" htmlFor="email">Email Pengguna</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-green-600 transition-colors" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="admin@pesantren.com"
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Input Password */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 block" htmlFor="password">Kata Sandi</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-green-600 transition-colors" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Pesan Error */}
            {errorMsg && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-center gap-3 animate-in shake">
                <ShieldCheck className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700 font-medium">{decodeURIComponent(errorMsg)}</p>
              </div>
            )}

            {/* Tombol Submit */}
            <button
              formAction={login}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all transform active:scale-[0.98] hover:shadow-green-500/30"
            >
              Masuk Aplikasi <ArrowRight className="w-4 h-4" />
            </button>

            {/* Footer Form */}
            <div className="text-center pt-4">
              <p className="text-xs text-slate-400">
                Lupa kata sandi? Hubungi <span className="text-green-600 font-bold cursor-pointer hover:underline">Tim IT Pesantren</span>
              </p>
            </div>

          </form>

          {/* Info Simpel tanpa Badge */}
          <div className="flex gap-3 items-start text-slate-400 px-2">
             <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
             <p className="text-xs leading-relaxed">
                Sistem ini hanya untuk penggunaan internal Dewan Guru, Pengurus, dan Staf Administrasi. Segala aktivitas akan tercatat.
             </p>
          </div>

        </div>
      </div>
    </div>
  );
}