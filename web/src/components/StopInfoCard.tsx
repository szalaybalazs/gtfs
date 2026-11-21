import { CATEGORIES, categoryOf } from '../lib/categories'
import CategoryIcon from './CategoryIcon'
import type { RouteRef } from '../lib/api'
import { useT } from '../lib/i18n'
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
  compact,
}: {
  id?: string | null
  name: string
  headsigns?: string[]
  routes: RouteRef[]
  note?: string
  /** Many lines (a whole stop group): show the kinds of transport as pictograms instead of every badge */
  compact?: boolean
}) {
  const t = useT()
  return (
    <section className="rounded-2xl bg-surface p-gutter">
      {id && <p className="font-mono text-[13px] font-semibold text-secondary">#{id}</p>}
      <h1 className="text-2xl leading-tight font-bold">{name}</h1>
      {headsigns && headsigns.length > 0 && (
        <p className="mt-1 text-[15px] text-secondary">
          {t.rich('common.towards', { to: <span className="font-medium text-label">{headsigns.join(' / ')}</span> })}
        </p>
      )}
      {/* A platform (headsigns given) where lines only arrive: say it's a terminus */}
      {headsigns && headsigns.length === 0 && routes.length > 0 && <p className="mt-1 text-[15px] text-secondary">{t('stop.terminus')}</p>}
      {note && <p className="mt-1 text-[13px] text-secondary">{note}</p>}
      {compact && routes.length > 0 ? (
        <div className="mt-3 flex items-center gap-1.5">
          {CATEGORIES.filter((c) => routes.some((r) => categoryOf(r).key === c.key)).map((c) => (
            <CategoryIcon key={c.key} category={c} className="h-6 w-6" />
          ))}
          <span className="ml-1 text-[15px] text-secondary">{t('stop.lineCount', { n: routes.length })}</span>
        </div>
      ) : routes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {routes.map((r) => (
            <RouteBadge key={r.routeId} route={r} />
          ))}
        </div>
      )}
    </section>
  )
}
