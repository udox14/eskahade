import { createHash } from "node:crypto";
import {
  getFinanceDB,
  financeQuery as q,
  financeQueryOne as one,
  queryOne,
} from "@/lib/db";
import { prepareJournalStatements, prepareWalletStatements } from "../ledger";
import { syncFinanceStudentSnapshot } from "../snapshots";
import { settings, auditStatement } from "./data";
import { receiptEntries } from "./postings";
import {
  rupiah,
  policyFor,
  validatePayment,
  type Bill,
  type Order,
  type OrderItem,
  type Channel,
} from "./types";
import { activateVa, deleteVa } from "./snap";
export async function createOrder(input: {
  key: string;
  santriId: string;
  actorId: string;
  channel: Channel;
  items: { billId: string; amount: number }[];
  jajan: number;
  shiftId?: string;
}) {
  if (
    !input.key ||
    input.items.length > 60 ||
    new Set(input.items.map((i) => i.billId)).size !== input.items.length
  )
    throw new Error("Pilihan item tidak valid (maksimal 60).");
  rupiah(input.jajan, true);
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        ...input,
        items: [...input.items].sort((a, b) =>
          a.billId.localeCompare(b.billId),
        ),
      }),
    )
    .digest("hex");
  const prior = await one<Order & { request_hash: string }>(
    "SELECT * FROM finance_orders WHERE request_key=?",
    [input.key],
  );
  if (prior) {
    if (prior.request_hash !== hash)
      throw new Error("Kunci transaksi telah dipakai.");
    if(prior.channel==='CASH' && prior.status==='PREPARING'){
      await receiveOrder({orderId:prior.id,reference:'CASH-'+prior.id,actorId:input.actorId,amount:prior.total});
      return (await one<Order>('SELECT * FROM finance_orders WHERE id=?',[prior.id]))!;
    }
    if(prior.channel==='CASH' && prior.status!=='PAID')throw new Error('Pembayaran tunai belum selesai. Hubungi petugas.');
    return prior;
  }
  const student = await queryOne<{ id: string; nama_lengkap: string }>(
    "SELECT id,nama_lengkap FROM santri WHERE id=? AND status_global='aktif'",
    [input.santriId],
  );
  if (!student) throw new Error("Santri aktif tidak ditemukan.");
  await syncFinanceStudentSnapshot(student.id);
  const config = await settings();
  if (input.channel === "VA" && !config.onlineEnabled)
    throw new Error(
      "Pembayaran VA belum diaktifkan. Silakan membayar di loket.",
    );
  const id = crypto.randomUUID(),
    db = (await getFinanceDB()) as D1Database;
  const items: OrderItem[] = [];
  for (const selected of input.items) {
    const b = await one<Bill>(
      "SELECT * FROM finance_coop_bills WHERE id=? AND santri_id=? AND status IN ('OPEN','PARTIAL')",
      [selected.billId, student.id],
    );
    if (!b) throw new Error("Tagihan sudah berubah atau bukan milik santri.");
    const policy =
      b.kind === "NON_SPP" && b.category_code === "BANGUNAN"
        ? "INSTALLMENT"
        : policyFor(config, b.kind);
    validatePayment(selected.amount, b.amount - b.paid, policy);
    items.push({
      id: crypto.randomUUID(),
      order_id: id,
      bill_id: b.id,
      kind: b.kind,
      title: b.title,
      recipient_id: b.recipient_id,
      amount: selected.amount,
      policy,
    });
  }
  if (input.jajan)
    items.push({
      id: crypto.randomUUID(),
      order_id: id,
      bill_id: null,
      kind: "JAJAN",
      title: "Uang jajan",
      recipient_id: null,
      amount: input.jajan,
      policy: "FULL",
    });
  const amount = rupiah(items.reduce((s, i) => s + i.amount, 0)),
    fee = input.channel === "VA" ? rupiah(config.gatewayFee, true) : 0,
    total = rupiah(amount + fee);
  const expiry = new Date(Date.now() + 24 * 3600000).toISOString();
  if (input.channel === "CASH") await activeShift(input.actorId, input.shiftId);
  await db.batch([
    db
      .prepare(
        "INSERT INTO finance_orders(id,request_key,request_hash,santri_id,actor_id,channel,amount,fee,total,expires_at,shift_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        input.key,
        hash,
        student.id,
        input.actorId,
        input.channel,
        amount,
        fee,
        total,
        expiry,
        input.shiftId || null,
      ),
    ...items.map((i) =>
      db
        .prepare(
          "INSERT INTO finance_order_items(id,order_id,bill_id,kind,title,recipient_id,amount,policy) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(
          i.id,
          id,
          i.bill_id,
          i.kind,
          i.title,
          i.recipient_id,
          i.amount,
          i.policy,
        ),
    ),
    auditStatement(db, input.actorId, "CREATE_ORDER", "ORDER", id, {
      total,
      channel: input.channel,
    }),
  ]);
  if (input.channel === "CASH")
    await receiveOrder({
      orderId: id,
      reference: "CASH-" + id,
      actorId: input.actorId,
      amount: total,
    });
  else {
    try {
      const va = await activateVa(
        student.id,
        student.nama_lengkap,
        id,
        total,
        expiry,
      );
      await db
        .prepare(
          "UPDATE finance_orders SET va_number=?,status='PENDING' WHERE id=? AND status='PREPARING'",
        )
        .bind(va, id)
        .run();
    } catch (error) {
      await db.batch([
        db
          .prepare(
            "UPDATE finance_orders SET status='REVIEW' WHERE id=? AND status='PREPARING'",
          )
          .bind(id),
        db
          .prepare(
            "INSERT INTO finance_payment_exceptions(id,event_key,order_id,reason,payload_json) VALUES(?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            "activate:" + id,
            id,
            "Aktivasi VA belum dapat dipastikan",
            JSON.stringify({
              message: error instanceof Error ? error.message : "Gateway gagal",
            }),
          ),
      ]);
      throw new Error(
        "Aktivasi VA perlu diperiksa petugas. Jangan membuat pembayaran lain.",
      );
    }
  }
  return (await one<Order>("SELECT * FROM finance_orders WHERE id=?", [id]))!;
}
export async function activeShift(actor: string, id?: string) {
  const row = await one<{
    id: string;
    cash_unit_id: string;
    terminal_id: string;
  }>(
    "SELECT id,cash_unit_id,terminal_id FROM finance_cash_shifts WHERE id=? AND operator_id=? AND status='OPEN'",
    [id || "", actor],
  );
  if (!row) throw new Error("Buka shift loket terlebih dahulu.");
  return row;
}
export async function receiveOrder(input: {
  orderId: string;
  reference: string;
  actorId: string;
  amount: number;
  vaNumber?: string;
}) {
  const order = await one<
    Order & { shift_id: string | null; provider_reference: string | null }
  >("SELECT * FROM finance_orders WHERE id=?", [input.orderId]);
  if (!order) throw new Error("Pesanan tidak ditemukan.");
  if (
    order.total !== input.amount ||
    (order.channel === "VA" && input.vaNumber !== order.va_number)
  )
    throw new Error("Identitas atau nominal pembayaran tidak cocok.");
  if (order.status === "PAID") {
    if (order.provider_reference !== input.reference)
      throw new Error("Pembayaran tambahan untuk pesanan yang sudah lunas.");
    return order.id;
  }
  if (!["PREPARING", "PENDING"].includes(order.status))
    throw new Error("Pesanan memerlukan penanganan petugas.");
  if (order.channel === "VA" && Date.parse(order.expires_at) < Date.now())
    throw new Error("Pembayaran melewati batas waktu.");
  if (order.channel === "CASH")
    await activeShift(input.actorId, order.shift_id || "");
  const items = await q<OrderItem>(
      "SELECT * FROM finance_order_items WHERE order_id=?",
      [order.id],
    ),
    db = (await getFinanceDB()) as D1Database;
  const journal = prepareJournalStatements(db, {
    idempotencyKey: "receipt:" + order.id,
    description: "Pembayaran item " + order.id,
    sourceType: "COOP_RECEIPT",
    sourceId: order.id,
    actorType: order.channel === "VA" ? "GATEWAY" : "STAFF",
    actorId: input.actorId,
    entries: receiptEntries(order.santri_id, order.channel, items, order.fee),
  });
  const jajan = items
    .filter((i) => i.kind === "JAJAN")
    .reduce((s, i) => s + i.amount, 0);
  try {
    await db.batch([
      ...(order.channel === "VA"
        ? [
            db
              .prepare(
                "INSERT INTO finance_snap_events(event_key,order_id) VALUES(?,?)",
              )
              .bind(input.reference, order.id),
          ]
        : []),
      ...journal.statements,
      ...(jajan
        ? prepareWalletStatements(db, journal.journalId, [
            {
              idempotencyKey: "jajan:" + order.id,
              santriId: order.santri_id,
              walletKind: "JAJAN",
              amountRupiah: jajan,
              movementType: "DEPOSIT",
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
                order.shift_id,
                journal.journalId,
                order.total,
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
          "UPDATE finance_orders SET status='PAID',journal_id=?,provider_reference=?,paid_at=datetime('now') WHERE id=?",
        )
        .bind(journal.journalId, input.reference, order.id),
      db
        .prepare(
          "UPDATE finance_payment_exceptions SET resolution='Pembayaran diterima melalui callback valid',resolved_by='SYSTEM' WHERE order_id=? AND resolution IS NULL",
        )
        .bind(order.id),
      auditStatement(db, input.actorId, "PAY_ORDER", "ORDER", order.id, {
        reference: input.reference,
        amount: order.total,
      }),
    ]);
  } catch (error) {
    const now = await one<{ status: string; provider_reference: string }>(
      "SELECT status,provider_reference FROM finance_orders WHERE id=?",
      [order.id],
    );
    if (now?.status === "PAID" && now.provider_reference === input.reference)
      return order.id;
    throw error;
  }
  return order.id;
}
export async function cancelOrder(
  id: string,
  actor: string,
  santriId?: string,
) {
  const order = await one<Order>("SELECT * FROM finance_orders WHERE id=?", [
    id,
  ]);
  if (!order || (santriId && order.santri_id !== santriId))
    throw new Error("Pesanan tidak ditemukan.");
  if (!["PREPARING", "PENDING", "REVIEW"].includes(order.status))
    throw new Error("Pesanan tidak bisa dibatalkan.");
  if (order.channel === "VA") await deleteVa(order.santri_id, order.id);
  const db = (await getFinanceDB()) as D1Database;
  await db.batch([
    db
      .prepare(
        "UPDATE finance_orders SET status='CANCELLED' WHERE id=? AND status IN ('PREPARING','PENDING','REVIEW')",
      )
      .bind(id),
    auditStatement(db, actor, "CANCEL_ORDER", "ORDER", id, {
      providerDeactivated: order.channel === "VA",
    }),
  ]);
}
