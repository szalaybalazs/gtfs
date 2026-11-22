import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { useAnimateNumbers } from '../lib/animateNumbers'

interface RollingNumberProps {
  value: string
  className?: string
  still?: boolean
}

type EntryMode = 'initial' | 'vertical' | 'horizontal'

interface GlyphItem {
  id: number
  g: string
  mode: EntryMode
  exiting: boolean
}

/**
 * iOS-style rolling countdown / age display with a fixed-width numeric core
 * so surrounding row layout never shifts:
 *   [ [prefix] [leading?] [tens] [ones] [half] ] [suffix]
 */
export default function RollingNumber({ value, className = '', still = false, fixedWidth = true }: RollingNumberProps & { fixedWidth?: boolean }) {
  const [on] = useAnimateNumbers()
  const reducedMotion = usePrefersReducedMotion()
  const animate = on && !still && !reducedMotion

  const { prefix, digits, half, suffix } = parse(value)
  const leading = digits.length > 2 ? digits.slice(0, -2) : ''
  const tens = digits.length >= 2 ? digits[digits.length - 2] : ''
  const ones = digits.length >= 1 ? digits[digits.length - 1] : ''

  // Keep the half column open after `2½ -> 2` so `2` stays put while `½` fades down,
  // and `2 -> 1½` drops `½` in from the top. Collapse back flush-right once digits change
  // without a half (e.g. `1 -> 59`).
  const [halfReserved, setHalfReserved] = useState(half)
  const prevDigitsRef = useRef(digits)
  const prevAnimateRef = useRef(animate)

  useEffect(() => {
    const prevDigits = prevDigitsRef.current
    const wasAnimating = prevAnimateRef.current
    prevDigitsRef.current = digits
    prevAnimateRef.current = animate

    if (!animate) {
      setHalfReserved(half)
      return
    }

    if (half) {
      setHalfReserved(true)
    } else if (!wasAnimating || prevDigits !== digits) {
      setHalfReserved(false)
    } else {
      // The half just left (2½ -> 2): let its fade finish, then close the column so the 2 slides back to the right
      const timer = window.setTimeout(() => setHalfReserved(false), 320)
      return () => window.clearTimeout(timer)
    }
  }, [digits, half, animate])

  const effectiveHalfReserved = animate ? halfReserved : half
  // Slide `½` in from the right when expanding the half slot (`3 -> 2½`),
  // otherwise drop it in from the top (`2 -> 1½`).
  const halfEntryMode: EntryMode = half && !effectiveHalfReserved ? 'horizontal' : 'vertical'

  return (
    <span className={`inline-flex items-baseline justify-end tabular-nums ${className}`}>
      <span className="sr-only">{value}</span>
      <span className={`inline-flex items-baseline justify-end ${fixedWidth ? 'min-w-[2.1em]' : ''}`} aria-hidden="true">
        {prefix && <TextPiece text={prefix} />}
        {leading && <TextPiece text={leading} />}
        {/* Without the fixed core, a single digit has no empty tens slot in front of it */}
        {(fixedWidth || tens !== '') && <Slot glyph={tens} animate={animate} width="w-[0.62em]" />}
        <Slot glyph={ones} animate={animate} width="w-[0.62em]" />
        <HalfSlot
          glyph={half ? '½' : ''}
          reserved={effectiveHalfReserved}
          entryMode={halfEntryMode}
          animate={animate}
        />
      </span>
      {suffix && (
        <TextPiece text={suffix} />
      )}
    </span>
  )
}

/**
 * Parses numeric countdown/age strings with optional sign, half-minute symbol, and unit suffix:
 *   "3"      -> { prefix: "",  digits: "3",  half: false, suffix: "" }
 *   "2½"     -> { prefix: "",  digits: "2",  half: true,  suffix: "" }
 *   "2½'"    -> { prefix: "",  digits: "2",  half: true,  suffix: "'" }
 *   "10s"    -> { prefix: "",  digits: "10", half: false, suffix: "s" }
 *   "-12"    -> { prefix: "-", digits: "12", half: false, suffix: "" }
 *   "3 min"  -> { prefix: "",  digits: "3",  half: false, suffix: " min" }
 */
function parse(value: string) {
  const m = /^([^\d½]*)(\d*)(½?)(.*)$/.exec(value) ?? ['', '', '', '', value]
  return {
    prefix: m[1],
    digits: m[2],
    half: m[3] === '½',
    suffix: m[4],
  }
}

function Slot({
  glyph,
  animate,
  width,
  entryMode = 'vertical',
}: {
  glyph: string
  animate: boolean
  width: string
  entryMode?: EntryMode
}) {
  const seq = useRef(0)
  const [items, setItems] = useState<GlyphItem[]>(() => [
    { id: 0, g: glyph, mode: 'initial', exiting: false },
  ])
  const current = items[items.length - 1]

  useEffect(() => {
    if (!animate) {
      if (items.length !== 1 || current.g !== glyph || current.exiting) {
        seq.current += 1
        setItems([{ id: seq.current, g: glyph, mode: 'initial', exiting: false }])
      }
      return
    }

    if (current.g === glyph && !current.exiting) return

    seq.current += 1
    const nextId = seq.current
    const prevActive = !current.exiting && current.g !== '' ? { ...current, exiting: true } : null
    const nextItem: GlyphItem = { id: nextId, g: glyph, mode: entryMode, exiting: false }

    setItems(prevActive ? [prevActive, nextItem] : [nextItem])

    if (!prevActive) return
    const timer = window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => !x.exiting || x.id >= nextId))
    }, 310)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glyph, animate])

  return (
    <span
      className={`relative inline-block h-[1em] ${width} [backface-visibility:hidden]`}
      aria-hidden="true"
    >
      {items.map((x) => {
        const style: CSSProperties =
          x.mode === 'horizontal'
            ? ({ ['--dx-in']: '0.45em', ['--dy-in']: '0px', ['--dy-out']: '0.59375em' } as CSSProperties)
            : ({ ['--dx-in']: '0px', ['--dy-in']: '-0.59375em', ['--dy-out']: '0.59375em' } as CSSProperties)

        const animClass = !animate
          ? ''
          : x.exiting
            ? 'glyph-out'
            : x.mode !== 'initial'
              ? 'glyph-in'
              : ''

        return (
          <span
            key={x.id}
            style={style}
            className={`absolute inset-0 flex items-center justify-center leading-none ${animClass}`}
          >
            {x.g}
          </span>
        )
      })}
    </span>
  )
}

function HalfSlot({
  glyph,
  reserved,
  entryMode,
  animate,
}: {
  glyph: string
  reserved: boolean
  entryMode: EntryMode
  animate: boolean
}) {
  const widthClass = reserved ? 'w-[0.85em]' : 'w-0'
  const transitionClass = animate
    ? 'transition-[width] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
    : ''

  return (
    <span className={`inline-flex items-center overflow-visible ${widthClass} ${transitionClass}`}>
      <Slot glyph={glyph} animate={animate} width="w-[0.85em]" entryMode={entryMode} />
    </span>
  )
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/** Plain text (a sign, a unit) in the same 1em box as a digit slot, so it shares the digits' baseline. */
function TextPiece({ text, raise = false }: { text: string; raise?: boolean }) {
  return (
    <span
      className={`relative inline-block h-[1em] leading-none whitespace-pre ${raise ? '-top-[0.08em]' : ''}`}
      // A minute mark is narrow: give it just its own width, so it sits close to the digits
      style={{ width: `${text === "'" ? 0.25 : Math.max(0.3, text.length * 0.6)}em` }}
      aria-hidden="true"
    >
      <span className="absolute inset-0 flex items-center justify-center">{text}</span>
    </span>
  )
}
