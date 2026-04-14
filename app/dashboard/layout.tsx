import React from 'react'
import { ClientLayout } from "@/components/layout/client-layout";
import { getSession, getEffectiveRoles } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { redirect } from "next/navigation";
import { getFiturForRoles, getBottomNavGlobalEnabled, type FiturAkses } from "@/lib/cache/fitur-akses";

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

  console.log('[layout] session OK, roles:', getEffectiveRoles(session), 'id:', session.id?.substring(0, 8))

  // Ambil data user dari DB — pakai try-catch agar tidak crash kalau kolom belum ada
  let userName = session.full_name || 'User'
  let userRoles = getEffectiveRoles(session)
  let avatarUrl: string | null = null
  let userShowBottomNav = true  // default aktif

  try {
    const user = await queryOne<{ full_name: string; role: string; roles: string | null; avatar_url: string | null; show_bottomnav: number | null }>(
      'SELECT full_name, role, roles, avatar_url, show_bottomnav FROM users WHERE id = ?',
      [session.id]
    );
    if (user) {
      userName = user.full_name || userName
      // Parse multi-role dari DB
      try {
        if (user.roles) {
          const parsed = JSON.parse(user.roles)
          if (Array.isArray(parsed) && parsed.length > 0) {
            userRoles = parsed
          }
        }
      } catch {
        // fallback ke session roles
      }
      if (userRoles.length === 0) userRoles = [user.role]
      avatarUrl = user.avatar_url ?? null
      // NULL = belum diset user → ikut default (aktif), 0 = user matiin sendiri
      userShowBottomNav = user.show_bottomnav !== 0
    }
  } catch (err: any) {
    console.error('[layout] queryOne users ERROR:', err?.message)
  }

  console.log('[layout] userRoles:', userRoles)

  // Ambil fitur dan setting bottomnav secara paralel
  let fiturAkses: FiturAkses[] = []
  let globalBottomNavEnabled = true

  try {
    [fiturAkses, globalBottomNavEnabled] = await Promise.all([
      getFiturForRoles(userRoles, session.id),
      getBottomNavGlobalEnabled(),
    ])
  } catch (err: any) {
    console.error('[layout] fetch error:', err?.message)
    try { fiturAkses = await getFiturForRoles(userRoles, session.id) } catch {}
  }

  console.log('[layout] fiturAkses count:', fiturAkses.length)

  return (
    <ClientLayout
      userRole={userRoles[0] || 'wali_kelas'}
      userRoles={userRoles}
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
