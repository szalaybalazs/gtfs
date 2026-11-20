import { Link } from 'react-router'

/**
 * Hidden developer page (/ux): every screen and how users move between them.
 * Keep in sync when adding screens or links. Example links use real ids.
 */
type Node = { id: string; label: string; sub: string; x: number; y: number; to: string }
const W = 170
const H = 56

const NODES: Node[] = [
  { id: 'menu', label: 'Side menu', sub: '☰ on top-level pages', x: 40, y: 40, to: '/' },
  { id: 'home', label: 'Home', sub: 'favourites · nearby', x: 300, y: 40, to: '/' },
  { id: 'routes', label: 'Routes', sub: 'grouped by vehicle type', x: 300, y: 160, to: '/routes' },
  { id: 'stops', label: 'All stops', sub: 'search · per direction', x: 300, y: 280, to: '/stops' },
  { id: 'nearby', label: 'Nearby', sub: 'location', x: 300, y: 400, to: '/nearby' },
  { id: 'map', label: 'Map', sub: 'stops · vehicles', x: 300, y: 520, to: '/map' },
  { id: 'settings', label: 'Settings', sub: 'theme · clear favourites', x: 40, y: 520, to: '/settings' },
  { id: 'route', label: 'Route', sub: 'stop dropdown · ⇄ · ▦/☰', x: 580, y: 160, to: '/routes/3010' },
  { id: 'group', label: 'Stop group', sub: 'badges · stops here · map', x: 580, y: 340, to: '/stations/F02600?from=F02600' },
  { id: 'stop', label: 'Stop', sub: 'departures · timetable', x: 840, y: 340, to: '/stops/F02600' },
  { id: 'trip', label: 'Trip', sub: 'LIVE · stops · vehicle', x: 840, y: 160, to: '/trips/x' },
  { id: 'fav', label: 'Favourite sheet', sub: '☆ → 3 kinds', x: 840, y: 520, to: '/stations/F02600?from=F02600' },
]

const EDGES: [string, string, string][] = [
  ['menu', 'home', ''],
  ['menu', 'routes', 'vehicle type'],
  ['menu', 'stops', ''],
  ['menu', 'nearby', ''],
  ['menu', 'map', ''],
  ['menu', 'settings', ''],
  ['home', 'route', 'favourite line'],
  ['home', 'group', 'stop / line from stop'],
  ['routes', 'route', 'tap badge'],
  ['stops', 'group', 'tap row'],
  ['nearby', 'group', 'tap row'],
  ['map', 'group', 'stop popup'],
  ['route', 'trip', 'tap departure'],
  ['route', 'stop', 'stops here'],
  ['group', 'trip', 'tap departure'],
  ['group', 'stop', 'stops here'],
  ['stop', 'trip', 'tap departure'],
  ['stop', 'route', 'tap badge'],
  ['trip', 'group', 'tap any stop'],
  ['route', 'fav', '☆'],
  ['group', 'fav', '☆'],
  ['stop', 'fav', '☆'],
]

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]))

function anchor(a: Node, b: Node) {
  // Leave from the side facing the other node
  const ax = a.x + W / 2
  const ay = a.y + H / 2
  const bx = b.x + W / 2
  const by = b.y + H / 2
  const dx = bx - ax
  const dy = by - ay
  if (Math.abs(dx) * H > Math.abs(dy) * W) return { x: ax + (Math.sign(dx) * W) / 2, y: ay + (dy * (W / 2)) / Math.abs(dx || 1) }
  return { x: ax + (dx * (H / 2)) / Math.abs(dy || 1), y: ay + (Math.sign(dy) * H) / 2 }
}

export default function UxMapPage() {
  return (
    <div className="min-h-dvh p-4">
      <h1 className="text-2xl font-bold">UX map</h1>
      <p className="mb-4 text-secondary">Screens and the ways between them. Boxes open an example of that screen.</p>
      <div className="overflow-x-auto rounded-2xl bg-surface p-2">
        <svg viewBox="0 0 1050 610" className="min-w-[900px]" role="img" aria-label="Screen flow diagram">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="var(--color-secondary)" />
            </marker>
          </defs>
          {EDGES.map(([from, to, label]) => {
            const a = anchor(byId[from], byId[to])
            const b = anchor(byId[to], byId[from])
            return (
              <g key={`${from}-${to}`}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-secondary)" strokeWidth="1.3" markerEnd="url(#arrow)" />
                {label && (
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" fontSize="11" fill="var(--color-secondary)">
                    {label}
                  </text>
                )}
              </g>
            )
          })}
          {NODES.map((n) => (
            <Link key={n.id} to={n.to}>
              <rect x={n.x} y={n.y} width={W} height={H} rx="12" fill="var(--color-canvas)" stroke="var(--color-accent)" strokeWidth="1.5" />
              <text x={n.x + W / 2} y={n.y + 24} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-label)">
                {n.label}
              </text>
              <text x={n.x + W / 2} y={n.y + 42} textAnchor="middle" fontSize="11" fill="var(--color-secondary)">
                {n.sub}
              </text>
            </Link>
          ))}
        </svg>
      </div>
    </div>
  )
}
