'use client'

import { useState } from 'react'
import { Bank, CaretDown, CheckCircle, QrCode, X } from '@phosphor-icons/react'

// Duitku hanya mengirim kode metode (mis. "BC", "M2", "VC") lewat env
// DUITKU_PAYMENT_METHODS — tidak ada API/daftar resmi yang dibaca sistem
// untuk memetakan kode ke nama bank, jadi kita TIDAK menebak nama bank
// (salah tebak di UI keuangan lebih berbahaya daripada tampil generik).
// Yang pasti diketahui hanya: kode QRIS (DUITKU_QRIS_METHOD) vs kode VA
// lainnya — dua kategori itu yang dibedakan secara visual di sini.
function methodMeta(code: string, qrisMethod: string | null) {
  if (qrisMethod && code === qrisMethod) {
    return { label: 'QRIS', desc: 'Scan pakai aplikasi apa saja', icon: QrCode }
  }
  return { label: 'Transfer Virtual Account', desc: `Kode metode: ${code}`, icon: Bank }
}

export function PaymentMethodPicker({
  methods,
  qrisMethod,
  value,
  onChange,
}: {
  methods: string[]
  qrisMethod: string | null
  value: string
  onChange: (code: string) => void
}) {
  const [open, setOpen] = useState(false)

  if (methods.length === 0) {
    return (
      <div className="portal-field flex items-center text-[var(--p-muted)]">
        Gateway belum dikonfigurasi
      </div>
    )
  }

  const selected = methodMeta(value, qrisMethod)
  const SelectedIcon = selected.icon

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="portal-field flex w-full items-center gap-3 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--p-radius-sm)] bg-[var(--p-paper)] border border-[var(--p-line)]">
          <SelectedIcon className="w-4 h-4 text-[var(--p-ink)]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-[var(--p-ink)] truncate">{selected.label}</span>
          <span className="block text-[10px] text-[var(--p-muted)] truncate">{selected.desc}</span>
        </span>
        <CaretDown className="w-4 h-4 shrink-0 text-[var(--p-muted)]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button aria-label="Tutup" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
          <div className="portal-theme relative w-full max-w-md max-h-[80dvh] overflow-y-auto rounded-t-[var(--p-radius-lg)] bg-[var(--p-paper)] p-5 pb-8 portal-rise">
            <div className="flex items-center justify-between">
              <h3 className="portal-display text-xl text-[var(--p-ink)]">Pilih Metode Pembayaran</h3>
              <button onClick={() => setOpen(false)} className="p-2 rounded-[var(--p-radius-sm)] bg-white border border-[var(--p-line)]" aria-label="Tutup">
                <X className="w-4 h-4 text-[var(--p-muted)]" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {methods.map(code => {
                const meta = methodMeta(code, qrisMethod)
                const Icon = meta.icon
                const active = value === code
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      onChange(code)
                      setOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 rounded-[var(--p-radius-md)] border px-4 py-3.5 text-left transition ${
                      active ? 'border-[var(--p-ink)] bg-white' : 'border-[var(--p-line)] bg-white/60'
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--p-radius-sm)] bg-[var(--p-paper)] border border-[var(--p-line)]">
                      <Icon className="w-5 h-5 text-[var(--p-ink)]" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-[var(--p-ink)]">{meta.label}</span>
                      <span className="block text-[11px] text-[var(--p-muted)]">{meta.desc}</span>
                    </span>
                    {active && <CheckCircle className="w-5 h-5 shrink-0 text-[var(--p-ink)]" weight="fill" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
