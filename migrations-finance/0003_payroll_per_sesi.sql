-- Migrasi keuangan 0003 - payroll bersatuan SESI dan ditarik dari rekap absensi guru.
--
-- Sebelumnya operator mengetik "jumlah hari alfa" dan "jumlah hari badal" secara
-- manual, sementara sumber kebenarannya (rekap absensi guru) menghitung per
-- SESI: shubuh, ashar, dan maghrib dihitung terpisah, sehingga satu guru bisa
-- punya tiga waktu wajib dalam sehari. Memasukkan angka sesi ke kolom bersatuan
-- hari akan melipatgandakan potongan sampai tiga kali. Satuannya disamakan ke
-- sesi, bukan angkanya yang dikonversi, supaya potongan tetap sebanding dengan
-- kewajiban mengajar yang benar-benar ditinggalkan.
--
-- Dijalankan SETELAH 0001a-0001h. Tidak idempotent: ALTER TABLE RENAME COLUMN
-- gagal bila dijalankan dua kali, dan itu memang disengaja agar penerapan ganda
-- ketahuan, bukan diam-diam terlewat.

-- Tarif potongan: per hari -> per sesi.
ALTER TABLE finance_teacher_compensation
  RENAME COLUMN alfa_deduction_per_day_rupiah TO alfa_deduction_per_sesi_rupiah;
ALTER TABLE finance_teacher_compensation
  RENAME COLUMN badal_deduction_per_day_rupiah TO badal_deduction_per_sesi_rupiah;

-- Jumlah yang dipotong: hari -> sesi.
ALTER TABLE finance_payroll_items RENAME COLUMN alfa_days TO alfa_sesi;
ALTER TABLE finance_payroll_items RENAME COLUMN badal_days TO badal_sesi;

-- Konteks rekap ikut dibekukan bersama angka potongannya. Tanpa ini slip gaji
-- hanya bisa menyebut "3 sesi alfa" tanpa pembaginya, dan guru yang keberatan
-- tidak punya angka pembanding.
ALTER TABLE finance_payroll_items ADD COLUMN wajib_sesi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE finance_payroll_items ADD COLUMN hadir_sesi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE finance_payroll_items ADD COLUMN attendance_synced_at TEXT;

-- Kapan rekap absensi bulan ini dikunci sekpen, dicatat saat payroll dihitung.
-- Dibandingkan dengan kunci terkini untuk mendeteksi perhitungan yang basi:
-- sekpen membuka kunci, mengoreksi, lalu mengunci lagi setelah bendahara
-- terlanjur menghitung.
ALTER TABLE finance_payroll_periods ADD COLUMN attendance_locked_at TEXT;
