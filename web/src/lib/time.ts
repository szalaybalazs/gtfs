// Timetables are shown in the feed's local time regardless of where the
// viewer is.
export const TIME_ZONE = 'Europe/Budapest'

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function localParts(date: Date) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(date).map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parts.hour,
    minute: parts.minute,
  }
}

/** Key identifying the local calendar hour a date falls into. */
export function hourKey(date: Date) {
  const { date: day, hour } = localParts(date)
  return `${day}T${hour}`
}

export function formatTime(date: Date) {
  const { hour, minute } = localParts(date)
  return `${hour}:${minute}`
}

export function formatDelay(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes === 0) return 'on time'
  return minutes > 0 ? `${minutes} min late` : `${-minutes} min early`
}

const secondsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** HH:MM and :SS separately, so the seconds can be set smaller. */
export function formatTimeParts(date: Date) {
  const parts = Object.fromEntries(secondsFormatter.formatToParts(date).map((p) => [p.type, p.value]))
  return { hm: `${parts.hour}:${parts.minute}`, s: parts.second }
}
