import { ClientLayout } from "@/components/layout/client-layout";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    // Redirect ke Landing Page (Root)
    redirect("/");
  }

  // Ambil data profile seperti biasa
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  const userRole = profile?.role || 'wali_kelas';
  const userName = profile?.full_name || user.email || 'User';

  return (
    <ClientLayout 
      userRole={userRole} 
      userEmail={user.email || ""} 
      userName={userName}
    >
      {children}
    </ClientLayout>
  );
}