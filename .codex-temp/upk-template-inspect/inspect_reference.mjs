import fs from 'node:fs/promises'
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool'

const source = 'C:/DATA/eskahade/.codex-temp/upk-template-inspect/reference.xlsx'
const outDir = 'C:/DATA/eskahade/.codex-temp/upk-template-inspect/rendered'
await fs.mkdir(outDir, { recursive: true })

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source))
const summary = await workbook.inspect({
  kind: 'workbook,sheet,table,formula,drawing',
  maxChars: 16000,
  tableMaxRows: 40,
  tableMaxCols: 20,
  options: { maxResults: 300 },
})
console.log('SUMMARY')
console.log(summary.ndjson)

const sheetInfo = JSON.parse((await workbook.inspect({ kind: 'sheet', include: 'id,name', maxChars: 8000 })).ndjson)
const sheets = Array.isArray(sheetInfo) ? sheetInfo : [sheetInfo]

for (const item of sheets) {
  const name = item.name ?? item.sheetName
  if (!name) continue
  const region = await workbook.inspect({ kind: 'region', sheetId: name, range: 'A1:Z60', maxChars: 14000 })
  const styles = await workbook.inspect({ kind: 'computedStyle', sheetId: name, range: 'A1:Z40', maxChars: 14000 })
  console.log(`REGION ${name}`)
  console.log(region.ndjson)
  console.log(`STYLES ${name}`)
  console.log(styles.ndjson)
  const preview = await workbook.render({ sheetName: name, autoCrop: 'all', scale: 1.5, format: 'png' })
  const safeName = name.replace(/[\\/:*?"<>|]/g, '_')
  await fs.writeFile(`${outDir}/${safeName}.png`, new Uint8Array(await preview.arrayBuffer()))
}
