import { format } from 'date-fns'
import { id } from 'date-fns/locale'

interface PemanggilanProps {
  data: any[];
  periode: { start: Date; end: Date };
  tglPanggil: Date;
  namaAsrama: string; // Tambahan prop
}

export function PemanggilanView({ data, periode, tglPanggil, namaAsrama }: PemanggilanProps) {
  // Format Tanggal Header
  const strBulan = format(periode.start, 'MMMM yyyy', { locale: id }).toUpperCase()
  const strMinggu = `MINGGU KE-${Math.ceil(periode.start.getDate() / 7)}`
  const strRange = `${format(periode.start, 'dd', { locale: id })} S.D. ${format(periode.end, 'dd MMMM yyyy', { locale: id }).toUpperCase()}`
  
  // Format Tanggal Panggil Footer
  const hariPanggil = format(tglPanggil, 'EEEE', { locale: id }).toUpperCase()
  const tglPanggilStr = format(tglPanggil, 'dd MMMM yyyy', { locale: id }).toUpperCase()

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white p-10 mx-auto text-black font-serif text-sm relative print:shadow-none shadow-lg">
      
      {/* 1. KOP SURAT */}
      <div className="text-center border-b-4 border-double border-black pb-4 mb-4">
        <h1 className="text-2xl font-bold uppercase tracking-widest">PONDOK PESANTREN SUKAHIDENG</h1>
        <p className="text-xs">Sukapameungpeuk, Kec. Sukarame, Kabupaten Tasikmalaya, Jawa Barat</p>
      </div>

      {/* 2. JUDUL DOKUMEN */}
      <div className="text-center mb-6">
        <h2 className="text-base font-bold underline">DATA PEMANGGILAN ALFA PENGAJIAN</h2>
        {/* Nama Asrama Ditampilkan Disini */}
        <h3 className="text-sm font-bold uppercase mt-1 bg-gray-200 inline-block px-4 py-1 rounded">ASRAMA: {namaAsrama}</h3>
        <p className="text-xs font-bold uppercase mt-2">
          {strMinggu} BULAN {strBulan}<br/>
          TANGGAL {strRange}
        </p>
      </div>

      {/* 3. TABEL DATA */}
      <table className="w-full border-collapse border border-black mb-6 text-xs">
        <thead className="bg-gray-200 text-center font-bold">
          <tr>
            <th className="border border-black p-1 w-8" rowSpan={2}>NO</th>
            <th className="border border-black p-1" rowSpan={2}>NAMA SANTRI</th>
            <th className="border border-black p-1 w-20" rowSpan={2}>KAMAR</th>
            <th className="border border-black p-1" colSpan={3}>REKAP ALFA</th>
            <th className="border border-black p-1 w-10" rowSpan={2}>JML</th>
          </tr>
          <tr>
            <th className="border border-black p-1 w-8">SBH</th>
            <th className="border border-black p-1 w-8">ASR</th>
            <th className="border border-black p-1 w-8">MGB</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={7} className="border border-black p-4 text-center italic">Tidak ada data alfa minggu ini.</td></tr>
          ) : (
            data.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black p-1 text-center">{idx + 1}</td>
                <td className="border border-black p-1 px-2 font-medium">{item.nama}</td>
                <td className="border border-black p-1 text-center">{item.kamar}</td>
                <td className="border border-black p-1 text-center">{item.alfa_shubuh || '-'}</td>
                <td className="border border-black p-1 text-center">{item.alfa_ashar || '-'}</td>
                <td className="border border-black p-1 text-center">{item.alfa_maghrib || '-'}</td>
                <td className="border border-black p-1 text-center font-bold">{item.total}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* 4. FOOTER / PEMANGGILAN */}
      <div className="mt-8 border border-black p-4 bg-gray-50/50 break-inside-avoid">
        <p className="font-bold mb-2 underline">PERHATIAN BAGI SANTRI YANG TERCANTUM DI ATAS:</p>
        <p className="text-justify leading-relaxed mb-2">
          Sehubungan dengan ketidakhadiran (Alfa) pada kegiatan pengajian mingguan, maka dengan ini 
          Bagian Keamanan mewajibkan seluruh nama di atas untuk hadir pada:
        </p>
        <div className="ml-4 font-bold my-3 text-sm">
          <table>
            <tbody>
              <tr><td className="w-24">HARI</td><td>: {hariPanggil}</td></tr>
              <tr><td>TANGGAL</td><td>: {tglPanggilStr}</td></tr>
              <tr><td>PUKUL</td><td>: 20.30 WIB (BA'DA ISYA)</td></tr>
              <tr><td>TEMPAT</td><td>: GEDUNG MI LAMA LANTAI 2 (PUTRI) & LANTAI 3 (PUTRA)</td></tr>
            </tbody>
          </table>
        </div>
        <p className="font-bold">
          CATATAN: WAJIB MEMBAWA BUKU PRIBADI (BUKU SAKU).
        </p>
        <p className="text-xs italic mt-1">
          *Bagi yang tidak hadir pada pemanggilan ini akan dikenakan sanksi disiplin lebih berat.
        </p>
      </div>

      <div className="flex justify-end mt-12 text-center break-inside-avoid">
        <div>
          <p className="mb-16">Bagian Keamanan</p>
          <p className="font-bold border-b border-black inline-block min-w-[150px]">..........................</p>
        </div>
      </div>

    </div>
  )
}