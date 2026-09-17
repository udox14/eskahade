import { createHash, createHmac, sign, verify } from "node:crypto";
import { getFinanceDB, financeQueryOne } from "@/lib/db";
import { isDemoRequest } from "@/lib/auth/demo-context";
type Va = {
  santri_id: string;
  va_number: string;
  customer_no: string;
  provider_trx_id: string | null;
  status: string;
};
const required = (key: string) => {
  const v = process.env[key];
  if (!v) throw new Error(key + " belum dikonfigurasi.");
  return v;
};
const host = () =>
  process.env.DUITKU_PRODUCTION === "true"
    ? "https://snap.duitku.com"
    : "https://snapdev.duitku.com";
export function symmetricSignature(
  method: string,
  path: string,
  token: string,
  body: unknown,
  time: string,
  secret: string,
) {
  return createHmac("sha512", secret)
    .update(
      [
        method,
        path,
        token,
        createHash("sha256").update(JSON.stringify(body)).digest("hex"),
        time,
      ].join(":"),
    )
    .digest("base64");
}
export function verifySnapNotification(
  body: unknown,
  path: string,
  time: string,
  signature: string,
  publicKey: string,
) {
  try {
    return verify(
      "RSA-SHA256",
      Buffer.from(
        [
          "POST",
          path,
          createHash("sha256").update(JSON.stringify(body)).digest("hex"),
          time,
        ].join(":"),
      ),
      publicKey,
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}
async function jsonRequest(
  path: string,
  method: string,
  body: unknown,
  headers: Record<string, string>,
) {
  const response = await fetch(host() + path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok || !String(data.responseCode || "").startsWith("200"))
    throw new Error(
      "Duitku: " + String(data.responseMessage || response.status),
    );
  return data;
}
export async function snapRequest(path: string, method: string, body: unknown) {
  const partner = required("DUITKU_SNAP_PARTNER_ID"),
    time = new Date().toISOString();
  const token = await jsonRequest(
    "/auth/v1.0/access-token/b2b",
    "POST",
    { grantType: "client_credentials" },
    {
      "X-CLIENT-KEY": partner,
      "X-TIMESTAMP": time,
      "X-SIGNATURE": sign(
        "RSA-SHA256",
        Buffer.from(partner + "|" + time),
        required("DUITKU_SNAP_PRIVATE_KEY").replace(/\\n/g, "\n"),
      ).toString("base64"),
    },
  );
  if (typeof token.accessToken !== "string")
    throw new Error("Token SNAP tidak valid.");
  const timestamp = new Date().toISOString();
  return jsonRequest(path, method, body, {
    "X-PARTNER-ID": partner,
    "X-TIMESTAMP": timestamp,
    "X-EXTERNAL-ID": crypto.randomUUID().replaceAll("-", ""),
    "CHANNEL-ID": "DUITKU",
    Authorization: "Bearer " + token.accessToken,
    "X-SIGNATURE": symmetricSignature(
      method,
      path,
      token.accessToken,
      body,
      timestamp,
      required("DUITKU_SNAP_CLIENT_SECRET"),
    ),
  });
}
export async function activateVa(
  santriId: string,
  name: string,
  orderId: string,
  total: number,
  expiry: string,
) {
  const db = (await getFinanceDB()) as D1Database,
    demo = await isDemoRequest();
  const va = await financeQueryOne<Va>(
    "SELECT * FROM finance_student_va WHERE santri_id=?",
    [santriId],
  );
  if (!va) throw new Error("Nomor VA santri belum diterbitkan di Pengaturan.");
  // A fresh provider transaction is associated with every order. Never reuse an old trxId for another payment.
  if (!demo) {
    const result = await snapRequest(
      "/merchant/va/v1.0/transfer-va/create-va",
      "POST",
      {
        partnerServiceId: required("DUITKU_SNAP_VA_PREFIX"),
        customerNo: va.customer_no,
        virtualAccountNo: va.va_number,
        virtualAccountName: name.slice(0, 20),
        trxId: orderId,
        totalAmount: { value: total.toFixed(2), currency: "IDR" },
        virtualAccountTrxType: "C",
        expiredDate: expiry,
      },
    );
    const data = result.virtualAccountData as
      | {
          virtualAccountNo?: string;
          trxId?: string;
          totalAmount?: { value: string };
        }
      | undefined;
    if (
      data?.virtualAccountNo !== va.va_number ||
      data?.trxId !== orderId ||
      Number(data?.totalAmount?.value) !== total
    )
      throw new Error("Respons VA tidak cocok dengan pesanan.");
  }
  await db.batch([
    db
      .prepare(
        "UPDATE finance_student_va SET provider_trx_id=?,status='ACTIVE',updated_at=datetime('now') WHERE santri_id=?",
      )
      .bind(orderId, santriId),
    db
      .prepare("UPDATE finance_orders SET va_number=? WHERE id=?")
      .bind(va.va_number, orderId),
  ]);
  return va.va_number;
}
export async function deleteVa(santriId: string, orderId: string) {
  const va = await financeQueryOne<Va>(
    "SELECT * FROM finance_student_va WHERE santri_id=?",
    [santriId],
  );
  if (!va) throw new Error("VA belum dapat dipastikan; periksa provider.");
  if (!(await isDemoRequest()))
    await snapRequest("/merchant/va/v1.0/transfer-va/delete-va", "DELETE", {
      partnerServiceId: required("DUITKU_SNAP_VA_PREFIX"),
      customerNo: va.customer_no,
      virtualAccountNo: va.va_number,
      trxId: orderId,
    });
  await (await getFinanceDB())
    .prepare(
      "UPDATE finance_student_va SET status='INACTIVE' WHERE santri_id=?",
    )
    .bind(santriId)
    .run();
}
export async function inquireVa(santriId: string, orderId: string) {
  if (await isDemoRequest())
    return {
      responseCode: "2002600",
      responseMessage: "Demo: pembayaran disimulasikan di loket.",
    };
  const va = await financeQueryOne<Va>(
    "SELECT * FROM finance_student_va WHERE santri_id=?",
    [santriId],
  );
  if (!va) throw new Error("VA tidak ditemukan.");
  return snapRequest("/merchant/va/v1.0/transfer-va/status", "POST", {
    partnerServiceId: required("DUITKU_SNAP_VA_PREFIX"),
    customerNo: va.customer_no,
    virtualAccountNo: va.va_number,
    trxId: orderId,
    inquiryRequestId: crypto.randomUUID().replaceAll("-", "").slice(0, 20),
  });
}
