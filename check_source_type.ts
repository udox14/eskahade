import { query } from './lib/db'

async function check() {
  const res = await query('SELECT DISTINCT source_type FROM users')
  console.log('Source types:', res)
}
check()
