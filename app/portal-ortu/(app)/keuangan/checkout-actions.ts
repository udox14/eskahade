"use server";
import { requirePortalSessionAction } from "@/lib/portal/session";
import { createOrder } from "@/lib/finance/cooperative/orders";
import { revalidatePath } from "next/cache";
export async function paySelectedItems(input: {
  key: string;
  items: { billId: string; amount: number }[];
  jajan: number;
}) {
  try {
    const session = await requirePortalSessionAction();
    const order = await createOrder({
      ...input,
      santriId: session.santri_id,
      actorId: session.guardian_id || session.santri_id,
      channel: "VA",
    });
    revalidatePath("/portal-ortu/keuangan");
    return {
      success: true,
      message: "Bayar sesuai nominal pesanan melalui VA santri.",
      order,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Pembayaran belum dapat dibuat.",
    };
  }
}
