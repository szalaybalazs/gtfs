import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckIcon } from './Icons'

/**
 * App-styled dropdown (no native <select>): an icon button that opens a small
 * card of options under it. Closes on outside tap or Escape.
 */
export default function Menu<T extends string>({
  icon,
  label,
  hint,
  value,
  options,
  onChange,
}: {
  icon: ReactNode
  label: string
  /** Explanation under the menu title */
  hint?: ReactNode
  value: T
  options: { value: T; title: string; detail?: ReactNode; example?: ReactNode }[]
  onChange: (value: T) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-2 active:opacity-50"
      >
        {icon}
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-[1200] mt-1 w-64 overflow-hidden rounded-2xl bg-surface shadow-xl ring-1 ring-separator">
          <p className="px-gutter pt-3 text-[12px] font-semibold text-secondary uppercase">{label}</p>
          {hint && <p className="px-gutter pb-1 text-[13px] text-secondary">{hint}</p>}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 px-gutter py-2.5 text-left active:bg-fill"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-medium">{o.title}</span>
                {o.detail && <span className="block text-[13px] text-secondary">{o.detail}</span>}
              </span>
              {o.example != null && (
                <span className="rounded-lg bg-fill px-2 py-0.5 text-[15px] font-semibold tabular-nums">{o.example}</span>
              )}
              <CheckIcon className={`h-5 w-5 shrink-0 text-accent ${o.value === value ? '' : 'invisible'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
