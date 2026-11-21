/**
 * The title of each page in this visit's history, by its position (React
 * Router's history idx), so Back can say where it goes ("‹ Astoria").
 * Read from the page's main heading while you're on it.
 */
const titles = new Map<number, string>()

export const historyIdx = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0)
export const setPageTitle = (idx: number, title: string) => titles.set(idx, title)
export const pageTitle = (idx: number) => titles.get(idx) ?? null
