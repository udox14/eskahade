import { requirePortalSessionStrict } from "@/lib/portal/session";
import { financeQuery as q, financeQueryOne as one } from "@/lib/db";
import { settings } from "@/lib/finance/cooperative/data";
import type { Bill, Order } from "@/lib/finance/cooperative/types";
import { Checkout } from "@/app/dashboard/keuangan-terpusat/_components/item-checkout";
import { paySelectedItems } from "./checkout-actions";
import { switchPortalStudent } from "./switch-actions";
import { PortalPageHeader } from "../../_components/page-header";
import { formatRupiah } from "@/lib/portal/format";
export const dynamic = "force-dynamic";
export default async function Page() {
  const session = await requirePortalSessionStrict(),
    config = await settings();
  const bills = await q<Bill>(
    "SELECT * FROM finance_coop_bills WHERE santri_id=? AND status IN ('OPEN','PARTIAL') ORDER BY created_at",
    [session.santri_id],
  );
  const orders = await q<Order>(
    "SELECT * FROM finance_orders WHERE santri_id=? ORDER BY created_at DESC LIMIT 30",
    [session.santri_id],
  );
  const movements = await q<{
    id: string;
    amount_rupiah: number;
    created_at: string;
    movement_type: string;
  }>(
    "SELECT id,amount_rupiah,created_at,movement_type FROM finance_wallet_movements WHERE santri_id=? AND wallet_kind='JAJAN' ORDER BY created_at DESC LIMIT 30",
    [session.santri_id],
  );
  const balance = await one<{ balance_rupiah: number }>(
    "SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id=? AND wallet_kind='JAJAN'",
    [session.santri_id],
  );
  const children = session.guardian_id
    ? await q<{ id: string; full_name: string }>(
        "SELECT s.santri_id id,s.full_name FROM finance_guardian_students g JOIN finance_student_snapshots s ON s.santri_id=g.santri_id WHERE g.guardian_id=?",
        [session.guardian_id],
      )
    : [];
  const active = orders.find((o) =>
    ["PREPARING", "PENDING", "REVIEW"].includes(o.status),
  );
  return (
    <div>
      <PortalPageHeader
        index="03"
        kicker="Tagihan & Uang Jajan"
        title="Keuangan"
        subtitle={"Keuangan " + session.nama}
      />
      <div className="space-y-4 p-4">
        {children.length > 1 && (
          <form action={switchPortalStudent} className="flex gap-2">
            <select
              name="santriId"
              defaultValue={session.santri_id}
              className="min-h-11 min-w-0 flex-1 rounded-xl border p-2"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
            <button className="rounded-xl bg-emerald-700 px-4 text-white">
              Ganti anak
            </button>
          </form>
        )}
        <section className="rounded-2xl bg-emerald-900 p-5 text-white">
          <p>Uang jajan tersedia</p>
          <strong className="text-2xl">
            {formatRupiah(balance?.balance_rupiah || 0)}
          </strong>
          <p className="mt-1 text-sm">
            Dapat dicairkan santri di loket dengan kartu QR dan PIN.
          </p>
        </section>
        {active ? (
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-bold">Pembayaran aktif</h2>
            <p className="break-all">
              VA: {active.va_number || "Menunggu pemeriksaan petugas"}
            </p>
            <p>Bayar tepat {formatRupiah(active.total)}</p>
            <p>Status: {active.status}</p>
            <p className="text-sm">
              Hubungi koperasi untuk perubahan atau pembatalan pesanan.
            </p>
          </section>
        ) : config.onlineEnabled ? (
          <Checkout
            initialBills={bills}
            config={config}
            pay={paySelectedItems}
          />
        ) : (
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-bold">Tagihan terbuka</h2>
            <p className="mb-3 text-sm">
              Pembayaran online belum diaktifkan. Pembayaran tersedia di loket
              koperasi.
            </p>
            {bills.map((b) => (
              <div
                key={b.id}
                className="flex justify-between gap-3 border-t py-3 text-sm"
              >
                <span>{b.title}</span>
                <strong>{formatRupiah(b.amount - b.paid)}</strong>
              </div>
            ))}
          </section>
        )}
        <details className="rounded-2xl border bg-white p-4" open>
          <summary className="min-h-11 cursor-pointer font-bold">
            Riwayat pembayaran
          </summary>
          {orders.map((o) => (
            <article key={o.id} className="border-t py-3 text-sm">
              <p>
                {o.created_at} Â· {o.status}
              </p>
              <strong>{formatRupiah(o.total)}</strong>
              <details>
                <summary className="min-h-11 py-2">Rincian pembayaran</summary>
                <p className="break-all">Referensi {o.id}</p>
                <p>
                  Item {formatRupiah(o.amount)} Â· Biaya {formatRupiah(o.fee)}
                </p>
              </details>
            </article>
          ))}
        </details>
        <details className="rounded-2xl border bg-white p-4">
          <summary className="min-h-11 cursor-pointer font-bold">
            Riwayat uang jajan
          </summary>
          {movements.map((m) => (
            <div
              key={m.id}
              className="flex justify-between gap-2 border-t py-3 text-sm"
            >
              <span>
                {m.created_at}
                <br />
                {m.movement_type}
              </span>
              <strong>{formatRupiah(m.amount_rupiah)}</strong>
            </div>
          ))}
        </details>
      </div>
    </div>
  );
}
