import React from 'react'
import { ClientLayout } from "@/components/layout/client-layout";
import { getSession, getEffectiveRoles } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { redirect } from "next/navigation";
import { getFiturForRoles, getBottomNavGlobalEnabled, type FiturAkses } from "@/lib/cache/fitur-akses";
import { getSidebarGroups, type SidebarGroupConfig } from "@/lib/menu/groups";

import { capitalizeEachWord } from '@/lib/utils';

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
  let userName = capitalizeEachWord(session.full_name || 'User')
  let displayRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
  let accessRoles = getEffectiveRoles(session)
  let avatarUrl: string | null = null
  let userShowBottomNav = true  // default aktif

  try {
    const user = await queryOne<{ full_name: string; role: string; roles: string | null; avatar_url: string | null; show_bottomnav: number | null; structural_jabatan: string | null }>(
      'SELECT full_name, role, roles, avatar_url, show_bottomnav, structural_jabatan FROM users WHERE id = ?',
      [session.id]
    );
    if (user) {
      userName = capitalizeEachWord(user.full_name || userName)
      // Parse multi-role dari DB
      let rawRoles = session.roles && session.roles.length > 0 ? session.roles : [session.role]
      try {
        if (user.roles) {
          const parsed = JSON.parse(user.roles)
          if (Array.isArray(parsed) && parsed.length > 0) {
            rawRoles = parsed
          }
        }
      } catch {
        // fallback ke session roles
      }
      if (rawRoles.length === 0) rawRoles = [user.role]
      displayRoles = rawRoles
      accessRoles = getEffectiveRoles({
        ...session,
        role: rawRoles[0] || user.role || session.role,
        roles: rawRoles,
        structural_jabatan: user.structural_jabatan ?? null,
      })
      avatarUrl = user.avatar_url ?? null
      // NULL = belum diset user → ikut default (aktif), 0 = user matiin sendiri
      userShowBottomNav = user.show_bottomnav !== 0
    }
  } catch (err: unknown) {
    console.error('[layout] queryOne users ERROR:', err instanceof Error ? err.message : err)
  }

  console.log('[layout] accessRoles:', accessRoles)

  // Ambil fitur, setting bottomnav, dan konfigurasi grup sidebar secara paralel
  let fiturAkses: FiturAkses[] = []
  let globalBottomNavEnabled = true
  let sidebarGroups: SidebarGroupConfig[] = []

  try {
    [fiturAkses, globalBottomNavEnabled, sidebarGroups] = await Promise.all([
      getFiturForRoles(accessRoles, session.id),
      getBottomNavGlobalEnabled(),
      getSidebarGroups(),
    ])
  } catch (err: unknown) {
    console.error('[layout] fetch error:', err instanceof Error ? err.message : err)
    try { fiturAkses = await getFiturForRoles(accessRoles, session.id) } catch {}
  }

  if (!accessRoles.includes('admin')) {
    fiturAkses = fiturAkses.filter(f => f.href !== '/dashboard/pengaturan/dashboard')
  }

  const hasOperasionalRecipientMenu = fiturAkses.some(f => f.href === '/dashboard/operasional')
  if (accessRoles.includes('admin') && !hasOperasionalRecipientMenu) {
    fiturAkses = [
      ...fiturAkses,
      {
        id: -9901,
        group_name: 'Keuangan Santri',
        title: 'Kas Operasional Unit',
        href: '/dashboard/operasional',
        icon: 'WalletCards',
        roles: ['admin', 'pengurus_asrama', 'sekpen', 'keamanan'],
        is_active: true,
        urutan: 0,
        is_bottomnav: false,
        bottomnav_urutan: 0,
      },
    ]
  }

  console.log('[layout] fiturAkses count:', fiturAkses.length)

  return (
    <ClientLayout
      userRole={displayRoles[0] || 'wali_kelas'}
      userRoles={displayRoles}
      userEmail=""
      userName={userName}
      avatarUrl={avatarUrl}
      fiturAkses={fiturAkses}
      sidebarGroups={sidebarGroups}
      globalBottomNavEnabled={globalBottomNavEnabled}
      userShowBottomNav={userShowBottomNav}
    >
      {children}
    </ClientLayout>
  );
}
