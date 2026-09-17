"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DownloadSimple, FileXls, FloppyDisk, UploadSimple } from "@phosphor-icons/react";
import { BANK_CODES, accountNumberProblem, bankCodeProblem } from "@/lib/finance/banks";
import {
  listRecipientAccounts,
  saveRecipientAccounts,
  type RecipientAccountRow,
  type RecipientAccountView,
} from "../billing-actions";
import { ResultBanner, SectionPanel } from "./finance-ui";

type EditRow = RecipientAccountView & { accountNumber: string };
type ImportPreview = { rows: EditRow[]; errors: string[]; filename: string };
const field = "min-h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2";

export function RecipientAccountManager() {
  const [rows, setRows] = useState<EditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string; detail?: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRecipientAccounts()
      .then(data => setRows(data.map(row => ({ ...row, accountNumber: "" }))))
      .catch(error => setResult({ tone: "error", message: "Daftar penerima gagal dimuat.", detail: error instanceof Error ? error.message : "Kesalahan tidak dikenal." }))
      .finally(() => setLoading(false));
  }, []);

  const update = (id: string, patch: Partial<EditRow>) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(rows.map(row => ({
      "ID Penerima": row.id,
      "Nama Penerima": row.name,
      "Metode": row.method,
      "Kode Bank": row.bank_code || "",
      "Nama Bank": row.bank_name || "",
      "Nomor Rekening": "",
      "Pemilik Rekening": row.account_holder || "",
    })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Rekening Penerima");
    XLSX.writeFile(book, "template-rekening-penerima.xlsx");
  };

  const parseFile = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: "" });
      const known = new Map(rows.map(row => [row.id, row]));
      const imported: EditRow[] = [];
      const errors: string[] = [];
      raw.forEach((item, index) => {
        const line = index + 2;
        const id = String(item["ID Penerima"] || "").trim();
        const current = known.get(id);
        if (!current) { errors.push(`Baris ${line}: ID penerima tidak dikenal.`); return; }
        if (imported.some(row => row.id === id)) { errors.push(`Baris ${line}: ID penerima terduplikasi.`); return; }
        const method = String(item["Metode"] || current.method).trim().toUpperCase();
        if (!['CASH', 'TRANSFER'].includes(method)) { errors.push(`Baris ${line}: metode harus CASH atau TRANSFER.`); return; }
        const next: EditRow = {
          ...current,
          method: method as "CASH" | "TRANSFER",
          bank_code: String(item["Kode Bank"] || "").trim() || null,
          bank_name: String(item["Nama Bank"] || "").trim() || null,
          accountNumber: String(item["Nomor Rekening"] || "").replace(/\s/g, ""),
          account_holder: String(item["Pemilik Rekening"] || "").trim() || null,
        };
        if (next.method === "TRANSFER") {
          const codeError = bankCodeProblem(next.bank_code || "");
          if (codeError) errors.push(`Baris ${line}: ${codeError}`);
          if (!next.bank_name) errors.push(`Baris ${line}: nama bank wajib diisi.`);
          if (!next.account_holder) errors.push(`Baris ${line}: pemilik rekening wajib diisi.`);
          if (next.accountNumber) {
            const accountError = accountNumberProblem(next.accountNumber);
            if (accountError) errors.push(`Baris ${line}: ${accountError}`);
          } else if (!next.account_mask) errors.push(`Baris ${line}: nomor rekening belum tersimpan.`);
        }
        imported.push(next);
      });
      if (!raw.length) errors.push("File tidak memiliki baris data.");
      setPreview({ rows: imported, errors, filename: file.name });
    } catch (error) {
      setPreview({ rows: [], errors: [error instanceof Error ? error.message : "File tidak dapat dibaca."], filename: file.name });
    }
  };

  const save = () => startTransition(async () => {
    try {
      const payload: RecipientAccountRow[] = rows.map(row => ({
        id: row.id,
        method: row.method,
        bankCode: row.bank_code || "",
        bankName: row.bank_name || "",
        accountNumber: row.accountNumber,
        accountHolder: row.account_holder || "",
      }));
      const response = await saveRecipientAccounts(payload);
      if (!response.success) {
        setResult({ tone: "error", message: "Belum ada data yang disimpan.", detail: response.errors.slice(0, 8).map(error => `Baris ${error.row}: ${error.message}`).join(" ") });
        return;
      }
      setResult({ tone: "success", message: `${response.updated} rekening penerima disimpan.`, detail: "Nomor rekening baru sudah dienkripsi dan tabel hanya menampilkan empat digit terakhir." });
      const refreshed = await listRecipientAccounts();
      setRows(refreshed.map(row => ({ ...row, accountNumber: "" })));
    } catch (error) {
      setResult({ tone: "error", message: "Rekening penerima gagal disimpan.", detail: error instanceof Error ? error.message : "Kesalahan tidak dikenal." });
    }
  });

  return <SectionPanel title="Rekening penerima" description="Edit seluruh penerima sekaligus atau gunakan template Excel. Satu baris tidak valid membatalkan seluruh penyimpanan.">
    <div className="space-y-4 p-4">
      <ResultBanner result={result} onDismiss={() => setResult(null)} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void downloadTemplate()} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-bold"><DownloadSimple className="h-4 w-4" />Unduh template Excel</button>
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-bold"><UploadSimple className="h-4 w-4" />Import Excel</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void parseFile(file); event.currentTarget.value = ""; }} />
      </div>

      {preview ? <div className={`rounded-lg border p-3 text-sm ${preview.errors.length ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        <div className="flex items-start gap-2"><FileXls className="mt-0.5 h-5 w-5" /><div className="flex-1"><p className="font-bold">Pratinjau {preview.filename}</p><p className="text-xs">{preview.rows.length} baris dikenali. Belum ada data yang disimpan.</p>{preview.errors.length ? <ul className="mt-2 list-disc pl-5 text-xs">{preview.errors.slice(0, 12).map(error => <li key={error}>{error}</li>)}</ul> : null}</div></div>
        <div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" className="min-h-11 px-3 font-bold" onClick={() => setPreview(null)}>Batalkan</button><button type="button" disabled={preview.errors.length > 0} className="min-h-11 rounded-md bg-emerald-700 px-4 font-bold text-white disabled:opacity-40" onClick={() => { const imported = new Map(preview.rows.map(row => [row.id, row])); setRows(current => current.map(row => imported.get(row.id) || row)); setPreview(null); }}>Terapkan ke tabel</button></div>
      </div> : null}

      {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Memuat penerima...</p> : <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-slate-50"><tr><th className="px-3 py-2">Penerima</th><th className="px-3 py-2">Metode</th><th className="px-3 py-2">Kode bank</th><th className="px-3 py-2">Nama bank</th><th className="px-3 py-2">Nomor rekening</th><th className="px-3 py-2">Pemilik</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y">{rows.map(row => {
        const complete = row.method === "CASH" || Boolean(row.bank_code && row.bank_name && row.account_holder && (row.accountNumber || row.account_mask));
        return <tr key={row.id}><td className="px-3 py-2"><p className="font-bold text-slate-900">{row.name}</p><p className="text-slate-500">{row.id} · {row.kind}</p></td><td className="px-3 py-2"><select value={row.method} onChange={event => update(row.id, { method: event.target.value as "CASH" | "TRANSFER" })} className={field}><option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option></select></td><td className="px-3 py-2"><select disabled={row.method === "CASH"} value={row.bank_code || ""} onChange={event => { const bank = BANK_CODES.find(item => item.code === event.target.value); update(row.id, { bank_code: event.target.value || null, bank_name: bank?.name || row.bank_name }); }} className={field}><option value="">Pilih</option>{BANK_CODES.map(bank => <option key={bank.code} value={bank.code}>{bank.code}</option>)}</select></td><td className="px-3 py-2"><input disabled={row.method === "CASH"} value={row.bank_name || ""} onChange={event => update(row.id, { bank_name: event.target.value })} className={field} /></td><td className="px-3 py-2"><input disabled={row.method === "CASH"} inputMode="numeric" value={row.accountNumber} onChange={event => update(row.id, { accountNumber: event.target.value.replace(/\D/g, "").slice(0, 24) })} placeholder={row.account_mask || "Masukkan rekening"} className={field} /><p className="mt-1 text-[10px] text-slate-500">Kosong berarti pertahankan {row.account_mask || "rekening tersimpan"}.</p></td><td className="px-3 py-2"><input disabled={row.method === "CASH"} value={row.account_holder || ""} onChange={event => update(row.id, { account_holder: event.target.value })} className={field} /></td><td className="px-3 py-2"><span className={complete ? "font-bold text-emerald-800" : "font-bold text-amber-800"}>{complete ? "Lengkap" : "Belum lengkap"}</span></td></tr>;
      })}</tbody></table></div>}
      <div className="flex justify-end"><button type="button" disabled={pending || loading || !rows.length} onClick={save} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-50"><FloppyDisk className="h-4 w-4" />{pending ? "Menyimpan..." : "Simpan semua rekening"}</button></div>
    </div>
  </SectionPanel>;
}
