import { loadModuleWorkspace } from "@/lib/finance/module-workspace";
import { isPaymentModuleCode, requireModuleAccess } from "@/lib/finance/modules";

const ALLOWED_SECTIONS = ["tagihan", "pembayaran", "penyaluran", "laporan"];

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const moduleCode = params.get("module") || "";
  const section = params.get("section") || "";
  if (!isPaymentModuleCode(moduleCode) || !ALLOWED_SECTIONS.includes(section)) {
    return new Response("Parameter ekspor tidak valid.", { status: 400 });
  }
  let access;
  try {
    access = await requireModuleAccess(moduleCode, "EXPORT");
  } catch {
    return new Response("Tidak berwenang.", { status: 403 });
  }
  const data = await loadModuleWorkspace({
    moduleCode,
    section,
    requestedPeriod: params.get("period") || undefined,
    annualFeeType: params.get("annualFeeType") || undefined,
    requestedStatus: params.get("status") || undefined,
    userId: access.session.id,
  });
  const columns = data.rows[0] ? Object.keys(data.rows[0]) : [];
  const lines = [
    columns.map(csvCell).join(","),
    ...data.rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ];
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${moduleCode.toLowerCase()}-${section}.csv"`,
      "cache-control": "no-store",
    },
  });
}
