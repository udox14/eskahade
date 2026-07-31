import sqlite3 from 'sqlite3';
import { readdirSync } from 'fs';
import path from 'path';

const d1Dir = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
let dbs = [];
try {
  dbs = readdirSync(d1Dir).filter(f => f.endsWith('.sqlite'));
} catch (e) {
  console.log('No D1 dir found');
}

for (const dbName of dbs) {
  const dbPath = path.join(d1Dir, dbName);
  const db = new sqlite3.Database(dbPath);
  db.run('ALTER TABLE poskestren_compensation_history ADD COLUMN patient_rate_with_treatment_rupiah INTEGER CHECK (patient_rate_with_treatment_rupiah IS NULL OR patient_rate_with_treatment_rupiah >= 0);', (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log(`${dbName} already migrated.`);
      } else {
        console.log(`Failed on ${dbName}: ${err.message}`);
      }
    } else {
      console.log(`Migrated ${dbName}`);
    }
  });
}
