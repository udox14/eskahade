import { format } from 'date-fns'
import { id } from 'date-fns/locale'

interface PemanggilanProps {
  data: any[];
  periode: { start: Date; end: Date };
  tglPanggil: Date;
  namaAsrama: string;
}

export function PemanggilanView({ data, periode, tglPanggil, namaAsrama }: PemanggilanProps) {
  const strRange = `${format(periode.start, 'dd', { locale: id })} s.d. ${format(periode.end, 'dd MMMM yyyy', { locale: id })}`
  const hariPanggil = format(tglPanggil, 'EEEE', { locale: id })
  const tglPanggilStr = format(tglPanggil, 'dd MMMM yyyy', { locale: id })

  return (
    <>
      {/* Print page size override — only active during print */}
      <style>{`
        @media print {
          @page { size: 210mm 330mm; margin: 0; }
        }
      `}</style>

      <div
        className="bg-white mx-auto text-black font-serif relative print:shadow-none shadow-lg"
        style={{
          width: '210mm',
          minHeight: '330mm',
          padding: '12mm 12mm 10mm 12mm',
          fontSize: '10pt',
          boxSizing: 'border-box',
          pageBreakInside: 'avoid',
        }}
      >
        {/* JUDUL */}
        <div className="text-center mb-3">
          <p className="font-bold uppercase tracking-wide" style={{ fontSize: '11pt' }}>
            DATA PEMANGGILAN ALFA PENGAJIAN
          </p>
          <p className="font-bold uppercase mt-0.5" style={{ fontSize: '10pt' }}>
            ASRAMA {namaAsrama}
          </p>
          <p className="mt-0.5" style={{ fontSize: '9pt' }}>
            Periode: {strRange}
          </p>
          <div style={{ borderBottom: '2px solid black', marginTop: '6px' }} />
        </div>

        {/* TABEL */}
        <table
          className="w-full border-collapse border border-black"
          style={{ fontSize: '7.5pt', marginBottom: '6px' }}
        >
          <thead className="bg-gray-200 text-center font-bold">
            <tr>
              <th className="border border-black p-0.5" rowSpan={2} style={{ width: '22px' }}>NO</th>
              <th className="border border-black p-0.5" rowSpan={2}>NAMA SANTRI</th>
              <th className="border border-black p-0.5" rowSpan={2} style={{ width: '72px' }}>SEKOLAH</th>
              <th className="border border-black p-0.5" rowSpan={2} style={{ whiteSpace: 'nowrap' }}>KELAS</th>
              <th className="border border-black p-0.5" rowSpan={2} style={{ width: '70px' }}>KAMAR</th>
              <th className="border border-black p-0.5" colSpan={3}>REKAP ALFA</th>
              <th className="border border-black p-0.5" rowSpan={2} style={{ width: '24px' }}>JML</th>
            </tr>
            <tr>
              <th className="border border-black p-0.5" style={{ width: '44px' }}>SBH</th>
              <th className="border border-black p-0.5" style={{ width: '44px' }}>ASR</th>
              <th className="border border-black p-0.5" style={{ width: '44px' }}>MGR</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-black px-2 py-1 text-center italic">
                  Tidak ada data alfa minggu ini.
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? '#f9f9f9' : 'white' }}>
                  <td className="border border-black px-1 py-0.5 text-center">{idx + 1}</td>
                  <td className="border border-black px-2 py-0.5 font-medium">{item.nama}</td>
                  <td className="border border-black px-1 py-0.5 text-center">{item.sekolah ? `${item.sekolah}/ ${item.kelas_sekolah || ''}` : '-'}</td>
                  <td className="border border-black px-1 py-0.5 text-center" style={{ whiteSpace: 'nowrap' }}>{item.kelas || '-'}</td>
                  <td className="border border-black px-1 py-0.5 text-center">{item.kamar}</td>
                  <td className="border border-black px-1 py-0.5 text-center">{item.alfa_shubuh || '-'}</td>
                  <td className="border border-black px-1 py-0.5 text-center">{item.alfa_ashar || '-'}</td>
                  <td className="border border-black px-1 py-0.5 text-center">{item.alfa_maghrib || '-'}</td>
                  <td className="border border-black px-1 py-0.5 text-center font-bold">{item.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* FOOTER */}
        <div
          className="border border-black"
          style={{ padding: '6px 10px', fontSize: '7.5pt', breakInside: 'avoid' }}
        >
          <p className="font-bold mb-1" style={{ fontSize: '9pt' }}>PEMANGGILAN:</p>
          <table style={{ fontSize: '7.5pt' }}>
            <tbody>
              <tr>
                <td style={{ width: '110px', fontWeight: 600 }}>Hari / Tanggal</td>
                <td>: {hariPanggil}, {tglPanggilStr}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Pukul / Tempat</td>
                <td>: 20.30 WIB — Gedung MI Lama Lt. 2 (Putri) / Lt. 3 (Putra)</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Wajib dibawa</td>
                <td>: <span className="font-bold">Buku Pribadi.</span> Ketidakhadiran dikenakan sanksi disiplin lebih berat.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}