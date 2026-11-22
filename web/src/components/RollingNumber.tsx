import { useEffect, useRef, useState } from 'react'
import { useAnimateNumbers } from '../lib/animateNumbers'

/**
 * A number that rolls digit by digit when it changes, like iOS's numeric text transition: each digit sits in a
 * column of 0–9 and slides to the new one (up for a higher digit, down for a lower one, as a countdown does).
 * Digits are keyed by their place from the end, so only the digits that change move; the rest of the text (a minus
 * sign, "s", "'") stays put. Off with the setting, or when the reader prefers reduced motion.
 */
export default function RollingNumber({
  value,
  className = '',
  still = false,
}: {
  value: string
  className?: string
  still?: boolean
}) {
  const [on] = useAnimateNumbers()
  // While a row is closing up or coming back, its number just changes; it doesn't roll in the middle of that
  const animate = on && !still
  const chars = Array.from(value)
  const digitCount = chars.filter((c) => /\d/.test(c)).length
  let digitIndex = 0
  // A change in how many digits there are (9 -> 10, 1 -> 0): iOS doesn't roll it, the digits just come and go in place
  const prevCount = useRef(digitCount)
  const structural = prevCount.current !== digitCount
  useEffect(() => {
    prevCount.current = digitCount
  })
  return (
    <span className={`inline-flex items-baseline tabular-nums ${className}`} aria-label={value}>
      {chars.map((c, i) => {
        const placeFromEnd = chars.length - 1 - i
        // iOS's cascade: 0.15 s spread across the digits, most significant first
        const delay = 0
        if (/\d/.test(c)) digitIndex += 1
        return /\d/.test(c) ? (
          <Digit key={`d${placeFromEnd}`} d={Number(c)} animate={animate} delay={delay} structural={structural} />
        ) : (
          <span key={`c${placeFromEnd}`} aria-hidden="true" className="relative -top-[0.08em]">
            {c}
          </span>
        )
      })}
    </span>
  )
}

/**
 * One digit. When it changes, the new one slides in from the top and fades up a little, and the old one fades out
 * where it was (the same on every change, whichever way the number goes). The old one is removed once it has faded.
 */
function Digit({ d, animate, delay = 0, structural }: { d: number; animate: boolean; delay?: number; structural: boolean }) {
  // Always from the top: a digit enters from above and leaves downward (whatever the direction of the count)
  const dyIn = structural ? '0em' : '-0.59375em'
  const dyOut = structural ? '0em' : '0.59375em'
  const [items, setItems] = useState<{ id: number; d: number }[]>(() => [{ id: 0, d }])
  const seq = useRef(0)
  const latest = items[items.length - 1]
  useEffect(() => {
    if (latest.d === d) return
    seq.current += 1
    const id = seq.current
    setItems((prev) => [...prev.map((x) => ({ ...x, old: true })), { id, d }])
    const timer = window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id === id)), 320)
    return () => window.clearTimeout(timer)
    // latest.d is read on purpose: compare against what is on screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d])
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] [contain:layout] [backface-visibility:hidden]" aria-hidden="true">
      {items.map((x) => {
        const old = x.id !== items[items.length - 1].id
        return (
          <span
            key={x.id}
            style={{ animationDelay: `${delay}s`, ['--dy-in' as string]: dyIn, ['--dy-out' as string]: dyOut }}
            className={`absolute inset-0 flex items-center justify-center leading-none ${
              animate && old ? 'glyph-out pointer-events-none' : animate && x.id !== 0 ? 'glyph-in' : ''
            }`}
          >
            {x.d}
          </span>
        )
      })}
    </span>
  )
}
