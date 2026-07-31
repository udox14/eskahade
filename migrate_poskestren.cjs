const Database = require('better-sqlite3');
const { readdirSync } = require('fs');
const path = require('path');

const d1Dir = path.join(__dirname, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
let dbs = [];
try {
  dbs = readdirSync(d1Dir).filter(f => f.endsWith('.sqlite'));
} catch (e) {
  console.log('No D1 dir found');
}

for (const dbName of dbs) {
  const dbPath = path.join(d1Dir, dbName);
  try {
    const db = new Database(dbPath);
    db.prepare('ALTER TABLE poskestren_compensation_history ADD COLUMN patient_rate_with_treatment_rupiah INTEGER CHECK (patient_rate_with_treatment_rupiah IS NULL OR patient_rate_with_treatment_rupiah >= 0);').run();
    console.log(`Migrated ${dbName}`);
    db.close();
  } catch (err) {
    if (err.message.includes('duplicate column name')) {
      console.log(`${dbName} already migrated.`);
    } else {
      console.log(`Failed on ${dbName}: ${err.message}`);
    }
  }
}
