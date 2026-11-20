import type { ReactNode } from 'react'

/** iOS-style segmented control. */
export default function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode; ariaLabel?: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-fill p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.ariaLabel}
          onClick={() => onChange(o.value)}
          className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[10px] px-2 py-1.5 text-[15px] font-medium transition-colors ${
            value === o.value ? 'bg-surface shadow-sm' : 'text-secondary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
