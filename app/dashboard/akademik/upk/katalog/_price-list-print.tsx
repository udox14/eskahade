'use client'

import { useRef } from 'react'
import { Printer } from 'lucide-react'
import { useReactToPrint } from '@/lib/pdf/client'
import { rupiah } from '@/lib/upk-utils'

type PriceListMarhalah = {
  id: number
  nama: string
  items: {
    id: number
    nama_kitab: string
    harga_jual: number
  }[]
}

function pairMarhalah(items: PriceListMarhalah[]) {
  const pairs: PriceListMarhalah[][] = []
  for (let index = 0; index < items.length; index += 2) {
    pairs.push(items.slice(index, index + 2))
  }
  return pairs
}

function densityFor(rowCount: number) {
  if (rowCount <= 16) return { fontSize: '12pt', cellPadding: '2.2mm 2.4mm', titleSize: '17pt' }
  if (rowCount <= 22) return { fontSize: '11pt', cellPadding: '1.65mm 2.2mm', titleSize: '16pt' }
  if (rowCount <= 28) return { fontSize: '9.5pt', cellPadding: '1.05mm 1.8mm', titleSize: '15pt' }
  return { fontSize: '8.5pt', cellPadding: '0.65mm 1.5mm', titleSize: '14pt' }
}

function MarhalahPriceTable({ marhalah, maxRows }: { marhalah: PriceListMarhalah; maxRows: number }) {
  const density = densityFor(maxRows)
  const total = marhalah.items.reduce((sum, item) => sum + item.harga_jual, 0)

  return (
    <section style={{ minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ marginBottom: '4mm', textAlign: 'center' }}>
        <div style={{ fontSize: '9pt', fontWeight: 800, letterSpacing: '0.08em' }}>UNIT PERLENGKAPAN KITAB (UPK)</div>
        <h1 style={{ margin: '1.5mm 0 0', fontSize: density.titleSize, lineHeight: 1.1, fontWeight: 900 }}>
          DAFTAR HARGA KITAB
        </h1>
        <div style={{ marginTop: '1.5mm', fontSize: '12pt', fontWeight: 800 }}>{marhalah.nama}</div>
      </header>

      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: density.fontSize, lineHeight: 1.15 }}>
        <colgroup>
          <col style={{ width: '11mm' }} />
          <col />
          <col style={{ width: '38mm' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ border: '1.2pt solid #111', padding: '2mm 1mm', background: '#e5e7eb', textAlign: 'center' }}>No.</th>
            <th style={{ border: '1.2pt solid #111', padding: '2mm', background: '#e5e7eb', textAlign: 'left' }}>Nama Kitab</th>
            <th style={{ border: '1.2pt solid #111', padding: '2mm', background: '#e5e7eb', textAlign: 'right' }}>Harga</th>
          </tr>
        </thead>
        <tbody>
          {marhalah.items.length ? marhalah.items.map((item, index) => (
            <tr key={item.id}>
              <td style={{ border: '1pt solid #111', padding: density.cellPadding, textAlign: 'center', fontWeight: 700 }}>{index + 1}</td>
              <td style={{ border: '1pt solid #111', padding: density.cellPadding, fontWeight: 700, overflowWrap: 'anywhere' }}>{item.nama_kitab}</td>
              <td style={{ border: '1pt solid #111', padding: density.cellPadding, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{rupiah(item.harga_jual)}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={3} style={{ border: '1pt solid #111', padding: '10mm 3mm', textAlign: 'center', color: '#555' }}>Belum ada kitab aktif.</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={2} style={{ border: '1.2pt solid #111', padding: '2.4mm', background: '#e5e7eb', textAlign: 'right', fontSize: density.fontSize }}>
              TOTAL HARGA
            </th>
            <th style={{ border: '1.2pt solid #111', padding: '2.4mm', background: '#e5e7eb', textAlign: 'right', fontSize: density.fontSize, whiteSpace: 'nowrap' }}>
              {rupiah(total)}
            </th>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}

function PriceListPrintSheet({ marhalah }: { marhalah: PriceListMarhalah[] }) {
  return (
    <div style={{ width: '316mm', background: '#fff', color: '#000', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {pairMarhalah(marhalah).map((pair, pageIndex) => {
        const maxRows = Math.max(0, ...pair.map(group => group.items.length))
        return (
          <div
            key={pair.map(group => group.id).join('-')}
            style={{
              width: '316mm',
              height: '201mm',
              boxSizing: 'border-box',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '8mm',
              overflow: 'hidden',
              breakAfter: pageIndex < Math.ceil(marhalah.length / 2) - 1 ? 'page' : 'auto',
              pageBreakAfter: pageIndex < Math.ceil(marhalah.length / 2) - 1 ? 'always' : 'auto',
            }}
          >
            {pair.map(group => <MarhalahPriceTable key={group.id} marhalah={group} maxRows={maxRows} />)}
            {pair.length === 1 && <div />}
          </div>
        )
      })}
    </div>
  )
}

export function PriceListPrintButton({ marhalah }: { marhalah: PriceListMarhalah[] }) {
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Daftar Harga Kitab UPK',
    pageStyle: `
      @page { size: 330mm 215mm; margin: 7mm; }
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  return (
    <>
      <button
        type="button"
        onClick={() => handlePrint()}
        disabled={!marhalah.length}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Printer className="h-4 w-4" />
        Cetak Daftar Harga
      </button>

      <div aria-hidden="true" style={{ position: 'fixed', left: '-10000px', top: 0 }}>
        <div ref={printRef}>
          <PriceListPrintSheet marhalah={marhalah} />
        </div>
      </div>
    </>
  )
}
