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
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--p-muted)]">
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
        className="portal-field !pl-9"
      />
    </div>
  )
}
