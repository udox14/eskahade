# Panduan Operasional Produksi (Production Runbook) Integrasi Keuangan BRI

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
| `BRI_BRIVA_OUTBOUND_ENABLED` | `true` | Kontrol sinkronisasi Virtual Account BRIVA ke BRI. |
| `BRI_BRIVA_INBOUND_ENABLED` | `true` | Kontrol penerimaan webhook callback notifikasi bayar. |
| `BRI_STATEMENT_SYNC_ENABLED` | `true` | Kontrol sinkronisasi berkala Rekening Koran (SNAP BI). |
| `BRI_DIST_CASH_ENABLED` | `true` | Kontrol operasional loket tunai. |
| `BRI_DIST_MANUAL_ENABLED` | `true` | Kontrol operasional transfer manual. |

---

## 2. Prosedur Migrasi Database Produksi (Production Migration Preflight & Execution)

### 2.0 Status Preflight Produksi Saat Ini (Current Preflight Status)
> [!IMPORTANT]
> **STATUS PREFLIGHT REMOTE PRODUKSI: NOT EXECUTED REMOTELY / AUTHENTICATION BLOCKED**  
> **PRODUCTION DATA PREFLIGHT REQUIRES RESTORED CLOUDFLARE AUTH**
> 
> Komponen yang **SUDAH DIVERIFIKASI SECARA STATIS**:
> - Skema repositori statis (`migrations/0182_...` s.d. `0186_...`).
> - Konfigurasi `wrangler.jsonc`.
> - Nama database produksi (`eskahade-db`) dan Database ID (`a2010f08-f314-46af-88fd-dbb9b4ef1bb1`).
> - Berkas migrasi dan prosedur keselamatan runbook.
> 
> Komponen yang **BELUM DIVERIFIKASI (MENUNGGU PEMULIHAN AKSES CLI REMOTE)**:
> - Tabel `d1_migrations` remote aktual pada `eskahade-db`.
> - Skema tabel produksi aktual di remote D1.
> - Jumlah baris data aktual (*actual row counts*).
> - Baris legacy penyedia pembayaran terdahulu.
> - Potensi data duplikat atau record yang tidak kompatibel/nullable.

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

### 2.2 Rangkaian Migrasi yang Harus Diterapkan (Migrations 0182–0186)
Migrasi baru yang wajib diaplikasikan secara berurutan:
1. `migrations/0182_bri_foundation.sql`: Skema dasar BRI, penerima distribusi, tabel income koperasi, pembersihan Duitku.
2. `migrations/0183_briva_collection_metadata.sql`: Trigger pembayaran BRIVA dan metadata rekonsiliasi.
3. `migrations/0184_bri_settlement_and_recovery.sql`: Rekening koran, penyelesaian atomik, antrean pemulihan.
4. `migrations/0185_bri_qlola_distribution.sql`: Penyaluran Non-STP QLola, outbox transfer intents, trigger anti-kolisi.
5. `migrations/0186_cash_manual_distribution_hardening.sql`: Proteksi saldo laci kasir (`live_prepared_amount`), transfer manual kanonik.

### 2.3 Perintah Eksekusi Migrasi Produksi
```bash
# 1. Periksa daftar migrasi pending pada database produksi
wrangler d1 migrations list eskahade-db --remote

# 2. Terapkan migrasi ke database produksi (HANYA DENGAN KONFIRMASI PEMILIK SISTEM)
wrangler d1 migrations apply eskahade-db --remote

# 3. Verifikasi ulang bahwa migrasi 0182–0186 telah berstatus applied
wrangler d1 migrations list eskahade-db --remote
```

> [!WARNING]
> **KONDISI BERHENTI (STOP CONDITIONS)**:
> Jika terjadi kegagalan SQL error pada migrasi:
> 1. Segera hentikan eksekusi migrasi lanjutan.
> 2. JANGAN lakukan modifikasi manual destruktif pada tabel D1 langsung.
> 3. Laporkan pesan error dan lakukan investigasi terhadap trigger/foreign key yang menolak data.

---

## 3. Siklus Harian Operasional Keuangan (Daily Operations)

### 3.1 Penerimaan Pembayaran (Inbound BRIVA)
1. Webhook callback diterima di `/api/bri/v1.0/transfer-va/payment`.
2. Sistem memverifikasi tanda tangan HMAC-SHA512. Jika tidak sah, permintaan ditolak dengan HTTP 401 Unauthorized tanpa menyentuh database.
3. Transaksi dicatat sebagai `PAID` dan hak dana dialokasikan sebagai `UNDISBURSED`.
4. Biaya admin Koperasi (Rp2.500) dicatat di `finance_cooperative_income`.
5. Uang Jajan langsung mengkredit dompet santri.
6. Pembayaran `PAID` **BELUM** berstatus `SETTLED` sampai dikonfirmasi mutasi bank.

### 3.2 Sinkronisasi Rekening Koran & Rekonsiliasi Otomatis
1. Sinkronisasi mutasi rekening koran SNAP BI berjalan berkala (misal: 07.00, 12.00, 17.00, 21.00 WIB).
2. **Hindari jam EOD perbankan** (23.30–01.00 WIB) saat core banking bank sedang offline/batch.
3. Mutasi kredit yang cocok menaikkan status pembayaran dari `PAID` ke `SETTLED`.
4. Mutasi kredit tanpa santri/order sah masuk ke antrean `UNALLOCATED_TRANSFER` pada menu Rekonsiliasi.

### 3.3 Operasional Penyaluran Dana (Disbursement Operations)

#### A. Penyaluran Kas Fisik di Loket (`CASH`)
1. **Buka Sesi Kasir**: Kasir membuka sesi kasir baru dengan input fisik kas awal di laci.
2. **Persiapan Penyaluran**: Kasir memilih tagihan vendor. Status berubah dari `DRAFT` ke `PROCESSING`. Saldo kas laci kasir langsung dibekukan (`live_prepared_amount`).
3. **Serah Terima Uang Fisik**: Penerima menerima kas fisik dan menandatangani kwitansi fisik. Kasir mengunggah bukti kwitansi (PDF/JPG/PNG max 5MB). Status difinalisasi menjadi `DISTRIBUTED`.
4. **Tutup Sesi Kasir**: Kasir menghitung fisik kas di laci dan menutup sesi kasir. Penutupan sesi diblokir jika masih ada penyaluran yang berstatus `PROCESSING`.

#### B. Penyaluran Transfer Bank Manual (`MANUAL_TRANSFER`)
1. Petugas membuat instruksi transfer manual ke vendor. Rekening sumber otomatis ditarik dari rekening Koperasi resmi (`BRI_COLLECTION_ACCOUNT_NO`).
2. Petugas melakukan transfer via ATM/Teller/Mobile Banking dari rekening Koperasi.
3. Petugas mengunggah bukti transfer resmi dan nomor referensi transfer bank.
4. Status diselesaikan menjadi `DISTRIBUTED` dengan kekuatan bukti `MANUAL_RESOLVED`.

#### C. Penyaluran BRI_QLOLA (Non-STP)
1. Petugas (Maker) membuat pengajuan draf penyaluran di Eskahade.
2. Dana alokasi terpesan (*reserved*).
3. Transmisi langsung otomatis dinonaktifkan (`QLOLA_REAL_SUBMISSION_STATE = DISABLED`).
4. Signer resmi login ke portal QLola BRI untuk mengeksekusi transfer bank.

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
