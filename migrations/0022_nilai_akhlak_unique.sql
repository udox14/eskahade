-- ============================================================
-- migration 0022 — UNIQUE constraint untuk nilai_akhlak
-- Diperlukan agar ON CONFLICT(riwayat_pendidikan_id, semester)
-- bisa berjalan di fitur input kepribadian santri.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_nilai_akhlak_riwayat_semester
  ON nilai_akhlak(riwayat_pendidikan_id, semester);
