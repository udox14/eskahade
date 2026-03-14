import React from 'react'
import { ClientLayout } from "@/components/layout/client-layout";
import { getSession } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { redirect } from "next/navigation";
import { getFiturForRole, type FiturAkses } from "@/lib/cache/fitur-akses";

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await queryOne<{ full_name: string; role: string; avatar_url: string | null }>(
    'SELECT full_name, role, avatar_url FROM users WHERE id = ?',
    [session.id]
  );

  const userRole = user?.role || 'wali_kelas';
  const userName = user?.full_name || 'User';
  const avatarUrl = user?.avatar_url || null;

  // Ambil fitur yang boleh diakses role ini (satu cache query, hemat row reads)
  const fiturAkses: FiturAkses[] = await getFiturForRole(userRole);

  return (
    <ClientLayout
      userRole={userRole}
      userEmail=""
      userName={userName}
      avatarUrl={avatarUrl}
      fiturAkses={fiturAkses}
    >
      {children}
    </ClientLayout>
  );
}