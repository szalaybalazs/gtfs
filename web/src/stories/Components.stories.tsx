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
