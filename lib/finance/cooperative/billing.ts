import { getFinanceDB, getDB, financeQueryOne } from "@/lib/db";
import { syncRecipients, auditStatement } from "./data";
import { rupiah, type BillKind } from "./types";
import { syncFinanceStudentSnapshot } from "../snapshots";
export async function createBill(input: {
  santriId: string;
  kind: BillKind;
  title: string;
  amount: number;
  period: string;
  actor: string;
}) {
  rupiah(input.amount);
  if (!input.title.trim()) throw new Error("Judul wajib diisi.");
  await syncRecipients();
  await syncFinanceStudentSnapshot(input.santriId);
  const main = (await getDB()) as D1Database;
  const s = await main
    .prepare(
      "SELECT id,tempat_makan_id,tempat_mencuci_id FROM santri WHERE id=? AND status_global='aktif'",
    )
    .bind(input.santriId)
    .first<{
      id: string;
      tempat_makan_id: string | null;
      tempat_mencuci_id: string | null;
    }>();
  if (!s) throw new Error("Santri aktif tidak ditemukan.");
  const source =
    input.kind === "MAKAN"
      ? s.tempat_makan_id
      : input.kind === "LAUNDRY"
        ? s.tempat_mencuci_id
        : null;
  if (["MAKAN", "LAUNDRY"].includes(input.kind) && !source)
    throw new Error("Atur pengelola santri di Katering & Laundry dahulu.");
  const recipient = source ? "jasa-" + source : "pesantren";
  if (
    !(await financeQueryOne(
      "SELECT id FROM finance_coop_recipients WHERE id=?",
      [recipient],
    ))
  )
    throw new Error("Pengelola tidak valid.");
  const db = (await getFinanceDB()) as D1Database,
    id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        "INSERT INTO finance_coop_bills(id,santri_id,kind,title,period_key,recipient_id,amount,created_by) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        s.id,
        input.kind,
        input.title.trim(),
        input.period || null,
        recipient,
        input.amount,
        input.actor,
      ),
    auditStatement(db, input.actor, "CREATE_BILL", "BILL", id, input),
  ]);
  return id;
}
export { generateMonthlyBills } from "./billing-core";
