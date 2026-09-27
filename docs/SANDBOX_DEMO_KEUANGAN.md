# Sandbox Demo — Sistem Keuangan Baru

Dokumen ini menjelaskan cara memakai **akun demo** untuk mencoba-coba modul keuangan
(terbit kartu, cetak, reset PIN, dan lainnya) **tanpa menyentuh database produksi**,
serta batasan yang masih ada.

---

## 1. Kenapa akun demo aman dipakai untuk uji coba

`lib/db/index.ts` mengarahkan **seluruh** query dari session dengan role `demo`
ke binding `DEMO_DB` (database `eskahade-demo-db`), bukan ke `DB` (produksi):

```
// lib/db/index.ts
if (await isDemoRequest()) return env.DEMO_DB
...
return env.DB
```

Konsekuensinya: apa pun yang Anda terbitkan, cetak, atau ubah saat login sebagai
akun demo **tidak pernah masuk ke data pesantren yang sebenarnya**.

---

## 2. Status sandbox (per sinkronisasi terakhir)

Database `eskahade-demo-db` diselaraskan dengan skema Sistem Keuangan Baru memakai
`scripts/sync-demo-db-finance.cjs`.

| Aspek | Nilai |
| --- | --- |
| Tabel `finance_*` | 27 (setara produksi) |
| Trigger keuangan | 7 |
| Santri demo aktif | 6 (`demo-s-1` … `demo-s-6`) |
| Asrama | AL-FALAH, AS-SALAM, BAHAGIA |
| Kartu / PIN | 0 (baseline bersih) |
| Tarif baseline | 5 (SPP, USPP, EHB, EKSKUL, KESEHATAN) |

Karena kartu masih 0, modul **Kredensial** menampilkan seluruh 6 santri sebagai
"Belum Ada Kartu" — kondisi ideal untuk mencoba *Terbitkan Kartu Massal* dan cetak.

---

## 3. Cara memakai

1. Login memakai **akun demo** — email `demo@eskahade.com`, role `demo`
   (akun ini hanya ada di `eskahade-demo-db`).
2. Buka `/dashboard/keuangan/kredensial`.
3. Semua aksi (terbitkan, cetak, PIN) hanya menyentuh `eskahade-demo-db`.

Untuk mengembalikan sandbox ke kondisi bersih:

```bash
node scripts/reset-kredensial-cards.cjs --db eskahade-demo-db
node scripts/reset-kredensial-cards.cjs --db eskahade-demo-db --apply --confirm eskahade-demo-db
```

Perintah pertama adalah dry-run (tidak mengubah apa pun). Untuk melatih ulang
skema dari nol, jalankan `scripts/sync-demo-db-finance.cjs`.

---

## 3a. Tiga perbaikan yang membuat akun demo benar-benar bisa dipakai (dan aman)

### (a) Rute login tidak menemukan akun demo

`getDB()` hanya mengarahkan query ke `DEMO_DB` ketika request sudah membawa cookie
session ber-role `demo`. Pada saat login cookie itu belum ada, sehingga query
`SELECT ... FROM users WHERE email = ?` selalu membaca DB produksi — dan akun demo
tidak ada di sana. Ini masalah ayam-telur.

Perbaikan di `app/api/auth/login/route.ts`: bila akun tidak ditemukan di DB utama,
login mencari ke `DEMO_DB` lewat `findDemoAccount()`, dengan pengaman **akun itu
wajib ber-role `demo`**. Akun non-demo di `DEMO_DB` ditolak, sehingga sandbox tidak
bisa dipakai untuk masuk sebagai admin/bendahara asli.

### (b) Modul keuangan tidak mengenal role `demo`

Gerbang halaman (`lib/auth/guard.ts`) memperlakukan `demo` setara admin, tetapi
fungsi `authorizeUser()` di modul-modul keuangan tidak menyertakan `demo` pada
daftar role-nya. Akibatnya `canMutate = false` dan UI menampilkan "View Only".

Perbaikan: konsep "akses penuh untuk demo" dipusatkan di `lib/auth/session.ts`
(`FINANCE_MUTATE_ROLES`, `hasFinanceMutateRole`, `getPrimaryFinanceRole`) dan
dipakai oleh modul: kredensial, uang jajan, status pembayaran, rekonsiliasi,
tarif, penyaluran, serta loket koperasi.

### (c) Akun ber-role `demo` di DB PRODUKSI harus tetap read-only

Ada dua akun berbeda di lingkungan ini, dan ini mudah tertukar:

| Akun | Ada di | Efek |
| --- | --- | --- |
| `demo@eskahade.com` | **DEMO_DB** saja | login → diarahkan ke sandbox → boleh menulis |
| `demo@sukahideng.or.id` | **DB produksi** saja | login → tetap di DB produksi → wajib read-only |

Karena `guardPage()` memperlakukan role `demo` setara admin, akun demo produksi itu
bisa menembus gerbang halaman. Sebelum (c) dikerjakan, langkah (b) sempat membuat
akun tersebut memperoleh hak tulis ke **data pesantren sebenarnya** — persis yang
ingin dihindari.

Penyelesaiannya: hak tulis untuk role `demo` tidak lagi ditentukan oleh nama role,
melainkan oleh **klaim `demoSandbox` pada token sesi**. Klaim itu diisi oleh rute
login **hanya** ketika akun benar-benar ditemukan di `DEMO_DB`. Akibatnya:

- `demo@eskahade.com` → `demoSandbox: true` → boleh menulis (di sandbox);
- `demo@sukahideng.or.id` → `demoSandbox: false` → read-only di produksi;
- sesi lama tanpa klaim → dianggap `false` (default paling aman).

Hasil verifikasi:

- Uji unit 12 kasus kombinasi sesi (`scratch/uji-guard.cjs`, sudah dihapus):
  demo sandbox `true`, demo produksi `false`, sesi lama tanpa klaim `false`,
  admin/bendahara/koperasi tetap `true`, pimpinan/tester tetap `false`.
- Login demo sandbox sungguhan lewat HTTP: halaman kredensial merender 6 dropdown
  aksi dan **tidak ada** teks "View Only"; `issueCardAction` berhasil
  (HTTP 200, `{"success":true}`) dan kartu tercatat di `eskahade-demo-db`
  dengan `issued_by` = id akun demo; database produksi tidak berubah.

---

## 4. Batasan yang perlu diketahui

### 4.1 Tahun ajaran

Demo hanya punya satu tahun ajaran aktif: `id=1, '1446-1447 H'`. Nama ini
**bukan** format Gregorian yang dicari modul keuangan
(`lib/finance/bridge.ts` dan `lib/finance/obligations.ts` mencari nama seperti
`2026/2027`). Akibatnya:

- **Kredensial / kartu / PIN: tidak terpengaruh** — modul ini tidak menyentuh tahun ajaran.
- **Materialisasi kewajiban (tagihan) akan gagal** dengan pesan jelas
  ("Tahun ajaran ... belum terdaftar di master tahun_ajaran").

Sinkronisasi menambahkan `id=2, '2026/2027'` dengan `is_active = 0` **khusus**
untuk memenuhi foreign key seed tarif di migrasi `0167`. Angka itu sengaja tidak
diaktifkan: kelas demo terikat ke tahun ajaran aktif (`id=1`), sehingga
mengaktifkan `2026/2027` akan mengosongkan dashboard dan rekap akademik demo.

Bila Anda ingin mencoba alur tagihan/pembayaran penuh di demo, aktifkan tahun
ajaran Gregorian secara sadar:

```sql
UPDATE tahun_ajaran SET is_active = 0 WHERE id = 1;
UPDATE tahun_ajaran SET is_active = 1 WHERE id = 2;
-- lalu daftarkan kelas demo ke tahun ajaran 2 agar filter tetap menemukan data
```

### 4.2 Provider katering & laundry

`master_jasa` belum di-seed di demo. Kewajiban **UANG_MAKAN** dan **UANG_NYUCI**
membutuhkan `santri.tempat_makan_id` / `tempat_mencuci_id` yang menunjuk ke
`master_jasa` dengan `jenis` yang sesuai. Alur tagihan penuh perlu data ini;
alur kartu tidak.

### 4.3 `app/api/demo/reset/route.ts` belum sadar-finance

Route reset demo (`DATA_TABLES`) **belum memuat satu pun tabel `finance_*`**,
padahal ia menjalankan `DELETE FROM santri` dan `DELETE FROM tahun_ajaran` di
dalam `try/catch` yang menelan error. Begitu ada baris `finance_*` yang mengacu
ke `santri`, delete tersebut gagal karena foreign key, error-nya tertelan, dan
baris lama tertinggal — sehingga insert ulang berisiko `UNIQUE constraint failed`.

Route itu juga tidak menyemai `finance_tariffs`, jadi setelah reset demo modul
keuangan tidak punya tarif yang bisa dipakai.

**Ini belum diperbaiki** dan sebaiknya dikerjakan sebelum sandbox dipakai
sebagai alat uji rutin. Perbaikannya: tambahkan tabel `finance_*` ke
`DATA_TABLES` dengan urutan aman terhadap FK, dan semai ulang tarif baseline.

### 4.4 Migrasi 0169 & 0170 tidak diterapkan

Keduanya bukan bagian fitur keuangan: `0169` membuat tabel `absensi_guru_kunci*`
dan `0170` membuat tabel `dashboard_*`, yang keduanya belum ada di demo.
Melewatkannya tidak memengaruhi modul kredensial. Modul terkait (mis. Dashboard
Home) belum bisa dipakai di sandbox sampai migrasinya diterapkan.

---

## 5. Catatan operasional

- Migrasi `ALTER TABLE ... ADD COLUMN` **tidak idempoten** (SQLite tidak punya
  `ADD COLUMN IF NOT EXISTS`), sehingga `scripts/sync-demo-db-finance.cjs` tidak
  dirancang untuk dijalankan ulang penuh. Script mendeteksi bila sinkronisasi
  sudah selesai dan berhenti dengan pesan jelas. Untuk memaksa satu berkas,
  gunakan `--only <prefix>`.
- Migrasi `0167` menyeed tarif dengan `academic_year_id = 2` yang di-hardcode.
  Ini asumsi data produksi; di lingkungan lain angka itu bisa tidak ada dan
  `INSERT OR IGNORE` **tidak** menolong karena pelanggaran foreign key tidak
  di-suppress oleh `OR IGNORE`.
