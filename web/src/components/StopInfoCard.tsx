import type { RouteRef } from '../lib/api'
import RouteBadge from './RouteBadge'

/**
 * Header card for a stop or stop group: ID, name, direction, lines.
 * Direction matters most for telling platforms apart, so it gets its own line.
 */
export default function StopInfoCard({
  id,
  name,
  headsigns,
  routes,
  note,
}: {
  id?: string | null
  name: string
  headsigns?: string[]
  routes: RouteRef[]
  note?: string
}) {
  return (
    <section className="rounded-2xl bg-surface p-4">
      {id && <p className="font-mono text-[13px] font-semibold text-secondary">#{id}</p>}
      <h1 className="text-2xl leading-tight font-bold">{name}</h1>
      {headsigns && headsigns.length > 0 && (
        <p className="mt-1 text-[15px]">
          <span className="text-secondary">towards </span>
          <span className="font-medium">{headsigns.join(' / ')}</span>
        </p>
      )}
      {note && <p className="mt-1 text-[13px] text-secondary">{note}</p>}
      {routes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {routes.map((r) => (
            <RouteBadge key={r.routeId} route={r} />
          ))}
        </div>
      )}
    </section>
  )
}
