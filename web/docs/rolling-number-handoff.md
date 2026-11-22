# Handoff: rolling countdown numbers (web)

Goal: a countdown or "updated … ago" value whose changes animate like iOS's numeric text transition, with stable width,
and a half-minute symbol ("½") that behaves correctly.

## Requirements (from the user, in order of importance)

1. **Width never jumps.** Changing 10 -> 9 or 3 -> 2½ must not shift the rest of the row by a visible amount.
2. **Direction:** a new glyph enters from the **top**; the old glyph leaves **downward** and fades out. Same for every change,
   whichever way the number goes (the user explicitly does not want direction to depend on increasing/decreasing).
3. **Old glyph fades out** (with a little blur and scale-down); it does not vanish instantly.
4. **Half minutes:** the sequence 4, 3½, 3, 2½, 2, 1½, 1, then 59, 58, 57 (seconds). Desired behaviour:
   - 3 -> 2½ (the user's description): the half appears from the **right**, sliding in and pushing the existing whole
     minutes ("2") to the **left**. The "3" becomes the "2" as the half arrives, so the whole part moves left while the
     half slides in. Think of it as a horizontal insert, not a vertical roll for the half.
   - 2½ -> 2: the "½" fades out downward. The "2" stays where it is (no roll).
   - 2 -> 1½: the "2" changes to "1", the "½" enters from the top.
   - Timing should follow iOS "one-to-one" (the user's wording). The constants below are a community measurement of iOS
     (react-native-numeric-text, docs/ARCHITECTURE.md), not an Apple spec.
5. **Zero state:** the countdown shows "0" for the first second after a departure leaves, then "-1", "-2".
6. **Minus sign and unit** stay static (they do not roll).
7. **Stable identity:** a row that reappears (a departure that was leaving and came back) must not replay a roll through old
   values; while the row is closing or returning the number should stay still (the `still` prop).
8. **Settings:** an "Animate changing numbers" switch (default on). Off = plain text swap. Reduced motion = no animation.
9. Rows can appear, disappear, and reorder; nothing should flicker or jump when that happens.

## Current implementation

Files:
- `web/src/components/RollingNumber.tsx`: the component (below).
- `web/src/index.css`: keyframes `glyph-in` and `glyph-out` (below). `row-in-top`/`row-in-bottom` are for rows, not numbers.
- `web/src/lib/animateNumbers.ts`: the setting (localStorage key `animate-numbers`, default on).
- `web/src/lib/countdown.ts`: `countdown(seconds)` returns "3", "2½", "59" etc.; `justLeftValue(seconds)` returns "0", "-1", "-2".
- Callers: `components/Departures.tsx` (departure countdown, with the `still` prop set while the row is collapsing),
  `components/LineBoard.tsx` (line board countdown), `components/FavoriteCards.tsx` (favourite times, e.g. "10s", "2½'"),
  `components/RefreshedAge.tsx` ("40s", "3 min").
- Story: `web/src/stories/RollingNumber.stories.tsx` (run Storybook on port 6006).

Current approach: fixed slots `[prefix] [tens] [ones] [half] [suffix]`. `parse()` splits "2½" into digits "2" and a half.
Each slot keeps a small list of glyph items; a changed glyph adds an item (enters from the top), the old item gets
`glyph-out` (fades down) and is removed after 340 ms.

Known problems reported by the user about the earlier versions: the cycle was too fast; the width was unstable; the half slot
did not fit. The fixed-slot design is the current trial and has not been accepted yet.

### RollingNumber.tsx (verbatim)

```tsx
import { useEffect, useRef, useState } from 'react'
import { useAnimateNumbers } from '../lib/animateNumbers'

/**
 * A countdown or age with fixed glyph slots, so the width never jumps and every change is a slot change:
 *   [prefix] [tens] [ones] [half] [suffix]
 * - tens and ones hold one digit each (an empty slot is blank, so 10 -> 9 leaves its space until the digit has faded).
 * - half holds "½" or nothing (3 -> 2½ fills the half slot; 2½ -> 2 empties it, and the 2 stays put).
 * A slot whose glyph changes: the new glyph enters from the top, the old one fades out downward.
 * Off with the animate-numbers setting, while `still` (a row closing or returning), or with reduced motion.
 */
export default function RollingNumber({ value, className = '', still = false }: { value: string; className?: string; still?: boolean }) {
  const [on] = useAnimateNumbers()
  const animate = on && !still
  const { prefix, digits, suffix, half } = parse(value)
  const tens = digits.length >= 2 ? digits[digits.length - 2] : ''
  const ones = digits.length >= 1 ? digits[digits.length - 1] : ''
  return (
    <span className={`inline-flex items-baseline justify-end tabular-nums ${className}`} aria-label={value}>
      {prefix && <span aria-hidden="true">{prefix}</span>}
      <Slot glyph={tens} animate={animate} width="w-[0.62em]" />
      <Slot glyph={ones} animate={animate} width="w-[0.62em]" />
      <Slot glyph={half ? '½' : ''} animate={animate} width="w-[0.7em]" />
      {suffix && <span aria-hidden="true">{suffix}</span>}
    </span>
  )
}

/** "-12" -> prefix "-", digits "12"; "59s" -> digits "59", suffix "s"; "2½" -> digits "2", half. */
function parse(value: string) {
  const half = value.endsWith('½')
  const core = half ? value.slice(0, -1) : value
  const m = /^(\D*)(\d*)(.*)$/.exec(core) ?? ['', '', '', core]
  return { prefix: m[1], digits: m[2], suffix: m[3], half }
}

/**
 * One fixed slot. When its glyph changes, the new one enters from the top and the old one fades out downward.
 * The old glyph is removed once it has faded. An empty glyph is a blank slot (it keeps its width).
 */
function Slot({ glyph, animate, width }: { glyph: string; animate: boolean; width: string }) {
  const [items, setItems] = useState<{ id: number; g: string }[]>(() => [{ id: 0, g: glyph }])
  const seq = useRef(0)
  const latest = items[items.length - 1]
  useEffect(() => {
    if (latest.g === glyph) return
    seq.current += 1
    const id = seq.current
    setItems((prev) => [...prev, { id, g: glyph }])
    const timer = window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id === id)), 340)
    return () => window.clearTimeout(timer)
    // Only a change of glyph starts a transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glyph])
  return (
    <span className={`relative inline-block h-[1em] ${width} [backface-visibility:hidden]`} aria-hidden="true">
      {items.map((x) => {
        const old = x.id !== latest.id
        return (
          <span
            key={x.id}
            style={{ ['--dy-in' as string]: '-0.59375em', ['--dy-out' as string]: '0.59375em' }}
            className={`absolute inset-0 flex items-center justify-center leading-none ${
              animate && old ? 'glyph-out pointer-events-none' : animate && x.id !== 0 ? 'glyph-in' : ''
            }`}
          >
            {x.g}
          </span>
        )
      })}
    </span>
  )
}
```

### Keyframes (index.css, verbatim)

```css
/* iOS numeric text, as measured by react-native-numeric-text: entry offset 0.59375 glyph heights, scale 0.3984 -> 1,
   blur 0.125 em, alpha 0 -> 1. The leaving glyph mirrors it. --dy-in / --dy-out are set per digit (direction). */
@keyframes glyph-in {
  from { transform: translateY(var(--dy-in)) scale(0.3984); opacity: 0; filter: blur(0.125em); }
  to { transform: none; opacity: 1; filter: blur(0); }
}
@keyframes glyph-out {
  from { transform: none; opacity: 1; filter: blur(0); }
  to { transform: translateY(var(--dy-out)) scale(0.3984); opacity: 0; filter: blur(0.125em); }
}
.glyph-in { animation: glyph-in 0.35s cubic-bezier(0.34, 1.25, 0.64, 1) both; }
.glyph-out { animation: glyph-out 0.28s ease-in both; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .glyph-in, .glyph-out { animation: none; } }
```

### Story (verbatim)

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import RollingNumber from '../components/RollingNumber'

/**
 * Step through the countdown one value at a time: Prev / Next. Start at 4 minutes, then 3½, 3, 2½, 2, 1½, 1,
 * then 59, 58, 57. Look at each step on its own: the new glyph should enter from the top, the old one fade down,
 * and the width should never jump.
 */
const STEPS = ['4', '3½', '3', '2½', '2', '1½', '1', '59', '58', '57']

const meta: Meta = { title: 'Motion / Countdown steps', parameters: { layout: 'padded' } }
export default meta
type Story = StoryObj

export const Steps: Story = {
  render: () => {
    const [i, setI] = useState(0)
    const step = (d: number) => setI((x) => Math.min(STEPS.length - 1, Math.max(0, x + d)))
    return (
      <div className="flex max-w-md flex-col gap-6 p-6">
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-6">
          <span className="text-5xl font-bold">
            <RollingNumber value={STEPS[i]} />
          </span>
          <span className="text-sm text-neutral-500">min · step {i + 1} of {STEPS.length}</span>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => step(-1)} className="rounded-lg border px-4 py-2 font-medium">
            ← Prev
          </button>
          <button type="button" onClick={() => step(1)} className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white">
            Next →
          </button>
        </div>
      </div>
    )
  },
}
```

## Measured iOS constants (community, react-native-numeric-text, docs/ARCHITECTURE.md; unverified)

- Entry offset 0.59375 glyph heights (dy = 0.59375 * (1 - p)); leaving glyph dy = -0.59375 * p. Spring zeta 0.55, response ~353 ms.
- Scale: birth 0.3984 -> 1 (s = 0.3984 + 0.6016 p); death 1 -> 0.3984. Zeta 1.00, ~278 ms.
- Blur sigma = 0.125 * (1 - p) (in glyph heights). Zeta ~0.91, ~398 ms.
- Alpha a = p (enter), 1 - p (leave). Zeta 1.00, ~276 ms.
- Cascade: 0.15 s across columns, most significant first. We removed it on web because rows went out of step; reconsider.
- Direction: per transition, from countsDown. We ignore it and always enter from the top, per the user.
- Structural changes (digit count changes): no roll; digits enter or exit in place, small and blurred.

## Open questions

- Does the fixed-slot layout give stable width for every case (10 -> 9, 2½ -> 2, 59 -> 58)? Check in Storybook.
- Timing: the step story is manual; the live list updates every second. Is the speed right at a 1 s cadence?
- Is the half slot width (0.7em) right for "½" in the system font?
- The `still` prop and rows that leave and return: check they do not replay.

## How to test

1. `cd web && npm run storybook` (port 6006), then open
   http://localhost:6006/?path=/story/motion-countdown-steps--steps and click Next and Prev.
2. `cd web && npx tsc -b && npx vite build` must pass.
