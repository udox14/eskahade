import Link from 'next/link'
import { notFound } from 'next/navigation'
import { guardPage } from '@/lib/auth/guard'
import { getBukuBesarDetailNonSpp } from '../../actions'
import { PrintReceiptButton } from './print-button'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

const JENIS_ALL = ['BANGUNAN', 'KESEHATAN', 'EHB', 'EKSKUL'] as const

function rp(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

export default async function BukuBesarDetailPage({ params }: Props) {
  await guardPage('/dashboard/keuangan/non-spp')
  const { id } = await params
  const data = await getBukuBesarDetailNonSpp(id)
  if (!data) return notFound()

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 pb-20 md:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/dashboard/keuangan/non-spp" className="text-sm font-bold text-emerald-700 hover:underline">Kembali ke Keuangan Non-SPP</Link>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Buku Besar {data.santri.nama_lengkap}</h1>
          <p className="text-sm text-slate-500">{data.santri.nis || '-'} - {data.santri.asrama || '-'} Kamar {data.santri.kamar || '-'} - Angkatan {data.santri.tahun_masuk_fix}</p>
          {data.santri.is_legacy_settled && (
            <p className="mt-2 inline-flex rounded border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              Saldo awal migrasi dianggap lunas per {data.santri.legacy_cutoff_tanggal}
            </p>
          )}
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b bg-slate-50 px-5 py-3">
          <h2 className="font-extrabold text-slate-800">Ketuntasan Pembayaran Setiap Tahun</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tahun Ajaran</th>
                {JENIS_ALL.map((jenis) => <th key={jenis} className="px-4 py-3 text-right">{jenis}</th>)}
                <th className="px-4 py-3 text-right">Potensi</th>
                <th className="px-4 py-3 text-right">Diterima</th>
                <th className="px-4 py-3 text-right">Belum</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.yearly.map((row: any) => (
                <tr key={row.id} className={row.is_active ? 'bg-emerald-50/50' : ''}>
                  <td className="px-4 py-3 font-extrabold text-slate-800">{row.nama}</td>
                  {JENIS_ALL.map((jenis) => (
                    <td key={jenis} className="px-4 py-3 text-right">
                      <p className="whitespace-nowrap font-mono font-bold text-slate-800">{rp(row.categories[jenis].paid)}</p>
                      <p className="whitespace-nowrap text-[11px] text-red-600">Sisa {rp(row.categories[jenis].sisa)}</p>
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold">{rp(row.potential)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-emerald-700">{rp(row.received)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-red-700">{rp(row.remaining)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded border px-2 py-1 text-[11px] font-extrabold ${row.complete ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                      {row.complete ? 'TUNTAS' : 'BELUM'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b bg-slate-50 px-5 py-3">
          <h2 className="font-extrabold text-slate-800">Riwayat Pembayaran Berdasarkan Waktu Input</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Tahun</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Sumber</th>
                <th className="px-4 py-3">Penerima</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Kuitansi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.payments.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400">Belum ada transaksi.</td></tr>
              ) : data.payments.map((p: any) => (
                <tr key={p.id} className={p.status === 'VOID' ? 'bg-red-50/40 text-slate-500' : ''}>
                  <td className="px-4 py-3 text-xs">{p.tanggal_bayar}</td>
                  <td className="px-4 py-3">{p.tahun_ajaran_nama || p.tahun_tagihan || 'Legacy'}</td>
                  <td className="px-4 py-3 font-bold">{p.jenis_biaya}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold">{rp(p.nominal_bayar)}</td>
                  <td className="px-4 py-3 text-xs font-bold">{p.psb_receipt_id ? 'Flow PSB' : 'Non-SPP'}</td>
                  <td className="px-4 py-3 text-xs">{p.penerima_nama || 'Sistem'}</td>
                  <td className="px-4 py-3">{p.status === 'VOID' ? <span className="font-bold text-red-700">VOID</span> : <span className="font-bold text-green-700">AKTIF</span>}</td>
                  <td className="px-4 py-3 text-right">
                    {p.status === 'VOID' ? (
                      <span className="text-xs text-slate-400">-</span>
                    ) : p.psb_receipt_id ? (
                      <Link href={`/dashboard/psb/kuitansi/${p.psb_receipt_id}`} target="_blank" className="rounded border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50">Kuitansi PSB</Link>
                    ) : (
                      <PrintReceiptButton receiptId={p.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b bg-slate-50 px-5 py-3">
          <h2 className="font-extrabold text-slate-800">Riwayat Tagihan Awal Migrasi</h2>
          <p className="text-xs text-slate-500">Tagihan awal bukan pembayaran dan tidak memiliki kuitansi.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3 text-right">Nominal Tagihan</th>
                <th className="px-4 py-3">Petugas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.openingBalances.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">Tidak ada tagihan awal migrasi.</td></tr>
              ) : data.openingBalances.map((item: any) => (
                <tr key={item.id} className={item.status === 'VOID' ? 'bg-red-50/40 text-slate-500' : ''}>
                  <td className="px-4 py-3 text-xs">{item.created_at}</td>
                  <td className="px-4 py-3 font-bold">{item.jenis_biaya}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold">{rp(item.nominal_tagihan)}</td>
                  <td className="px-4 py-3 text-xs">{item.penerima_nama || 'Sistem'}</td>
                  <td className="px-4 py-3">{item.status === 'VOID' ? <span className="font-bold text-red-700">VOID</span> : <span className="font-bold text-indigo-700">TAGIHAN AWAL</span>}</td>
                  <td className="px-4 py-3 text-xs">{item.status === 'VOID' ? item.void_reason : item.catatan || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
