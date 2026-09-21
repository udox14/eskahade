-- Migration: 0169_absensi_finalized.sql
-- Model: Authoritative Period-Level Attendance Finalization
-- Mencatat periode verifikasi absensi pengajaran yang telah diselesaikan oleh Sekpen.
-- Periode berstatus 'FINAL' menjadi sumber penentu data absensi yang sah di Portal Orang Tua.
-- TIDAK memodifikasi tabel absensi_harian historis dan TIDAK melakukan auto-finalize data masa lalu.

CREATE TABLE IF NOT EXISTS absensi_verifikasi_periode (
  id TEXT PRIMARY KEY,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'FINAL' CHECK(status IN ('FINAL', 'REOPENED')),
  verified_by TEXT REFERENCES users(id),
  verified_at TEXT NOT NULL,
  reopened_by TEXT REFERENCES users(id),
  reopened_at TEXT,
  reopen_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tanggal_mulai, tanggal_selesai)
);

CREATE INDEX IF NOT EXISTS idx_absensi_verif_periode_lookup
  ON absensi_verifikasi_periode(tanggal_mulai, tanggal_selesai, status);

CREATE INDEX IF NOT EXISTS idx_absensi_verif_periode_status
  ON absensi_verifikasi_periode(status, tanggal_mulai);
