import Image from 'next/image'
import { terbilang } from "@/lib/terbilang"

// ─────────────────────────────────────────────
// Helper: Konversi angka → huruf dalam terbilang (Kapital setiap kata)
// ─────────────────────────────────────────────
function toHuruf(angka: number | null | undefined): string {
  if (angka === null || angka === undefined || angka === 0) return '-'
  return terbilang(Math.round(angka))
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// ─────────────────────────────────────────────
// Kepribadian default
// ─────────────────────────────────────────────
const KEPRIBADIAN_DEFAULT = [
  { label: 'Akhlak/Budi Pekerti', predikat: 'Baik' },
  { label: 'Ketekunan Ibadah',    predikat: 'Baik' },
  { label: 'Kerapihan',           predikat: 'Baik' },
  { label: 'Kebersihan',          predikat: 'Baik' },
]

// ─────────────────────────────────────────────
// Komponen Utama
// ─────────────────────────────────────────────
export function RaporSatuHalaman({
  data,
  semester,
  tahunAjaran = '2024/2025',
}: {
  data: any
  semester: number
  tahunAjaran?: string
}) {
  const semesterLabel = semester === 1 ? 'Ganjil' : 'Genap'

  // Tanggal diterbitkan (hari ini)
  const tglCetak = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  // Hitung jumlah + rata-rata dari nilai yang ada
  const nilaiList: any[] = data.nilai ?? []
  const nilaiValid = nilaiList.filter((n: any) => n.angka && n.angka > 0)
  const jumlahNilai = nilaiValid.reduce((a: number, b: any) => a + (b.angka ?? 0), 0)

  // Rata-rata pakai data dari ranking jika ada, fallback hitung manual
  const rataRata: number =
    data.ranking?.rata_rata > 0
      ? parseFloat(Number(data.ranking.rata_rata).toFixed(2))
      : nilaiValid.length > 0
      ? parseFloat((jumlahNilai / nilaiValid.length).toFixed(2))
      : 0

  const rankingKelas = data.ranking?.ranking_kelas ?? '-'
  const totalSantri  = data.ranking?.total_santri ?? '-'
  const naik         = data.kelas?.grade_lanjutan ?? '-'
  const catatanWali  = data.ranking?.catatan_wali_kelas ?? ''

  const kepribadian: { label: string; predikat: string }[] =
    data.kepribadian?.length ? data.kepribadian : KEPRIBADIAN_DEFAULT

  return (
    <div
      className={[
        'w-[210mm] min-h-[297mm] bg-white mx-auto',
        'shadow-lg print:shadow-none print:break-after-page',
        'text-black text-[11.5px] leading-snug',
        'px-[14mm] py-[8mm]',
      ].join(' ')}
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {/* ═══════════════════════════════════════
          KOP SURAT
      ═══════════════════════════════════════ */}
      <div className="mb-3">
        <Image
          src="/kop-pesantren.png"
          alt="Kop Pesantren Sukahideng"
          width={760}
          height={120}
          className="w-full object-contain"
          priority
        />
      </div>

      {/* ═══════════════════════════════════════
          JUDUL RAPOR
      ═══════════════════════════════════════ */}
      <div className="text-center my-3">
        <h2 className="text-[14px] font-bold tracking-widest uppercase">
          Laporan Hasil Belajar
        </h2>
      </div>

      {/* ═══════════════════════════════════════
          IDENTITAS SANTRI  (2 kolom)
      ═══════════════════════════════════════ */}
      <table className="w-full text-[11.5px] mb-4">
        <tbody>
          <tr>
            <td className="w-[45%]">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="w-[110px] py-[2.5px] whitespace-nowrap">Nama</td>
                    <td className="w-3 py-[2.5px]">:</td>
                    <td className="font-bold py-[2.5px] whitespace-nowrap">{data.santri?.nama_lengkap ?? '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-[2.5px] whitespace-nowrap">Marhalah</td>
                    <td className="py-[2.5px]">:</td>
                    <td className="py-[2.5px] whitespace-nowrap">{data.kelas?.marhalah?.nama ?? data.kelas?.nama_kelas ?? '-'}</td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td className="w-[55%]">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="w-[110px] py-[2.5px] whitespace-nowrap">Tahun Pelajaran</td>
                    <td className="w-3 py-[2.5px]">:</td>
                    <td className="font-bold py-[2.5px] whitespace-nowrap">{tahunAjaran}</td>
                  </tr>
                  <tr>
                    <td className="py-[2.5px] whitespace-nowrap">Semester</td>
                    <td className="py-[2.5px]">:</td>
                    <td className="py-[2.5px] whitespace-nowrap">{semesterLabel}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ═══════════════════════════════════════
          TABEL NILAI
      ═══════════════════════════════════════ */}
      <table className="w-full border-collapse border border-black text-[11px] mb-1">
        <thead>
          <tr className="text-center">
            <th className="border border-black px-2 py-[5px] w-6 whitespace-nowrap" rowSpan={2}>NO</th>
            <th className="border border-black px-2 py-[5px] whitespace-nowrap" rowSpan={2}>MATA PELAJARAN</th>
            <th className="border border-black px-2 py-[5px] whitespace-nowrap" rowSpan={2}>NAMA KITAB</th>
            <th className="border border-black px-2 py-[5px] whitespace-nowrap" colSpan={2}>NILAI</th>
            <th className="border border-black px-2 py-[5px] w-[80px] whitespace-nowrap" rowSpan={2}>Rata-rata<br/>Kelas</th>
          </tr>
          <tr className="text-center">
            <th className="border border-black px-2 py-[5px] w-[50px] whitespace-nowrap">Angka</th>
            <th className="border border-black px-2 py-[5px] whitespace-nowrap">Huruf</th>
          </tr>
        </thead>
        <tbody>
          {nilaiList.length === 0 ? (
            <tr>
              <td colSpan={6} className="border border-black p-3 text-center italic text-slate-500 whitespace-nowrap">
                Nilai belum diinput
              </td>
            </tr>
          ) : (
            nilaiList.map((n: any, idx: number) => {
              const angka = n.angka ?? null
              const isEmpty = angka === null || angka === 0
              return (
                <tr key={idx}>
                  <td className="border border-black px-2 py-[4px] text-center whitespace-nowrap">{idx + 1}</td>
                  <td className="border border-black px-3 py-[4px] font-semibold uppercase whitespace-nowrap">{n.mapel}</td>
                  <td className="border border-black px-3 py-[4px] italic whitespace-nowrap">{isEmpty ? '-' : n.kitab}</td>
                  <td className="border border-black px-2 py-[4px] text-center whitespace-nowrap">{isEmpty ? '-' : angka}</td>
                  <td className="border border-black px-3 py-[4px] italic whitespace-nowrap">{isEmpty ? '-' : toHuruf(angka)}</td>
                  <td className="border border-black px-2 py-[4px] text-center whitespace-nowrap">
                    {isEmpty ? '-' : (n.rata_kelas > 0 ? Number(n.rata_kelas).toFixed(2) : '-')}
                  </td>
                </tr>
              )
            })
          )}

          {/* Jumlah Nilai */}
          <tr className="font-semibold">
            <td colSpan={3} className="border border-black px-3 py-[5px] text-center whitespace-nowrap">Jumlah Nilai</td>
            <td className="border border-black px-2 py-[5px] text-center whitespace-nowrap">{nilaiValid.length > 0 ? jumlahNilai : '-'}</td>
            <td colSpan={2} className="border border-black px-3 py-[5px] italic whitespace-nowrap">
              {nilaiValid.length > 0 ? toHuruf(jumlahNilai) : '-'}
            </td>
          </tr>

          {/* Nilai Rata-Rata */}
          <tr className="font-semibold">
            <td colSpan={3} className="border border-black px-3 py-[5px] text-center whitespace-nowrap">Nilai Rata-Rata</td>
            <td colSpan={3} className="border border-black px-2 py-[5px] text-center whitespace-nowrap">
              {rataRata > 0 ? rataRata.toFixed(2) : '-'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ═══════════════════════════════════════
          RANKING
      ═══════════════════════════════════════ */}
      <table className="w-full border-collapse border border-black text-[11px] mb-3">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-[6px] text-center font-semibold whitespace-nowrap">
              Ranking Ke-{rankingKelas} dari {totalSantri} Santri
            </td>
          </tr>
        </tbody>
      </table>

      {/* ═══════════════════════════════════════
          CATATAN AKHIR SEMESTER
      ═══════════════════════════════════════ */}
      <div className="mb-3">
        <p className="font-bold text-[11.5px] mb-1">CATATAN AKHIR SEMESTER</p>

        <div className="flex gap-3">
          {/* KOLOM KIRI: Kepribadian, Ketidakhadiran, Kenaikan */}
          <div className="flex-1 flex flex-col justify-between">
            {/* Kepribadian */}
            <div>
              <table className="w-full border-collapse border border-black text-[11px]">
                <thead>
                  <tr className="text-center bg-gray-50">
                    <th className="border border-black px-2 py-[4px] whitespace-nowrap" colSpan={2}>Kepribadian</th>
                    <th className="border border-black px-2 py-[4px] w-[80px] whitespace-nowrap">Predikat</th>
                  </tr>
                </thead>
                <tbody>
                  {kepribadian.map((k, i) => (
                    <tr key={i}>
                      <td className="border border-black px-1 py-[3.5px] text-center w-5 whitespace-nowrap">{i + 1}</td>
                      <td className="border border-black px-2 py-[3.5px] whitespace-nowrap">{k.label}</td>
                      <td className="border border-black px-2 py-[3.5px] text-center font-medium whitespace-nowrap">{k.predikat}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="h-2" />

            {/* Ketidakhadiran */}
            <div>
              <table className="w-full border-collapse border border-black text-[11px]">
                <thead>
                  <tr className="text-center bg-gray-50">
                    <th className="border border-black px-2 py-[4px] whitespace-nowrap" colSpan={2}>Ketidakhadiran</th>
                    <th className="border border-black px-2 py-[4px] w-[80px] whitespace-nowrap">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Sakit', val: data.absen?.sakit ?? 0 },
                    { label: 'Izin',  val: data.absen?.izin  ?? 0 },
                    { label: 'Alpa',  val: data.absen?.alfa  ?? 0 },
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="border border-black px-1 py-[3.5px] text-center w-5 whitespace-nowrap">{i + 1}</td>
                      <td className="border border-black px-2 py-[3.5px] whitespace-nowrap">{row.label}</td>
                      <td className="border border-black px-2 py-[3.5px] text-center whitespace-nowrap">
                        {row.val > 0 ? `${row.val} Hari` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="h-2" />

            {/* Naik Ke Marhalah */}
            <div>
              <table className="w-full border-collapse border border-black text-[11px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-black px-2 py-[4px] text-center whitespace-nowrap">Naik Ke Marhalah:</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black px-2 py-[5px] text-center font-bold text-black uppercase whitespace-nowrap">
                      {naik || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* KOLOM KANAN: Saran Wali Kelas & Saran Orang Tua */}
          <div className="w-[44%] flex flex-col justify-between">
            {/* Saran Wali Kelas */}
            <table className="w-full border-collapse border border-black text-[11px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-black px-2 py-[4px] text-center whitespace-nowrap">Catatan / Saran Wali Kelas</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black px-3 py-2 h-[105px] align-top text-left">
                    <span className="text-[10.5px] text-slate-700 italic whitespace-pre-wrap leading-relaxed">
                      {catatanWali || '-'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="h-2" />

            {/* Tanggapan Orang Tua */}
            <table className="w-full border-collapse border border-black text-[11px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-black px-2 py-[4px] text-center whitespace-nowrap">Tanggapan Orang Tua / Wali</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black px-3 py-2 h-[95px] align-bottom">
                    <div className="border-t border-dashed border-gray-400 w-full mt-10 mb-1" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          TANGGAL & TEMPAT DITERBITKAN
      ═══════════════════════════════════════ */}
      <div className="flex justify-end mb-4 text-[11px]">
        <div className="w-[32%] text-left pl-2">
          <table className="w-full">
            <tbody>
              <tr>
                <td className="w-[90px] py-[1px] whitespace-nowrap">Diberikan di</td>
                <td className="w-3 py-[1px]">:</td>
                <td className="py-[1px] font-semibold whitespace-nowrap">Sukahideng</td>
              </tr>
              <tr>
                <td className="py-[1px] whitespace-nowrap">Pada tanggal</td>
                <td className="py-[1px]">:</td>
                <td className="py-[1px] font-semibold whitespace-nowrap">{tglCetak}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          TANDA TANGAN
      ═══════════════════════════════════════ */}
      <div className="flex justify-between items-start mt-2">
        {/* Orang Tua */}
        <div className="text-center w-[28%] flex flex-col justify-between h-[100px]">
          <p className="mb-0 whitespace-nowrap">Orang Tua/ Wali,</p>
          <div>
            <div className="border-b border-black w-full" />
            <p className="text-[11px] invisible pt-[2px] mb-0">placeholder</p>
          </div>
        </div>

        {/* Wali Kelas */}
        <div className="text-center w-[32%] flex flex-col justify-between h-[100px]">
          <p className="mb-0 whitespace-nowrap">Wali Kelas,</p>
          <div>
            <p className="font-bold uppercase border-t border-black pt-[2px] mb-0 text-[11px] whitespace-nowrap">
              {data.wali_kelas_nama}
            </p>
          </div>
        </div>

        {/* Pimpinan Pesantren */}
        <div className="text-center w-[32%] flex flex-col justify-between h-[100px]">
          <p className="mb-0 whitespace-nowrap">Pimpinan Pesantren,</p>
          <div className="relative flex flex-col items-center w-full">
            <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 h-[50px] w-[100px] pointer-events-none">
              <Image
                src="/ttd-pimpinan.png"
                alt="TTD Pimpinan"
                width={100}
                height={50}
                className="object-contain w-full h-full"
              />
            </div>
            <p className="font-bold uppercase border-t border-black pt-[2px] mb-0 text-[11px] w-full whitespace-nowrap">
              Drs. KH. Ii Abdul Basith Wahab
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}