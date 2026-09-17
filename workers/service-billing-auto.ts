import { generateMonthlyBills } from "../lib/finance/cooperative/billing-core";
import { generateNonSppBills } from "../lib/finance/cooperative/non-spp-billing";
const billingWorker = {
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
      Promise.all([
        generateMonthlyBills(env.DB, env.FINANCE_DB, month, "SYSTEM_BILLING"),
        generateNonSppBills(
          env.DB,
          env.FINANCE_DB,
          "SYSTEM_BILLING",
          month.endsWith("-07"),
        ),
      ])
        .then(([monthly, nonSpp]) => {
          console.log(
            JSON.stringify({
              event: "cooperative_billing",
              month,
              monthly,
              nonSpp,
            }),
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

export default billingWorker;
