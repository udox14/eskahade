const Database = require('better-sqlite3');
const db = new Database('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/fd5d802848c823da94eea8ca866fc7f5241028ea1a29bcc58f63dc7890d6dedc.sqlite');
db.prepare("UPDATE fitur_akses SET title='Daftar Ulang PSB' WHERE title='Flow PSB'").run();
console.log('DB Updated');
