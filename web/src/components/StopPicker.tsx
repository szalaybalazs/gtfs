import { useEffect, useRef, useState } from 'react'
import type { Stop } from '../lib/api'
import { useT } from '../lib/i18n'
import { score } from '../lib/search'
import { CheckIcon, SearchIcon, UpDownIcon } from './Icons'

/**
 * App-styled stop selector: a "From" row that opens a sheet listing the
 * direction's stops on the line colour, with search. Replaces a native select.
 */
export default function StopPicker({
  stops,
  value,
  color,
  onChange,
}: {
  stops: Stop[]
  value: Stop
  color: string
  onChange: (stopId: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const selectedRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (!open) return
    selectedRef.current?.scrollIntoView({ block: 'center' })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const shown = q.trim() ? stops.filter((s) => score(q, s.name ?? '') > 0) : stops

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQ('')
          setOpen(true)
        }}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left active:bg-fill"
      >
        <span className="text-secondary">{t('picker.from')}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{value.name}</span>
        <UpDownIcon className="h-4 w-4 shrink-0 text-secondary" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/30 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('picker.choose')}
            className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl bg-canvas pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 pb-2">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-separator sm:hidden" aria-hidden />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold">{t('picker.from')}</h2>
                <button type="button" onClick={() => setOpen(false)} className="text-[17px] font-medium text-accent">
                  {t('common.done')}
                </button>
              </div>
              <div className="flex h-9 items-center gap-1.5 rounded-[10px] bg-fill px-2 text-secondary">
                <SearchIcon className="h-4 w-4 shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('search.stops')}
                  className="w-full bg-transparent text-[17px] text-label outline-none placeholder:text-secondary"
                />
              </div>
            </div>
            <ol className="mx-4 mb-4 overflow-y-auto rounded-2xl bg-surface py-1">
              {shown.map((s, i) => {
                const selected = s.stopId === value.stopId
                return (
                  <li key={s.stopId} ref={selected ? selectedRef : undefined}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(s.stopId)
                        setOpen(false)
                      }}
                      className={`flex w-full items-center gap-3 pr-4 text-left active:bg-fill ${selected ? 'bg-fill' : ''}`}
                    >
                      <span className="relative flex h-11 w-10 shrink-0 justify-center" aria-hidden>
                        {!q.trim() && (
                          <span
                            className={`absolute w-1.5 ${i === 0 ? 'top-1/2' : 'top-0'} ${i === shown.length - 1 ? 'bottom-1/2' : 'bottom-0'}`}
                            style={{ backgroundColor: color }}
                          />
                        )}
                        <span className="relative h-2.5 w-2.5 self-center rounded-full border-2 bg-surface" style={{ borderColor: color }} />
                      </span>
                      <span className={`min-w-0 flex-1 truncate text-[17px] ${selected ? 'font-semibold' : ''}`}>{s.name ?? s.stopId}</span>
                      {selected && <CheckIcon className="h-5 w-5 shrink-0 text-accent" />}
                    </button>
                  </li>
                )
              })}
              {shown.length === 0 && <li className="p-6 text-center text-secondary">{t('search.noStopMatch', { q })}</li>}
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
