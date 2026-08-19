# Runbook Keuangan Terpusat

Sistem ini memakai seluruh tabel berawalan `finance_` di database terpisah, dan
tidak mengambil saldo dari `santri.saldo_uang_jajan` atau `saldo_tabungan`.
Menerapkan migrasi tidak otomatis mengaktifkan sistem baru untuk asrama mana pun.

Dokumen ini menggantikan runbook sebelum penyederhanaan. Kalau Anda menemukan
catatan lama yang menyebut MFA staf, break-glass, masa tenang rekening 24 jam,
mode kredensial HYBRID, atau impor mutasi bank otomatis — semua itu sudah dihapus.

---

## 1. Yang berubah dari sistem sebelumnya

**Dipertahankan penuh.** Double-entry ledger beserta seluruh triggernya: debit
harus sama dengan kredit, saldo akun dan dompet tidak boleh negatif, jurnal
`POSTED` tidak bisa diubah atau dihapus. Limit penarikan santri tetap tiga
tingkat (harian, mingguan, bulanan). Wali tetap bisa mengelola beberapa anak
dengan satu login. Integrasi Duitku beserta idempotensi dan penanganan replay
tidak tersentuh sama sekali.

**Disederhanakan.**

| Bagian | Sebelum | Sekarang |
|---|---|---|
| Kredensial santri | RFID, QR, HYBRID, mode transisi | QR saja |
| Payroll guru | absensi per sesi + versi kebijakan | gaji bulanan + hari alfa/badal |
| Pencairan | maker-checker-executor, 8 status | maker-checker, 7 status |
| Rekening penerima | verifikasi + masa tenang 24 jam | verifikasi petugas lain |
| Rekonsiliasi bank | impor berkas + auto-match per baris | checklist bulanan per rekening |
| Buka periode tertutup | dua persetujuan | satu penyetuju + alasan |
| Wali | tiga tingkat akses per santri | setiap wali tertaut punya hak penuh |

**Dihapus total.** MFA/WebAuthn staf, break-glass admin teknis, session finance
terpisah, outbox event, mode insiden, snapshot staf.

**Ledger tetap ketat, tapi operator tidak pernah melihatnya.** Seluruh kode akun
hidup di satu berkas, `lib/finance/postings.ts`. Layar Transaksi punya dua lapis:
lapis operasional berbahasa manusia untuk semua pengurus, dan lapis akuntansi di
balik tombol "Lihat jurnal" untuk bendahara dan auditor.

---

## 2. Menerapkan migrasi

> **Baca bagian ini sampai habis sebelum menjalankan perintah apa pun.**
> Pada 16 Agustus 2026 migrasi `0007` dijalankan ke `FINANCE_DB` produksi,
> `DROP TABLE finance_bills` berhasil tapi `ALTER TABLE ... RENAME` tidak sempat
> commit, dan tabel `finance_bills` hilang dari skema produksi sampai dipulihkan
> manual. Migrasi di bawah ini jauh lebih besar dari `0007`.

### Aturan yang tidak boleh dilanggar

1. **Satu berkas satu perintah `--file`.** Jangan pernah memakai `--command`
   berisi banyak statement: wrangler memecah teksnya berdasarkan titik koma
   secara naif, sehingga body trigger yang mengandung `;` di dalam `BEGIN…END`
   pecah jadi fragmen dan gagal dengan "incomplete input".
2. **Urutan berkas tidak boleh diacak.** Seluruh tabel dibuat lebih dulu
   (`0001b`–`0001f`), baru seluruh trigger (`0001g`). SQLite membuat trigger
   tanpa memvalidasi tabel yang hanya disebut di dalam body-nya, jadi trigger
   yang dibuat sebelum tabel rujukannya ada akan menggantung dan meledak
   belakangan.
3. **Urutan lingkungan: D1 lokal → `DEMO_FINANCE_DB` → `FINANCE_DB`.**
   Produksi paling akhir.
4. **Kalau satu berkas gagal separuh, berhenti.** Jangan jalankan berkas
   berikutnya, jangan menambal manual. Pulihkan dari export lalu ulangi.

### Sebelum mulai

```bash
npx wrangler d1 export eskahade-finance --remote --output ./backup-finance.sql
```

```bash
npx wrangler d1 export eskahade-demo-finance --remote --output ./backup-demo-finance.sql
```

Simpan keduanya di luar repo. Perintah export membuat database tidak melayani
query selama beberapa detik.

Pastikan juga sistem baru masih nonaktif:

```bash
npx wrangler d1 execute eskahade-db --remote --command "SELECT value FROM app_settings WHERE key='finance_legacy_mode';"
```

### Urutan berkas

Jalankan satu per satu, **periksa hasilnya sebelum lanjut ke berkas berikutnya**:

| No | Berkas | Isi |
|---|---|---|
| 1 | `0001a_drop_legacy.sql` | DROP seluruh trigger, lalu DROP 49 tabel lama |
| 2 | `0001b_tables_core.sql` | akun, periode, jurnal, entri, saldo, dompet |
| 3 | `0001c_tables_billing.sql` | intent, gateway event, wali, tagihan, alokasi, tarif layanan |
| 4 | `0001d_tables_loket.sql` | kredensial, PIN, limit, unit kas, shift, penarikan |
| 5 | `0001e_tables_payout.sql` | penerima, pencairan, payroll, rekonsiliasi |
| 6 | `0001f_tables_support.sql` | audit log, setelan, snapshot |
| 7 | `0001g_triggers.sql` | **seluruh** trigger |
| 8 | `0001h_seed.sql` | bagan akun, kebijakan kredensial, setelan awal |
| 9 | `0003_payroll_per_sesi.sql` | payroll bersatuan sesi + kolom snapshot absensi |

**Berkas 9 tidak idempotent.** Isinya `ALTER TABLE RENAME COLUMN`, yang gagal
bila dijalankan dua kali — disengaja, supaya penerapan ganda ketahuan alih-alih
lewat diam-diam. Kalau berkas 1-8 sudah pernah diterapkan sebelumnya, jalankan
**berkas 9 saja**:

```
npx wrangler d1 execute eskahade-finance --remote --file migrations-finance/0003_payroll_per_sesi.sql
```

Migrasi ini berpasangan dengan `migrations/0144_absensi_guru_kunci.sql` di DB
**utama** (bukan DB keuangan). Tanpa 0144, payroll akan selalu menolak
menghitung karena mengira rekap absensi belum pernah dikunci.

Cara termudah untuk pemasangan baru, jalankan skrip pembantu — ia menjalankan
kesembilan berkas berurut dan berhenti sendiri di kegagalan pertama:

```
python scripts/apply-finance-migration.py eskahade-finance
```

Kalau ingin manual, satu berkas satu perintah:

```
npx wrangler d1 execute eskahade-finance --remote --file migrations-finance/0001a_drop_legacy.sql
```

### Verifikasi setelah berkas terakhir

```bash
npx wrangler d1 execute eskahade-finance --remote --command "SELECT type,COUNT(*) FROM sqlite_master WHERE name LIKE 'finance_%' OR name='student_credentials' GROUP BY type;"
```

Harus menghasilkan **37 tabel, 21 trigger, 24 index, 17 akun**. Jangan menyaring
trigger dengan `name LIKE 'finance_%'` — nama trigger diawali `trg_`, jadi filter
itu selalu melaporkan nol secara diam-diam. Kalau meleset, jangan
lanjut — pulihkan dari export.

Untuk `DEMO_FINANCE_DB`, jalankan kesembilan berkas yang sama ditambah
`0002_demo_sandbox_reset.sql`.

---

## 3. Setelah migrasi

1. Isi secret sesuai `docs/finance-env.example`. Jangan memakai secret yang sama
   untuk JWT, HMAC credential, dan enkripsi rekening.
2. Pastikan callback Duitku di dashboard provider menunjuk ke
   `/api/finance/gateway/duitku/callback` dan
   `/api/finance/gateway/duitku/payout-callback`.
3. Buat unit kas, rekening penerima, kebijakan limit, PIN santri, dan credential
   QR pilot 20–50 kartu.
4. Uji sandbox: cash-in, callback replay, settlement, payout, callback payout,
   dan checklist rekonsiliasi.
5. Pilih satu asrama pilot lewat setting `finance_legacy_mode`. Set
   `new_system_enabled=true`, `pilot_asrama`, dan masukkan asrama yang sama ke
   `auto_wallet_worker_disabled_cohorts`.
6. Jalankan satu siklus bulanan penuh, bereskan semua selisih rekonsiliasi, tutup
   buku, lalu uji restore sebelum menambah asrama berikutnya.

Contoh setting pilot:

```json
{
  "new_system_enabled": true,
  "pilot_asrama": "Nama Asrama Pilot",
  "legacy_new_writes_disabled": false,
  "auto_wallet_worker_disabled_cohorts": ["Nama Asrama Pilot"]
}
```

---

## 4. Kontrol yang tetap wajib sebelum produksi

- Onboarding payment dan disbursement Duitku sudah aktif. Disbursement memakai
  dua tahap inquiry–transfer dan menunggu callback sebelum dianggap sukses.
- Telaah tertulis model titipan dan pencairan cash selesai.
- Cloudflare berbayar, backup D1 harian, arsip bulanan, dan salinan luar lokasi
  sudah berjalan. Restore diuji dan dicatat minimal tiap kuartal.
- Retensi jurnal dan dokumen pembukuan minimal 10 tahun.
- Minimal dua scanner QR, keypad privat, dan koneksi cadangan lulus uji beban.
- **Yang mengajukan pencairan bukan yang menyetujui.** Ini satu-satunya kendali
  tersisa pada uang keluar, dan ditegakkan trigger database — bukan hanya UI.
  Pastikan benar-benar ada dua orang berbeda yang aktif.
- **Yang mendaftarkan rekening penerima bukan yang memverifikasi.**

Perhatikan: admin teknis kini **tidak punya jalan masuk** ke panel keuangan.
Break-glass dihapus. Kalau admin memang perlu mengurus keuangan, beri dia peran
bendahara secara eksplisit.

---

## 5. Perintah verifikasi

```bash
npm run test:finance
```

```bash
npx tsc --noEmit --pretty false
```

```bash
npm run build
```

`test:finance` membangun D1 lokal terisolasi lalu menjalankan 77 pemeriksaan di
lima berkas:

| Berkas | Cakupan |
|---|---|
| `test-finance-schema.py` | struktur skema, jurnal seimbang, immutability, dompet tidak negatif, tiga limit penarikan |
| `test-finance-payroll.py` | potongan alfa/badal termasuk guru dibayar penuh dan potongan melebihi gaji |
| `test-finance-payout.py` | maker-checker, larangan self-approval, rekening belum diverifikasi |
| `test-finance-gateway.py` | idempotensi & replay callback Duitku, tiga lapis pengaman |
| `test-finance-demo-seed.py` | setiap tabel & kolom yang disebut demo-seed benar-benar ada |

Uji terakhir itu penting karena kesalahan di `demo-seed.ts` tidak tertangkap
TypeScript — isinya string SQL — dan baru meledak saat admin menekan Reset Data
Demo.

---

## 6. Sandbox interaktif

- Buat minimal dua user berperan `demo` bila ingin menguji alur maker-checker
  tanpa melanggar larangan self-approval.
- Login sebagai user demo mengarahkan data aplikasi ke `DEMO_DB` dan seluruh data
  keuangan ke `DEMO_FINANCE_DB`.
- Reset baseline dilakukan admin asli lewat **Pengaturan → Fitur & Akses → Reset
  Data Demo**. Reset menyentuh kedua database demo dan tidak menyentuh produksi.
- Baseline loket memakai QR `SKH1.DEMO.SANTRI.0001.TEST.CREDENTIAL` dan PIN
  `123456`.
- Di sandbox, guru pertama sengaja punya tarif potongan alfa/badal dan guru kedua
  bertarif nol, supaya kedua perilaku payroll langsung terlihat.
- Payment dan payout dari akun demo disimulasikan di dalam aplikasi dan tidak
  pernah memanggil endpoint Duitku, meskipun environment produksi sedang aktif.

---

## 7. Kredensial santri

Hanya QR. Mode RFID, HYBRID, dan transisi bertahap sudah dihapus seluruhnya —
tidak ada lagi dua metode berjalan bersamaan.

Token QR disimpan terenkripsi memakai `FINANCE_ENCRYPTION_KEY`, sedangkan
pencocokan tetap lewat HMAC. Token mentah tidak pernah dikirim ke client saat
export kartu. Credential berstatus `LOST` atau `REVOKED` tidak pernah bisa
diaktifkan kembali.

Kolom `mode` di `finance_credential_policy` sengaja dipertahankan meski hanya
menerima satu nilai, supaya penambahan RFID di kemudian hari cukup melonggarkan
satu CHECK tanpa migrasi ulang.

PDF kartu memakai A4 portrait, delapan kartu CR80 per lembar, dengan pasangan
halaman belakang yang dicerminkan untuk duplex long-edge.

---

## 8. Database terpasang

- `FINANCE_DB` → `eskahade-finance` (`8388b81f-c5c7-4523-9a72-437f947331a1`)
- `DEMO_FINANCE_DB` → `eskahade-demo-finance` (`c610762b-dec7-4b83-b5f4-5d5ab3036f43`)

Jangan pernah menerapkan migrasi `migrations-finance/` ke DB aplikasi utama, dan
sebaliknya jangan menerapkan `migrations/` ke database keuangan.
