import { createHash } from "node:crypto";
import {
  getFinanceDB,
  financeQuery as q,
  financeQueryOne as one,
} from "@/lib/db";
import { prepareJournalStatements } from "../ledger";
import { settings, auditStatement } from "./data";
import { distributionEntries } from "./postings";
import { activeShift } from "./orders";
import { rupiah, type Recipient } from "./types";
import type { PaymentModuleCode } from "../modules";
export async function createDistribution(input: {
  key: string;
  recipientId: string;
  amount: number;
  fee: number;
  method: "CASH" | "TRANSFER";
  actor: string;
  moduleCode?: PaymentModuleCode;
}) {
  rupiah(input.amount);
  rupiah(input.fee, true);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const prior = await one<{ id: string; request_hash: string }>(
    "SELECT id,request_hash FROM finance_distributions WHERE request_key=?",
    [input.key],
  );
  if (prior) {
    if (prior.request_hash !== hash)
      throw new Error("Kunci pencairan berbeda isi.");
    return prior.id;
  }
  const recipient = await one<Recipient>(
    "SELECT * FROM finance_coop_recipients WHERE id=?",
    [input.recipientId],
  );
  if (!recipient) throw new Error("Penerima tidak ditemukan.");
  if (
    input.method === "TRANSFER" &&
    (!recipient.account_mask ||
      !recipient.account_holder ||
      !recipient.bank_name)
  )
    throw new Error("Lengkapi rekening penerima dahulu.");
  const config = await settings(),
    net = rupiah(
      input.amount - (config.transferFeeBearer === "PENERIMA" ? input.fee : 0),
    );
  const entitlements = await q<{ id: string; amount: number; paid: number }>(
    `SELECT e.id,e.amount,e.paid+COALESCE((SELECT SUM(i.amount) FROM finance_distribution_items i JOIN finance_distributions d ON d.id=i.distribution_id WHERE i.entitlement_id=e.id AND d.status='DRAFT'),0) paid
     FROM finance_entitlements e JOIN finance_order_items oi ON oi.id=e.order_item_id
     WHERE e.recipient_id=? AND e.reversed=0 AND e.paid<e.amount ${input.moduleCode ? "AND oi.module_code=?" : ""}
     ORDER BY e.created_at,e.id`,
    input.moduleCode ? [recipient.id, input.moduleCode] : [recipient.id],
  );
  let remaining = input.amount;
  const selected: { id: string; amount: number }[] = [];
  for (const e of entitlements) {
    const amount = Math.max(0, Math.min(remaining, e.amount - e.paid));
    if (amount) selected.push({ id: e.id, amount });
    remaining -= amount;
    if (!remaining) break;
  }
  if (remaining) throw new Error("Hak penerima tidak mencukupi.");
  const db = (await getFinanceDB()) as D1Database,
    id = crypto.randomUUID();
  const snapshot = {
    name: recipient.name,
    bank: recipient.bank_name,
    account: recipient.account_mask,
    holder: recipient.account_holder,
  };
  await db.batch([
    db
      .prepare(
        "INSERT INTO finance_distributions(id,request_key,request_hash,recipient_id,gross,fee,fee_bearer,net,method,recipient_snapshot,actor_id,module_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        input.key,
        hash,
        recipient.id,
        input.amount,
        input.fee,
        config.transferFeeBearer,
        net,
        input.method,
        JSON.stringify(snapshot),
        input.actor,
        input.moduleCode || null,
      ),
    ...selected.map((e) =>
      db
        .prepare(
          "INSERT INTO finance_distribution_items(distribution_id,entitlement_id,amount) VALUES(?,?,?)",
        )
        .bind(id, e.id, e.amount),
    ),
    auditStatement(db, input.actor, "CREATE_DISTRIBUTION", "DISTRIBUTION", id, {
      gross: input.amount,
      net,
      fee: input.fee,
    }, input.moduleCode),
  ]);
  return id;
}
export async function finishDistribution(input: {
  id: string;
  reference: string;
  proof: string;
  receivedBy: string;
  shiftId?: string;
  actor: string;
}) {
  const d = await one<{
    id: string;
    recipient_id: string;
    kind: Recipient["kind"];
    gross: number;
    fee: number;
    fee_bearer: string;
    method: string;
    status: string;
  }>(
    "SELECT d.*,r.kind FROM finance_distributions d JOIN finance_coop_recipients r ON r.id=d.recipient_id WHERE d.id=?",
    [input.id],
  );
  if (!d || d.status !== "DRAFT")
    throw new Error("Pencairan tidak dalam status siap diserahkan.");
  if (!input.reference.trim() || !input.receivedBy.trim())
    throw new Error("Referensi dan nama penerima wajib diisi.");
  if (d.method === "TRANSFER" && !/^https:\/\//.test(input.proof))
    throw new Error("Tautan bukti transfer HTTPS wajib diisi.");
  if (d.method === "CASH") await activeShift(input.actor, input.shiftId);
  const db = (await getFinanceDB()) as D1Database;
  const journal = prepareJournalStatements(db, {
    idempotencyKey: "distribution:" + d.id,
    description: "Pencairan " + input.reference,
    sourceType: "COOP_DISTRIBUTION",
    sourceId: d.id,
    actorType: "STAFF",
    actorId: input.actor,
    entries: distributionEntries(
      d.kind,
      d.recipient_id,
      d.gross,
      d.fee,
      d.fee_bearer,
      d.method,
    ),
  });
  await db.batch([
    ...journal.statements,
    ...(d.method === "CASH"
      ? [
          db
            .prepare(
              "INSERT INTO finance_cash_entries(id,shift_id,journal_id,amount) VALUES(?,?,?,?)",
            )
            .bind(
              crypto.randomUUID(),
              input.shiftId,
              journal.journalId,
              -(d.gross + (d.fee_bearer === "KOPERASI" ? d.fee : 0)),
            ),
        ]
      : []),
    db
      .prepare(
        "UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=?",
      )
      .bind(journal.journalId),
    db
      .prepare(
        "UPDATE finance_distributions SET status='PAID',journal_id=?,reference=?,proof_url=?,received_by=?,shift_id=?,paid_at=datetime('now') WHERE id=?",
      )
      .bind(
        journal.journalId,
        input.reference.trim(),
        input.proof || null,
        input.receivedBy.trim(),
        input.shiftId || null,
        d.id,
      ),
    auditStatement(db, input.actor, "PAY_DISTRIBUTION", "DISTRIBUTION", d.id, {
      reference: input.reference,
      receivedBy: input.receivedBy,
    }),
  ]);
}
