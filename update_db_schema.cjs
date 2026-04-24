const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'database.sqlite'));

try {
  db.exec("ALTER TABLE ehb_event ADD COLUMN tanggal_mulai TEXT");
  db.exec("ALTER TABLE ehb_event ADD COLUMN tanggal_selesai TEXT");
  console.log("Columns added successfully");
} catch (e) {
  console.log("Error or already exists:", e.message);
}
db.close();
