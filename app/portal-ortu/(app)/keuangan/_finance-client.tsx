'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { allocatePortalFunds, createPortalTopup, resetPortalStudentPin, updatePortalWithdrawalLimits } from './actions'

const rp = (value: number) => new Intl.NumberFormat('id-ID').format(value)

export function FinanceClient({ methods, limits }: { methods: string[]; limits: { daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null } | null }) {
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(100000)
  const [method, setMethod] = useState(methods[0] || '')
  const [destination, setDestination] = useState<'SPP' | 'USPP' | 'NON_SPP' | 'MAKAN' | 'LAUNDRY' | 'JAJAN'>('JAJAN')
  const [daily, setDaily] = useState(limits?.daily_rupiah || 0)
  const [weekly, setWeekly] = useState(limits?.weekly_rupiah || 0)
  const [monthly, setMonthly] = useState(limits?.monthly_rupiah || 0)
  const [reauth, setReauth] = useState('')
  const [accountPassword,setAccountPassword]=useState('')
  const [newPin,setNewPin]=useState('')

  return <div className="space-y-4">
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold text-slate-900">Isi saldo</h2>
      <p className="mt-1 text-xs text-slate-500">Dana masuk ke titipan terlebih dahulu. Biaya gateway ditambahkan ke tagihan.</p>
      <div className="mt-4 grid gap-3">
        <input type="number" min={10000} step={1000} value={amount} onChange={e => setAmount(Number(e.target.value))} className="rounded-xl border border-slate-200 px-3 py-2" aria-label="Nominal top up" />
        <select value={method} onChange={e => setMethod(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
          {methods.length ? methods.map(code => <option key={code} value={code}>{code}</option>) : <option value="">Gateway belum dikonfigurasi</option>}
        </select>
        <button disabled={pending || !method} onClick={() => startTransition(async () => {
          const result = await createPortalTopup({ amountRupiah: amount, paymentMethod: method })
          if ('error' in result) toast.error(result.error)
          else if (result.paymentUrl) window.location.href = result.paymentUrl
          else toast.success('Instruksi pembayaran dibuat.')
        })} className="rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">Bayar {rp(amount)}</button>
      </div>
    </section>

    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold text-slate-900">Alokasikan saldo titipan</h2>
      <div className="mt-4 grid gap-3">
        <select value={destination} onChange={e => setDestination(e.target.value as typeof destination)} className="rounded-xl border border-slate-200 px-3 py-2">
          <option value="JAJAN">Uang jajan</option><option value="MAKAN">Uang makan</option><option value="LAUNDRY">Laundry</option><option value="SPP">Lunasi seluruh SPP</option><option value="NON_SPP">Lunasi seluruh Non-SPP</option><option value="USPP">USPP / uang bangunan</option>
        </select>
        <input type="number" min={1000} step={1000} value={amount} disabled={destination==='SPP'||destination==='NON_SPP'} onChange={e => setAmount(Number(e.target.value))} className="rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-100" />
        {(destination==='SPP'||destination==='NON_SPP')&&<p className="text-xs text-slate-500">Nominal dihitung ulang di server dan harus lunas penuh.</p>}
        <button disabled={pending} onClick={() => startTransition(async () => {
          const result = await allocatePortalFunds({ destination, amountRupiah: amount, requestKey: crypto.randomUUID() })
          if ('error' in result) toast.error(result.error); else toast.success('Saldo berhasil dialokasikan.')
        })} className="rounded-xl border border-emerald-700 px-4 py-2.5 font-semibold text-emerald-800 disabled:opacity-50">Alokasikan</button>
      </div>
    </section>

    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold text-slate-900">Limit pencairan anak</h2>
      <p className="mt-1 text-xs text-slate-500">Harian, mingguan, dan bulanan dapat aktif bersamaan; sisa paling ketat yang berlaku. Isi 0 untuk menonaktifkan satu periode.</p>
      <div className="mt-4 grid gap-3">
        <label className="text-xs text-slate-500">Harian<input type="number" value={daily} onChange={e=>setDaily(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label>
        <label className="text-xs text-slate-500">Mingguan<input type="number" value={weekly} onChange={e=>setWeekly(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label>
        <label className="text-xs text-slate-500">Bulanan<input type="number" value={monthly} onChange={e=>setMonthly(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label>
        <input type="password" value={reauth} onChange={e=>setReauth(e.target.value)} placeholder="Password/PIN untuk kenaikan limit" className="rounded-xl border px-3 py-2 text-sm" />
        <button disabled={pending} onClick={()=>startTransition(async()=>{const result=await updatePortalWithdrawalLimits({dailyRupiah:daily||null,weeklyRupiah:weekly||null,monthlyRupiah:monthly||null,reauthSecret:reauth});if('error'in result)toast.error(result.error);else{toast.success('Limit diperbarui.');setReauth('')}})} className="rounded-xl border border-emerald-700 px-4 py-2.5 font-semibold text-emerald-800">Simpan limit</button>
      </div>
    </section>

    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold text-slate-900">PIN pencairan</h2><p className="mt-1 text-xs text-slate-500">PIN 4–8 digit tetap wajib untuk RFID maupun QR.</p>
      <div className="mt-4 grid gap-3"><input type="password" value={accountPassword} onChange={e=>setAccountPassword(e.target.value)} placeholder="Password akun wali" className="rounded-xl border px-3 py-2"/><input type="password" inputMode="numeric" value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="PIN baru 4–8 digit" className="rounded-xl border px-3 py-2"/><button disabled={pending} onClick={()=>startTransition(async()=>{const result=await resetPortalStudentPin({accountPassword,newPin});if('error'in result)toast.error(result.error);else{toast.success('PIN pencairan diperbarui.');setAccountPassword('');setNewPin('')}})} className="rounded-xl border border-emerald-700 px-4 py-2.5 font-semibold text-emerald-800">Atur ulang PIN</button></div>
    </section>
  </div>
}
