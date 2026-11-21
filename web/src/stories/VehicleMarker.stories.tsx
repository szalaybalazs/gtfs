import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * Selected-vehicle marker on the map: 5 candidate styles next to the plain marker,
 * on light and dark basemap colours, for a few line colours. Pick one; it then goes
 * into lib/mapIcons.ts (web) and the iOS map.
 */
const meta: Meta = { title: 'Map / Selected vehicle (variants)', parameters: { layout: 'fullscreen' } }
export default meta

type R = { label: string; bg: string; fg: string; bearing: number }
const ROUTES: R[] = [
  { label: '7', bg: '#009EE3', fg: '#fff', bearing: 45 },
  { label: '4', bg: '#FFD800', fg: '#000', bearing: 120 },
  { label: 'M2', bg: '#E41F18', fg: '#fff', bearing: 270 },
  { label: '914', bg: '#1E1E1E', fg: '#fff', bearing: 200 },
  { label: '72M', bg: '#E41F18', fg: '#fff', bearing: 0 },
]

type Variant = { key: string; name: string; note: string; style: (r: R, size: number) => { ring: string; extra?: string; scale?: number; under?: string } }

const VARIANTS: Variant[] = [
  { key: 'now', name: 'Current', note: 'Dark #111 border (what you see now)', style: () => ({ ring: 'border:2px solid #111' }) },
  { key: 'a', name: 'A · Bigger', note: 'Same marker, 1.3× and a deeper shadow; no colour change', style: () => ({ ring: 'border:2px solid #fff', scale: 1.3, extra: 'box-shadow:0 3px 10px rgb(0 0 0/.45)' }) },
  { key: 'b', name: 'B · Accent ring', note: 'White border plus a magenta ring outside it', style: () => ({ ring: 'border:2px solid #fff', extra: 'box-shadow:0 0 0 3px #b5179e,0 2px 6px rgb(0 0 0/.35)', scale: 1.1 }) },
  { key: 'c', name: 'C · Halo', note: 'A soft halo in the line’s own colour, slightly bigger', style: (r) => ({ ring: 'border:2px solid #fff', extra: `box-shadow:0 0 0 7px ${r.bg}40,0 2px 6px rgb(0 0 0/.35)`, scale: 1.15 }) },
  { key: 'd', name: 'D · Thick white', note: 'Thicker white border, bigger, like a lifted chip', style: () => ({ ring: 'border:3.5px solid #fff', extra: 'box-shadow:0 4px 12px rgb(0 0 0/.4)', scale: 1.35 }) },
  { key: 'e', name: 'E · Pin', note: 'Bigger with a small pointer under it, like a map pin', style: (r) => ({ ring: 'border:2.5px solid #fff', extra: 'box-shadow:0 3px 8px rgb(0 0 0/.4)', scale: 1.3, under: `<div style="position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${r.bg};filter:drop-shadow(0 2px 1px rgb(0 0 0/.25))"></div>` }) },
]

function marker(r: R, selected: Variant | null) {
  const size = r.label.length > 2 ? 34 : 28
  const s = selected ? selected.style(r, size) : { ring: 'border:2px solid #fff' }
  const arrow = `<div style="position:absolute;inset:-7px;transform:rotate(${r.bearing}deg)"><div style="margin:0 auto;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:7px solid ${r.bg}"></div></div>`
  return (
    `<div style="position:relative;width:${size}px;height:${size}px;transform:scale(${s.scale ?? 1})">${arrow}` +
    `<div style="position:absolute;inset:0;border-radius:50%;background:${r.bg};color:${r.fg};${s.ring};${s.extra ?? 'box-shadow:0 1px 4px rgb(0 0 0/.4)'};display:flex;align-items:center;justify-content:center;font:700 ${r.label.length > 2 ? 10 : 12}px system-ui">${r.label}</div>${s.under ?? ''}</div>`
  )
}

function Panel({ dark }: { dark: boolean }) {
  return (
    <div style={{ background: dark ? '#1d1f22' : '#efece4', color: dark ? '#eee' : '#222', padding: 20 }}>
      <p style={{ font: '600 13px system-ui', opacity: 0.7, marginBottom: 12 }}>{dark ? 'Dark map' : 'Light map'}</p>
      {VARIANTS.map((v) => (
        <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '14px 0', borderTop: `1px solid ${dark ? '#333' : '#ddd'}` }}>
          <div style={{ width: 150, flexShrink: 0 }}>
            <p style={{ font: '700 14px system-ui' }}>{v.name}</p>
            <p style={{ font: '12px system-ui', opacity: 0.7 }}>{v.note}</p>
          </div>
          {/* an unselected one first for comparison, then the selected style on each line colour */}
          <div dangerouslySetInnerHTML={{ __html: marker(ROUTES[0], null) }} />
          <span style={{ opacity: 0.3 }}>→</span>
          {ROUTES.map((r) => (
            <div key={r.label} style={{ padding: 6 }} dangerouslySetInnerHTML={{ __html: marker(r, v) }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export const Variants: StoryObj = {
  render: () => (
    <div>
      <Panel dark={false} />
      <Panel dark />
    </div>
  ),
}
