import { fresh } from '../fixtures'
import { BackI, BusI, Card, Chip, ChevronI, FloatingNav, Headline, HintCard, InspoPage, MapI, PASTEL, PinI, Pill, RoundButton, StarI, Tile, TopBar } from './kit'

/** Story-only Home, after the pastel reference. Uses fixture data (Kelenföld, nearby stops). */
export default function HomeInspo() {
  const { nearby } = fresh()
  const stations = nearby.stationsByRadius.filter((s) => s.routes.length > 0).slice(0, 3)
  return (
    <InspoPage nav={<FloatingNav />}>
      <TopBar title="Menetrend" left={<RoundButton label="Vissza"><BackI className="h-5 w-5" /></RoundButton>} right={<RoundButton label="Beállítások"><StarI className="h-5 w-5" /></RoundButton>} />
      <Headline>Szia, hová<br />utazunk ma?</Headline>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Tile tint={PASTEL.blue} icon={<PinI className="h-6 w-6" />} label="Közeli megállók" hint="500 m-en belül" />
        <Tile tint={PASTEL.pink} icon={<StarI className="h-6 w-6" />} label="Kedvencek" hint="3 mentve" />
        <Tile tint={PASTEL.lilac} icon={<MapI className="h-6 w-6" />} label="Térkép" />
        <Tile tint={PASTEL.yellow} icon={<BusI className="h-6 w-6" />} label="Járatok" hint="metró, villamos, busz" />
      </div>

      <HintCard title="Okos javaslat" text="A 4-es metró most késik Kelenföld felé, érdemes korábban indulni." />

      <div className="mt-6 mb-3 flex items-baseline justify-between">
        <h2 className="text-[22px] font-bold">Közeli megállók</h2>
        <span className="text-[15px] opacity-60">Mind</span>
      </div>
      <div className="space-y-2.5">
        {stations.map((s) => (
          <Card key={s.stationId} className="flex items-center gap-3 !p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold">{s.name}</p>
              <div className="mt-2 flex gap-1.5 overflow-hidden">
                {s.routes.slice(0, 4).map((r) => <Pill key={r.routeId} route={r} />)}
              </div>
            </div>
            <ChevronI className="h-5 w-5 opacity-30" />
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Chip tint={PASTEL.green}>Gyors út</Chip>
        <Chip tint={PASTEL.lilac}>Éjszakai</Chip>
        <Chip tint={PASTEL.blue}>Akadálymentes</Chip>
        <Chip tint="#fcd9c3">Kedvenc vonalak</Chip>
      </div>
    </InspoPage>
  )
}
