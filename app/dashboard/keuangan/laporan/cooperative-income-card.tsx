'use client'

import { useEffect, useState } from 'react'
import { fetchCooperativeIncomeStats } from './actions'

type Stats = Awaited<ReturnType<typeof fetchCooperativeIncomeStats>>
const rupiah = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID')
const CHANNEL: Record<string, string> = { BRI: 'BRIVA', TRANSFER: 'Transfer bank', CASH: 'Tunai' }
const SOURCE: Record<string, string> = { ADMIN_FEE: 'Biaya admin', UNIQUE_CODE: 'Kode unik' }

function currentMonth() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7)
}

/** Pendapatan Koperasi (append-only ledger, net of reversals/refunds). Not distributed to Pesantren/Katering/Laundry. */
export default function CooperativeIncomeCard() {
  const [month, setMonth] = useState(currentMonth)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setStats(null)
    fetchCooperativeIncomeStats(month).then(setStats).catch(e => setError(e instanceof Error ? e.message : 'Gagal memuat.'))
  }, [month])

  return (
    <section className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Pendapatan Koperasi</h3>
          <p className="text-xs text-slate-500">Biaya admin dan kode unik transfer, bersih setelah koreksi/refund.</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} aria-label="Bulan"
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!stats && !error && <p className="text-xs text-slate-500">Memuat…</p>}
      {stats && (
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono">{rupiah(stats.period.totalNet)}</div>
            <div className="text-xs text-slate-500">bulan ini · total sepanjang waktu {rupiah(stats.allTimeNet)}</div>
            <table className="mt-3 w-full text-xs">
              <thead className="text-slate-500"><tr><th className="text-left py-1">Jalur</th><th className="text-left">Sumber</th><th className="text-right">Transaksi</th><th className="text-right">Bersih</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {stats.period.rows.length === 0 && <tr><td colSpan={4} className="py-2 text-slate-500">Belum ada pendapatan pada bulan ini.</td></tr>}
                {stats.period.rows.map(row => (
                  <tr key={row.channel + row.income_source}>
                    <td className="py-1.5">{CHANNEL[row.channel] || row.channel}</td>
                    <td>{SOURCE[row.income_source] || row.income_source}</td>
                    <td className="text-right font-mono">{row.transactions}</td>
                    <td className="text-right font-mono">{rupiah(row.net)}{row.reversal ? <span className="block text-[10px] text-slate-400">koreksi −{rupiah(row.reversal)}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Per hari</div>
            <ul className="max-h-48 overflow-y-auto text-xs divide-y divide-slate-100">
              {stats.period.daily.length === 0 && <li className="py-1 text-slate-500">-</li>}
              {stats.period.daily.map(day => (
                <li key={day.day} className="flex justify-between py-1"><span>{day.day}</span><span className="font-mono">{rupiah(day.net)}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
