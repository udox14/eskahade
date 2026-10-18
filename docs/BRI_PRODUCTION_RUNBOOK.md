# Panduan Operasional Produksi (Production Runbook) Integrasi Keuangan BRI

> **Koreksi 18 Oktober 2026:** gunakan [runbook remediation](FINANCE_BRI_REMEDIATION_RUNBOOK.md). Migration 0182–0186 sudah applied manual; jangan diaplikasikan ulang. Remediation lokal tidak memberi izin deploy/migrasi/aktivasi.

**Sistem**: Eskahade — Sistem Keuangan Baru (BRIAPI / BRIVA / QLola / Loket Kas)  
**Pemilik Sistem**: Tim IT & Tim Keuangan Koperasi / Pesantren Sukahideng  
**Versi Dokumen**: 1.1.0 (Fase BRI-7)

---

## 1. Identitas Database & Konfigurasi Lingkungan

### 1.1 Pemetaan Target Database Resmi (Wrangler D1 Binding)

Berdasarkan berkas konfigurasi resmi [`wrangler.jsonc`](file:///c:/DATA/Codes/eskahade/wrangler.jsonc):

| Target Database | Nama Database Resmi | Database ID (Cloudflare D1) | Binding Worker |
|---|---|---|---|
| **Database Produksi** | `eskahade-db` | `a2010f08-f314-46af-88fd-dbb9b4ef1bb1` | `DB` |
| **Database Demo / Sandbox** | `eskahade-demo-db` | `677f05ba-9b52-4534-9542-96cc785f25e4` | `DEMO_DB` |

> [!CAUTION]
> **ATURAN KESELAMATAN TARGET**:
> Dilarang menggunakan nama binding yang ambigu. Setiap perintah CLI wajib menyertakan flag eksplisit nama database:
> - Untuk demo: `--database=eskahade-demo-db`
> - Untuk produksi: `--database=eskahade-db`

### 1.2 Variabel Rahasia & Kredensial (Cloudflare Secrets)

Semua kredensial rahasia dikelola secara aman via `wrangler secret put <NAMA_SECRET>`:

| Nama Secret / Variabel | Lingkungan | Keterangan & Batasan |
|---|---|---|
| `BRI_ENV` | `production` / `sandbox` | Menentukan base URL BRIAPI. Default fail-closed jika kosong. |
| `BRI_CLIENT_KEY` | Produksi | Consumer Key resmi BRIAPI dari portal pengembang BRI. |
| `BRI_CLIENT_SECRET` | Produksi | Consumer Secret untuk tanda tangan HMAC-SHA512. |
| `BRI_PRIVATE_KEY` | Produksi | Kunci Privat RSA-2048 untuk signature Token B2B. |
| `BRI_PARTNER_ID` | Produksi | Header `X-PARTNER-ID` terdaftar resmi di BRI. |
| `BRI_COLLECTION_ACCOUNT_NO` | Produksi | Nomor rekening giro Koperasi di BRI penampung dana. |
| `BRI_OUTBOUND_ENABLED` | `false` (saat rilis) | **Master Kill Switch**. Menutup semua panggilan keluar perbankan. |
| `BRI_BRIVA_OUTBOUND_ENABLED` | `false` sampai review | Kontrol sinkronisasi Virtual Account BRIVA ke BRI. |
| `BRI_BRIVA_INBOUND_ENABLED` | `false` sampai UAT | Kontrol penerimaan webhook callback notifikasi bayar. |
| `BRI_STATEMENT_SYNC_ENABLED` | `false` sampai UAT | Kontrol sinkronisasi berkala Rekening Koran (SNAP BI). |
| `BRI_DIST_CASH_ENABLED` | `true` | Kontrol operasional loket tunai. |
| `BRI_DIST_MANUAL_ENABLED` | `true` | Kontrol operasional transfer manual. |

---

## 2. Prosedur Migrasi Database Produksi (Production Migration Preflight & Execution)

### 2.0 Status faktual per 18 Oktober 2026

0182–0186 telah applied manual menurut instruksi pemilik sistem dan manifest schema audit. Ledger `d1_migrations` tidak lengkap untuk sejarah manual tersebut. Klaim lama "auth blocked / belum applied" bukan status terkini. Audit awal memiliki snapshot schema/aggregate; remediation ini tidak menjalankan remote preflight ulang atau menulis database remote.

### 2.1 Kondisi Prasyarat (Pre-Flight Conditions)
1. **Otentikasi Cloudflare CLI**:
   - Pastikan variabel `CLOUDFLARE_API_TOKEN` telah di-set di lingkungan terminal dengan hak akses `D1:Edit`, `Workers:Edit`, dan `Account:Read`.
   - Verifikasi identitas akun: `wrangler whoami`.
2. **Cadangan Data Wajib (Mandatory Backup)**:
   - Sebelum menjalankan migrasi ke produksi, buat salinan cadangan D1 produksi:
     ```bash
     wrangler d1 export eskahade-db --remote --output=./backup_eskahade_prod_$(date +%Y%m%d_%H%M%S).sql
     ```
3. **Status Sakelar Darurat**:
   - Pastikan `BRI_OUTBOUND_ENABLED=false` selama jendela pemeliharaan migrasi (*maintenance window*).

### 2.2 Migration baru yang menunggu review

Hanya 0187, 0188, 0189 yang disiapkan oleh remediation ini; semuanya belum applied remote. Jangan menjalankan bulk migrations apply karena dapat mengulang applied migration historis. Ikuti preflight, backup, jendela berhenti mutasi, dan verifikasi di [runbook remediation](FINANCE_BRI_REMEDIATION_RUNBOOK.md). Tidak ada instruksi eksekusi remote otomatis dalam release ini.

## 3. Siklus Harian Operasional Keuangan (Daily Operations)

### 3.1 Penerimaan Pembayaran (Inbound BRIVA)
1. Webhook memakai path canonical yang dikonfirmasi onboarding; route v2.0 tersedia, alias `/api/bri/v1.0/...` ditutup di produksi.
2. Sistem memverifikasi tanda tangan HMAC-SHA512. Jika tidak sah, permintaan ditolak dengan HTTP 401 Unauthorized tanpa menyentuh database.
3. Transaksi dicatat sebagai `PAID` dan hak dana dialokasikan sebagai `UNDISBURSED`.
4. Biaya admin Koperasi sesuai snapshot rule order dicatat di `finance_cooperative_income`.
5. Uang Jajan langsung mengkredit dompet santri.
6. Pembayaran `PAID` **BELUM** berstatus `SETTLED` sampai dikonfirmasi mutasi bank.

### 3.2 Sinkronisasi rekening koran dan review

Gunakan workbench Rekonsiliasi Bank. Sinkronisasi default dinonaktifkan dan dibatasi gate service; jadwal/interval operasional menunggu konfirmasi bank. Kandidat tidak otomatis menjadi settlement: bukti bank dan review operator diperlukan. Baris/totals rusak tidak memajukan cursor. Lihat runbook remediation untuk recovery, unknown outcome, dan batas kontrak.

### 3.3 Operasional Penyaluran Dana (Disbursement Operations)

#### A. Penyaluran Kas Fisik di Loket (`CASH`)
1. **Buka Sesi Kasir**: Kasir membuka sesi kasir baru dengan input fisik kas awal di laci.
2. **Persiapan Penyaluran**: Kasir memilih tagihan vendor. Status berubah dari `DRAFT` ke `PROCESSING`. Saldo kas laci kasir langsung dibekukan (`live_prepared_amount`).
3. **Serah Terima Uang Fisik**: Penerima menerima kas fisik; nama penerima, petugas dan timestamp wajib dicatat. Bukti kwitansi mengikuti policy yang berlaku. Finalisasi `DISTRIBUTED` dan perubahan kas dilakukan atomik.
4. **Tutup Sesi Kasir**: Kasir menghitung fisik kas di laci dan menutup sesi kasir. Penutupan sesi diblokir jika masih ada penyaluran yang berstatus `PROCESSING`.

#### B. Penyaluran Transfer Bank Manual (`MANUAL_TRANSFER`)
1. Petugas membuat instruksi transfer manual ke vendor. Rekening sumber otomatis ditarik dari rekening Koperasi resmi (`BRI_COLLECTION_ACCOUNT_NO`).
2. Petugas melakukan transfer via ATM/Teller/Mobile Banking dari rekening Koperasi.
3. Petugas mengunggah bukti transfer resmi dan nomor referensi transfer bank.
4. Status diselesaikan menjadi `DISTRIBUTED` dengan kekuatan bukti `MANUAL_RESOLVED`.

#### C. Penyaluran BRI_QLOLA (Non-STP)

Transport produksi **belum tersedia** dan tetap diblokir. Draf lokal bukan bukti instruksi telah dikirim, bukan approval, dan tidak otomatis memesan dana; reservation mengikuti status/transfer intent aktif yang dijaga database.

Target setelah kontrak non-STP dan UAT disetujui: Eskahade submit → acknowledgement resmi → `PENDING_APPROVAL` dengan reservasi → Signer QLola approve → bank execute → evidence status final. Jangan meminta Signer mengeksekusi instruksi yang belum terbukti diterima bank. CASH/manual tetap memakai workflow terpisah yang disetujui; jangan melepas reservasi instruksi bank yang masih dapat dieksekusi.

---

## 4. Tanggap Darurat & Penanganan Insiden (Incident Response)

### 4.1 Insiden Timeout / Status Jaringan Tak Menentu (No Blind Retry)
1. **Dilarang keras melakukan retry transfer keluar secara buta**.
2. Jika terjadi HTTP 504 Timeout, status transfer ditandai `UNKNOWN`.
3. Lakukan Inquiry Status Transaksi atau tunggu sinkronisasi Rekening Koran berikutnya.
4. Jangan pernah mengalihkan metode ke CASH sebelum bank mengonfirmasi instruksi transfer telah dibatalkan secara definitif.

### 4.2 Prosedur Sakelar Darurat (Emergency Kill Switch)
Jika terjadi insiden anomali fatal:
```bash
# Nonaktifkan semua panggilan keluar BRI
wrangler secret put BRI_OUTBOUND_ENABLED
# Input nilai: false

# Nonaktifkan penerimaan webhook BRIVA
wrangler secret put BRI_BRIVA_INBOUND_ENABLED
# Input nilai: false
```
Sistem akan beralih ke mode aman *fail-closed* tanpa merusak integritas pembukuan yang telah ada.
