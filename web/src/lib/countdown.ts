/**
 * How long until a departure, for the big number on the right.
 * Whole minutes from 3 minutes out, half minutes below that (2½, 2, 1½, 1),
 * then seconds in the last minute. `unit` is an i18n key.
 */
export function countdown(seconds: number): { value: string; unit: 'unit.sec' | 'unit.min' } {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return { value: String(s), unit: 'unit.sec' }
  if (s < 180) {
    const halves = Math.floor(s / 30) // 2..5
    const whole = Math.floor(halves / 2)
    return { value: halves % 2 ? `${whole}½` : String(whole), unit: 'unit.min' }
  }
  return { value: String(Math.floor(s / 60)), unit: 'unit.min' }
}

/**
 * The number for a departure that has just gone: "0" for the first second, then "-1", "-2"…
 * (the same zero as the countdown itself, so the sequence never jumps from 1 to a minus sign).
 */
export function justLeftValue(seconds: number): string {
  const n = Math.floor(-seconds)
  return n <= 0 ? '0' : `-${n}`
}
