"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsDownUp, CaretDown, CaretUp, Warning, X } from "@phosphor-icons/react";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import type {
  ScreenData,
  FormSpec,
  Field,
} from "@/lib/finance/cooperative/screen";
import { coopAction, searchCoopStudents } from "../cooperative-actions";
import { Checkout } from "./item-checkout";
import { BillingOperations } from "./billing-operations";
import { RecipientAccountManager } from "./recipient-account-manager";
import { FinanceWorkspaceNavigation } from "./workspace-navigation";
import {
  FinanceGuide,
  FinanceTour,
  useFinanceTour,
  type TourStep,
} from "./finance-ui";
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
export function StudentField({
  name = "santriId",
  onSelect,
}: {
  name?: string;
  onSelect?: (id: string, label: string) => void;
}) {
  type StudentRow = {
    id: string;
    nama_lengkap: string;
    nis: string;
    asrama: string | null;
    kamar: string | null;
  };
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  useEffect(() => {
    if (selected || search.trim().length < 2) return;
    let stale = false;
    const timer = setTimeout(() => {
      setState("loading");
      searchCoopStudents(search)
        .then((r) => {
          if (!stale) {
            setRows(r);
            setOpen(true);
            setActiveIndex(r.length ? 0 : -1);
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
  }, [search, selected, retry]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const choose = (row: StudentRow) => {
    setSelected(row);
    setSearch(row.nama_lengkap);
    setOpen(false);
    onSelect?.(row.id, row.nama_lengkap);
  };
  return (
    <div ref={box} className="relative space-y-2">
      {selected ? <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
        <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{selected.nama_lengkap}</p><p className="truncate text-xs text-slate-600">{selected.nis} · {selected.asrama || "Tanpa asrama"}{selected.kamar ? ` / ${selected.kamar}` : ""}</p></div>
        <button type="button" className="min-h-11 shrink-0 px-2 text-xs font-bold text-emerald-900" onClick={() => { setSelected(null); setSearch(""); setRows([]); setState("idle"); requestAnimationFrame(() => input.current?.focus()); }}>Ganti</button>
        <input type="hidden" name={name} value={selected.id} />
      </div> : <>
      <input
        ref={input}
        className={inputClass}
        placeholder="Cari nama atau NIS santri"
        aria-label="Cari santri"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${name}-student-options`}
        aria-activedescendant={activeIndex >= 0 ? `${name}-student-${activeIndex}` : undefined}
        value={search}
        onChange={(e) => {
          const value = e.target.value;
          setSearch(value);
          setSelected(null);
          setError("");
          setRows([]);
          setState(value.length < 2 ? "idle" : "loading");
        }}
        onFocus={() => rows.length && setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); return; }
          if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex(index => Math.min(rows.length - 1, index + 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex(index => Math.max(0, index - 1)); }
          if (event.key === "Home" && open) { event.preventDefault(); setActiveIndex(0); }
          if (event.key === "End" && open) { event.preventDefault(); setActiveIndex(rows.length - 1); }
          if (event.key === "Enter" && open && rows[activeIndex]) { event.preventDefault(); choose(rows[activeIndex]); }
        }}
      />
      {open ? <div id={`${name}-student-options`} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
        {state === "loading" ? <p role="status" className="px-3 py-3 text-sm text-slate-600">Mencari santri...</p> : null}
        {state === "empty" ? <p role="status" className="px-3 py-3 text-sm text-slate-600">Tidak ada santri aktif yang cocok.</p> : null}
        {state === "error" ? <div role="alert" className="px-3 py-3 text-sm text-red-800"><p>{error}</p><button type="button" className="mt-2 min-h-11 rounded-md border border-red-300 bg-white px-3 font-semibold" onClick={() => setRetry(value => value + 1)}>Coba lagi</button></div> : null}
        {state === "ready" ? rows.map((row, index) => <button
          id={`${name}-student-${index}`}
          key={row.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(row)}
          className={`block min-h-11 w-full rounded-md px-3 py-2 text-left ${index === activeIndex ? "bg-emerald-50" : "hover:bg-slate-50"}`}
        ><span className="block font-semibold text-slate-900">{row.nama_lengkap}</span><span className="block text-xs text-slate-600">{row.nis} · {row.asrama || "Tanpa asrama"}{row.kamar ? ` / ${row.kamar}` : ""}</span></button>) : null}
      </div> : null}
      </>}
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
        <p className="sr-only" aria-live="assertive">
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
  const confirmation = Boolean(presentation.impact);
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
        className={confirmation
          ? "m-auto max-h-[90dvh] w-[min(32rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl bg-white p-0 backdrop:bg-slate-950/40"
          : "ml-auto mr-0 mt-0 h-dvh max-h-dvh w-full max-w-xl overflow-y-auto bg-white p-0 shadow-2xl backdrop:bg-slate-950/40"}
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

const INLINE_ACTIONS = new Set(["inquiry", "unit", "pin", "openShift"]);

function InlineAction({ spec, shiftId }: { spec: FormSpec; shiftId?: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  return <form
    className="w-full rounded-lg border border-slate-200 bg-white p-4 sm:max-w-xl"
    onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      form.set("action", spec.action);
      form.set("key", crypto.randomUUID());
      form.set("shiftId", shiftId || "");
      startTransition(async () => {
        const response = await coopAction(form);
        setMessage(response.message);
        setSuccess(response.success);
        if (response.success) router.refresh();
      });
    }}
  >
    <h2 className="text-sm font-bold text-slate-900">{spec.title}</h2>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">{spec.fields.map(field => <FormField key={field.name} field={field} />)}</div>
    {message ? <p role={success ? "status" : "alert"} className={`mt-3 rounded-md p-3 text-sm ${success ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{message}</p> : null}
    <button disabled={pending} className={`${buttonClass} mt-3`}>{pending ? "Memproses..." : ACTION_PRESENTATION[spec.action]?.submitLabel || spec.title}</button>
  </form>;
}

type GuideContent = {
  purpose: string;
  prerequisites: string[];
  steps: string[];
  notes: string[];
  commonMistakes: string[];
  glossary: Array<{ term: string; meaning: string }>;
};

const GUIDE_CONTENT: Record<ScreenData["view"], GuideContent> = {
  home: {
    purpose: "Membaca kondisi kas, tunggakan, hak penerima, dan aktivitas terbaru sebelum mengambil tindakan.",
    prerequisites: ["Pastikan periode laporan dan hak akses Anda sesuai.", "Gunakan halaman pekerjaan khusus untuk mengubah data."],
    steps: ["Periksa kartu kondisi utama.", "Telusuri tagihan atau aktivitas yang memerlukan perhatian.", "Buka workspace terkait dari sidebar dashboard untuk menindaklanjuti."],
    notes: ["Ringkasan tidak dipakai untuk membuat tagihan atau mengubah kebijakan.", "Angka hak penerima berasal dari pembayaran yang sudah dibukukan."],
    commonMistakes: ["Menganggap tagihan OPEN sebagai uang yang sudah diterima.", "Membandingkan angka dari periode berbeda."],
    glossary: [{ term: "Hak penerima", meaning: "Dana yang telah diterima koperasi dan menjadi hak unit tujuan, tetapi belum dicairkan." }],
  },
  bills: {
    purpose: "Mengelola tarif, menerbitkan tagihan massal, memberi pembebasan, dan menangani pengecualian per santri.",
    prerequisites: ["Tahun ajaran aktif dan tarif per angkatan harus tersedia.", "Pastikan daftar santri aktif sudah benar sebelum menjalankan batch."],
    steps: ["Pratinjau batch dan baca alasan setiap baris dilewati.", "Konfirmasi penerbitan untuk seluruh santri yang memenuhi aturan.", "Kelola pembebasan permanen atau per periode.", "Gunakan pembuatan individual hanya untuk pengecualian."],
    notes: ["Bangunan dibuat sekali seumur hidup dan dapat dicicil.", "Kesehatan, EHB, dan Ekskul dibuat sekali per tahun ajaran mulai Juli.", "Tagihan lama tanpa kategori tetap ditampilkan sebagai Non-SPP lama."],
    commonMistakes: ["Menjalankan batch sebelum tarif angkatan lengkap.", "Membebaskan tagihan yang sudah dibayar tanpa koreksi atau refund."],
    glossary: [{ term: "Batch idempoten", meaning: "Eksekusi ulang tidak membuat tagihan ganda." }, { term: "Pembebasan periode", meaning: "Pengecualian yang hanya berlaku untuk bulan atau tahun ajaran tertentu." }],
  },
  distributions: {
    purpose: "Memeriksa hak setiap penerima, membuat draft pencairan, dan mencatat penyerahan dana.",
    prerequisites: ["Rekening penerima harus lengkap untuk transfer.", "Saldo hak penerima harus mencukupi."],
    steps: ["Cari penerima dan periksa hak yang belum dicairkan.", "Buat draft pencairan melalui drawer.", "Periksa metode, biaya, dan rekening bertopeng.", "Konfirmasi penyerahan setelah dana benar-benar diterima."],
    notes: ["Nomor rekening disimpan terenkripsi dan hanya empat digit terakhir yang terlihat.", "Penyerahan dana merupakan tindakan finansial dan selalu meminta konfirmasi."],
    commonMistakes: ["Menandai penyerahan sebelum transfer berhasil.", "Mengabaikan siapa yang menanggung biaya transfer."],
    glossary: [{ term: "Draft pencairan", meaning: "Rencana penyerahan yang mencadangkan hak, tetapi belum dianggap selesai." }],
  },
  cashier: {
    purpose: "Menjalankan transaksi loket dan uang jajan dalam satu shift yang dapat direkonsiliasi.",
    prerequisites: ["Buka shift pada unit kas yang benar.", "Pastikan QR reader dan PIN santri dapat digunakan."],
    steps: ["Hitung dan catat kas awal.", "Cari atau pindai santri lalu proses transaksi secara inline.", "Gunakan drawer untuk pengaturan PIN atau form panjang.", "Hitung kas fisik dan konfirmasi tutup shift."],
    notes: ["QR tidak menyimpan saldo dan penarikan tetap memerlukan PIN.", "Selisih kas dicatat saat shift ditutup."],
    commonMistakes: ["Bertransaksi pada shift atau loket yang salah.", "Membagikan PIN melalui catatan transaksi."],
    glossary: [{ term: "Kas seharusnya", meaning: "Kas awal ditambah dan dikurangi seluruh mutasi yang tercatat pada shift." }],
  },
  reports: {
    purpose: "Menelusuri jurnal, settlement, rekonsiliasi, koreksi, dan pembatalan dengan jejak audit yang jelas.",
    prerequisites: ["Tentukan rentang tanggal yang akan diperiksa.", "Siapkan referensi bank atau bukti refund untuk tindakan finansial."],
    steps: ["Saring transaksi berdasarkan tanggal atau kata kunci.", "Bandingkan settlement gateway dengan rekening.", "Catat rekonsiliasi dan tindak lanjuti selisih.", "Gunakan koreksi atau pembatalan hanya setelah bukti diperiksa."],
    notes: ["Refund dan pembatalan mengubah pembukuan serta memerlukan konfirmasi.", "Jangan menghapus bukti setelah referensinya dicatat."],
    commonMistakes: ["Merekonsiliasi rentang tanggal yang berbeda.", "Memakai pembatalan untuk transaksi yang seharusnya direfund."],
    glossary: [{ term: "Settlement", meaning: "Dana bersih dari penyedia pembayaran yang masuk ke rekening." }, { term: "Rekonsiliasi", meaning: "Pencocokan saldo pembukuan dengan saldo aktual rekening." }],
  },
  settings: {
    purpose: "Mengatur kebijakan pembayaran, rekening penerima, VA, loket, akses, dan limit secara terkontrol.",
    prerequisites: ["Perubahan hanya dapat dilakukan admin keuangan.", "Siapkan data bank resmi dan daftar penerima sebelum import."],
    steps: ["Periksa kebijakan per jenis tagihan.", "Edit rekening secara massal atau import template Excel.", "Kelola VA, loket, akses, dan limit pada section masing-masing.", "Simpan lalu periksa status kelengkapan."],
    notes: ["Nomor rekening mentah tidak pernah diekspor.", "Kolom rekening kosong saat import mempertahankan data terenkripsi yang sudah ada."],
    commonMistakes: ["Mengganti kebijakan global tanpa memeriksa override per jenis.", "Mengunggah file campuran valid dan tidak valid lalu mengabaikan hasil pratinjau."],
    glossary: [{ term: "Masked account", meaning: "Nomor rekening yang hanya menampilkan empat digit terakhir." }, { term: "Rollback import", meaning: "Tidak ada baris disimpan bila satu baris saja gagal validasi." }],
  },
};

function WorkspaceGuide({ view }: { view: ScreenData["view"] }) {
  const tour = useFinanceTour(`workspace-${view}`);
  const content = GUIDE_CONTENT[view];
  const steps: TourStep[] = [
    { target: '[data-tour="summary"]', title: "Kondisi utama", body: "Mulai dari angka dan status yang merangkum pekerjaan pada halaman ini." },
    { target: '[data-tour="actions"]', title: "Area tindakan", body: "Form singkat tampil di halaman, sedangkan pekerjaan panjang dibuka dalam drawer." },
    { target: '[data-tour="records"]', title: "Daftar kerja", body: "Gunakan pencarian, filter, pengurutan, dan rincian baris untuk menelusuri data." },
  ];
  return <>
    <FinanceGuide {...content} onStartTour={tour.start} />
    <FinanceTour steps={steps} running={tour.running} onFinish={tour.finish} />
  </>;
}

const WORK_TABS: Partial<Record<ScreenData["view"], ReadonlyArray<{ id: string; label: string }>>> = {
  bills: [
    { id: "overview", label: "Daftar Tagihan" }, { id: "individual", label: "Buat Individual" },
    { id: "generate", label: "Generate Bulanan" }, { id: "bulk", label: "Non-SPP Massal" },
    { id: "tariff", label: "Tarif" }, { id: "exemptions", label: "Pembebasan" },
  ],
  distributions: [
    { id: "overview", label: "Saldo & Riwayat" }, { id: "create", label: "Buat Pencairan" }, { id: "handover", label: "Catat Penyerahan" },
  ],
  reports: [
    { id: "overview", label: "Riwayat" }, { id: "settlement", label: "Settlement" },
    { id: "corrections", label: "Koreksi" }, { id: "cash", label: "Mutasi Kas" }, { id: "va", label: "Periksa VA" },
  ],
  settings: [
    { id: "policies", label: "Kebijakan" }, { id: "accounts", label: "Rekening" }, { id: "va", label: "VA Santri" },
    { id: "counters", label: "Loket" }, { id: "access", label: "Akses" }, { id: "limits", label: "Limit" }, { id: "overview", label: "Data VA" },
  ],
  cashier: [
    { id: "service", label: "Layanan Loket" }, { id: "shift", label: "Shift" },
    { id: "pin", label: "PIN Santri" }, { id: "overview", label: "Riwayat Shift" },
  ],
};

const ACTION_TO_TOOL: Record<string, string> = {
  bill: "individual", generate: "generate", tariff: "tariff",
  distribution: "create", finish: "handover",
  settlement: "settlement", reconciliation: "settlement",
  refund: "corrections", cancelDistribution: "corrections", cancelOrder: "corrections",
  expense: "cash", funding: "cash", inquiry: "va",
  settings: "policies", va: "va", unit: "counters", access: "access", limits: "limits",
  openShift: "shift", closeShift: "shift", pin: "pin",
};

function WorkspaceAction({ spec, data }: { spec: FormSpec; data: ScreenData }) {
  const action = INLINE_ACTIONS.has(spec.action)
    ? <InlineAction spec={spec} shiftId={String(data.shift?.id || "")} />
    : <ActionDialog spec={spec} shiftId={String(data.shift?.id || "")} />;
  if (data.view === "settings") {
    const descriptions: Record<string, string> = {
      settings: "Atur kebijakan pembayaran, biaya, dan kanal VA.", va: "Terbitkan nomor VA tetap untuk santri.",
      unit: "Kelola unit kas yang digunakan saat membuka shift.", access: "Batasi pengelola pada penerima dana yang menjadi tanggung jawabnya.",
      limits: "Tetapkan batas penarikan uang jajan per santri.",
    };
    return <section className="rounded-lg border border-slate-200 bg-white p-4"><h2 className="text-sm font-bold text-slate-900">{spec.title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{descriptions[spec.action]}</p><div className="mt-3">{action}</div></section>;
  }
  const groups: Record<string, string> = {
    distribution: "Pembuatan pencairan", finish: "Penyerahan dana", settlement: "Settlement & rekonsiliasi",
    reconciliation: "Settlement & rekonsiliasi", refund: "Koreksi transaksi", cancelDistribution: "Koreksi transaksi",
    cancelOrder: "Koreksi transaksi", expense: "Mutasi kas", funding: "Mutasi kas", inquiry: "Pemeriksaan VA",
    openShift: "Operasional shift", closeShift: "Operasional shift", pin: "Akses santri",
  };
  if (!groups[spec.action]) return <div>{action}</div>;
  return <section className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">{groups[spec.action]}</p>{!INLINE_ACTIONS.has(spec.action) ? <><h2 className="mt-1 text-sm font-bold text-slate-900">{spec.title}</h2><div className="mt-3">{action}</div></> : <div className="mt-2 [&>form]:border-0 [&>form]:p-0">{action}</div>}</section>;
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
  const workTabs = WORK_TABS[data.view] || [];
  const activeTool = data.tool || "overview";
  const visibleForms = data.tool ? data.forms.filter(form => ACTION_TO_TOOL[form.action] === activeTool) : data.forms;
  const pageLink = (p: number) => {
    const params = new URLSearchParams();
    if (data.search) params.set("q", data.search);
    params.set("p", String(p));
    if (data.sort) params.set("sort", data.sort);
    if (data.dir) params.set("dir", data.dir);
    if (data.from) params.set("from", data.from);
    if (data.to) params.set("to", data.to);
    if (activeTool) params.set("tool", activeTool);
    return path + "?" + params.toString();
  };
  const mobileSummary = (row: Record<string, string | number | null>) => {
    if (data.view === "home") {
      return {
        title: String(row.santri || "-"),
        context: [row.waktu, row.kanal].filter(Boolean).join(" | "),
        value: money(row.nominal),
        valueLabel: "Nominal",
        status: String(row.status || ""),
      };
    }
    if (data.view === "bills") {
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
      <FinanceWorkspaceNavigation />
      {workTabs.length ? <nav aria-label="Pekerjaan pada halaman ini" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {workTabs.map(tab => <Link key={tab.id} href={`${path}?tool=${tab.id}`} aria-current={tab.id === activeTool ? "page" : undefined}
            className={tab.id === activeTool ? "inline-flex min-h-11 items-center rounded-md bg-emerald-700 px-3 text-xs font-bold text-white" : "inline-flex min-h-11 items-center rounded-md px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900"}>
            {tab.label}
          </Link>)}
        </div>
      </nav> : null}
      <WorkspaceGuide view={data.view} />
      {activeTool === "overview" && data.metrics.length > 0 && (
        <div data-tour="summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      {visibleForms.length ? <div data-tour="actions" className="space-y-3">
        <WorkspaceAction spec={visibleForms[0]} data={data} />
        {visibleForms.length > 1 ? <details className="rounded-lg border border-slate-200 bg-white">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 py-3 text-sm font-bold text-slate-700">Aksi lainnya <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{visibleForms.length - 1}</span></summary>
          <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">{visibleForms.slice(1).map(form => <WorkspaceAction key={form.action} spec={form} data={data} />)}</div>
        </details> : null}
      </div> : null}
      {data.view === "bills" && data.canConfigure && activeTool === "bulk" ? <BillingOperations view="generate" /> : null}
      {data.view === "bills" && data.canConfigure && activeTool === "exemptions" ? <BillingOperations view="exemptions" /> : null}
      {data.view === "settings" && data.canConfigure && activeTool === "accounts" ? <RecipientAccountManager /> : null}
      {data.view === "cashier" && data.shift && activeTool === "service" && (
        <Checkout shiftId={String(data.shift.id)} />
      )}
      {data.view === "settings" && activeTool === "policies" && (
        <p className="rounded-lg bg-slate-100 p-4 text-sm">
          Data produksi: <strong>eskahade-finance</strong>. Pengelola mengikuti
          Katering & Laundry. Role akun diatur melalui Pengaturan Pengguna
          aplikasi.
        </p>
      )}
      {activeTool === "overview" ? <section data-tour="records" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <form className="flex flex-wrap gap-2 border-b p-4" action={path}>
          <input type="hidden" name="tool" value={activeTool} />
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
                        "&dir="+(data.sort===c.key&&data.dir==='asc'?'desc':'asc')+"&from="+data.from+"&to="+data.to+"&tool="+activeTool
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
      </section> : null}
    </main>
  );
}
