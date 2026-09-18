"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowClockwise, ShieldCheck } from "@phosphor-icons/react";
import {
  generateCentralNonSppBilling,
  listBillingExemptions,
  previewCentralNonSppBilling,
  revokeBillingExemptions,
  saveBillingExemption,
} from "../billing-actions";
import type { NonSppBillingPreview } from "@/lib/finance/cooperative/non-spp-billing";
import type { ExemptionItemCode } from "@/lib/finance/cooperative/types";
import { ConfirmAction, ResultBanner, SectionPanel } from "./finance-ui";
import { SantriPicker } from "./finance-inputs";
import type { SantriSearchRow } from "@/lib/finance/santri-search";

const inputClass = "min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:opacity-50";
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

type ActiveRule = Awaited<ReturnType<typeof listBillingExemptions>>[number];

export function BillingOperations({ view = "all" }: { view?: "all" | "generate" | "exemptions" }) {
  const [preview, setPreview] = useState<NonSppBillingPreview | null>(null);
  const [rules, setRules] = useState<ActiveRule[]>([]);
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [revokeReason, setRevokeReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string; detail?: string } | null>(null);
  const [studentId, setStudentId] = useState("");
  const [student, setStudent] = useState<SantriSearchRow | null>(null);
  const [itemCode, setItemCode] = useState<ExemptionItemCode>("SPP");
  const [scope, setScope] = useState<"PERMANENT" | "PERIOD">("PERMANENT");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const loadRules = () => listBillingExemptions().then(setRules).catch(() => setRules([]));
  useEffect(() => { void loadRules(); }, []);

  const loadPreview = () => startTransition(async () => {
    try {
      setResult(null);
      setPreview(await previewCentralNonSppBilling());
    } catch (error) {
      setResult({ tone: "error", message: "Pratinjau gagal dimuat.", detail: error instanceof Error ? error.message : "Kesalahan tidak dikenal." });
    }
  });

  const annual = ["KESEHATAN", "EHB", "EKSKUL"].includes(itemCode);
  const effectiveScope = itemCode === "BANGUNAN" ? "PERMANENT" : scope;

  return <div className="space-y-4">
    <ResultBanner result={result} onDismiss={() => setResult(null)} />
    {view !== "exemptions" ? <SectionPanel
      title="Penerbitan Non-SPP massal"
      description="Sasaran selalu seluruh santri aktif yang memenuhi aturan. AL-BAGHORY tetap dikecualikan."
      action={<button type="button" disabled={pending} onClick={loadPreview} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-800 disabled:opacity-50"><ArrowClockwise className="h-4 w-4" />{pending ? "Memeriksa..." : preview ? "Perbarui pratinjau" : "Buat pratinjau"}</button>}
    >
      {!preview ? <div className="p-4 text-sm text-slate-600">Pratinjau akan memeriksa tarif angkatan, tagihan terdahulu, pembebasan, dan tahun ajaran aktif tanpa menyimpan data.</div> : <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Tahun ajaran</p><p className="mt-1 font-bold">{preview.academicYear.nama}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Santri diperiksa</p><p className="mt-1 text-xl font-bold tabular-nums">{preview.eligibleStudents}</p></div>
          <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Akan dibuat</p><p className="mt-1 text-xl font-bold tabular-nums text-emerald-900">{preview.created}</p></div>
          <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-800">Dilewati</p><p className="mt-1 text-xl font-bold tabular-nums text-amber-900">{preview.skipped}</p></div>
        </div>
        {Object.keys(preview.skipReasons).length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><p className="font-bold">Alasan dilewati</p><ul className="mt-1 grid gap-1 sm:grid-cols-2">{Object.entries(preview.skipReasons).map(([reason, count]) => <li key={reason}>{reason}: <strong>{count}</strong></li>)}</ul></div> : null}
        <div className="max-h-[32rem] overflow-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr><th className="px-3 py-2">Santri</th><th className="px-3 py-2">Kategori</th><th className="px-3 py-2 text-right">Tarif</th><th className="px-3 py-2">Hasil</th><th className="px-3 py-2">Alasan</th></tr></thead><tbody className="divide-y">{preview.rows.map((row, index) => <tr key={`${row.santriId}-${row.category}-${index}`}><td className="px-3 py-2"><p className="font-semibold">{row.name}</p><p className="text-slate-500">{row.nis} · {row.asrama}</p></td><td className="px-3 py-2">{row.category === "EKSKUL" ? "Ekskul" : row.category}</td><td className="px-3 py-2 text-right tabular-nums">{money(row.amount)}</td><td className="px-3 py-2"><span className={row.action === "CREATE" ? "text-emerald-800" : "text-amber-800"}>{row.action === "CREATE" ? "Buat" : "Lewati"}</span></td><td className="px-3 py-2">{row.reason}</td></tr>)}</tbody></table>
        </div>
        <div className="flex justify-end"><button type="button" disabled={pending || preview.created === 0} onClick={() => setConfirm(true)} className={buttonClass}>Terbitkan {preview.created} tagihan</button></div>
      </div>}
    </SectionPanel> : null}

    {view !== "generate" ? <SectionPanel title="Pembebasan tagihan" description="Aturan baru mencegah generator menerbitkan tagihan. Tagihan OPEN yang sudah ada ditandai dibebaskan tanpa dihapus.">
      <form className="grid gap-3 p-4 lg:grid-cols-2" onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            const periodKey = effectiveScope === "PERIOD" ? (annual ? `TA:${preview?.academicYear.id || ""}` : month) : undefined;
            const saved = await saveBillingExemption({ santriId: studentId, itemCode, scope: effectiveScope, periodKey, reason: String(form.get("reason") || "") });
            setResult({ tone: "success", message: "Pembebasan disimpan.", detail: `${saved.affectedBills} tagihan OPEN ditandai dibebaskan.` });
            await loadRules();
          } catch (error) {
            setResult({ tone: "error", message: "Pembebasan tidak dapat disimpan.", detail: error instanceof Error ? error.message : "Kesalahan tidak dikenal." });
          }
        });
      }}>
        <label className="block space-y-1 text-sm font-semibold"><span>Santri</span><SantriPicker selected={student} onSelect={row => { setStudent(row); setStudentId(row?.id || ""); }} /></label>
        <label className="block space-y-1 text-sm font-semibold"><span>Kategori</span><select className={inputClass} value={itemCode} onChange={event => { const value = event.target.value as ExemptionItemCode; setItemCode(value); if (value === "BANGUNAN") setScope("PERMANENT"); }}><option value="SPP">SPP</option><option value="MAKAN">Makan</option><option value="LAUNDRY">Laundry</option><option value="BANGUNAN">Bangunan</option><option value="KESEHATAN">Kesehatan</option><option value="EHB">EHB</option><option value="EKSKUL">Ekskul</option></select></label>
        <label className="block space-y-1 text-sm font-semibold"><span>Cakupan</span><select className={inputClass} value={effectiveScope} disabled={itemCode === "BANGUNAN"} onChange={event => setScope(event.target.value as "PERMANENT" | "PERIOD")}><option value="PERMANENT">Permanen</option><option value="PERIOD">Per periode</option></select></label>
        {effectiveScope === "PERIOD" && !annual ? <label className="block space-y-1 text-sm font-semibold"><span>Bulan</span><input type="month" required value={month} onChange={event => setMonth(event.target.value)} className={inputClass} /></label> : <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{effectiveScope === "PERIOD" ? `Berlaku untuk tahun ajaran ${preview?.academicYear.nama || "aktif"}.` : "Berlaku tanpa batas periode sampai dicabut."}</div>}
        <label className="block space-y-1 text-sm font-semibold lg:col-span-2"><span>Alasan</span><textarea name="reason" minLength={5} required rows={3} className={inputClass} placeholder="Contoh: keputusan pimpinan nomor ..." /></label>
        <div className="lg:col-span-2"><button disabled={pending || !studentId} className={buttonClass}><ShieldCheck className="mr-2 h-4 w-4" />Simpan pembebasan</button></div>
      </form>
      <div className="border-t">
        <div className="px-4 py-3"><h3 className="text-sm font-bold">Pembebasan aktif</h3><p className="text-xs text-slate-500">Pilih satu atau beberapa aturan. Pencabutan membuka kembali tagihan yang dibebaskan bila belum ada pembayaran.</p>{selectedRules.size ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={revokeReason} onChange={event => setRevokeReason(event.target.value)} placeholder="Alasan pencabutan" className={inputClass} /><button type="button" disabled={pending || revokeReason.trim().length < 5} className="min-h-11 shrink-0 rounded-md border border-red-300 px-3 text-xs font-bold text-red-800 disabled:opacity-40" onClick={() => startTransition(async () => { try { const response = await revokeBillingExemptions([...selectedRules], revokeReason); setSelectedRules(new Set()); setRevokeReason(""); setResult({ tone: "success", message: `${response.revoked} pembebasan dicabut.` }); await loadRules(); } catch (error) { setResult({ tone: "error", message: "Pembebasan massal gagal dicabut.", detail: error instanceof Error ? error.message : "Kesalahan tidak dikenal." }); } })}>Cabut {selectedRules.size} pilihan</button></div> : null}</div>
        {rules.length ? <div className="divide-y">{rules.map(rule => <label key={rule.id} className="flex min-h-16 cursor-pointer items-start gap-3 px-4 py-3 text-sm hover:bg-slate-50"><input type="checkbox" aria-label={`Pilih pembebasan ${rule.student?.nama_lengkap || rule.santri_id}`} checked={selectedRules.has(rule.id)} onChange={() => setSelectedRules(current => { const next = new Set(current); if (next.has(rule.id)) next.delete(rule.id); else next.add(rule.id); return next; })} className="mt-1 h-5 w-5" /><div><p className="font-semibold">{rule.student?.nama_lengkap || rule.santri_id}</p><p className="text-xs text-slate-500">{rule.item_code} · {rule.scope === "PERMANENT" ? "Permanen" : rule.period_key} · {rule.reason}</p></div></label>)}</div> : <p className="p-6 text-center text-sm text-slate-500">Belum ada pembebasan aktif.</p>}
      </div>
    </SectionPanel> : null}

    <ConfirmAction
      open={confirm}
      title="Terbitkan tagihan massal?"
      description={`Sistem akan membuat ${preview?.created || 0} tagihan untuk seluruh santri yang memenuhi aturan.`}
      impact={["Eksekusi ulang aman dan tidak membuat duplikat.", "Tagihan yang sudah dibuat akan terlihat di portal pembayaran."]}
      confirmLabel="Terbitkan tagihan"
      pending={pending}
      onCancel={() => setConfirm(false)}
      onConfirm={() => startTransition(async () => {
        try {
          const run = await generateCentralNonSppBilling(crypto.randomUUID());
          setConfirm(false);
          setResult({ tone: "success", message: "Batch tagihan selesai.", detail: `${run.created} dibuat, ${run.skipped} dilewati, ${run.failed} gagal.` });
          setPreview(await previewCentralNonSppBilling());
        } catch (error) {
          setConfirm(false);
          setResult({ tone: "error", message: "Batch tagihan gagal.", detail: error instanceof Error ? error.message : "Kesalahan tidak dikenal." });
        }
      })}
    />
  </div>;
}
