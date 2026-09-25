// scripts/test-finance-excel-export.mjs
// Uji regresi ekspor Excel Sistem Keuangan Baru (Fase 10 — PRD Bab 34 & UI/UX #45).
//
// Cakupan uji:
// A. Isi berkas: worksheet dibangun manual sehingga `ws['!ref']` harus dihitung sendiri.
//    Bila `!ref` tidak diset, SheetJS menulis .xlsx tanpa satu pun sel (file tampak kosong).
// B. Kolom "Limit Harian Efektif" memakai nilai konfigurasi, bukan 50rb hardcoded.
// C. Penelusuran seluruh halaman saat ekspor (collectAllReportPages): berhenti tepat saat
//    data habis, saat totalRecords tercapai, atau saat batas maksimum (truncated).

const captured = []
const OriginalBlob = globalThis.Blob

class CapturingBlob extends OriginalBlob {
  constructor(parts, options) {
    super(parts, options)
    captured.push(this)
  }
}
globalThis.Blob = CapturingBlob

globalThis.document = {
  createElement: () => ({ href: '', download: '', style: {}, click() {} }),
  body: { appendChild() {}, removeChild() {} },
}
URL.createObjectURL = () => 'blob:mock'
URL.revokeObjectURL = () => {}

const { exportReceiptsExcel, exportWalletExcel, exportStudentDetailExcel } = await import(
  '../lib/finance/report-exports.ts'
)
const { collectAllReportPages } = await import('../lib/finance/report-export-paging.ts')
const XLSX = (await import('xlsx-js-style')).default

async function describe(label, blob, expectedMinRows) {
  const buf = await blob.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const ok = rows.length >= expectedMinRows
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${label} → bytes=${buf.byteLength} sheets=${wb.SheetNames.length} ref=${ws['!ref']} rows=${rows.length}`
  )
  return ok
}

const receiptItem = {
  id: 'p1',
  paymentNumber: 'PAY-1',
  paidAt: '2026-09-19 09:32:00',
  santriNis: '12345',
  santriName: 'Ahmad Buhaeti',
  santriAsrama: 'Bahagia',
  santriKelas: '1A',
  channel: 'CASH',
  method: 'TUNAI',
  allocationsSummary: 'SPP September',
  grossAmount: 200000,
  gatewayFee: 0,
  netAmount: 200000,
  status: 'PAID',
  cashierName: 'Petugas',
}

// 1. Penerimaan
captured.length = 0
await exportReceiptsExcel([receiptItem], 'Uji')
const receiptsOk = await describe('exportReceiptsExcel', captured.at(-1), 6)

// 2. Uang Jajan (memverifikasi kolom Limit Harian Efektif memakai nilai konfigurasi, bukan 50rb hardcoded)
captured.length = 0
await exportWalletExcel(
  {
    mode: 'SUMMARY',
    summaryItems: [
      {
        santriId: 's1',
        santriName: 'Ahmad Buhaeti',
        santriNis: '12345',
        santriAsrama: 'Bahagia',
        santriKelas: '1A',
        totalIn: 100000,
        totalOut: 25000,
        currentBalance: 75000,
        parentDailyLimit: 20000,
        globalDailyLimit: 100000,
        effectiveDailyLimit: 20000,
        activeCardCode: 'CARD-1',
        activeCardStatus: 'ACTIVE',
      },
    ],
  },
  'Uji'
)
const walletBlob = captured.at(-1)
const walletOk = await describe('exportWalletExcel (SUMMARY)', walletBlob, 6)

const walletBuf = await walletBlob.arrayBuffer()
const walletSheet = XLSX.read(walletBuf, { type: 'array' }).Sheets['Uang Jajan']
const walletHeader = XLSX.utils.sheet_to_json(walletSheet, { header: 1 })[4]
const walletDataRow = XLSX.utils.sheet_to_json(walletSheet, { header: 1 })[5]
const limitOk =
  walletHeader[8] === 'Limit Harian Efektif' && Number(walletDataRow[8]) === 20000
console.log(
  `${limitOk ? 'OK  ' : 'FAIL'} kolom Limit Harian Efektif → header="${walletHeader[8]}" nilai=${walletDataRow[8]}`
)

// 3. Detail per Santri (3 lembar)
captured.length = 0
await exportStudentDetailExcel({
  student: {
    id: 's1',
    nis: '12345',
    nama: 'Ahmad Buhaeti',
    asrama: 'Bahagia',
    kamar: '23',
    kelas: '1A',
    noWaOrtu: '08123',
    fixedVa: '8808',
    bankCode: 'DUITKU',
    parentDailyLimit: null,
    walletBalance: 75000,
  },
  obligations: [],
  payments: [],
  walletMutations: [],
  summary: {
    totalExpected: 0,
    totalExempted: 0,
    totalPaid: 0,
    totalRemaining: 0,
    walletTotalIn: 0,
    walletTotalOut: 0,
    walletBalance: 0,
  },
})
const detailOk = await describe('exportStudentDetailExcel (3 lembar)', captured.at(-1), 4)

// ── C. PENELUSURAN SELURUH HALAMAN SAAT EKSPOR ──────────────────────────────
function makeFetcher(totalRecords) {
  const calls = []
  return {
    calls,
    async fetchPage(page, size) {
      calls.push(page)
      const start = (page - 1) * size
      const count = Math.max(0, Math.min(size, totalRecords - start))
      return {
        items: Array.from({ length: count }, (_, i) => ({ id: start + i + 1 })),
        pagination: { totalRecords },
      }
    },
  }
}

let pagingOk = true
function checkPaging(label, condition, detail) {
  if (!condition) pagingOk = false
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label} → ${detail}`)
}

// C1. Semua halaman terambil sampai data habis
{
  const f = makeFetcher(450)
  const res = await collectAllReportPages(f.fetchPage, { pageSize: 200, maxRows: 5000 })
  checkPaging(
    'paging: 450 baris terambil seluruhnya',
    res.items.length === 450 && res.totalRecords === 450 && res.truncated === false,
    `items=${res.items.length} pages=${f.calls.join(',')} truncated=${res.truncated}`
  )
}

// C2. Tepat sejumlah totalRecords (tidak ada permintaan halaman berlebih)
{
  const f = makeFetcher(400)
  const res = await collectAllReportPages(f.fetchPage, { pageSize: 200, maxRows: 5000 })
  checkPaging(
    'paging: berhenti tepat di totalRecords',
    res.items.length === 400 && f.calls.length === 2,
    `items=${res.items.length} pages=${f.calls.join(',')}`
  )
}

// C3. Batas maksimum → truncated true
{
  const f = makeFetcher(12000)
  const res = await collectAllReportPages(f.fetchPage, { pageSize: 200, maxRows: 5000 })
  checkPaging(
    'paging: dipotong di batas maksimum',
    res.items.length === 5000 && res.truncated === true && res.totalRecords === 12000,
    `items=${res.items.length} total=${res.totalRecords} pages=${f.calls.length} truncated=${res.truncated}`
  )
}

// C4. Data kosong → satu kali panggil, tidak ada loop tak berujung
{
  const f = makeFetcher(0)
  const res = await collectAllReportPages(f.fetchPage, { pageSize: 200, maxRows: 5000 })
  checkPaging(
    'paging: dataset kosong aman',
    res.items.length === 0 && f.calls.length === 1 && res.truncated === false,
    `items=${res.items.length} pages=${f.calls.length}`
  )
}

// C5. totalRecords tidak dilaporkan (0) namun data tetap habis → berhenti di halaman kosong
{
  let page = 0
  const res = await collectAllReportPages(
    async (_p, size) => {
      page += 1
      return {
        items: page <= 2 ? Array.from({ length: size }, (_, i) => ({ id: i })) : [],
        pagination: { totalRecords: 0 },
      }
    },
    { pageSize: 200, maxRows: 5000 }
  )
  checkPaging(
    'paging: bertahan saat totalRecords tidak diketahui',
    res.items.length === 400 && page === 3,
    `items=${res.items.length} pages=${page}`
  )
}

const allOk = receiptsOk && walletOk && limitOk && detailOk && pagingOk
console.log(allOk ? '\nSEMUA UJI EKSPOR EXCEL LULUS ✔' : '\nADA UJI EKSPOR EXCEL GAGAL ✘')
process.exit(allOk ? 0 : 1)
