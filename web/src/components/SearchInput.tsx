import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { SearchIcon } from './Icons'

/**
 * Search box that owns its text while you type and reports it afterwards.
 *
 * Feeding the value straight from the URL made Android keyboards (Gboard)
 * misbehave: the URL updates a tick later, React wrote the older value back
 * mid-composition, and autocorrect/suggestions got appended instead of
 * replacing the word. Here the field's own state is the source of truth; the
 * parent only gets the text (debounced), and outside changes are applied only
 * when the field isn't focused.
 */
export default function SearchInput({
  value,
  onChange,
  placeholder,
  delay = 150,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  delay?: number
}) {
  const t = useT()
  const [text, setText] = useState(value)
  const focused = useRef(false)
  const latest = useRef(onChange)
  latest.current = onChange

  // Outside changes (back/forward, clear) only when not typing
  useEffect(() => {
    if (!focused.current) setText(value)
  }, [value])

  // Report after a short pause, not on every keystroke
  useEffect(() => {
    if (text === value) return
    const id = setTimeout(() => latest.current(text), delay)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delay])

  return (
    <div className="flex h-9 items-center gap-1.5 rounded-[10px] bg-fill px-2 text-secondary">
      <SearchIcon className="h-4 w-4 shrink-0" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
          if (text !== value) latest.current(text)
        }}
        placeholder={placeholder ?? t('search.placeholder')}
        autoComplete="off"
        className="w-full bg-transparent text-[17px] text-label outline-none placeholder:text-secondary"
      />
    </div>
  )
}
