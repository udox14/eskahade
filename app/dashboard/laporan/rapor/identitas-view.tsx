import Image from 'next/image'

const DOTS = '................................'

function valueOrDots(value: unknown, dots = DOTS) {
  const text = String(value ?? '').trim()
  return text ? text : dots
}

function formatDate(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return DOTS

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text.toUpperCase()

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).toUpperCase()
}

function formatGender(value: unknown) {
  const text = String(value ?? '').trim().toUpperCase()
  if (text === 'L') return 'LAKI-LAKI'
  if (text === 'P') return 'PEREMPUAN'
  if (text.includes('LAKI')) return 'LAKI-LAKI'
  if (text.includes('PEREMPUAN')) return 'PEREMPUAN'
  return DOTS
}

function upperOrDots(value: unknown, dots = DOTS) {
  const text = String(value ?? '').trim()
  return text ? text.toUpperCase() : dots
}

function address(data: any) {
  const parts = [
    data.alamat_lengkap || data.alamat,
    data.kecamatan,
    data.kab_kota,
    data.provinsi,
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)

  return parts.length ? parts.join(' ').toUpperCase() : DOTS
}

function printedDate() {
  return new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function Row({
  no,
  label,
  value,
  multiline = false,
}: {
  no?: string
  label: string
  value: string
  multiline?: boolean
}) {
  return (
    <tr>
      <td className="w-8 align-top py-[3px]">{no ?? ''}</td>
      <td className="w-[205px] align-top py-[3px]">{label}</td>
      <td className="w-4 align-top py-[3px]">:</td>
      <td className={`align-top py-[3px] font-semibold ${multiline ? 'whitespace-pre-line leading-relaxed' : ''}`}>
        {value}
      </td>
    </tr>
  )
}

export function IdentitasSantriHalaman({ data }: { data: any }) {
  const alamat = address(data)
  const tahunMasuk = data.tahun_masuk || data.tahun_ajaran

  return (
    <div
      className={[
        'print-sheet w-[210mm] min-h-[297mm] bg-white mx-auto',
        'shadow-lg print:shadow-none',
        'text-black font-serif text-[12px] leading-normal',
        'px-[26mm] py-[22mm]',
      ].join(' ')}
    >
      <h1 className="mb-8 text-center text-[16px] font-bold uppercase tracking-wide">
        IDENTITAS SANTRI
      </h1>

      <table className="w-full border-collapse">
        <tbody>
          <Row no="1." label="Nama Santri" value={upperOrDots(data.nama_lengkap)} />
          <Row no="2." label="Nomor Induk Pesantren" value={valueOrDots(data.nis)} />
          <Row
            no="3."
            label="Tempat, Tanggal Lahir"
            value={`${upperOrDots(data.tempat_lahir)}, ${formatDate(data.tanggal_lahir)}`}
          />
          <Row no="4." label="Jenis Kelamin" value={formatGender(data.jenis_kelamin)} />
          <Row no="5." label="Anak ke -" value={`${DOTS} dari ${DOTS}`} />
          <Row no="6." label="Masuk Tahun Pelajaran" value={valueOrDots(tahunMasuk)} />
          <tr>
            <td className="align-top py-[3px]">7.</td>
            <td className="align-top py-[3px]" colSpan={3}>Alamat</td>
          </tr>
          <Row label="a. Asrama" value={valueOrDots(data.asrama)} />
          <Row label="b. Jama'ah" value={valueOrDots(data.kamar)} />
          <Row label="c. Rumah" value={alamat} multiline />
          <tr>
            <td className="align-top py-[3px]">8.</td>
            <td className="align-top py-[3px]" colSpan={3}>Nama Orang Tua/ Wali*)</td>
          </tr>
          <Row label="a. Ayah" value={upperOrDots(data.nama_ayah)} />
          <Row label="b. Ibu" value={upperOrDots(data.nama_ibu)} />
          <Row no="9." label="Alamat Orang Tua/ Wali*)" value={alamat} multiline />
          <Row label="No. Telepon" value={valueOrDots(data.no_wa_ortu)} />
          <tr>
            <td className="align-top py-[3px]">10.</td>
            <td className="align-top py-[3px]" colSpan={3}>Pekerjaan Orang Tua/ Wali*)</td>
          </tr>
          <Row label="a. Ayah" value={DOTS} />
          <Row label="b. Ibu" value={DOTS} />
        </tbody>
      </table>

      <div className="mt-12 ml-auto w-[245px] text-center">
        <p className="mb-5">Sukahideng, {printedDate()}</p>
        <p>Pimpinan Pesantren,</p>
        <div className="relative mx-auto my-2 flex h-[70px] items-center justify-center">
          <Image
            src="/ttd-pimpinan.png"
            alt="TTD Pimpinan"
            width={120}
            height={64}
            className="h-full w-auto object-contain"
          />
        </div>
        <p className="font-semibold">Drs. KH. I. Abdul Basith Wahab</p>
      </div>

      <p className="mt-8 text-[11px]">*) Coret yang tidak perlu</p>
    </div>
  )
}
