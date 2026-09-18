import Link from "next/link";
import { financeQuery, financeQueryOne } from "@/lib/db";
import { getEffectiveRoles, getSession } from "@/lib/auth/session";
import { PAYMENT_MODULES, type PaymentModuleCode } from "@/lib/finance/modules";

function money(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export async function CentralModuleOverview() {
  const session = await getSession();
  if (!session) return null;
  const roles = getEffectiveRoles(session);
  if (!roles.some((role) => ["admin", "admin_koperasi"].includes(role))) return null;
  const [rows, reconciliationCount, reconciliationRows] = await Promise.all([
    financeQuery<{ module_code: PaymentModuleCode; received: number; outstanding: number }>(
      `SELECT module_code,COALESCE(SUM(paid),0) received,
        COALESCE(SUM(CASE WHEN status IN ('OPEN','PARTIAL') THEN amount-paid ELSE 0 END),0) outstanding
       FROM finance_coop_bills WHERE module_code IS NOT NULL GROUP BY module_code`,
    ),
    financeQueryOne<{ total: number }>(
      "SELECT COUNT(*) total FROM finance_module_migration_reconciliation WHERE resolved_at IS NULL",
    ),
    financeQuery<{ entity_type: string; entity_id: string; reason: string }>(
      `SELECT entity_type,entity_id,reason FROM finance_module_migration_reconciliation
       WHERE resolved_at IS NULL ORDER BY created_at,entity_type,entity_id LIMIT 10`,
    ),
  ]);
  const totals = new Map(rows.map((row) => [row.module_code, row]));
  return <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-bold text-slate-950">Unit pembayaran di Sistem Keuangan Baru</h2><p className="mt-1 text-sm leading-6 text-slate-600">Uang Jajan, Makan, Laundry, SPP, Bangunan, dan Biaya Tahunan adalah workspace operasional. Pembayaran gabungan, kas, jurnal, QR, audit, dan pengaturan sistem baru tetap menjadi layanan bersama.</p></div><p className="text-xs text-slate-600">Sumber: tagihan dan alokasi pembayaran terposting</p></div>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {PAYMENT_MODULES.map((module) => {
        const value = totals.get(module.code) || { received: 0, outstanding: 0 };
        return <Link key={module.code} href={`/dashboard/keuangan-terpusat/unit/${module.slug}`} className="min-w-0 rounded-lg border border-slate-200 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
          <h3 className="font-bold text-slate-950">{module.label}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-600">Diterima</dt><dd className="mt-1 break-words font-bold tabular-nums text-emerald-900">{money(Number(value.received))}</dd></div><div><dt className="text-slate-600">Belum diterima</dt><dd className="mt-1 break-words font-bold tabular-nums text-slate-950">{money(Number(value.outstanding))}</dd></div></dl>
          <span className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 underline underline-offset-4">Buka unit kerja</span>
        </Link>;
      })}
    </div>
    {Number(reconciliationCount?.total || 0) > 0 ? <aside className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4" aria-label="Rekonsiliasi migrasi belum selesai">
      <h3 className="font-bold text-amber-950">{Number(reconciliationCount?.total)} data lama perlu rekonsiliasi</h3>
      <p className="mt-1 text-sm leading-6 text-amber-950">Data ini sengaja belum dimasukkan ke unit kerja karena sumber lama tidak cukup untuk menentukan modul dengan aman. Selesaikan hingga nol sebelum peluncuran.</p>
      <ul className="mt-3 divide-y divide-amber-200 text-sm">{reconciliationRows.map((item) => <li key={`${item.entity_type}:${item.entity_id}`} className="py-2"><strong>{item.entity_type} {item.entity_id}</strong><span className="block text-amber-950">{item.reason}</span></li>)}</ul>
      {Number(reconciliationCount?.total) > reconciliationRows.length ? <p className="mt-2 text-xs text-amber-900">Menampilkan 10 data pertama.</p> : null}
    </aside> : <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-950">Rekonsiliasi migrasi: tidak ada data lama yang belum dipetakan.</p>}
  </section>;
}
