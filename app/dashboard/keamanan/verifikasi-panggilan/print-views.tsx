import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { Fragment } from 'react'
import type { AlfaEvent } from './actions'

type PrintItem = {
  id: string
  nama: string
  nis: string | null
  asrama: string
  kamar: string
  jumlah_alfa_pengajian: number
  jumlah_alfa_berjamaah: number
  total_alfa: number
  catatan: string | null
  events: AlfaEvent[]
}

type PrintData = {
  periode: { start: string; end: string }
  days: string[]
  grouped: Record<string, PrintItem[]>
}

function formatDate(dateStr: string, pattern = 'dd MMM yyyy') {
  return format(new Date(`${dateStr}T12:00:00Z`), pattern, { locale: id })
}

function shortDay(dateStr: string) {
  return formatDate(dateStr, 'EEE dd/MM')
}

function sessionsFor(item: PrintItem, dateStr: string, source: 'pengajian' | 'berjamaah') {
  return item.events
    .filter((event) => event.tanggal === dateStr && event.source === source && event.counted)
    .map((event) => event.sesi.toUpperCase())
    .join(', ')
}

export function TempelanAsramaPrintView({ data, tglPanggil }: { data: PrintData; tglPanggil: string }) {
  const asramaList = Object.keys(data.grouped).sort()
  const tglPanggilLabel = formatDate(tglPanggil, 'EEEE, dd MMMM yyyy').toUpperCase()
  const periodeLabel = `${formatDate(data.periode.start)} s/d ${formatDate(data.periode.end)}`

  return (
    <div className="w-[210mm] text-black font-serif text-sm">
      {asramaList.map((asrama) => (
        <div key={asrama} className="min-h-[297mm] bg-white p-10 break-after-page">
          <div className="text-center border-b-4 border-double border-black pb-4 mb-4">
            <h1 className="text-2xl font-bold uppercase tracking-widest">PONDOK PESANTREN SUKAHIDENG</h1>
            <p className="text-xs">Sukapameungpeuk, Kec. Sukarame, Kabupaten Tasikmalaya, Jawa Barat</p>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-base font-bold underline">DAFTAR PEMANGGILAN SANTRI</h2>
            <h3 className="text-sm font-bold uppercase mt-1 bg-gray-200 inline-block px-4 py-1 rounded">ASRAMA: {asrama}</h3>
            <p className="text-xs font-bold uppercase mt-2">Periode {periodeLabel}</p>
          </div>

          <table className="w-full border-collapse border border-black mb-6 text-xs">
            <thead className="bg-gray-200 text-center font-bold">
              <tr>
                <th className="border border-black p-1 w-8">NO</th>
                <th className="border border-black p-1">NAMA SANTRI</th>
                <th className="border border-black p-1 w-16">KAMAR</th>
                <th className="border border-black p-1 w-20">TIDAK NGAJI</th>
                <th className="border border-black p-1 w-24">TIDAK BERJAMAAH</th>
                <th className="border border-black p-1 w-16">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.grouped[asrama].map((item, idx) => (
                <tr key={item.id}>
                  <td className="border border-black p-1 text-center">{idx + 1}</td>
                  <td className="border border-black p-1 px-2 font-medium">{item.nama}</td>
                  <td className="border border-black p-1 text-center">{item.kamar}</td>
                  <td className="border border-black p-1 text-center">{item.jumlah_alfa_pengajian || '-'}</td>
                  <td className="border border-black p-1 text-center">{item.jumlah_alfa_berjamaah || '-'}</td>
                  <td className="border border-black p-1 text-center font-bold">{item.total_alfa}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 border border-black p-4 bg-gray-50/50 break-inside-avoid">
            <p className="font-bold mb-2 underline">PERHATIAN BAGI SANTRI YANG TERCANTUM DI ATAS:</p>
            <p className="text-justify leading-relaxed mb-2">
              Sehubungan dengan ketidakhadiran pada kegiatan pengajian dan/atau shalat berjamaah, maka
              seluruh nama di atas wajib hadir pada:
            </p>
            <table className="ml-4 font-bold my-3 text-sm">
              <tbody>
                <tr><td className="w-24">TANGGAL</td><td>: {tglPanggilLabel}</td></tr>
                <tr><td>PUKUL</td><td>: 20.30 WIB (BA'DA ISYA)</td></tr>
                <tr><td>TEMPAT</td><td>: RUANG INTEROGASI DAN SANKSI</td></tr>
              </tbody>
            </table>
            <p className="font-bold">CATATAN: WAJIB MEMBAWA BUKU PRIBADI.</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function EksekutorLandscapePrintView({ data }: { data: PrintData }) {
  const asramaList = Object.keys(data.grouped).sort()
  const periodeLabel = `${formatDate(data.periode.start)} s/d ${formatDate(data.periode.end)}`

  return (
    <div className="w-[297mm] text-black font-serif text-[10px]">
      <style>{'@page { size: A4 landscape; margin: 8mm; }'}</style>
      {asramaList.map((asrama) => (
        <div key={asrama} className="min-h-[210mm] bg-white p-5 break-after-page">
          <div className="text-center border-b-2 border-black pb-2 mb-3">
            <h1 className="text-lg font-bold uppercase">LEMBAR EKSEKUTOR PEMANGGILAN SANTRI</h1>
            <p className="text-[10px] uppercase">Asrama {asrama} - Periode {periodeLabel}</p>
          </div>

          <table className="w-full border-collapse border border-black">
            <thead className="bg-gray-200 text-center font-bold">
              <tr>
                <th className="border border-black p-1 w-6" rowSpan={2}>NO</th>
                <th className="border border-black p-1 min-w-36" rowSpan={2}>NAMA</th>
                <th className="border border-black p-1 w-12" rowSpan={2}>KMR</th>
                <th className="border border-black p-1 w-10" rowSpan={2}>NGJ</th>
                <th className="border border-black p-1 w-10" rowSpan={2}>JMH</th>
                {data.days.map((day) => (
                  <th key={day} className="border border-black p-1" colSpan={3}>{shortDay(day)}</th>
                ))}
                <th className="border border-black p-1 w-28" rowSpan={2}>CATATAN</th>
              </tr>
              <tr>
                {data.days.map((day) => (
                  <Fragment key={day}>
                    <th key={`${day}-ngaji`} className="border border-black p-1 w-16">NGAJI</th>
                    <th key={`${day}-jamaah`} className="border border-black p-1 w-20">JAMAAH</th>
                    <th key={`${day}-status`} className="border border-black p-1 w-20">STATUS FINAL</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.grouped[asrama].map((item, idx) => (
                <tr key={item.id} className="align-top">
                  <td className="border border-black p-1 text-center">{idx + 1}</td>
                  <td className="border border-black p-1 font-medium">{item.nama}</td>
                  <td className="border border-black p-1 text-center">{item.kamar}</td>
                  <td className="border border-black p-1 text-center font-bold">{item.jumlah_alfa_pengajian || '-'}</td>
                  <td className="border border-black p-1 text-center font-bold">{item.jumlah_alfa_berjamaah || '-'}</td>
                  {data.days.map((day) => (
                    <Fragment key={`${item.id}-${day}`}>
                      <td key={`${item.id}-${day}-ngaji`} className="border border-black p-1">{sessionsFor(item, day, 'pengajian') || '-'}</td>
                      <td key={`${item.id}-${day}-jamaah`} className="border border-black p-1">{sessionsFor(item, day, 'berjamaah') || '-'}</td>
                      <td key={`${item.id}-${day}-status`} className="border border-black p-1">&nbsp;</td>
                    </Fragment>
                  ))}
                  <td className="border border-black p-1">{item.catatan || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
