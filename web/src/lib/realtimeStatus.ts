import type { MessageKey } from './i18n'

/** How a time relates to the schedule, for colouring it. */
export type RealtimeStatus = 'scheduled' | 'onTime' | 'early' | 'late'

/** Within a minute either way counts as on time. */
export function realtimeStatus(realtime: boolean, delaySeconds: number | null | undefined): RealtimeStatus {
  if (!realtime) return 'scheduled'
  if (delaySeconds == null || Math.abs(delaySeconds) < 60) return 'onTime'
  return delaySeconds > 0 ? 'late' : 'early'
}

/** Text colour: green on time, purple early, red late, plain when there's no realtime data. */
export const statusColor: Record<RealtimeStatus, string> = {
  scheduled: '',
  onTime: 'text-live',
  early: 'text-early',
  late: 'text-late',
}

/** i18n keys: t(statusLabel[status]) */
export const statusLabel: Record<RealtimeStatus, MessageKey> = {
  scheduled: 'status.scheduled',
  onTime: 'status.onTime',
  early: 'status.early',
  late: 'status.late',
}
