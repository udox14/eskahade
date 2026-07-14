import fs from 'node:fs/promises'
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool'

const outDir = 'C:/DATA/eskahade/.codex-temp/upk-template-inspect/outputs/019f5f73-5234-74b2-b2cc-2c3730902b4f'
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(`${outDir}/qa.xlsx`))
const keyRange = await workbook.inspect({
  kind: 'table',
  range: 'Harga Kitab Keseluruhan!B1:L30',
  include: 'values,formulas',
  tableMaxRows: 30,
  tableMaxCols: 12,
  maxChars: 14000,
})
console.log('KEY RANGE')
console.log(keyRange.ndjson)
const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'final formula error scan',
})
console.log('ERRORS')
console.log(errors.ndjson)
const preview = await workbook.render({ sheetName: 'Harga Kitab Keseluruhan', range: 'B1:L30', scale: 1.5, format: 'png' })
await fs.writeFile(`${outDir}/qa.png`, new Uint8Array(await preview.arrayBuffer()))
