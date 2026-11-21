import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * An iOS-style picker wheel: a column of numbers you flick, which snaps to the
 * middle row and curves away above and below like a drum. It loops (after 59
 * comes 00) by repeating the values and quietly re-centring when it settles.
 */
const ITEM = 36 // px per row
const VISIBLE = 7 // rows in view (odd, so one sits in the middle)
const COPIES = 9 // repeated copies of the values, for looping

export const WHEEL_HEIGHT = ITEM * VISIBLE

export default function Wheel({
  count,
  value,
  onChange,
  format = (n) => String(n).padStart(2, '0'),
  label,
  align = 'center',
}: {
  count: number
  value: number
  onChange: (v: number) => void
  format?: (n: number) => string
  label: string
  align?: 'left' | 'center' | 'right'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ value, onChange })
  latest.current = { value, onChange }
  const middle = Math.floor(COPIES / 2) * count

  // Curve each row by its distance from the centre (the drum effect)
  const paint = () => {
    const el = ref.current
    if (!el) return
    const centre = el.scrollTop + WHEEL_HEIGHT / 2
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const offset = (child.offsetTop + ITEM / 2 - centre) / ITEM
      if (Math.abs(offset) > VISIBLE / 2 + 1) continue
      const angle = Math.max(-90, Math.min(90, offset * 20))
      child.style.transform = `rotateX(${-angle}deg) translateZ(0)`
      child.style.opacity = String(Math.max(0.15, 1 - Math.abs(offset) * 0.22))
    }
  }

  const scrollToIndex = (index: number, smooth: boolean) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: index * ITEM, behavior: smooth ? 'smooth' : 'auto' })
  }

  // Start on the current value, in the middle copy
  useLayoutEffect(() => {
    scrollToIndex(middle + value, false)
    paint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow outside changes (e.g. "Now") without fighting the finger
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const current = ((Math.round(el.scrollTop / ITEM) % count) + count) % count
    if (current !== value) scrollToIndex(middle + value, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const onScroll = () => {
    requestAnimationFrame(paint)
    if (settle.current) clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const index = Math.round(el.scrollTop / ITEM)
      const v = ((index % count) + count) % count
      // Jump back to the middle copy so it never runs out (same row, invisible)
      if (Math.abs(index - (middle + v)) >= count) {
        el.scrollTop = (middle + v) * ITEM
        paint()
      }
      if (v !== latest.current.value) {
        navigator.vibrate?.(5)
        latest.current.onChange(v)
      }
    }, 90)
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          onChange((value + (e.key === 'ArrowDown' ? 1 : count - 1)) % count)
        }
      }}
      className="relative h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        paddingBlock: (WHEEL_HEIGHT - ITEM) / 2,
        perspective: 600,
        // Fade out towards the top and bottom edges, like the iOS wheel
        maskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)',
      }}
    >
      {Array.from({ length: count * COPIES }, (_, i) => {
        const v = i % count
        return (
          <div
            key={i}
            role="option"
            aria-selected={v === value}
            onClick={() => scrollToIndex(i, true)}
            className={`flex snap-center items-center px-3 text-[23px] tabular-nums select-none ${
              align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center'
            }`}
            style={{ height: ITEM, transformOrigin: 'center' }}
          >
            {format(v)}
          </div>
        )
      })}
    </div>
  )
}
