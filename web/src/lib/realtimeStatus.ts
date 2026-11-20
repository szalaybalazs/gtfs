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

export const statusLabel: Record<RealtimeStatus, string> = {
  scheduled: 'Scheduled',
  onTime: 'Live, on time',
  early: 'Live, early',
  late: 'Live, late',
}
