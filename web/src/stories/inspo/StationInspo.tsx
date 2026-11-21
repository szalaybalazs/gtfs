import type { Departure } from '../../lib/api'
import { fresh } from '../fixtures'
import { BackI, Card, ChevronI, ClockI, Cta, FloatingNav, Headline, HintCard, InspoPage, PASTEL, Pill, RoundButton, StarI, TopBar, minutesAway } from './kit'

/** One row per line + direction, soonest first (a smaller cousin of the app's LineBoard). */
function board(deps: Departure[]) {
  const rows = new Map<string, Departure[]>()
  for (const d of deps) {
    const k = `${d.route?.routeId}|${d.headsign}`
    rows.set(k, [...(rows.get(k) ?? []), d])
  }
  return [...rows.values()].sort((a, b) => Date.parse(a[0].departure) - Date.parse(b[0].departure))
}

/** Story-only station page after the pastel reference, on the Kelenföld board fixture. */
export default function StationInspo() {
  const f = fresh()
  const st = f.station.station!
  const rows = board(f.board.departures).slice(0, 7)
  const next = rows[0]?.[0]
  return (
    <InspoPage nav={<FloatingNav />}>
      <TopBar title="Megálló" left={<RoundButton label="Vissza"><BackI className="h-5 w-5" /></RoundButton>} right={<RoundButton label="Kedvenc"><StarI className="h-5 w-5" /></RoundButton>} />
      <Headline>{st.name}</Headline>

      <HintCard
        title={next ? `Következő: ${next.route?.shortName} ${minutesAway(next)} perc múlva` : 'Nincs közelgő indulás'}
        text={next ? `${next.headsign} felé indul, érdemes most elindulni.` : ''}
      />

      <div className="mt-5 mb-4 flex gap-2.5 overflow-x-auto pb-1">
        {st.routes.slice(0, 12).map((r, i) => (
          <span key={r.routeId} className="shrink-0 rounded-full px-1.5 py-1.5" style={{ background: [PASTEL.blue, PASTEL.pink, PASTEL.lilac, PASTEL.yellow, PASTEL.green][i % 5] }}>
            <Pill route={r} />
          </span>
        ))}
      </div>

      <div className="space-y-2.5">
        {rows.map((deps) => {
          const d = deps[0]
          return (
            <Card key={`${d.route?.routeId}${d.headsign}`} className="flex items-center gap-3 !p-3.5">
              {d.route && <Pill route={d.route} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold">{d.headsign}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] opacity-55">
                  <ClockI className="h-3.5 w-3.5" />
                  {deps.slice(1, 4).map((x) => `${minutesAway(x)} p`).join(' · ') || 'nincs több'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[26px] leading-none font-bold tabular-nums">{minutesAway(d)}</span>
                <span className="ml-1 text-[13px] opacity-55">perc</span>
              </div>
              <ChevronI className="h-4 w-4 opacity-25" />
            </Card>
          )
        })}
      </div>

      <div className="mt-6 mb-20"><Cta>Útvonal ide</Cta></div>
    </InspoPage>
  )
}
