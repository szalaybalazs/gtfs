/**
 * Stable colours for telling lines apart in a shared timetable. Official line
 * colours are useless here (most trams are the same yellow), so each route id
 * hashes to a palette slot. Collisions at one stop move to the next free slot,
 * in route-id order, so the result is the same every time for the same stop.
 */
const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#65a30d', '#4f46e5', '#b45309']

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function lineColors(routeIds: string[]): Map<string, string> {
  const result = new Map<string, string>()
  const used = new Set<number>()
  for (const id of [...new Set(routeIds)].sort()) {
    let slot = hash(id) % PALETTE.length
    for (let i = 0; i < PALETTE.length && used.has(slot); i++) slot = (slot + 1) % PALETTE.length
    used.add(slot)
    result.set(id, PALETTE[slot])
  }
  return result
}
