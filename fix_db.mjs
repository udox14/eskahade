import sqlite3 from 'sqlite3';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const d1Dir = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const dbs = readdirSync(d1Dir).filter(f => f.endsWith('.sqlite'));

for (const dbName of dbs) {
  const dbPath = path.join(d1Dir, dbName);
  const db = new sqlite3.Database(dbPath);
  db.run('ALTER TABLE kamar_config ADD COLUMN blok TEXT;', (err) => {
    if (err) {
      console.log(`Failed on ${dbName}: ${err.message}`);
    } else {
      console.log(`Added column blok to ${dbName}`);
    }
  });
}
