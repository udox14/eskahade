# AGENTS.md

## Sistem Keuangan Baru

Untuk semua pekerjaan yang berkaitan dengan **Sistem Keuangan Baru**, wajib membaca dokumen berikut sebelum membuat perubahan:

- `docs/SISTEM_KEUANGAN_BARU_PRD.md`
- `docs/UI_UX_GUIDELINES.md`

Jika lokasi file di repository berbeda, gunakan file dengan nama yang sama pada lokasi aktualnya.

## Source of Truth

- `SISTEM_KEUANGAN_BARU_PRD.md` = source of truth untuk business rules dan requirement produk.
- `UI_UX_GUIDELINES.md` = source of truth untuk UI/UX.
- Codebase existing = source of truth untuk struktur teknis, pola arsitektur, komponen, dan integrasi yang sudah ada.

Jika terdapat konflik antara requirement dan kondisi codebase, **jangan diam-diam mengubah requirement**. Identifikasi konflik, jelaskan dampaknya, dan pilih solusi yang paling aman serta paling sedikit merusak sistem existing.

## Aturan Wajib

1. Audit dan reuse implementasi existing sebelum membuat model, service, API, komponen, atau master data baru.
2. Jangan menduplikasi data santri, orang tua, provider katering/laundry, authentication, role, atau data existing lainnya.
3. Jangan melakukan refactor besar di luar scope task.
4. Jangan mengganti UI framework/design system tanpa kebutuhan eksplisit.
5. Jangan menambahkan dependency baru jika kemampuan yang dibutuhkan sudah tersedia di project.
6. Jangan melakukan hard delete terhadap transaksi keuangan.
7. Jangan mengubah histori transaksi finansial secara destruktif.
8. Operasi finansial multi-step harus atomik.
9. Integrasi payment gateway harus idempotent.
10. Nominal uang harus divalidasi di server; jangan mempercayai nominal dari frontend.
11. Prioritaskan keamanan, integritas data, auditability, dan kompatibilitas dengan sistem existing.
12. Jangan menyederhanakan business rule hanya agar implementasi lebih mudah.
13. Jangan membuat solusi sementara yang diketahui akan memaksa refactor besar berikutnya.
14. Kerjakan hanya scope/fase yang diminta. Jangan otomatis melanjutkan ke fase berikutnya.
15. Jalankan test/check relevan setelah perubahan dan laporkan hasilnya.

## Aturan UI/UX

UI Sistem Keuangan Baru harus:

- modern;
- bersih;
- profesional;
- ringan;
- mudah dipahami pengguna non-akuntan;
- konsisten dengan aplikasi existing.

Hindari:

- generic admin-dashboard look;
- banking-style UI;
- card berlebihan;
- badge berlebihan;
- gradient/shadow berlebihan;
- tabel terlalu padat;
- jargon backend di UI.

Reuse komponen existing jika layak.

Untuk implementasi UI baru, **Status Pembayaran** adalah benchmark visual utama sebelum pola diperluas ke modul lain.

## Financial Model

Jaga pemisahan konsep berikut:

`Obligation → Payment Order → Payment → Allocation → Settlement → Distribution`

Serta perlakukan secara terpisah:

- Refund
- Reversal
- Void
- Uang Jajan Ledger
- Cash Session
- Reconciliation

Jangan menyatukan semuanya ke satu model transaksi sederhana jika hal tersebut menghilangkan auditability atau business meaning.

## Database & Migration

Migration harus aman dan non-destructive.

Sebelum mengubah schema:

1. audit schema existing;
2. cek dependency;
3. hindari drop table/column/data;
4. pertimbangkan backward compatibility;
5. gunakan transaction/migration strategy yang aman;
6. siapkan rollback jika relevan.

## Cara Bekerja

Untuk task kompleks:

1. baca dokumen yang relevan;
2. audit area codebase yang terkait;
3. tentukan scope minimum;
4. implementasikan hanya scope tersebut;
5. jalankan test/check;
6. ringkas perubahan, risiko, dan hal yang belum dikerjakan.

Jangan membaca atau mengubah bagian repository yang tidak relevan tanpa alasan.

Jika task hanya menyentuh satu submodul, baca bagian PRD/UI guideline yang relevan dan konteks teknis terkait; tidak perlu mengulang eksplorasi seluruh repository jika audit sebelumnya masih valid dan terdokumentasi.

## Implementation Plan

Jika tersedia:

- `docs/IMPLEMENTATION_PLAN.md`

gunakan dokumen tersebut sebagai panduan urutan implementasi, tetapi PRD tetap memiliki prioritas lebih tinggi untuk business rule.

Jangan menganggap implementation plan sebagai izin untuk mengerjakan semua fase sekaligus.

## Completion

Sebelum menyatakan task selesai, pastikan:

- scope yang diminta benar-benar selesai;
- tidak ada perubahan tidak terkait;
- tidak ada business rule PRD yang dilanggar;
- test/check relevan sudah dijalankan;
- perubahan finansial tetap auditable;
- UI mengikuti guideline jika task menyentuh UI.
