'use client'

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  PageBreak,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
  type IBorderOptions,
  type ITableCellBorders,
} from 'docx'
import {
  buildAdministrasiPages,
  formatDorm,
  formatSchool,
  formatStudentName,
  paddedStudentRows,
  safeDocumentFilename,
  teacherDisplayName,
} from './_document-model'
import type { AdministrasiBundle, AdministrasiKind, AdministrasiPage } from './types'

const FONT = 'Arial Narrow'
const BLACK = '000000'
const WHITE = 'FFFFFF'
const LIGHT_GRAY = 'F2F2F2'
const PT = (value: number) => Math.round(value * 2)
const MM = (value: number) => Math.round(value * 56.6929133858)
const PAGE_WIDTH = MM(330)
const PAGE_HEIGHT = MM(215)
const CONTENT_WIDTH = MM(308)
const THIN: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: BLACK }
const MEDIUM: IBorderOptions = { style: BorderStyle.SINGLE, size: 10, color: BLACK }
const NO_BORDER: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: WHITE }

type DocChild = Paragraph | Table

function textRun(text: string, options?: { size?: number; bold?: boolean; color?: string; italic?: boolean; scale?: number }) {
  return new TextRun({
    text,
    font: FONT,
    size: PT(options?.size ?? 8),
    bold: options?.bold,
    color: options?.color ?? BLACK,
    italics: options?.italic,
    scale: options?.scale,
  })
}

function paragraph(
  text = '',
  options?: { size?: number; bold?: boolean; color?: string; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number }
) {
  return new Paragraph({
    alignment: options?.alignment,
    spacing: { before: options?.before ?? 0, after: options?.after ?? 0, line: 240 },
    children: [textRun(text, options)],
  })
}

function borderSet(weight: 'thin' | 'medium' = 'thin'): ITableCellBorders {
  const border = weight === 'medium' ? MEDIUM : THIN
  return { top: border, bottom: border, left: border, right: border }
}

function cell(
  text: string,
  width: number,
  options?: {
    bold?: boolean
    size?: number
    fill?: string
    color?: string
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    columnSpan?: number
    verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType]
    borders?: ITableCellBorders
    noWrap?: boolean
    scale?: number
  }
) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: options?.columnSpan,
    verticalMerge: options?.verticalMerge,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 0, bottom: 0, left: 45, right: 45 },
    shading: options?.fill ? { type: ShadingType.CLEAR, fill: options.fill, color: 'auto' } : undefined,
    borders: options?.borders ?? borderSet(),
    children: [new Paragraph({
      alignment: options?.align ?? AlignmentType.CENTER,
      wordWrap: options?.noWrap === true ? false : undefined,
      spacing: { before: 0, after: 0, line: 180 },
      children: [textRun(text, {
        size: options?.size ?? 6.4,
        bold: options?.bold,
        color: options?.color,
        scale: options?.scale,
      })],
    })],
  })
}

function blankContinuationCell(width: number) {
  return cell('', width, { verticalMerge: VerticalMergeType.CONTINUE, fill: LIGHT_GRAY })
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] })
}

function imageParagraph(logo: Uint8Array, width: number, height: number, after = 0) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after },
    children: [new ImageRun({
      type: 'png',
      data: logo,
      transformation: { width, height },
      altText: { title: 'Logo Pondok Pesantren Sukahideng', description: 'Logo pesantren', name: 'Logo pesantren' },
    })],
  })
}

function coverChildren(page: Extract<AdministrasiPage, { type: 'cover' }>, logo: Uint8Array): DocChild[] {
  const classes = page.bundle.kelas.map(kelas => kelas.nama_kelas).join(', ')
  const metaLabelWidth = MM(42)
  const metaValueWidth = MM(163)
  return [
    paragraph('', { before: MM(16), after: 0 }),
    imageParagraph(logo, 112, 112, 220),
    paragraph('PONDOK PESANTREN SUKAHIDENG', { size: 13, bold: true, alignment: AlignmentType.CENTER, after: 70 }),
    paragraph('ADMINISTRASI PENGAJAR', { size: 31, bold: true, alignment: AlignmentType.CENTER, after: 130 }),
    new Table({
      width: { size: MM(180), type: WidthType.DXA },
      columnWidths: [MM(180)],
      layout: TableLayoutType.FIXED,
      rows: [new TableRow({ children: [cell('', MM(180), { borders: { top: MEDIUM, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } })] })],
    }),
    paragraph(`TAHUN AJARAN ${page.bundle.tahunAjaran.nama}`, { size: 16, bold: true, alignment: AlignmentType.CENTER, before: 90, after: 300 }),
    new Table({
      width: { size: metaLabelWidth + metaValueWidth, type: WidthType.DXA },
      columnWidths: [metaLabelWidth, metaValueWidth],
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: [
            cell('NAMA GURU', metaLabelWidth, { size: 12, bold: true, align: AlignmentType.LEFT, borders: { top: MEDIUM, bottom: THIN, left: MEDIUM, right: THIN } }),
            cell(teacherDisplayName(page.bundle), metaValueWidth, { size: 14, bold: true, align: AlignmentType.LEFT, borders: { top: MEDIUM, bottom: THIN, left: THIN, right: MEDIUM } }),
          ],
        }),
        new TableRow({
          children: [
            cell('KELAS YANG DIAJAR', metaLabelWidth, { size: 12, bold: true, align: AlignmentType.LEFT, borders: { top: THIN, bottom: MEDIUM, left: MEDIUM, right: THIN } }),
            cell(classes, metaValueWidth, { size: 12, bold: true, align: AlignmentType.LEFT, borders: { top: THIN, bottom: MEDIUM, left: THIN, right: MEDIUM } }),
          ],
        }),
      ],
    }),
  ]
}

function separatorChildren(page: Extract<AdministrasiPage, { type: 'separator' }>, logo: Uint8Array): DocChild[] {
  return [
    paragraph('', { before: MM(25), after: 0 }),
    imageParagraph(logo, 84, 84, 260),
    paragraph('ADMINISTRASI KELAS', { size: 13, bold: true, alignment: AlignmentType.CENTER, after: 130 }),
    paragraph(page.kelas.nama_kelas.toUpperCase(), { size: 38, bold: true, alignment: AlignmentType.CENTER, after: 130 }),
    new Table({
      width: { size: MM(145), type: WidthType.DXA },
      columnWidths: [MM(145)],
      layout: TableLayoutType.FIXED,
      rows: [new TableRow({ children: [cell('', MM(145), { borders: { top: MEDIUM, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } })] })],
    }),
    paragraph('', { before: 100, after: 900 }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [Math.floor(CONTENT_WIDTH / 2), Math.ceil(CONTENT_WIDTH / 2)],
      layout: TableLayoutType.FIXED,
      rows: [new TableRow({ children: [
        cell(teacherDisplayName(page.bundle).toUpperCase(), Math.floor(CONTENT_WIDTH / 2), { bold: true, size: 9, align: AlignmentType.LEFT, borders: { top: THIN, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
        cell(`TAHUN AJARAN ${page.bundle.tahunAjaran.nama}`, Math.ceil(CONTENT_WIDTH / 2), { bold: true, size: 9, align: AlignmentType.RIGHT, borders: { top: THIN, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } }),
      ] })],
    }),
  ]
}

function formHeading(page: Extract<AdministrasiPage, { type: 'form' }>) {
  const continuation = page.chunkCount > 1 ? ` | LANJUTAN ${page.chunkIndex + 1}/${page.chunkCount}` : ''
  const meta = `KELAS: ${page.kelas.nama_kelas}${continuation}`
  const title = page.kind === 'absensi'
    ? `REKAP ABSENSI PENGAJIAN TAHUN ${page.bundle.tahunAjaran.nama}`
    : page.kind === 'nilai'
      ? `PENILAIAN KEGIATAN BELAJAR TAHUN ${page.bundle.tahunAjaran.nama}`
      : 'CATATAN HAFALAN ______________________________'
  const titleWidth = MM(155)
  const metaWidth = CONTENT_WIDTH - titleWidth
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [titleWidth, metaWidth],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({
      height: { value: MM(8.5), rule: HeightRule.ATLEAST },
      children: [
        cell(title, titleWidth, {
          size: 11,
          bold: true,
          color: BLACK,
          fill: WHITE,
          align: AlignmentType.LEFT,
          borders: { top: NO_BORDER, bottom: MEDIUM, left: NO_BORDER, right: NO_BORDER },
        }),
        cell(meta, metaWidth, {
          size: 8,
          bold: true,
          align: AlignmentType.RIGHT,
          borders: { top: NO_BORDER, bottom: MEDIUM, left: NO_BORDER, right: NO_BORDER },
        }),
      ],
    })],
  })
}

const identityWidths = [MM(7), MM(70), MM(16), MM(16)]

function identityHeaderCells(row: 'start' | 'continue') {
  if (row === 'continue') return identityWidths.map(blankContinuationCell)
  const labels = ['NO', 'N A M A', 'ASRAMA /\nKAMAR', 'SEKOLAH /\nKELAS']
  return labels.map((label, index) => cell(label, identityWidths[index], {
    bold: false,
    size: index === 1 ? 8 : 7,
    fill: LIGHT_GRAY,
    verticalMerge: VerticalMergeType.RESTART,
    borders: index === 0
      ? { top: MEDIUM, bottom: THIN, left: MEDIUM, right: THIN }
      : { top: MEDIUM, bottom: THIN, left: THIN, right: THIN },
  }))
}

function bodyRows(page: Extract<AdministrasiPage, { type: 'form' }>, variableCount: number, variableWidth: number) {
  return paddedStudentRows(page).map(({ student, number }, rowIndex) => {
    const studentName = student ? formatStudentName(student.nama_lengkap) : ''
    const bottom = rowIndex === 44 ? MEDIUM : THIN
    const baseBorders = { top: THIN, bottom, left: THIN, right: THIN }
    return new TableRow({
      cantSplit: true,
      height: { value: MM(3.55), rule: HeightRule.ATLEAST },
      children: [
        cell(number == null ? '' : String(number), identityWidths[0], { size: 5.8, borders: { ...baseBorders, left: MEDIUM } }),
        cell(studentName, identityWidths[1], {
          size: 9,
          scale: studentName.length > 38 ? 75 : undefined,
          align: AlignmentType.LEFT,
          borders: baseBorders,
          noWrap: true,
        }),
        cell(formatDorm(student), identityWidths[2], {
          size: 9,
          borders: baseBorders,
          noWrap: true,
        }),
        cell(formatSchool(student), identityWidths[3], {
          size: 9,
          borders: baseBorders,
          noWrap: true,
        }),
        ...Array.from({ length: variableCount }, (_, colIndex) => cell('', variableWidth, {
          borders: { ...baseBorders, right: colIndex === variableCount - 1 ? MEDIUM : THIN },
        })),
      ],
    })
  })
}

function absensiTable(page: Extract<AdministrasiPage, { type: 'form' }>) {
  const remaining = CONTENT_WIDTH - identityWidths.reduce((sum, value) => sum + value, 0)
  const variableWidth = Math.floor(remaining / 26)
  const widths = [...identityWidths, ...Array(26).fill(variableWidth)]
  const monthGroups = ['AGU', 'SEP', 'OKT', 'NOV', 'DES', 'JML', 'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JML']
  return new Table({
    width: { size: widths.reduce((sum, value) => sum + value, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ height: { value: MM(4.4), rule: HeightRule.ATLEAST }, children: [
        ...identityHeaderCells('start'),
        cell('GANJIL', variableWidth * 12, { columnSpan: 12, bold: false, size: 8, fill: LIGHT_GRAY, borders: borderSet('medium') }),
        cell('GENAP', variableWidth * 14, { columnSpan: 14, bold: false, size: 8, fill: LIGHT_GRAY, borders: borderSet('medium') }),
      ] }),
      new TableRow({ height: { value: MM(4.4), rule: HeightRule.ATLEAST }, children: [
        ...identityHeaderCells('continue'),
        ...monthGroups.map(month => cell(month, variableWidth * 2, { columnSpan: 2, bold: false, size: 6.4, fill: LIGHT_GRAY })),
      ] }),
      new TableRow({ height: { value: MM(4.4), rule: HeightRule.ATLEAST }, children: [
        ...identityHeaderCells('continue'),
        ...Array.from({ length: 13 }, () => [
          cell('S', variableWidth, { bold: false, size: 6, fill: LIGHT_GRAY }),
          cell('A', variableWidth, { bold: false, size: 6, fill: LIGHT_GRAY }),
        ]).flat(),
      ] }),
      ...bodyRows(page, 26, variableWidth),
    ],
  })
}

function hafalanTable(page: Extract<AdministrasiPage, { type: 'form' }>) {
  const remaining = CONTENT_WIDTH - identityWidths.reduce((sum, value) => sum + value, 0)
  const variableWidth = Math.floor(remaining / 34)
  const widths = [...identityWidths, ...Array(34).fill(variableWidth)]
  return new Table({
    width: { size: widths.reduce((sum, value) => sum + value, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ height: { value: MM(4.8), rule: HeightRule.ATLEAST }, children: [
        ...identityHeaderCells('start'),
        cell('HAFALAN ............................................................', variableWidth * 34, { columnSpan: 34, bold: false, size: 8, fill: LIGHT_GRAY, borders: borderSet('medium') }),
      ] }),
      new TableRow({ height: { value: MM(4.4), rule: HeightRule.ATLEAST }, children: [
        ...identityHeaderCells('continue'),
        ...Array.from({ length: 34 }, () => cell('', variableWidth, { fill: LIGHT_GRAY })),
      ] }),
      ...bodyRows(page, 34, variableWidth),
    ],
  })
}

function nilaiTable(page: Extract<AdministrasiPage, { type: 'form' }>) {
  const remaining = CONTENT_WIDTH - identityWidths.reduce((sum, value) => sum + value, 0)
  const variableWidth = Math.floor(remaining / 32)
  const widths = [...identityWidths, ...Array(32).fill(variableWidth)]
  const labels = ['UH', 'AKH', 'UTS', 'RERATA']
  return new Table({
    width: { size: widths.reduce((sum, value) => sum + value, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ height: { value: MM(4.4), rule: HeightRule.ATLEAST }, children: [
        ...identityHeaderCells('start'),
        cell('MATA PELAJARAN', variableWidth * 32, { columnSpan: 32, bold: false, size: 8, fill: LIGHT_GRAY, borders: borderSet('medium') }),
      ] }),
      new TableRow({ height: { value: MM(4.4), rule: HeightRule.ATLEAST }, children: [
        ...identityHeaderCells('continue'),
        ...Array.from({ length: 8 }, () => cell('', variableWidth * 4, { columnSpan: 4, fill: LIGHT_GRAY, borders: borderSet('medium') })),
      ] }),
      new TableRow({ height: { value: MM(5.3), rule: HeightRule.ATLEAST }, children: [
        ...identityHeaderCells('continue'),
        ...Array.from({ length: 8 }, () => labels.map(label => cell(label, variableWidth, { size: 5.1, fill: LIGHT_GRAY }))).flat(),
      ] }),
      ...bodyRows(page, 32, variableWidth),
    ],
  })
}

function formChildren(page: Extract<AdministrasiPage, { type: 'form' }>): DocChild[] {
  const table = page.kind === 'absensi'
    ? absensiTable(page)
    : page.kind === 'hafalan'
      ? hafalanTable(page)
      : nilaiTable(page)
  return [formHeading(page), paragraph('', { after: 25 }), table]
}

export async function buildAdministrasiDocx(
  bundle: AdministrasiBundle,
  selectedKinds: AdministrasiKind[],
  logo: Uint8Array
) {
  const pages = buildAdministrasiPages(bundle, selectedKinds)
  const children: DocChild[] = []
  pages.forEach((page, index) => {
    if (index > 0) children.push(pageBreak())
    if (page.type === 'cover') children.push(...coverChildren(page, logo))
    else if (page.type === 'separator') children.push(...separatorChildren(page, logo))
    else children.push(...formChildren(page))
  })

  return new Document({
    creator: 'Pondok Pesantren Sukahideng',
    title: `Administrasi Guru - ${teacherDisplayName(bundle)}`,
    description: 'Blanko administrasi guru siap cetak',
    styles: {
      default: {
        document: { run: { font: FONT, size: PT(8), color: BLACK }, paragraph: { spacing: { before: 0, after: 0 } } },
      },
    },
    sections: [{
      properties: {
        page: {
          // Word swaps width/height when the landscape flag is applied.
          size: { width: PAGE_HEIGHT, height: PAGE_WIDTH, orientation: PageOrientation.LANDSCAPE },
          margin: { top: MM(7), right: MM(7), bottom: MM(7), left: MM(15), header: 0, footer: 0, gutter: 0 },
        },
      },
      children,
    }],
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadAdministrasiGuruDocx(
  bundle: AdministrasiBundle,
  selectedKinds: AdministrasiKind[]
) {
  const logoResponse = await fetch('/logo.png')
  if (!logoResponse.ok) throw new Error('Logo pesantren gagal dimuat.')
  const logo = new Uint8Array(await logoResponse.arrayBuffer())
  const doc = await buildAdministrasiDocx(bundle, selectedKinds, logo)
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${safeDocumentFilename(bundle)}.docx`)
}
