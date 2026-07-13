import { query } from './lib/db'

async function checkSchema() {
  const columns = await query("PRAGMA table_info(users)")
  console.log(columns)
}

checkSchema()
