import { UpDownIcon } from './Icons'

/** An iOS-style inline picker row backed by a native <select>. */
export default function PickerRow<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  const current = options.find((o) => o.value === value)
  return (
    <label className="relative flex min-h-11 items-center justify-between gap-4 px-4 py-2 has-focus-visible:bg-fill">
      <span className="shrink-0 text-[17px]">{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-[17px] text-secondary">
        <span className="truncate">{current?.label ?? '—'}</span>
        <UpDownIcon className="h-4 w-4 shrink-0" />
      </span>
      <select
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value ?? ''}
        disabled={disabled || options.length === 0}
        onChange={(e) => {
          const option = options[e.target.selectedIndex]
          if (option) onChange(option.value)
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
