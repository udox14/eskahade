import { generateMonthlyBills } from "../lib/finance/cooperative/billing-core";
export default {
  async fetch() {
    return Response.json({
      ok: true,
      worker: "service-billing-auto",
      domain: "cooperative",
    });
  },
  async scheduled(
    _controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const month =
      parts.find((p) => p.type === "year")!.value +
      "-" +
      parts.find((p) => p.type === "month")!.value;
    ctx.waitUntil(
      generateMonthlyBills(env.DB, env.FINANCE_DB, month, "SYSTEM_BILLING")
        .then((result) => {
          console.log(
            JSON.stringify({ event: "cooperative_billing", month, ...result }),
          );
        })
        .catch((error) => {
          console.error(
            JSON.stringify({
              event: "cooperative_billing_failed",
              month,
              message: error instanceof Error ? error.message : "Unknown",
            }),
          );
          throw error;
        }),
    );
  },
};
