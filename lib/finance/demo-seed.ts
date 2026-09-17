import { hashPassword } from "@/lib/auth/password";
import { credentialHmac } from "./credentials";
import { encryptFinanceValue } from "./encryption";

export const DEMO_QR_TOKEN = "SKH1.DEMO.SANTRI.0001.TEST.CREDENTIAL";
export const DEMO_STUDENT_PIN = "123456";

export type DemoFinanceUser = {
  id: string;
  fullName: string;
  roles: string[];
};

// Urutan penting: anak dulu, induk belakangan, supaya foreign key tidak menolak.
const RESET_TABLES = [
  "finance_distribution_items",
  "finance_distributions",
  "finance_entitlements",
  "finance_snap_events",
  "finance_payment_exceptions",
  "finance_order_items",
  "finance_orders",
  "finance_coop_bills",
  "finance_coop_tariffs",
  "finance_coop_user_units",
  "finance_coop_recipients",
  "finance_student_va",
  "finance_cash_entries",
  "finance_coop_reconciliations",
  "finance_credential_batch_items",
  "finance_cash_unit_operators",
  "finance_allocation_bill_items",
  "finance_payroll_items",
  "finance_withdrawals",
  "finance_payouts",
  "finance_allocations",
  "finance_payment_intents",
  "finance_gateway_events",
  "finance_bills",
  "finance_service_bill_skip",
  "finance_service_arrears_historis",
  "finance_service_tariffs",
  "finance_payroll_periods",
  "finance_teacher_compensation",
  "finance_reconciliation_checks",
  "finance_recipients",
  "finance_cash_shifts",
  "finance_cash_units",
  "finance_credential_batches",
  "student_credentials",
  "finance_student_security",
  "finance_withdrawal_limits",
  "finance_guardian_students",
  "finance_guardians",
  "finance_wallet_movements",
  "finance_journal_entries",
  "finance_journals",
  "finance_student_wallets",
  "finance_account_balances",
  "finance_periods",
  "finance_audit_log",
  "finance_student_snapshots",
  "finance_teacher_snapshots",
  "finance_settings",
] as const;

const students = [
  ["demo-s-1", "99001", "Demo Santri Satu", "AL-FALAH", "A-01"],
  ["demo-s-2", "99002", "Demo Santri Dua", "AL-FALAH", "A-02"],
  ["demo-s-3", "99003", "Demo Santri Tiga", "AS-SALAM", "B-01"],
  ["demo-s-4", "99004", "Demo Santri Empat", "AS-SALAM", "B-02"],
  ["demo-s-5", "99005", "Demo Santri Lima", "BAHAGIA", "C-01"],
  ["demo-s-6", "99006", "Demo Santri Enam", "BAHAGIA", "C-02"],
] as const;

export async function resetDemoFinanceDatabase(
  db: D1Database,
  demoUsers: DemoFinanceUser[],
) {
  const state = await db
    .prepare(
      "SELECT singleton_id FROM finance_sandbox_state WHERE singleton_id=1",
    )
    .first();
  if (!state) throw new Error("Database ini bukan sandbox.");
  const actorId = demoUsers[0]?.id || "demo-user",
    today = new Date().toISOString().slice(0, 10);
  const statements: D1PreparedStatement[] = [
    db.prepare(
      "UPDATE finance_sandbox_state SET reset_enabled=1 WHERE singleton_id=1",
    ),
    ...RESET_TABLES.map((table) => db.prepare("DELETE FROM " + table)),
    db
      .prepare(
        "INSERT INTO finance_settings(key,value) VALUES('cooperative_settings',?)",
      )
      .bind(
        JSON.stringify({
          paymentPolicy: "FULL",
          overrides: {},
          transferFeeBearer: "KOPERASI",
          gatewayFee: 3000,
          onlineEnabled: true,
        }),
      ),
    db.prepare(
      "INSERT INTO finance_coop_recipients(id,kind,name) VALUES('pesantren','PESANTREN','Bendahara Pesantren')",
    ),
    db.prepare(
      "INSERT INTO finance_cash_units(id,name,fixed_float_rupiah) VALUES('demo-cash-unit','Loket Sandbox',500000)",
    ),
    db
      .prepare(
        "INSERT INTO finance_periods(period_key,status) VALUES(?,'OPEN')",
      )
      .bind(today.slice(0, 7)),
  ];
  for (const [id, nis, name, asrama, kamar] of students) {
    statements.push(
      db
        .prepare(
          "INSERT INTO finance_student_snapshots(santri_id,nis,full_name,asrama,kamar,status_global) VALUES(?,?,?,?,?,'aktif')",
        )
        .bind(id, nis, name, asrama, kamar),
      db
        .prepare(
          "INSERT INTO finance_coop_bills(id,santri_id,kind,title,recipient_id,amount,created_by) VALUES(?,?,'SPP','SPP Sandbox','pesantren',70000,?)",
        )
        .bind("demo-bill-" + id, id, actorId),
      db
        .prepare(
          "INSERT INTO finance_student_va(santri_id,customer_no,va_number) VALUES(?,?,?)",
        )
        .bind(id, nis, "999999" + nis),
    );
  }
  const qrHash = await credentialHmac(DEMO_QR_TOKEN, 1),
    qrEncrypted = await encryptFinanceValue(DEMO_QR_TOKEN),
    pinHash = await hashPassword(DEMO_STUDENT_PIN);
  statements.push(
    db
      .prepare(
        "INSERT INTO student_credentials(id,santri_id,token_hmac,token_encrypted,card_number,created_by) VALUES('demo-qr','demo-s-1',?,?,'DEMO-QR-1',?)",
      )
      .bind(qrHash, qrEncrypted, actorId),
    db
      .prepare(
        "INSERT INTO finance_student_security(santri_id,pin_hash) VALUES('demo-s-1',?)",
      )
      .bind(pinHash),
    db
      .prepare(
        "INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,actor_type,status) VALUES('demo-opening','demo-opening',?,'Modal simulasi','DEMO_OPENING','SYSTEM','DRAFT')",
      )
      .bind(today),
    db.prepare(
      "INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah) VALUES('demo-cash','demo-opening','fa-unit-cash','DEBIT',500000),('demo-bank','demo-opening','fa-main-bank','DEBIT',1000000),('demo-capital','demo-opening','fa-spp-revenue','CREDIT',1300000),('demo-jajan','demo-opening','fa-jajan-liability','CREDIT',200000)",
    ),
    db.prepare(
      "INSERT INTO finance_wallet_movements(id,idempotency_key,journal_id,santri_id,wallet_kind,amount_rupiah,movement_type,reference_type,reference_id) VALUES('demo-jajan-move','demo-jajan-move','demo-opening','demo-s-1','JAJAN',200000,'DEMO_OPENING','DEMO','1')",
    ),
    db.prepare(
      "UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id='demo-opening'",
    ),
    db
      .prepare(
        "INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type) VALUES('demo-audit','SYSTEM',?,'RESET_SANDBOX','SANDBOX')",
      )
      .bind(actorId),
    db.prepare(
      "UPDATE finance_sandbox_state SET reset_enabled=0,reset_at=datetime('now') WHERE singleton_id=1",
    ),
  );
  await db.batch(statements);
  return {
    students: students.length,
    demoUsers: demoUsers.length,
    qrToken: DEMO_QR_TOKEN,
    pin: DEMO_STUDENT_PIN,
  };
}
