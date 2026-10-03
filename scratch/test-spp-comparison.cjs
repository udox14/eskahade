const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runD1Sql(sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim().replace(/"/g, '\\"');
  const res = execSync(`npx wrangler d1 execute eskahade-db --remote --command "${oneLine}" --json`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024
  });
  const jsonStart = res.indexOf('[');
  const jsonEnd = res.lastIndexOf(']');
  const json = JSON.parse(res.slice(jsonStart, jsonEnd + 1));
  return json[0].results;
}

const tahun = 2026;
const currentMonth = 7;
const currentYear = 2026;
const currentMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
const nextMo = currentMonth === 12 ? 1 : currentMonth + 1;
const nextYr = currentMonth === 12 ? currentYear + 1 : currentYear;
const currentMonthEnd = `${nextYr}-${String(nextMo).padStart(2, '0')}-01`;
const unit = 'AL-FALAH';

console.log('Comparing OLD vs NEW SPP queries on live D1 for unit:', unit);

const oldSql = `
WITH
  base_santri AS (
    SELECT id, nama_lengkap, tanggal_masuk, created_at, COALESCE(bebas_spp, 0) AS bebas_spp
    FROM santri
    WHERE status_global = 'aktif' AND (kategori_santri IS NULL OR kategori_santri != 'SADESA') AND asrama = '${unit}'
  ),
  bayar_ini AS (
    SELECT DISTINCT santri_id
    FROM spp_log
    WHERE tahun = ${tahun} AND bulan = ${currentMonth} AND tujuan_setoran = 'DEWAN_SANTRI'
  ),
  ditiadakan_ini AS (
    SELECT DISTINCT santri_id
    FROM spp_tagihan_ditiadakan
    WHERE tahun = ${tahun} AND bulan = ${currentMonth} AND is_active = 1
    UNION
    SELECT DISTINCT bs.id AS santri_id
    FROM base_santri bs
    JOIN santri s ON s.id = bs.id
    WHERE CASE WHEN ${currentMonth} = 7 AND ( ( EXISTS (SELECT 1 FROM psb_flow pf WHERE pf.santri_id = s.id) AND COALESCE( NULLIF(CAST(s.tahun_masuk AS INTEGER), 0), CAST(substr(s.tanggal_masuk, 1, 4) AS INTEGER) ) = ${tahun} ) OR 'REGULER' = 'BARU' ) THEN 'BENDAHARA_PUSAT' ELSE 'DEWAN_SANTRI' END = 'BENDAHARA_PUSAT'
  ),
  uang_masuk_bulan_ini AS (
    SELECT sl.santri_id, sl.nominal_bayar, sl.bulan, sl.tahun
    FROM spp_log sl
    WHERE sl.tanggal_bayar >= '${currentMonthStart}' AND sl.tanggal_bayar < '${currentMonthEnd}' AND sl.tujuan_setoran = 'DEWAN_SANTRI'
  ),
  uang_historis_masuk_bulan_ini AS (
    SELECT th.santri_id, th.nominal_tagihan
    FROM spp_tunggakan_historis th
    WHERE th.status = 'LUNAS' AND th.tanggal_lunas >= '${currentMonthStart}' AND th.tanggal_lunas < '${currentMonthEnd}'
  )
SELECT
  bs.id, bs.nama_lengkap, bs.tanggal_masuk, bs.created_at, bs.bebas_spp,
  CASE WHEN di.santri_id IS NOT NULL THEN 1 ELSE 0 END AS ditiadakan_ini,
  CASE WHEN bi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bayar_ini,
  COALESCE(um.nominal_bayar, 0) AS nominal_bayar_masuk,
  COALESCE(um.bulan, 0) AS bulan_tagihan_dibayar,
  COALESCE(um.tahun, 0) AS tahun_tagihan_dibayar,
  COALESCE(uh.nominal_tagihan, 0) AS nominal_historis_masuk
FROM base_santri bs
LEFT JOIN ditiadakan_ini di ON di.santri_id = bs.id
LEFT JOIN bayar_ini bi ON bi.santri_id = bs.id
LEFT JOIN uang_masuk_bulan_ini um ON um.santri_id = bs.id
LEFT JOIN uang_historis_masuk_bulan_ini uh ON uh.santri_id = bs.id;
`;

const newSantriSql = `
WITH base_santri AS (
  SELECT id, nama_lengkap, tanggal_masuk, created_at, COALESCE(bebas_spp, 0) AS bebas_spp
  FROM santri
  WHERE status_global = 'aktif' AND (kategori_santri IS NULL OR kategori_santri != 'SADESA') AND asrama = '${unit}'
)
SELECT
  bs.id, bs.nama_lengkap, bs.tanggal_masuk, bs.created_at, bs.bebas_spp,
  EXISTS (
    SELECT 1 FROM spp_log sl
    WHERE sl.santri_id = bs.id AND sl.tahun = ${tahun} AND sl.bulan = ${currentMonth} AND sl.tujuan_setoran = 'DEWAN_SANTRI'
  ) AS bayar_ini,
  (
    EXISTS (
      SELECT 1 FROM spp_tagihan_ditiadakan td
      WHERE td.santri_id = bs.id AND td.tahun = ${tahun} AND td.bulan = ${currentMonth} AND td.is_active = 1
    )
    OR (
      CASE WHEN ${currentMonth} = 7 AND ( ( EXISTS (SELECT 1 FROM psb_flow pf WHERE pf.santri_id = s.id) AND COALESCE( NULLIF(CAST(s.tahun_masuk AS INTEGER), 0), CAST(substr(s.tanggal_masuk, 1, 4) AS INTEGER) ) = ${tahun} ) OR 'REGULER' = 'BARU' ) THEN 'BENDAHARA_PUSAT' ELSE 'DEWAN_SANTRI' END = 'BENDAHARA_PUSAT'
    )
  ) AS ditiadakan_ini
FROM base_santri bs
JOIN santri s ON s.id = bs.id;
`;

const newUangSql = `
SELECT sl.santri_id, sl.nominal_bayar, sl.bulan, sl.tahun
FROM spp_log sl
WHERE sl.tanggal_bayar >= '${currentMonthStart}' AND sl.tanggal_bayar < '${currentMonthEnd}'
  AND sl.tujuan_setoran = 'DEWAN_SANTRI'
  AND sl.santri_id IN (
    SELECT id FROM santri
    WHERE status_global = 'aktif' AND (kategori_santri IS NULL OR kategori_santri != 'SADESA') AND asrama = '${unit}'
  );
`;

const newHistorisSql = `
SELECT th.santri_id, th.nominal_tagihan
FROM spp_tunggakan_historis th
WHERE th.status = 'LUNAS'
  AND th.tanggal_lunas >= '${currentMonthStart}' AND th.tanggal_lunas < '${currentMonthEnd}'
  AND th.santri_id IN (
    SELECT id FROM santri
    WHERE status_global = 'aktif' AND (kategori_santri IS NULL OR kategori_santri != 'SADESA') AND asrama = '${unit}'
  );
`;

const oldRows = runD1Sql(oldSql);
const newSantri = runD1Sql(newSantriSql);
const newUang = runD1Sql(newUangSql);
const newHistoris = runD1Sql(newHistorisSql);

console.log('Sample oldRow:', oldRows[0]);
console.log('Sample newSantri:', newSantri[0]);
console.log('Sample newUang:', newUang[0]);
console.log('Sample newHistoris:', newHistoris[0]);

// OLD CALCULATION
let old_totalSantri = 0;
let old_bebasSppCount = 0;
let old_bayarIni = 0;
let old_ditiadakanIni = 0;
let old_uangTotal = 0;
let old_uangTunggakan = 0;
let old_uangHarusSetor = 0;
const processed = new Set();

for (const r of oldRows) {
  if (!processed.has(r.id)) {
    old_totalSantri++;
    if (r.bebas_spp === 1) {
      old_bebasSppCount++;
    } else {
      if (r.ditiadakan_ini === 1) old_ditiadakanIni++;
      if (r.bayar_ini === 1) old_bayarIni++;
    }
    processed.add(r.id);
  }
  const uangMasuk = r.nominal_bayar_masuk + r.nominal_historis_masuk;
  old_uangTotal += uangMasuk;
  if (uangMasuk > 0) {
    if (r.nominal_historis_masuk > 0) {
      old_uangTunggakan += r.nominal_historis_masuk;
    }
    if (r.nominal_bayar_masuk > 0) {
      const isTunggakan = (r.tahun_tagihan_dibayar * 100 + r.bulan_tagihan_dibayar) < (tahun * 100 + currentMonth);
      if (isTunggakan) {
        old_uangTunggakan += r.nominal_bayar_masuk;
      } else {
        old_uangHarusSetor += r.nominal_bayar_masuk;
      }
    }
  }
}

// NEW CALCULATION
let new_totalSantri = 0;
let new_bebasSppCount = 0;
let new_bayarIni = 0;
let new_ditiadakanIni = 0;

for (const r of newSantri) {
  new_totalSantri++;
  if (r.bebas_spp === 1) {
    new_bebasSppCount++;
  } else {
    if (r.ditiadakan_ini === 1) new_ditiadakanIni++;
    if (r.bayar_ini === 1) new_bayarIni++;
  }
}

let new_uangTotal = 0;
let new_uangTunggakan = 0;
let new_uangHarusSetor = 0;

for (const r of newUang) {
  new_uangTotal += r.nominal_bayar;
  const isTunggakan = (r.tahun * 100 + r.bulan) < (tahun * 100 + currentMonth);
  if (isTunggakan) {
    new_uangTunggakan += r.nominal_bayar;
  } else {
    new_uangHarusSetor += r.nominal_bayar;
  }
}

for (const r of newHistoris) {
  new_uangTotal += r.nominal_tagihan;
  new_uangTunggakan += r.nominal_tagihan;
}

console.log('--- RESULTS ---');
console.log(`totalSantri:     OLD=${old_totalSantri}, NEW=${new_totalSantri}, MATCH=${old_totalSantri === new_totalSantri}`);
console.log(`bebasSppCount:   OLD=${old_bebasSppCount}, NEW=${new_bebasSppCount}, MATCH=${old_bebasSppCount === new_bebasSppCount}`);
console.log(`bayarIni:        OLD=${old_bayarIni}, NEW=${new_bayarIni}, MATCH=${old_bayarIni === new_bayarIni}`);
console.log(`ditiadakanIni:   OLD=${old_ditiadakanIni}, NEW=${new_ditiadakanIni}, MATCH=${old_ditiadakanIni === new_ditiadakanIni}`);
console.log(`uangDiterima:    OLD=${old_uangTotal}, NEW=${new_uangTotal}, MATCH=${old_uangTotal === new_uangTotal}`);
console.log(`uangTunggakan:   OLD=${old_uangTunggakan}, NEW=${new_uangTunggakan}, MATCH=${old_uangTunggakan === new_uangTunggakan}`);
console.log(`uangHarusSetor:  OLD=${old_uangHarusSetor}, NEW=${new_uangHarusSetor}, MATCH=${old_uangHarusSetor === new_uangHarusSetor}`);

if (
  old_totalSantri === new_totalSantri &&
  old_bebasSppCount === new_bebasSppCount &&
  old_bayarIni === new_bayarIni &&
  old_ditiadakanIni === new_ditiadakanIni &&
  old_uangTotal === new_uangTotal &&
  old_uangTunggakan === new_uangTunggakan &&
  old_uangHarusSetor === new_uangHarusSetor
) {
  console.log('\n>>> 100% IDENTICAL MATCH VERIFIED! <<<');
} else {
  console.error('\n>>> MISMATCH DETECTED! <<<');
  process.exit(1);
}
