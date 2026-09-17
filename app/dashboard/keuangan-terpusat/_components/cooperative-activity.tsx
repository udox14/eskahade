import Link from "next/link";
import { financeQuery as q } from "@/lib/db";
import { requireFinanceAccess, financeRoles } from "@/lib/finance/access";
import { recipientScope, scopeSql } from "@/lib/finance/cooperative/data";
export async function CooperativeActivity({ view }: { view: string }) {
  const session = await requireFinanceAccess("VIEW"),
    scope = await recipientScope(session),
    s = scopeSql(scope, "d.recipient_id"),
    write = financeRoles(session).admin || financeRoles(session).operator;
  const distributions = ["distributions", "reports"].includes(view)
    ? await q<{
        id: string;
        name: string;
        gross: number;
        net: number;
        status: string;
      }>(
        "SELECT d.id,r.name,d.gross,d.net,d.status FROM finance_distributions d JOIN finance_coop_recipients r ON r.id=d.recipient_id WHERE 1=1" +
          s.sql +
          " ORDER BY d.created_at DESC LIMIT 30",
        s.params,
      )
    : [];
  const orders =
    scope === null && ["home", "bills", "reports"].includes(view)
      ? await q<{
          id: string;
          full_name: string;
          total: number;
          status: string;
        }>(
          "SELECT o.id,s.full_name,o.total,o.status FROM finance_orders o LEFT JOIN finance_student_snapshots s ON s.santri_id=o.santri_id ORDER BY o.created_at DESC LIMIT 30",
        )
      : [];
  const exceptions =
    write && ["home", "reports"].includes(view)
      ? await q<{ id: string; order_id: string; reason: string }>(
          "SELECT id,order_id,reason FROM finance_payment_exceptions WHERE resolution IS NULL ORDER BY created_at DESC LIMIT 30",
        )
      : [];
  const rupiah = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);
  return (
    <div className="mt-5 space-y-4">
      {distributions.length > 0 && (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="mb-3 font-bold">Daftar pencairan</h2>
          {distributions.map((d) => (
            <details key={d.id} className="border-t py-2">
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {d.name} | {d.status}
                </span>
                <strong>{rupiah(d.net)}</strong>
              </summary>
              <p className="break-all text-xs">Nomor pencairan: {d.id}</p>
              <Link
                className="inline-flex min-h-11 items-center text-sm text-emerald-800 underline"
                href={
                  "/dashboard/keuangan-terpusat/bukti?type=distribution&id=" +
                  d.id
                }
              >
                Buka bukti / cetak
              </Link>
            </details>
          ))}
        </section>
      )}
      {["distributions", "reports"].includes(view) && distributions.length === 0 && (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="font-bold">Daftar pencairan</h2>
          <p className="mt-2 text-sm text-slate-600">
            Belum ada pencairan. Pencairan yang dibuat akan tampil di sini.
          </p>
        </section>
      )}
      {orders.length > 0 && (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="mb-3 font-bold">Pesanan terbaru</h2>
          {orders.map((o) => (
            <details key={o.id} className="border-t py-2">
              <summary className="flex min-h-11 cursor-pointer flex-wrap justify-between gap-2 text-sm">
                <span>
                  {o.full_name} | {o.status}
                </span>
                <strong>{rupiah(o.total)}</strong>
              </summary>
              <p className="break-all text-xs">Nomor pesanan: {o.id}</p>
              <Link
                className="inline-flex min-h-11 items-center text-sm text-emerald-800 underline"
                href={
                  "/dashboard/keuangan-terpusat/bukti?type=order&id=" + o.id
                }
              >
                Buka rincian / bukti
              </Link>
            </details>
          ))}
        </section>
      )}
      {scope === null &&
        ["home", "bills", "reports"].includes(view) &&
        orders.length === 0 && (
          <section className="rounded-lg border bg-white p-5">
            <h2 className="font-bold">Pesanan terbaru</h2>
            <p className="mt-2 text-sm text-slate-600">
              Belum ada pesanan pembayaran. Pesanan baru akan tampil di sini.
            </p>
          </section>
        )}
      {exceptions.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-bold">Pembayaran perlu diperiksa</h2>
          {exceptions.map((e) => (
            <p key={e.id} className="mt-3 break-all text-sm">
              {e.order_id}: {e.reason}
            </p>
          ))}
        </section>
      )}
      {write && ["home", "reports"].includes(view) && exceptions.length === 0 && (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="font-bold">Pemeriksaan pembayaran</h2>
          <p className="mt-2 text-sm text-slate-600">
            Tidak ada pembayaran yang perlu diperiksa.
          </p>
        </section>
      )}
    </div>
  );
}
