import {
  getSession,
  getEffectiveRoles,
  type SessionUser,
} from "@/lib/auth/session";
export type FinancePermission =
  | "VIEW"
  | "CREATE"
  | "CHECK"
  | "CONFIGURE"
  | "AUDIT"
  | "CARDS";
export function financeRoles(session: SessionUser) {
  const r = getEffectiveRoles(session);
  return {
    admin: r.some((x) => ["admin", "admin_koperasi", "demo"].includes(x)),
    operator: r.includes("petugas_koperasi"),
    reader: r.some((x) =>
      [
        "bendahara",
        "pimpinan",
        "pengelola_makan",
        "pengelola_laundry",
      ].includes(x),
    ),
  };
}
export function canConfigureCashUnits(session: SessionUser) {
  return financeRoles(session).admin;
}
export function financeAsramaScope(_session: SessionUser): string | null {
  return null;
}
export type FinanceCapabilities = Record<
  "view" | "create" | "check" | "configure" | "audit",
  boolean
>;
export async function financeCapabilities(
  session: SessionUser,
): Promise<FinanceCapabilities> {
  const p = financeRoles(session);
  return {
    view: p.admin || p.operator || p.reader,
    create: p.admin || p.operator,
    check: false,
    configure: p.admin,
    audit: p.admin || getEffectiveRoles(session).includes("pimpinan"),
  };
}
export async function requireFinanceAccess(permission: FinancePermission) {
  const session = await getSession();
  if (!session) throw new Error("Sesi tidak valid.");
  const p = financeRoles(session);
  const allowed =
    p.admin ||
    (permission === "VIEW" && (p.operator || p.reader)) ||
    (["CREATE", "CARDS"].includes(permission) && p.operator) ||
    (permission === "AUDIT" && getEffectiveRoles(session).includes("pimpinan"));
  if (!allowed) throw new Error("Anda tidak memiliki akses ke tindakan ini.");
  return session;
}
export async function requireCashierOperator() {
  return requireFinanceAccess("CREATE");
}
