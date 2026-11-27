'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Coins } from 'lucide-react'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { fetchCooperativeIncomeStats } from './actions'

type Stats = Awaited<ReturnType<typeof fetchCooperativeIncomeStats>>

const rupiah = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID')
const CHANNEL: Record<string, string> = { BRI: 'BRIVA', TRANSFER: 'Transfer Manual', CASH: 'Tunai' }
const SOURCE: Record<string, string> = { ADMIN_FEE: 'Biaya admin', UNIQUE_CODE: 'Kode unik' }

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

function currentMonthWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7)
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return ym
  return `${MONTH_NAMES[m - 1]} ${y}`
}

function formatDayLabel(ymd: string): string {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ymd
  const [, y, m, d] = match
  const monthIdx = Number(m) - 1
  const shortMonth = MONTH_NAMES[monthIdx]?.slice(0, 3) || m
  return `${Number(d)} ${shortMonth} ${y}`
}

function buildRecentMonthOptions(anchorYm: string): SelectPickerOption[] {
  const [y, m] = anchorYm.split('-').map(Number)
  const options: SelectPickerOption[] = []
  for (let i = 0; i < 12; i++) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1))
    const ym = dt.toISOString().slice(0, 7)
    options.push({ value: ym, label: formatMonthLabel(ym) })
  }
  return options
}

/** Pendapatan Koperasi (append-only ledger, net of reversals/refunds). Not distributed to Pesantren/Katering/Laundry. */
export default function CooperativeIncomeCard() {
  const initialMonth = useMemo(() => currentMonthWib(), [])
  const monthOptions = useMemo(() => buildRecentMonthOptions(initialMonth), [initialMonth])

  const [month, setMonth] = useState(initialMonth)
  const [expanded, setExpanded] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchCooperativeIncomeStats(month)
      .then((result) => {
        if (active) {
          setStats(result)
          setError(null)
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Gagal memuat rincian pendapatan Koperasi.')
      })
    return () => {
      active = false
    }
  }, [month])

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-2xs">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Coins className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h3 className="text-sm font-semibold text-slate-900">
                Rincian Pendapatan Koperasi ({formatMonthLabel(month)})
              </h3>
              {stats && (
                <span className="text-base font-bold text-emerald-700 tabular-nums">
                  {rupiah(stats.period.totalNet)}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Biaya admin &amp; kode unik transfer bersih setelah koreksi (tidak disalurkan ke Pesantren/Katering/Laundry).
              {stats && (
                <span className="ml-1 text-slate-600 font-medium tabular-nums">
                  Total sepanjang waktu: {rupiah(stats.allTimeNet)}.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SelectPicker
            value={month}
            options={monthOptions}
            onChange={(val) => {
              setStats(null)
              setMonth(val)
            }}
            ariaLabel="Pilih bulan rincian pendapatan Koperasi"
            align="right"
            className="w-40"
          />
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span>{expanded ? 'Sembunyikan' : 'Rincian'}</span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-rose-700 bg-rose-50/50 rounded-b-xl">
          {error}
        </div>
      )}

      {expanded && !error && (
        <div className="border-t border-slate-100 p-4">
          {!stats ? (
            <p className="text-xs text-slate-500">Memuat rincian bulan {formatMonthLabel(month)}…</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Berdasarkan Jalur &amp; Sumber
                </h4>
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-100 text-slate-500">
                    <tr>
                      <th className="py-1.5 text-left font-medium">Jalur</th>
                      <th className="py-1.5 text-left font-medium">Sumber</th>
                      <th className="py-1.5 text-right font-medium">Trx</th>
                      <th className="py-1.5 text-right font-medium">Bersih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.period.rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-3 text-slate-500">
                          Belum ada pendapatan Koperasi pada bulan ini.
                        </td>
                      </tr>
                    ) : (
                      stats.period.rows.map((row) => (
                        <tr key={`${row.channel}-${row.income_source}`}>
                          <td className="py-2 font-medium text-slate-800">
                            {CHANNEL[row.channel] || row.channel}
                          </td>
                          <td className="py-2 text-slate-600">
                            {SOURCE[row.income_source] || row.income_source}
                          </td>
                          <td className="py-2 text-right tabular-nums text-slate-600">
                            {row.transactions}
                          </td>
                          <td className="py-2 text-right font-semibold tabular-nums text-slate-900">
                            {rupiah(row.net)}
                            {row.reversal ? (
                              <span className="block text-[10px] font-normal text-slate-400">
                                koreksi −{rupiah(row.reversal)}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Rekap Harian
                </h4>
                {stats.period.daily.length === 0 ? (
                  <p className="py-3 text-xs text-slate-500">Tidak ada transaksi harian.</p>
                ) : (
                  <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {stats.period.daily.map((day) => (
                      <li key={day.day} className="flex items-center justify-between py-2">
                        <span className="text-slate-700">{formatDayLabel(day.day)}</span>
                        <span className="font-semibold tabular-nums text-slate-900">
                          {rupiah(day.net)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
