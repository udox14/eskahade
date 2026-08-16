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
  const [topupPending, startTopupTransition] = useTransition()
  const [allocPending, startAllocTransition] = useTransition()
  const [limitPending, startLimitTransition] = useTransition()
  const [pinPending, startPinTransition] = useTransition()
  const [topupAmount, setTopupAmount] = useState(100000)
  const [allocAmount, setAllocAmount] = useState(50000)
  const [method, setMethod] = useState(methods[0] || '')
  const [destination, setDestination] = useState<'USPP' | 'MAKAN' | 'LAUNDRY' | 'JAJAN'>('JAJAN')
  const [daily, setDaily] = useState(limits?.daily_rupiah || 0)
  const [weekly, setWeekly] = useState(limits?.weekly_rupiah || 0)
  const [monthly, setMonthly] = useState(limits?.monthly_rupiah || 0)
  const [reauth, setReauth] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [newPin, setNewPin] = useState('')

  return (
    <div className="space-y-4">
      {/* Top Up / Isi Saldo Card */}
      <section className="portal-rise portal-rise-2 portal-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[var(--p-ink)]" />
          <h2 className="portal-display text-lg text-[var(--p-ink)]">Isi Saldo Titipan</h2>
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
                  onClick={() => setTopupAmount(preset)}
                  className={`rounded-[var(--p-radius-sm)] border py-2 text-xs font-bold transition active:scale-95 ${
                    topupAmount === preset
                      ? 'border-[var(--p-ink)] bg-[var(--p-ink)] text-white'
                      : 'border-[var(--p-line)] bg-white text-[var(--p-ink)] hover:bg-[var(--p-paper)]'
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
              value={topupAmount || ''}
              onChange={e => setTopupAmount(Number(e.target.value))}
              className="portal-field"
              aria-label="Nominal top up"
              placeholder="Atau ketik nominal custom..."
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Metode Pembayaran</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="portal-field"
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
            disabled={topupPending || !method || topupAmount <= 0}
            onClick={() =>
              startTopupTransition(async () => {
                const result = await createPortalTopup({ amountRupiah: topupAmount, paymentMethod: method })
                if ('error' in result) toast.error(result.error)
                else if (result.paymentUrl) window.location.href = result.paymentUrl
                else toast.success('Instruksi pembayaran dibuat.')
              })
            }
            className="portal-btn portal-btn-accent w-full"
          >
            {topupPending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            {topupPending ? 'Memproses...' : `Bayar ${formatRupiah(topupAmount)}`}
          </button>
        </div>
      </section>

      {/* Alokasi Saldo Card */}
      <section className="portal-rise portal-rise-3 portal-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowsLeftRight className="w-4 h-4 text-[var(--p-ink)]" />
          <h2 className="portal-display text-lg text-[var(--p-ink)]">Alokasikan Saldo Titipan</h2>
        </div>
        <p className="text-xs text-[var(--p-muted)] leading-relaxed">
          Pindahkan dana dari Saldo Titipan ke kantong khusus santri. Untuk membayar tagihan SPP/Non-SPP/USPP, gunakan tab Tagihan.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Tujuan Alokasi</label>
            <select
              value={destination}
              onChange={e => setDestination(e.target.value as typeof destination)}
              className="portal-field"
            >
              <option value="JAJAN">Uang Jajan Santri</option>
              <option value="MAKAN">Uang Makan Santri</option>
              <option value="LAUNDRY">Laundry Santri</option>
              <option value="USPP">USPP / Uang Bangunan (nominal bebas)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Nominal Alokasi (Rp)</label>
            <input
              type="number"
              min={1000}
              step={1000}
              value={allocAmount || ''}
              onChange={e => setAllocAmount(Number(e.target.value))}
              placeholder="Nominal..."
              className="portal-field"
            />
          </div>

          <button
            disabled={allocPending}
            onClick={() =>
              startAllocTransition(async () => {
                const result = await allocatePortalFunds({
                  destination,
                  amountRupiah: allocAmount,
                  requestKey: crypto.randomUUID(),
                })
                if ('error' in result) toast.error(result.error)
                else toast.success('Saldo berhasil dialokasikan.')
              })
            }
            className="portal-btn portal-btn-outline w-full"
          >
            {allocPending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <ArrowsLeftRight className="w-4 h-4" />}
            {allocPending ? 'Proses Alokasi...' : 'Alokasikan Saldo'}
          </button>
        </div>
      </section>

      {/* Limit Pencairan Santri */}
      <section className="portal-rise portal-rise-4 portal-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[var(--p-ink)]" />
          <h2 className="portal-display text-lg text-[var(--p-ink)]">Limit Pencairan Anak</h2>
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
                className="portal-field"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Mingguan (Rp)</label>
              <input
                type="number"
                value={weekly || ''}
                onChange={e => setWeekly(Number(e.target.value))}
                placeholder="0"
                className="portal-field"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Bulanan (Rp)</label>
              <input
                type="number"
                value={monthly || ''}
                onChange={e => setMonthly(Number(e.target.value))}
                placeholder="0"
                className="portal-field"
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
              className="portal-field"
            />
          </div>

          <button
            disabled={limitPending}
            onClick={() =>
              startLimitTransition(async () => {
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
            className="portal-btn portal-btn-outline w-full"
          >
            {limitPending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Sliders className="w-4 h-4" />}
            {limitPending ? 'Menyimpan...' : 'Simpan Limit Pencairan'}
          </button>
        </div>
      </section>

      {/* PIN Pencairan Santri */}
      <section className="portal-rise portal-rise-4 portal-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-[var(--p-ink)]" />
          <h2 className="portal-display text-lg text-[var(--p-ink)]">Atur PIN Pencairan Santri</h2>
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
              className="portal-field"
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
              className="portal-field"
            />
          </div>

          <button
            disabled={pinPending}
            onClick={() =>
              startPinTransition(async () => {
                const result = await resetPortalStudentPin({ accountPassword, newPin })
                if ('error' in result) toast.error(result.error)
                else {
                  toast.success('PIN pencairan santri berhasil diperbarui.')
                  setAccountPassword('')
                  setNewPin('')
                }
              })
            }
            className="portal-btn portal-btn-outline w-full"
          >
            {pinPending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            {pinPending ? 'Menyimpan PIN...' : 'Atur Ulang PIN Santri'}
          </button>
        </div>
      </section>
    </div>
  )
}
