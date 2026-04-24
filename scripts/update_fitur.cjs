const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');

db.exec("UPDATE fitur_akses SET title = 'Ruangan EHB' WHERE href = '/dashboard/ehb/ruangan'");
db.exec("UPDATE fitur_akses SET title = 'Pengawas EHB' WHERE href = '/dashboard/ehb/pengawas'");
db.exec("DELETE FROM fitur_akses WHERE href = '/dashboard/ehb/ruangan/plotting'");
db.exec("DELETE FROM fitur_akses WHERE href = '/dashboard/ehb/pengawas/plotting'");

console.log("Database updated successfully");
db.close();
