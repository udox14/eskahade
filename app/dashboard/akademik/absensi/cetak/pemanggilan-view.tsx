'use client'

import { useLayoutEffect, useRef } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { formatFullIndonesianDate } from '@/lib/absensi/week-period'
import { tanggalInputWib, type PemanggilanRow } from '@/lib/absensi/pemanggilan'

interface PemanggilanProps {
  data: PemanggilanRow[];
  periode: { start: Date; end: Date };
  tglPanggil: Date;
  namaAsrama: string;
  isMangkir?: boolean; // Tambahan
}

export function PemanggilanView({ data, periode, tglPanggil, namaAsrama, isMangkir }: PemanggilanProps) {
  const tableRef = useRef<HTMLTableElement>(null)
  useLayoutEffect(() => {
    const table = tableRef.current
    if (!table) return
    const fitNames = () => {
      table.querySelectorAll<HTMLElement>('[data-santri-name]').forEach(name => {
        name.style.fontSize = '10px'
        const cell = name.parentElement!
        const style = getComputedStyle(cell)
        const available = cell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        const width = name.getBoundingClientRect().width
        if (width > available && available > 0) name.style.fontSize = `${10 * available / width}px`
      })
    }
    fitNames()
    const observer = new ResizeObserver(fitNames)
    observer.observe(table)
    window.addEventListener('beforeprint', fitNames)
    return () => {
      observer.disconnect()
      window.removeEventListener('beforeprint', fitNames)
    }
  }, [data])

  const periodeLabel = `${formatFullIndonesianDate(format(periode.start, 'yyyy-MM-dd'))} s.d. ${formatFullIndonesianDate(format(periode.end, 'yyyy-MM-dd'))}`

  // Format Tanggal Panggil Footer
  const hariPanggil = format(tglPanggil, 'EEEE', { locale: id }).toUpperCase()
  const tglPanggilStr = format(tglPanggil, 'dd MMMM yyyy', { locale: id }).toUpperCase()

  return (
    <div className="pemanggilan-sheet w-[210mm] min-h-[297mm] bg-white p-10 print:w-auto print:min-h-0 print:p-0 mx-auto text-black text-sm relative print:shadow-none shadow-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
      
      {/* 1. KOP SURAT */}
      <div className="text-center border-b-4 border-double border-black pb-4 mb-4">
        <h1 className="text-2xl font-bold uppercase tracking-widest">PONDOK PESANTREN SUKAHIDENG</h1>
        <p className="text-xs">Jl. Pahlawan KHZ. Musthafa, Desa Sukarapih, Kec. Sukarame, Kab. Tasikmalaya, Prov. Jawa Barat 46461</p>
      </div>

      {/* 2. JUDUL DOKUMEN */}
      <div className="text-center mb-6 flex flex-col items-center">
        <h2 className="text-base font-bold underline">
          {isMangkir ? 'DATA PEMANGGILAN MANGKIR (SUSULAN)' : 'DATA PEMANGGILAN ALFA PENGAJIAN'}
        </h2>
        {/* Nama Asrama Ditampilkan Disini */}
        <h3 className="text-sm font-bold uppercase mt-1 px-4 py-1">ASRAMA: {namaAsrama}</h3>
        <p className="text-sm font-bold uppercase mt-3 border border-black px-4 py-2">
          {periodeLabel}
        </p>
      </div>

      {/* 3. TABEL DATA */}
      <table ref={tableRef} className="pemanggilan-table w-full table-fixed border-collapse border border-black mb-6 text-[10px]">
        <colgroup>
          <col style={{ width: '7mm' }} /><col style={{ width: '7mm' }} />
          <col style={{ width: '6mm' }} /><col />
          <col style={{ width: '13mm' }} /><col style={{ width: '32mm' }} />
          <col style={{ width: '10mm' }} /><col style={{ width: '10mm' }} /><col style={{ width: '10mm' }} />
          <col style={{ width: '8mm' }} /><col style={{ width: '21mm' }} />
        </colgroup>
        <thead className="bg-gray-200 text-center font-bold">
          <tr>
            <th className="border border-black p-0.5" rowSpan={2}>✓</th>
            <th className="border border-black p-0.5" rowSpan={2}>KET</th>
            <th className="border border-black p-0.5" rowSpan={2}>NO</th>
            <th className="border border-black p-0.5" rowSpan={2}>NAMA SANTRI</th>
            <th className="border border-black p-0.5" rowSpan={2}>KAMAR</th>
            <th className="border border-black p-0.5" rowSpan={2}>KELAS</th>
            <th className="border border-black p-0.5" colSpan={3}>REKAP ALFA</th>
            <th className="border border-black p-0.5" rowSpan={2}>JML</th>
            <th className="border border-black p-0.5" rowSpan={2}>TGL INPUT</th>
          </tr>
          <tr>
            <th className="border border-black p-0.5">SBH</th>
            <th className="border border-black p-0.5">ASR</th>
            <th className="border border-black p-0.5">MGB</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={11} className="border border-black p-4 text-center italic">Tidak ada data alfa minggu ini.</td></tr>
          ) : (
            data.map((item, idx) => (
              <tr key={`${item.santri_id}:${item.pekan.start}`} className="break-inside-avoid">
                <td className="border border-black p-1" />
                <td className="border border-black p-1" />
                <td className="border border-black p-0.5 text-center">{idx + 1}</td>
                <td className="border border-black p-1 px-2 font-medium whitespace-nowrap">
                  <span data-santri-name className="inline-block whitespace-nowrap">{item.nama}</span>
                </td>
                <td className="border border-black p-1 text-center">{item.kamar}</td>
                <td className="border border-black p-1 text-center break-words">{item.kelas}</td>
                <td className="border border-black p-1 text-center">{item.alfa_shubuh || '-'}</td>
                <td className="border border-black p-1 text-center">{item.alfa_ashar || '-'}</td>
                <td className="border border-black p-1 text-center">{item.alfa_maghrib || '-'}</td>
                <td className="border border-black p-1 text-center font-bold">{item.total}</td>
                <td className="border border-black p-1 text-center whitespace-nowrap">{tanggalInputWib(item.tanggal_input)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* 4. FOOTER / PEMANGGILAN */}
      <div className="mt-8 border border-black p-4 bg-gray-50/50 break-inside-avoid">
        <p className="font-bold mb-2 underline">PELAKSANAAN PEMANGGILAN:</p>
        <p className="text-justify leading-relaxed mb-2">
          Sehubungan dengan ketidakhadiran (Alfa) pada kegiatan pengajian mingguan, maka dengan ini 
          Bagian Keamanan mewajibkan seluruh nama di atas untuk hadir pada:
        </p>
        <div className="ml-4 font-bold my-3 text-sm">
          <table>
            <tbody>
              <tr><td className="w-24">HARI</td><td>: {hariPanggil}</td></tr>
              <tr><td>TANGGAL</td><td>: {tglPanggilStr}</td></tr>
              <tr><td>PUKUL</td><td>: 20.30 WIB (BA&apos;DA ISYA)</td></tr>
              <tr><td>TEMPAT</td><td>: GEDUNG MI LAMA LANTAI 2 (PUTRI) & LANTAI 3 (PUTRA)</td></tr>
            </tbody>
          </table>
        </div>
        <p className="font-bold">
          CATATAN: WAJIB MEMBAWA BUKU PRIBADI.
        </p>
        <p className="text-xs italic mt-1">
          *Bagi yang tidak hadir pada pemanggilan ini akan dikenakan sanksi disiplin lebih berat.
        </p>
      </div>


    </div>
  )
}
