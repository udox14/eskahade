'use client'

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client"; 
import { useRouter } from "next/navigation";
import { login } from "@/app/login/actions"; 
import { User, Lock, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Cek sesi (Redirect jika sudah login)
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace("/dashboard");
      }
    };
    checkSession();
  }, [router]);

  const handleLogin = async (formData: FormData) => {
    setIsSubmitting(true);
    const res = await login(formData);
    
    if (res?.error) {
      setIsSubmitting(false);
      if (res.error.includes("Invalid login") || res.error.includes("Invalid credentials")) {
        toast.error("Login Gagal", { description: "Email atau kata sandi salah." });
      } else {
        toast.error("Terjadi Kesalahan", { description: res.error });
      }
    } else {
       toast.success("Berhasil Login", { description: "Mengalihkan ke dashboard..." });
       // Force reload untuk memastikan middleware/session terupdate
       window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-slate-100 animate-in zoom-in-95 duration-300">
        
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Logo" className="w-16 h-16 mx-auto object-contain" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Login Sistem</h1>
          <p className="text-sm text-slate-500 mt-1">Masukkan kredensial akun Anda.</p>
        </div>

        <form action={handleLogin} className="space-y-5">
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Email</label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-slate-400 group-focus-within:text-green-600 transition-colors" />
                    </div>
                    <input name="email" type="email" required placeholder="admin@pesantren.com" className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all" disabled={isSubmitting}/>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 block flex justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</span>
                </label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-green-600 transition-colors" />
                    </div>
                    <input name="password" type="password" required placeholder="••••••••" className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all" disabled={isSubmitting}/>
                </div>
            </div>

            <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg shadow-md text-sm font-bold text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <ArrowRight className="w-5 h-5" />} 
                {isSubmitting ? "Memproses..." : "Masuk"}
            </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
             <p className="text-xs text-slate-400 mb-2">Lupa kata sandi?</p>
             <a 
               href="https://wa.me/6282218943383" 
               target="_blank"
               className="inline-flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-full text-xs font-bold hover:bg-green-100 transition-colors"
             >
               <ShieldCheck className="w-4 h-4"/> Hubungi Admin IT
             </a>
        </div>

      </div>
    </div>
  )
}