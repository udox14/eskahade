import { financeQuery, financeQueryOne, query, queryOne } from "@/lib/db";
import type { AnnualFeeType, PaymentModuleCode } from "./modules";

export type ModuleMetric = {
  key: string;
  label: string;
  amount: number;
  detail: string;
  href: string;
  percent?: boolean;
};

export type ModuleWorkspaceData = {
  period: string;
  updatedAt: string;
  metrics: ModuleMetric[];
  rows: Array<Record<string, string | number | null>>;
  settings: { active_period: string | null; due_day: number | null; updated_at: string | null } | null;
  checklist: string[];
  assignments: Array<{ user_id: string; permissions_json: string; updated_at: string }>;
  users: Array<{ id: string; full_name: string | null; email: string }>;
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

async function activeAcademicYear() {
  return queryOne<{ id: number; nama: string }>(
    "SELECT id,nama FROM tahun_ajaran WHERE is_active=1 ORDER BY id DESC LIMIT 1",
  );
}

async function estimatedTarget(moduleCode: PaymentModuleCode, period: string) {
  if (moduleCode === "UANG_JAJAN") return 0;
  const students = await query<{
    id: string; tahun_masuk: number | null; tanggal_masuk: string | null; created_at: string | null;
    tempat_makan_id: string | null; tempat_mencuci_id: string | null; bebas_spp: number;
  }>(`SELECT id,tahun_masuk,tanggal_masuk,created_at,tempat_makan_id,tempat_mencuci_id,bebas_spp
      FROM santri WHERE status_global='aktif'`);
  const exemptions = await financeQuery<{ santri_id: string; item_code: string }>(
    "SELECT santri_id,item_code FROM finance_bill_exemptions WHERE is_active=1 AND (scope='PERMANENT' OR period_key=?)",
    [period],
  );
  const exempt = new Set(exemptions.map((item) => `${item.santri_id}:${item.item_code}`));
  if (["SPP", "MAKAN", "LAUNDRY"].includes(moduleCode)) {
    const tariffs = await financeQuery<{ amount: number }>(
      `SELECT t.amount FROM finance_coop_tariffs t WHERE t.module_code=? AND t.recurring=1 AND t.effective_month<=?
       AND NOT EXISTS(SELECT 1 FROM finance_coop_tariffs n WHERE n.module_code=t.module_code AND n.title=t.title AND n.effective_month<=? AND (n.effective_month>t.effective_month OR (n.effective_month=t.effective_month AND n.id>t.id)))`,
      [moduleCode, period, period],
    );
    const eligible = students.filter((student) => {
      if (exempt.has(`${student.id}:${moduleCode}`)) return false;
      if (moduleCode === "SPP") return !student.bebas_spp;
      if (moduleCode === "MAKAN") return Boolean(student.tempat_makan_id);
      return Boolean(student.tempat_mencuci_id);
    }).length;
    return tariffs.reduce((sum, tariff) => sum + Number(tariff.amount) * eligible, 0);
  }
  const academic = await activeAcademicYear();
  if (!academic) return 0;
  const categories: Array<AnnualFeeType | "BANGUNAN"> = moduleCode === "BANGUNAN"
    ? ["BANGUNAN"] : ["EHB", "EKSKUL", "KESEHATAN"];
  const tariffRows = await query<{ tahun_angkatan: number; jenis_biaya: string; nominal: number; rank: number }>(
    `SELECT tahun_angkatan,jenis_biaya,nominal,0 rank FROM biaya_settings WHERE tahun_ajaran_id=?
     UNION ALL SELECT tahun_angkatan,jenis_biaya,nominal,1 rank FROM biaya_settings WHERE tahun_ajaran_id IS NULL ORDER BY rank`,
    [academic.id],
  );
  const tariff = new Map<string, number>();
  for (const row of tariffRows) {
    const key = `${row.tahun_angkatan}:${row.jenis_biaya}`;
    if (!tariff.has(key) && categories.includes(row.jenis_biaya as AnnualFeeType | "BANGUNAN")) tariff.set(key, Number(row.nominal));
  }
  return students.reduce((total, student) => {
    const cohort = Number(student.tahun_masuk || String(student.tanggal_masuk || student.created_at || "").slice(0, 4));
    return total + categories.reduce((sum, category) => exempt.has(`${student.id}:${category}`) ? sum : sum + (tariff.get(`${cohort}:${category}`) || 0), 0);
  }, 0);
}

function periodBillFilter(moduleCode: PaymentModuleCode, period: string) {
  if (moduleCode === "BANGUNAN") return { sql: "", params: [] as unknown[] };
  if (moduleCode === "BIAYA_TAHUNAN") return { sql: " AND b.academic_year_label=?", params: [period] as unknown[] };
  return { sql: " AND substr(b.period_key,1,7)=?", params: [period] as unknown[] };
}

export async function loadModuleWorkspace(input: {
  moduleCode: PaymentModuleCode;
  section: string;
  requestedPeriod?: string;
  annualFeeType?: string;
  requestedStatus?: string;
  userId: string;
  canManageAssignments?: boolean;
}): Promise<ModuleWorkspaceData> {
  const academic = await activeAcademicYear();
  const setting = await financeQueryOne<{ active_period: string | null; due_day: number | null; updated_at: string }>(
    "SELECT active_period,due_day,updated_at FROM finance_module_settings WHERE module_code=?", [input.moduleCode],
  );
  const defaultPeriod = input.moduleCode === "BIAYA_TAHUNAN" ? academic?.nama || String(new Date().getFullYear()) : currentMonth();
  const period = (input.requestedPeriod || setting?.active_period || defaultPeriod).slice(0, 40);
  const billPeriod = periodBillFilter(input.moduleCode, period);
  const annualFilter = input.moduleCode === "BIAYA_TAHUNAN" && ["EHB", "EKSKUL", "KESEHATAN"].includes(input.annualFeeType || "")
    ? { sql: " AND b.category_code=?", params: [input.annualFeeType] }
    : { sql: "", params: [] as unknown[] };
  const statusFilter = input.requestedStatus === "OVERDUE"
    ? " AND b.status IN ('OPEN','PARTIAL') AND b.due_at<date('now')"
    : input.requestedStatus === "OPEN" ? " AND b.status IN ('OPEN','PARTIAL')" : "";
  const billParams = [input.moduleCode, ...billPeriod.params, ...annualFilter.params];
  const totals = await financeQueryOne<{ issued: number; received: number; outstanding: number; overdue: number }>(
    `SELECT COALESCE(SUM(b.amount),0) issued,COALESCE(SUM(b.paid),0) received,
      COALESCE(SUM(CASE WHEN b.status IN ('OPEN','PARTIAL') THEN b.amount-b.paid ELSE 0 END),0) outstanding,
      COALESCE(SUM(CASE WHEN b.status IN ('OPEN','PARTIAL') AND b.due_at<date('now') THEN b.amount-b.paid ELSE 0 END),0) overdue
     FROM finance_coop_bills b WHERE b.module_code=?${billPeriod.sql}${annualFilter.sql}`,
    billParams,
  );
  const distribution = await financeQueryOne<{ amount: number }>(
    "SELECT COALESCE(SUM(gross),0) amount FROM finance_distributions WHERE module_code=? AND status='PAID'", [input.moduleCode],
  );
  const available = await financeQueryOne<{ amount: number }>(
    `SELECT COALESCE(SUM(e.amount-e.paid),0) amount FROM finance_entitlements e
     JOIN finance_order_items oi ON oi.id=e.order_item_id WHERE e.reversed=0 AND oi.module_code=?`, [input.moduleCode],
  );
  const target = await estimatedTarget(input.moduleCode, period);
  const issued = Number(totals?.issued || 0), received = Number(totals?.received || 0);
  const base = `/dashboard/keuangan-terpusat/unit/${input.moduleCode.toLowerCase().replaceAll("_", "-")}`;
  const metrics: ModuleMetric[] = [
    { key: "target", label: "Estimasi Target", amount: target, detail: input.moduleCode === "UANG_JAJAN" ? "Uang jajan tidak memakai tagihan wajib." : "Peserta layak x tarif aktif, setelah pembebasan.", href: `${base}/generate?period=${encodeURIComponent(period)}` },
    { key: "issued", label: "Tagihan Terbit", amount: issued, detail: `Tagihan yang sudah diposting pada ${period}.`, href: `${base}/tagihan?period=${encodeURIComponent(period)}` },
    { key: "received", label: "Uang Diterima", amount: received, detail: "Pembayaran berhasil yang sudah dialokasikan.", href: `${base}/pembayaran?period=${encodeURIComponent(period)}` },
    { key: "outstanding", label: "Belum Diterima", amount: Number(totals?.outstanding || 0), detail: "Sisa tagihan terbuka dan parsial.", href: `${base}/tagihan?period=${encodeURIComponent(period)}&status=OPEN` },
    { key: "overdue", label: "Jatuh Tempo", amount: Number(totals?.overdue || 0), detail: "Sisa tagihan yang melewati jatuh tempo.", href: `${base}/tagihan?period=${encodeURIComponent(period)}&status=OVERDUE` },
    { key: "distributed", label: "Tersalurkan", amount: Number(distribution?.amount || 0), detail: "Pencairan yang sudah diposting.", href: `${base}/penyaluran` },
    { key: "available", label: "Saldo Tersedia", amount: Number(available?.amount || 0), detail: "Hak bersih yang belum disalurkan.", href: `${base}/penyaluran` },
    { key: "rate", label: "Tingkat Penerimaan", amount: issued ? Math.round(received / issued * 10000) / 100 : 0, detail: "Uang diterima dibanding tagihan terbit.", href: `${base}/pembayaran?period=${encodeURIComponent(period)}`, percent: true },
  ];
  let rows: Array<Record<string, string | number | null>> = [];
  if (["dashboard", "tagihan", "generate"].includes(input.section)) {
    rows = await financeQuery(`SELECT b.id,s.full_name santri,b.title,b.category_code kategori,b.amount,b.paid,b.amount-b.paid sisa,b.status,b.due_at jatuh_tempo
      FROM finance_coop_bills b LEFT JOIN finance_student_snapshots s ON s.santri_id=b.santri_id
      WHERE b.module_code=?${billPeriod.sql}${annualFilter.sql}${statusFilter} ORDER BY b.created_at DESC LIMIT 100`, billParams);
  } else if (input.section === "pembayaran") {
    rows = await financeQuery(`SELECT o.id,o.paid_at waktu,s.full_name santri,oi.title,oi.amount,o.channel,o.status
      FROM finance_order_items oi JOIN finance_orders o ON o.id=oi.order_id LEFT JOIN finance_student_snapshots s ON s.santri_id=o.santri_id
      WHERE oi.module_code=? ORDER BY o.created_at DESC LIMIT 100`, [input.moduleCode]);
  } else if (input.section === "penyaluran") {
    rows = await financeQuery(`SELECT d.id,d.created_at waktu,r.name penerima,d.gross,d.fee,d.net,d.method,d.status
      FROM finance_distributions d JOIN finance_coop_recipients r ON r.id=d.recipient_id
      WHERE d.module_code=? ORDER BY d.created_at DESC LIMIT 100`, [input.moduleCode]);
  } else if (input.section === "laporan") {
    rows = await financeQuery(`SELECT a.id,a.created_at waktu,a.action tindakan,a.entity_type objek,a.entity_id referensi,a.actor_id petugas
      FROM finance_audit_log a WHERE a.module_code=? ORDER BY a.created_at DESC LIMIT 200`, [input.moduleCode]);
  }
  const checklistRows = await financeQuery<{ step_code: string }>(
    "SELECT step_code FROM finance_module_help_progress WHERE user_id=? AND module_code=? AND completed=1", [input.userId, input.moduleCode],
  );
  const assignments = input.section === "pengaturan" && input.canManageAssignments ? await financeQuery<{ user_id: string; permissions_json: string; updated_at: string }>(
    "SELECT user_id,permissions_json,updated_at FROM finance_module_access WHERE module_code=? ORDER BY updated_at DESC", [input.moduleCode],
  ) : [];
  const users = input.section === "pengaturan" && input.canManageAssignments ? await query<{ id: string; full_name: string | null; email: string }>(
    "SELECT id,full_name,email FROM users ORDER BY full_name,email LIMIT 500",
  ) : [];
  return { period, updatedAt: new Date().toISOString(), metrics, rows, settings: setting || null, checklist: checklistRows.map((row) => row.step_code), assignments, users };
}
