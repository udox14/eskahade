import type { BillKind } from "./types";
import { excludeAsramaSql } from "../asrama";
export async function generateMonthlyBills(
  main: D1Database,
  db: D1Database,
  month: string,
  actor: string,
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("Bulan tidak valid.");
  const vendors =
    (
      await main
        .prepare(
          "SELECT id,nama_jasa,jenis FROM master_jasa WHERE jenis IN ('Makan','Cuci')",
        )
        .all<{ id: string; nama_jasa: string; jenis: string }>()
    ).results ?? [];
  for (const v of vendors)
    await db
      .prepare(
        "INSERT INTO finance_coop_recipients(id,source_id,kind,name) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
      )
      .bind(
        "jasa-" + v.id,
        v.id,
        v.jenis === "Makan" ? "MAKAN" : "LAUNDRY",
        v.nama_jasa,
      )
      .run();
  const tariffs =
    (
      await db
        .prepare(
          `SELECT t.* FROM finance_coop_tariffs t WHERE recurring=1 AND kind<>'NON_SPP' AND effective_month<=? AND NOT EXISTS(SELECT 1 FROM finance_coop_tariffs n WHERE n.kind=t.kind AND n.title=t.title AND n.effective_month<=? AND (n.effective_month>t.effective_month OR (n.effective_month=t.effective_month AND n.id>t.id)))`,
        )
        .bind(month, month)
        .all<{ id: string; kind: BillKind; title: string; amount: number }>()
    ).results ?? [];
  let created = 0,
    missing = 0,
    exempted = 0;
  let after = "";
  while (true) {
    const students =
      (
        await main
          .prepare(
            `SELECT id,nis,nama_lengkap,asrama,kamar,tempat_makan_id,tempat_mencuci_id
             FROM santri WHERE status_global='aktif' AND id>? AND ${excludeAsramaSql("asrama")}
             ORDER BY id LIMIT 100`,
          )
          .bind(after)
          .all<{
            id: string;
            nis: string;
            nama_lengkap: string;
            asrama: string | null;
            kamar: string | null;
            tempat_makan_id: string | null;
            tempat_mencuci_id: string | null;
          }>()
      ).results ?? [];
    if (!students.length) break;
    const ids = students.map((student) => student.id);
    const marks = ids.map(() => "?").join(",");
    const [centralRules, legacyRules] = await Promise.all([
      db
        .prepare(
          `SELECT santri_id,item_code,scope,period_key FROM finance_bill_exemptions
           WHERE santri_id IN (${marks}) AND is_active=1 AND item_code IN ('SPP','MAKAN','LAUNDRY')`,
        )
        .bind(...ids)
        .all<{ santri_id: string; item_code: string; scope: string; period_key: string | null }>(),
      main
        .prepare(
          `SELECT santri_id,service_kind FROM santri_pembebasan_biaya
           WHERE santri_id IN (${marks}) AND is_active=1 AND service_kind IN ('SPP','MAKAN','LAUNDRY')`,
        )
        .bind(...ids)
        .all<{ santri_id: string; service_kind: string }>(),
    ]);
    for (const s of students) {
      await db
        .prepare(
          "INSERT INTO finance_student_snapshots(santri_id,nis,full_name,asrama,kamar,status_global) VALUES(?,?,?,?,?,'aktif') ON CONFLICT(santri_id) DO UPDATE SET full_name=excluded.full_name,asrama=excluded.asrama,kamar=excluded.kamar",
        )
        .bind(s.id, s.nis || "", s.nama_lengkap, s.asrama, s.kamar)
        .run();
      for (const t of tariffs) {
        const skippedByRule = (centralRules.results ?? []).some(
          (rule) =>
            rule.santri_id === s.id &&
            rule.item_code === t.kind &&
            (rule.scope === "PERMANENT" || rule.period_key === month),
        );
        const skippedByLegacy = (legacyRules.results ?? []).some(
          (rule) => rule.santri_id === s.id && rule.service_kind === t.kind,
        );
        if (skippedByRule || skippedByLegacy) {
          exempted++;
          continue;
        }
        const source =
          t.kind === "MAKAN"
            ? s.tempat_makan_id
            : t.kind === "LAUNDRY"
              ? s.tempat_mencuci_id
              : null;
        if (["MAKAN", "LAUNDRY"].includes(t.kind) && !source) {
          missing++;
          continue;
        }
        const period = month + ":" + t.kind + ":" + t.title;
        const stmt = db
          .prepare(
            `INSERT INTO finance_coop_bills(id,santri_id,kind,title,period_key,tariff_id,recipient_id,amount,created_by) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM finance_coop_bills WHERE santri_id=? AND period_key=?)`,
          )
          .bind(
            crypto.randomUUID(),
            s.id,
            t.kind,
            t.title + " " + month,
            period,
            t.id,
            source ? "jasa-" + source : "pesantren",
            t.amount,
            actor,
            s.id,
            period,
          );
        const results = await db.batch<{ n: number }>([
          stmt,
          db.prepare("SELECT changes() n"),
        ]);
        created += Number(results[1].results?.[0]?.n || 0);
      }
    }
    after = students[students.length - 1].id;
  }
  await db
    .prepare(
      "INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'SYSTEM',?,'GENERATE_BILLS','PERIOD',?,?)",
    )
    .bind(
      crypto.randomUUID(),
      actor,
      month,
      JSON.stringify({ created, missing, exempted }),
    )
    .run();
  return { created, missing, exempted };
}
