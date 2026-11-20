import type { Stop } from '../lib/api'
import { ChevronIcon } from './Icons'

/** Stops of one direction drawn on a coloured line. Tapping a stop selects it. */
export default function StopLine({
  stops,
  selectedId,
  closestId,
  color,
  onSelect,
}: {
  stops: Stop[]
  selectedId?: string
  closestId?: string
  color: string
  onSelect: (stopId: string) => void
}) {
  return (
    <ol className="overflow-hidden rounded-2xl bg-surface py-2">
      {stops.map((stop, i) => {
        const selected = stop.stopId === selectedId
        return (
          <li key={stop.stopId}>
            <button
              type="button"
              onClick={() => onSelect(stop.stopId)}
              aria-current={selected ? 'true' : undefined}
              className={`flex w-full items-center gap-3 pr-4 text-left active:bg-fill ${selected ? 'bg-fill' : ''}`}
            >
              <span className="relative flex h-11 w-12 shrink-0 justify-center" aria-hidden>
                <span
                  className={`absolute w-2 ${i === 0 ? 'top-1/2' : 'top-0'} ${i === stops.length - 1 ? 'bottom-1/2' : 'bottom-0'}`}
                  style={{ backgroundColor: color }}
                />
                <span
                  className={`relative self-center rounded-full border-2 bg-surface ${selected ? 'h-4 w-4' : 'h-2.5 w-2.5'}`}
                  style={{ borderColor: selected ? 'var(--color-label)' : color }}
                />
              </span>
              <span className={`min-w-0 flex-1 truncate text-[17px] ${selected ? 'font-semibold' : ''}`}>
                {stop.name ?? stop.stopId}
              </span>
              {stop.stopId === closestId && <span className="text-xs font-medium text-accent">Nearest</span>}
              <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
            </button>
          </li>
        )
      })}
    </ol>
  )
}
