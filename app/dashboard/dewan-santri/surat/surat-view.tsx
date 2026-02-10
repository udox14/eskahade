import { format } from 'date-fns'
import { id } from 'date-fns/locale'

/* ASSETS: /kop-pesantren.png, /kop-dewan-santri.png, /ttd-pimpinan.png, etc */

interface SuratProps {
  jenis: 'MONDOK' | 'IZIN' | 'BERHENTI' | 'TAGIHAN';
  dataSantri: any;
  dataTambahan?: any; 
  dataTunggakan?: any; 
}

export function SuratView({ jenis, dataSantri, dataTambahan, dataTunggakan }: SuratProps) {
  const tglCetak = format(new Date(), 'dd MMMM yyyy', { locale: id })
  const tahunIni = new Date().getFullYear()
  
  // Helper: Jika data kosong, ganti dengan titik-titik panjang untuk tulis manual
  const chk = (val: any) => val || "......................................................"

  // --- KONFIGURASI KOP & PENANDATANGAN UTAMA ---
  let kopImage = '/kop-dewan-santri.png'
  let ttdImage = '/ttd-dewan-santri.png'
  let stempelImage = '/stempel-dewan-santri.png'
  let jabatanTtd = 'Ketua Dewan Santri'
  let namaTtd = 'Muhammad Fakhri, S.Pd.' // Hapus Gelar Ust.

  if (jenis === 'IZIN') {
    kopImage = '/kop-pesantren.png'
    ttdImage = '/ttd-kesantrian.png'
    stempelImage = '/stempel-pesantren.png'
    namaTtd = 'KH. T. Mukhtar Wahab, S.Ag.'
    jabatanTtd = 'Wakil Pimpinan Bid. Kesantrian'
  } else if (jenis === 'BERHENTI') {
    kopImage = '/kop-pesantren.png'
    ttdImage = '/ttd-pimpinan.png'
    stempelImage = '/stempel-pesantren.png'
    namaTtd = 'Drs. KH. I. Abdul Basith Wahab'
    jabatanTtd = 'Pimpinan Pesantren'
  }

  // Component Tanda Tangan Standard (Reusable untuk selain Pimpinan)
  const TandaTanganSection = ({ kota = "Tasikmalaya" }) => (
    <div className="mt-8 flex justify-end px-4">
      <div className="text-center relative min-w-[280px]">
        <p className="mb-1">{kota}, {tglCetak}</p>
        
        {/* Jabatan */}
        <p className="font-bold relative z-10">{jabatanTtd},</p>
        
        {/* Container Gambar Standard */}
        <div className="relative w-full h-28 flex items-end justify-center -mt-6 z-20">
           <img 
             src={stempelImage} 
             alt="Stempel" 
             className="absolute left-6 top-0 w-32 opacity-80 rotate-[-5deg] mix-blend-multiply" 
           />
           <img 
             src={ttdImage} 
             alt="TTD" 
             className="absolute bottom-2 w-40 h-24 object-contain" 
           />
        </div>
        
        {/* Nama Terang */}
        <p className="font-bold underline relative z-30 -mt-6 text-[15px]">{namaTtd}</p>
      </div>
    </div>
  )

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white p-10 mx-auto text-black font-serif relative print:shadow-none shadow-lg text-[14px] leading-relaxed">
      
      {/* 1. KOP SURAT */}
      <div className="mb-2">
        <img 
          src={kopImage} 
          alt="Kop Surat" 
          className="w-full object-contain" 
          style={{ maxHeight: '150px' }} 
        />
      </div>

      {/* 2. ISI SURAT */}
      <div className="px-4">
        
        {/* ======================= 1. SURAT KETERANGAN MONDOK ======================= */}
        {jenis === 'MONDOK' && (
          <>
            <div className="text-center mb-6 mt-2">
              <h2 className="text-lg font-bold underline">SURAT KETERANGAN MUKIM</h2>
              <p>Nomor : ...../DS-SKH/{tahunIni}</p>
            </div>
            
            <p className="mb-4 text-justify">
              Yang bertanda tangan di bawah ini Pengurus Pondok Pesantren Sukahideng yang beralamat di Desa Sukarapih RT.016 / RW.04 Kecamatan Sukarame Kabupaten Tasikmalaya Kode Pos 46461 Nomor Statistik Pondok Pesantren (NSPP): 51.2.32.06.26.002 menerangkan bahwa :
            </p>
            
            <table className="w-full mb-4 ml-4">
              <tbody>
                <tr><td className="w-48 font-bold align-top py-1">Nama</td><td className="align-top">: {chk(dataSantri.nama_lengkap)}</td></tr>
                <tr><td className="font-bold align-top py-1">Tempat Tanggal Lahir</td><td className="align-top">: {dataSantri.tempat_lahir || '.....................'}, {dataSantri.tanggal_lahir ? format(new Date(dataSantri.tanggal_lahir), 'dd MMMM yyyy', {locale:id}) : '.....................'}</td></tr>
                <tr><td className="font-bold align-top py-1">Jenis Kelamin</td><td className="align-top">: {dataSantri.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td></tr>
                <tr><td className="font-bold align-top py-1">Orang Tua</td><td className="align-top">: {chk(dataSantri.nama_ayah)}</td></tr>
                <tr><td className="font-bold align-top py-1">Alamat</td><td className="align-top">: {chk(dataSantri.alamat)}</td></tr>
              </tbody>
            </table>
            
            <p className="mb-4 text-justify">
              Nama tersebut benar sebagai santri Pondok Pesantren Sukahideng Terhitung Sejak Tahun {tahunIni} sampai Sekarang.
            </p>
            <p>
              Demikian surat keterangan ini, kami buat dengan sebenar-benarnya dan dapat digunakan sebagaimana mestinya.
            </p>

            <TandaTanganSection />
          </>
        )}

        {/* ======================= 2. SURAT IZIN KHUSUS ======================= */}
        {jenis === 'IZIN' && (
          <>
            <div className="text-center mb-6 mt-2">
              <h2 className="text-lg font-bold underline">SURAT IZIN PULANG</h2>
              <p>Nomor : ...../KES-SKH/{tahunIni}</p>
            </div>

            <p className="mb-4 text-justify">
              Yang bertanda tangan di bawah ini Wakil Pimpinan Pondok Pesantren Sukahideng Bidang Kesantrian menerangkan bahwa:
            </p>

            <table className="w-full mb-4 ml-4">
              <tbody>
                <tr><td className="w-48 font-bold align-top py-1">Nama</td><td className="align-top">: {chk(dataSantri.nama_lengkap)}</td></tr>
                <tr><td className="font-bold align-top py-1">TTL</td><td className="align-top">: {dataSantri.tempat_lahir || '.....................'}, {dataSantri.tanggal_lahir ? format(new Date(dataSantri.tanggal_lahir), 'dd MMMM yyyy', {locale:id}) : '.....................'}</td></tr>
                <tr><td className="font-bold align-top py-1">Jenis Kelamin</td><td className="align-top">: {dataSantri.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td></tr>
                <tr><td className="font-bold align-top py-1">Sekolah</td><td className="align-top">: {chk(dataSantri.sekolah)}</td></tr>
                <tr><td className="font-bold align-top py-1">Nama Orang Tua</td><td className="align-top">: {chk(dataSantri.nama_ayah)}</td></tr>
                <tr><td className="font-bold align-top py-1">Alamat</td><td className="align-top">: {chk(dataSantri.alamat)}</td></tr>
              </tbody>
            </table>

            <p className="mb-4 text-justify">
              Nama tersebut di atas diberikan izin untuk melaksanakan <b>{dataTambahan?.alasan || '...................................................'}</b> terhitung sejak tanggal <b>{dataTambahan?.tglMulai ? format(new Date(dataTambahan.tglMulai), 'dd MMMM yyyy', {locale:id}) : '.....................'}</b> s.d. <b>{dataTambahan?.tglSelesai ? format(new Date(dataTambahan.tglSelesai), 'dd MMMM yyyy', {locale:id}) : '.....................'}</b>.
            </p>
            <p>
              Demikian surat keterangan ini, dibuat dengan sebenar-benarnya dan dapat digunakan sebagaimana mestinya.
            </p>

            <TandaTanganSection />
          </>
        )}

         {/* ======================= 3. SURAT TAGIHAN SPP ======================= */}
         {jenis === 'TAGIHAN' && (
          <>
            <div className="flex justify-between items-start mb-6 mt-2">
                <div className="w-1/2">
                    <p>Nomor : .../TAG-SPP/{tahunIni}</p>
                    <p>Lampiran : -</p>
                    <p>Perihal : <b>Pemberitahuan Tunggakan SPP</b></p>
                </div>
                <div className="w-1/2 pl-8">
                    <p>Kepada Yth: Orang Tua/ Wali</p>
                    <p>Dari <b>{chk(dataSantri.nama_lengkap)}</b></p>
                    <p>di Tempat</p>
                </div>
            </div>

            <div className="leading-relaxed">
                <p className="mb-4 italic">Assalaamu’alaikum warahmatullaahi wabarakaatuh.</p>
                <p className="mb-4 text-justify">
                    Teriring do’a semoga Bapak / Ibu Wali santri senantiasa ada dalam lindungan dan maghfiroh Allah SWT. Aamiin.
                </p>
                <p className="mb-2 text-justify">
                    Selanjutnya dalam pencatatan administrasi keuangan di Sekretariat Pesantren, Kami beritahukan bahwa putra / putri Bapak / Ibu Wali:
                </p>
                
                <table className="w-full mb-4 ml-4 font-bold">
                    <tbody>
                        <tr><td className="w-40 py-1">Nama</td><td>: {chk(dataSantri.nama_lengkap)}</td></tr>
                        <tr><td className="py-1">Asrama / Kamar</td><td>: {dataSantri.asrama || '...'} / Kamar {dataSantri.kamar || '...'}</td></tr>
                    </tbody>
                </table>

                <p className="mb-4">masih mempunyai tunggakan Uang SPP bulanan sebagai berikut:</p>

                <div className="border-2 border-black p-4 mb-4 bg-gray-50">
                    <p className="mb-2 text-base font-mono whitespace-pre-wrap">{dataTunggakan?.listBulan || "Data Lunas / Tidak Tersedia"}</p>
                    <hr className="border-black mb-2"/>
                    <p className="text-right font-bold text-lg">Total: Rp {dataTunggakan?.total?.toLocaleString('id-ID') || 0}</p>
                </div>

                <p className="mb-2 text-justify">
                    Mohon maaf yang sebesar-besarnya bila ada kesalahan dalam jumlah tagihan, dan bisa diselesaikan di Sekretariat Pesantren.
                </p>
                <p className="mb-2 text-justify">
                    Demikian pemberitahuan dan permohonan ini Kami sampaikan. Atas perhatian dan kerjasamanya Kami haturkan terimakasih.
                </p>
                <p className="mb-4 italic">Wassalaamu’alaikum warahmatullaahi wabarakaatuh.</p>
            </div>

            <TandaTanganSection kota="Sukahideng" />
          </>
        )}

        {/* ======================= 4. SURAT PENGUNDURAN DIRI ======================= */}
        {jenis === 'BERHENTI' && (
          <>
             <div className="text-center mb-6 mt-2">
              <h2 className="text-lg font-bold underline">SURAT PENGUNDURAN DIRI</h2>
              <p>Nomor : ...../PP-SKH/{tahunIni}</p>
            </div>

            <p className="mb-1">Yang bertanda tangan di bawah ini :</p>
            <table className="w-full mb-2 ml-4">
              <tbody>
                <tr><td className="w-40 font-bold align-top">Nama Wali Santri</td><td className="align-top">: {chk(dataSantri.nama_ayah)} (Ayah/Wali)</td></tr>
                <tr><td className="font-bold align-top">Alamat</td><td className="align-top">: {chk(dataSantri.alamat)}</td></tr>
                <tr><td className="font-bold align-top">Nomor WA</td><td className="align-top">: ...........................................................</td></tr>
              </tbody>
            </table>

            <p className="mb-1">Selaku wali santri dari :</p>
            <table className="w-full mb-2 ml-4">
              <tbody>
                <tr><td className="w-40 font-bold align-top">Nama Santri</td><td className="align-top">: {chk(dataSantri.nama_lengkap)}</td></tr>
                <tr><td className="font-bold align-top">Asrama/Kamar</td><td className="align-top">: {dataSantri.asrama || '...'} / {dataSantri.kamar || '...'}</td></tr>
                <tr><td className="font-bold align-top">Sekolah/Kelas</td><td className="align-top">: {dataSantri.sekolah || '...'} / {dataSantri.kelas_sekolah || '...'}</td></tr>
              </tbody>
            </table>

            <p className="mb-4 text-justify">
              Dengan ini kami menyatakan untuk mengundurkan diri dari Pondok Pesantren Sukahideng dikarenakan <b>"{dataTambahan?.alasan || '................................................'}"</b>. Demikian pernyataan ini kami buat dengan sesungguhnya.
            </p>

            <p className="text-right mb-2 font-bold">Sukahideng, {tglCetak}</p>
            <p className="mb-4 font-bold">Yang membuat pernyataan,</p>

            {/* GRID TANDA TANGAN KOMPLEKS */}
            <div className="grid grid-cols-2 gap-y-12 gap-x-4 mb-4">
                <div className="text-center">
                    <p className="mb-15 font-bold">Wali Santri,</p>
                    <p className="font-bold underline">{chk(dataSantri.nama_ayah)}</p>
                </div>
                <div className="text-center">
                    <p className="mb-15 font-bold">Santri yang bersangkutan,</p>
                    <p className="font-bold underline">{chk(dataSantri.nama_lengkap)}</p>
                </div>

                <div className="text-center">
                    <p className="mb-15 font-bold">Dewan Santri,</p>
                    <p className="font-bold">...................................................</p>
                </div>
                <div className="text-center">
                    <p className="mb-15 font-bold">Pengurus Asrama,</p>
                    <p className="font-bold">...................................................</p>
                </div>
            </div>

            {/* TTD PIMPINAN (CENTER) - CUSTOM LAYOUT UNTUK PIMPINAN */}
            <div className="flex justify-center mt-2">
                <div className="text-center relative min-w-[280px]">
                    <p className="mb-1 font-bold">Mengetahui,</p>
                    <p className="font-bold relative z-10">{jabatanTtd},</p>
                    
                    {/* KHUSUS PIMPINAN: Container lebih tinggi (h-36) dan TTD turun (top-6) */}
                    <div className="relative w-full h-34 flex items-start justify-center -mt-4 z-20">
                        {/* Stempel */}
                        <img src={stempelImage} alt="Stempel" className="absolute left-2 top-0 w-32 opacity-80 rotate-[-5deg] mix-blend-multiply" />
                        {/* TTD Pimpinan digeser agak ke bawah agar garis gantungnya pas */}
                        <img src={ttdImage} alt="TTD" className="absolute top-12 w-48 h-32 object-contain" />
                    </div>

                    {/* Nama Pimpinan */}
                    <p className="font-bold underline relative z-30 -mt-8 text-[15px]">{namaTtd}</p>
                </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}