export const BILL_KINDS = ["SPP", "NON_SPP", "MAKAN", "LAUNDRY"] as const;
export type BillKind = (typeof BILL_KINDS)[number];
export const NON_SPP_CATEGORIES = ["BANGUNAN", "KESEHATAN", "EHB", "EKSKUL"] as const;
export type NonSppCategory = (typeof NON_SPP_CATEGORIES)[number];
export const EXEMPTION_ITEM_CODES = ["SPP", "MAKAN", "LAUNDRY", ...NON_SPP_CATEGORIES] as const;
export type ExemptionItemCode = (typeof EXEMPTION_ITEM_CODES)[number];
export type RecipientKind = "PESANTREN" | "MAKAN" | "LAUNDRY";
export type FeeBearer = "KOPERASI" | "PENERIMA";
export type PaymentPolicy = "FULL" | "INSTALLMENT";
export type Channel = "CASH" | "VA";
export type Bill = {
  id: string;
  santri_id: string;
  kind: BillKind;
  category_code?: NonSppCategory | null;
  academic_year_id?: string | null;
  academic_year_label?: string | null;
  cohort_year?: number | null;
  title: string;
  period_key: string | null;
  amount: number;
  paid: number;
  recipient_id: string;
  status: string;
  full_name?: string;
  module_code?: string | null;
};
export type OrderItem = {
  id: string;
  order_id: string;
  bill_id: string | null;
  kind: BillKind | "JAJAN";
  title: string;
  recipient_id: string | null;
  amount: number;
  policy: PaymentPolicy;
  module_code?: string | null;
};
export type Order = {
  id: string;
  request_key: string;
  santri_id: string;
  channel: Channel;
  amount: number;
  fee: number;
  total: number;
  status: string;
  expires_at: string;
  journal_id: string | null;
  va_number: string | null;
  created_at: string;
};
export type Recipient = {
  id: string;
  source_id: string | null;
  kind: RecipientKind;
  name: string;
  method: "CASH" | "TRANSFER";
  bank_name: string | null;
  bank_code: string | null;
  account_mask: string | null;
  account_holder: string | null;
  balance: number;
};
export type Settings = {
  paymentPolicy: PaymentPolicy;
  overrides: Partial<Record<BillKind, PaymentPolicy>>;
  transferFeeBearer: FeeBearer;
  gatewayFee: number;
  onlineEnabled: boolean;
};
export const DEFAULT_SETTINGS: Settings = {
  paymentPolicy: "FULL",
  overrides: {},
  transferFeeBearer: "KOPERASI",
  gatewayFee: 0,
  onlineEnabled: false,
};
export function rupiah(value: number, zero = false): number {
  if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1))
    throw new Error("Nominal harus rupiah bulat yang valid.");
  return value;
}
export function policyFor(settings: Settings, kind: BillKind): PaymentPolicy {
  return settings.overrides[kind] ?? settings.paymentPolicy;
}
export function validatePayment(
  amount: number,
  remaining: number,
  policy: PaymentPolicy,
) {
  rupiah(amount);
  if (amount > remaining || (policy === "FULL" && amount !== remaining))
    throw new Error(
      policy === "FULL"
        ? "Item ini harus dibayar lunas."
        : "Nominal melebihi sisa tagihan.",
    );
}
