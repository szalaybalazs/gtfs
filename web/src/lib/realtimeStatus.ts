import type { MessageKey } from './i18n'

/** How a time relates to the schedule, for colouring it. */
export type RealtimeStatus = 'scheduled' | 'onTime' | 'early' | 'late'

/** Within a minute either way counts as on time. */
export function realtimeStatus(realtime: boolean, delaySeconds: number | null | undefined): RealtimeStatus {
  if (!realtime) return 'scheduled'
  if (delaySeconds == null || Math.abs(delaySeconds) < 60) return 'onTime'
  return delaySeconds > 0 ? 'late' : 'early'
}

/**
 * The one place that decides what each status looks like; everything else
 * (lists, timetable, map labels) reads these two maps.
 * TODO(design): on-time may become plain text + the live icon instead of
 * green. Change ONTIME_TONE below (both maps follow it).
 */
const ONTIME_TONE: 'green' | 'plain' = 'green'

/** Text colour as a Tailwind class: green on time, purple early, red late, plain when there's no realtime data. */
export const statusColor: Record<RealtimeStatus, string> = {
  scheduled: '',
  onTime: ONTIME_TONE === 'green' ? 'text-live' : '',
  early: 'text-early',
  late: 'text-late',
}

/** The same colours as CSS values, for HTML drawn outside React (map markers). */
export const statusCss: Record<RealtimeStatus, string> = {
  scheduled: 'inherit',
  onTime: ONTIME_TONE === 'green' ? 'var(--color-live)' : 'inherit',
  early: 'var(--color-early)',
  late: 'var(--color-late)',
}

/** The realtime ("live") mark as an SVG string, for HTML map markers; same arcs as LiveIcon. */
export const LIVE_ICON_HTML =
  '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" style="flex:none"><path d="M5 19h.01M5 13a6 6 0 0 1 6 6M5 7a12 12 0 0 1 12 12"/></svg>'

/** i18n keys: t(statusLabel[status]) */
export const statusLabel: Record<RealtimeStatus, MessageKey> = {
  scheduled: 'status.scheduled',
  onTime: 'status.onTime',
  early: 'status.early',
  late: 'status.late',
}
