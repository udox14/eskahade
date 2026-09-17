import type { JournalEntryInput, FinanceAccountCode } from "../types";
import type { BillKind, RecipientKind } from "./types";
const BANK: FinanceAccountCode = "1101",
  CASH: FinanceAccountCode = "1104",
  CLEARING: FinanceAccountCode = "1102";
const liability = (
  kind: BillKind | RecipientKind | "JAJAN",
): FinanceAccountCode =>
  kind === "MAKAN"
    ? "2102"
    : kind === "LAUNDRY"
      ? "2103"
      : kind === "JAJAN"
        ? "2105"
        : "2106";
export function receiptEntries(
  santriId: string,
  channel: "VA" | "CASH",
  items: {
    kind: BillKind | "JAJAN";
    amount: number;
    recipient_id: string | null;
  }[],
  fee: number,
): JournalEntryInput[] {
  return [
    {
      accountCode: channel === "VA" ? CLEARING : CASH,
      side: "DEBIT",
      amountRupiah: items.reduce((s, i) => s + i.amount, fee),
      santriId,
    },
    ...items.map((i) => ({
      accountCode: liability(i.kind),
      side: "CREDIT" as const,
      amountRupiah: i.amount,
      santriId,
      counterpartyId: i.recipient_id,
    })),
    ...(fee
      ? [
          {
            accountCode: "4104" as const,
            side: "CREDIT" as const,
            amountRupiah: fee,
          },
        ]
      : []),
  ];
}
export function distributionEntries(
  kind: RecipientKind,
  recipientId: string,
  gross: number,
  fee: number,
  bearer: string,
  method: string,
): JournalEntryInput[] {
  return [
    {
      accountCode: liability(kind),
      side: "DEBIT",
      amountRupiah: gross,
      counterpartyId: recipientId,
    },
    ...(fee && bearer === "KOPERASI"
      ? [
          {
            accountCode: "5101" as const,
            side: "DEBIT" as const,
            amountRupiah: fee,
          },
        ]
      : []),
    {
      accountCode: method === "CASH" ? CASH : BANK,
      side: "CREDIT",
      amountRupiah: gross + (bearer === "KOPERASI" ? fee : 0),
    },
  ];
}
export function expenseEntries(
  amount: number,
  method: string,
): JournalEntryInput[] {
  return [
    { accountCode: "5101", side: "DEBIT", amountRupiah: amount },
    {
      accountCode: method === "CASH" ? CASH : BANK,
      side: "CREDIT",
      amountRupiah: amount,
    },
  ];
}
export function fundingEntries(
  amount: number,
  toCash: boolean,
): JournalEntryInput[] {
  return [
    { accountCode: toCash ? CASH : BANK, side: "DEBIT", amountRupiah: amount },
    { accountCode: toCash ? BANK : CASH, side: "CREDIT", amountRupiah: amount },
  ];
}
