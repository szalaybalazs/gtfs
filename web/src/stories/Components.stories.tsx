import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertCard } from '../components/Alerts'
import Departures from '../components/Departures'
import LineBoard from '../components/LineBoard'
import RouteBadge from '../components/RouteBadge'
import StationRow from '../components/StationRow'
import { fresh, STATION_ID } from './fixtures'
import { Providers } from './harness'

const meta: Meta = { title: 'Components', parameters: { layout: 'padded' } }
export default meta
type Story = StoryObj

const frame = (children: React.ReactNode) => (
  <Providers>
    <div className="bg-canvas p-gutter">{children}</div>
  </Providers>
)

export const LineBoardStory: Story = {
  name: 'LineBoard',
  render: () => {
    const { board } = fresh()
    return frame(<LineBoard departures={board.departures} stationPath={`/stations/${STATION_ID}`} />)
  },
}

export const DeparturesStory: Story = {
  name: 'Departures',
  render: () => {
    const { time } = fresh()
    return frame(<Departures departures={time.departures} show={10} />)
  },
}

export const StationRowStory: Story = {
  name: 'StationRow',
  render: () => {
    const { nearby } = fresh()
    return frame(
      <ul className="overflow-hidden rounded-2xl bg-surface">
        {nearby.stationsByRadius.slice(0, 4).map((s) => (
          <StationRow key={s.stationId} station={s} distance={180} />
        ))}
      </ul>,
    )
  },
}

export const AlertsCard: Story = {
  name: 'Alerts card',
  render: () => {
    const { alerts } = fresh()
    return frame(
      <div className="space-y-2">
        {alerts.alerts.map((a) => (
          <AlertCard key={a.id} alert={a} onOpen={() => {}} />
        ))}
      </div>,
    )
  },
}

export const RouteBadgeStory: Story = {
  name: 'RouteBadge',
  render: () => {
    const { station } = fresh()
    const routes = station.station!.routes.slice(0, 24)
    return frame(
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">{routes.map((r) => <RouteBadge key={r.routeId} route={r} />)}</div>
        <div className="flex flex-wrap gap-2">{routes.slice(0, 8).map((r) => <RouteBadge key={r.routeId} route={r} size="lg" />)}</div>
      </div>,
    )
  },
}

/**
 * Countdown edge cases on the board, one row each: seconds, half minutes, just left,
 * live marks, an hour or more away (clock time), sparse lines with fewer departures,
 * long destinations, and a chosen time with rows before it. Every value must fit its
 * column (the "fits" check below the board lists any that overflow).
 */
export const LineBoardEdgeCases: Story = {
  name: 'LineBoard · edge cases',
  // Full width with only the app's own gutter, like the real page on a phone
  parameters: { layout: 'fullscreen' },
  render: () => {
    const { board } = fresh()
    const base = board.departures[0]
    const now = Date.now()
    let n = 0
    const dep = (headsign: string, routeIdx: number, mins: number[], live: boolean[] = []) =>
      mins.map((m, i) => ({
        ...base,
        route: board.departures[routeIdx % board.departures.length].route,
        tripId: `edge-${n++}`,
        headsign,
        terminates: false,
        departure: new Date(now + m * 60_000).toISOString(),
        arrival: new Date(now + m * 60_000).toISOString(),
        realtime: !!live[i],
        departureDelay: live[i] ? 30 : null,
        arrivalDelay: null,
      }))
    const rows = [
      ...dep('Seconds, then 59 min', 0, [0.6, 59, 59.5, 59.9], [true, true, true, true]),
      ...dep('Half minutes', 3, [2.5, 2, 1.5, 1], [true, false, true, false]),
      ...dep('Just left (−4 s), live next', 6, [-0.07, 4, 12, 30], [true, true, false, false]),
      ...dep('Sparse: clock times, live', 9, [70, 130, 190, 250], [true, true, true, true]),
      ...dep('One coming only', 12, [8]),
      ...dep('Two coming, second far', 15, [45, 115]),
      ...dep('A very long destination name that has to wrap onto two lines and then get cut', 18, [3, 13, 23, 33], [true]),
    ]
    const fixedRows = [
      ...dep('Chosen time: before it', 0, [-3, -45, 5, 15]),
      ...dep('Chosen time: far before', 3, [-90, -61, 2, 80]),
    ]
    const check = (el: HTMLDivElement | null) => {
      if (!el) return
      requestAnimationFrame(() => {
        // Each value's own width against its fixed column
        const bad = [...el.querySelectorAll<HTMLElement>('[data-value]')].filter((v) => v.offsetParent !== null && v.offsetWidth > (v.closest('p') as HTMLElement).clientWidth)
        const out = el.querySelector('[data-fits]')
        if (out) out.textContent = bad.length ? `Overflow: ${bad.map((p) => p.textContent).join(', ')}` : 'All values fit their columns'
      })
    }
    return frame(
      <div ref={check} className="space-y-4">
        <LineBoard departures={rows} stationPath={`/stations/${STATION_ID}`} />
        <p className="text-[13px] font-semibold text-secondary">Counting from a chosen time (now):</p>
        <LineBoard departures={fixedRows} stationPath={`/stations/${STATION_ID}`} reference={new Date(now)} />
        <p data-fits className="text-[13px] font-semibold" />
      </div>,
    )
  },
}
