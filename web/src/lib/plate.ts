/**
 * Hungarian licence plates, written with dashes so they're easy to read:
 *   ABC123    -> ABC-123        (3 letters, 3 digits)
 *   ABCD123   -> AB-CD-123      (4 letters, 3 digits)
 *   OT1234    -> OT-12-34       (old-timer bus: OT + 4 digits)
 *   OTAB123   -> OT-AB-123      (old-timer bus: OT + 2 letters + 3 digits)
 * Anything else is returned unchanged. Dashes and spaces already in the plate are ignored.
 */
export function formatPlate(plate: string | null | undefined): string | null {
  if (!plate) return null
  const s = plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
  let m: RegExpMatchArray | null
  if ((m = s.match(/^([A-Z]{3})(\d{3})$/))) return `${m[1]}-${m[2]}`
  if ((m = s.match(/^([A-Z]{2})([A-Z]{2})(\d{3})$/))) return `${m[1]}-${m[2]}-${m[3]}`
  if ((m = s.match(/^OT(\d{2})(\d{2})$/))) return `OT-${m[1]}-${m[2]}`
  if ((m = s.match(/^OT([A-Z]{2})(\d{3})$/))) return `OT-${m[1]}-${m[2]}`
  return plate
}
