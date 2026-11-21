import type { ReactNode } from 'react'
import type { Departure, RouteRef } from '../../lib/api'
import { hex } from '../../lib/geo'

/** Story-only design kit: soft pastels, big type, white rounded cards, a floating dark nav. Not used by the app. */

export const PASTEL = {
  bg: '#eef4fb',
  blue: '#cfe8fb',
  pink: '#fbd5d3',
  lilac: '#e0d6fb',
  yellow: '#fbf1b3',
  green: '#d3f3c4',
  ink: '#16181d',
} as const

type IconProps = { className?: string }
const svg = (d: ReactNode) =>
  function Icon({ className = 'h-6 w-6' }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
        {d}
      </svg>
    )
  }
export const PinI = svg(<><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>)
export const StarI = svg(<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />)
export const MapI = svg(<><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" /><path d="M9 4v14M15 6v14" /></>)
export const BusI = svg(<><rect x="4" y="3.5" width="16" height="13" rx="3" /><path d="M4 11h16M7 19.5v-3M17 19.5v-3" /><circle cx="8" cy="14" r=".6" fill="currentColor" /><circle cx="16" cy="14" r=".6" fill="currentColor" /></>)
export const HomeI = svg(<path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-5.5H9V20H4.5a.5.5 0 0 1-.5-.5V11Z" />)
export const SearchI = svg(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>)
export const UserI = svg(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>)
export const SparkI = svg(<><path d="M10 4v5M7.5 6.5h5M16 11l.9 2.6L19.5 14.5l-2.6.9L16 18l-.9-2.6-2.6-.9 2.6-.9L16 11ZM6 13l.6 1.7 1.7.6-1.7.6L6 17.6l-.6-1.7-1.7-.6 1.7-.6L6 13Z" /></>)
export const ChevronI = svg(<path d="m9 6 6 6-6 6" />)
export const BackI = svg(<path d="m15 6-6 6 6 6" />)
export const ClockI = svg(<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>)

/** Phone-sized pastel page; scrolls, leaves room for the floating nav. */
export function InspoPage({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  return (
    <div className="relative min-h-dvh font-sans" style={{ background: PASTEL.bg, color: PASTEL.ink }}>
      <div className="px-5 pt-14 pb-32">{children}</div>
      {nav}
    </div>
  )
}

export function RoundButton({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button type="button" aria-label={label} className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/60 active:scale-95">
      {children}
    </button>
  )
}

export function TopBar({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="w-11">{left}</div>
      <span className="text-[19px] font-medium">{title}</span>
      <div className="w-11">{right}</div>
    </div>
  )
}

export function Headline({ children }: { children: ReactNode }) {
  return <h1 className="mb-6 text-[40px] leading-[1.05] font-extrabold tracking-tight">{children}</h1>
}

/** 2x2 grid tile: tinted, white rounded icon square top-left, bold label bottom-left. */
export function Tile({ tint, icon, label, hint }: { tint: string; icon: ReactNode; label: string; hint?: string }) {
  return (
    <button type="button" className="flex aspect-[1/0.95] flex-col justify-between rounded-3xl p-4 text-left active:scale-[0.98]" style={{ background: tint }}>
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm">{icon}</span>
      <span>
        <span className="block text-[19px] leading-tight font-bold">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] opacity-60">{hint}</span>}
      </span>
    </button>
  )
}

export function Chip({ tint, children }: { tint: string; children: ReactNode }) {
  return (
    <span className="inline-flex h-12 items-center justify-center rounded-full px-5 text-[16px] font-medium" style={{ background: tint }}>
      {children}
    </span>
  )
}

/** Soft AI-style hint: sparkle, one-line title, quiet second line. */
export function HintCard({ tint = PASTEL.green, title, text }: { tint?: string; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-3xl p-4" style={{ background: tint }}>
      <SparkI className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-[16px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[15px] opacity-60">{text}</p>
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white p-3 shadow-[0_1px_0_rgb(0_0_0/0.03)] ${className}`}>{children}</div>
}

export function Pill({ route }: { route: Pick<RouteRef, 'shortName' | 'routeId' | 'color' | 'textColor'> }) {
  return (
    <span
      className="grid h-10 min-w-12 place-items-center rounded-xl px-2 text-[16px] font-bold"
      style={{ background: hex(route.color, '#000'), color: hex(route.textColor, '#fff') }}
    >
      {route.shortName ?? route.routeId}
    </span>
  )
}

/** Floating dark pill: active "Home" pill + round icon buttons. */
export function FloatingNav({ active = 'Kezdőlap' }: { active?: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center">
      <nav className="pointer-events-auto flex items-center gap-2 rounded-full p-2" style={{ background: 'transparent' }}>
        <span className="flex h-14 items-center gap-2 rounded-full px-6 text-[17px] font-medium text-white shadow-lg" style={{ background: PASTEL.ink }}>
          <HomeI className="h-6 w-6" />
          {active}
        </span>
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[#dde3f4] shadow-md"><SearchI /></span>
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[#dde3f4] shadow-md"><UserI /></span>
      </nav>
    </div>
  )
}

export function Cta({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="flex h-14 w-full items-center justify-center gap-2 rounded-full text-[17px] font-medium text-white shadow-lg active:scale-[0.99]" style={{ background: PASTEL.ink }}>
      {children}
    </button>
  )
}

/** "N min" from now for a departure. */
export const minutesAway = (d: Pick<Departure, 'departure'>) => Math.max(0, Math.round((Date.parse(d.departure) - Date.now()) / 60_000))
