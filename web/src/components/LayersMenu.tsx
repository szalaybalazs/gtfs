import { useEffect, useRef } from 'react'
import { CATEGORIES } from '../lib/categories'
import { useT } from '../lib/i18n'
import { useMapLayers } from '../lib/mapLayers'
import CategoryIcon from './CategoryIcon'

/** The map's layers card: switches for vehicles and stops, and which lines to draw. */
export default function LayersMenu({ onClose, top }: { onClose: () => void; top: string }) {
  const t = useT()
  const [layers, set] = useMapLayers()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      // Taps outside close it (the layers button toggles it itself)
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as Element).closest?.('[aria-expanded]')) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const toggleLine = (key: (typeof CATEGORIES)[number]['key']) =>
    set({ lines: layers.lines.includes(key) ? layers.lines.filter((k) => k !== key) : [...layers.lines, key] })

  return (
    <div ref={ref} role="dialog" aria-label={t('layers.title')} className="absolute right-3 z-30 w-64 rounded-2xl bg-surface p-3 shadow-xl ring-1 ring-separator" style={{ top }}>
      <p className="px-1 pb-1 text-[13px] font-semibold text-secondary">{t('layers.title')}</p>
      <Switch label={t('layers.vehicles')} on={layers.vehicles} onChange={(v) => set({ vehicles: v })} />
      <Switch label={t('layers.stops')} on={layers.stops} onChange={(v) => set({ stops: v })} />
      <p className="px-1 pt-3 pb-1.5 text-[13px] font-semibold text-secondary">{t('layers.lines')}</p>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.filter((c) => c.key !== 'other').map((c) => {
          const on = layers.lines.includes(c.key)
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggleLine(c.key)}
              className={`flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1.5 text-[13px] font-medium ${on ? 'bg-fill text-accent ring-1 ring-accent' : 'bg-fill'}`}
            >
              <CategoryIcon category={c} className="h-5 w-5" />
              {t(`category.${c.key}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-[15px] active:bg-fill">
      {label}
      <span className={`relative h-6 w-10 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-fill'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
