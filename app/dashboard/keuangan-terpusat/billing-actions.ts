"use server";

import { revalidatePath } from "next/cache";
import { getDB, getFinanceDB } from "@/lib/db";
import { requireFinanceAccess } from "@/lib/finance/access";
import { auditStatement, syncRecipients } from "@/lib/finance/cooperative/data";
import {
  generateNonSppBills,
  previewNonSppBills,
} from "@/lib/finance/cooperative/non-spp-billing";
import {
  EXEMPTION_ITEM_CODES,
  type ExemptionItemCode,
} from "@/lib/finance/cooperative/types";
import {
  accountNumberProblem,
  bankCodeProblem,
} from "@/lib/finance/banks";
import { encryptFinanceValue } from "@/lib/finance/encryption";

const PATH = "/dashboard/keuangan-terpusat/tagihan";

export async function previewCentralNonSppBilling() {
  await requireFinanceAccess("CONFIGURE");
  return previewNonSppBills(
    (await getDB()) as D1Database,
    (await getFinanceDB()) as D1Database,
    true,
  );
}

export async function generateCentralNonSppBilling(idempotencyKey: string) {
  const session = await requireFinanceAccess("CONFIGURE");
  if (!idempotencyKey.trim()) throw new Error("Kunci eksekusi tidak valid.");
  const db = (await getFinanceDB()) as D1Database;
  const prior = await db
    .prepare(
      "SELECT after_json FROM finance_audit_log WHERE action='GENERATE_NON_SPP_BATCH' AND entity_id=? LIMIT 1",
    )
    .bind(idempotencyKey)
    .first<{ after_json: string }>();
  if (prior) return JSON.parse(prior.after_json);
  const result = await generateNonSppBills(
    (await getDB()) as D1Database,
    db,
    session.id,
    true,
  );
  await db.batch([
    auditStatement(
      db,
      session.id,
      "GENERATE_NON_SPP_BATCH",
      "BATCH",
      idempotencyKey,
      result,
    ),
  ]);
  revalidatePath(PATH);
  return result;
}

export type ExemptionInput = {
  santriId: string;
  itemCode: ExemptionItemCode;
  scope: "PERMANENT" | "PERIOD";
  periodKey?: string;
  reason: string;
};

function validateExemption(input: ExemptionInput) {
  if (!input.santriId.trim()) throw new Error("Pilih santri.");
  if (!EXEMPTION_ITEM_CODES.includes(input.itemCode))
    throw new Error("Kategori pembebasan tidak valid.");
  if (input.itemCode === "BANGUNAN" && input.scope !== "PERMANENT")
    throw new Error("Bangunan hanya dapat dibebaskan permanen.");
  if (input.scope === "PERIOD" && !input.periodKey?.trim())
    throw new Error("Periode pembebasan wajib diisi.");
  if (input.reason.trim().length < 5)
    throw new Error("Alasan minimal 5 karakter.");
}

function billMatch(input: ExemptionInput) {
  if (["BANGUNAN", "KESEHATAN", "EHB", "EKSKUL"].includes(input.itemCode)) {
    const period = input.periodKey?.startsWith("TA:")
      ? Number(input.periodKey.slice(3))
      : null;
    return {
      sql: `kind='NON_SPP' AND category_code=?${period ? " AND academic_year_id=?" : ""}`,
      params: period ? [input.itemCode, period] : [input.itemCode],
    };
  }
  return {
    sql: `kind=?${input.scope === "PERIOD" ? " AND period_key LIKE ?" : ""}`,
    params:
      input.scope === "PERIOD"
        ? [input.itemCode, `${input.periodKey}:%`]
        : [input.itemCode],
  };
}

export async function saveBillingExemption(input: ExemptionInput) {
  const session = await requireFinanceAccess("CONFIGURE");
  validateExemption(input);
  const main = (await getDB()) as D1Database;
  const student = await main
    .prepare("SELECT id FROM santri WHERE id=? AND status_global='aktif'")
    .bind(input.santriId)
    .first();
  if (!student) throw new Error("Santri aktif tidak ditemukan.");
  const db = (await getFinanceDB()) as D1Database;
  const match = billMatch(input);
  const bills = (
    await db
      .prepare(
        `SELECT id,status,paid FROM finance_coop_bills WHERE santri_id=? AND ${match.sql}`,
      )
      .bind(input.santriId, ...match.params)
      .all<{ id: string; status: string; paid: number }>()
  ).results ?? [];
  if (bills.some((bill) => bill.paid > 0 || ["PARTIAL", "PAID"].includes(bill.status)))
    throw new Error(
      "Pembebasan ditolak karena tagihan sudah dibayar. Lakukan koreksi atau refund terlebih dahulu.",
    );
  const id = crypto.randomUUID();
  const periodKey = input.scope === "PERIOD" ? input.periodKey!.trim() : null;
  const existing = await db
    .prepare(
      `SELECT id FROM finance_bill_exemptions
       WHERE santri_id=? AND item_code=? AND scope=? AND COALESCE(period_key,'')=COALESCE(?,'')`,
    )
    .bind(input.santriId, input.itemCode, input.scope, periodKey)
    .first<{ id: string }>();
  const ruleId = existing?.id || id;
  const openIds = bills.filter((bill) => bill.status === "OPEN").map((bill) => bill.id);
  const statements = [
    db
      .prepare(
        `INSERT INTO finance_bill_exemptions
         (id,santri_id,item_code,scope,period_key,reason,is_active,created_by,updated_by)
         VALUES(?,?,?,?,?,?,1,?,?)
         ON CONFLICT(santri_id,item_code,scope,COALESCE(period_key,'')) DO UPDATE SET
           reason=excluded.reason,is_active=1,updated_by=excluded.updated_by,updated_at=datetime('now')`,
      )
      .bind(
        ruleId,
        input.santriId,
        input.itemCode,
        input.scope,
        periodKey,
        input.reason.trim(),
        session.id,
        session.id,
      ),
    ...openIds.map((billId) =>
      db
        .prepare(
          `UPDATE finance_coop_bills SET status='VOID',exemption_rule_id=?,exempted_at=datetime('now'),exempted_by=?,exemption_reason=?
           WHERE id=? AND status='OPEN' AND paid=0`,
        )
        .bind(ruleId, session.id, input.reason.trim(), billId),
    ),
    auditStatement(db, session.id, "APPLY_BILL_EXEMPTION", "EXEMPTION", ruleId, {
      ...input,
      periodKey,
      voidedBills: openIds,
    }),
  ];
  await db.batch(statements);
  revalidatePath(PATH);
  return { success: true, ruleId, affectedBills: openIds.length };
}

export async function revokeBillingExemption(ruleId: string, reason: string) {
  const session = await requireFinanceAccess("CONFIGURE");
  if (reason.trim().length < 5) throw new Error("Alasan minimal 5 karakter.");
  const db = (await getFinanceDB()) as D1Database;
  const rule = await db
    .prepare("SELECT * FROM finance_bill_exemptions WHERE id=? AND is_active=1")
    .bind(ruleId)
    .first();
  if (!rule) throw new Error("Pembebasan aktif tidak ditemukan.");
  await db.batch([
    db
      .prepare(
        "UPDATE finance_bill_exemptions SET is_active=0,updated_by=?,updated_at=datetime('now') WHERE id=?",
      )
      .bind(session.id, ruleId),
    db
      .prepare(
        `UPDATE finance_coop_bills SET status='OPEN',exemption_rule_id=NULL,exempted_at=NULL,exempted_by=NULL,exemption_reason=NULL
         WHERE exemption_rule_id=? AND status='VOID' AND paid=0`,
      )
      .bind(ruleId),
    auditStatement(db, session.id, "REVOKE_BILL_EXEMPTION", "EXEMPTION", ruleId, {
      reason: reason.trim(),
    }),
  ]);
  revalidatePath(PATH);
  return { success: true };
}

export async function revokeBillingExemptions(ruleIds: string[], reason: string) {
  const session = await requireFinanceAccess("CONFIGURE");
  const ids = [...new Set(ruleIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length || ids.length > 500) throw new Error("Pilih 1 sampai 500 pembebasan.");
  if (reason.trim().length < 5) throw new Error("Alasan minimal 5 karakter.");
  const db = (await getFinanceDB()) as D1Database;
  const active = (
    await db
      .prepare(
        `SELECT id FROM finance_bill_exemptions WHERE is_active=1 AND id IN (${ids.map(() => "?").join(",")})`,
      )
      .bind(...ids)
      .all<{ id: string }>()
  ).results ?? [];
  if (active.length !== ids.length) throw new Error("Sebagian pembebasan sudah berubah. Muat ulang daftar.");
  const statements = ids.flatMap((id) => [
    db.prepare("UPDATE finance_bill_exemptions SET is_active=0,updated_by=?,updated_at=datetime('now') WHERE id=? AND is_active=1").bind(session.id, id),
    db.prepare("UPDATE finance_coop_bills SET status='OPEN',exemption_rule_id=NULL,exempted_at=NULL,exempted_by=NULL,exemption_reason=NULL WHERE exemption_rule_id=? AND status='VOID' AND paid=0").bind(id),
    auditStatement(db, session.id, "REVOKE_BILL_EXEMPTION", "EXEMPTION", id, { reason: reason.trim(), bulk: true }),
  ]);
  for (let offset = 0; offset < statements.length; offset += 75)
    await db.batch(statements.slice(offset, offset + 75));
  revalidatePath(PATH);
  return { success: true, revoked: ids.length };
}

export async function listBillingExemptions() {
  await requireFinanceAccess("VIEW");
  const db = (await getFinanceDB()) as D1Database;
  const rules = (
    await db
      .prepare(
        `SELECT id,santri_id,item_code,scope,period_key,reason,created_at
         FROM finance_bill_exemptions WHERE is_active=1 ORDER BY created_at DESC LIMIT 500`,
      )
      .all<{
        id: string;
        santri_id: string;
        item_code: string;
        scope: string;
        period_key: string | null;
        reason: string;
        created_at: string;
      }>()
  ).results ?? [];
  if (!rules.length) return [];
  const ids = [...new Set(rules.map((rule) => rule.santri_id))];
  const main = (await getDB()) as D1Database;
  const students = (
    await main
      .prepare(
        `SELECT id,nama_lengkap,nis,asrama FROM santri WHERE id IN (${ids.map(() => "?").join(",")})`,
      )
      .bind(...ids)
      .all<{ id: string; nama_lengkap: string; nis: string; asrama: string | null }>()
  ).results ?? [];
  const byId = new Map(students.map((student) => [student.id, student]));
  return rules.map((rule) => ({ ...rule, student: byId.get(rule.santri_id) || null }));
}

export type RecipientAccountRow = {
  id: string;
  method: "CASH" | "TRANSFER";
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

export type RecipientAccountView = {
  id: string;
  name: string;
  kind: string;
  method: "CASH" | "TRANSFER";
  bank_code: string | null;
  bank_name: string | null;
  account_mask: string | null;
  account_holder: string | null;
};

export async function listRecipientAccounts() {
  await requireFinanceAccess("VIEW");
  await syncRecipients();
  const db = (await getFinanceDB()) as D1Database;
  return (
    await db
      .prepare(
        `SELECT id,name,kind,method,bank_code,bank_name,account_mask,account_holder
         FROM finance_coop_recipients ORDER BY kind,name`,
      )
      .all<RecipientAccountView>()
  ).results ?? [];
}

export async function saveRecipientAccounts(rows: RecipientAccountRow[]) {
  const session = await requireFinanceAccess("CONFIGURE");
  if (!Array.isArray(rows) || !rows.length || rows.length > 500)
    throw new Error("Daftar penerima tidak valid.");
  const db = (await getFinanceDB()) as D1Database;
  const ids = rows.map((row) => row.id.trim());
  if (new Set(ids).size !== ids.length) throw new Error("ID penerima terduplikasi.");
  const existing = (
    await db
      .prepare(
        `SELECT id,account_encrypted,account_mask FROM finance_coop_recipients
         WHERE id IN (${ids.map(() => "?").join(",")})`,
      )
      .bind(...ids)
      .all<{ id: string; account_encrypted: string | null; account_mask: string | null }>()
  ).results ?? [];
  if (existing.length !== rows.length) throw new Error("Ada penerima yang tidak dikenal.");
  const previous = new Map(existing.map((row) => [row.id, row]));
  const errors: { row: number; id: string; message: string }[] = [];
  rows.forEach((row, index) => {
    if (!row.id.trim()) errors.push({ row: index + 1, id: row.id, message: "ID penerima kosong." });
    if (row.method === "TRANSFER") {
      const codeProblem = bankCodeProblem(row.bankCode);
      if (codeProblem) errors.push({ row: index + 1, id: row.id, message: codeProblem });
      if (!row.bankName.trim()) errors.push({ row: index + 1, id: row.id, message: "Nama bank wajib diisi." });
      if (!row.accountHolder.trim()) errors.push({ row: index + 1, id: row.id, message: "Pemilik rekening wajib diisi." });
      if (row.accountNumber.trim()) {
        const numberProblem = accountNumberProblem(row.accountNumber);
        if (numberProblem) errors.push({ row: index + 1, id: row.id, message: numberProblem });
      } else if (!previous.get(row.id)?.account_encrypted) {
        errors.push({ row: index + 1, id: row.id, message: "Nomor rekening belum tersimpan." });
      }
    }
  });
  if (errors.length) return { success: false as const, errors };
  const prepared = await Promise.all(
    rows.map(async (row) => {
      const digits = row.accountNumber.replace(/\s/g, "");
      const old = previous.get(row.id)!;
      return {
        ...row,
        encrypted: digits ? await encryptFinanceValue(digits) : old.account_encrypted,
        mask: digits ? `****${digits.slice(-4)}` : old.account_mask,
      };
    }),
  );
  const statements = prepared.flatMap((row) => [
    db
      .prepare(
        `UPDATE finance_coop_recipients SET method=?,bank_code=?,bank_name=?,account_encrypted=?,account_mask=?,account_holder=? WHERE id=?`,
      )
      .bind(
        row.method,
        row.method === "TRANSFER" ? row.bankCode : null,
        row.method === "TRANSFER" ? row.bankName.trim() : null,
        row.method === "TRANSFER" ? row.encrypted : null,
        row.method === "TRANSFER" ? row.mask : null,
        row.method === "TRANSFER" ? row.accountHolder.trim() : null,
        row.id,
      ),
    auditStatement(db, session.id, "SET_RECIPIENT_ACCOUNT", "RECIPIENT", row.id, {
      method: row.method,
      bankCode: row.method === "TRANSFER" ? row.bankCode : null,
      accountMask: row.method === "TRANSFER" ? row.mask : null,
    }),
  ]);
  for (let offset = 0; offset < statements.length; offset += 80)
    await db.batch(statements.slice(offset, offset + 80));
  revalidatePath("/dashboard/keuangan-terpusat/pengaturan");
  return { success: true as const, updated: rows.length };
}
