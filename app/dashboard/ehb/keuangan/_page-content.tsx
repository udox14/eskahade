'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  AlertTriangle, Calculator, FileText, Loader2, Pencil, Plus, Printer, ReceiptText, Save, Trash2, Wallet, X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getActiveEventForKeuangan,
  getKeuanganSigners,
  getRabAutoBasis,
  getRabItems,
  getTransaksiItems,
  saveRabItems,
  saveTransaksiItems,
  type ActiveEvent,
  type RabAutoBasis,
  type RabItem,
  type RabItemInput,
  type RabKategori,
  type TransaksiInput,
  type TransaksiItem,
  type TransaksiTipe,
} from './actions'
import { FONT } from '../cetak/_shared'
import { formatDateKeyWib, shortDateWib } from '../_date-utils'

type DraftRabItem = RabItemInput & {
  draft_id: string
}

type DraftTransaksiItem = TransaksiInput & {
  draft_id: string
}

type TransaksiForm = {
  mode: 'create' | 'edit'
  draft_id?: string
  tipe: TransaksiTipe
  tanggal: string
  source: string
  kategori: string
  uraian: string
  qty: number
  harga: number
  nominal: number
  keterangan: string
  rab_item_id: number | null
  is_system: number
  system_key: string | null
}

const KATEGORI: { key: RabKategori; title: string; desc: string }[] = [
  {
    key: 'atk_administrasi',
    title: 'ATK dan Administrasi',
    desc: 'Kebutuhan kertas, alat tulis, penggandaan, dan administrasi EHB.',
  },
  {
    key: 'konsumsi',
    title: 'Konsumsi',
    desc: 'Konsumsi panitia, pengawas, guru, dan kebutuhan pendukung lain.',
  },
  {
    key: 'honorarium',
    title: 'Honorarium',
    desc: 'Insentif pembuatan soal, pemeriksaan, rapor, pengawasan, dan panitia.',
  },
]

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function parseMoney(value: string) {
  return Number(value.replace(/[^\d]/g, '')) || 0
}

function todayKey() {
  return formatDateKeyWib(new Date())
}

function lineTotal(item: Pick<DraftRabItem, 'qty' | 'harga' | 'system_key'>) {
  if (item.system_key === 'honor_panitia') return Number(item.harga || 0)
  return Number(item.qty || 0) * Number(item.harga || 0)
}

function displayRabName(item: Pick<DraftRabItem, 'nama_barang' | 'system_key'>) {
  return item.nama_barang
}

function buildSystemDrafts(basis: RabAutoBasis): DraftRabItem[] {
  const drafts: DraftRabItem[] = [
    {
      draft_id: uid(),
      kategori: 'atk_administrasi',
      nama_barang: 'Kertas HVS',
      qty: basis.rekomendasiRim,
      harga: 0,
      keterangan: `Rekomendasi sistem: ${basis.totalHasilUjian.toLocaleString('id-ID')} lembar hasil ujian / 500 = ${basis.rekomendasiRim} rim`,
      is_system: 1,
      system_key: 'atk_hvs',
      urutan: 1,
    },
    {
      draft_id: uid(),
      kategori: 'atk_administrasi',
      nama_barang: 'Kertas Buram',
      qty: basis.rekomendasiRim,
      harga: 0,
      keterangan: `Rekomendasi sistem: ${basis.totalHasilUjian.toLocaleString('id-ID')} lembar hasil ujian / 500 = ${basis.rekomendasiRim} rim`,
      is_system: 1,
      system_key: 'atk_buram',
      urutan: 2,
    },
    {
      draft_id: uid(),
      kategori: 'honorarium',
      nama_barang: 'Insentif Pembuatan Soal',
      qty: basis.pembuatanSoal,
      harga: 0,
      keterangan: 'Qty sistem dihitung dari jumlah paket kelas-mapel pada jadwal EHB.',
      is_system: 1,
      system_key: 'honor_pembuatan_soal',
      urutan: 1,
    },
    {
      draft_id: uid(),
      kategori: 'honorarium',
      nama_barang: 'Insentif Pemeriksaan Hasil EHB',
      qty: basis.totalHasilUjian,
      harga: 0,
      keterangan: `Total ${basis.totalHasilUjian.toLocaleString('id-ID')} hasil ujian dari seluruh marhalah.`,
      is_system: 1,
      system_key: 'honor_pemeriksaan_hasil',
      urutan: 10,
    },
    {
      draft_id: uid(),
      kategori: 'honorarium',
      nama_barang: 'Insentif Pengisian Rapor',
      qty: basis.raporSantri,
      harga: 0,
      keterangan: 'Jumlah santri selain Mutawassithah.',
      is_system: 1,
      system_key: 'honor_pengisian_rapor',
      urutan: 50,
    },
    {
      draft_id: uid(),
      kategori: 'honorarium',
      nama_barang: 'Insentif Pengawasan',
      qty: basis.totalSesiEhb,
      harga: 0,
      keterangan: `Total sesi aktif EHB. Pengawas terdaftar: ${basis.jumlahPengawas.toLocaleString('id-ID')} orang.`,
      is_system: 1,
      system_key: 'honor_pengawasan',
      urutan: 60,
    },
    {
      draft_id: uid(),
      kategori: 'honorarium',
      nama_barang: 'Insentif Panitia',
      qty: basis.jumlahPanitia,
      harga: 0,
      keterangan: `Jumlah panitia: ${basis.jumlahPanitia.toLocaleString('id-ID')} orang. Kolom harga diisi total insentif panitia.`,
      is_system: 1,
      system_key: 'honor_panitia',
      urutan: 70,
    },
  ]

  return drafts
}

function rowsToDrafts(rows: RabItem[]): DraftRabItem[] {
  const drafts = rows.map(row => ({
    draft_id: String(row.id),
    kategori: row.kategori,
    nama_barang: row.nama_barang,
    qty: Number(row.qty || 0),
    harga: Number(row.harga || 0),
    keterangan: row.keterangan || '',
    is_system: row.is_system,
    system_key: row.system_key,
    urutan: row.urutan,
  }))

  const pemeriksaanRows = drafts.filter(item => item.system_key?.startsWith('honor_pemeriksaan_'))
  if (pemeriksaanRows.length <= 1 && pemeriksaanRows[0]?.system_key !== 'honor_pemeriksaan_header') return drafts

  const otherRows = drafts.filter(item => !item.system_key?.startsWith('honor_pemeriksaan_'))
  const detailRows = pemeriksaanRows.filter(item => item.system_key !== 'honor_pemeriksaan_header')
  const totalQty = detailRows.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const totalNominal = detailRows.reduce((sum, item) => sum + lineTotal(item), 0)
  const samePrice = detailRows.every(item => Number(item.harga || 0) === Number(detailRows[0]?.harga || 0))
  const harga = samePrice ? Number(detailRows[0]?.harga || 0) : totalQty > 0 ? Math.round(totalNominal / totalQty) : 0

  const combinedPemeriksaan: DraftRabItem = {
    draft_id: uid(),
    kategori: 'honorarium',
    nama_barang: 'Insentif Pemeriksaan Hasil EHB',
    qty: totalQty,
    harga,
    keterangan: `Gabungan ${totalQty.toLocaleString('id-ID')} hasil ujian dari seluruh marhalah.`,
    is_system: 1,
    system_key: 'honor_pemeriksaan_hasil',
    urutan: 10,
  }

  return [
    ...otherRows,
    combinedPemeriksaan,
  ].sort((a, b) => {
    const kategoriA = KATEGORI.findIndex(item => item.key === a.kategori)
    const kategoriB = KATEGORI.findIndex(item => item.key === b.kategori)
    return kategoriA - kategoriB || Number(a.urutan || 0) - Number(b.urutan || 0)
  })
}

function transactionTotal(item: Pick<DraftTransaksiItem, 'qty' | 'harga' | 'nominal'>) {
  return Number(item.nominal || 0) || Number(item.qty || 0) * Number(item.harga || 0)
}

function buildTransactionsFromRab(rows: Array<RabItem | DraftRabItem>, totalRab: number): DraftTransaksiItem[] {
  const expenseRows = rows
    .filter(row => row.system_key !== 'honor_pemeriksaan_header')
    .map((row, index) => {
      const total = lineTotal({
        qty: Number(row.qty || 0),
        harga: Number(row.harga || 0),
        system_key: row.system_key,
      })
      return {
        draft_id: uid(),
        tipe: 'pengeluaran' as TransaksiTipe,
        tanggal: todayKey(),
        kategori: KATEGORI.find(item => item.key === row.kategori)?.title || row.kategori,
        uraian: displayRabName(row),
        qty: Number(row.qty || 0),
        harga: Number(row.harga || 0),
        nominal: total,
        keterangan: row.keterangan || '',
        rab_item_id: 'id' in row ? row.id : null,
        is_system: row.is_system,
        system_key: row.system_key ? `expense_${row.system_key}` : null,
        urutan: 100 + index,
      }
    })

  return [...buildDefaultIncomeTransactions(totalRab), ...expenseRows]
}

function buildDefaultIncomeTransactions(totalRab: number): DraftTransaksiItem[] {
  const tanggal = todayKey()
  return [
    {
      draft_id: uid(),
      tipe: 'pemasukan',
      tanggal,
      kategori: 'Dana Pesantren',
      uraian: 'Dana dari Pesantren',
      qty: 1,
      harga: totalRab,
      nominal: totalRab,
      keterangan: 'Nominal diterima dari pesantren.',
      is_system: 1,
      system_key: 'income_pesantren',
      urutan: 1,
    },
    {
      draft_id: uid(),
      tipe: 'pemasukan',
      tanggal,
      kategori: 'Denda',
      uraian: 'Denda Kartu Hilang',
      qty: 1,
      harga: 0,
      nominal: 0,
      keterangan: 'Total pemasukan dari denda kartu hilang.',
      is_system: 1,
      system_key: 'income_denda_kartu_hilang',
      urutan: 2,
    },
  ]
}

function transaksiRowsToDrafts(rows: TransaksiItem[]) {
  return rows.map(row => ({
    draft_id: String(row.id),
    tipe: row.tipe,
    tanggal: row.tanggal,
    kategori: row.kategori,
    uraian: row.uraian,
    qty: Number(row.qty || 0),
    harga: Number(row.harga || 0),
    nominal: Number(row.nominal || 0),
    keterangan: row.keterangan || '',
    rab_item_id: row.rab_item_id,
    is_system: row.is_system,
    system_key: row.system_key,
    urutan: row.urutan,
  }))
}

function sortTransaksi(items: DraftTransaksiItem[]) {
  return [...items].sort((a, b) => {
    const byDate = a.tanggal.localeCompare(b.tanggal)
    if (byDate !== 0) return byDate
    if (a.tipe !== b.tipe) return a.tipe === 'pemasukan' ? -1 : 1
    return (a.urutan ?? 0) - (b.urutan ?? 0)
  })
}

function emptyTransaksiForm(tipe: TransaksiTipe = 'pengeluaran'): TransaksiForm {
  return {
    mode: 'create',
    tipe,
    tanggal: todayKey(),
    source: tipe === 'pemasukan' ? 'income_pesantren' : 'manual',
    kategori: tipe === 'pemasukan' ? 'Dana Pesantren' : 'Pengeluaran Lain',
    uraian: tipe === 'pemasukan' ? 'Dana dari Pesantren' : '',
    qty: 1,
    harga: 0,
    nominal: 0,
    keterangan: '',
    rab_item_id: null,
    is_system: tipe === 'pemasukan' ? 1 : 0,
    system_key: tipe === 'pemasukan' ? 'income_pesantren' : null,
  }
}

function PrintHeader({ event }: { event: ActiveEvent }) {
  const semesterLabel = event.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const tahunAjaran = event.tahun_ajaran_nama.replace('/', '-')

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4mm', height: '28mm', marginBottom: '2mm' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logohitam.png" alt="" style={{ width: '24mm', height: '24mm', objectFit: 'contain' }} />
      <div style={{ width: '132mm' }}>
        <div style={{ fontSize: '20pt', fontWeight: 700, lineHeight: 0.95 }}>EVALUASI HASIL BELAJAR</div>
        <div style={{ fontSize: '16pt', lineHeight: 1 }}>{semesterLabel} T.A. {tahunAjaran}</div>
        <div style={{ fontSize: '9pt', lineHeight: 1.15, marginTop: '1mm' }}>LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG</div>
        <div style={{ borderBottom: '1.1pt solid #000', marginTop: '1.5mm' }} />
      </div>
    </div>
  )
}

function RabPrint({
  event,
  items,
  ketuaPelaksana,
  wakilAkademik,
  wakilKeuangan,
}: {
  event: ActiveEvent
  items: DraftRabItem[]
  ketuaPelaksana: string
  wakilAkademik: string
  wakilKeuangan: string
}) {
  const categoryRows = KATEGORI.map(kategori => ({
    ...kategori,
    items: items.filter(item => item.kategori === kategori.key),
  }))
  const rowCount = items.length + KATEGORI.length
  const fontSize = rowCount > 32 ? '6.2pt' : rowCount > 24 ? '6.8pt' : '7.4pt'
  const lineHeight = rowCount > 32 ? 1.03 : 1.12
  const grandTotal = items.reduce((sum, item) => sum + lineTotal(item), 0)

  return (
    <div style={{
      width: '210mm',
      height: '330mm',
      padding: '8mm',
      boxSizing: 'border-box',
      fontFamily: FONT,
      backgroundColor: '#fff',
      color: '#000',
      overflow: 'hidden',
      breakAfter: 'page',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <PrintHeader event={event} />
      <div style={{
        textAlign: 'center',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '15pt',
        fontWeight: 700,
        lineHeight: 1,
        marginBottom: '3mm',
      }}>
        RENCANA ANGGARAN BELANJA
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: 'Arial, Helvetica, sans-serif', fontSize, lineHeight }}>
        <colgroup>
          <col style={{ width: '8mm' }} />
          <col style={{ width: '58mm' }} />
          <col style={{ width: '17mm' }} />
          <col style={{ width: '30mm' }} />
          <col style={{ width: '31mm' }} />
          <col style={{ width: '32mm' }} />
        </colgroup>
        <thead>
          <tr>
            {['NO', 'URAIAN', 'QTY', 'HARGA', 'JUMLAH', 'KETERANGAN'].map(label => (
              <th key={label} style={{ border: '0.8pt solid #000', padding: '1.3mm 1.2mm', textAlign: 'center', fontWeight: 700, backgroundColor: '#e5e7eb' }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categoryRows.map(category => {
            const subtotal = category.items.reduce((sum, item) => sum + lineTotal(item), 0)
            return (
              <Fragment key={category.key}>
                <tr>
                  <td colSpan={6} style={{ border: '0.8pt solid #000', padding: '1.2mm 1.4mm', fontWeight: 700, backgroundColor: '#f3f4f6' }}>
                    {category.title.toUpperCase()}
                  </td>
                </tr>
                {category.items.length === 0 ? (
                  <tr key={`${category.key}-empty`}>
                    <td style={printTdCenter}>-</td>
                    <td style={printTd}>-</td>
                    <td style={printTdCenter}>-</td>
                    <td style={printTdRight}>-</td>
                    <td style={printTdRight}>-</td>
                    <td style={printTd}>-</td>
                  </tr>
                ) : category.items.map((item, index) => {
                  if (item.system_key === 'honor_pemeriksaan_header') {
                    return (
                      <tr key={item.draft_id}>
                        <td style={printTdCenter}>{index + 1}</td>
                        <td colSpan={5} style={{ ...printTd, fontWeight: 700, backgroundColor: '#f8fafc' }}>{item.nama_barang}</td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={item.draft_id}>
                      <td style={printTdCenter}>{index + 1}</td>
                      <td style={printTd}>{displayRabName(item)}</td>
                      <td style={printTdCenter}>{Number(item.qty || 0).toLocaleString('id-ID')}</td>
                      <td style={printTdRight}>{rupiah(Number(item.harga || 0))}</td>
                      <td style={printTdRight}>{rupiah(lineTotal(item))}</td>
                      <td style={printTd}>{item.keterangan || '-'}</td>
                    </tr>
                  )
                })}
                <tr key={`${category.key}-subtotal`}>
                  <td colSpan={4} style={{ ...printTdRight, fontWeight: 700, backgroundColor: '#f8fafc' }}>Subtotal {category.title}</td>
                  <td style={{ ...printTdRight, fontWeight: 700, backgroundColor: '#f8fafc' }}>{rupiah(subtotal)}</td>
                  <td style={{ ...printTd, backgroundColor: '#f8fafc' }} />
                </tr>
              </Fragment>
            )
          })}
          <tr>
            <td colSpan={4} style={{ ...printTdRight, fontWeight: 700, fontSize: '8pt', backgroundColor: '#111827', color: '#fff' }}>TOTAL RAB</td>
            <td style={{ ...printTdRight, fontWeight: 700, fontSize: '8pt', backgroundColor: '#111827', color: '#fff' }}>{rupiah(grandTotal)}</td>
            <td style={{ ...printTd, backgroundColor: '#111827' }} />
          </tr>
        </tbody>
      </table>

      <div style={{
        marginTop: '8mm',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '6mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '8.2pt',
        textAlign: 'center',
        paddingTop: '6mm',
      }}>
        <SignatureBox title="Ketua Pelaksana EHB" name={ketuaPelaksana} />
        <SignatureBox title="Wakil Pimpinan Bid. Akademik" name={wakilAkademik} />
        <SignatureBox title="Wakil Pimpinan Bid. Administrasi dan Keuangan" name={wakilKeuangan} />
      </div>
    </div>
  )
}

function BukuKasPrint({
  event,
  items,
  ketuaPelaksana,
  bendahara,
}: {
  event: ActiveEvent
  items: DraftTransaksiItem[]
  ketuaPelaksana: string
  bendahara: string
}) {
  const sorted = sortTransaksi(items)
  const rowCount = sorted.length
  const fontSize = rowCount > 34 ? '6.2pt' : rowCount > 26 ? '6.8pt' : '7.4pt'
  let saldo = 0
  const totalMasuk = sorted.filter(item => item.tipe === 'pemasukan').reduce((sum, item) => sum + transactionTotal(item), 0)
  const totalKeluar = sorted.filter(item => item.tipe === 'pengeluaran').reduce((sum, item) => sum + transactionTotal(item), 0)

  return (
    <div style={{
      width: '210mm',
      height: '330mm',
      padding: '8mm',
      boxSizing: 'border-box',
      fontFamily: FONT,
      backgroundColor: '#fff',
      color: '#000',
      overflow: 'hidden',
      breakAfter: 'page',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <PrintHeader event={event} />
      <div style={{
        textAlign: 'center',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '15pt',
        fontWeight: 700,
        lineHeight: 1,
        marginBottom: '3mm',
      }}>
        BUKU KAS EHB
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: 'Arial, Helvetica, sans-serif', fontSize, lineHeight: 1.08 }}>
        <colgroup>
          <col style={{ width: '20mm' }} />
          <col style={{ width: '61mm' }} />
          <col style={{ width: '28mm' }} />
          <col style={{ width: '28mm' }} />
          <col style={{ width: '29mm' }} />
          <col style={{ width: '20mm' }} />
        </colgroup>
        <thead>
          <tr>
            {['TANGGAL', 'URAIAN', 'MASUK', 'KELUAR', 'SALDO', 'KET.'].map(label => (
              <th key={label} style={{ border: '0.8pt solid #000', padding: '1.3mm 1.2mm', textAlign: 'center', fontWeight: 700, backgroundColor: '#e5e7eb' }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ ...printTdCenter, height: '12mm' }}>Belum ada transaksi</td>
            </tr>
          ) : sorted.map(item => {
            const total = transactionTotal(item)
            const masuk = item.tipe === 'pemasukan' ? total : 0
            const keluar = item.tipe === 'pengeluaran' ? total : 0
            saldo += masuk - keluar
            return (
              <tr key={item.draft_id}>
                <td style={printTdCenter}>{shortDateWib(item.tanggal)}</td>
                <td style={printTd}>
                  <div style={{ fontWeight: 700 }}>{item.uraian}</div>
                  <div style={{ fontSize: '6pt' }}>{item.kategori}</div>
                </td>
                <td style={printTdRight}>{masuk ? rupiah(masuk) : '-'}</td>
                <td style={printTdRight}>{keluar ? rupiah(keluar) : '-'}</td>
                <td style={printTdRight}>{rupiah(saldo)}</td>
                <td style={printTd}>{item.keterangan || '-'}</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={2} style={{ ...printTdRight, fontWeight: 700, backgroundColor: '#f8fafc' }}>JUMLAH</td>
            <td style={{ ...printTdRight, fontWeight: 700, backgroundColor: '#f8fafc' }}>{rupiah(totalMasuk)}</td>
            <td style={{ ...printTdRight, fontWeight: 700, backgroundColor: '#f8fafc' }}>{rupiah(totalKeluar)}</td>
            <td style={{ ...printTdRight, fontWeight: 700, backgroundColor: '#f8fafc' }}>{rupiah(totalMasuk - totalKeluar)}</td>
            <td style={{ ...printTd, backgroundColor: '#f8fafc' }} />
          </tr>
        </tbody>
      </table>

      <div style={{
        marginTop: '8mm',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '18mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '8.4pt',
        textAlign: 'center',
        padding: '6mm 12mm 0',
      }}>
        <SignatureBox title="Ketua Pelaksana EHB" name={ketuaPelaksana} />
        <SignatureBox title="Bendahara" name={bendahara} />
      </div>
    </div>
  )
}

const printTd: CSSProperties = {
  border: '0.8pt solid #000',
  padding: '1mm 1.2mm',
  verticalAlign: 'top',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const printTdCenter: CSSProperties = {
  ...printTd,
  textAlign: 'center',
}

const printTdRight: CSSProperties = {
  ...printTd,
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

function SignatureBox({ title, name }: { title: string; name: string }) {
  return (
    <div>
      <div style={{ fontWeight: 700, minHeight: '10mm' }}>{title}</div>
      <div style={{ height: '19mm' }} />
      <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{name || '................................'}</div>
    </div>
  )
}

export default function KeuanganEhbPageContent() {
  const [event, setEvent] = useState<ActiveEvent | null>(null)
  const [basis, setBasis] = useState<RabAutoBasis | null>(null)
  const [drafts, setDrafts] = useState<DraftRabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'rab' | 'transaksi' | 'honor_detail'>('rab')
  const [ketuaPelaksana, setKetuaPelaksana] = useState('')
  const [bendahara, setBendahara] = useState('')
  const [wakilAkademik, setWakilAkademik] = useState('')
  const [wakilKeuangan, setWakilKeuangan] = useState('')
  const [transaksiDrafts, setTransaksiDrafts] = useState<DraftTransaksiItem[]>([])
  const [savingTransaksi, setSavingTransaksi] = useState(false)
  const [showTransaksiModal, setShowTransaksiModal] = useState(false)
  const [transaksiForm, setTransaksiForm] = useState<TransaksiForm>(() => emptyTransaksiForm())
  const rabPrintRef = useRef<HTMLDivElement>(null)
  const transaksiPrintRef = useRef<HTMLDivElement>(null)
  const handlePrintRab = useReactToPrint({
    contentRef: rabPrintRef,
    documentTitle: 'RAB EHB',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })
  const handlePrintTransaksi = useReactToPrint({
    contentRef: transaksiPrintRef,
    documentTitle: 'Buku Kas EHB',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const evt = await getActiveEventForKeuangan()
    setEvent(evt || null)
    if (evt) {
      const [savedRows, autoBasis, signers, transaksiRows] = await Promise.all([
        getRabItems(evt.id),
        getRabAutoBasis(evt.id),
        getKeuanganSigners(evt.id),
        getTransaksiItems(evt.id),
      ])
      const rabDrafts = savedRows.length > 0 ? rowsToDrafts(savedRows) : buildSystemDrafts(autoBasis)
      setBasis(autoBasis)
      setDrafts(rabDrafts)
      const totalRab = rabDrafts.reduce((sum, item) => sum + lineTotal(item), 0)
      setTransaksiDrafts(transaksiRows.length > 0 ? transaksiRowsToDrafts(transaksiRows) : buildDefaultIncomeTransactions(totalRab))
      setKetuaPelaksana(signers.ketua)
      setBendahara(signers.bendahara)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  const summary = useMemo(() => {
    const byCategory = new Map<RabKategori, number>()
    for (const item of drafts) {
      byCategory.set(item.kategori, (byCategory.get(item.kategori) || 0) + lineTotal(item))
    }
    const total = Array.from(byCategory.values()).reduce((sum, value) => sum + value, 0)
    return { byCategory, total }
  }, [drafts])

  const transaksiSummary = useMemo(() => {
    const pemasukan = transaksiDrafts
      .filter(item => item.tipe === 'pemasukan')
      .reduce((sum, item) => sum + transactionTotal(item), 0)
    const pengeluaran = transaksiDrafts
      .filter(item => item.tipe === 'pengeluaran')
      .reduce((sum, item) => sum + transactionTotal(item), 0)
    return { pemasukan, pengeluaran, saldo: pemasukan - pengeluaran }
  }, [transaksiDrafts])

  const rabOptions = useMemo(() => (
    drafts.filter(item => item.system_key !== 'honor_pemeriksaan_header' && item.nama_barang.trim())
  ), [drafts])

  const updateDraft = (draftId: string, patch: Partial<DraftRabItem>) => {
    setDrafts(prev => prev.map(item => item.draft_id === draftId ? { ...item, ...patch } : item))
  }

  const addItem = (kategori: RabKategori) => {
    const nextOrder = drafts.filter(item => item.kategori === kategori).length + 100
    setDrafts(prev => [
      ...prev,
      {
        draft_id: uid(),
        kategori,
        nama_barang: '',
        qty: 1,
        harga: 0,
        keterangan: '',
        is_system: 0,
        system_key: null,
        urutan: nextOrder,
      },
    ])
  }

  const deleteItem = (draftId: string) => {
    setDrafts(prev => prev.filter(item => item.draft_id !== draftId))
  }

  const openTransaksiModal = (tipe: TransaksiTipe = 'pengeluaran') => {
    setTransaksiForm(emptyTransaksiForm(tipe))
    setShowTransaksiModal(true)
  }

  const editTransaksi = (item: DraftTransaksiItem) => {
    setTransaksiForm({
      mode: 'edit',
      draft_id: item.draft_id,
      tipe: item.tipe,
      tanggal: item.tanggal,
      source: item.rab_item_id ? `rab:${item.rab_item_id}` : item.system_key || 'manual',
      kategori: item.kategori,
      uraian: item.uraian,
      qty: Number(item.qty || 0),
      harga: Number(item.harga || 0),
      nominal: Number(item.nominal || 0),
      keterangan: item.keterangan || '',
      rab_item_id: item.rab_item_id ?? null,
      is_system: item.is_system || 0,
      system_key: item.system_key ?? null,
    })
    setShowTransaksiModal(true)
  }

  const updateTransaksiForm = (patch: Partial<TransaksiForm>) => {
    setTransaksiForm(prev => {
      const next = { ...prev, ...patch }
      if ('qty' in patch || 'harga' in patch) {
        next.nominal = Number(next.qty || 0) * Number(next.harga || 0)
      }
      return next
    })
  }

  const handleTransaksiTipeChange = (tipe: TransaksiTipe) => {
    setTransaksiForm(emptyTransaksiForm(tipe))
  }

  const handleTransaksiSourceChange = (source: string) => {
    if (source.startsWith('rab:')) {
      const rabDraftId = source.replace('rab:', '')
      const rabItem = rabOptions.find(item => item.draft_id === rabDraftId)
      if (rabItem) {
        const numericRabId = /^\d+$/.test(rabItem.draft_id) ? Number(rabItem.draft_id) : null
        updateTransaksiForm({
          source,
          tipe: 'pengeluaran',
          kategori: KATEGORI.find(item => item.key === rabItem.kategori)?.title || rabItem.kategori,
          uraian: displayRabName(rabItem),
          qty: Number(rabItem.qty || 0),
          harga: Number(rabItem.harga || 0),
          nominal: lineTotal(rabItem),
          keterangan: rabItem.keterangan || '',
          rab_item_id: numericRabId,
          is_system: rabItem.is_system || 0,
          system_key: rabItem.system_key ? `expense_${rabItem.system_key}` : null,
        })
      }
      return
    }

    if (source === 'income_pesantren') {
      updateTransaksiForm({
        source,
        tipe: 'pemasukan',
        kategori: 'Dana Pesantren',
        uraian: 'Dana dari Pesantren',
        qty: 1,
        harga: summary.total,
        nominal: summary.total,
        keterangan: 'Nominal diterima dari pesantren.',
        rab_item_id: null,
        is_system: 1,
        system_key: source,
      })
      return
    }

    if (source === 'income_denda_kartu_hilang') {
      updateTransaksiForm({
        source,
        tipe: 'pemasukan',
        kategori: 'Denda',
        uraian: 'Denda Kartu Hilang',
        qty: 1,
        harga: 0,
        nominal: 0,
        keterangan: 'Total pemasukan dari denda kartu hilang.',
        rab_item_id: null,
        is_system: 1,
        system_key: source,
      })
      return
    }

    updateTransaksiForm({
      source,
      rab_item_id: null,
      is_system: 0,
      system_key: null,
      kategori: transaksiForm.tipe === 'pemasukan' ? 'Pemasukan Lain' : 'Pengeluaran Lain',
      uraian: '',
      qty: 1,
      harga: 0,
      nominal: 0,
      keterangan: '',
    })
  }

  const saveTransaksiForm = () => {
    if (!transaksiForm.tanggal || !transaksiForm.kategori.trim() || !transaksiForm.uraian.trim()) {
      toast.error('Tanggal, kategori, dan uraian transaksi wajib diisi')
      return
    }

    const payload: DraftTransaksiItem = {
      draft_id: transaksiForm.draft_id || uid(),
      tipe: transaksiForm.tipe,
      tanggal: transaksiForm.tanggal,
      kategori: transaksiForm.kategori.trim(),
      uraian: transaksiForm.uraian.trim(),
      qty: Number(transaksiForm.qty || 0),
      harga: Number(transaksiForm.harga || 0),
      nominal: Number(transaksiForm.nominal || 0),
      keterangan: transaksiForm.keterangan.trim(),
      rab_item_id: transaksiForm.rab_item_id,
      is_system: transaksiForm.is_system,
      system_key: transaksiForm.system_key,
      urutan: transaksiForm.mode === 'edit'
        ? transaksiDrafts.find(item => item.draft_id === transaksiForm.draft_id)?.urutan ?? transaksiDrafts.length + 1
        : transaksiDrafts.length + 1,
    }

    setTransaksiDrafts(prev => (
      transaksiForm.mode === 'edit'
        ? prev.map(item => item.draft_id === payload.draft_id ? payload : item)
        : [...prev, payload]
    ))
    setShowTransaksiModal(false)
    toast.success(transaksiForm.mode === 'edit' ? 'Transaksi diperbarui' : 'Transaksi ditambahkan')
  }

  const deleteTransaksi = (draftId: string) => {
    setTransaksiDrafts(prev => prev.filter(item => item.draft_id !== draftId))
  }

  const resetTransaksiFromRab = () => {
    setTransaksiDrafts(buildTransactionsFromRab(drafts, summary.total))
    toast.success('Transaksi dikembalikan dari daftar RAB')
  }

  const resetRecommendation = () => {
    if (!basis) return
    setDrafts(buildSystemDrafts(basis))
    toast.success('RAB dikembalikan ke rekomendasi sistem')
  }

  const submit = async () => {
    if (!event) return
    const invalid = drafts.find(item => !item.nama_barang.trim())
    if (invalid) return toast.error('Nama barang/honor tidak boleh kosong')

    setSaving(true)
    const res = await saveRabItems(event.id, drafts)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${res.saved} item RAB disimpan`)
    loadData()
  }

  const submitTransaksi = async () => {
    if (!event) return
    const invalid = transaksiDrafts.find(item => !item.tanggal || !item.uraian.trim() || !item.kategori.trim())
    if (invalid) return toast.error('Tanggal, kategori, dan uraian transaksi wajib diisi')

    setSavingTransaksi(true)
    const res = await saveTransaksiItems(event.id, transaksiDrafts)
    setSavingTransaksi(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`${res.saved} transaksi disimpan`)
    loadData()
  }

  if (loading) {
    return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm font-medium">Belum ada event EHB yang aktif. Silakan aktifkan event dulu di menu Jadwal.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-3">
            <Wallet className="w-3.5 h-3.5" /> {event.nama}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Keuangan EHB</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola rencana anggaran, transaksi, dan honorarium EHB.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white border rounded-xl px-4 py-3">
            <p className="text-[11px] text-slate-500 font-bold uppercase">ATK</p>
            <p className="text-sm font-bold text-slate-800">{rupiah(summary.byCategory.get('atk_administrasi') || 0)}</p>
          </div>
          <div className="bg-white border rounded-xl px-4 py-3">
            <p className="text-[11px] text-slate-500 font-bold uppercase">Konsumsi</p>
            <p className="text-sm font-bold text-slate-800">{rupiah(summary.byCategory.get('konsumsi') || 0)}</p>
          </div>
          <div className="bg-white border rounded-xl px-4 py-3">
            <p className="text-[11px] text-slate-500 font-bold uppercase">Honor</p>
            <p className="text-sm font-bold text-slate-800">{rupiah(summary.byCategory.get('honorarium') || 0)}</p>
          </div>
          <div className="bg-slate-900 text-white rounded-xl px-4 py-3">
            <p className="text-[11px] text-white/50 font-bold uppercase">Total RAB</p>
            <p className="text-sm font-bold">{rupiah(summary.total)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-1 flex flex-wrap gap-1 w-fit">
        {[
          { key: 'rab', label: 'RAB', icon: FileText },
          { key: 'transaksi', label: 'Transaksi', icon: ReceiptText },
          { key: 'honor_detail', label: 'Rincian Honor', icon: Calculator },
        ].map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'honor_detail' ? (
        <div className="bg-white border border-dashed rounded-2xl p-10 text-center">
          <p className="font-bold text-slate-700">Tab ini disiapkan untuk tahap berikutnya.</p>
          <p className="text-sm text-slate-500 mt-1">Sekarang kita fokus merapikan RAB dulu, bos.</p>
        </div>
      ) : activeTab === 'transaksi' ? (
        <div className="space-y-5">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-white border rounded-2xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase">Pemasukan</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{rupiah(transaksiSummary.pemasukan)}</p>
            </div>
            <div className="bg-white border rounded-2xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase">Pengeluaran Real</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{rupiah(transaksiSummary.pengeluaran)}</p>
            </div>
            <div className="bg-slate-900 text-white rounded-2xl p-5">
              <p className="text-xs font-bold text-white/50 uppercase">Saldo</p>
              <p className="text-2xl font-bold mt-1">{rupiah(transaksiSummary.saldo)}</p>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-5 space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-800">Transaksi Realisasi</h2>
                <p className="text-sm text-slate-500">Catat pemasukan dan pengeluaran lewat modal supaya inputnya tidak bikin pusing.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openTransaksiModal('pengeluaran')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Catat Transaksi
                </button>
                <button onClick={resetTransaksiFromRab} className="bg-white border hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4" /> Reset dari RAB
                </button>
                <button onClick={submitTransaksi} disabled={savingTransaksi} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-60">
                  {savingTransaksi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-800">Cetak Buku Kas</h2>
                <p className="text-sm text-slate-500">Format F4 Portrait, margin narrow, urut berdasarkan tanggal pengeluaran/transaksi.</p>
              </div>
              <button
                onClick={() => handlePrintTransaksi()}
                disabled={transaksiDrafts.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Printer className="w-4 h-4" /> Cetak Buku Kas
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Ketua Pelaksana EHB</label>
                <input
                  value={ketuaPelaksana}
                  onChange={e => setKetuaPelaksana(e.target.value)}
                  placeholder="Nama ketua pelaksana"
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Bendahara</label>
                <input
                  value={bendahara}
                  onChange={e => setBendahara(e.target.value)}
                  placeholder="Nama bendahara"
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          <section className="bg-white border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold w-32">Tanggal</th>
                    <th className="px-4 py-3 text-left font-bold w-32">Tipe</th>
                    <th className="px-4 py-3 text-left font-bold min-w-[260px]">Uraian</th>
                    <th className="px-4 py-3 text-left font-bold min-w-[160px]">Kategori</th>
                    <th className="px-4 py-3 text-right font-bold w-36">Nominal</th>
                    <th className="px-4 py-3 text-left font-bold min-w-[180px]">Keterangan</th>
                    <th className="px-4 py-3 text-right font-bold w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transaksiDrafts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">Belum ada transaksi</td>
                    </tr>
                  ) : sortTransaksi(transaksiDrafts).map(item => (
                    <tr key={item.draft_id} className={item.tipe === 'pemasukan' ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'bg-white hover:bg-slate-50'}>
                      <td className="px-4 py-3 align-top font-semibold text-slate-700 whitespace-nowrap">{shortDateWib(item.tanggal)}</td>
                      <td className="px-4 py-3 align-top">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.tipe === 'pemasukan' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {item.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-bold text-slate-800">{item.uraian}</p>
                        <p className="text-xs text-slate-400">
                          Qty {Number(item.qty || 0).toLocaleString('id-ID')} x {rupiah(Number(item.harga || 0))}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        <p className="font-semibold">{item.kategori}</p>
                        {item.rab_item_id || item.is_system ? <p className="text-[11px] text-indigo-600 font-bold mt-1">Draft dari RAB/default.</p> : null}
                      </td>
                      <td className={`px-4 py-3 align-top text-right font-bold whitespace-nowrap ${item.tipe === 'pemasukan' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {rupiah(transactionTotal(item))}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-500">{item.keterangan || '-'}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => editTransaksi(item)} className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" title="Edit transaksi">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteTransaksi(item.draft_id)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Hapus transaksi">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {showTransaksiModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-800">{transaksiForm.mode === 'edit' ? 'Edit Transaksi' : 'Catat Transaksi'}</h2>
                    <p className="text-sm text-slate-500">Pilih sumber transaksi, lalu isi nominal realnya.</p>
                  </div>
                  <button onClick={() => setShowTransaksiModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => handleTransaksiTipeChange('pengeluaran')}
                      className={`border rounded-xl px-4 py-3 text-left transition-all ${transaksiForm.tipe === 'pengeluaran' ? 'border-red-300 bg-red-50 text-red-700' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <p className="font-bold">Pengeluaran</p>
                      <p className="text-xs opacity-70 mt-0.5">Realisasi belanja</p>
                    </button>
                    <button
                      onClick={() => handleTransaksiTipeChange('pemasukan')}
                      className={`border rounded-xl px-4 py-3 text-left transition-all ${transaksiForm.tipe === 'pemasukan' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <p className="font-bold">Pemasukan</p>
                      <p className="text-xs opacity-70 mt-0.5">Dana diterima</p>
                    </button>
                    <div className="border rounded-xl px-4 py-3 bg-slate-50">
                      <p className="text-xs font-bold text-slate-500 uppercase">Nominal</p>
                      <p className={`text-lg font-bold ${transaksiForm.tipe === 'pemasukan' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {rupiah(Number(transaksiForm.nominal || 0))}
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Tanggal</label>
                      <input
                        type="date"
                        value={transaksiForm.tanggal}
                        onChange={e => updateTransaksiForm({ tanggal: e.target.value })}
                        className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        {transaksiForm.tipe === 'pengeluaran' ? 'Item RAB / Manual' : 'Jenis Penerimaan'}
                      </label>
                      <select
                        value={transaksiForm.source}
                        onChange={e => handleTransaksiSourceChange(e.target.value)}
                        className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      >
                        {transaksiForm.tipe === 'pengeluaran' ? (
                          <>
                            <option value="manual">Item baru di luar RAB</option>
                            {rabOptions.map(item => (
                              <option key={item.draft_id} value={`rab:${item.draft_id}`}>
                                {displayRabName(item)}
                              </option>
                            ))}
                          </>
                        ) : (
                          <>
                            <option value="income_pesantren">Dana dari Pesantren</option>
                            <option value="income_denda_kartu_hilang">Denda Kartu Hilang</option>
                            <option value="manual">Pemasukan Lain</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Kategori</label>
                      <input
                        value={transaksiForm.kategori}
                        onChange={e => updateTransaksiForm({ kategori: e.target.value })}
                        className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Uraian</label>
                      <input
                        value={transaksiForm.uraian}
                        onChange={e => updateTransaksiForm({ uraian: e.target.value })}
                        className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Qty Real</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={transaksiForm.qty}
                        onChange={e => updateTransaksiForm({ qty: Number(e.target.value) })}
                        className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Harga Real</label>
                      <input
                        value={transaksiForm.harga ? transaksiForm.harga.toLocaleString('id-ID') : ''}
                        onChange={e => {
                          const harga = parseMoney(e.target.value)
                          updateTransaksiForm({ harga, nominal: Number(transaksiForm.qty || 0) * harga })
                        }}
                        placeholder="0"
                        className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Nominal Total</label>
                      <input
                        value={transaksiForm.nominal ? transaksiForm.nominal.toLocaleString('id-ID') : ''}
                        onChange={e => updateTransaksiForm({ nominal: parseMoney(e.target.value) })}
                        placeholder="0"
                        className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Keterangan</label>
                    <input
                      value={transaksiForm.keterangan}
                      onChange={e => updateTransaksiForm({ keterangan: e.target.value })}
                      placeholder="Opsional"
                      className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div className="px-5 py-4 border-t bg-slate-50 flex justify-end gap-2">
                  <button onClick={() => setShowTransaksiModal(false)} className="bg-white border hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm">
                    Batal
                  </button>
                  <button onClick={saveTransaksiForm} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl text-sm flex items-center gap-2">
                    <Save className="w-4 h-4" /> Simpan Draft
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="hidden">
            <div ref={transaksiPrintRef}>
              <BukuKasPrint
                event={event}
                items={transaksiDrafts}
                ketuaPelaksana={ketuaPelaksana}
                bendahara={bendahara}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
            <div>
              <p className="font-bold text-indigo-900">RAB disimpan batch</p>
              <p className="text-sm text-indigo-700">Ubah semua item dulu, lalu klik Simpan Semua Perubahan.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={resetRecommendation} className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Reset Rekomendasi
              </button>
              <button onClick={submit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Semua Perubahan
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-800">Cetak RAB</h2>
                <p className="text-sm text-slate-500">Format F4 Portrait, margin narrow, dengan kop dan tanda tangan.</p>
              </div>
              <button
                onClick={() => handlePrintRab()}
                disabled={drafts.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Printer className="w-4 h-4" /> Cetak RAB
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Ketua Pelaksana EHB</label>
                <input
                  value={ketuaPelaksana}
                  onChange={e => setKetuaPelaksana(e.target.value)}
                  placeholder="Nama ketua pelaksana"
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Wakil Pimpinan Bid. Akademik</label>
                <input
                  value={wakilAkademik}
                  onChange={e => setWakilAkademik(e.target.value)}
                  placeholder="Nama wakil pimpinan"
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Wakil Pimpinan Bid. Administrasi dan Keuangan</label>
                <input
                  value={wakilKeuangan}
                  onChange={e => setWakilKeuangan(e.target.value)}
                  placeholder="Nama wakil pimpinan"
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {KATEGORI.map(kategori => {
            const items = drafts.filter(item => item.kategori === kategori.key)
            const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0)
            return (
              <section key={kategori.key} className="bg-white border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-800">{kategori.title}</h2>
                    <p className="text-sm text-slate-500">{kategori.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Subtotal</p>
                      <p className="font-bold text-slate-800">{rupiah(subtotal)}</p>
                    </div>
                    <button onClick={() => addItem(kategori.key)} className="bg-white border hover:bg-slate-50 text-slate-700 font-bold px-3 py-2 rounded-xl text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Tambah
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold min-w-[230px]">Nama barang/honor</th>
                        <th className="px-4 py-3 text-left font-bold w-28">Qty</th>
                        <th className="px-4 py-3 text-left font-bold w-40">{kategori.key === 'honorarium' ? 'Nominal' : 'Harga'}</th>
                        <th className="px-4 py-3 text-left font-bold min-w-[260px]">Merek/keterangan</th>
                        <th className="px-4 py-3 text-right font-bold w-36">Total</th>
                        <th className="px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Belum ada item</td>
                        </tr>
                      ) : items.map(item => {
                        if (item.system_key === 'honor_pemeriksaan_header') {
                          return (
                            <tr key={item.draft_id} className="bg-slate-100">
                              <td className="px-4 py-3 align-top" colSpan={5}>
                                <input
                                  value={item.nama_barang}
                                  onChange={e => updateDraft(item.draft_id, { nama_barang: e.target.value })}
                                  className="w-full border rounded-lg px-3 py-2 font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                                />
                                <p className="text-[11px] text-slate-500 font-semibold mt-1">Judul rincian pemeriksaan. Item di bawahnya cukup nama marhalah.</p>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <button onClick={() => deleteItem(item.draft_id)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        }

                        return (
                          <tr key={item.draft_id} className={item.is_system ? 'bg-indigo-50/30' : 'bg-white'}>
                            <td className="px-4 py-3 align-top">
                              <input
                                value={displayRabName(item)}
                                onChange={e => updateDraft(item.draft_id, { nama_barang: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                              />
                              {item.is_system ? <p className="text-[11px] text-indigo-600 font-bold mt-1">Rekomendasi sistem, boleh diedit.</p> : null}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.qty}
                                onChange={e => updateDraft(item.draft_id, { qty: Number(e.target.value) })}
                                className="w-full border rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                              />
                              {item.system_key === 'honor_panitia' ? <p className="text-[11px] text-slate-400 mt-1">orang</p> : null}
                              {item.system_key === 'atk_hvs' || item.system_key === 'atk_buram' ? <p className="text-[11px] text-slate-400 mt-1">rim</p> : null}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input
                                value={item.harga ? item.harga.toLocaleString('id-ID') : ''}
                                onChange={e => updateDraft(item.draft_id, { harga: parseMoney(e.target.value) })}
                                placeholder="0"
                                className="w-full border rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                              />
                              {item.system_key === 'honor_panitia' ? <p className="text-[11px] text-slate-400 mt-1">total panitia</p> : null}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input
                                value={item.keterangan || ''}
                                onChange={e => updateDraft(item.draft_id, { keterangan: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                              />
                            </td>
                            <td className="px-4 py-3 align-top text-right font-bold text-slate-800 whitespace-nowrap">
                              {rupiah(lineTotal(item))}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <button onClick={() => deleteItem(item.draft_id)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}

          <div className="hidden">
            <div ref={rabPrintRef}>
              <RabPrint
                event={event}
                items={drafts}
                ketuaPelaksana={ketuaPelaksana}
                wakilAkademik={wakilAkademik}
                wakilKeuangan={wakilKeuangan}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
