import {
  ArrowLeftRight,
  ArrowUpDown,
  Check,
  ChevronRight,
  ClockCircle,
  Cog,
  Grid,
  Home,
  Map,
  MapPin,
  Menu,
  Navigation,
  NavigationSolid,
  Refresh,
  Rows,
  Search,
  Star,
  StarSolid,
  Train,
  Wheelchair,
  X,
} from '@mynaui/icons-react'
import type { SVGProps } from 'react'

/**
 * App icons, all from Mynaui (mynaui.com/icons) so they share one style.
 * Names stay app-level (HomeIcon, StarIcon…) so pages don't depend on the set.
 */
type P = SVGProps<SVGSVGElement>
const a = (props: P) => ({ 'aria-hidden': true as const, ...props })

export const LocationIcon = ({ filled, ...props }: P & { filled?: boolean }) =>
  filled ? <NavigationSolid {...a(props)} /> : <Navigation {...a(props)} />
export const SearchIcon = (props: P) => <Search {...a(props)} />
export const ChevronIcon = (props: P) => <ChevronRight {...a(props)} />
export const UpDownIcon = (props: P) => <ArrowUpDown {...a(props)} />
export const RefreshIcon = (props: P) => <Refresh {...a(props)} />
export const WheelchairIcon = (props: P) => <Wheelchair {...a(props)} />
export const StarIcon = ({ filled, ...props }: P & { filled?: boolean }) =>
  filled ? <StarSolid {...a(props)} /> : <Star {...a(props)} />
export const SwapIcon = (props: P) => <ArrowLeftRight {...a(props)} />
export const MenuIcon = (props: P) => <Menu {...a(props)} />
export const HomeIcon = (props: P) => <Home {...a(props)} />
export const BusIcon = (props: P) => <Train {...a(props)} />
export const PinIcon = (props: P) => <MapPin {...a(props)} />
export const MapIcon = (props: P) => <Map {...a(props)} />
export const GearIcon = (props: P) => <Cog {...a(props)} />
export const CloseIcon = (props: P) => <X {...a(props)} />
export const ListIcon = (props: P) => <Rows {...a(props)} />
export const GridIcon = (props: P) => <Grid {...a(props)} />
export const ClockIcon = (props: P) => <ClockCircle {...a(props)} />
export const CheckIcon = (props: P) => <Check {...a(props)} />

/** Realtime marker (the BKK-style signal arcs), kept as before. */
export const LiveIcon = (props: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    <path d="M5 19h.01M5 13a6 6 0 0 1 6 6M5 7a12 12 0 0 1 12 12" />
  </svg>
)
