import {
  getFinanceDB,
  financeQuery as q,
  financeQueryOne as one,
} from "@/lib/db";
import { prepareJournalStatements, prepareWalletStatements } from "../ledger";
import type { FinanceAccountCode } from "../types";
import { auditStatement } from "./data";
import { activeShift } from "./orders";
export async function reverseReceipt(input: {
  id: string;
  actor: string;
  reason: string;
  reference: string;
  shiftId?: string;
}) {
  if (input.reason.trim().length < 10 || !input.reference.trim())
    throw new Error(
      "Alasan minimal 10 karakter dan bukti pengembalian wajib diisi.",
    );
  const order = await one<{
    id: string;
    status: string;
    channel: string;
    santri_id: string;
    total: number;
    journal_id: string;
  }>("SELECT * FROM finance_orders WHERE id=?", [input.id]);
  if (!order || order.status !== "PAID")
    throw new Error("Pembayaran tidak dapat dibalik.");
  // Refunds of settled online payments require separate bank reconciliation. Never reverse clearing as if cash were refunded.

  if (order.channel === "CASH") await activeShift(input.actor, input.shiftId);
  const entries = await q<{
    code: FinanceAccountCode;
    side: "DEBIT" | "CREDIT";
    amount_rupiah: number;
    santri_id: string | null;
    counterparty_id: string | null;
  }>(
    "SELECT a.code,e.side,e.amount_rupiah,e.santri_id,e.counterparty_id FROM finance_journal_entries e JOIN finance_accounts a ON a.id=e.account_id WHERE e.journal_id=?",
    [order.journal_id],
  );
  const jajan = await one<{ amount_rupiah: number }>(
    "SELECT amount_rupiah FROM finance_wallet_movements WHERE journal_id=? AND wallet_kind='JAJAN'",
    [order.journal_id],
  );
  const db = (await getFinanceDB()) as D1Database,
    j = prepareJournalStatements(db, {
      idempotencyKey: "reverse:" + order.id,
      reversalOfId: order.journal_id,
      description: input.reason,
      sourceType: "COOP_REFUND",
      sourceId: order.id,
      externalReference: input.reference,
      actorType: "STAFF",
      actorId: input.actor,
      entries: entries.map((e) => ({
        accountCode: e.code === "1102" ? "1101" : e.code,
        side: e.side === "DEBIT" ? "CREDIT" : "DEBIT",
        amountRupiah: e.amount_rupiah,
        santriId: e.santri_id,
        counterpartyId: e.counterparty_id,
      })),
    });
  await db.batch([
    ...j.statements,
    ...(jajan
      ? prepareWalletStatements(db, j.journalId, [
          {
            idempotencyKey: "refund:" + order.id,
            santriId: order.santri_id,
            walletKind: "JAJAN",
            amountRupiah: -jajan.amount_rupiah,
            movementType: "REFUND",
            referenceType: "ORDER",
            referenceId: order.id,
          },
        ])
      : []),
    ...(order.channel === "CASH"
      ? [
          db
            .prepare(
              "INSERT INTO finance_cash_entries(id,shift_id,journal_id,amount) VALUES(?,?,?,?)",
            )
            .bind(
              crypto.randomUUID(),
              input.shiftId,
              j.journalId,
              -order.total,
            ),
        ]
      : []),
    db
      .prepare(
        "UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=?",
      )
      .bind(j.journalId),
    db
      .prepare("UPDATE finance_orders SET status='REVERSED' WHERE id=?")
      .bind(order.id),
    auditStatement(db, input.actor, "REFUND_ORDER", "ORDER", order.id, {
      reason: input.reason,
      reference: input.reference,
    }),
  ]);
}
