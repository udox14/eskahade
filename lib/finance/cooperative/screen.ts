import { financeQuery as q, financeQueryOne as one } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { recipientScope, scopeSql, settings } from "./data";
import { financeRoles } from "../access";
export type ScreenView =
  | "home"
  | "bills"
  | "distributions"
  | "reports"
  | "settings"
  | "cashier";
export type Cell = string | number | null;
export type Row = Record<string, Cell>;
export type Column = { key: string; label: string; money?: boolean };
export type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  value?: string;
};
export type FormSpec = { action: string; title: string; fields: Field[] };
export type ScreenData = {
  view: ScreenView;
  title: string;
  description: string;
  columns: Column[];
  rows: Row[];
  total: number;
  page: number;
  search: string;
  from: string;
  to: string;
  sort: string;
  dir: string;
  forms: FormSpec[];
  canWrite: boolean;
  canConfigure: boolean;
  recipients: { value: string; label: string }[];
  shift: Row | null;
  metrics: { label: string; amount: number }[];
};
const amount = {
  name: "amount",
  label: "Nominal (Rp)",
  type: "number",
  required: true,
};
const note = { name: "note", label: "Keterangan", required: true };
const student = {
  name: "santriId",
  label: "Santri",
  type: "student",
  required: true,
};
const method = {
  name: "method",
  label: "Metode",
  options: [
    { value: "CASH", label: "Tunai" },
    { value: "TRANSFER", label: "Transfer manual" },
  ],
};
const kind = {
  name: "kind",
  label: "Jenis",
  options: ["SPP", "NON_SPP", "MAKAN", "LAUNDRY"].map((x) => ({
    value: x,
    label: x,
  })),
};
const period = {
  name: "period",
  label: "Bulan",
  type: "month",
  required: true,
};
const policyOptions = [
  { value: "FULL", label: "Wajib lunas per item" },
  { value: "INSTALLMENT", label: "Boleh cicilan" },
];
export async function loadScreen(
  view: ScreenView,
  session: SessionUser,
  params: { q?: string; p?: string; sort?: string; dir?: string; from?: string; to?: string },
): Promise<ScreenData> {
  const roles = financeRoles(session),
    canWrite = roles.admin || roles.operator,
    scope = await recipientScope(session),
    s = scopeSql(scope, "r.id");
  const recipients = (
    await q<{ id: string; name: string }>(
      "SELECT r.id,r.name FROM finance_coop_recipients r WHERE 1=1" +
        s.sql +
        " ORDER BY name",
      s.params,
    )
  ).map((r) => ({ value: r.id, label: r.name }));
  const recipient = {
    name: "recipientId",
    label: "Penerima",
    options: recipients,
    required: true,
  };
  const shift = canWrite
    ? await one<Row>(
        "SELECT sh.*,cu.name unit_name,sh.opening_cash_rupiah+COALESCE((SELECT SUM(amount) FROM finance_cash_entries WHERE shift_id=sh.id),0) expected FROM finance_cash_shifts sh JOIN finance_cash_units cu ON cu.id=sh.cash_unit_id WHERE operator_id=? AND status='OPEN'",
        [session.id],
      )
    : null;
  const data: ScreenData = {
    view,
    title: "Keuangan Terpusat",
    description: "Penerimaan dan penyerahan dana melalui koperasi.",
    columns: [],
    rows: [],
    total: 0,
    page: Math.max(1, Math.floor(Number(params.p) || 1)),
    search: (params.q || "").slice(0, 100),
    from: /^\d{4}-\d{2}-\d{2}$/.test(params.from||'')?params.from!:new Date().getFullYear()+'-01-01',
    to: /^\d{4}-\d{2}-\d{2}$/.test(params.to||'')?params.to!:new Date().getFullYear()+'-12-31',
    sort: params.sort||'',dir:params.dir||'desc',
    forms: [],
    canWrite,
    canConfigure: roles.admin,
    recipients,
    shift,
    metrics: [],
  };
  let sql = "",
    values: unknown[] = [],
    searchColumns: string[] = [];
  if (view === "home") {
    data.title = "Ringkasan Keuangan";
    data.description = "Kondisi utama dan aktivitas penerimaan dana terbaru.";
    const oscope = scopeSql(scope, "i.recipient_id");
    sql = `SELECT o.id,o.created_at waktu,s.full_name santri,o.channel kanal,o.total nominal,o.status
      FROM finance_orders o LEFT JOIN finance_student_snapshots s ON s.santri_id=o.santri_id
      ${scope === null ? "" : `WHERE EXISTS(SELECT 1 FROM finance_order_items i WHERE i.order_id=o.id${oscope.sql})`}`;
    values = scope === null ? [] : oscope.params;
    searchColumns = ["waktu", "santri", "kanal", "status"];
    data.columns = [
      { key: "waktu", label: "Waktu" },
      { key: "santri", label: "Santri" },
      { key: "kanal", label: "Kanal" },
      { key: "nominal", label: "Nominal", money: true },
      { key: "status", label: "Status" },
    ];
  } else if (view === "bills") {
    data.title = "Tagihan & Pembayaran";
    data.description = "Kelola tarif, batch, pembebasan, dan pengecualian tagihan per santri.";
    const bscope = scopeSql(scope, "b.recipient_id");
    sql = `SELECT b.id,s.full_name santri,s.asrama,b.title,
      CASE WHEN b.kind='NON_SPP' AND b.category_code IS NULL THEN 'Non-SPP lama'
           WHEN b.category_code='EKSKUL' THEN 'Ekskul'
           WHEN b.category_code IS NOT NULL THEN upper(substr(b.category_code,1,1))||lower(substr(b.category_code,2))
           ELSE b.kind END category,
      r.name penerima,b.amount,b.paid,b.amount-b.paid remaining,
      CASE WHEN b.exemption_rule_id IS NOT NULL THEN 'DIBEBASKAN' ELSE b.status END status
      FROM finance_coop_bills b LEFT JOIN finance_student_snapshots s ON s.santri_id=b.santri_id
      JOIN finance_coop_recipients r ON r.id=b.recipient_id WHERE 1=1${bscope.sql}`;
    values = bscope.params;
    searchColumns = ["santri", "asrama", "title", "category", "status"];
    data.columns = [
      { key: "santri", label: "Santri" },
      { key: "title", label: "Tagihan" },
      { key: "category", label: "Kategori" },
      { key: "penerima", label: "Penerima" },
      { key: "amount", label: "Tagihan", money: true },
      { key: "remaining", label: "Sisa", money: true },
      { key: "status", label: "Status" },
    ];
    if (roles.admin)
      data.forms = [
        {
          action: "bill",
          title: "Pembuatan individual",
          fields: [
            student,
            kind,
            {
              name: "category",
              label: "Kategori Non-SPP",
              options: [
                { value: "", label: "Tidak berlaku untuk jenis lain" },
                { value: "BANGUNAN", label: "Bangunan" },
                { value: "KESEHATAN", label: "Kesehatan" },
                { value: "EHB", label: "EHB" },
                { value: "EKSKUL", label: "Ekskul" },
              ],
            },
            { name: "title", label: "Nama tagihan", required: true },
            amount,
            period,
          ],
        },
        { action: "generate", title: "Generate bulanan", fields: [period] },
        {
          action: "tariff",
          title: "Tambah tarif berkala",
          fields: [
            kind,
            { name: "title", label: "Nama tarif", required: true },
            amount,
            period,
          ],
        },
      ];
  } else if (view === "distributions") {
    data.title = "Dana Penerima & Pencairan";
    data.description =
      "Hak tercatat otomatis. Petugas menyerahkan dana secara tunai atau transfer manual.";
    sql = `SELECT r.id,r.name,r.kind,r.method,r.bank_name,r.account_mask,COALESCE((SELECT SUM(amount-paid) FROM finance_entitlements e WHERE e.recipient_id=r.id AND reversed=0),0) balance FROM finance_coop_recipients r WHERE 1=1${s.sql}`;
    values = s.params;
    searchColumns = ["name", "kind"];
    data.columns = [
      { key: "name", label: "Penerima" },
      { key: "kind", label: "Pos" },
      { key: "method", label: "Metode pilihan" },
      { key: "account_mask", label: "Rekening" },
      { key: "balance", label: "Belum dicairkan", money: true },
    ];
    if (canWrite)
      data.forms = [
        {
          action: "distribution",
          title: "Buat pencairan",
          fields: [
            recipient,
            amount,
            {
              name: "fee",
              label: "Biaya transfer (Rp)",
              type: "number",
              value: "0",
            },
            method,
          ],
        },
        {
          action: "finish",
          title: "Catat penyerahan",
          fields: [
            { name: "id", label: "Nomor pencairan", required: true },
            {
              name: "reference",
              label: "Referensi transfer / kuitansi",
              required: true,
            },
            { name: "receivedBy", label: "Nama penerima", required: true },
            {
              name: "proof",
              label: "Tautan bukti transfer (HTTPS)",
              type: "url",
            },
          ],
        },
      ];
  } else if (view === "reports") {
    data.title = "Transaksi & Laporan";
    data.description = "Riwayat pembayaran, pencairan, dan jejak pembukuan.";
    if (scope === null) {
      sql = `SELECT j.id,j.effective_date tanggal,j.description keterangan,j.source_type jenis,COALESCE((SELECT SUM(amount_rupiah) FROM finance_journal_entries WHERE journal_id=j.id AND side='DEBIT'),0) amount,j.status FROM finance_journals j WHERE j.status='POSTED' AND j.effective_date BETWEEN ? AND ?`
      values=[data.from,data.to];
      searchColumns = ["tanggal", "keterangan", "jenis"];
      data.columns = [
        { key: "tanggal", label: "Tanggal" },
        { key: "keterangan", label: "Keterangan" },
        { key: "jenis", label: "Jenis" },
        { key: "amount", label: "Nominal", money: true },
        { key: "status", label: "Status" },
      ];
    } else {
      const ds = scopeSql(scope, "d.recipient_id");
      sql =
        "SELECT d.id,d.created_at tanggal,r.name penerima,d.gross,d.fee,d.net,d.status FROM finance_distributions d JOIN finance_coop_recipients r ON r.id=d.recipient_id WHERE 1=1" +
        ds.sql;
      values = ds.params;
      searchColumns = ["tanggal", "penerima", "status"];
      data.columns = [
        { key: "tanggal", label: "Tanggal" },
        { key: "penerima", label: "Penerima" },
        { key: "gross", label: "Hak bruto", money: true },
        { key: "fee", label: "Biaya", money: true },
        { key: "net", label: "Diterima", money: true },
        { key: "status", label: "Status" },
      ];
    }
    if (canWrite)
      data.forms = [
        {
          action: "settlement",
          title: "Catat settlement gateway",
          fields: [
            {
              name: "gross",
              label: "Bruto gateway (Rp)",
              type: "number",
              required: true,
            },
            {
              name: "net",
              label: "Masuk rekening (Rp)",
              type: "number",
              required: true,
            },
            {
              name: "fee",
              label: "Biaya provider (Rp)",
              type: "number",
              required: true,
            },
            { name: "reference", label: "Referensi bank", required: true },
          ],
        },
        {
          action: "reconciliation",
          title: "Rekonsiliasi rekening",
          fields: [
            period,
            { ...amount, label: "Saldo rekening aktual (Rp)" },
            {
              name: "reference",
              label: "Referensi mutasi bank",
              required: true,
            },
            note,
          ],
        },
        {
          action: "refund",
          title: "Koreksi / pengembalian pembayaran",
          fields: [
            { name: "id", label: "Nomor pesanan", required: true },
            {
              name: "reference",
              label: "Bukti pengembalian uang",
              required: true,
            },
            note,
          ],
        },
        {
          action: "cancelDistribution",
          title: "Batalkan draft pencairan",
          fields: [
            { name: "id", label: "Nomor pencairan", required: true },
            note,
          ],
        },
        {
          action: "expense",
          title: "Catat pengeluaran",
          fields: [amount, method, note],
        },
        {
          action: "funding",
          title: "Isi kas dari rekening",
          fields: [amount, note],
        },
        {
          action: "inquiry",
          title: "Periksa pembayaran VA",
          fields: [{ name: "id", label: "Nomor pesanan", required: true }],
        },
        {
          action: "cancelOrder",
          title: "Batalkan pesanan aktif",
          fields: [{ name: "id", label: "Nomor pesanan", required: true }],
        },
      ];
  } else if (view === "settings") {
    if (!roles.admin) throw new Error("Pengaturan hanya untuk admin.");
    data.title = "Pengaturan Keuangan";
    data.description =
      "Kebijakan koperasi, rekening, VA santri, dan akses pengelola.";
    sql =
      "SELECT santri_id id,va_number,customer_no,status FROM finance_student_va";
    searchColumns = ["id", "va_number"];
    data.columns = [
      { key: "id", label: "ID Santri" },
      { key: "va_number", label: "VA tetap" },
      { key: "status", label: "Status" },
    ];
    const config = await settings();
    data.forms = [
      {
        action: "settings",
        title: "Kebijakan pembayaran",
        fields: [
          {
            name: "policy",
            label: "Pembayaran default",
            options: policyOptions,
            value: config.paymentPolicy,
          },
          ...["SPP", "NON_SPP", "MAKAN", "LAUNDRY"].map((k) => ({
            name: "policy_" + k,
            label: "Kebijakan " + k,
            options: [{ value: "", label: "Ikuti default" }, ...policyOptions],
            value: config.overrides[k as keyof typeof config.overrides] || "",
          })),
          {
            name: "feeBearer",
            label: "Biaya transfer keluar",
            options: [
              { value: "KOPERASI", label: "Koperasi" },
              { value: "PENERIMA", label: "Potong hak penerima" },
            ],
            value: config.transferFeeBearer,
          },
          {
            name: "gatewayFee",
            label: "Biaya gateway per pembayaran (Rp)",
            type: "number",
            value: String(config.gatewayFee),
          },
          {
            name: "online",
            label: "Kanal VA",
            options: [
              { value: "no", label: "Nonaktif" },
              { value: "yes", label: "Aktif (SNAP sudah diuji)" },
            ],
            value: config.onlineEnabled ? "yes" : "no",
          },
        ],
      },
      {
        action: "recipient",
        title: "Rekening penerima",
        fields: [
          recipient,
          method,
          { name: "bank", label: "Nama bank" },
          { name: "account", label: "Nomor rekening", type: "text" },
          { name: "holder", label: "Nama pemilik rekening" },
        ],
      },
      {
        action: "va",
        title: "Terbitkan VA santri",
        fields: [
          student,
          {
            name: "customerNo",
            label: "Nomor anggota unik (maks. 10 digit)",
            required: true,
          },
        ],
      },
      {
        action: "unit",
        title: "Tambah loket",
        fields: [{ name: "title", label: "Nama loket", required: true }],
      },
      {
        action: "access",
        title: "Tautkan akun pengelola",
        fields: [
          { name: "userId", label: "ID akun pengelola", required: true },
          recipient,
        ],
      },
      {
        action: "limits",
        title: "Limit uang jajan",
        fields: [
          student,
          ...["daily", "weekly", "monthly"].map((k, i) => ({
            name: k,
            label: ["Harian (Rp)", "Mingguan (Rp)", "Bulanan (Rp)"][i],
            type: "number",
          })),
        ],
      },
    ];
    data.forms = data.forms.filter((form) => form.action !== "recipient");
  } else {
    data.title = "Loket & Uang Jajan";
    data.description =
      "Terima pembayaran, setoran, dan layani penarikan dengan QR + PIN.";
    if (!canWrite) throw new Error("Loket hanya untuk petugas koperasi.");
    sql =
      "SELECT sh.id,cu.name loket,sh.opened_at,sh.opening_cash_rupiah,sh.actual_closing_rupiah,sh.discrepancy_rupiah,sh.status FROM finance_cash_shifts sh JOIN finance_cash_units cu ON cu.id=sh.cash_unit_id WHERE sh.operator_id=?";
    values = [session.id];
    searchColumns = ["loket", "status"];
    data.columns = [
      { key: "loket", label: "Loket" },
      { key: "opened_at", label: "Dibuka" },
      { key: "opening_cash_rupiah", label: "Kas awal", money: true },
      { key: "discrepancy_rupiah", label: "Selisih", money: true },
      { key: "status", label: "Status" },
    ];
    const units = (
      await q<{ id: string; name: string }>(
        "SELECT id,name FROM finance_cash_units WHERE is_active=1",
      )
    ).map((r) => ({ value: r.id, label: r.name }));
    data.forms = shift
      ? [
          {
            action: "closeShift",
            title: "Tutup shift",
            fields: [{ ...amount, label: "Kas terhitung (Rp)" }, note],
          },
          {
            action: "pin",
            title: "Atur / reset PIN",
            fields: [
              student,
              {
                name: "pin",
                label: "PIN baru (4-8 digit)",
                type: "password",
                required: true,
              },
            ],
          },
        ]
      : [
          {
            action: "openShift",
            title: "Buka shift",
            fields: [
              {
                name: "unitId",
                label: "Loket",
                options: units,
                required: true,
              },
              { ...amount, label: "Kas awal terhitung (Rp)" },
            ],
          },
        ];
  }
  const search = data.search
    ? " WHERE " +
      searchColumns.map((c) => `CAST(${c} AS TEXT) LIKE ?`).join(" OR ")
    : "";
  const args = [
    ...values,
    ...(data.search ? searchColumns.map(() => "%" + data.search + "%") : []),
  ];
  const count = await one<{ n: number }>(
    `SELECT COUNT(*) n FROM (${sql}) base${search}`,
    args,
  );
  data.total = count?.n || 0;
  const sort = data.columns.some((c) => c.key === params.sort)
      ? params.sort
      : data.columns[0]?.key || "id",
    dir = params.dir === "asc" ? "ASC" : "DESC";
  data.rows = await q<Row>(
    `SELECT * FROM (${sql}) base${search} ORDER BY ${sort} ${dir},id LIMIT 25 OFFSET ?`,
    [...args, (data.page - 1) * 25],
  );
  if (view === "home") {
    const es = scopeSql(scope, "e.recipient_id");
    const m = await one<{ amount: number }>(
      `SELECT COALESCE(SUM(amount-paid),0) amount FROM finance_entitlements e WHERE reversed=0${es.sql}`,
      es.params,
    );
    data.metrics = [{ label: "Hak belum dicairkan", amount: m?.amount || 0 }];
    if (scope === null) {
      for (const [label, sql] of [
        [
          "Pembayaran diterima",
          "SELECT COALESCE(SUM(amount),0) amount FROM finance_orders WHERE status='PAID'",
        ],
        [
          "Tunggakan",
          "SELECT COALESCE(SUM(amount-paid),0) amount FROM finance_coop_bills WHERE status IN ('OPEN','PARTIAL')",
        ],
        [
          "Saldo uang jajan",
          "SELECT COALESCE(SUM(balance_rupiah),0) amount FROM finance_student_wallets WHERE wallet_kind='JAJAN'",
        ],
      ])
        data.metrics.push({
          label,
          amount: (await one<{ amount: number }>(sql))?.amount || 0,
        });
    }
  }
  return data;
}
