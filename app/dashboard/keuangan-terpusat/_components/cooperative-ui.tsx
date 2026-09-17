"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowsDownUp, CaretDown, CaretUp, Warning, X } from "@phosphor-icons/react";
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
  "min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2";
export const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";
type ActionPresentation = {
  tone: "primary" | "neutral" | "warning" | "danger";
  submitLabel: string;
  impact?: string[];
};
const ACTION_PRESENTATION: Record<string, ActionPresentation> = {
  bill: { tone: "primary", submitLabel: "Buat tagihan" },
  generate: { tone: "neutral", submitLabel: "Jalankan generate" },
  tariff: { tone: "neutral", submitLabel: "Tambah tarif" },
  distribution: { tone: "primary", submitLabel: "Buat draft pencairan" },
  finish: {
    tone: "warning",
    submitLabel: "Konfirmasi penyerahan",
    impact: ["Pencairan ditandai sudah diserahkan.", "Referensi dan nama penerima masuk ke jejak audit."],
  },
  settlement: { tone: "primary", submitLabel: "Catat settlement" },
  reconciliation: {
    tone: "warning",
    submitLabel: "Konfirmasi rekonsiliasi",
    impact: ["Saldo aktual akan dibandingkan dengan pembukuan periode.", "Selisih dicatat untuk ditindaklanjuti."],
  },
  refund: {
    tone: "danger",
    submitLabel: "Konfirmasi pengembalian",
    impact: ["Pembayaran pesanan akan dikoreksi.", "Tindakan ini mengubah pembukuan dan harus memiliki bukti pengembalian."],
  },
  cancelDistribution: {
    tone: "danger",
    submitLabel: "Batalkan draft pencairan",
    impact: ["Dana yang dicadangkan pada draft kembali tersedia.", "Draft yang dibatalkan tidak dapat diserahkan."],
  },
  expense: { tone: "primary", submitLabel: "Catat pengeluaran" },
  funding: { tone: "primary", submitLabel: "Catat isi kas" },
  inquiry: { tone: "neutral", submitLabel: "Periksa pembayaran" },
  cancelOrder: {
    tone: "danger",
    submitLabel: "Batalkan pesanan",
    impact: ["Pesanan aktif akan dibatalkan.", "Pembayaran baru tidak dapat masuk ke pesanan ini."],
  },
  settings: { tone: "neutral", submitLabel: "Simpan kebijakan" },
  recipient: { tone: "neutral", submitLabel: "Simpan penerima" },
  va: { tone: "neutral", submitLabel: "Terbitkan VA" },
  unit: { tone: "neutral", submitLabel: "Tambah loket" },
  access: { tone: "neutral", submitLabel: "Tautkan akun" },
  limits: { tone: "neutral", submitLabel: "Simpan limit" },
  closeShift: {
    tone: "warning",
    submitLabel: "Konfirmasi tutup shift",
    impact: ["Kas terhitung dibandingkan dengan kas yang seharusnya.", "Shift ditutup dan tidak dapat menerima transaksi baru."],
  },
  pin: { tone: "neutral", submitLabel: "Simpan PIN baru" },
  openShift: { tone: "primary", submitLabel: "Buka shift" },
};
type NavItem = readonly [path: string, label: string];
const links: ReadonlyArray<readonly [group: string, items: ReadonlyArray<NavItem>]> = [
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
];
export function CoopNav({
  write = true,
  configure = true,
}: {
  write?: boolean;
  configure?: boolean;
}) {
  const pathname = usePathname();
  const allowed = ([path]: NavItem) =>
    (write || !["loket", "kredensial"].includes(path)) &&
    (configure || path !== "pengaturan");
  const current = links
    .flatMap(([, items]) => items)
    .filter(allowed)
    .find(([path]) => pathname === "/dashboard/keuangan-terpusat" + (path ? "/" + path : ""));
  const renderLink = ([path, label]: NavItem) => {
    const href = "/dashboard/keuangan-terpusat" + (path ? "/" + path : "");
    const active = pathname === href;
    return (
      <Link
        key={path}
        href={href}
        aria-current={active ? "page" : undefined}
        className={
          "flex min-h-11 shrink-0 items-center rounded-md px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 " +
          (active
            ? "bg-emerald-100 text-emerald-950"
            : "text-slate-700 hover:bg-slate-100 hover:text-slate-950")
        }
      >
        {label}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Keuangan Terpusat"
      className="rounded-lg border border-slate-200 bg-white p-2"
    >
      <div className="lg:hidden">
        <p className="px-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Saat ini: <span className="text-slate-800">{current?.[1] || "Keuangan Terpusat"}</span>
        </p>
        <div className="mt-1 flex gap-1 overflow-x-auto pb-1">
          {links[0][1].filter(allowed).map(renderLink)}
          <details className="shrink-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Lainnya
            </summary>
            <div className="absolute left-4 right-4 z-20 mt-1 grid gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              {links.slice(1).flatMap(([, items]) => items.filter(allowed)).map(renderLink)}
            </div>
          </details>
        </div>
      </div>
      <div className="hidden gap-3 lg:grid lg:grid-cols-[2fr_1fr_1.3fr]">
        {links.map(([group, items]) => (
          <section key={group} className="min-w-0">
            <p className="flex min-h-8 items-center px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group}
            </p>
            <div className="flex flex-wrap gap-1">
              {items.filter(allowed).map(renderLink)}
            </div>
          </section>
        ))}
      </div>
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
    [error, setError] = useState(""),
    [state, setState] = useState<
      "idle" | "loading" | "ready" | "empty" | "error"
    >("idle");
  useEffect(() => {
    if (search.length < 2) return;
    let stale = false;
    const timer = setTimeout(() => {
      searchCoopStudents(search)
        .then((r) => {
          if (!stale) {
            setRows(r);
            setState(r.length ? "ready" : "empty");
          }
        })
        .catch(() => {
          if (!stale) {
            setRows([]);
            setError("Pencarian santri gagal. Periksa koneksi lalu coba lagi.");
            setState("error");
          }
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
        placeholder="Ketik nama atau NIS"
        aria-label="Cari santri"
        value={search}
        onChange={(e) => {
          const value = e.target.value;
          setSearch(value);
          setSelected("");
          setError("");
          setRows([]);
          setState(value.length < 2 ? "idle" : "loading");
        }}
      />
      <select
        name={name}
        aria-label="Pilih santri"
        required
        disabled={
          state === "loading" ||
          state === "idle" ||
          state === "empty" ||
          state === "error"
        }
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          const row = rows.find((r) => r.id === e.target.value);
          if (row) onSelect?.(row.id, row.nama_lengkap);
        }}
        className={inputClass}
      >
        <option value="">
          {state === "idle"
            ? "Ketik minimal 2 karakter"
            : state === "loading"
              ? "Mencari santri..."
              : state === "empty"
                ? "Tidak ada santri yang cocok"
                : state === "error"
                  ? "Pencarian gagal"
                  : "Pilih hasil pencarian"}
        </option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nama_lengkap} | {r.nis}
          </option>
        ))}
      </select>
      {state === "loading" && (
        <p role="status" className="text-sm text-slate-600">
          Mencari santri...
        </p>
      )}
      {state === "empty" && (
        <p role="status" className="text-sm text-slate-600">
          Tidak ada santri yang cocok dengan pencarian ini.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
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
    [requestKey, setRequestKey] = useState(""),
    [reviewing, setReviewing] = useState(false),
    [reviewFields, setReviewFields] = useState<Array<{ label: string; value: string }>>([]),
    [reviewPayload, setReviewPayload] = useState<Array<[string, string]>>([]),
    router = useRouter();
  const presentation = ACTION_PRESENTATION[spec.action] || {
    tone: "neutral",
    submitLabel: spec.title,
  };
  const triggerClass = {
    primary: buttonClass,
    neutral:
      "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800",
    warning:
      "inline-flex min-h-11 items-center justify-center rounded-md border border-amber-600 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800",
    danger:
      "inline-flex min-h-11 items-center justify-center rounded-md border border-red-600 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800",
  }[presentation.tone];
  const submitClass = {
    primary: buttonClass,
    neutral:
      "inline-flex min-h-11 items-center justify-center rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50",
    warning:
      "inline-flex min-h-11 items-center justify-center rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50",
    danger:
      "inline-flex min-h-11 items-center justify-center rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50",
  }[presentation.tone];
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={triggerClass}
        onClick={() => {
          setRequestKey(crypto.randomUUID());
          setMessage("");
          setSuccess(false);
          setReviewing(false);
          setReviewFields([]);
          setReviewPayload([]);
          dialog.current?.showModal();
        }}
      >
        {spec.title}
      </button>
      <dialog
        ref={dialog}
        onClose={() => trigger.current?.focus()}
        className="m-0 h-dvh max-h-dvh w-screen max-w-none overflow-y-auto bg-white p-0 backdrop:bg-slate-950/40 sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (reviewing) {
              reviewPayload.forEach(([name, value]) => f.set(name, value));
            }
            f.set("key", requestKey);
            if (presentation.impact && !reviewing) {
              setReviewPayload(
                Array.from(f.entries()).map(([name, value]) => [name, String(value)]),
              );
              setReviewFields(
                spec.fields
                  .filter((field) => field.type !== "password")
                  .map((field) => {
                    const raw = String(f.get(field.name) || "-");
                    const option = field.options?.find((item) => item.value === raw);
                    return {
                      label: field.label,
                      value: option?.label || (field.type === "number" ? money(raw) : raw),
                    };
                  }),
              );
              setReviewing(true);
              return;
            }
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
              className="grid min-h-11 min-w-11 place-items-center rounded-md border border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </header>
          <input type="hidden" name="action" value={spec.action} />
          <input type="hidden" name="key" value={requestKey} />
          <input type="hidden" name="shiftId" value={shiftId || ""} />
          <fieldset disabled={reviewing || pending || success} className="space-y-4 disabled:opacity-60">
            {spec.fields.map((f) => <FormField key={f.name} field={f} />)}
          </fieldset>
          {reviewing && presentation.impact ? (
            <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-950">
                <Warning aria-hidden className="h-5 w-5" />
                Periksa dampak sebelum melanjutkan
              </h3>
              <dl className="mt-3 grid gap-2 text-sm">
                {reviewFields.map((field) => (
                  <div key={field.label} className="flex justify-between gap-4">
                    <dt className="text-amber-900">{field.label}</dt>
                    <dd className="break-all text-right font-semibold text-slate-900">{field.value}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-3 list-disc space-y-1 border-t border-amber-200 pt-3 pl-5 text-sm text-amber-950">
                {presentation.impact.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ) : null}
          {message && (
            <div
              role={success ? "status" : "alert"}
              className={
                "mt-4 rounded-lg p-3 text-sm " +
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
              className="min-h-11 rounded-md border border-slate-300 px-4 font-semibold"
              onClick={() => reviewing ? setReviewing(false) : dialog.current?.close()}
            >
              {reviewing ? "Ubah data" : "Tutup"}
            </button>
            <button disabled={pending || success} className={submitClass}>
              {pending
                ? "Memproses..."
                : reviewing
                  ? presentation.submitLabel
                  : presentation.impact
                    ? "Tinjau dampak"
                    : presentation.submitLabel}
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
  const lastPage = Math.max(1, Math.ceil(data.total / 25));
  const pageLink = (p: number) => {
    const params = new URLSearchParams();
    if (data.search) params.set("q", data.search);
    params.set("p", String(p));
    if (data.sort) params.set("sort", data.sort);
    if (data.dir) params.set("dir", data.dir);
    if (data.from) params.set("from", data.from);
    if (data.to) params.set("to", data.to);
    return path + "?" + params.toString();
  };
  const mobileSummary = (row: Record<string, string | number | null>) => {
    if (data.view === "home" || data.view === "bills") {
      return {
        title: String(row.santri || "-"),
        context: [row.title, row.penerima].filter(Boolean).join(" | "),
        value: money(row.remaining),
        valueLabel: "Sisa",
        status: String(row.status || ""),
      };
    }
    if (data.view === "distributions") {
      return {
        title: String(row.name || "-"),
        context: [row.kind, row.method].filter(Boolean).join(" | "),
        value: money(row.balance),
        valueLabel: "Belum dicairkan",
        status: "",
      };
    }
    if (data.view === "reports") {
      return {
        title: String(row.tanggal || "-"),
        context: String(row.keterangan || row.penerima || row.jenis || "-"),
        value: money(row.amount ?? row.net ?? row.gross),
        valueLabel: "Nominal",
        status: String(row.status || ""),
      };
    }
    if (data.view === "cashier") {
      return {
        title: String(row.loket || "-"),
        context: "Dibuka " + String(row.opened_at || "-"),
        value: money(row.discrepancy_rupiah),
        valueLabel: "Selisih",
        status: String(row.status || ""),
      };
    }
    return {
      title: String(row.id || "-"),
      context: String(row.va_number || row.customer_no || "-"),
      value: "",
      valueLabel: "",
      status: String(row.status || ""),
    };
  };
  return (
    <main className="min-w-0 space-y-5">
      <DashboardPageHeader title={data.title} description={data.description} />
      <CoopNav write={data.canWrite} configure={data.canConfigure} />
      {data.metrics.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((m) => (
            <section key={m.label} className="rounded-lg border bg-white p-4">
              <p className="text-sm text-slate-500">{m.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-900">
                {money(m.amount)}
              </p>
            </section>
          ))}
        </div>
      )}
      {data.shift && (
        <div className="flex flex-wrap justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <span>Shift aktif | {String(data.shift.unit_name)}</span>
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
        <p className="rounded-lg bg-slate-100 p-4 text-sm">
          Data produksi: <strong>eskahade-finance</strong>. Pengelola mengikuti
          Katering & Laundry. Role akun diatur melalui Pengaturan Pengguna
          aplikasi.
        </p>
      )}
      <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <form className="flex flex-wrap gap-2 border-b p-4" action={path}>
          <input
            name="q"
            defaultValue={data.search}
            placeholder="Cari pada daftar"
            aria-label="Cari pada daftar"
            className={inputClass + " sm:max-w-sm"}
          />
          {data.view==='reports'&&<><label className="text-xs">Dari<input type="date" name="from" defaultValue={data.from} className={inputClass}/></label><label className="text-xs">Sampai<input type="date" name="to" defaultValue={data.to} className={inputClass}/></label></>}<button className={buttonClass}>Cari</button><a className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm" href={'/api/finance/cooperative/export?view='+data.view+'&q='+encodeURIComponent(data.search)+'&from='+data.from+'&to='+data.to}>Ekspor CSV</a>
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
                      aria-label={
                        "Urutkan berdasarkan " +
                        c.label +
                        ", " +
                        (data.sort === c.key && data.dir === "asc"
                          ? "menurun"
                          : "menaik")
                      }
                      href={
                        path +
                        "?q=" +
                        encodeURIComponent(data.search) +
                        "&sort=" +
                        c.key +
                        "&dir="+(data.sort===c.key&&data.dir==='asc'?'desc':'asc')+"&from="+data.from+"&to="+data.to
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {data.sort === c.key ? (
                          data.dir === "asc" ? (
                            <CaretUp aria-hidden className="h-3.5 w-3.5" />
                          ) : (
                            <CaretDown aria-hidden className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ArrowsDownUp aria-hidden className="h-3.5 w-3.5" />
                        )}
                      </span>
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
                      {c.money ? money(r[c.key]) : String(r[c.key] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y md:hidden">
          {data.rows.map((r) => {
            const summary = mobileSummary(r);
            return (
            <article key={String(r.id)} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{summary.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-600">{summary.context}</p>
                  {summary.status ? <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">{summary.status}</p> : null}
                </div>
                {summary.value ? <div className="shrink-0 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{summary.valueLabel}</p>
                  <p className="mt-0.5 font-bold tabular-nums text-slate-900">{summary.value}</p>
                </div> : null}
              </div>
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer py-2 text-sm text-emerald-800">
                  Lihat semua rincian
                </summary>
                <dl className="space-y-2">
                  {data.columns.map((c) => (
                    <div
                      key={c.key}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <dt className="text-slate-500">{c.label}</dt>
                      <dd className="text-right">
                        {c.money ? money(r[c.key]) : String(r[c.key] ?? "-")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </article>
          )})}
        </div>
        {!data.rows.length && (
          <div className="p-10 text-center text-sm text-slate-600">
            <p className="font-semibold text-slate-800">
              {data.search ? "Tidak ada hasil pencarian" : "Belum ada data"}
            </p>
            <p className="mt-1">
              {data.search
                ? "Tidak ada data yang cocok dengan \"" +
                  data.search +
                  "\". Ubah kata kunci atau hapus pencarian."
                : "Data akan muncul di sini setelah transaksi pertama dicatat."}
            </p>
            {data.search && (
              <Link
                href={path}
                className="mt-3 inline-flex min-h-11 items-center font-semibold text-emerald-800 underline underline-offset-4"
              >
                Hapus pencarian
              </Link>
            )}
          </div>
        )}
        <footer className="flex items-center justify-between border-t p-4 text-sm">
          {data.page === 1 ? (
            <span
              aria-disabled="true"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 py-2 text-slate-400"
            >
              Sebelumnya
            </span>
          ) : (
            <Link
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
              href={pageLink(data.page - 1)}
            >
              Sebelumnya
            </Link>
          )}
          <span>
            {data.page} / {lastPage}
          </span>
          {data.page >= lastPage ? (
            <span
              aria-disabled="true"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 py-2 text-slate-400"
            >
              Berikutnya
            </span>
          ) : (
            <Link
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
              href={pageLink(data.page + 1)}
            >
              Berikutnya
            </Link>
          )}
        </footer>
      </section>
    </main>
  );
}
