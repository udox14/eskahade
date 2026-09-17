import { getFinanceDB, getDB, financeQueryOne } from "@/lib/db";
import { syncRecipients, auditStatement } from "./data";
import {
  NON_SPP_CATEGORIES,
  rupiah,
  type BillKind,
  type NonSppCategory,
} from "./types";
import { syncFinanceStudentSnapshot } from "../snapshots";
export async function createBill(input: {
  santriId: string;
  kind: BillKind;
  title: string;
  amount: number;
  period: string;
  actor: string;
  category?: NonSppCategory | null;
}) {
  rupiah(input.amount);
  if (!input.title.trim()) throw new Error("Judul wajib diisi.");
  await syncRecipients();
  await syncFinanceStudentSnapshot(input.santriId);
  const main = (await getDB()) as D1Database;
  const s = await main
    .prepare(
      "SELECT id,tempat_makan_id,tempat_mencuci_id,tahun_masuk,tanggal_masuk,created_at FROM santri WHERE id=? AND status_global='aktif'",
    )
    .bind(input.santriId)
    .first<{
      id: string;
      tempat_makan_id: string | null;
      tempat_mencuci_id: string | null;
      tahun_masuk: number | null;
      tanggal_masuk: string | null;
      created_at: string | null;
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
  const category = input.kind === "NON_SPP" ? input.category || null : null;
  if (input.kind === "NON_SPP" && (!category || !NON_SPP_CATEGORIES.includes(category)))
    throw new Error("Pilih kategori Non-SPP.");
  let academicYear: { id: number; nama: string } | null = null;
  if (category && category !== "BANGUNAN") {
    academicYear = await main
      .prepare("SELECT id,nama FROM tahun_ajaran WHERE is_active=1 ORDER BY id DESC LIMIT 1")
      .first<{ id: number; nama: string }>();
    if (!academicYear) throw new Error("Tahun ajaran aktif belum tersedia.");
  }
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
  if (category) {
    const old = await main
      .prepare(
        `SELECT id FROM pembayaran_tahunan WHERE santri_id=? AND jenis_biaya=? AND COALESCE(status,'AKTIF')<>'VOID'
         ${category === "BANGUNAN" ? "" : "AND (tahun_ajaran_id=? OR (tahun_ajaran_id IS NULL AND tahun_tagihan=?))"} LIMIT 1`,
      )
      .bind(
        s.id,
        category,
        ...(category === "BANGUNAN"
          ? []
          : [academicYear!.id, Number(academicYear!.nama.match(/\b(19|20)\d{2}\b/)?.[0] || new Date().getFullYear())]),
      )
      .first();
    if (old) throw new Error("Tagihan kategori ini sudah tercatat pada modul Non-SPP lama.");
    const periodKey = category === "BANGUNAN"
      ? "LIFETIME:NON_SPP:BANGUNAN"
      : `TA:${academicYear!.id}:NON_SPP:${category}`;
    const exemption = await db
      .prepare(
        `SELECT id FROM finance_bill_exemptions WHERE santri_id=? AND item_code=? AND is_active=1
         AND (scope='PERMANENT' OR period_key=?) LIMIT 1`,
      )
      .bind(s.id, category, category === "BANGUNAN" ? null : `TA:${academicYear!.id}`)
      .first();
    if (exemption) throw new Error("Santri memiliki pembebasan aktif untuk kategori ini.");
    input.period = periodKey;
  }
  const cohort = Number(s.tahun_masuk || String(s.tanggal_masuk || s.created_at || "").slice(0, 4)) || null;
  const moduleCode = input.kind === "NON_SPP"
    ? category === "BANGUNAN" ? "BANGUNAN" : "BIAYA_TAHUNAN"
    : input.kind;
  await db.batch([
    db
      .prepare(
        `INSERT INTO finance_coop_bills
         (id,santri_id,kind,module_code,category_code,title,period_key,recipient_id,amount,created_by,academic_year_id,academic_year_label,cohort_year,due_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id,
        s.id,
        input.kind,
        moduleCode,
        category,
        input.title.trim(),
        input.period || null,
        recipient,
        input.amount,
        input.actor,
        academicYear?.id || null,
        academicYear?.nama || null,
        cohort,
        input.kind === "NON_SPP" ? null : `${input.period.slice(0, 7)}-28`,
      ),
    auditStatement(db, input.actor, "CREATE_BILL", "BILL", id, input),
  ]);
  return id;
}
export { generateMonthlyBills } from "./billing-core";
