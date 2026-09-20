'use client'

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function toDigits(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
}

export function RupiahInput({
  value,
  onChange,
  placeholder,
  max,
  autoFocus,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  max?: number
  autoFocus?: boolean
  disabled?: boolean
}) {
  const display = value > 0 ? groupThousands(String(value)) : ''

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = toDigits(e.target.value)
    let next = digits ? Number(digits) : 0
    if (typeof max === 'number' && next > max) next = max
    onChange(next)
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
        Rp
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoFocus={autoFocus}
        disabled={disabled}
        value={display}
        onChange={handleChange}
        placeholder={placeholder ?? '0'}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-8 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100 disabled:opacity-50 transition"
      />
    </div>
  )
}
