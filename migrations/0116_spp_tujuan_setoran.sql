-- Pisahkan uang SPP Juli santri baru dari setoran rutin Dewan Santri.
ALTER TABLE spp_log ADD COLUMN tujuan_setoran TEXT NOT NULL DEFAULT 'DEWAN_SANTRI'
  CHECK (tujuan_setoran IN ('DEWAN_SANTRI', 'BENDAHARA_PUSAT'));

UPDATE spp_log
SET tujuan_setoran = 'BENDAHARA_PUSAT'
WHERE bulan = 7
  AND EXISTS (SELECT 1 FROM psb_flow pf WHERE pf.santri_id = spp_log.santri_id)
  AND EXISTS (
    SELECT 1 FROM santri s
    WHERE s.id = spp_log.santri_id
      AND COALESCE(
        NULLIF(CAST(s.tahun_masuk AS INTEGER), 0),
        CAST(substr(s.tanggal_masuk, 1, 4) AS INTEGER)
      ) = spp_log.tahun
  );

INSERT INTO activity_log
  (id, actor_name, actor_roles, module, action, entity_type, entity_id, entity_label, summary, details_json)
VALUES
  (lower(hex(randomblob(16))), 'Migration 0116', '["system"]', 'spp', 'backfill_tujuan_setoran',
   'spp_log', '0116', 'Backfill tujuan setoran',
   'Mengklasifikasi ulang SPP Juli santri baru ke Bendahara Pesantren',
   json_object('jumlah_dialihkan', changes(), 'aturan', 'psb_flow + tahun_masuk = tahun_tagihan + bulan Juli'));

ALTER TABLE spp_setoran ADD COLUMN tujuan_setoran TEXT NOT NULL DEFAULT 'DEWAN_SANTRI'
  CHECK (tujuan_setoran IN ('DEWAN_SANTRI', 'BENDAHARA_PUSAT'));

DROP INDEX IF EXISTS uq_spp_setoran_asrama_bulan_tahun;
DROP INDEX IF EXISTS uq_spp_setoran_unit_setor_bulan_tahun;
CREATE UNIQUE INDEX IF NOT EXISTS uq_spp_setoran_unit_period_tujuan
  ON spp_setoran(unit_setor, bulan, tahun, tujuan_setoran);

CREATE INDEX IF NOT EXISTS idx_spp_log_tujuan_period
  ON spp_log(tujuan_setoran, tahun, bulan);

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('Keuangan Pusat', 'Setoran SPP Santri Baru', '/dashboard/keuangan/setoran-spp-baru', 'Landmark', '["admin","bendahara"]', 1, 4);
