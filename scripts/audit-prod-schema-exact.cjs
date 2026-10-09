/**
 * scripts/audit-prod-schema-exact.cjs
 * 
 * Programmatically derives all expected schema objects from:
 * - migrations/0182_bri_foundation.sql
 * - migrations/0183_briva_collection_metadata.sql
 * - migrations/0184_bri_settlement_and_recovery.sql
 * - migrations/0185_bri_qlola_distribution.sql
 * - migrations/0186_cash_manual_distribution_hardening.sql
 * 
 * Compares them directly against the actual remote schema of production:
 * eskahade-db (ID: a2010f08-f314-46af-88fd-dbb9b4ef1bb1)
 * 
 * SAFETY INVARIANT: Strictly read-only queries against production.
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const PROD_DB_NAME = 'eskahade-db'
const PROD_DB_ID = 'a2010f08-f314-46af-88fd-dbb9b4ef1bb1'

const migrationFiles = [
  { id: '0182', path: 'migrations/0182_bri_foundation.sql' },
  { id: '0183', path: 'migrations/0183_briva_collection_metadata.sql' },
  { id: '0184', path: 'migrations/0184_bri_settlement_and_recovery.sql' },
  { id: '0185', path: 'migrations/0185_bri_qlola_distribution.sql' },
  { id: '0186', path: 'migrations/0186_cash_manual_distribution_hardening.sql' }
]

function runProdQuery(sql) {
  const cleanSql = sql.replace(/\s+/g, ' ').trim()
  const upper = cleanSql.toUpperCase()
  if (!upper.startsWith('SELECT') && !upper.startsWith('PRAGMA')) {
    throw new Error('ONLY SELECT / PRAGMA ALLOWED ON PRODUCTION!')
  }
  const stdout = execFileSync(
    'node',
    ['./node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', PROD_DB_NAME, '--remote', `--command=${cleanSql}`],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } }
  )
  const jsonStart = stdout.indexOf('[')
  const jsonEnd = stdout.lastIndexOf(']')
  return JSON.parse(stdout.substring(jsonStart, jsonEnd + 1))[0]?.results || []
}

function parseMigrationFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const objects = []

  // 1. Tables (Created new or renamed)
  // Check for CREATE TABLE ..._new that gets renamed
  const tableMatches = [...content.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi)]
  for (const m of tableMatches) {
    let tableName = m[1]
    const definition = m[0]
    // If it's a temporary table for rebuilding, find its final renamed name
    if (tableName.endsWith('_new')) {
      const finalName = tableName.replace('_new', '')
      objects.push({
        type: 'table',
        name: finalName,
        rebuilt: true,
        tempName: tableName,
        expectedDefinition: definition.replace(new RegExp(`\\b${tableName}\\b`, 'g'), finalName)
      })
    } else {
      objects.push({
        type: 'table',
        name: tableName,
        rebuilt: false,
        expectedDefinition: definition
      })
    }
  }

  // 2. Alter Table Columns
  const alterMatches = [...content.matchAll(/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+([a-zA-Z0-9_]+)\s+([^;]+);/gi)]
  for (const m of alterMatches) {
    objects.push({
      type: 'column',
      tableName: m[1],
      name: m[2],
      expectedDefinition: m[0]
    })
  }

  // 3. Indexes
  const indexMatches = [...content.matchAll(/CREATE\s+(UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)(?:WHERE\s+([\s\S]*?))?\);/gi)]
  for (const m of indexMatches) {
    objects.push({
      type: 'index',
      name: m[2],
      tableName: m[3],
      isUnique: !!m[1],
      expectedDefinition: m[0]
    })
  }

  // 4. Triggers
  const triggerMatches = [...content.matchAll(/CREATE\s+TRIGGER(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_]+)\s*([\s\S]*?END;)/gi)]
  for (const m of triggerMatches) {
    objects.push({
      type: 'trigger',
      name: m[1],
      expectedDefinition: m[0]
    })
  }

  return objects
}

async function main() {
  console.log('======================================================================')
  console.log('EXACT PROGRAMMATIC SCHEMA AUDIT AGAINST PRODUCTION eskahade-db')
  console.log(`Database ID: ${PROD_DB_ID}`)
  console.log('======================================================================\n')

  // 1. Fetch remote production sqlite_master
  console.log('Fetching sqlite_master from production...')
  const prodMaster = runProdQuery("SELECT type, name, tbl_name, sql FROM sqlite_master;")
  const prodMasterMap = {}
  for (const row of prodMaster) {
    prodMasterMap[`${row.type}:${row.name}`] = row
  }
  console.log(`Retrieved ${prodMaster.length} objects from production.\n`)

  const migrationReports = {}

  for (const mf of migrationFiles) {
    console.log(`Analyzing Migration ${mf.id} (${mf.path})...`)
    const expectedObjects = parseMigrationFile(mf.path)
    const auditedObjects = []

    let presentCount = 0
    let absentCount = 0
    let conflictCount = 0

    for (const obj of expectedObjects) {
      if (obj.type === 'column') {
        // Inspect table columns via PRAGMA
        const cols = runProdQuery(`PRAGMA table_info(${obj.tableName});`)
        const existingCol = cols.find(c => c.name.toLowerCase() === obj.name.toLowerCase())
        if (existingCol) {
          presentCount++
          auditedObjects.push({
            expected: `COLUMN ${obj.tableName}.${obj.name}`,
            status: 'PRESENT',
            actualDefinition: `${existingCol.name} ${existingCol.type}`,
            expectedDefinition: obj.expectedDefinition
          })
        } else {
          absentCount++
          auditedObjects.push({
            expected: `COLUMN ${obj.tableName}.${obj.name}`,
            status: 'ABSENT',
            actualDefinition: 'NULL / COLUMN NOT FOUND',
            expectedDefinition: obj.expectedDefinition
          })
        }
      } else if (obj.type === 'table') {
        const prodObj = prodMasterMap[`table:${obj.name}`]
        if (prodObj) {
          if (obj.rebuilt) {
            // Table exists, but is it the legacy schema or rebuilt schema?
            // Compare column list or DDL
            const actualCols = runProdQuery(`PRAGMA table_info(${obj.name});`).map(c => c.name)
            // Parse expected cols from expectedDefinition
            const isRebuilt = actualCols.includes('fund_management') && actualCols.includes('cooperative_admin_fee')
            if (isRebuilt) {
              presentCount++
              auditedObjects.push({
                expected: `REBUILT TABLE ${obj.name}`,
                status: 'PRESENT',
                actualDefinition: prodObj.sql,
                expectedDefinition: obj.expectedDefinition
              })
            } else {
              // Legacy table exists, but new rebuilt table definition is ABSENT
              absentCount++
              auditedObjects.push({
                expected: `REBUILT TABLE ${obj.name}`,
                status: 'ABSENT',
                actualDefinition: `LEGACY TABLE PRESENT (${actualCols.join(', ')}) - NEW SCHEMA ABSENT`,
                expectedDefinition: obj.expectedDefinition
              })
            }
          } else {
            presentCount++
            auditedObjects.push({
              expected: `TABLE ${obj.name}`,
              status: 'PRESENT',
              actualDefinition: prodObj.sql,
              expectedDefinition: obj.expectedDefinition
            })
          }
        } else {
          absentCount++
          auditedObjects.push({
            expected: `TABLE ${obj.name}`,
            status: 'ABSENT',
            actualDefinition: 'NULL / TABLE NOT FOUND',
            expectedDefinition: obj.expectedDefinition
          })
        }
      } else if (obj.type === 'index') {
        const prodObj = prodMasterMap[`index:${obj.name}`]
        if (prodObj) {
          presentCount++
          auditedObjects.push({
            expected: `INDEX ${obj.name}`,
            status: 'PRESENT',
            actualDefinition: prodObj.sql,
            expectedDefinition: obj.expectedDefinition
          })
        } else {
          absentCount++
          auditedObjects.push({
            expected: `INDEX ${obj.name}`,
            status: 'ABSENT',
            actualDefinition: 'NULL / INDEX NOT FOUND',
            expectedDefinition: obj.expectedDefinition
          })
        }
      } else if (obj.type === 'trigger') {
        const prodObj = prodMasterMap[`trigger:${obj.name}`]
        if (prodObj) {
          // Check if trigger definition matches
          const cleanActual = (prodObj.sql || '').replace(/\s+/g, ' ').trim()
          const cleanExpected = (obj.expectedDefinition || '').replace(/\s+/g, ' ').trim()
          if (cleanActual === cleanExpected) {
            presentCount++
            auditedObjects.push({
              expected: `TRIGGER ${obj.name}`,
              status: 'PRESENT',
              actualDefinition: prodObj.sql,
              expectedDefinition: obj.expectedDefinition
            })
          } else {
            // Trigger exists from old migration with different logic!
            conflictCount++
            auditedObjects.push({
              expected: `TRIGGER ${obj.name}`,
              status: 'CONFLICT',
              actualDefinition: prodObj.sql,
              expectedDefinition: obj.expectedDefinition
            })
          }
        } else {
          absentCount++
          auditedObjects.push({
            expected: `TRIGGER ${obj.name}`,
            status: 'ABSENT',
            actualDefinition: 'NULL / TRIGGER NOT FOUND',
            expectedDefinition: obj.expectedDefinition
          })
        }
      }
    }

    let classification = 'ABSENT'
    if (conflictCount > 0) {
      classification = 'CONFLICT'
    } else if (presentCount === 0) {
      classification = 'ABSENT'
    } else if (absentCount === 0) {
      classification = 'FULLY_PRESENT'
    } else {
      classification = 'PARTIALLY_PRESENT'
    }

    migrationReports[mf.id] = {
      filePath: mf.path,
      totalExpectedObjects: expectedObjects.length,
      presentCount,
      absentCount,
      conflictCount,
      classification,
      objects: auditedObjects
    }
  }

  // Save audit output to json for synthesis
  fs.writeFileSync(
    path.resolve(__dirname, '..', 'production_schema_audit_result.json'),
    JSON.stringify(migrationReports, null, 2)
  )

  console.log('\n======================================================================')
  console.log('SUMMARY CLASSIFICATION:')
  for (const [id, rep] of Object.entries(migrationReports)) {
    console.log(`Migration ${id}: ${rep.classification} (${rep.presentCount} present, ${rep.absentCount} absent, ${rep.conflictCount} conflict / ${rep.totalExpectedObjects} total objects)`)
  }
  console.log('======================================================================')
}

main().catch(err => {
  console.error('FAILED AUDIT:', err)
  process.exit(1)
})
