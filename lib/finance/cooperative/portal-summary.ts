import { financeQuery } from "@/lib/db";
export async function getPortalOpenBills(santriId: string, kind: string) {
  return financeQuery<{
    id: string;
    title: string;
    amount_rupiah: number;
    period_key: string | null;
  }>(
    "SELECT id,title,amount-paid amount_rupiah,period_key FROM finance_coop_bills WHERE santri_id=? AND kind=? AND status IN ('OPEN','PARTIAL')",
    [santriId, kind],
  );
}
