import { useT } from '../lib/i18n'
import { formatTime } from '../lib/time'
import { useTimeMode } from '../lib/timeMode'
import { useNow } from '../lib/useTimetable'
import { ClockIcon } from './Icons'
import Menu from './Menu'

/** Clock button: relative vs absolute times, each explained with "a departure 5 minutes from now". */
export default function TimeModeMenu() {
  const t = useT()
  const [mode, setMode] = useTimeMode()
  const now = useNow(30_000)
  const inFive = formatTime(new Date(now.getTime() + 5 * 60_000))
  return (
    <Menu
      icon={<ClockIcon className="h-6 w-6" />}
      label={t('timeMode.label')}
      hint={t('timeMode.hint')}
      value={mode}
      onChange={setMode}
      options={[
        { value: 'relative', title: t('timeMode.relative'), example: t('short.minutes', { n: 5 }) },
        { value: 'absolute', title: t('timeMode.absolute'), example: inFive },
      ]}
    />
  )
}
