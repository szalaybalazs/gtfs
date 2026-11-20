import { useSearchParams } from 'react-router'
import { GridIcon, ListIcon } from './Icons'

export type View = 'departures' | 'timetable'

/** Departures vs timetable, kept in ?view=. */
export function useView(): [View, (v: View) => void] {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'timetable' ? 'timetable' : 'departures'
  const set = (v: View) =>
    setParams(
      (p) => {
        if (v === 'timetable') p.set('view', v)
        else p.delete('view')
        return p
      },
      { replace: true },
    )
  return [view, set]
}

/** Nav bar button: shows the icon of the view you'd switch to (grid = timetable, list = departures). */
export default function ViewToggle() {
  const [view, setView] = useView()
  const next: View = view === 'departures' ? 'timetable' : 'departures'
  return (
    <button
      type="button"
      onClick={() => setView(next)}
      aria-label={next === 'timetable' ? 'Show timetable' : 'Show departures'}
      className="rounded-md p-2 active:opacity-50"
    >
      {next === 'timetable' ? <GridIcon className="h-6 w-6" /> : <ListIcon className="h-6 w-6" />}
    </button>
  )
}
