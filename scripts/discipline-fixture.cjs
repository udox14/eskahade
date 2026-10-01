/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path')
function prepare(db) {
 db.exec(`
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,full_name TEXT);
 INSERT OR IGNORE INTO users VALUES('admin','Admin');
 CREATE TABLE IF NOT EXISTS master_pelanggaran(id INTEGER PRIMARY KEY,kategori TEXT,nama_pelanggaran TEXT,poin INTEGER,deskripsi TEXT,urutan INTEGER);
 CREATE TABLE IF NOT EXISTS pelanggaran(id TEXT PRIMARY KEY,santri_id TEXT,tanggal TEXT,jenis TEXT,deskripsi TEXT,poin INTEGER,penindak_id TEXT,created_at TEXT DEFAULT (datetime('now')),master_id INTEGER,foto_url TEXT);
 CREATE TABLE IF NOT EXISTS surat_pernyataan(id TEXT PRIMARY KEY,santri_id TEXT,pelanggaran_ids TEXT,tanggal TEXT,dibuat_oleh TEXT,created_at TEXT);
 CREATE TABLE IF NOT EXISTS surat_perjanjian(id TEXT PRIMARY KEY,santri_id TEXT,level TEXT,tanggal TEXT,catatan TEXT,dibuat_oleh TEXT,created_at TEXT);
 CREATE TABLE IF NOT EXISTS verifikasi_panggilan(id TEXT PRIMARY KEY,santri_id TEXT,periode_awal TEXT,periode_akhir TEXT,keputusan TEXT,snapshot_json TEXT);
 CREATE TABLE IF NOT EXISTS verifikasi_panggilan_vonis(id TEXT PRIMARY KEY,panggilan_id TEXT,periode_awal TEXT,periode_akhir TEXT,santri_id TEXT,source TEXT,tanggal TEXT,sesi TEXT,status_final TEXT,catatan TEXT,pelanggaran_id TEXT,verified_by TEXT,verified_at TEXT,created_at TEXT,updated_at TEXT,UNIQUE(panggilan_id,source,tanggal,sesi));
 CREATE TABLE IF NOT EXISTS pengajian_violations(id TEXT PRIMARY KEY,santri_id TEXT,type_name TEXT,occurred_at TEXT,session TEXT,note TEXT,status TEXT,created_by TEXT,created_at TEXT);
 CREATE TABLE IF NOT EXISTS absensi_harian(id TEXT PRIMARY KEY,riwayat_pendidikan_id TEXT,tanggal TEXT,shubuh TEXT,ashar TEXT,maghrib TEXT,verif_shubuh TEXT,verif_ashar TEXT,verif_maghrib TEXT);
 CREATE TABLE IF NOT EXISTS riwayat_pendidikan(id TEXT PRIMARY KEY,santri_id TEXT,kelas_id TEXT,status_riwayat TEXT);
 CREATE TABLE IF NOT EXISTS absen_berjamaah(santri_id TEXT,tanggal TEXT,shubuh TEXT,dzuhur TEXT,ashar TEXT,maghrib TEXT,isya TEXT,created_by TEXT,UNIQUE(santri_id,tanggal));
 `)
 const columns=new Set(db.prepare('PRAGMA table_info(pelanggaran)').all().map(r=>r.name))
 for(const [name,type] of [['santri_id','TEXT'],['tanggal','TEXT'],['deskripsi','TEXT'],['poin','INTEGER'],['penindak_id','TEXT'],['created_at',"TEXT"],['master_id','INTEGER'],['foto_url','TEXT']])if(!columns.has(name))db.exec(`ALTER TABLE pelanggaran ADD COLUMN ${name} ${type}`)
}
function migrate(db) {db.exec(fs.readFileSync(path.join(__dirname,'../migrations/0176_discipline_occurrences.sql'),'utf8'))}
module.exports={prepare,migrate}
