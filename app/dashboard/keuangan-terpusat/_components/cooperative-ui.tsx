"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import type {
  ScreenData,
  FormSpec,
  Field,
} from "@/lib/finance/cooperative/screen";
import { coopAction, searchCoopStudents } from "../cooperative-actions";
import { Checkout } from "./item-checkout";
export const money = (n: unknown) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
export const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500";
export const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
const links = [
  [
    "Operasional",
    [
      ["", "Ringkasan"],
      ["tagihan", "Tagihan & Pembayaran"],
      ["payout", "Dana & Pencairan"],
      ["loket", "Loket & Jajan"],
    ],
  ],
  ["Administrasi", [["kredensial", "Kartu QR Santri"]]],
  [
    "Laporan & Pengaturan",
    [
      ["transaksi", "Transaksi & Laporan"],
      ["pengaturan", "Pengaturan"],
    ],
  ],
] as const;
export function CoopNav({
  write = true,
  configure = true,
}: {
  write?: boolean;
  configure?: boolean;
}) {
  return (
    <nav
      aria-label="Keuangan Terpusat"
      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 lg:grid-cols-[2fr_1fr_1.3fr]"
    >
      {links.map(([group, items]) => (
        <details key={group} open className="min-w-0">
          <summary className="cursor-pointer px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {group}
          </summary>
          <div className="flex flex-wrap gap-1">
            {items
              .filter(
                ([p]) =>
                  (write || !["loket", "kredensial"].includes(p)) &&
                  (configure || p !== "pengaturan"),
              )
              .map(([p, label]) => (
                <Link
                  key={p}
                  href={"/dashboard/keuangan-terpusat" + (p ? "/" + p : "")}
                  className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {label}
                </Link>
              ))}
          </div>
        </details>
      ))}
    </nav>
  );
}
export function StudentField({
  name = "santriId",
  onSelect,
}: {
  name?: string;
  onSelect?: (id: string, label: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [rows, setRows] = useState<
      { id: string; nama_lengkap: string; nis: string }[]
    >([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (search.length < 2) {
      setRows([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      searchCoopStudents(search)
        .then((r) => {
          if (!stale) setRows(r);
        })
        .catch(() => {
          if (!stale) setError("Pencarian gagal.");
        });
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [search]);
  return (
    <div className="space-y-2">
      <input
        className={inputClass}
        placeholder="Cari nama atau NISâ€¦"
        aria-label="Cari santri"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setSelected("");
        }}
      />
      <select
        name={name}
        aria-label="Pilih santri"
        required
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          const row = rows.find((r) => r.id === e.target.value);
          if (row) onSelect?.(row.id, row.nama_lengkap);
        }}
        className={inputClass}
      >
        <option value="">Pilih hasil pencarian</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nama_lengkap} Â· {r.nis}
          </option>
        ))}
      </select>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function FormField({ field }: { field: Field }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
      <span>{field.label}</span>
      {field.type === "student" ? (
        <StudentField name={field.name} />
      ) : field.options ? (
        <select
          name={field.name}
          defaultValue={field.value ?? field.options[0]?.value}
          required={field.required}
          className={inputClass}
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={field.name}
          type={field.type || "text"}
          min={field.type === "number" ? 0 : undefined}
          step={field.type === "number" ? 1 : undefined}
          defaultValue={field.value}
          required={field.required}
          className={inputClass}
          autoComplete={field.type === "password" ? "new-password" : "off"}
        />
      )}
    </label>
  );
}
export function ActionDialog({
  spec,
  shiftId,
}: {
  spec: FormSpec;
  shiftId?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false),
    [id, setId] = useState(""),
    key = useRef(""),
    router = useRouter();
  return (
    <>
      <button
        ref={trigger}
        className={buttonClass}
        onClick={() => {
          key.current = crypto.randomUUID();
          setMessage("");
          setSuccess(false);
          dialog.current?.showModal();
        }}
      >
        {spec.title}
      </button>
      <dialog
        ref={dialog}
        onClose={() => trigger.current?.focus()}
        className="m-0 h-dvh max-h-dvh w-screen max-w-none overflow-y-auto bg-white p-0 backdrop:bg-slate-950/40 sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
              f.set("key",key.current);
            start(async () => {
              const r = await coopAction(f);
              setMessage(r.message);
              setSuccess(r.success);
              setId(r.id || "");
              if (r.success) router.refresh();
            });
          }}
          className="p-5 sm:p-6"
        >
          <header className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">{spec.title}</h2>
            <button
              type="button"
              aria-label="Tutup dialog"
              className="min-h-11 min-w-11 rounded-lg border"
              onClick={() => dialog.current?.close()}
            >
              âœ•
            </button>
          </header>
          <input type="hidden" name="action" value={spec.action} />
          <input type="hidden" name="key" value={key.current} />
          <input type="hidden" name="shiftId" value={shiftId || ""} />
          <div className="space-y-4">
            {spec.fields.map((f) => (
              <FormField key={f.name} field={f} />
            ))}
          </div>
          {message && (
            <div
              role={success ? "status" : "alert"}
              className={
                "mt-4 rounded-xl p-3 text-sm " +
                (success
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-red-50 text-red-800")
              }
            >
              {message}
              {id && <p className="mt-2 break-all">Referensi: {id}</p>}
            </div>
          )}
          <footer className="sticky bottom-0 mt-5 flex justify-end gap-2 bg-white py-3">
            <button
              type="button"
              className="min-h-11 rounded-xl border px-4"
              onClick={() => dialog.current?.close()}
            >
              Tutup
            </button>
            <button disabled={pending || success} className={buttonClass}>
              {pending ? "Menyimpanâ€¦" : "Simpan"}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
export function CooperativeScreen({ data }: { data: ScreenData }) {
  const path =
    "/dashboard/keuangan-terpusat" +
    {
      home: "",
      bills: "/tagihan",
      distributions: "/payout",
      reports: "/transaksi",
      settings: "/pengaturan",
      cashier: "/loket",
    }[data.view];
  const pageLink = (p: number) =>
    path + "?q=" + encodeURIComponent(data.search) + "&p=" + p;
  return (
    <main className="min-w-0 space-y-5">
      <DashboardPageHeader title={data.title} description={data.description} />
      <CoopNav write={data.canWrite} configure={data.canConfigure} />
      {data.metrics.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((m) => (
            <section key={m.label} className="rounded-2xl border bg-white p-5">
              <p className="text-sm text-slate-500">{m.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-900">
                {money(m.amount)}
              </p>
            </section>
          ))}
        </div>
      )}
      {data.shift && (
        <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-emerald-50 p-4 text-sm">
          <span>Shift aktif Â· {String(data.shift.unit_name)}</span>
          <strong>Kas loket: {money(data.shift.expected)}</strong>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {data.forms.map((f) => (
          <ActionDialog
            key={f.action}
            spec={f}
            shiftId={String(data.shift?.id || "")}
          />
        ))}
      </div>
      {data.view === "cashier" && data.shift && (
        <Checkout shiftId={String(data.shift.id)} />
      )}
      {data.view === "settings" && (
        <p className="rounded-xl bg-slate-100 p-4 text-sm">
          Data produksi: <strong>eskahade-finance</strong>. Pengelola mengikuti
          Katering & Laundry. Role akun diatur melalui Pengaturan Pengguna
          aplikasi.
        </p>
      )}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <form className="flex flex-wrap gap-2 border-b p-4" action={path}>
          <input
            name="q"
            defaultValue={data.search}
            placeholder="Cari pada daftarâ€¦"
            aria-label="Cari pada daftar"
            className={inputClass + " sm:max-w-sm"}
          />
          {data.view==='reports'&&<><label className="text-xs">Dari<input type="date" name="from" defaultValue={data.from} className={inputClass}/></label><label className="text-xs">Sampai<input type="date" name="to" defaultValue={data.to} className={inputClass}/></label></>}<button className={buttonClass}>Cari</button><a className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm" href={'/api/finance/cooperative/export?view='+data.view+'&q='+encodeURIComponent(data.search)+'&from='+data.from+'&to='+data.to}>Ekspor CSV</a>
          <span className="self-center text-sm text-slate-500">
            {data.total} data
          </span>
        </form>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                {data.columns.map((c) => (
                  <th
                    key={c.key}
                    className={
                      "whitespace-nowrap px-4 py-3 " +
                      (c.money ? "text-right" : "")
                    }
                  >
                    <Link
                      href={
                        path +
                        "?q=" +
                        encodeURIComponent(data.search) +
                        "&sort=" +
                        c.key +
                        "&dir="+(data.sort===c.key&&data.dir==='asc'?'desc':'asc')+"&from="+data.from+"&to="+data.to
                      }
                    >
                      {c.label} â†•
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.rows.map((r) => (
                <tr key={String(r.id)} className="hover:bg-slate-50">
                  {data.columns.map((c) => (
                    <td
                      key={c.key}
                      className={
                        "px-4 py-3 " +
                        (c.money ? "text-right font-medium tabular-nums" : "")
                      }
                    >
                      {c.money ? money(r[c.key]) : String(r[c.key] ?? "â€”")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y md:hidden">
          {data.rows.map((r) => (
            <article key={String(r.id)} className="p-4">
              <p className="font-semibold">
                {String(r[data.columns[0].key] ?? "â€”")}
              </p>
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer py-2 text-sm text-emerald-800">
                  Lihat rincian {String(r.status ?? "")}
                </summary>
                <dl className="space-y-2">
                  {data.columns.slice(1).map((c) => (
                    <div
                      key={c.key}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <dt className="text-slate-500">{c.label}</dt>
                      <dd className="text-right">
                        {c.money ? money(r[c.key]) : String(r[c.key] ?? "â€”")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </article>
          ))}
        </div>
        {!data.rows.length && (
          <p className="p-10 text-center text-sm text-slate-500">
            Belum ada data yang sesuai.
          </p>
        )}
        <footer className="flex items-center justify-between border-t p-4 text-sm">
          <Link
            aria-disabled={data.page === 1}
            className="min-h-11 rounded-lg border px-3 py-2"
            href={pageLink(Math.max(1, data.page - 1))}
          >
            Sebelumnya
          </Link>
          <span>
            {data.page} / {Math.max(1, Math.ceil(data.total / 25))}
          </span>
          <Link
            className="min-h-11 rounded-lg border px-3 py-2"
            href={pageLink(
              Math.min(Math.max(1, Math.ceil(data.total / 25)), data.page + 1),
            )}
          >
            Berikutnya
          </Link>
        </footer>
      </section>
    </main>
  );
}
