import { query } from './lib/db/index.ts'; query('PRAGMA foreign_key_list(santri)').then(console.log);
