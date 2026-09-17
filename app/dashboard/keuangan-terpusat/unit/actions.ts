"use server";

import { revalidatePath } from "next/cache";
import { getDB, getFinanceDB, financeQueryOne, queryOne } from "@/lib/db";
import { generateMonthlyBills } from "@/lib/finance/cooperative/billing";
import { generateNonSppBills } from "@/lib/finance/cooperative/non-spp-billing";
import { createDistribution, finishDistribution } from "@/lib/finance/cooperative/distributions";
import { auditStatement } from "@/lib/finance/cooperative/data";
import { requireFinanceAccess } from "@/lib/finance/access";
import {
  MODULE_ACTIONS,
  isPaymentModuleCode,
  requireModuleAccess,
  type PaymentModuleCode,
} from "@/lib/finance/modules";

function modulePath(code: PaymentModuleCode) {
  return `/dashboard/keuangan-terpusat/unit/${code.toLowerCase().replaceAll("_", "-")}`;
}

function checked(form: FormData, name: string) {
  return form.get(name) === "on";
}

export async function generateModuleBills(moduleCode: PaymentModuleCode, form: FormData) {
  if (!isPaymentModuleCode(moduleCode)) throw new Error("Unit kerja tidak valid.");
  const { session } = await requireModuleAccess(moduleCode, "GENERATE");
  const db = (await getFinanceDB()) as D1Database;
  const main = (await getDB()) as D1Database;
  const key = String(form.get("key") || "").trim();
  if (!key) throw new Error("Kunci generate tidak valid.");
  const prior = await financeQueryOne<{ after_json: string }>(
    "SELECT after_json FROM finance_audit_log WHERE action='GENERATE_MODULE_BILLS' AND entity_id=? AND module_code=?", [key, moduleCode],
  );
  if (prior) return;
  let result: unknown;
  if (["SPP", "MAKAN", "LAUNDRY"].includes(moduleCode)) {
    const period = String(form.get("period") || "");
    result = await generateMonthlyBills(main, db, period, session.id, moduleCode as "SPP" | "MAKAN" | "LAUNDRY");
  } else if (moduleCode === "BANGUNAN") {
    result = await generateNonSppBills(main, db, session.id, false, ["BANGUNAN"]);
  } else if (moduleCode === "BIAYA_TAHUNAN") {
    const feeType = String(form.get("annualFeeType") || "");
    const categories = ["EHB", "EKSKUL", "KESEHATAN"].includes(feeType)
      ? [feeType as "EHB" | "EKSKUL" | "KESEHATAN"] : ["EHB", "EKSKUL", "KESEHATAN"] as const;
    result = await generateNonSppBills(main, db, session.id, true, categories);
  } else {
    throw new Error("Uang Jajan memakai setoran saldo, bukan tagihan wajib. Catat setoran melalui pembayaran.");
  }
  await db.batch([auditStatement(db, session.id, "GENERATE_MODULE_BILLS", "BATCH", key, result, moduleCode)]);
  revalidatePath(modulePath(moduleCode), "layout");
}

export async function saveModuleSettings(moduleCode: PaymentModuleCode, form: FormData) {
  const { session } = await requireModuleAccess(moduleCode, "CONFIGURE");
  const activePeriod = String(form.get("activePeriod") || "").trim().slice(0, 40) || null;
  const rawDueDay = Number(form.get("dueDay") || 0);
  const dueDay = rawDueDay >= 1 && rawDueDay <= 31 ? rawDueDay : null;
  const db = (await getFinanceDB()) as D1Database;
  await db.batch([
    db.prepare(`INSERT INTO finance_module_settings(module_code,active_period,due_day,updated_by)
      VALUES(?,?,?,?) ON CONFLICT(module_code) DO UPDATE SET active_period=excluded.active_period,due_day=excluded.due_day,updated_by=excluded.updated_by,updated_at=datetime('now')`)
      .bind(moduleCode, activePeriod, dueDay, session.id),
    auditStatement(db, session.id, "SET_MODULE_SETTINGS", "MODULE", moduleCode, { activePeriod, dueDay }, moduleCode),
  ]);
  revalidatePath(modulePath(moduleCode), "layout");
}

export async function saveModuleChecklist(moduleCode: PaymentModuleCode, form: FormData) {
  const { session } = await requireModuleAccess(moduleCode, "VIEW");
  const steps = ["tarif", "periode", "peserta", "generate", "hasil"];
  const db = (await getFinanceDB()) as D1Database;
  await db.batch(steps.map((step) => db.prepare(`INSERT INTO finance_module_help_progress(user_id,module_code,step_code,completed)
    VALUES(?,?,?,?) ON CONFLICT(user_id,module_code,step_code) DO UPDATE SET completed=excluded.completed,updated_at=datetime('now')`)
    .bind(session.id, moduleCode, step, checked(form, step) ? 1 : 0)));
  revalidatePath(`${modulePath(moduleCode)}/petunjuk`);
}

export async function saveModuleAccess(moduleCode: PaymentModuleCode, form: FormData) {
  const admin = await requireFinanceAccess("CONFIGURE");
  const userId = String(form.get("userId") || "").trim();
  if (!(await queryOne("SELECT id FROM users WHERE id=?", [userId]))) throw new Error("Akun tidak ditemukan.");
  const permissions = MODULE_ACTIONS.filter((action) => checked(form, `permission_${action}`));
  if (!permissions.includes("VIEW")) permissions.unshift("VIEW");
  const db = (await getFinanceDB()) as D1Database;
  await db.batch([
    db.prepare(`INSERT INTO finance_module_access(user_id,module_code,permissions_json,created_by)
      VALUES(?,?,?,?) ON CONFLICT(user_id,module_code) DO UPDATE SET permissions_json=excluded.permissions_json,updated_at=datetime('now')`)
      .bind(userId, moduleCode, JSON.stringify(permissions), admin.id),
    auditStatement(db, admin.id, "SET_MODULE_ACCESS", "USER", userId, { permissions }, moduleCode),
  ]);
  revalidatePath(`${modulePath(moduleCode)}/pengaturan`);
}

export async function createModuleDistribution(moduleCode: PaymentModuleCode, form: FormData) {
  const { session } = await requireModuleAccess(moduleCode, "DISTRIBUTE");
  const id = await createDistribution({
    key: String(form.get("key") || ""), recipientId: String(form.get("recipientId") || ""),
    amount: Number(form.get("amount") || 0), fee: Number(form.get("fee") || 0),
    method: form.get("method") === "TRANSFER" ? "TRANSFER" : "CASH", actor: session.id, moduleCode,
  });
  revalidatePath(`${modulePath(moduleCode)}/penyaluran`);
  void id;
}

export async function finishModuleDistribution(moduleCode: PaymentModuleCode, form: FormData) {
  const { session } = await requireModuleAccess(moduleCode, "DISTRIBUTE");
  const id = String(form.get("id") || "");
  const row = await financeQueryOne<{ module_code: string | null }>("SELECT module_code FROM finance_distributions WHERE id=?", [id]);
  if (!row || row.module_code !== moduleCode) throw new Error("Pencairan bukan milik unit kerja ini.");
  await finishDistribution({ id, reference: String(form.get("reference") || ""), proof: String(form.get("proof") || ""), receivedBy: String(form.get("receivedBy") || ""), actor: session.id });
  revalidatePath(`${modulePath(moduleCode)}/penyaluran`);
}
