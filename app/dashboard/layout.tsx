import { ClientLayout } from "@/components/layout/client-layout";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// PENTING: Paksa halaman ini selalu cek data terbaru (No Cache)
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. Cek User Login
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // 2. AMBIL ROLE & NAMA DARI DATABASE
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name') // UPDATE: Ambil full_name juga
    .eq('id', user.id)
    .single();

  // Fallback data jika profil belum lengkap
  const userRole = profile?.role || 'wali_kelas';
  const userName = profile?.full_name || user.email || 'User'; // Prioritaskan Nama

  return (
    // Kirim userName dan userRole ke ClientLayout (yang membungkus Header)
    // Kita perlu update ClientLayout juga sedikit, atau kita pass langsung ke Header di sini 
    // TAPI: Karena struktur kita pakai ClientLayout sebagai wrapper, kita update props-nya.
    <ClientLayout 
      userRole={userRole} 
      userEmail={user.email || ""} // Email tetap dikirim untuk key/id
      userName={userName}          // PROP BARU: Nama User
    >
      {children}
    </ClientLayout>
  );
}