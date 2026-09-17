import { financeQueryOne } from "@/lib/db";
import { getEffectiveRoles, getSession, type SessionUser } from "@/lib/auth/session";

export const PAYMENT_MODULE_CODES = [
  "UANG_JAJAN", "MAKAN", "LAUNDRY", "SPP", "BANGUNAN", "BIAYA_TAHUNAN",
] as const;
export type PaymentModuleCode = (typeof PAYMENT_MODULE_CODES)[number];
export const ANNUAL_FEE_TYPES = ["EHB", "EKSKUL", "KESEHATAN"] as const;
export type AnnualFeeType = (typeof ANNUAL_FEE_TYPES)[number];

export const MODULE_ACTIONS = [
  "VIEW", "CONFIGURE", "GENERATE", "PAYMENT", "DISTRIBUTE", "CANCEL", "EXPORT", "REPORT",
] as const;
export type ModuleAction = (typeof MODULE_ACTIONS)[number];

export type PaymentModuleDefinition = {
  code: PaymentModuleCode;
  slug: string;
  label: string;
  shortDescription: string;
  billKind: "SPP" | "MAKAN" | "LAUNDRY" | "NON_SPP" | null;
  categories: readonly (AnnualFeeType | "BANGUNAN")[];
};

export const PAYMENT_MODULES: PaymentModuleDefinition[] = [
  { code: "UANG_JAJAN", slug: "uang-jajan", label: "Uang Jajan", shortDescription: "Setoran, saldo, dan pencairan uang jajan santri.", billKind: null, categories: [] },
  { code: "MAKAN", slug: "makan", label: "Makan", shortDescription: "Tagihan makan, penerimaan, dan hak pengelola makan.", billKind: "MAKAN", categories: [] },
  { code: "LAUNDRY", slug: "laundry", label: "Laundry", shortDescription: "Tagihan laundry, penerimaan, dan hak pengelola laundry.", billKind: "LAUNDRY", categories: [] },
  { code: "SPP", slug: "spp", label: "SPP", shortDescription: "Tagihan bulanan SPP dan pemantauan penerimaannya.", billKind: "SPP", categories: [] },
  { code: "BANGUNAN", slug: "bangunan", label: "Bangunan", shortDescription: "Tagihan bangunan, cicilan, dan penerimaan dana.", billKind: "NON_SPP", categories: ["BANGUNAN"] },
  { code: "BIAYA_TAHUNAN", slug: "biaya-tahunan", label: "Biaya Tahunan", shortDescription: "EHB, Ekstra/Ekskul, dan Kesehatan per tahun ajaran.", billKind: "NON_SPP", categories: ["EHB", "EKSKUL", "KESEHATAN"] },
];

export function paymentModuleFromSlug(slug: string) {
  return PAYMENT_MODULES.find((item) => item.slug === slug) ?? null;
}

export function isPaymentModuleCode(value: string): value is PaymentModuleCode {
  return PAYMENT_MODULE_CODES.includes(value as PaymentModuleCode);
}

const READ_ACTIONS: ModuleAction[] = ["VIEW", "EXPORT", "REPORT"];

export async function moduleActionsForSession(session: SessionUser, moduleCode: PaymentModuleCode) {
  const roles = getEffectiveRoles(session);
  if (roles.some((role) => ["admin", "admin_koperasi", "demo"].includes(role))) return new Set<ModuleAction>(MODULE_ACTIONS);
  if (roles.includes("bendahara")) return new Set<ModuleAction>(READ_ACTIONS);
  const roleDefaults: Partial<Record<string, PaymentModuleCode[]>> = {
    petugas_koperasi: ["UANG_JAJAN"], pengelola_makan: ["MAKAN"], pengelola_laundry: ["LAUNDRY"],
  };
  const actions = new Set<ModuleAction>();
  for (const role of roles) {
    if (roleDefaults[role]?.includes(moduleCode)) READ_ACTIONS.forEach((action) => actions.add(action));
  }
  const row = await financeQueryOne<{ permissions_json: string }>(
    "SELECT permissions_json FROM finance_module_access WHERE user_id=? AND module_code=?", [session.id, moduleCode],
  );
  if (row) {
    try {
      for (const action of JSON.parse(row.permissions_json) as string[]) {
        if (MODULE_ACTIONS.includes(action as ModuleAction)) actions.add(action as ModuleAction);
      }
    } catch {
      // Data akses rusak tidak boleh memperluas kewenangan.
    }
  }
  return actions;
}

export async function requireModuleAccess(moduleCode: PaymentModuleCode, action: ModuleAction) {
  const session = await getSession();
  if (!session) throw new Error("Sesi tidak valid.");
  const actions = await moduleActionsForSession(session, moduleCode);
  if (!actions.has(action)) throw new Error("Anda tidak memiliki akses ke unit kerja ini.");
  return { session, actions };
}

export function modulePeriodKind(moduleCode: PaymentModuleCode) {
  if (moduleCode === "BANGUNAN") return "LIFETIME" as const;
  if (moduleCode === "BIAYA_TAHUNAN") return "ACADEMIC_YEAR" as const;
  return "MONTH" as const;
}
