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
        'text-black font-serif text-[11px] leading-snug',
        'px-[14mm] py-[8mm]',
      ].join(' ')}
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
        <h2 className="text-[13px] font-bold tracking-widest uppercase underline decoration-1 underline-offset-2">
          Laporan Hasil Belajar
        </h2>
      </div>

      {/* ═══════════════════════════════════════
          IDENTITAS SANTRI  (2 kolom)
      ═══════════════════════════════════════ */}
      <table className="w-full text-[11px] mb-4">
        <tbody>
          <tr>
            <td className="w-[45%]">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="w-[110px] py-[1px]">Nama</td>
                    <td className="w-3 py-[1px]">:</td>
                    <td className="font-bold py-[1px]">{data.santri?.nama_lengkap ?? '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-[1px]">Marhalah</td>
                    <td className="py-[1px]">:</td>
                    <td className="py-[1px]">{data.kelas?.marhalah?.nama ?? data.kelas?.nama_kelas ?? '-'}</td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td className="w-[55%]">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="w-[110px] py-[1px]">Tahun Pelajaran</td>
                    <td className="w-3 py-[1px]">:</td>
                    <td className="font-bold py-[1px]">{tahunAjaran}</td>
                  </tr>
                  <tr>
                    <td className="py-[1px]">Semester</td>
                    <td className="py-[1px]">:</td>
                    <td className="py-[1px]">{semesterLabel}</td>
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
      <table className="w-full border-collapse border border-black text-[10.5px] mb-1">
        <thead>
          <tr className="text-center">
            <th className="border border-black px-1 py-[3px] w-6" rowSpan={2}>NO</th>
            <th className="border border-black px-1 py-[3px]" rowSpan={2}>MATA PELAJARAN</th>
            <th className="border border-black px-1 py-[3px]" rowSpan={2}>NAMA KITAB</th>
            <th className="border border-black px-1 py-[3px]" colSpan={2}>NILAI</th>
            <th className="border border-black px-1 py-[3px] w-[68px]" rowSpan={2}>Rata-rata<br/>Kelas</th>
          </tr>
          <tr className="text-center">
            <th className="border border-black px-1 py-[3px] w-[46px]">Angka</th>
            <th className="border border-black px-1 py-[3px]">Huruf</th>
          </tr>
        </thead>
        <tbody>
          {nilaiList.length === 0 ? (
            <tr>
              <td colSpan={6} className="border border-black p-3 text-center italic text-slate-500">
                Nilai belum diinput
              </td>
            </tr>
          ) : (
            nilaiList.map((n: any, idx: number) => {
              const angka = n.angka ?? null
              const isEmpty = angka === null || angka === 0
              return (
                <tr key={idx}>
                  <td className="border border-black px-1 py-[2px] text-center">{idx + 1}</td>
                  <td className="border border-black px-2 py-[2px] font-semibold uppercase">{n.mapel}</td>
                  <td className="border border-black px-2 py-[2px] italic">{isEmpty ? '-' : n.kitab}</td>
                  <td className="border border-black px-1 py-[2px] text-center">{isEmpty ? '-' : angka}</td>
                  <td className="border border-black px-2 py-[2px] italic">{isEmpty ? '-' : toHuruf(angka)}</td>
                  <td className="border border-black px-1 py-[2px] text-center">
                    {isEmpty ? '-' : (n.rata_kelas > 0 ? Number(n.rata_kelas).toFixed(2) : '-')}
                  </td>
                </tr>
              )
            })
          )}

          {/* Jumlah Nilai */}
          <tr className="font-semibold">
            <td colSpan={3} className="border border-black px-2 py-[3px] text-center">Jumlah Nilai</td>
            <td className="border border-black px-1 py-[3px] text-center">{nilaiValid.length > 0 ? jumlahNilai : '-'}</td>
            <td colSpan={2} className="border border-black px-2 py-[3px] italic">
              {nilaiValid.length > 0 ? toHuruf(jumlahNilai) : '-'}
            </td>
          </tr>

          {/* Nilai Rata-Rata */}
          <tr className="font-semibold">
            <td colSpan={3} className="border border-black px-2 py-[3px] text-center">Nilai Rata-Rata</td>
            <td colSpan={3} className="border border-black px-1 py-[3px] text-center">
              {rataRata > 0 ? rataRata.toFixed(2) : '-'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ═══════════════════════════════════════
          RANKING
      ═══════════════════════════════════════ */}
      <table className="w-full border-collapse border border-black text-[10.5px] mb-3">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-[4px] text-center font-semibold">
              Ranking Ke-{rankingKelas} dari {totalSantri} Santri
            </td>
          </tr>
        </tbody>
      </table>

      {/* ═══════════════════════════════════════
          CATATAN AKHIR SEMESTER
      ═══════════════════════════════════════ */}
      <div className="mb-2">
        <p className="font-bold text-[11px] mb-1">CATATAN AKHIR SEMESTER</p>

        {/* Baris 1: Kepribadian + Saran Wali Kelas */}
        <div className="flex gap-3 mb-2">
          {/* Kepribadian */}
          <div className="flex-1">
            <table className="w-full border-collapse border border-black text-[10.5px]">
              <thead>
                <tr className="text-center">
                  <th className="border border-black px-2 py-[3px]" colSpan={2}>Kepribadian</th>
                  <th className="border border-black px-2 py-[3px] w-[80px]">Predikat</th>
                </tr>
              </thead>
              <tbody>
                {kepribadian.map((k, i) => (
                  <tr key={i}>
                    <td className="border border-black px-1 py-[2px] text-center w-5">{i + 1}</td>
                    <td className="border border-black px-2 py-[2px]">{k.label}</td>
                    <td className="border border-black px-2 py-[2px] text-center">{k.predikat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Saran Wali Kelas */}
          <div className="w-[44%]">
            <table className="w-full h-full border-collapse border border-black text-[10.5px]">
              <thead>
                <tr>
                  <th className="border border-black px-2 py-[3px] text-center">Saran Wali Kelas</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black px-2 py-[3px] h-[60px] align-top">
                    <span className="text-[10px] text-slate-600 italic whitespace-pre-wrap">
                      {catatanWali || '-'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Baris 2: Ketidakhadiran + Saran Orang Tua */}
        <div className="flex gap-3 mb-2">
          {/* Ketidakhadiran */}
          <div className="flex-1">
            <table className="w-full border-collapse border border-black text-[10.5px]">
              <thead>
                <tr className="text-center">
                  <th className="border border-black px-2 py-[3px]" colSpan={2}>Ketidakhadiran</th>
                  <th className="border border-black px-2 py-[3px] w-[80px]">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Sakit', val: data.absen?.sakit ?? 0 },
                  { label: 'Izin',  val: data.absen?.izin  ?? 0 },
                  { label: 'Alpa',  val: data.absen?.alfa  ?? 0 },
                ].map((row, i) => (
                  <tr key={i}>
                    <td className="border border-black px-1 py-[2px] text-center w-5">{i + 1}</td>
                    <td className="border border-black px-2 py-[2px]">{row.label}</td>
                    <td className="border border-black px-2 py-[2px] text-center">
                      {row.val > 0 ? `${row.val} Hari` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Saran Orang Tua */}
          <div className="w-[44%]">
            <table className="w-full h-full border-collapse border border-black text-[10.5px]">
              <thead>
                <tr>
                  <th className="border border-black px-2 py-[3px] text-center">Saran Orang Tua/Wali</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black px-2 py-1 h-[55px] align-bottom">
                    <div className="border-t border-black w-full mt-6"></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Naik Ke Marhalah */}
        <table className="border-collapse border border-black text-[10.5px] mb-2" style={{ width: '52%' }}>
          <thead>
            <tr>
              <th className="border border-black px-2 py-[3px] text-center">Naik Ke Marhalah:</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-2 py-[3px] text-center font-semibold">
                {naik || '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════
          TANDA TANGAN
      ═══════════════════════════════════════ */}
      <div className="flex justify-between items-start mt-2">
        {/* Orang Tua */}
        <div className="text-center w-[28%]">
          <p className="mb-1">Orang Tua/ Wali,</p>
          <div className="h-[52px]" />
          <div className="border-b border-black w-full" />
        </div>

        {/* Wali Kelas */}
        <div className="text-center w-[32%]">
          <p>Wali Kelas,</p>
          <div className="h-[52px]" />
          <p className="font-bold uppercase border-t border-black pt-[2px]">
            {data.wali_kelas_nama}
          </p>
        </div>

        {/* Pimpinan Pesantren */}
        <div className="text-center w-[32%]">
          <p className="mb-0 text-left text-[10.5px]">
            Diberikan di Sukahideng<br />
            Pada tanggal &nbsp;: <span className="font-semibold">{tglCetak}</span>
          </p>
          <p className="mt-1">Pimpinan Pesantren,</p>
          <div className="relative h-[52px] flex items-center justify-center">
            <Image
              src="/ttd-pimpinan.png"
              alt="TTD Pimpinan"
              width={100}
              height={52}
              className="object-contain h-full w-auto"
            />
          </div>
          <p className="font-bold uppercase border-t border-black pt-[2px]">
            Drs. KH. Ii Abdul Basith Wahab
          </p>
        </div>
      </div>
    </div>
  )
}