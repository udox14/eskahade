import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { getEffectiveRoles } from "@/lib/auth/session";
import { financeQuery } from "@/lib/db";
import { loadModuleWorkspace } from "@/lib/finance/module-workspace";
import {
  ANNUAL_FEE_TYPES,
  MODULE_ACTIONS,
  paymentModuleFromSlug,
  requireModuleAccess,
} from "@/lib/finance/modules";
import {
  createModuleDistribution,
  finishModuleDistribution,
  generateModuleBills,
  saveModuleAccess,
  saveModuleChecklist,
  saveModuleSettings,
} from "../../actions";

export const dynamic = "force-dynamic";

const SECTIONS = ["dashboard", "tagihan", "generate", "pembayaran", "penyaluran", "laporan", "pengaturan", "petunjuk"] as const;
const SECTION_LABELS: Record<(typeof SECTIONS)[number], string> = {
  dashboard: "Dashboard", tagihan: "Daftar Tagihan", generate: "Generate Tagihan", pembayaran: "Pembayaran",
  penyaluran: "Penyaluran", laporan: "Laporan", pengaturan: "Pengaturan", petunjuk: "Petunjuk",
};
const CHECKLIST = [
  ["tarif", "Tarif atau target periode sudah diperiksa"],
  ["periode", "Periode aktif dan jatuh tempo sudah benar"],
  ["peserta", "Daftar peserta dan pembebasan sudah diperiksa"],
  ["generate", "Tagihan atau target setoran sudah diproses"],
  ["hasil", "Hasil, selisih, dan data yang dilewati sudah diperiksa"],
] as const;

function rupiah(value: unknown) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function displayCell(key: string, value: unknown) {
  if (["amount", "paid", "sisa", "gross", "fee", "net", "nominal"].includes(key)) return rupiah(value);
  return String(value ?? "-");
}

export default async function PaymentModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string; section?: string[] }>;
  searchParams: Promise<{ period?: string; annualFeeType?: string; status?: string }>;
}) {
  const route = await params;
  const query = await searchParams;
  const definition = paymentModuleFromSlug(route.module);
  if (!definition) notFound();
  const section = (route.section?.[0] || "dashboard") as (typeof SECTIONS)[number];
  if (!SECTIONS.includes(section)) notFound();
  const needed = section === "pengaturan" ? "VIEW" : section === "generate" ? "VIEW" : section === "penyaluran" ? "VIEW" : section === "laporan" ? "REPORT" : "VIEW";
  const { session, actions } = await requireModuleAccess(definition.code, needed);
  const canManageAssignments = getEffectiveRoles(session).some((role) => ["admin", "admin_koperasi"].includes(role));
  const data = await loadModuleWorkspace({ moduleCode: definition.code, section, requestedPeriod: query.period, annualFeeType: query.annualFeeType, requestedStatus: query.status, userId: session.id, canManageAssignments });
  const base = `/dashboard/keuangan-terpusat/unit/${definition.slug}`;
  const recipients = section === "penyaluran" && actions.has("DISTRIBUTE")
    ? await financeQuery<{ id: string; name: string }>(
        definition.code === "MAKAN" ? "SELECT id,name FROM finance_coop_recipients WHERE kind='MAKAN' ORDER BY name"
          : definition.code === "LAUNDRY" ? "SELECT id,name FROM finance_coop_recipients WHERE kind='LAUNDRY' ORDER BY name"
            : "SELECT id,name FROM finance_coop_recipients WHERE id='pesantren'",
      ) : [];
  const keys = data.rows[0] ? Object.keys(data.rows[0]) : [];
  const periodType = definition.code === "BIAYA_TAHUNAN" ? "text" : "month";

  return <main className="min-w-0 space-y-5">
    <Link href="/dashboard/keuangan-terpusat" className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 underline underline-offset-4">Kembali ke Sistem Keuangan Baru</Link>
    <DashboardPageHeader title={`Unit ${definition.label}`} description={definition.shortDescription} />

    <nav aria-label={`Menu unit ${definition.label}`} className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
      <div className="flex min-w-max gap-1">
        {SECTIONS.map((item) => <Link key={item} href={item === "dashboard" ? base : `${base}/${item}`}
          aria-current={section === item ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 ${section === item ? "bg-emerald-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
          {SECTION_LABELS[item]}
        </Link>)}
      </div>
    </nav>

    <details className="rounded-lg border border-emerald-200 bg-emerald-50 p-4" open={section === "petunjuk"}>
      <summary className="min-h-11 cursor-pointer py-2 font-bold text-emerald-950">Petunjuk halaman {SECTION_LABELS[section]}</summary>
      <div className="grid gap-4 pt-3 text-sm leading-6 text-slate-700 md:grid-cols-2">
        <div><h2 className="font-bold text-slate-900">Tujuan dan prasyarat</h2><p>Gunakan halaman ini hanya untuk data {definition.label}. Pastikan periode, tarif, daftar peserta, dan pembebasan sudah diperiksa sebelum memposting perubahan.</p></div>
        <div><h2 className="font-bold text-slate-900">Koreksi yang aman</h2><p>Jangan menghapus transaksi yang sudah diposting. Gunakan pembatalan atau refund yang tersedia agar jurnal dan audit tetap dapat ditelusuri.</p></div>
      </div>
    </details>

    {section === "dashboard" ? <>
      <form className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end" action={base}>
        <label className="text-sm font-semibold text-slate-700"><span className="mb-1 block">Periode aktif</span><input name="period" type={periodType} defaultValue={data.period} className="min-h-11 rounded-md border border-slate-400 px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800" /></label>
        <button className="min-h-11 rounded-md bg-emerald-800 px-4 font-semibold text-white hover:bg-emerald-900">Tampilkan periode</button>
        <p className="text-xs text-slate-600 sm:ml-auto">Diperbarui {new Date(data.updatedAt).toLocaleString("id-ID")}</p>
      </form>
      <section aria-label="Ringkasan unit" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => <Link key={metric.key} href={metric.href} className="group min-w-0 rounded-lg border border-slate-200 bg-white p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
          <p className="text-sm font-semibold text-slate-600">{metric.label}</p>
          <p className="mt-2 break-words text-xl font-extrabold tabular-nums text-slate-950">{metric.percent ? `${metric.amount}%` : rupiah(metric.amount)}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">{metric.detail}</p>
          <span className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 underline underline-offset-4">Lihat data pembentuk</span>
        </Link>)}
      </section>
    </> : null}

    {definition.code === "BIAYA_TAHUNAN" && ["dashboard", "tagihan", "generate"].includes(section) ? <nav aria-label="Jenis biaya tahunan" className="flex flex-wrap gap-2">
      <Link className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-3 font-semibold" href={`${base}/${section === "dashboard" ? "" : section}`}>Semua jenis</Link>
      {ANNUAL_FEE_TYPES.map((type) => <Link key={type} className={`inline-flex min-h-11 items-center rounded-md border px-3 font-semibold ${query.annualFeeType === type ? "border-emerald-800 bg-emerald-50 text-emerald-950" : "border-slate-300 bg-white"}`} href={`${base}/${section === "dashboard" ? "" : section}?annualFeeType=${type}`}>{type === "EKSKUL" ? "Ekstra/Ekskul" : type}</Link>)}
    </nav> : null}

    {section === "generate" ? <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-950">Generate tagihan {definition.label}</h2>
      {definition.code === "UANG_JAJAN" ? <p className="mt-2 text-sm text-slate-700">Uang Jajan menggunakan setoran saldo, bukan tagihan wajib. Penerimaan dicatat melalui pembayaran agar langsung menambah saldo santri.</p> : actions.has("GENERATE") ? <form action={generateModuleBills.bind(null, definition.code)} className="mt-4 grid gap-4 sm:max-w-md">
        <input type="hidden" name="key" value={crypto.randomUUID()} />
        {definition.code === "BIAYA_TAHUNAN" ? <label className="text-sm font-semibold">Jenis biaya<select name="annualFeeType" defaultValue={query.annualFeeType || ""} className="mt-1 min-h-11 w-full rounded-md border border-slate-400 px-3"><option value="">Semua jenis</option><option value="EHB">EHB</option><option value="EKSKUL">Ekstra/Ekskul</option><option value="KESEHATAN">Kesehatan</option></select></label> : null}
        {["SPP", "MAKAN", "LAUNDRY"].includes(definition.code) ? <label className="text-sm font-semibold">Bulan tagihan<input name="period" type="month" required defaultValue={data.period} className="mt-1 min-h-11 w-full rounded-md border border-slate-400 px-3" /></label> : null}
        <p className="text-sm text-slate-600">Eksekusi ulang aman: tagihan yang sudah ada akan dilewati.</p>
        <button className="min-h-11 rounded-md bg-emerald-800 px-4 font-bold text-white hover:bg-emerald-900">Generate dan posting tagihan</button>
      </form> : <p className="mt-2 text-sm text-slate-700">Anda dapat melihat hasil generate, tetapi tidak memiliki izin untuk menjalankannya.</p>}
    </section> : null}

    {section === "penyaluran" && actions.has("DISTRIBUTE") && definition.code !== "UANG_JAJAN" ? <div className="grid gap-4 lg:grid-cols-2">
      <form action={createModuleDistribution.bind(null, definition.code)} className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Buat draft penyaluran</h2><input type="hidden" name="key" value={crypto.randomUUID()} />
        <label className="mt-4 block text-sm font-semibold">Penerima<select name="recipientId" required className="mt-1 min-h-11 w-full rounded-md border border-slate-400 px-3">{recipients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="mt-3 block text-sm font-semibold">Nominal<input name="amount" type="number" min="1" required className="mt-1 min-h-11 w-full rounded-md border border-slate-400 px-3" /></label>
        <label className="mt-3 block text-sm font-semibold">Biaya transfer<input name="fee" type="number" min="0" defaultValue="0" className="mt-1 min-h-11 w-full rounded-md border border-slate-400 px-3" /></label>
        <label className="mt-3 block text-sm font-semibold">Metode<select name="method" className="mt-1 min-h-11 w-full rounded-md border border-slate-400 px-3"><option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option></select></label>
        <button className="mt-4 min-h-11 rounded-md bg-emerald-800 px-4 font-bold text-white">Buat draft</button>
      </form>
      <form action={finishModuleDistribution.bind(null, definition.code)} className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Konfirmasi dana diterima</h2>
        {[['id','Nomor pencairan'],['reference','Referensi transfer atau kuitansi'],['receivedBy','Nama penerima'],['proof','Tautan bukti HTTPS']].map(([name,label]) => <label key={name} className="mt-3 block text-sm font-semibold">{label}<input name={name} required={name !== "proof"} type={name === "proof" ? "url" : "text"} className="mt-1 min-h-11 w-full rounded-md border border-slate-400 px-3" /></label>)}
        <button className="mt-4 min-h-11 rounded-md bg-amber-700 px-4 font-bold text-white">Konfirmasi penyerahan</button>
      </form>
    </div> : null}

    {section === "pengaturan" ? <div className="grid gap-4 xl:grid-cols-2">
      {actions.has("CONFIGURE") ? <form action={saveModuleSettings.bind(null, definition.code)} className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Periode dan jatuh tempo</h2>
        <label className="mt-4 block text-sm font-semibold">Periode aktif<input name="activePeriod" defaultValue={data.settings?.active_period || data.period} className="mt-1 min-h-11 w-full rounded-md border border-slate-400 px-3" /></label>
        <label className="mt-3 block text-sm font-semibold">Tanggal jatuh tempo<input name="dueDay" type="number" min="1" max="31" defaultValue={data.settings?.due_day || ""} className="mt-1 min-h-11 w-full rounded-md border border-slate-400 px-3" /></label>
        <button className="mt-4 min-h-11 rounded-md bg-emerald-800 px-4 font-bold text-white">Simpan pengaturan</button>
      </form> : <p className="rounded-lg border bg-white p-5 text-sm">Pengaturan hanya dapat diubah oleh petugas dengan izin konfigurasi.</p>}
      {canManageAssignments ? <form action={saveModuleAccess.bind(null, definition.code)} className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Assignment petugas</h2>
        <label className="mt-4 block text-sm font-semibold">Akun<select name="userId" required className="mt-1 min-h-11 w-full rounded-md border border-slate-400 px-3">{data.users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email} ({user.email})</option>)}</select></label>
        <fieldset className="mt-4"><legend className="text-sm font-bold">Izin unit kerja</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{MODULE_ACTIONS.map((action) => <label key={action} className="flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm"><input type="checkbox" name={`permission_${action}`} defaultChecked={["VIEW","REPORT","EXPORT"].includes(action)} />{action}</label>)}</div></fieldset>
        <button className="mt-4 min-h-11 rounded-md bg-emerald-800 px-4 font-bold text-white">Simpan assignment</button>
      </form> : null}
      {canManageAssignments ? <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-2"><h2 className="font-bold">Petugas yang ditugaskan</h2>{data.assignments.length ? <ul className="mt-3 divide-y">{data.assignments.map((item) => <li key={item.user_id} className="py-3 text-sm"><strong>{item.user_id}</strong><span className="ml-2 text-slate-600">{(JSON.parse(item.permissions_json) as string[]).join(", ")}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Belum ada assignment khusus. Akses bawaan role tetap berlaku.</p>}</section> : null}
    </div> : null}

    {section === "petunjuk" ? <form action={saveModuleChecklist.bind(null, definition.code)} className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-950">Checklist awal petugas</h2><p className="mt-1 text-sm text-slate-600">Checklist ini hanya menyimpan progres panduan dan tidak mengubah transaksi.</p>
      <div className="mt-4 space-y-2">{CHECKLIST.map(([code,label]) => <label key={code} className="flex min-h-11 items-center gap-3 rounded-md border border-slate-300 px-3 text-sm"><input type="checkbox" name={code} defaultChecked={data.checklist.includes(code)} /><span>{label}</span></label>)}</div>
      <button className="mt-4 min-h-11 rounded-md bg-emerald-800 px-4 font-bold text-white">Simpan progres</button>
    </form> : null}

    {!["pengaturan", "petunjuk"].includes(section) ? <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-bold text-slate-950">{section === "dashboard" ? "Aktivitas tagihan terbaru" : SECTION_LABELS[section]}</h2><p className="mt-1 text-sm text-slate-600">Daftar ini hanya memuat data milik unit {definition.label}{query.status ? ` dengan filter ${query.status}` : ""}.</p></div>{actions.has("EXPORT") && ["tagihan","pembayaran","penyaluran","laporan"].includes(section) ? <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-400 px-3 text-sm font-bold text-slate-800" href={`/api/finance/modules/export?module=${definition.code}&section=${section}&period=${encodeURIComponent(data.period)}&annualFeeType=${query.annualFeeType || ""}&status=${query.status || ""}`}>Ekspor Excel</a> : null}</header>
      {data.rows.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead className="bg-slate-100 text-left"> <tr>{keys.map((key) => <th key={key} className="whitespace-nowrap px-4 py-3 font-bold">{key.replaceAll("_", " ")}</th>)}</tr></thead><tbody className="divide-y">{data.rows.map((row) => <tr key={String(row.id)}>{keys.map((key) => <td key={key} className="max-w-xs break-words px-4 py-3 tabular-nums">{displayCell(key,row[key])}</td>)}</tr>)}</tbody></table></div>
      <div className="divide-y md:hidden">{data.rows.map((row) => <article key={String(row.id)} className="p-4"><p className="font-bold text-slate-950">{String(row.santri || row.penerima || row.title || row.id)}</p><dl className="mt-3 space-y-2">{keys.filter((key) => key !== "id").map((key) => <div key={key} className="flex justify-between gap-4 text-sm"><dt className="text-slate-600">{key.replaceAll("_", " ")}</dt><dd className="break-all text-right">{displayCell(key,row[key])}</dd></div>)}</dl></article>)}</div></> : <div className="p-8 text-center"><h3 className="font-bold text-slate-900">Belum ada data pada periode ini</h3><p className="mt-2 text-sm text-slate-600">Periksa periode atau jalankan proses yang sesuai untuk mengisi daftar.</p></div>}
    </section> : null}
  </main>;
}
