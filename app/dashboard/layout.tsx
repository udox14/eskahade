import React from 'react'
import { ClientLayout } from "@/components/layout/client-layout";
import { getSession } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { redirect } from "next/navigation";
import { getFiturForRole, getBottomNavGlobalEnabled, type FiturAkses } from "@/lib/cache/fitur-akses";

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    console.log('[layout] session null → redirect /login')
    redirect("/login");
  }

  console.log('[layout] session OK, role:', session.role, 'id:', session.id?.substring(0, 8))

  // Ambil data user dari DB — pakai try-catch agar tidak crash kalau kolom belum ada
  let userName = session.full_name || 'User'
  let userRole = session.role || 'wali_kelas'
  let avatarUrl: string | null = null
  let userShowBottomNav = true  // default aktif

  try {
    const user = await queryOne<{ full_name: string; role: string; avatar_url: string | null; show_bottomnav: number | null }>(
      'SELECT full_name, role, avatar_url, show_bottomnav FROM users WHERE id = ?',
      [session.id]
    );
    if (user) {
      userName = user.full_name || userName
      userRole = user.role || userRole
      avatarUrl = user.avatar_url ?? null
      // NULL = belum diset user → ikut default (aktif), 0 = user matiin sendiri
      userShowBottomNav = user.show_bottomnav !== 0
    }
  } catch (err: any) {
    console.error('[layout] queryOne users ERROR:', err?.message)
  }

  console.log('[layout] userRole:', userRole)

  // Ambil fitur dan setting bottomnav secara paralel
  let fiturAkses: FiturAkses[] = []
  let globalBottomNavEnabled = true

  try {
    [fiturAkses, globalBottomNavEnabled] = await Promise.all([
      getFiturForRole(userRole),
      getBottomNavGlobalEnabled(),
    ])
  } catch (err: any) {
    console.error('[layout] fetch error:', err?.message)
    try { fiturAkses = await getFiturForRole(userRole) } catch {}
  }

  console.log('[layout] fiturAkses count:', fiturAkses.length)

  return (
    <ClientLayout
      userRole={userRole}
      userEmail=""
      userName={userName}
      avatarUrl={avatarUrl}
      fiturAkses={fiturAkses}
      globalBottomNavEnabled={globalBottomNavEnabled}
      userShowBottomNav={userShowBottomNav}
    >
      {children}
    </ClientLayout>
  );
}
