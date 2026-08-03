-- Pastikan Bendahara dapat mengonfirmasi dan membatalkan konfirmasi
-- Setoran SPP Santri Baru.
--
-- Migration 0116 menambahkan akses baca ke fitur_akses setelah migration
-- CRUD 0044 berjalan, sehingga baris izin update untuk Bendahara tidak
-- otomatis terbentuk. Server action konfirmasi memakai action `update`.

INSERT INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
VALUES
  ('/dashboard/keuangan/setoran-spp-baru', 'bendahara', 0, 1, 0, datetime('now'), datetime('now'))
ON CONFLICT(fitur_href, role) DO UPDATE SET
  can_update = 1,
  updated_at = datetime('now');
