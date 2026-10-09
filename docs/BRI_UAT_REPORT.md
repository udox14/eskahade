# Laporan UAT (User Acceptance Testing) & Evaluasi Kesiapan Integrasi Keuangan BRI

**Nomor Dokumen**: UAT-BRI-202610-001-REV2  
**Tanggal Evaluasi**: 9 Oktober 2026  
**Status Evaluasi**: CODE READY / DOMAIN SIMULATION PASSED / REMOTE GATES OPEN  
**Lingkungan Evaluasi**: 
- Engine: Node.js 22 + SQLite In-Memory DatabaseSync (Replikasi Skema Penuh Migrasi 0001 s.d. 0186)
- Cloudflare Context: Mocking OpenNext & Database Router
- Remote D1 & BRI Sandbox: Gated (Lihat Catatan Kesiapan)

---

## 1. Pemisahan Tegas Status Kesiapan Faktual (Factual Readiness Classification)

Sesuai instruksi audit perbankan, sistem memisahkan status kesiapan secara faktual dan ketat:

| Kategori Status | Status Faktual | Keterangan & Batasan |
|---|---|---|
| **CODE READINESS** | **READY** | Seluruh kode adapter, skema migrasi 0182–0186, trigger database, reporting engine, dan invariant verifier selesai dan lolos kompilasi (TypeScript 0 error, build Next.js sukses code 0). |
| **LOCAL DOMAIN/UAT SIMULATION** | **PASS (287/287)** | Seluruh 287 skenario uji invariant keuangan lulus 100%. Simulasi domain menggunakan engine SQLite/D1-compatible lokal dengan SQL migrasi dan invariant yang sama. **REMOTE D1 BEHAVIOR: NOT YET VERIFIED**. |
| **DEMO REMOTE MIGRATION** | **NOT VERIFIED — CLOUDFLARE AUTH BLOCKED** | Status remote migrasi 0182–0186 pada `eskahade-demo-db` (ID: `677f05ba-9b52-4534-9542-96cc785f25e4`) belum terverifikasi secara remote karena token CLI Cloudflare kedaluwarsa. |
| **DEMO REMOTE UAT** | **NOT EXECUTED** | Pengujian UAT fisik pada cluster D1 remote demo belum dieksekusi menunggu pemulihan otentikasi CLI Cloudflare. |
| **PRODUCTION REMOTE PREFLIGHT** | **NOT EXECUTED — CLOUDFLARE AUTH BLOCKED** | Pemeriksaan remote D1 terhadap `eskahade-db` belum dieksekusi. Hanya konfigurasi statis repo, skema berkas SQL, dan nama/ID database yang terverifikasi statis. **PRODUCTION DATA PREFLIGHT REQUIRES RESTORED CLOUDFLARE AUTH**. |
| **PRODUCTION MIGRATION** | **NOT EXECUTED** | Database produksi `eskahade-db` (ID: `a2010f08-f314-46af-88fd-dbb9b4ef1bb1`) **TIDAK DIMIGRASI / HARD GATED**. Dilarang keras memutasi database produksi. |
| **BRI SANDBOX INTEROPERABILITY** | **NOT VERIFIED / EXTERNAL GATE** | Pengujian kriptografi RSA/HMAC lokal **BUKAN** bukti interoperabilitas jaringan dengan endpoint sandbox BRI. Panggilan fisik ke endpoint BRI Sandbox menunggu kredensial Sandbox resmi dari PIC IT BRI. |
| **BRI PRODUCTION CREDENTIALS** | **PENDING ONBOARDING** | Kunci privat produksi, Client Key produksi, dan X-PARTNER-ID produksi belum diterbitkan. Sistem dalam status *fail-closed*. |
| **R2 CODE READINESS** | **READY / REMOTE DEMO R2 NOT VERIFIED** | Layanan Private R2 Bucket (`proof-storage-service.ts`) siap dengan proteksi MIME, magic-bytes, SHA-256 hash, dan otorisasi RBAC. Verifikasi live R2 binding remote belum dijalankan. Fail-closed di produksi (`R2_BUCKET_UNAVAILABLE`). |
| **QLOLA** | **DEFERRED / CONTRACT_TBD / HARD DISABLED** | Di luar cakupan rilis awal (out of initial launch scope). `distributionQlolaEnabled = false`, `QLOLA_REAL_SUBMISSION_STATE = DISABLED`. Bukan mandatory initial-go-live gate. Hanya wajib sebelum fitur BRI_QLOLA diaktifkan. |
| **OVERALL INITIAL GO-LIVE** | **NOT READY — EXTERNAL GATES OPEN** | Sistem ditahan secara aman (*fail-closed*) sampai gerbang eksternal wajib (Token Cloudflare, Preflight Data Produksi, dan Kredensial Produksi BRI) terpenuhi. |

---

## 2. Metodologi Pengujian: Local Domain Simulation vs Real Demo D1 vs External Sandbox

Untuk mencegah kesalahpahaman antara uji unit/domain dengan integrasi perbankan nyata:
1. **Local Domain Simulation (Teruji Penuh - 287 Pengujian)**:
   - Dijalankan menggunakan skrip otomatis (`scripts/test-*.cjs`) di atas Local SQLite/D1-compatible domain simulation using the same migration SQL and financial invariants.
   - Menguji logika bisnis, atomisitas batch, idempotensi, race condition, dan pencegahan *double-disbursement*.
   - **REMOTE D1 BEHAVIOR: NOT YET VERIFIED**.
2. **Real Demo D1 UAT (Belum Dijalankan — Tertunda Otentikasi CLI)**:
   - Eksekusi `wrangler d1 migrations apply eskahade-demo-db --remote` dan `scripts/seed-uat-fixtures.cjs` terhadap cluster Cloudflare D1 fisik.
   - Memerlukan variabel `CLOUDFLARE_API_TOKEN` yang sah dari administrator.
3. **External BRI Sandbox (Belum Diuji Jaringan / External Gate)**:
   - Panggilan HTTP nyata ke endpoint sandbox BRI.
   - Menunggu penyediaan Client Key, Client Secret, dan Private Key Sandbox dari PIC IT BRI.

---

## 3. Matriks Hasil Pengujian Otomatis (Full Regression Run)

Seluruh 11 test suite dari BRI-0 hingga BRI-7 dijalankan tanpa ada satu pun tes yang dilewati (*zero skipped tests*):

| No | Modul / Test Suite | Skrip Pengujian | Jumlah Pengujian | Hasil |
|---|---|---|---|---|
| 1 | **Migration 0182: BRI Foundation & Duitku Purge** | `scripts/test-migration-0182.cjs` | 33 skenario (13 Core + 20 RT) | **100% LULUS** |
| 2 | **BRI-2: Security, Token & Transport Crypto** | `scripts/test-bri-core.cjs` | 25 skenario | **100% LULUS** |
| 3 | **Migration 0183: BRIVA Collection Metadata** | `scripts/test-migration-0183.cjs` | 8 skenario | **100% LULUS** |
| 4 | **BRI-3: BRIVA Inbound Collection & Webhook** | `scripts/test-bri-collection.cjs` | 28 skenario | **100% LULUS** |
| 5 | **Migration 0184: Settlement & Recovery Schema** | `scripts/test-migration-0184.cjs` | 19 skenario | **100% LULUS** |
| 6 | **BRI-4: Settlement Engine & Bank Statement** | `scripts/test-bri-settlement.cjs` | 27 skenario | **100% LULUS** |
| 7 | **Migration 0185: QLola Distribution Schema** | `scripts/test-migration-0185.cjs` | 11 skenario | **100% LULUS** |
| 8 | **BRI-5: BRI/QLola Non-STP Distribution** | `scripts/test-bri-distribution.cjs` | 37 skenario | **100% LULUS** |
| 9 | **Migration 0186: Cash & Manual Distribution** | `scripts/test-migration-0186.cjs` | 17 skenario | **100% LULUS** |
| 10 | **BRI-6: Cash Desk Drawer & Manual Transfer** | `scripts/test-bri-cash-manual-distribution.cjs` | 66 skenario | **100% LULUS** |
| 11 | **BRI-7: Reports, Entrypoint Flags & Chaos Asserter** | `scripts/test-bri-audit-reports.cjs` | 16 skenario | **100% LULUS** |
| **TOTAL** | **Seluruh Invariant Finansial Codebase** | - | **287 Skenario** | **100% LULUS** |

---

## 4. Evaluasi Rinci Skenario Domain Finansial

### A. Pengumpulan Dana (Collection)
- **Aturan Santri Bebas Tagihan (Canonical Business Rules)**:
  - Diverifikasi berdasarkan modul kanonik `lib/finance/non-billable-santri.ts` dan migrasi `0052_santri_kategori_sadesa.sql`:
    - `AL-BAGHORY`: Santri penduduk setempat berasrama AL-BAGHORY bebas total dari seluruh tagihan (0 VA dan 0 tagihan).
    - `SADESA`: Santri kategori SADESA otomatis dibebaskan dari tagihan `UANG_MAKAN` dan `UANG_NYUCI` (karena tidak menggunakan katering & laundry pesantren), namun tetap memiliki kewajiban SPP/pendidikan lainnya.
- **Idempotensi & Anti-Kolisi Webhook**:
  - Dua callback simultan dengan `trxId` dan `paymentRequestId` identik diproses tepat satu kali tanpa duplikasi pencatatan uang.
  - Parameter `paidAmount` atau `paymentRequestId` yang bertabrakan menghasilkan respon HTTP 409 Conflict.
- **Pemisahan Biaya**:
  - Biaya admin Koperasi (Rp2.500) tercatat di `finance_cooperative_income`.
  - Biaya transaksi bank BRI terpisah mutlak dan tidak dicampur ke pendapatan Koperasi.
- **Dana Titipan Uang Jajan**:
  - Pembayaran pos Uang Jajan langsung mengkredit saldo dompet santri dan terisolasi mutlak dari distribusi vendor.

### B. Penyelesaian & Rekonsiliasi (Settlement)
- **Prinsip `PAID != SETTLED`**:
  - Webhook BRIVA hanya mengubah status menjadi `PAID`.
  - Status `SETTLED` diwajibkan memiliki bukti mutasi kredit Rekening Koran resmi (`finance_bri_settlement_items`).
- **Pencegahan Klaim Ganda**:
  - Satu mutasi kredit bank hanya dapat diklaim oleh tepat satu transaksi pembayaran internal (unique constraint 1-to-1).
- **Mutasi Tak Dikenal**:
  - Kredit bank yang tidak memiliki pasangan order/santri sah dialihkan ke antrean `UNALLOCATED_TRANSFER` tanpa memalsukan data siswa.

### C. Penyaluran Dana (Distribution)
- **Penyaluran Kas Fisik (`CASH`) & Proteksi Laci**:
  - Penyaluran berstatus `PROCESSING` langsung memotong saldo kas laci kasir (`live_prepared_amount`).
  - Penyiapan kas yang melebihi saldo fisik laci diblokir oleh trigger database `trg_finance_dist_enforce_cash_session_balance`.
  - Penutupan sesi kasir diblokir oleh `trg_finance_cash_session_prevent_close_with_live_reservations` jika masih ada reservasi aktif.
- **Penyaluran Transfer Manual (`MANUAL_TRANSFER`)**:
  - Rekening sumber transfer ditarik dari konfigurasi resmi rekening Koperasi (bukan input bebas operator).
  - Kekuatan bukti kwitansi dari unggahan operator diklasifikasikan sebagai `MANUAL_RESOLVED` (bukan klaim otomatis `AUTHORITATIVE_EXACT`).
- **Penyaluran QLola (Non-STP)**:
  - Eksekusi langsung dimatikan (`QLOLA_REAL_SUBMISSION_STATE = DISABLED`).
  - Pengajuan hanya berstatus DRAFT dan diproses via portal Signer QLola eksternal.
  - Dana dialokasikan secara aman tanpa risiko penarikan lintas metode (*cross-method reservation*).

### D. Penegakan Flag & Otorisasi RBAC
- **Operational Entrypoints**:
  - Penyaluran CASH diblokir di sisi server jika `BRI_DIST_CASH_ENABLED=false`.
  - Penyaluran MANUAL diblokir jika `BRI_DIST_MANUAL_ENABLED=false`.
  - Sinkronisasi mutasi diblokir jika `BRI_STATEMENT_SYNC_ENABLED=false`.
- **RBAC Audit**:
  - Peran `superadmin` telah dihapus karena bukan peran sah Eskahade.
  - Peran `pimpinan` ditegakkan sebagai *view-only* dan ditolak dari mutasi operasional.
  - Di lingkungan produksi, ketiadaan Cloudflare R2 bucket memaksa penolakan *fail-closed* (`R2_BUCKET_UNAVAILABLE`).

---

## 5. Kesimpulan UAT & Rekomendasi Gatekeeper

1. Logika bisnis keuangan, trigger integritas data, dan penegakan keamanan kode telah **LULUS PENUH (PASS)** pada simulasi domain lengkap.
2. Status rilis produksi tetap **DITAHAN (HOLD / GATED)** sampai administrator menyediakan token Cloudflare untuk migrasi remote `eskahade-demo-db` dan kredensial Sandbox/Produksi dari BRIAPI.
