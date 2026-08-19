# Arsip migrasi keuangan sebelum penyederhanaan

Berkas di folder ini **tidak boleh dijalankan lagi**. Semuanya digantikan oleh
`0001a_drop_legacy.sql` sampai `0001h_seed.sql` di folder induk.

Disimpan sebagai referensi sejarah, terutama:

- `0009_repair_0007_finance_bills.sql` — catatan insiden 16 Agustus 2026, ketika
  migrasi `0007` gagal separuh di produksi dan menghilangkan tabel
  `finance_bills`. Isinya menjelaskan kenapa migrasi sekarang dipecah menjadi
  delapan berkas dengan seluruh trigger di berkas terakhir.
- `0001_finance_centralized_core.sql` — skema lama 862 baris, berguna untuk
  membandingkan struktur sebelum dan sesudah.

Skema aktif dibangun ulang dari nol, bukan hasil migrasi bertahap dari berkas di
sini. Itu sah karena sistem belum pernah dipakai memindahkan uang sungguhan
ketika penggantian dilakukan.
