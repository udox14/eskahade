import { financeQuery, financeQueryOne, getFinanceDB, query } from "@/lib/db";
import { getEffectiveRoles, type SessionUser } from "@/lib/auth/session";
import { financeRoles } from "../access";
import { DEFAULT_SETTINGS, type Settings } from "./types";
export async function settings(): Promise<Settings> {
  const row = await financeQueryOne<{ value: string }>(
    "SELECT value FROM finance_settings WHERE key='cooperative_settings'",
  );
  return row
    ? { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) }
    : DEFAULT_SETTINGS;
}
export async function recipientScope(
  session: SessionUser,
): Promise<string[] | null> {
  const p = financeRoles(session),
    r = getEffectiveRoles(session);
  if (p.admin || p.operator || r.includes("pimpinan")) return null;
  const rows = await financeQuery<{ recipient_id: string }>(
    "SELECT recipient_id FROM finance_coop_user_units WHERE user_id=?",
    [session.id],
  );
  return [
    ...new Set([
      ...rows.map((x) => x.recipient_id),
      ...(r.includes("bendahara") ? ["pesantren"] : []),
    ]),
  ];
}
export async function syncRecipients() {
  const rows = await query<{ id: string; nama_jasa: string; jenis: string }>(
    "SELECT id,nama_jasa,jenis FROM master_jasa WHERE jenis IN ('Makan','Cuci')",
  );
  const db = await getFinanceDB();
  for (let n = 0; n < rows.length; n += 50)
    await db.batch(
      rows
        .slice(n, n + 50)
        .map((r) =>
          db
            .prepare(
              `INSERT INTO finance_coop_recipients(id,source_id,kind,name) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
            )
            .bind(
              `jasa-${r.id}`,
              r.id,
              r.jenis === "Makan" ? "MAKAN" : "LAUNDRY",
              r.nama_jasa,
            ),
        ),
    );
}
export function scopeSql(ids: string[] | null, column: string) {
  return ids === null
    ? { sql: "", params: [] }
    : {
        sql: ` AND ${column} IN (${ids.length ? ids.map(() => "?").join(",") : "NULL"})`,
        params: ids,
      };
}
export function auditStatement(
  db: D1Database,
  actor: string,
  action: string,
  entity: string,
  id: string,
  details: unknown,
  moduleCode?: string | null,
) {
  return db
    .prepare(
      `INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json,module_code) VALUES(?,'STAFF',?,?,?,?,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      actor,
      action,
      entity,
      id,
      JSON.stringify(details),
      moduleCode || null,
    );
}
