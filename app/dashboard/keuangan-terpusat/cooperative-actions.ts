"use server";
import { reverseReceipt } from "@/lib/finance/cooperative/corrections";
import { reconcileGatewaySettlement } from "@/lib/finance/settlement";
import { revalidatePath } from "next/cache";
import {
  getFinanceDB,
  getDB,
  financeQuery as q,
  financeQueryOne as one,
  query,
  queryOne,
} from "@/lib/db";
import { requireFinanceAccess, financeRoles } from "@/lib/finance/access";
import {
  createOrder,
  cancelOrder,
  receiveOrder,
  activeShift,
} from "@/lib/finance/cooperative/orders";
import {
  createBill,
  generateMonthlyBills,
} from "@/lib/finance/cooperative/billing";
import {
  createDistribution,
  finishDistribution,
} from "@/lib/finance/cooperative/distributions";
import { openShift, closeShift, expense } from "@/lib/finance/cooperative/cash";
import {
  auditStatement,
  settings,
  syncRecipients,
} from "@/lib/finance/cooperative/data";
import {
  BILL_KINDS,
  rupiah,
  type BillKind,
  type Settings,
} from "@/lib/finance/cooperative/types";
import { encryptFinanceValue } from "@/lib/finance/encryption";
import { setStudentPin, resolveCredential } from "@/lib/finance/credentials";
import { withdrawPocketMoney } from "@/lib/finance/withdrawal";
import { inquireVa } from "@/lib/finance/cooperative/snap";
import { isDemoRequest } from "@/lib/auth/demo-context";
const text = (f: FormData, k: string) => String(f.get(k) || "").trim();
const number = (f: FormData, k: string) => Number(text(f, k));
export async function searchCoopStudents(search: string) {
  await requireFinanceAccess("CREATE");
  return query<{ id: string; nama_lengkap: string; nis: string }>(
    "SELECT id,nama_lengkap,nis FROM santri WHERE status_global='aktif' AND (nama_lengkap LIKE ? OR nis LIKE ?) ORDER BY nama_lengkap LIMIT 30",
    ["%" + search.slice(0, 80) + "%", "%" + search.slice(0, 80) + "%"],
  );
}
export async function studentCheckout(santriId: string) {
  await requireFinanceAccess("CREATE");
  return {
    bills: await q<import("@/lib/finance/cooperative/types").Bill>(
      "SELECT * FROM finance_coop_bills WHERE santri_id=? AND status IN ('OPEN','PARTIAL') ORDER BY created_at",
      [santriId],
    ),
    settings: await settings(),
    balance:
      (
        await one<{ balance_rupiah: number }>(
          "SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id=? AND wallet_kind='JAJAN'",
          [santriId],
        )
      )?.balance_rupiah || 0,
  };
}
export async function scanCoopStudent(token: string) {
  await requireFinanceAccess("CREATE");
  const c = await resolveCredential("QR_STATIC", token);
  if (!c) throw new Error("Kartu tidak aktif.");
  return queryOne<{
    id: string;
    nama_lengkap: string;
    nis: string;
    foto_url: string | null;
  }>(
    "SELECT id,nama_lengkap,nis,foto_url FROM santri WHERE id=? AND status_global='aktif'",
    [c.santri_id],
  );
}
export async function coopAction(
  form: FormData,
): Promise<{ success: boolean; message: string; id?: string }> {
  try {
    const action = text(form, "action"),
      configActions = [
        "settings",
        "recipient",
        "tariff",
        "bill",
        "generate",
        "unit",
        "access",
        "va",
        "limits",
      ],
      session = await requireFinanceAccess(
        configActions.includes(action)
          ? "CONFIGURE"
          : action === "pin"
            ? "CARDS"
            : "CREATE",
      );
    const actor = session.id,
      db = (await getFinanceDB()) as D1Database;
    let id = "",
      message = "Perubahan disimpan.";
    const key = text(form, "key") || crypto.randomUUID();
    if (action === "checkout") {
      const raw = JSON.parse(text(form, "items") || "[]") as {
        billId: string;
        amount: number;
      }[];
      if (!Array.isArray(raw)) throw new Error("Item tidak valid.");
      const o = await createOrder({
        key,
        santriId: text(form, "santriId"),
        actorId: actor,
        channel: "CASH",
        items: raw,
        jajan: number(form, "jajan"),
        shiftId: text(form, "shiftId"),
      });
      id = o.id;
      message = "Pembayaran diterima. Bukti tersedia.";
    } else if (action === "bill") {
      const kind = text(form, "kind") as BillKind;
      if (!BILL_KINDS.includes(kind))
        throw new Error("Jenis tagihan tidak valid.");
      id = await createBill({
        santriId: text(form, "santriId"),
        kind,
        title: text(form, "title"),
        amount: number(form, "amount"),
        period: text(form, "period"),
        actor,
      });
    } else if (action === "generate") {
      const r = await generateMonthlyBills(
        (await getDB()) as D1Database,
        db,
        text(form, "period"),
        actor,
      );
      message =
        r.created +
        " tagihan dibuat; " +
        r.missing +
        " layanan belum memiliki pengelola.";
    } else if (action === "tariff") {
      const kind = text(form, "kind");
      if (
        !BILL_KINDS.includes(kind as BillKind) ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(text(form, "period"))
      )
        throw new Error("Jenis atau bulan tidak valid.");
      id = crypto.randomUUID();
      await db.batch([
        db
          .prepare(
            "INSERT INTO finance_coop_tariffs(id,kind,title,amount,effective_month,recurring,created_by) VALUES(?,?,?,?,?,1,?)",
          )
          .bind(
            id,
            kind,
            text(form, "title"),
            rupiah(number(form, "amount")),
            text(form, "period"),
            actor,
          ),
        auditStatement(db, actor, "SET_TARIFF", "TARIFF", id, {
          kind,
          amount: number(form, "amount"),
        }),
      ]);
    } else if (action === "distribution") {
      id = await createDistribution({
        key,
        recipientId: text(form, "recipientId"),
        amount: number(form, "amount"),
        fee: number(form, "fee"),
        method: text(form, "method") === "TRANSFER" ? "TRANSFER" : "CASH",
        actor,
      });
      message = "Bukti pencairan dibuat. Dana belum ditandai diserahkan.";
    } else if (action === "finish") {
      await finishDistribution({
        id: text(form, "id"),
        reference: text(form, "reference"),
        proof: text(form, "proof"),
        receivedBy: text(form, "receivedBy"),
        shiftId: text(form, "shiftId"),
        actor,
      });
      message = "Pencairan tercatat selesai.";
    } else if (action === "openShift") {
      id = await openShift(actor, text(form, "unitId"), number(form, "amount"));
    } else if (action === "closeShift") {
      await closeShift(
        actor,
        text(form, "shiftId"),
        number(form, "amount"),
        text(form, "note"),
      );
    } else if (action === "withdraw") {
      const shift = await activeShift(actor, text(form, "shiftId"));
      if (text(form, "confirmed") !== "yes")
        throw new Error("Konfirmasi identitas santri dahulu.");
      const r = await withdrawPocketMoney({
        idempotencyKey: key,
        credentialKind: "QR_STATIC",
        rawToken: text(form, "token"),
        pin: text(form, "pin"),
        amountRupiah: number(form, "amount"),
        cashUnitId: shift.cash_unit_id,
        shiftId: shift.id,
        operatorId: actor,
        terminalId: shift.terminal_id,
        identityConfirmed: true,
      });
      if (!r.success) throw new Error(r.error);
      id = r.withdrawalId;
      message = "Uang jajan dicairkan.";
    } else if (action === "expense" || action === "funding") {
      id = await expense({
        key,
        actor,
        amount: number(form, "amount"),
        method: text(form, "method") === "TRANSFER" ? "TRANSFER" : "CASH",
        note: text(form, "note"),
        shiftId: text(form, "shiftId"),
        funding: action === "funding",
      });
    } else if (action === "refund") {
      await reverseReceipt({
        id: text(form, "id"),
        actor,
        reason: text(form, "note"),
        reference: text(form, "reference"),
        shiftId: text(form, "shiftId"),
      });
    } else if (action === "cancelDistribution") {
      await db.batch([
        db
          .prepare(
            "UPDATE finance_distributions SET status='CANCELLED' WHERE id=? AND status='DRAFT'",
          )
          .bind(text(form, "id")),
        auditStatement(
          db,
          actor,
          "CANCEL_DISTRIBUTION",
          "DISTRIBUTION",
          text(form, "id"),
          { reason: text(form, "note") },
        ),
      ]);
    } else if (action === "settlement") {
      const r = await reconcileGatewaySettlement({
        idempotencyKey: key,
        grossRupiah: number(form, "gross"),
        netRupiah: number(form, "net"),
        providerFeeRupiah: number(form, "fee"),
        bankReference: text(form, "reference"),
        actorId: actor,
      });
      if (!r.success) throw new Error(r.error);
    } else if (action === "reconciliation") {
      const book = await one<{ balance_rupiah: number }>(
        "SELECT balance_rupiah FROM finance_account_balances WHERE account_id='fa-main-bank'",
      );
      await db.batch([
        db
          .prepare(
            "INSERT INTO finance_coop_reconciliations(id,period_key,statement_reference,actual_bank,book_bank,note,actor_id) VALUES(?,?,?,?,?,?,?)",
          )
          .bind(
            key,
            text(form, "period"),
            text(form, "reference"),
            rupiah(number(form, "amount"), true),
            book?.balance_rupiah || 0,
            text(form, "note"),
            actor,
          ),
        auditStatement(db, actor, "RECONCILIATION", "RECONCILIATION", key, {
          reference: text(form, "reference"),
        }),
      ]);
    } else if (action === "cancelOrder") {
      await cancelOrder(text(form, "id"), actor);
    } else if (action === "inquiry") {
      const order = await one<{ santri_id: string }>(
        "SELECT santri_id FROM finance_orders WHERE id=?",
        [text(form, "id")],
      );
      if (!order) throw new Error("Pesanan tidak ditemukan.");
      const result = await inquireVa(order.santri_id, text(form, "id"));
      message = JSON.stringify(result);
    } else if (action === "demoPay") {
      if (!(await isDemoRequest())) throw new Error("Hanya demo.");
      const o = await one<{ total: number; va_number: string }>(
        "SELECT total,va_number FROM finance_orders WHERE id=?",
        [text(form, "id")],
      );
      if (!o) throw new Error("Pesanan tidak ditemukan.");
      await receiveOrder({
        orderId: text(form, "id"),
        reference: "DEMO-" + text(form, "id"),
        actorId: actor,
        amount: o.total,
        vaNumber: o.va_number,
      });
    } else if (action === "pin") {
      const r = await setStudentPin(text(form, "santriId"), text(form, "pin"));
      if (!r.success) throw new Error(r.error);
      await db.batch([
        auditStatement(
          db,
          actor,
          "RESET_PIN",
          "STUDENT",
          text(form, "santriId"),
          { reset: true },
        ),
      ]);
    } else if (action === "settings") {
      const before = await settings();
      const config: Settings = {
        ...before,
        paymentPolicy:
          text(form, "policy") === "INSTALLMENT" ? "INSTALLMENT" : "FULL",
        transferFeeBearer:
          text(form, "feeBearer") === "PENERIMA" ? "PENERIMA" : "KOPERASI",
        gatewayFee: rupiah(number(form, "gatewayFee"), true),
        onlineEnabled: text(form, "online") === "yes",
        overrides: {},
      };
      for (const kind of BILL_KINDS) {
        const v = text(form, "policy_" + kind);
        if (v === "FULL" || v === "INSTALLMENT") config.overrides[kind] = v;
      }
      if (
        config.onlineEnabled &&
        !(await isDemoRequest()) &&
        (!process.env.DUITKU_SNAP_PRIVATE_KEY ||
          process.env.DUITKU_SNAP_PUBLIC_KEY === undefined ||
          process.env.DUITKU_SNAP_READY !== "true")
      )
        throw new Error(
          "Aktivasi SNAP dan uji sandbox belum dikonfirmasi di server.",
        );
      await db.batch([
        db
          .prepare(
            "INSERT INTO finance_settings(key,value,updated_by) VALUES('cooperative_settings',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=datetime('now')",
          )
          .bind(JSON.stringify(config), actor),
        auditStatement(
          db,
          actor,
          "SETTINGS",
          "SETTINGS",
          "cooperative_settings",
          { before, after: config },
        ),
      ]);
    } else if (action === "recipient") {
      await syncRecipients();
      const account = text(form, "account"),
        method = text(form, "method") === "TRANSFER" ? "TRANSFER" : "CASH";
      if (
        method === "TRANSFER" &&
        (!/^\d{6,24}$/.test(account) ||
          !text(form, "bank") ||
          !text(form, "holder"))
      )
        throw new Error("Lengkapi rekening tujuan.");
      await db.batch([
        db
          .prepare(
            "UPDATE finance_coop_recipients SET method=?,bank_name=?,account_encrypted=?,account_mask=?,account_holder=? WHERE id=?",
          )
          .bind(
            method,
            text(form, "bank") || null,
            account ? await encryptFinanceValue(account) : null,
            account ? "****" + account.slice(-4) : null,
            text(form, "holder") || null,
            text(form, "recipientId"),
          ),
        auditStatement(
          db,
          actor,
          "SET_RECIPIENT",
          "RECIPIENT",
          text(form, "recipientId"),
          { method, accountMask: account ? "****" + account.slice(-4) : null },
        ),
      ]);
    } else if (action === "unit") {
      id = crypto.randomUUID();
      await db.batch([
        db
          .prepare("INSERT INTO finance_cash_units(id,name) VALUES(?,?)")
          .bind(id, text(form, "title")),
        auditStatement(db, actor, "CREATE_UNIT", "CASH_UNIT", id, {
          name: text(form, "title"),
        }),
      ]);
    } else if (action === "access") {
      const user = await queryOne("SELECT id FROM users WHERE id=?", [
        text(form, "userId"),
      ]);
      if (!user) throw new Error("User tidak ditemukan.");
      await db.batch([
        db
          .prepare(
            "INSERT OR IGNORE INTO finance_coop_user_units(user_id,recipient_id) VALUES(?,?)",
          )
          .bind(text(form, "userId"), text(form, "recipientId")),
        auditStatement(db, actor, "LINK_UNIT", "USER", text(form, "userId"), {
          recipientId: text(form, "recipientId"),
        }),
      ]);
    } else if (action === "va") {
      const customer = text(form, "customerNo"),
        prefix = (await isDemoRequest())
          ? "999999"
          : process.env.DUITKU_SNAP_VA_PREFIX;
      if (!prefix || !/^\d{1,10}$/.test(customer))
        throw new Error("Prefix atau nomor anggota VA tidak valid.");
      if (
        !(await queryOne("SELECT id FROM santri WHERE id=?", [
          text(form, "santriId"),
        ]))
      )
        throw new Error("Santri tidak ditemukan.");
      await db.batch([
        db
          .prepare(
            "INSERT INTO finance_student_va(santri_id,customer_no,va_number) VALUES(?,?,?)",
          )
          .bind(text(form, "santriId"), customer, prefix + customer),
        auditStatement(
          db,
          actor,
          "ISSUE_VA",
          "STUDENT",
          text(form, "santriId"),
          { va: prefix + customer },
        ),
      ]);
    } else if (action === "limits") {
      const values = ["daily", "weekly", "monthly"].map((k) =>
        text(form, k) ? rupiah(number(form, k)) : null,
      );
      await db.batch([
        db
          .prepare(
            "INSERT INTO finance_withdrawal_limits(santri_id,daily_rupiah,weekly_rupiah,monthly_rupiah) VALUES(?,?,?,?) ON CONFLICT(santri_id) DO UPDATE SET daily_rupiah=excluded.daily_rupiah,weekly_rupiah=excluded.weekly_rupiah,monthly_rupiah=excluded.monthly_rupiah,version=version+1",
          )
          .bind(text(form, "santriId"), ...values),
        auditStatement(
          db,
          actor,
          "SET_LIMITS",
          "STUDENT",
          text(form, "santriId"),
          { values },
        ),
      ]);
    } else throw new Error("Tindakan tidak dikenal.");
    revalidatePath("/dashboard/keuangan-terpusat", "layout");
    revalidatePath("/portal-ortu/keuangan");
    return { success: true, message, id: id || undefined };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Transaksi gagal. Silakan coba lagi.",
    };
  }
}
