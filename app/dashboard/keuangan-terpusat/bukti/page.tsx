import { notFound } from "next/navigation";
import { requireFinanceAccess } from "@/lib/finance/access";
import { financeQuery as q, financeQueryOne as one } from "@/lib/db";
import { recipientScope } from "@/lib/finance/cooperative/data";
import { PrintButton } from "./print-button";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const session = await requireFinanceAccess("VIEW"),
    scope = await recipientScope(session),
    params = await searchParams;
  const isDistribution = params.type === "distribution";
  const row = await one<Record<string, string | number | null>>(
    isDistribution
      ? "SELECT d.*,r.name FROM finance_distributions d JOIN finance_coop_recipients r ON r.id=d.recipient_id WHERE d.id=?"
      : "SELECT o.*,s.full_name name FROM finance_orders o JOIN finance_student_snapshots s ON s.santri_id=o.santri_id WHERE o.id=?",
    [params.id || ""],
  );
  if (
    !row ||
    (scope !== null &&
      (!isDistribution || !scope.includes(String(row.recipient_id))))
  )
    notFound();
  const items = await q<{ title: string; amount: number }>(
    isDistribution
      ? "SELECT b.title,i.amount FROM finance_distribution_items i JOIN finance_entitlements e ON e.id=i.entitlement_id JOIN finance_order_items b ON b.id=e.order_item_id WHERE i.distribution_id=?"
      : "SELECT title,amount FROM finance_order_items WHERE order_id=?",
    [params.id || ""],
  );
  const money = (v: unknown) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(v) || 0);
  return (
    <main className="mx-auto max-w-3xl space-y-5 rounded-2xl bg-white p-5 sm:p-10">
      <header className="border-b pb-5">
        <p className="text-sm uppercase tracking-wide text-emerald-800">
          Koperasi Â· Keuangan Terpusat
        </p>
        <h1 className="text-2xl font-bold">
          {isDistribution ? "Bukti Pencairan" : "Bukti Pembayaran"}
        </h1>
        <p className="mt-2 break-all text-xs">Nomor: {row.id}</p>
      </header>
      <p className="font-bold">{row.name}</p>
      <p>Status: {row.status}</p>
      {row.status !== "PAID" && (
        <p className="rounded-lg bg-amber-50 p-3">
          Dokumen ini belum membuktikan dana diterima atau diserahkan.
        </p>
      )}
      <dl className="divide-y">
        {items.map((i, n) => (
          <div key={n} className="flex justify-between gap-4 py-3">
            <dt>{i.title}</dt>
            <dd>{money(i.amount)}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t pt-4">
        <p>Biaya: {money(row.fee)}</p>
        <strong>Total: {money(isDistribution ? row.net : row.total)}</strong>
      </div>
      {isDistribution && (
        <>
          <p>Referensi penyerahan: {row.reference || "â€”"}</p>
          <p>Diterima oleh: {row.received_by || "â€”"}</p>
          <p>
            Hak bruto: {money(row.gross)} Â· Biaya ditanggung {row.fee_bearer}
          </p>
          {row.proof_url && (
            <a href={String(row.proof_url)} className="underline">
              Bukti transfer
            </a>
          )}
          <div className="mt-12 grid grid-cols-2 gap-10 text-center">
            <div>
              Petugas koperasi
              <div className="mt-16 border-t" />
            </div>
            <div>
              Penerima
              <div className="mt-16 border-t" />
            </div>
          </div>
        </>
      )}
      <PrintButton />
    </main>
  );
}
