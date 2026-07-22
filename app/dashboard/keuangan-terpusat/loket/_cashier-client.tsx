'use client'
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { identifyStudent, openCashShift, submitWithdrawal } from './actions'
import type { CredentialKind } from '@/lib/finance/types'

type Props = {
  units: Array<{ id: string; name: string }>
  shift: { id: string; cash_unit_id: string; terminal_id: string } | null
}

export function CashierClient({ units, shift: initialShift }: Props) {
  const [pending, startTransition] = useTransition()
  const [shift, setShift] = useState(initialShift)
  const [kind, setKind] = useState<CredentialKind>('RFID_UID')
  const [token, setToken] = useState('')
  const [student, setStudent] = useState<any>(null)
  const [amount, setAmount] = useState(20000)
  const [pin, setPin] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const terminalId = useMemo(() => {
    if (typeof window === 'undefined') return 'terminal-web'
    const current = localStorage.getItem('finance-terminal-id') || `web-${crypto.randomUUID()}`
    localStorage.setItem('finance-terminal-id', current); return current
  }, [])

  if (!shift) return <section className="max-w-lg rounded-xl border border-slate-200 bg-white p-4 sm:rounded-2xl sm:p-5">
    <h2 className="font-bold">Buka shift kas</h2><p className="mt-1 text-sm text-slate-500">Hitung kas fisik sebelum melayani pencairan.</p>
    {units.length === 0 ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Unit kas belum dibuat oleh bendahara pusat.</p> : <form className="mt-4 grid gap-3" action={form => startTransition(async () => {
      const result = await openCashShift({ cashUnitId: String(form.get('unit')), openingCashRupiah: Number(form.get('cash')), terminalId })
      if ('error' in result) toast.error(result.error); else { toast.success('Shift dibuka.'); setShift({ id: result.id, cash_unit_id: String(form.get('unit')), terminal_id: terminalId }) }
    })}>
      <select name="unit" className="min-h-11 rounded-xl border px-3 py-2 sm:min-h-0">{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select>
      <input name="cash" type="number" min={0} inputMode="numeric" placeholder="Kas fisik awal" className="min-h-11 rounded-xl border px-3 py-2 sm:min-h-0" required />
      <button disabled={pending} className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-white sm:min-h-0">Buka shift</button>
    </form>}
  </section>

  return <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:rounded-2xl sm:p-5">
      <div className="grid grid-cols-2 gap-2 sm:flex"><button onClick={() => setKind('RFID_UID')} className={`min-h-11 rounded-lg px-3 py-2 text-sm sm:min-h-0 ${kind === 'RFID_UID' ? 'bg-emerald-700 text-white' : 'bg-slate-100'}`}>RFID</button><button onClick={() => setKind('QR_STATIC')} className={`min-h-11 rounded-lg px-3 py-2 text-sm sm:min-h-0 ${kind === 'QR_STATIC' ? 'bg-emerald-700 text-white' : 'bg-slate-100'}`}>QR</button></div>
      <label className="mt-4 block text-sm font-medium">Scan credential</label>
      <input autoFocus value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') startTransition(async () => { const result = await identifyStudent(kind, token); if ('error' in result) toast.error(result.error); else setStudent(result.student) }) }} className="mt-1 w-full rounded-xl border px-3 py-3 font-mono" placeholder="Reader/scanner mengetik di sini lalu Enter" />
      <button disabled={pending || !token} onClick={() => startTransition(async () => { const result = await identifyStudent(kind, token); if ('error' in result) toast.error(result.error); else setStudent(result.student) })} className="mt-3 min-h-11 w-full rounded-xl border border-emerald-700 px-4 py-2 font-semibold text-emerald-800 sm:min-h-0">Tampilkan identitas</button>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:rounded-2xl sm:p-5">
      {!student ? <p className="text-slate-500">Scan kartu/QR untuk menampilkan foto santri.</p> : <>
        <div className="flex flex-col gap-4 min-[360px]:flex-row"><div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-32 sm:w-28">{student.foto_url ? <img src={student.foto_url} alt="Foto santri" className="h-full w-full object-cover" /> : null}</div><div className="min-w-0"><h2 className="break-words text-lg font-bold sm:text-xl">{student.nama_lengkap}</h2><p>{student.nis}</p><p className="text-sm text-slate-500">{student.asrama} · {student.kamar}</p><p className="mt-3 break-words font-semibold text-emerald-800">Saldo Rp {Number(student.balance_rupiah).toLocaleString('id-ID')}</p></div></div>
        <div className="mt-5 grid gap-3">
          <input type="number" value={amount} min={5000} step={5000} onChange={e => setAmount(Number(e.target.value))} className="rounded-xl border px-3 py-2" />
          <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN melalui keypad privat" className="rounded-xl border px-3 py-2 text-center text-xl tracking-[.4em]" />
          <label className="flex min-h-11 items-start gap-2 py-2 text-sm sm:min-h-0 sm:py-0"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" /> Foto dan identitas fisik sudah cocok.</label>
          <button disabled={pending || !pin || !confirmed} onClick={() => startTransition(async () => {
            const result = await submitWithdrawal({ requestKey: crypto.randomUUID(), credentialKind: kind, rawToken: token, pin, amountRupiah: amount, cashUnitId: shift.cash_unit_id, shiftId: shift.id, terminalId, identityConfirmed: confirmed })
            if ('error' in result) toast.error(result.error); else { toast.success('Pencairan tercatat.'); setStudent(null); setToken(''); setPin(''); setConfirmed(false) }
          })} className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">Cairkan uang</button>
        </div>
      </>}
    </section>
  </div>
}
