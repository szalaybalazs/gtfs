import { useSearchParams } from 'react-router'
import { AlertCard, splitAlerts, useAlerts, useAlertSheet } from '../components/Alerts'
import NavBar from '../components/NavBar'
import { useT } from '../lib/i18n'

/**
 * Every service change for a line / stop: what's happening now under
 * "Ongoing", then what's coming under "Planned". Opened from the
 * "N more ongoing · M planned" banner.
 */
export default function AlertsPage() {
  const t = useT()
  const [params] = useSearchParams()
  const list = (k: string) => (params.get(k) ?? '').split(',').filter(Boolean).slice(0, 60)
  const query = useAlerts(list('routes'), list('stops'))
  const { open, sheet } = useAlertSheet()
  const { ongoing, planned } = splitAlerts(query.data?.alerts ?? [])

  return (
    <div className="min-h-dvh">
      <NavBar back={{ label: t('common.back') }} title={t('alerts.title')} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isPending && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}
        {query.isSuccess && ongoing.length + planned.length === 0 && <p className="p-6 text-center text-secondary">{t('alerts.none')}</p>}
        {ongoing.length > 0 && (
          <section>
            <h2 className="flex items-baseline gap-2 px-1 pb-2 text-xl font-bold">
              {t('alerts.sectionOngoing')}
              <span className="text-[15px] font-normal text-secondary">{ongoing.length}</span>
            </h2>
            <div className="space-y-2">
              {ongoing.map((a) => (
                <AlertCard key={a.id} alert={a} onOpen={() => open(a)} />
              ))}
            </div>
          </section>
        )}
        {planned.length > 0 && (
          <section>
            <h2 className="flex items-baseline gap-2 px-1 pb-2 text-xl font-bold">
              {t('alerts.sectionPlanned')}
              <span className="text-[15px] font-normal text-secondary">{planned.length}</span>
            </h2>
            {/* Planned ones in a calmer outline style, so the two groups are clearly different */}
            <div className="space-y-2 opacity-80">
              {planned.map((a) => (
                <AlertCard key={a.id} alert={a} onOpen={() => open(a)} />
              ))}
            </div>
          </section>
        )}
      </main>
      {sheet}
    </div>
  )
}
