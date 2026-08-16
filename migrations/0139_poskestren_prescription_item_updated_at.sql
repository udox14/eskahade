-- Migration 0139: tambah kolom updated_at pada poskestren_prescription_item.
-- deliverVisitMedicines (app/dashboard/poskestren/pemeriksaan/actions.ts) menulis
-- updated_at saat mencatat jumlah obat yang diserahkan, tapi kolom ini belum
-- pernah dibuat di 0124_poskestren.sql — setiap penyerahan obat dengan qty > 0
-- gagal dengan "no such column: updated_at".

ALTER TABLE poskestren_prescription_item ADD COLUMN updated_at TEXT;
