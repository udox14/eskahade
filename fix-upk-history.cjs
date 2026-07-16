const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

const rows = db.prepare(`
    SELECT id, nomor, total_tagihan, total_bayar, sisa_kembalian, kembalian_ditahan 
    FROM upk_antrian 
    WHERE kembalian_ditahan = 0 
      AND total_bayar > total_tagihan 
      AND status = 'SELESAI'
`).all();

console.log(`Found ${rows.length} records to fix.`);

const stmt = db.prepare(`UPDATE upk_antrian SET total_bayar = total_tagihan WHERE id = ?`);

let fixed = 0;
for (const row of rows) {
    console.log(`Fixing antrian nomor ${row.nomor}: total_bayar was ${row.total_bayar}, now ${row.total_tagihan}`);
    stmt.run(row.id);
    fixed++;
}
console.log(`Fixed ${fixed} records.`);
db.close();
