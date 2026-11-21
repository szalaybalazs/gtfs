/**
 * BKK's alert links point at bkk.hu (cookie banner, heavy page). The same
 * notice lives on the lightweight mobile BKK Info site, which has no banner:
 *   https://bkk.hu/bkk-info#!t=bkkinfo&d=today&i=bkkinfo151983
 *   → https://m.bkkinfo.hu/zavarok/151983
 * Falls back to the original https link when there's no id in it.
 */
export function alertPageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const id = url.match(/bkkinfo(\d+)/)?.[1] ?? url.match(/[?&#!]i=(\d+)/)?.[1]
  if (id) return `https://m.bkkinfo.hu/zavarok/${id}`
  return /^https:\/\//.test(url) ? url : null
}
