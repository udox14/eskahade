# Daftar Periksa Kesiapan Rilis Produksi (Production Go-Live Checklist)

**Sistem**: Eskahade — Sistem Keuangan Baru & Integrasi BRIAPI  
**Tanggal Evaluasi**: 9 Oktober 2026  
**Status Evaluasi**: CODE READY / EXTERNAL GATES OPEN (GO-LIVE GATED)

---

## 1. Matriks Kesiapan Faktual (Factual Readiness Gates Matrix)

| Gerbang Kesiapan (Readiness Gate) | Status Faktual | Catatan Evaluasi & Penjelasan Teknis |
|---|---|---|
| **CODE READINESS** | **READY** | Seluruh kode adapter, skema migrasi 0182–0186, trigger database, reporting engine, dan invariant verifier selesai. Kompilasi TypeScript 0 error, build Next.js sukses code 0. |
| **LOCAL DOMAIN/UAT SIMULATION** | **PASS (287/287)** | 100% lulus (287 dari 287 skenario uji). Local SQLite/D1-compatible domain simulation using the same migration SQL and financial invariants. **REMOTE D1 BEHAVIOR: NOT YET VERIFIED**. |
| **DEMO REMOTE MIGRATION** | **NOT VERIFIED — CLOUDFLARE AUTH BLOCKED** | Pemeriksaan migrasi remote pada `eskahade-demo-db` (ID: `677f05ba-9b52-4534-9542-96cc785f25e4`) terblokir karena OAuth token CLI Cloudflare kedaluwarsa. Membutuhkan `CLOUDFLARE_API_TOKEN` yang valid. |
| **DEMO REMOTE UAT** | **NOT EXECUTED** | Eksekusi UAT fisik di lingkungan remote D1 belum dijalankan karena menunggu akses otentikasi CLI Cloudflare. |
| **PRODUCTION REMOTE PREFLIGHT** | **NOT EXECUTED — CLOUDFLARE AUTH BLOCKED** | Pemeriksaan remote D1 terhadap `eskahade-db` belum dieksekusi. Hanya konfigurasi statis repo, skema file SQL, dan identitas database yang terverifikasi secara statis. **PRODUCTION DATA PREFLIGHT REQUIRES RESTORED CLOUDFLARE AUTH**. |
| **PRODUCTION MIGRATION** | **NOT EXECUTED** | Database produksi `eskahade-db` (ID: `a2010f08-f314-46af-88fd-dbb9b4ef1bb1`) **TIDAK DIMIGRASI / HARD GATED**. Dilarang keras memutasi produksi pada tahap ini. |
| **BRI SANDBOX INTEROPERABILITY** | **NOT VERIFIED / EXTERNAL GATE** | Belum ada panggilan HTTP nyata ke endpoint sandbox BRI. Menunggu kredensial Sandbox resmi dan onboarding PIC IT BRI. |
| **BRI PRODUCTION CREDENTIALS** | **PENDING ONBOARDING** | Kunci privat produksi, Client Key produksi, dan X-PARTNER-ID produksi belum diterbitkan. Sistem dalam status *fail-closed*. |
| **R2 CODE READINESS** | **READY / REMOTE DEMO R2 NOT VERIFIED** | Layanan Private R2 Bucket (`proof-storage-service.ts`) siap dengan proteksi MIME, magic-bytes, SHA-256 hash, dan otorisasi RBAC. Verifikasi live R2 binding remote belum dijalankan. Fail-closed di produksi (`R2_BUCKET_UNAVAILABLE`). |
| **QLOLA** | **DEFERRED / CONTRACT_TBD / HARD DISABLED** | Di luar cakupan rilis awal (out of initial launch scope). `distributionQlolaEnabled = false`, `QLOLA_REAL_SUBMISSION_STATE = DISABLED`. Bukan mandatory initial-go-live gate. Hanya wajib sebelum fitur BRI_QLOLA diaktifkan. |
| **OVERALL INITIAL GO-LIVE** | **NOT READY — EXTERNAL GATES OPEN** | Kode dan simulasi domain lokal siap, tetapi peluncuran produksi ditahan (*fail-closed*) menunggu gerbang eksternal utama terbuka. |

---

## 2. Matriks Status Migrasi Remote (Remote Migration State Matrix)

| Nomor Migrasi | Nama Berkas Migrasi | Status Remote Demo (`eskahade-demo-db`) | Status Remote Produksi (`eskahade-db`) | Status Simulasi Domain Lokal |
|---|---|---|---|---|
| **0182** | `0182_bri_foundation.sql` | UNKNOWN / NOT VERIFIED — AUTH BLOCKED | NOT EXECUTED / HARD GATED | **100% PASS** (33 tests) |
| **0183** | `0183_briva_collection_metadata.sql` | UNKNOWN / NOT VERIFIED — AUTH BLOCKED | NOT EXECUTED / HARD GATED | **100% PASS** (8 tests) |
| **0184** | `0184_bri_settlement_and_recovery.sql` | UNKNOWN / NOT VERIFIED — AUTH BLOCKED | NOT EXECUTED / HARD GATED | **100% PASS** (19 tests) |
| **0185** | `0185_bri_qlola_distribution.sql` | UNKNOWN / NOT VERIFIED — AUTH BLOCKED | NOT EXECUTED / HARD GATED | **100% PASS** (11 tests) |
| **0186** | `0186_cash_manual_distribution_hardening.sql` | UNKNOWN / NOT VERIFIED — AUTH BLOCKED | NOT EXECUTED / HARD GATED | **100% PASS** (17 tests) |

---

## 3. Klasifikasi Gerbang Eksternal (External Gates Classification)

### 3.1 Gerbang Wajib Rilis Awal Produksi (Mandatory Initial Launch External Gates)
1. **Pemulihan Otentikasi Cloudflare CLI**:
   - [ ] Sediakan `CLOUDFLARE_API_TOKEN` yang sah di environment terminal.
   - [ ] Jalankan `wrangler d1 migrations list eskahade-demo-db --remote` untuk mengonfirmasi status remote migrasi demo riil.
   - [ ] Terapkan migrasi ke demo `wrangler d1 migrations apply eskahade-demo-db --remote`.
   - [ ] Jalankan seeder UAT remote: `node scripts/seed-uat-fixtures.cjs`.
   - [ ] Verifikasi live put/get pada bucket R2 `eskahade-foto`.
2. **Pemeriksaan Data Produksi Remote (Production Data Preflight)**:
   - [ ] Lakukan pemeriksaan read-only terhadap database produksi `eskahade-db` setelah otentikasi Cloudflare dipulihkan:
     - Periksa `d1_migrations` remote aktual.
     - Periksa skema tabel produksi aktual.
     - Periksa jumlah baris tabel (row counts) aktual.
     - Periksa potensi data duplikat, baris legacy penyedia lama, dan record yang tidak kompatibel.
3. **Interoperabilitas Sandbox BRI**:
   - [ ] Terima kredensial sandbox resmi dari PIC IT BRI.
   - [ ] Uji token B2B, inquiry VA, dan payment callback di sandbox BRI via HTTP nyata.
   - [ ] Uji sinkronisasi Bank Statement (SNAP BI) di sandbox BRI via HTTP nyata.
4. **Onboarding & Penerbitan Kredensial Produksi BRI**:
   - [ ] Terima Client Key, Client Secret, dan X-PARTNER-ID produksi resmi dari BRIAPI.
   - [ ] Daftarkan Public Key Eskahade ke portal BRIAPI Production.
   - [ ] Simpan seluruh rahasia produksi ke `wrangler secret put`.
   - [ ] Konfirmasi registrasi webhook callback BRIVA di portal BRIAPI.
5. **Persetujuan Tertulis Pemilik Sistem untuk Migrasi Produksi**:
   - [ ] Lakukan backup penuh database `eskahade-db`:
     `wrangler d1 export eskahade-db --remote --output=backup_prod.sql`.
   - [ ] Terapkan migrasi 0182–0186 pada jendela waktu pemeliharaan.
   - [ ] Lakukan smoke test transaksi nominal kecil pasca migrasi.

### 3.2 Gerbang Tertunda QLola (Deferred QLola Gate — Out of Initial Launch Scope)
- [ ] Verifikasi kontrak dan antarmuka H2H dengan PIC IT QLola BRI.
- [ ] Integrasi portal Signer QLola diselesaikan saat fitur `BRI_QLOLA` hendak diaktifkan di masa mendatang.
- *Catatan*: Fitur `BRI_QLOLA` saat ini **HARD DISABLED** (`distributionQlolaEnabled = false`) dan tidak menghalangi rilis awal penagihan BRIVA, penyelesaian Rekening Koran, penyaluran CASH, dan MANUAL_TRANSFER.

