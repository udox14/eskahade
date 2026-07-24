'use client'
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Clock, Money, Scan, SignOut, Wallet } from '@phosphor-icons/react'
import { closeCashShift, identifyStudent, openCashShift, submitWithdrawal } from './actions'
import type { CredentialKind } from '@/lib/finance/types'
import { credentialKindFromToken, useKeyboardWedgeScanner } from '@/lib/finance/scanner-client'
import { QrCameraScanner } from '@/components/finance/qr-camera-scanner'

type Unit = { id: string; name: string; asrama_scope: string | null; fixed_float_rupiah: number }
type Shift = {
  id: string; cash_unit_id: string; terminal_id: string; opening_cash_rupiah: number
  opened_at: string; unit_name: string; asrama_scope: string | null
  paid_rupiah: number; expected_cash_rupiah: number
}
type LimitSummary = Record<'daily' | 'weekly' | 'monthly', { limit: number | null; spent: number }>

type Props = {
  units: Unit[]
  shift: Shift | null
  operatorName: string
  canConfigure: boolean
}

const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

export function CashierClient({ units, shift: initialShift, operatorName, canConfigure }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [shift, setShift] = useState(initialShift)
  const [selectedUnitId, setSelectedUnitId] = useState(units[0]?.id || '')
  const selectedUnit = units.find(unit => unit.id === selectedUnitId)
  const [openingCash, setOpeningCash] = useState(selectedUnit?.fixed_float_rupiah || 0)
  const [kind, setKind] = useState<CredentialKind>('RFID_UID')
  const [token, setToken] = useState('')
  const [student, setStudent] = useState<any>(null)
  const [limits, setLimits] = useState<LimitSummary | null>(null)
  const [amount, setAmount] = useState(20000)
  const [pin, setPin] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [actualCash, setActualCash] = useState(initialShift?.expected_cash_rupiah || 0)
  const [closingNote, setClosingNote] = useState('')
  const [lastSuccess, setLastSuccess] = useState<{ name: string; amount: number } | null>(null)
  const terminalId = useMemo(() => {
    if (typeof window === 'undefined') return 'terminal-web'
    const current = localStorage.getItem('finance-terminal-id') || `web-${crypto.randomUUID()}`
    localStorage.setItem('finance-terminal-id', current)
    return current
  }, [])

  const scanCredential = (rawToken: string) => {
    const value = rawToken.trim()
    if (!value || !shift) return
    const detectedKind = credentialKindFromToken(value)
    setKind(detectedKind)
    setToken(value)
    setLastSuccess(null)
    startTransition(async () => {
      const result = await identifyStudent(shift.id, detectedKind, value)
      if ('error' in result) {
        setStudent(null)
        setLimits(null)
        toast.error(result.error)
      } else {
        setStudent(result.student)
        setLimits(result.limits)
      }
    })
  }
  useKeyboardWedgeScanner(scanCredential, Boolean(shift))

  function selectUnit(id: string) {
    const unit = units.find(item => item.id === id)
    setSelectedUnitId(id)
    setOpeningCash(unit?.fixed_float_rupiah || 0)
  }

  if (!shift) {
    return <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Wallet className="h-5 w-5" /></span>
          <div><h2 className="font-bold text-slate-900">1. Buka shift kas</h2><p className="mt-1 text-sm text-slate-500">Pilih Unit Kas yang ditugaskan, lalu cocokkan saldo tetap dengan uang fisik.</p></div>
        </div>
        {units.length === 0 ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">Belum ada Unit Kas yang ditugaskan.</p>
          <p className="mt-1">{canConfigure ? 'Buat Unit Kas dan tugaskan operator sebelum membuka loket.' : 'Hubungi bendahara pusat untuk mendapatkan penugasan Unit Kas.'}</p>
          {canConfigure ? <Link href="/dashboard/keuangan-terpusat/unit-kas" className="mt-3 inline-flex rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white">Buka pengaturan Unit Kas</Link> : null}
        </div> : <div className="mt-5 grid gap-4">
          <label className="text-sm font-bold text-slate-700">Unit Kas
            <select value={selectedUnitId} onChange={event => selectUnit(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
              {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}{unit.asrama_scope ? ` · ${unit.asrama_scope}` : ''}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">Kas fisik awal
            <input value={openingCash} onChange={event => setOpeningCash(Number(event.target.value))} type="number" min={0} inputMode="numeric" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums" />
            <span className="mt-1 block text-xs font-normal text-slate-500">Saldo tetap unit: {rupiah(selectedUnit?.fixed_float_rupiah || 0)}. Ubah angka jika hasil hitung fisik berbeda.</span>
          </label>
          <button disabled={pending || !selectedUnitId} onClick={() => startTransition(async () => {
            const result = await openCashShift({ cashUnitId: selectedUnitId, openingCashRupiah: openingCash, terminalId })
            if ('error' in result) { toast.error(result.error); return }
            toast.success('Shift kas dibuka.')
            router.refresh()
            setShift({
              id: result.id, cash_unit_id: selectedUnitId, terminal_id: terminalId,
              opening_cash_rupiah: openingCash, opened_at: new Date().toISOString(),
              unit_name: selectedUnit?.name || 'Unit Kas', asrama_scope: selectedUnit?.asrama_scope || null,
              paid_rupiah: 0, expected_cash_rupiah: openingCash,
            })
          })} className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Buka shift dan mulai melayani</button>
        </div>}
      </div>
      <aside className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-slate-700 sm:p-5">
        <h3 className="font-bold text-slate-900">Sebelum loket dibuka</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-5">
          <li>Hitung uang tunai di laci kas.</li>
          <li>Pastikan scanner RFID/QR dan keypad PIN siap.</li>
          <li>Pastikan nama Unit Kas dan scope asrama sudah benar.</li>
        </ol>
      </aside>
    </section>
  }

  const discrepancy = actualCash - shift.expected_cash_rupiah
  return <div className="space-y-4">
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">Shift aktif</span><strong>{shift.unit_name}</strong>{shift.asrama_scope ? <span className="text-xs text-slate-500">Scope {shift.asrama_scope}</span> : null}</div>
          <p className="mt-1 text-xs text-slate-500">{operatorName} · Terminal {shift.terminal_id}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[440px]">
          <div className="rounded-lg bg-white p-3"><span className="text-slate-500">Kas awal</span><strong className="mt-1 block tabular-nums">{rupiah(shift.opening_cash_rupiah)}</strong></div>
          <div className="rounded-lg bg-white p-3"><span className="text-slate-500">Dicairkan</span><strong className="mt-1 block tabular-nums">{rupiah(shift.paid_rupiah)}</strong></div>
          <div className="rounded-lg bg-white p-3"><span className="text-slate-500">Kas seharusnya</span><strong className="mt-1 block tabular-nums text-emerald-800">{rupiah(shift.expected_cash_rupiah)}</strong></div>
        </div>
        <button onClick={() => { setActualCash(shift.expected_cash_rupiah); setShowClose(true) }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"><SignOut className="h-4 w-4" />Tutup shift</button>
      </div>
    </section>

    {lastSuccess ? <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><CheckCircle className="h-6 w-6 shrink-0" weight="fill" /><div><strong>Pencairan berhasil</strong><p>{lastSuccess.name} · {rupiah(lastSuccess.amount)}</p></div></div> : null}

    <div className="grid gap-4 lg:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Langkah 2</p><h2 className="mt-1 font-bold">Scan RFID atau QR</h2><p className="mt-1 text-xs text-slate-500">Jenis kredensial dikenali otomatis.</p></div><Scan className="h-6 w-6 text-slate-400" /></div>
        <label className="mt-4 block text-sm font-bold">Kredensial
          <input autoFocus data-scanner-input value={token} onChange={event => setToken(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); scanCredential(token) } }} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-3 font-mono text-sm" placeholder="Tempel kartu atau scan QR" />
        </label>
        <div className="mt-3 grid gap-2"><button disabled={pending || !token} onClick={() => scanCredential(token)} className="min-h-11 rounded-lg border border-emerald-700 px-4 text-sm font-bold text-emerald-800 disabled:opacity-50">Tampilkan identitas</button><QrCameraScanner onScan={scanCredential} /></div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {!student ? <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500"><div><Scan className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Menunggu scan santri</p><p className="mt-1 text-xs">Foto, saldo, dan limit akan muncul di sini.</p></div></div> : <>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="h-32 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">{student.foto_url ? <img src={student.foto_url} alt="Foto santri" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-2xl font-black text-slate-300">{String(student.nama_lengkap).slice(0, 1)}</div>}</div>
            <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Langkah 3 · Verifikasi</p><h2 className="mt-1 break-words text-xl font-bold">{student.nama_lengkap}</h2><p className="text-sm text-slate-600">NIS {student.nis} · {student.asrama || 'Tanpa asrama'} · {student.kamar || 'Tanpa kamar'}</p><p className="mt-3 text-lg font-black text-emerald-800">{rupiah(student.balance_rupiah)}</p><p className="text-xs text-slate-500">Saldo uang jajan tersedia</p></div>
          </div>
          {limits ? <div className="mt-4 grid grid-cols-3 gap-2">{([
            ['daily', 'Harian'], ['weekly', 'Mingguan'], ['monthly', 'Bulanan'],
          ] as const).map(([key, label]) => {
            const item = limits[key]
            const remaining = item.limit == null ? null : Math.max(0, item.limit - item.spent)
            return <div key={key} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs"><span className="text-slate-500">{label}</span><strong className="mt-1 block tabular-nums">{remaining == null ? 'Tanpa batas' : rupiah(remaining)}</strong><span className="text-[10px] text-slate-400">{item.limit == null ? 'Belum diatur' : `dari ${rupiah(item.limit)}`}</span></div>
          })}</div> : null}
          <div className="mt-5 grid gap-3">
            <label className="text-sm font-bold">Nominal pencairan
              <div className="relative mt-1.5"><Money className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input type="number" value={amount} min={5000} step={5000} onChange={event => setAmount(Number(event.target.value))} className="min-h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 tabular-nums" /></div>
            </label>
            <label className="text-sm font-bold">PIN santri
              <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={event => setPin(event.target.value)} placeholder="Masukkan melalui keypad privat" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-center text-xl tracking-[.35em]" />
            </label>
            <label className="flex min-h-11 items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" /><span>Foto, kartu, dan identitas fisik santri sudah cocok.</span></label>
            <button disabled={pending || !pin || !confirmed || amount <= 0} onClick={() => startTransition(async () => {
              const result = await submitWithdrawal({ requestKey: crypto.randomUUID(), credentialKind: kind, rawToken: token, pin, amountRupiah: amount, cashUnitId: shift.cash_unit_id, shiftId: shift.id, terminalId: shift.terminal_id, identityConfirmed: confirmed })
              if ('error' in result) { toast.error(result.error); return }
              toast.success('Pencairan tercatat.')
              setLastSuccess({ name: student.nama_lengkap, amount })
              setShift(current => current ? { ...current, paid_rupiah: Number(current.paid_rupiah) + amount, expected_cash_rupiah: Number(current.expected_cash_rupiah) - amount } : current)
              setStudent(null); setLimits(null); setToken(''); setPin(''); setConfirmed(false)
              router.refresh()
            })} className="min-h-12 rounded-lg bg-emerald-700 px-4 font-bold text-white disabled:opacity-50">Konfirmasi dan cairkan {rupiah(amount)}</button>
          </div>
        </>}
      </section>
    </div>

    {showClose ? <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4" onClick={() => setShowClose(false)}>
      <section className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Clock className="h-5 w-5" /></span><div><h2 className="font-bold">Tutup shift kas</h2><p className="mt-1 text-sm text-slate-500">Hitung seluruh uang fisik sebelum mengonfirmasi.</p></div></div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-slate-50 p-3"><span className="text-xs text-slate-500">Kas seharusnya</span><strong className="mt-1 block tabular-nums">{rupiah(shift.expected_cash_rupiah)}</strong></div><div className={`rounded-lg p-3 ${discrepancy === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}><span className="text-xs">Selisih</span><strong className="mt-1 block tabular-nums">{rupiah(discrepancy)}</strong></div></div>
        <label className="mt-4 block text-sm font-bold">Kas fisik akhir<input autoFocus value={actualCash} onChange={event => setActualCash(Number(event.target.value))} type="number" min={0} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 px-3 tabular-nums" /></label>
        {discrepancy !== 0 ? <label className="mt-3 block text-sm font-bold text-amber-900">Catatan selisih<textarea value={closingNote} onChange={event => setClosingNote(event.target.value)} rows={3} placeholder="Jelaskan hasil pengecekan awal..." className="mt-1.5 w-full rounded-lg border border-amber-300 p-3 text-slate-900" /></label> : null}
        <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => setShowClose(false)} className="min-h-11 rounded-lg border border-slate-200 font-bold">Batal</button><button disabled={pending || (discrepancy !== 0 && closingNote.trim().length < 5)} onClick={() => startTransition(async () => {
          const result = await closeCashShift({ shiftId: shift.id, actualClosingRupiah: actualCash, note: closingNote })
          if ('error' in result) { toast.error(result.error); return }
          toast.success(result.discrepancy === 0 ? 'Shift ditutup tanpa selisih.' : 'Shift ditutup dan dikirim untuk review.')
          setShowClose(false); setShift(null); setStudent(null); setToken(''); setClosingNote('')
          router.refresh()
        })} className="min-h-11 rounded-lg bg-slate-900 px-3 font-bold text-white disabled:opacity-50">Tutup shift</button></div>
      </section>
    </div> : null}
  </div>
}
