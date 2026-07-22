'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowsLeftRight, CircleNotch, CreditCard, Key, PlusCircle, Sliders } from '@phosphor-icons/react'
import { formatRupiah } from '@/lib/portal/format'
import { allocatePortalFunds, createPortalTopup, resetPortalStudentPin, updatePortalWithdrawalLimits } from './actions'

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000]

export function FinanceClient({
  methods,
  limits,
}: {
  methods: string[]
  limits: { daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null } | null
}) {
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(100000)
  const [method, setMethod] = useState(methods[0] || '')
  const [destination, setDestination] = useState<'SPP' | 'USPP' | 'NON_SPP' | 'MAKAN' | 'LAUNDRY' | 'JAJAN'>('JAJAN')
  const [daily, setDaily] = useState(limits?.daily_rupiah || 0)
  const [weekly, setWeekly] = useState(limits?.weekly_rupiah || 0)
  const [monthly, setMonthly] = useState(limits?.monthly_rupiah || 0)
  const [reauth, setReauth] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [newPin, setNewPin] = useState('')

  const inputCls =
    'mt-1.5 w-full rounded-2xl border border-[var(--p-line)] bg-[var(--p-cream)]/50 px-4 py-3 text-sm font-semibold text-[var(--p-ink)] outline-none focus:border-[var(--p-emerald)] focus:ring-2 focus:ring-[var(--p-emerald)]/15 transition disabled:bg-slate-100 disabled:text-slate-400'

  return (
    <div className="space-y-4">
      {/* Top Up / Isi Saldo Card */}
      <section className="portal-rise portal-rise-2 rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[var(--p-emerald)]" />
          <h2 className="portal-display text-lg text-[var(--p-emerald-deep)]">Isi Saldo Titipan</h2>
        </div>
        <p className="text-xs text-[var(--p-muted)] leading-relaxed">
          Dana masuk ke saldo titipan terlebih dahulu. Biaya payment gateway ditambahkan saat proses pembayaran.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Pilih / Isi Nominal (Rp)</label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`rounded-xl border py-2 text-xs font-bold transition active:scale-95 ${
                    amount === preset
                      ? 'border-[var(--p-emerald)] bg-[var(--p-emerald)] text-white shadow-sm'
                      : 'border-[var(--p-line)] bg-[var(--p-cream)]/60 text-[var(--p-ink)] hover:bg-[var(--p-cream)]'
                  }`}
                >
                  {preset >= 1000000 ? `${preset / 1000000} Jt` : `${preset / 1000}rb`}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={10000}
              step={1000}
              value={amount || ''}
              onChange={e => setAmount(Number(e.target.value))}
              className={inputCls}
              aria-label="Nominal top up"
              placeholder="Atau ketik nominal custom..."
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Metode Pembayaran</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className={inputCls}
            >
              {methods.length ? (
                methods.map(code => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))
              ) : (
                <option value="">Gateway belum dikonfigurasi</option>
              )}
            </select>
          </div>

          <button
            disabled={pending || !method || amount <= 0}
            onClick={() =>
              startTransition(async () => {
                const result = await createPortalTopup({ amountRupiah: amount, paymentMethod: method })
                if ('error' in result) toast.error(result.error)
                else if (result.paymentUrl) window.location.href = result.paymentUrl
                else toast.success('Instruksi pembayaran dibuat.')
              })
            }
            className="w-full rounded-2xl bg-[var(--p-emerald)] py-3.5 text-sm font-bold text-white shadow-md active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            {pending ? 'Memproses...' : `Bayar ${formatRupiah(amount)}`}
          </button>
        </div>
      </section>

      {/* Alokasi Saldo Card */}
      <section className="portal-rise portal-rise-3 rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <ArrowsLeftRight className="w-4 h-4 text-[var(--p-emerald)]" />
          <h2 className="portal-display text-lg text-[var(--p-emerald-deep)]">Alokasikan Saldo Titipan</h2>
        </div>
        <p className="text-xs text-[var(--p-muted)] leading-relaxed">
          Pindahkan dana dari Saldo Titipan ke Kantong Khusus atau pelunasan tagihan santri.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Tujuan Alokasi</label>
            <select
              value={destination}
              onChange={e => setDestination(e.target.value as typeof destination)}
              className={inputCls}
            >
              <option value="JAJAN">Uang Jajan Santri</option>
              <option value="MAKAN">Uang Makan Santri</option>
              <option value="LAUNDRY">Laundry Santri</option>
              <option value="SPP">Lunasi seluruh SPP</option>
              <option value="NON_SPP">Lunasi seluruh Non-SPP</option>
              <option value="USPP">USPP / Uang Bangunan</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Nominal Alokasi (Rp)</label>
            <input
              type="number"
              min={1000}
              step={1000}
              value={destination === 'SPP' || destination === 'NON_SPP' ? '' : amount || ''}
              disabled={destination === 'SPP' || destination === 'NON_SPP'}
              onChange={e => setAmount(Number(e.target.value))}
              placeholder={destination === 'SPP' || destination === 'NON_SPP' ? 'Dihitung otomatis...' : 'Nominal...'}
              className={inputCls}
            />
            {(destination === 'SPP' || destination === 'NON_SPP') && (
              <p className="mt-1.5 text-[11px] text-[var(--p-muted)] italic">
                * Nominal dihitung otomatis dari total tunggakan aktif dan harus dilunasi penuh.
              </p>
            )}
          </div>

          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await allocatePortalFunds({
                  destination,
                  amountRupiah: amount,
                  requestKey: crypto.randomUUID(),
                })
                if ('error' in result) toast.error(result.error)
                else toast.success('Saldo berhasil dialokasikan.')
              })
            }
            className="w-full rounded-2xl border border-[var(--p-emerald)] bg-emerald-50/50 text-[var(--p-emerald-deep)] py-3 text-sm font-bold active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <ArrowsLeftRight className="w-4 h-4" />}
            {pending ? 'Proses Alokasi...' : 'Alokasikan Saldo'}
          </button>
        </div>
      </section>

      {/* Limit Pencairan Santri */}
      <section className="portal-rise portal-rise-4 rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[var(--p-emerald)]" />
          <h2 className="portal-display text-lg text-[var(--p-emerald-deep)]">Limit Pencairan Anak</h2>
        </div>
        <p className="text-xs text-[var(--p-muted)] leading-relaxed">
          Batas pencairan saldo jajan/makan di pesantren (RFID/QR). Isi 0 untuk tidak memberlakukan limit pada periode tersebut.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Harian (Rp)</label>
              <input
                type="number"
                value={daily || ''}
                onChange={e => setDaily(Number(e.target.value))}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Mingguan (Rp)</label>
              <input
                type="number"
                value={weekly || ''}
                onChange={e => setWeekly(Number(e.target.value))}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Bulanan (Rp)</label>
              <input
                type="number"
                value={monthly || ''}
                onChange={e => setMonthly(Number(e.target.value))}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Password / PIN Konfirmasi</label>
            <input
              type="password"
              value={reauth}
              onChange={e => setReauth(e.target.value)}
              placeholder="Wajib diisi jika menaikkan limit..."
              className={inputCls}
            />
          </div>

          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updatePortalWithdrawalLimits({
                  dailyRupiah: daily || null,
                  weeklyRupiah: weekly || null,
                  monthlyRupiah: monthly || null,
                  reauthSecret: reauth,
                })
                if ('error' in result) toast.error(result.error)
                else {
                  toast.success('Limit pencairan berhasil diperbarui.')
                  setReauth('')
                }
              })
            }
            className="w-full rounded-2xl border border-[var(--p-emerald)] bg-white text-[var(--p-emerald-deep)] py-3 text-sm font-bold active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-50/50"
          >
            {pending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Sliders className="w-4 h-4" />}
            {pending ? 'Menyimpan...' : 'Simpan Limit Pencairan'}
          </button>
        </div>
      </section>

      {/* PIN Pencairan Santri */}
      <section className="portal-rise portal-rise-4 rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-[var(--p-emerald)]" />
          <h2 className="portal-display text-lg text-[var(--p-emerald-deep)]">Atur PIN Pencairan Santri</h2>
        </div>
        <p className="text-xs text-[var(--p-muted)] leading-relaxed">
          PIN 4–8 digit wajib untuk verifikasi keamanan saat santri mengambil tunai/transaksi di pos pesantren.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Password Akun Wali</label>
            <input
              type="password"
              value={accountPassword}
              onChange={e => setAccountPassword(e.target.value)}
              placeholder="Masukkan password akun portal Anda..."
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">PIN Baru Santri (4-8 Digit)</label>
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              placeholder="Contoh: 123456"
              className={inputCls}
            />
          </div>

          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await resetPortalStudentPin({ accountPassword, newPin })
                if ('error' in result) toast.error(result.error)
                else {
                  toast.success('PIN pencairan santri berhasil diperbarui.')
                  setAccountPassword('')
                  setNewPin('')
                }
              })
            }
            className="w-full rounded-2xl border border-[var(--p-emerald)] bg-white text-[var(--p-emerald-deep)] py-3 text-sm font-bold active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-50/50"
          >
            {pending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            {pending ? 'Menyimpan PIN...' : 'Atur Ulang PIN Santri'}
          </button>
        </div>
      </section>
    </div>
  )
}
