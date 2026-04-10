import { query } from '../lib/db'

async function research() {
  const sql = `
    SELECT name AS table_name 
    FROM sqlite_master 
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
  `
  const tables = await query<{ table_name: string }>(sql)
  
  console.log('--- TABLES WITH KAMAR RELATED COLUMNS ---')
  for (const table of tables) {
    const columnsSql = \`PRAGMA table_info(\${table.table_name})\`
    const columns = await query<any>(columnsSql)
    const kamarCols = columns.filter((c: any) => c.name.toLowerCase().includes('kamar'))
    if (kamarCols.length > 0) {
      console.log(\`Table: \${table.table_name}\`)
      kamarCols.forEach((c: any) => console.log(\`  - \${c.name} (\${c.type})\`))
    }
  }
}

research().catch(console.error)
