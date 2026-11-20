import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { Resource } from "sst";

/**
 * BKK service alerts (works, diversions, replacement buses…) from the
 * GTFS-realtime Alerts feed. Kept in memory, refreshed every 5 minutes.
 */
const URL = "https://go.bkk.hu/api/query/v1/ws/gtfs-rt/full/Alerts.pb";
const TTL_MS = 5 * 60_000;

export type Alert = {
  id: string;
  header: Record<string, string>;
  description: Record<string, string>;
  url: string | null;
  start: number | null; // unix seconds
  end: number | null;
  effect: string | null;
  routeIds: string[];
  stopIds: string[];
};

let cache: Alert[] = [];
let fetchedAt = 0;
let inflight: Promise<void> | undefined;

/** HTML description -> plain text with paragraph breaks (the app renders text, not HTML) */
const toText = (html: string) =>
  html
    .replace(/<\s*(br|\/p|\/li|\/div)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

const translations = (t: any, text = false) =>
  Object.fromEntries(
    (t?.translation ?? []).map((x: any) => [x.language || "hu", text ? toText(x.text ?? "") : (x.text ?? "").trim()])
  );

const refresh = async () => {
  const res = await fetch(`${URL}?key=${Resource.BkkApiKey.value}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Alerts: HTTP ${res.status}`);
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.toObject(
    GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(await res.arrayBuffer())),
    { enums: String, longs: Number, arrays: true }
  ) as any;
  cache = feed.entity
    .filter((e: any) => e.alert)
    .map((e: any): Alert => {
      const a = e.alert;
      const periods = a.activePeriod ?? [];
      const urls = translations(a.url);
      return {
        id: e.id,
        header: translations(a.headerText),
        description: translations(a.descriptionText, true),
        url: urls.en ?? urls.hu ?? Object.values(urls)[0] ?? null,
        start: periods.length ? Math.min(...periods.map((p: any) => p.start ?? 0)) || null : null,
        end: periods.length ? Math.max(...periods.map((p: any) => p.end ?? 0)) || null : null,
        effect: a.effect ?? null,
        routeIds: [...new Set<string>((a.informedEntity ?? []).map((i: any) => i.routeId).filter(Boolean))],
        stopIds: [...new Set<string>((a.informedEntity ?? []).map((i: any) => i.stopId).filter(Boolean))],
      };
    });
  fetchedAt = Date.now();
};

export const getAlerts = async (): Promise<Alert[]> => {
  if (Date.now() - fetchedAt > TTL_MS) {
    inflight ??= refresh()
      .catch((err) => {
        console.error("Alerts refresh failed", err);
        // Back off: retry in a minute instead of on every request while BKK is down
        fetchedAt = Date.now() - TTL_MS + 60_000;
      })
      .finally(() => (inflight = undefined));
    await inflight;
  }
  return cache;
};
