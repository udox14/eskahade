-- Pengurus asrama dapat membaca dan mengajukan perizinan, tetapi tidak
-- mengubah, memproses, atau menghapus data izin/pengajuan.
UPDATE role_fitur_crud_permission
SET
  can_create = 1,
  can_update = 0,
  can_delete = 0,
  updated_at = datetime('now')
WHERE fitur_href = '/dashboard/keamanan/perizinan'
  AND role = 'pengurus_asrama';

