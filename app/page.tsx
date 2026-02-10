import Link from "next/link";
import { ArrowRight, School } from "lucide-react";

export default function LandingPage() {
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

      {/* BAGIAN KANAN: TOMBOL MASUK */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-20 bg-white relative">
        <div className="w-full max-w-md space-y-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
          
          <div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Selamat Datang</h2>
            <p className="text-slate-500 mt-2">Silakan masuk untuk mengakses dashboard manajemen.</p>
          </div>

          <div className="pt-4">
            <Link 
              href="/login"
              className="w-full flex justify-center items-center gap-2 py-4 px-6 border border-transparent rounded-xl shadow-lg text-base font-bold text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all transform hover:-translate-y-1"
            >
              Masuk Aplikasi <ArrowRight className="w-5 h-5" />
            </Link>
            
            <p className="mt-6 text-xs text-slate-400">
               Hanya untuk staf & pengurus yang berwenang.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}