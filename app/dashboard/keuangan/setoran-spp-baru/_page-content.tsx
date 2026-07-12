'use client'

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useState } from 'react'
import { CheckCircle, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { batalkanKonfirmasiSetoranPusat, getSetoranSppBaru, konfirmasiSetoranPusat } from './actions'

const rp = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`

export default function PageContent() {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [data, setData] = useState<any>({ rows: [], details: [] })
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); const res = await getSetoranSppBaru(tahun, bulan); if ('error' in res) toast.error(res.error); else setData(res); setLoading(false) }
  useEffect(() => { void load() }, [tahun, bulan])
  const confirm = async (id: string) => { const res = await konfirmasiSetoranPusat(id); if ('error' in res) toast.error(res.error); else { toast.success('Setoran dikonfirmasi'); await load() } }
  const undo = async (id: string) => { const alasan = window.prompt('Alasan pembatalan konfirmasi:') || ''; const res = await batalkanKonfirmasiSetoranPusat(id, alasan); if ('error' in res) toast.error(res.error); else { toast.success('Konfirmasi dibatalkan'); await load() } }

  return <div className="mx-auto max-w-7xl space-y-6 pb-20">
    <DashboardPageHeader
      title="Setoran SPP Santri Baru"
      description="Penerimaan pusat untuk tagihan SPP Juli santri angkatan PSB."
      action={<div className="flex gap-2"><select value={bulan} onChange={e => setBulan(Number(e.target.value))} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select><input type="number" value={tahun} onChange={e=>setTahun(Number(e.target.value))} className="w-24 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"/></div>}
    />
    {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin"/> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Asrama</th><th className="p-3 text-right">Santri</th><th className="p-3 text-right">Target sistem</th><th className="p-3 text-right">Disetor</th><th className="p-3 text-right">Selisih</th><th className="p-3">Penyetor</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{data.rows.map((r:any)=><tr key={r.unit_setor} className="border-t"><td className="p-3 font-bold">{r.unit_setor}</td><td className="p-3 text-right">{r.jumlah_santri}</td><td className="p-3 text-right font-mono">{rp(r.target_sistem)}</td><td className="p-3 text-right font-mono">{r.setoran_id ? rp(r.jumlah_aktual) : '-'}</td><td className="p-3 text-right font-mono">{r.setoran_id ? rp(r.jumlah_aktual-r.target_sistem) : '-'}</td><td className="p-3">{r.nama_penyetor||'-'}</td><td className="p-3">{r.status||'Belum dikirim'}</td><td className="p-3 text-right">{r.status==='menunggu_konfirmasi'&&<button onClick={()=>confirm(r.setoran_id)} className="rounded bg-emerald-700 px-3 py-1.5 font-bold text-white"><CheckCircle className="mr-1 inline h-4 w-4"/>Konfirmasi</button>}{r.status==='dikonfirmasi'&&<button onClick={()=>undo(r.setoran_id)} className="rounded border px-3 py-1.5 text-red-700"><RotateCcw className="mr-1 inline h-4 w-4"/>Batalkan</button>}</td></tr>)}</tbody></table>{data.rows.length===0&&<p className="p-8 text-center text-slate-400">Belum ada transaksi tujuan Bendahara Pesantren pada periode ini.</p>}</div>}
    <div className="overflow-x-auto rounded-xl border bg-white"><h2 className="border-b p-4 font-bold">Rincian transaksi</h2><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Tanggal</th><th className="p-3">Santri</th><th className="p-3">Asrama</th><th className="p-3">Tagihan</th><th className="p-3 text-right">Nominal</th></tr></thead><tbody>{data.details.map((r:any)=><tr key={r.id} className="border-t"><td className="p-3">{r.tanggal_bayar}</td><td className="p-3"><b>{r.nama_lengkap}</b><div className="text-xs text-slate-400">{r.nis||'-'}</div></td><td className="p-3">{r.unit_setor}</td><td className="p-3">Juli {r.tahun}</td><td className="p-3 text-right font-mono">{rp(r.nominal_bayar)}</td></tr>)}</tbody></table></div>
  </div>
}
