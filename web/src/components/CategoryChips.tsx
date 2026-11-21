import { useMemo } from 'react'
import type { RouteRef } from '../lib/api'
import { CATEGORIES, categoryOf, replacesCategory } from '../lib/categories'
import { useT } from '../lib/i18n'
import CategoryIcon from './CategoryIcon'

type Key = (typeof CATEGORIES)[number]['key']

/**
 * "All · Metro · Tram · …" filter chips, one look everywhere (Routes page, a
 * stop's lines). The selected type takes its lines' own badge colour (the
 * bright BKK yellow for trams) when most of its lines share one; otherwise its
 * pictogram colour (metro: every line differs).
 */
export default function CategoryChips({
  routes,
  value,
  onChange,
  keep,
}: {
  /** The lines being filtered: which types to offer, and their colours */
  routes: RouteRef[]
  value: Key | null
  onChange: (key: Key | null) => void
  /** Always offer this type (e.g. the selected one even if empty) */
  keep?: Key | null
}) {
  const t = useT()
  const groupOf = (r: RouteRef) => replacesCategory(r) ?? categoryOf(r).key
  const colors = useMemo(() => {
    const counts = new Map<string, Map<string, number>>()
    for (const r of routes) {
      if (!r.color || replacesCategory(r)) continue
      const key = categoryOf(r).key
      const m = counts.get(key) ?? new Map<string, number>()
      m.set(r.color, (m.get(r.color) ?? 0) + 1)
      counts.set(key, m)
    }
    const out = new Map<string, string>()
    for (const [k, m] of counts) {
      const [color, n] = [...m].sort((a, b) => b[1] - a[1])[0]
      const total = [...m.values()].reduce((a, b) => a + b, 0)
      if (n / total > 0.6) out.set(k, `#${color}`)
    }
    return out
  }, [routes])
  const colorOf = (key: string) => colors.get(key) ?? CATEGORIES.find((c) => c.key === key)!.color
  const types = CATEGORIES.filter((c) => c.key === keep || routes.some((r) => groupOf(r) === c.key))

  return (
    // Wrap onto more lines rather than scrolling sideways, so every type is visible at once
    <div className="flex flex-wrap gap-2 pb-2.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium outline-none focus:outline-none ${!value ? 'bg-accent text-white' : 'bg-fill text-label'}`}
      >
        {t('routes.all')}
      </button>
      {types.map((c) => {
        const on = value === c.key
        const bg = colorOf(c.key)
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1.5 text-sm font-medium outline-none focus:outline-none ${on ? '' : 'bg-fill text-label'}`}
            style={on ? { backgroundColor: bg, color: onColor(bg) } : undefined}
          >
            <CategoryIcon category={c} className="h-5 w-5" color={on ? onColor(bg) : undefined} />
            {t(`category.${c.key}`)}
          </button>
        )
      })}
    </div>
  )
}

/** Black or white text, whichever reads better on this background colour. */
function onColor(bg: string) {
  const h = bg.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? '#000000' : '#ffffff'
}
