import type { RouteSummary } from '../lib/api'

const hex = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback
  return value.startsWith('#') ? value : `#${value}`
}

export default function RouteBadge({
  route,
  size = 'sm',
}: {
  route: Pick<RouteSummary, 'shortName' | 'routeId' | 'color' | 'textColor'>
  size?: 'sm' | 'lg'
}) {
  return (
    <span
      className={
        size === 'lg'
          ? 'inline-flex min-w-11 items-center justify-center rounded-[10px] px-2.5 py-1 text-lg font-bold'
          : 'inline-flex min-w-9 items-center justify-center rounded-lg px-1.5 py-[3px] text-[13px] font-semibold'
      }
      style={{
        backgroundColor: hex(route.color, '#000000'),
        color: hex(route.textColor, '#ffffff'),
      }}
    >
      {route.shortName ?? route.routeId}
    </span>
  )
}
