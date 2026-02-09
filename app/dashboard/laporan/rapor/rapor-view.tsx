import { terbilang } from "@/lib/terbilang"

export function RaporSatuHalaman({ data, semester, tahunAjaran = "2024/2025" }: { data: any, semester: number, tahunAjaran?: string }) {
  const tglCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="w-[210mm] h-[297mm] bg-white p-10 mx-auto mb-8 shadow-lg print:shadow-none print:mb-0 print:break-after-page text-black relative font-serif text-sm leading-tight">
      
      {/* 1. KOP SURAT */}
      <div className="text-center border-b-4 border-double border-black pb-4 mb-4">
        <h1 className="text-xl font-bold uppercase tracking-widest">Pesantren Sukahideng</h1>
        <p className="text-xs">Sukapameungpeuk, Kec. Sukarame, Kabupaten Tasikmalaya, Jawa Barat</p>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-lg font-bold underline decoration-1 underline-offset-4">LAPORAN HASIL BELAJAR SANTRI</h2>
      </div>

      {/* 2. IDENTITAS */}
      <div className="flex justify-between mb-6 text-sm">
        <table className="w-1/2">
          <tbody>
            <tr><td className="w-24">Nama Santri</td><td>: <b>{data.santri.nama_lengkap}</b></td></tr>
            <tr><td>NIS</td><td>: {data.santri.nis}</td></tr>
            <tr><td>Kelas</td><td>: {data.kelas.nama_kelas}</td></tr>
          </tbody>
        </table>
        <table className="w-1/3">
          <tbody>
            <tr><td className="w-24">Semester</td><td>: {semester} ({semester === 1 ? 'Ganjil' : 'Genap'})</td></tr>
            <tr><td>Tahun Ajaran</td><td>: {tahunAjaran}</td></tr>
          </tbody>
        </table>
      </div>

      {/* 3. TABEL NILAI */}
      <table className="w-full border-collapse border border-black mb-6 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-1 w-8">No</th>
            <th className="border border-black p-1">Mata Pelajaran</th>
            <th className="border border-black p-1 w-1/3">Kitab</th>
            <th className="border border-black p-1 w-12">Nilai</th>
            <th className="border border-black p-1">Terbilang</th>
            <th className="border border-black p-1 w-16">Predikat</th>
          </tr>
        </thead>
        <tbody>
          {data.nilai.map((n: any, idx: number) => (
            <tr key={idx}>
              <td className="border border-black p-1 text-center">{idx + 1}</td>
              <td className="border border-black p-1 px-2">{n.mapel}</td>
              <td className="border border-black p-1 px-2 italic">{n.kitab}</td>
              <td className="border border-black p-1 text-center font-bold">{n.angka}</td>
              <td className="border border-black p-1 px-2 italic capitalize text-xs">{terbilang(n.angka)}</td>
              <td className="border border-black p-1 text-center">
                {n.angka >= 86 ? 'A' : n.angka >= 76 ? 'B+' : n.angka >= 60 ? 'B' : 'C'}
              </td>
            </tr>
          ))}
          {data.nilai.length === 0 && (
            <tr><td colSpan={6} className="border border-black p-4 text-center italic">Nilai belum diinput</td></tr>
          )}
        </tbody>
      </table>

      {/* 4. TABEL BAWAH */}
      <div className="flex gap-4 mb-6">
        <div className="w-1/2 border border-black p-2">
          <h3 className="font-bold border-b border-black mb-2 pb-1">Hasil Akhir</h3>
          <table className="w-full">
            <tbody>
              <tr><td className="w-32">Jumlah Nilai</td><td>: {data.nilai.reduce((a:any,b:any)=>a+b.angka,0)}</td></tr>
              <tr><td>Rata-rata</td><td>: {data.ranking.rata_rata}</td></tr>
              <tr><td>Peringkat Kelas</td><td>: <b>{data.ranking.ranking_kelas}</b></td></tr>
              <tr><td>Predikat Umum</td><td>: {data.ranking.predikat}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="w-1/2 border border-black p-2">
          <h3 className="font-bold border-b border-black mb-2 pb-1">Ketidakhadiran (Sesi)</h3>
          <table className="w-full">
            <tbody>
              <tr><td className="w-32">Sakit</td><td>: {data.absen.sakit}</td></tr>
              <tr><td>Izin</td><td>: {data.absen.izin}</td></tr>
              <tr><td>Alfa (Tanpa Ket.)</td><td>: {data.absen.alfa}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. TANDA TANGAN DINAMIS */}
      <div className="flex justify-between mt-8 text-center break-inside-avoid">
        <div className="w-1/3">
          <p className="mb-16">Orang Tua / Wali</p>
          <p className="font-bold border-b border-black inline-block min-w-[150px]">{data.santri.nama_ayah || "...................."}</p>
        </div>
        <div className="w-1/3">
          <p className="mb-16">Tasikmalaya, {tglCetak}<br/>Wali Kelas</p>
          {/* TAMPILKAN NAMA WALI KELAS DISINI */}
          <p className="font-bold border-b border-black inline-block min-w-[150px]">{data.wali_kelas_nama}</p>
        </div>
      </div>
      
      <div className="text-center mt-4">
        <p>Mengetahui,</p>
        <p className="mb-16">Pimpinan Pesantren</p>
        <p className="font-bold underline">KH. Ii Abdul Basith</p>
      </div>

    </div>
  )
}