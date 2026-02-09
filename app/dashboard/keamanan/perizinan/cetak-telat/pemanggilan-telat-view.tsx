import { format } from 'date-fns'
import { id } from 'date-fns/locale'

interface Props {
  dataPerAsrama: Record<string, any[]>;
  tglPanggil: Date;
}

export function PemanggilanTelatView({ dataPerAsrama, tglPanggil }: Props) {
  const asramaList = Object.keys(dataPerAsrama).sort()
  
  // Format Tanggal Panggil Footer
  const hariPanggil = format(tglPanggil, 'EEEE', { locale: id }).toUpperCase()
  const tglPanggilStr = format(tglPanggil, 'dd MMMM yyyy', { locale: id }).toUpperCase()
  const tglCetak = format(new Date(), 'dd MMMM yyyy', { locale: id })

  return (
    <div className="w-[210mm] text-black font-serif text-sm">
      
      {/* Loop Setiap Asrama = Halaman Baru */}
      {asramaList.map((asrama) => (
        <div key={asrama} className="min-h-[297mm] bg-white p-10 relative print:shadow-none shadow-lg mb-8 break-after-page">
          
          {/* 1. KOP SURAT */}
          <div className="text-center border-b-4 border-double border-black pb-4 mb-4">
            <h1 className="text-2xl font-bold uppercase tracking-widest">PONDOK PESANTREN SUKAHIDENG</h1>
            <p className="text-xs">Sukapameungpeuk, Kec. Sukarame, Kabupaten Tasikmalaya, Jawa Barat</p>
          </div>

          {/* 2. JUDUL DOKUMEN */}
          <div className="text-center mb-6">
            <h2 className="text-base font-bold underline">DAFTAR SANTRI TERLAMBAT KEMBALI IZIN</h2>
            <h3 className="text-sm font-bold uppercase mt-1 bg-gray-200 inline-block px-4 py-1 rounded">ASRAMA: {asrama}</h3>
            <p className="text-xs mt-2">Data Per Tanggal: {tglCetak}</p>
          </div>

          {/* 3. TABEL DATA */}
          <table className="w-full border-collapse border border-black mb-6 text-xs">
            <thead className="bg-gray-200 text-center font-bold">
              <tr>
                <th className="border border-black p-1 w-8">NO</th>
                <th className="border border-black p-1">NAMA SANTRI</th>
                <th className="border border-black p-1 w-16">KAMAR</th>
                <th className="border border-black p-1">JENIS IZIN</th>
                <th className="border border-black p-1">BATAS WAKTU</th>
                <th className="border border-black p-1">DURASI TELAT</th>
              </tr>
            </thead>
            <tbody>
              {dataPerAsrama[asrama].map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="border border-black p-1 text-center">{idx + 1}</td>
                  <td className="border border-black p-1 px-2 font-medium">{item.nama}</td>
                  <td className="border border-black p-1 text-center">{item.kamar}</td>
                  <td className="border border-black p-1 text-center">{item.jenis}</td>
                  <td className="border border-black p-1 text-center">
                    {format(new Date(item.rencana_kembali), 'dd/MM/yy HH:mm')}
                  </td>
                  <td className="border border-black p-1 text-center font-bold text-red-900 bg-red-50">
                    {item.durasi_telat}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 4. FOOTER (SAMA DENGAN ALFA PENGAJIAN) */}
          <div className="mt-8 border border-black p-4 bg-gray-50/50 break-inside-avoid">
            <p className="font-bold mb-2 underline">PERHATIAN BAGI SANTRI YANG TERCANTUM DI ATAS:</p>
            <p className="text-justify leading-relaxed mb-2">
              Sehubungan dengan keterlambatan kembali ke pondok (melebihi batas waktu izin yang ditentukan), 
              maka dengan ini Bagian Keamanan mewajibkan seluruh nama di atas untuk hadir pada:
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
              CATATAN: WAJIB MEMBAWA BUKU PRIBADI.
            </p>
            <p className="text-xs italic mt-1">
              *Bagi yang tidak hadir pada pemanggilan ini akan dikenakan sanksi disiplin lebih berat.
            </p>
          </div>
          
          {/* TANPA TANDA TANGAN (Sesuai Request) */}
        </div>
      ))}
    </div>
  )
}