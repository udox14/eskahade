import { excludeAsramaSql } from "../asrama";
import {
  NON_SPP_CATEGORIES,
  type NonSppCategory,
} from "./types";

type AcademicYear = { id: number; nama: string };
type Student = {
  id: string;
  nis: string | null;
  nama_lengkap: string;
  asrama: string | null;
  kamar: string | null;
  tahun_masuk: number | null;
  tanggal_masuk: string | null;
  created_at: string | null;
};
type Tariff = {
  tahun_angkatan: number;
  jenis_biaya: NonSppCategory;
  nominal: number;
  source_rank: number;
};

export type NonSppBillingPreviewRow = {
  santriId: string;
  nis: string;
  name: string;
  asrama: string;
  category: NonSppCategory;
  amount: number;
  action: "CREATE" | "SKIP";
  reason: string;
};

export type NonSppBillingPreview = {
  academicYear: AcademicYear;
  annualEnabled: boolean;
  eligibleStudents: number;
  created: number;
  skipped: number;
  skipReasons: Record<string, number>;
  rows: NonSppBillingPreviewRow[];
};

type Candidate = NonSppBillingPreviewRow & {
  academicYearId: number | null;
  academicYearLabel: string | null;
  cohortYear: number;
  periodKey: string;
  title: string;
};

function yearFromAcademicLabel(label: string) {
  const match = label.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : new Date().getFullYear();
}

function cohortYear(student: Student) {
  const explicit = Number(student.tahun_masuk || 0);
  if (explicit > 0) return explicit;
  const entered = Number(String(student.tanggal_masuk || "").slice(0, 4));
  if (entered > 0) return entered;
  const created = Number(String(student.created_at || "").slice(0, 4));
  return created > 0 ? created : new Date().getFullYear();
}

function placeholders(length: number) {
  return Array.from({ length }, () => "?").join(",");
}

async function loadAcademicYear(main: D1Database) {
  const row = await main
    .prepare("SELECT id,nama FROM tahun_ajaran WHERE is_active=1 ORDER BY id DESC LIMIT 1")
    .first<AcademicYear>();
  if (!row) throw new Error("Tahun ajaran aktif belum tersedia.");
  return row;
}

async function loadTariffs(main: D1Database, academicYearId: number) {
  const rows = (
    await main
      .prepare(
        `SELECT tahun_angkatan,jenis_biaya,nominal,0 source_rank
         FROM biaya_settings WHERE tahun_ajaran_id=?
         UNION ALL
         SELECT tahun_angkatan,jenis_biaya,nominal,1 source_rank
         FROM biaya_settings WHERE tahun_ajaran_id IS NULL
         ORDER BY source_rank`,
      )
      .bind(academicYearId)
      .all<Tariff>()
  ).results ?? [];
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!NON_SPP_CATEGORIES.includes(row.jenis_biaya)) continue;
    const key = `${row.tahun_angkatan}:${row.jenis_biaya}`;
    if (!map.has(key) && Number(row.nominal) > 0) map.set(key, Number(row.nominal));
  }
  return map;
}

function increment(target: Record<string, number>, key: string) {
  target[key] = (target[key] || 0) + 1;
}

async function buildPreview(
  main: D1Database,
  db: D1Database,
  annualEnabled: boolean,
  onlyCategories?: readonly NonSppCategory[],
): Promise<{ preview: NonSppBillingPreview; candidates: Candidate[] }> {
  const academicYear = await loadAcademicYear(main);
  const annualYear = yearFromAcademicLabel(academicYear.nama);
  const tariffs = await loadTariffs(main, academicYear.id);
  const rows: NonSppBillingPreviewRow[] = [];
  const candidates: Candidate[] = [];
  const skipReasons: Record<string, number> = {};
  let eligibleStudents = 0;
  let after = "";

  while (true) {
    const students = (
      await main
        .prepare(
          `SELECT id,nis,nama_lengkap,asrama,kamar,tahun_masuk,tanggal_masuk,created_at
           FROM santri
           WHERE status_global='aktif' AND id>? AND ${excludeAsramaSql("asrama")}
           ORDER BY id LIMIT 100`,
        )
        .bind(after)
        .all<Student>()
    ).results ?? [];
    if (!students.length) break;
    eligibleStudents += students.length;
    const ids = students.map((student) => student.id);
    const marks = placeholders(ids.length);
    const [billsResult, rulesResult, legacyResult] = await Promise.all([
      db
        .prepare(
          `SELECT santri_id,category_code,academic_year_id FROM finance_coop_bills
           WHERE santri_id IN (${marks}) AND kind='NON_SPP' AND category_code IS NOT NULL`,
        )
        .bind(...ids)
        .all<{ santri_id: string; category_code: NonSppCategory; academic_year_id: number | null }>(),
      db
        .prepare(
          `SELECT santri_id,item_code,scope,period_key FROM finance_bill_exemptions
           WHERE santri_id IN (${marks}) AND is_active=1`,
        )
        .bind(...ids)
        .all<{ santri_id: string; item_code: NonSppCategory; scope: string; period_key: string | null }>(),
      main
        .prepare(
          `SELECT santri_id,jenis_biaya,tahun_ajaran_id,tahun_tagihan,nominal_bayar
           FROM pembayaran_tahunan
           WHERE santri_id IN (${marks})
             AND jenis_biaya IN ('BANGUNAN','KESEHATAN','EHB','EKSKUL')
             AND COALESCE(status,'AKTIF')<>'VOID'`,
        )
        .bind(...ids)
        .all<{
          santri_id: string;
          jenis_biaya: NonSppCategory;
          tahun_ajaran_id: number | null;
          tahun_tagihan: number | null;
          nominal_bayar: number;
        }>(),
    ]);
    const bills = billsResult.results ?? [];
    const rules = rulesResult.results ?? [];
    const legacy = legacyResult.results ?? [];

    for (const student of students) {
      const cohort = cohortYear(student);
      const categories = onlyCategories?.length ? onlyCategories : annualEnabled
        ? NON_SPP_CATEGORIES
        : (["BANGUNAN"] as const);
      for (const category of categories) {
        const base = {
          santriId: student.id,
          nis: student.nis || "-",
          name: student.nama_lengkap,
          asrama: student.asrama || "Tanpa asrama",
          category,
        };
        const annual = category !== "BANGUNAN";
        const periodKey = annual
          ? `TA:${academicYear.id}:NON_SPP:${category}`
          : "LIFETIME:NON_SPP:BANGUNAN";
        const existing = bills.some(
          (bill) =>
            bill.santri_id === student.id &&
            bill.category_code === category &&
            (!annual || bill.academic_year_id === academicYear.id),
        );
        const legacyIssued = legacy.some(
          (item) =>
            item.santri_id === student.id &&
            item.jenis_biaya === category &&
            (category === "BANGUNAN" ||
              item.tahun_ajaran_id === academicYear.id ||
              (!item.tahun_ajaran_id && item.tahun_tagihan === annualYear)),
        );
        const exempted = rules.some(
          (rule) =>
            rule.santri_id === student.id &&
            rule.item_code === category &&
            (rule.scope === "PERMANENT" || rule.period_key === `TA:${academicYear.id}`),
        );
        const legacyExempted = legacy.some(
          (item) =>
            item.santri_id === student.id &&
            item.jenis_biaya === category &&
            Number(item.nominal_bayar) === 0 &&
            (category === "BANGUNAN" ||
              item.tahun_ajaran_id === academicYear.id ||
              (!item.tahun_ajaran_id && item.tahun_tagihan === annualYear)),
        );
        const amount = tariffs.get(`${cohort}:${category}`) || 0;
        let reason = "Siap dibuat";
        if (existing || legacyIssued) reason = "Sudah pernah ditagih";
        else if (exempted || legacyExempted) reason = "Santri dibebaskan";
        else if (!amount) reason = "Tarif angkatan belum tersedia";

        if (reason !== "Siap dibuat") {
          increment(skipReasons, reason);
          rows.push({ ...base, amount, action: "SKIP", reason });
          continue;
        }
        const title = annual
          ? `${category === "EKSKUL" ? "Ekskul" : category[0] + category.slice(1).toLowerCase()} ${academicYear.nama}`
          : "Bangunan";
        const candidate: Candidate = {
          ...base,
          amount,
          action: "CREATE",
          reason,
          academicYearId: annual ? academicYear.id : null,
          academicYearLabel: annual ? academicYear.nama : null,
          cohortYear: cohort,
          periodKey,
          title,
        };
        rows.push(candidate);
        candidates.push(candidate);
      }
    }
    after = students.at(-1)!.id;
  }
  return {
    preview: {
      academicYear,
      annualEnabled,
      eligibleStudents,
      created: candidates.length,
      skipped: rows.length - candidates.length,
      skipReasons,
      rows,
    },
    candidates,
  };
}

export async function previewNonSppBills(
  main: D1Database,
  db: D1Database,
  annualEnabled = true,
  onlyCategories?: readonly NonSppCategory[],
) {
  return (await buildPreview(main, db, annualEnabled, onlyCategories)).preview;
}

export async function generateNonSppBills(
  main: D1Database,
  db: D1Database,
  actor: string,
  annualEnabled = true,
  onlyCategories?: readonly NonSppCategory[],
) {
  const { preview, candidates } = await buildPreview(main, db, annualEnabled, onlyCategories);
  let created = 0;
  for (let offset = 0; offset < candidates.length; offset += 40) {
    const chunk = candidates.slice(offset, offset + 40);
    const result = await db.batch(
      chunk.map((item) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO finance_coop_bills
             (id,santri_id,kind,module_code,category_code,title,period_key,recipient_id,amount,created_by,academic_year_id,academic_year_label,cohort_year)
             VALUES(?,?,'NON_SPP',?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            item.santriId,
            item.category === "BANGUNAN" ? "BANGUNAN" : "BIAYA_TAHUNAN",
            item.category,
            item.title,
            item.periodKey,
            "pesantren",
            item.amount,
            actor,
            item.academicYearId,
            item.academicYearLabel,
            item.cohortYear,
          ),
      ),
    );
    created += result.reduce((sum, item) => sum + Number((item as { meta?: { changes?: number } }).meta?.changes || 0), 0);
  }
  const summary = {
    created,
    skipped: preview.skipped + (candidates.length - created),
    failed: 0,
    eligibleStudents: preview.eligibleStudents,
    academicYear: preview.academicYear.nama,
    annualEnabled,
    skipReasons: preview.skipReasons,
  };
  await db
    .prepare(
      `INSERT INTO finance_audit_log
       (id,actor_type,actor_id,action,entity_type,entity_id,after_json)
       VALUES(?,'SYSTEM',?,'GENERATE_NON_SPP_BILLS','ACADEMIC_YEAR',?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      actor,
      String(preview.academicYear.id),
      JSON.stringify(summary),
    )
    .run();
  return summary;
}
