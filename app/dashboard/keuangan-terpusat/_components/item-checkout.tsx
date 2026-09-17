"use client";
import { useState, useTransition } from "react";
import { QrCamera } from './qr-camera';
import { useRouter } from "next/navigation";
import { StudentField, inputClass, buttonClass, money } from "./cooperative-ui";
import {
  studentCheckout,
  coopAction,
  scanCoopStudent,
} from "../cooperative-actions";
import {
  policyFor,
  type Bill,
  type Settings,
  type Order,
} from "@/lib/finance/cooperative/types";
type Pay = (input: {
  key: string;
  items: { billId: string; amount: number }[];
  jajan: number;
}) => Promise<{ success: boolean; message: string; order?: Order }>;
export function Checkout({
  shiftId,
  initialBills,
  config,
  pay,
}: {
  shiftId?: string;
  initialBills?: Bill[];
  config?: Settings;
  pay?: Pay;
}) {
  const [student, setStudent] = useState(""),
    [name, setName] = useState(""),
    [bills, setBills] = useState(initialBills || []),
    [settings, setSettings] = useState(config),
    [selected, setSelected] = useState<Record<string, number>>({}),
    [jajan, setJajan] = useState(0),
    [message, setMessage] = useState(""),
    [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info"),
    [pending, start] = useTransition(),
    [order, setOrder] = useState<Order | null>(null),
    [token, setToken] = useState(""),
    [pin, setPin] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [withdraw, setWithdraw] = useState(0),
    [photo, setPhoto] = useState<string | null>(null),
    [key, setKey] = useState(() => crypto.randomUUID()),
    router = useRouter();
  function choose(id: string, label: string) {
    setStudent(id);
    setName(label);
    setSelected({});
    setKey(crypto.randomUUID());
    start(async () => {
      try {
        const data = await studentCheckout(id);
        setBills(data.bills);
        setSettings(data.settings);
        setMessageTone("info");
        setMessage("Saldo jajan: " + money(data.balance));
      } catch (e) {
        setMessageTone("error");
        setMessage(e instanceof Error ? e.message : "Gagal memuat");
      }
    });
  }
  const sum = Object.values(selected).reduce((s, v) => s + v, 0) + jajan,
    fee = pay ? settings?.gatewayFee || 0 : 0;
  return (
    <section className="space-y-4 rounded-lg border bg-white p-4 sm:p-5">
      <h2 className="text-lg font-bold">
        {pay ? "Pilih pembayaran" : "Pembayaran & layanan santri"}
      </h2>
      {!pay && (
        <>
          <StudentField onSelect={choose} />
          <details className="rounded-lg border p-3">
            <summary className="min-h-11 cursor-pointer py-2 font-medium">
              Pindai kartu untuk penarikan
            </summary>
            <div className="space-y-3">
<QrCamera onScan={value=>{setToken(value);setConfirmed(false)}}/>
              <input
                aria-label="Token QR"
                className={inputClass}
                placeholder="Pindai dengan scanner QR"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setConfirmed(false);
                }}
              />
              <button
                type="button"
                className={buttonClass}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      const s = await scanCoopStudent(token);
                      if (!s) throw new Error("Santri tidak ditemukan");
                      setPhoto(s.foto_url);
                      choose(s.id, s.nama_lengkap);
                    } catch (e) {
                      setMessageTone("error");
                      setMessage(
                        e instanceof Error ? e.message : "QR tidak valid",
                      );
                    }
                  })
                }
              >
                Kenali kartu
              </button>
              {name && <p className="font-medium">{name}</p>}
              {photo && (
                <img
                  src={photo}
                  alt="Foto identitas santri"
                  className="h-24 w-20 rounded-md object-cover"
                />
              )}
              <input
                aria-label="PIN santri"
                className={inputClass}
                type="password"
                inputMode="numeric"
                placeholder="PIN santri"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
              <input
                aria-label="Nominal penarikan"
                className={inputClass}
                type="number"
                min="1"
                placeholder="Nominal penarikan"
                value={withdraw || ""}
                onChange={(e) => setWithdraw(Number(e.target.value))}
              />
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Identitas sesuai dengan pemilik kartu
              </label>
              <button
                type="button"
                className={buttonClass}
                disabled={pending || !confirmed || !pin || !token || !withdraw}
                onClick={() =>
                  start(async () => {
                    const f = new FormData();
                    Object.entries({
                      action: "withdraw",
                      key,
                      token,
                      pin,
                      amount: String(withdraw),
                      shiftId: shiftId || "",
                      confirmed: "yes",
                    }).forEach(([k, v]) => f.set(k, v));
                    const r = await coopAction(f);
                    setMessageTone(r.success ? "success" : "error");
                    setMessage(r.message);
                    setPin("");
                    if (r.success) {
                      setKey(crypto.randomUUID());
                      setConfirmed(false);
                      router.refresh();
                    }
                  })
                }
              >
                Cairkan uang jajan
              </button>
            </div>
          </details>
        </>
      )}
      <div className="divide-y rounded-lg border">
        {bills.map((b) => (
          <label key={b.id} className="flex flex-wrap items-center gap-3 p-4">
            <input
              type="checkbox"
              aria-label={"Bayar " + b.title}
              className="h-5 w-5"
              checked={b.id in selected}
              onChange={(e) => {
                setSelected((s) => {
                  const next = { ...s };
                  if (e.target.checked) next[b.id] = b.amount - b.paid;
                  else delete next[b.id];
                  return next;
                });
                setKey(crypto.randomUUID());
              }}
            />
            <span className="min-w-0 flex-1">
              <strong className="block text-sm">{b.title}</strong>
              <span className="text-xs text-slate-500">
                Sisa {money(b.amount - b.paid)}
              </span>
            </span>
            {settings &&
            policyFor(settings, b.kind) === "INSTALLMENT" &&
            b.id in selected ? (
              <input
                aria-label={"Nominal " + b.title}
                className={inputClass + " max-w-36"}
                type="number"
                min="1"
                max={b.amount - b.paid}
                value={selected[b.id]}
                onChange={(e) => {
                  setSelected((s) => ({
                    ...s,
                    [b.id]: Number(e.target.value),
                  }));
                  setKey(crypto.randomUUID());
                }}
              />
            ) : (
              <span className="text-sm font-semibold">
                {money(b.amount - b.paid)}
              </span>
            )}
          </label>
        ))}
        {!bills.length && (
          <p className="p-4 text-sm text-slate-500">
            Tidak ada tagihan terbuka.
          </p>
        )}
      </div>
      <label className="block text-sm font-medium">
        Uang jajan / setoran santri (Rp)
        <input
          className={inputClass + " mt-2"}
          type="number"
          min="0"
          value={jajan || ""}
          onChange={(e) => {
            setJajan(Number(e.target.value));
            setKey(crypto.randomUUID());
          }}
          placeholder="0"
        />
      </label>
      {message && (
        <p
          role={messageTone === "error" ? "alert" : "status"}
          className={
            "rounded-lg p-3 text-sm break-words " +
            (messageTone === "error"
              ? "bg-red-50 text-red-900"
              : messageTone === "success"
                ? "bg-emerald-50 text-emerald-900"
                : "bg-slate-100 text-slate-800")
          }
        >
          {message}
        </p>
      )}
      {order && (
        <div className="rounded-lg bg-emerald-50 p-4">
          <p>VA tetap santri</p>
          <strong className="block break-all text-xl">
            {order.va_number || "Sedang disiapkan"}
          </strong>
          <p>Bayar tepat {money(order.total)}</p>
          <p className="text-sm">Status: {order.status}</p>
        </div>
      )}
      <footer className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-lg md:bottom-2">
        <div>
          <p className="text-xs text-slate-500">
            Total {fee > 0 ? "(biaya " + money(fee) + ")" : ""}
          </p>
          <strong className="text-lg">{money(sum + fee)}</strong>
        </div>
        <button
          type="button"
          className={buttonClass}
          disabled={pending || sum <= 0 || (!pay && !student) || !!order}
          onClick={() =>
            start(async () => {
              try {
                const items = Object.entries(selected).map(
                  ([billId, amount]) => ({ billId, amount }),
                );
                if (pay) {
                  const r = await pay({ key, items, jajan });
                  setMessageTone(r.success ? "success" : "error");
                  setMessage(r.message);
                  if (r.order) setOrder(r.order);
                } else {
                  const f = new FormData();
                  Object.entries({
                    action: "checkout",
                    key,
                    santriId: student,
                    items: JSON.stringify(items),
                    jajan: String(jajan),
                    shiftId: shiftId || "",
                  }).forEach(([k, v]) => f.set(k, v));
                  const r = await coopAction(f);
                  setMessageTone(r.success ? "success" : "error");
                  setMessage(r.message);
                  if (r.success) {
                    setSelected({});
                    setJajan(0);
                    setKey(crypto.randomUUID());
                    choose(student, name);
                    router.refresh();
                  }
                }
              } catch (e) {
                setMessageTone("error");
                setMessage(e instanceof Error ? e.message : "Pembayaran gagal");
              }
            })
          }
        >
          {pending
            ? "Memproses..."
            : pay
              ? "Buat pembayaran"
              : "Uang diterima | Catat"}
        </button>
      </footer>
    </section>
  );
}
