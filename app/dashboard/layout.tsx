import { ClientLayout } from "@/components/layout/client-layout";
import { getSession } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const user = await queryOne<{ full_name: string; role: string }>(
    'SELECT full_name, role FROM users WHERE id = ?',
    [session.id]
  );

  const userRole = user?.role || 'wali_kelas';
  const userName = user?.full_name || 'User';

  return (
    <ClientLayout
      userRole={userRole}
      userEmail=""
      userName={userName}
    >
      {children}
    </ClientLayout>
  );
}