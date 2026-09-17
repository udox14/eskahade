import { getFinanceDB, financeQueryOne as one } from "@/lib/db";
import { prepareJournalStatements } from "../ledger";
import { expenseEntries, fundingEntries } from "./postings";
import { auditStatement } from "./data";
import { activeShift } from "./orders";
import { rupiah } from "./types";
export async function openShift(
  actor: string,
  unitId: string,
  opening: number,
) {
  rupiah(opening, true);
  const db = (await getFinanceDB()) as D1Database,
    id = crypto.randomUUID();
  const unit = await one(
    "SELECT id FROM finance_cash_units WHERE id=? AND is_active=1",
    [unitId],
  );
  if (!unit) throw new Error("Unit kas tidak ditemukan.");
  // Opening is a physical count of cash already held, not new income.
  await db.batch([
    db
      .prepare(
        "INSERT INTO finance_cash_shifts(id,cash_unit_id,operator_id,terminal_id,opening_cash_rupiah) VALUES(?,?,?,?,?)",
      )
      .bind(id, unitId, actor, "koperasi-" + actor, opening),
    auditStatement(db, actor, "OPEN_SHIFT", "SHIFT", id, { opening, unitId }),
  ]);
  return id;
}
export async function closeShift(
  actor: string,
  id: string,
  actual: number,
  note: string,
) {
  rupiah(actual, true);
  await activeShift(actor, id);
  const db = (await getFinanceDB()) as D1Database;
  await db.batch([
    db
      .prepare(
        `UPDATE finance_cash_shifts SET expected_closing_rupiah=opening_cash_rupiah+COALESCE((SELECT SUM(amount) FROM finance_cash_entries WHERE shift_id=finance_cash_shifts.id),0),actual_closing_rupiah=?,discrepancy_rupiah=?-opening_cash_rupiah-COALESCE((SELECT SUM(amount) FROM finance_cash_entries WHERE shift_id=finance_cash_shifts.id),0),status=CASE WHEN ?=opening_cash_rupiah+COALESCE((SELECT SUM(amount) FROM finance_cash_entries WHERE shift_id=finance_cash_shifts.id),0) THEN 'CLOSED_OK' ELSE 'CLOSED_REVIEW' END,operator_closing_note=?,closed_at=datetime('now') WHERE id=? AND operator_id=? AND status='OPEN'`,
      )
      .bind(actual, actual, actual, note, id, actor),
    auditStatement(db, actor, "CLOSE_SHIFT", "SHIFT", id, { actual, note }),
  ]);
}
export async function expense(input: {
  key: string;
  actor: string;
  amount: number;
  method: string;
  note: string;
  shiftId?: string;
  funding?: boolean;
}) {
  rupiah(input.amount);
  if (input.note.trim().length < 5)
    throw new Error("Keterangan minimal 5 karakter.");
  if (input.method === "CASH") await activeShift(input.actor, input.shiftId);
  const db = (await getFinanceDB()) as D1Database,
    j = prepareJournalStatements(db, {
      idempotencyKey: input.key,
      description: input.note,
      sourceType: input.funding ? "COOP_CASH_FUNDING" : "COOP_EXPENSE",
      actorType: "STAFF",
      actorId: input.actor,
      entries: input.funding
        ? fundingEntries(input.amount, true)
        : expenseEntries(input.amount, input.method),
    });
  await db.batch([
    ...j.statements,
    ...(input.method === "CASH"
      ? [
          db
            .prepare(
              "INSERT INTO finance_cash_entries(id,shift_id,journal_id,amount) VALUES(?,?,?,?)",
            )
            .bind(
              crypto.randomUUID(),
              input.shiftId,
              j.journalId,
              input.funding ? input.amount : -input.amount,
            ),
        ]
      : []),
    db
      .prepare(
        "UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=?",
      )
      .bind(j.journalId),
    auditStatement(
      db,
      input.actor,
      input.funding ? "FUND_CASH" : "EXPENSE",
      "JOURNAL",
      j.journalId,
      { amount: input.amount, note: input.note },
    ),
  ]);
  return j.journalId;
}
