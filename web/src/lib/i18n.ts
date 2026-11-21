import { createElement, Fragment, useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react'

/**
 * English + Hungarian UI text. Small and hand-rolled:
 *
 *   const t = useT()
 *   t('nav.home')                       // "Home" / "Kezdőlap"
 *   t('trip.statsStops', { n: 23 })     // plural picked from {n}: "23 stops" / "23 megálló"
 *   t.rich('common.towards', { to: <b>…</b> })  // like t(), but params may be React nodes
 *
 * Keys live in `en` below; `hu` must have exactly the same keys (type-checked).
 * Data from the API (stop names, headsigns, line numbers) is never translated.
 */

export type Locale = 'en' | 'hu'
/** What the user picked in Settings; 'auto' follows the browser. */
export type LocaleSetting = 'auto' | Locale

type Plural = { one: string; other: string }
type Message = string | Plural

const en = {
  // App shell
  'app.name': 'Timetable',
  'app.city': 'Budapest',
  'nav.home': 'Home',
  'nav.routes': 'Routes',
  'nav.allStops': 'All stops',
  'nav.nearby': 'Nearby',
  'nav.map': 'Map',
  'nav.settings': 'Settings',
  'nav.mainMenu': 'Main menu',
  'nav.openMenu': 'Open menu',
  'nav.closeMenu': 'Close menu',

  // Shared
  'common.retry': 'Retry',
  'common.done': 'Done',
  'common.close': 'Close',
  'common.clear': 'Clear',
  'common.loading': 'Loading…',
  'common.back': 'Back',
  'common.favourites': 'Favourites',
  'common.map': 'Map',
  'common.stops': 'Stops',
  'common.towards': 'towards {to}',
  'common.wheelchair': 'Wheelchair accessible',
  'common.bikes': 'Bikes allowed',
  'search.placeholder': 'Search',
  'search.stops': 'Search stops',
  'search.noStopMatch': 'No stops match “{q}”.',

  // Vehicle types (keys match CATEGORIES in lib/categories.ts)
  'category.metro': 'Metro',
  'category.tram': 'Tram',
  'category.trolley': 'Trolleybus',
  'category.bus': 'Bus',
  'category.night': 'Night',
  'category.boat': 'Boat',
  'category.other': 'Other',

  // Units and relative times
  'unit.sec': 'sec',
  'unit.min': 'min',
  'unit.minAgo': 'min ago',
  'short.seconds': '{n}s',
  'short.minutes': "{n}'",
  'day.today': 'Today',
  'day.tomorrow': 'Tomorrow',
  'delay.onTime': 'on time',
  'delay.late': '{n} min late',
  'delay.early': '{n} min early',

  // Realtime status (lib/realtimeStatus.ts)
  'status.scheduled': 'Scheduled',
  'status.onTime': 'Live, on time',
  'status.early': 'Live, early',
  'status.late': 'Live, late',

  // Location (lib/useGeolocation.ts)
  'geo.unsupported': 'Location is not available in this browser',
  'geo.denied': 'Location access is not allowed',
  'geo.timeout': 'Location timed out (no GPS fix yet)',
  'geo.unavailable': 'Location unavailable',
  'geo.unavailableDetail': 'Location unavailable: {detail}',

  // Settings
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.theme.system': 'System',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.language': 'Language',
  'settings.language.auto': 'Auto',
  'settings.language.en': 'English',
  'settings.language.hu': 'Magyar',
  'settings.favourites': 'Favourites',
  'settings.favouriteCount': { one: '{n} favourite', other: '{n} favourites' },
  'settings.storedLocally': 'Stored in this browser only',
  'settings.about': 'About',
  'settings.aboutText':
    'Timetables from BKK, MÁV and Volán GTFS data, with realtime updates where available. Map data © OpenStreetMap contributors.',

  // Home
  'home.empty': 'Tap the star on a line or a stop to pin it here.',
  'home.browseLines': 'Browse lines',
  'home.lines': 'Lines',
  'home.linesFromStops': 'Lines from stops',
  'home.stops': 'Stops',
  'home.nearbyStops': 'Nearby stops',
  'home.seeAll': 'See all',

  // Time display menu
  'timeMode.label': 'Show times as',
  'timeMode.hint': 'A departure 5 minutes from now:',
  'timeMode.relative': 'Relative',
  'timeMode.absolute': 'Absolute',

  // Departures / timetable toggle
  'view.showTimetable': 'Show timetable',
  'view.showDepartures': 'Show departures',

  // Departures time picker (components/AfterFilter.tsx)
  'after.now': 'Now',
  'after.from': 'From {time}',
  'after.earlierNote': '(earlier)',
  'after.dialog': 'Departures from',
  'after.later': 'Later',
  'after.stepEarlier': 'Earlier',
  'after.plusMinutes': "+{n}'",
  'after.plusHour': '+1h',
  'after.show': 'Show',
  'after.earlier': 'Earlier',
  'after.showEarlier': 'Show earlier departures',

  // Alerts
  'alerts.today': 'today',
  'alerts.tomorrow': 'tomorrow',
  'alerts.from': 'from {when}',
  'alerts.since': 'since {when}',
  'alerts.until': 'until {when}',
  'alerts.ongoing': 'ongoing',
  'alerts.planned': 'Planned',
  'alerts.openInBrowser': 'Open in browser',
  'alerts.noDetails': 'No details.',

  // Departures list
  'departures.title': 'Departures',
  'departures.empty': 'No more departures in the next few hours.',
  'departures.loadError': "Couldn't load departures.",
  'departures.yourTrip': 'Your trip',

  // Favourites
  'fav.add': 'Add to favourites',
  'fav.saved': 'Saved',
  'fav.addShort': 'Add',
  'fav.kind.line': 'Just the line',
  'fav.kind.lineStop': 'This line from this stop',
  'fav.kind.stop': 'The whole stop',
  'fav.kind.lines': 'These lines from here',
  'fav.lineCount': { one: '{n} line', other: '{n} lines' },

  // Nearby
  'nearby.iphoneHint':
    'On iPhone, check both: Settings → Privacy & Security → Location Services → Safari Websites (While Using), and Settings → Apps → Safari → Location (Ask or Allow). Then tap Use my location.',
  'nearby.tryAgain': 'Tap Use my location to try again.',
  'nearby.finding': 'Finding your location…',
  'nearby.loadingStops': 'Loading stops…',
  'nearby.loadError': "Couldn't load stops.",
  'nearby.none': 'No stops within {n} m.',
  'nearby.using': 'Using your location',
  'nearby.off': 'Location off',
  'nearby.update': 'Update',
  'nearby.useMyLocation': 'Use my location',

  // Stop group / stop
  'stations.stopsHere': 'Stops here',
  'stations.showAll': 'Show all',
  'station.loadError': "Couldn't load this stop.",
  'station.platformsNote': '{n} stops here, usually one per direction · tap one below to narrow',
  'station.samePlatform': 'All these lines leave from the same platform',
  'station.groupNote': {
    one: '{n} stop in this group · tap one below to narrow the departures',
    other: '{n} stops in this group · tap one below to narrow the departures',
  },
  'stop.everythingAt': 'Everything at {name}',
  'stop.noLines': 'No lines stop here.',

  // Stop picker
  'picker.from': 'From',
  'picker.choose': 'Choose a stop',

  // Timetable
  'timetable.loadError': "Couldn't load the timetable.",
  'timetable.none': 'No departures today or tomorrow.',

  // Shared stops (several lines)
  'lines.title': 'Shared stops',
  'lines.pickTwo': 'Pick at least two lines on the Routes page (long-press a line).',
  'lines.loadError': "Couldn't load shared stops.",
  'lines.never': "These lines never stop at the same place, so they can't share a departures board.",
  'lines.bothStopAt': 'Both lines stop at',
  'lines.allStopAt': 'All {n} lines stop at',
  'lines.someOfLines': 'Some of the lines',
  'lines.onlySomeMeet': 'Only some of the lines meet',
  'lines.samePlatform': 'Same platform',
  'lines.differentPlatforms': 'Different platforms · {n} stops in this group',

  // Route page
  'route.nearest': 'Nearest stop to you · {d}',
  'route.terminus': 'Nothing close by, so showing the end stop · {d}',
  'route.finding': 'Finding the nearest stop…',
  'route.loadError': "Couldn't load this route.",
  'route.nearestStop': 'Nearest stop',
  'route.towards': 'Towards',
  'route.swap': 'Swap direction',
  'route.empty': 'No departures in the next 90 minutes.',

  // Routes list
  'routes.locationEnabled': 'Location enabled',
  'routes.all': 'All',
  'routes.loadError': "Couldn't load routes.",
  'routes.bestMatches': 'Best matches',
  'routes.none': 'No routes found',
  'routes.tip': 'Tip: long-press a line to pick several and see where they meet',
  'routes.remove': 'Remove {line}',
  'routes.pickOneMore': 'Pick one more',

  // Trip page
  'trip.loadError': "Couldn't load this trip.",
  'trip.gone': 'This trip no longer exists.',
  'trip.towards': 'towards',
  'trip.live': 'LIVE',
  'trip.scheduled': 'Scheduled',
  'trip.via': 'via {stops}',
  'trip.finished': 'This trip has finished.',
  'trip.startsAt': 'Starts at {time}',
  'trip.onItsWay': 'On its way',
  'trip.vehicle': 'Vehicle',
  'trip.number': 'Number {n}',
  'trip.nextStop': 'Next stop',
  'trip.positionSecs': 'Position updated {n}s ago',
  'trip.positionMins': 'Position updated {n} min ago',
  'trip.positionUnknown': 'Position time unknown',
  'trip.minutes': { one: '{n} minute', other: '{n} minutes' },
  'trip.vehicleHere': 'Vehicle is here',
  'trip.realtime': 'Realtime',
  'trip.updatedSecs': ' · updated {n}s ago',
  'trip.updatedMins': ' · updated {n} min ago',
  'trip.onTime': 'On time',
  'trip.late': '{n} min late',
  'trip.early': '{n} min early',
  'trip.statsMinutes': '{n} min',
  'trip.statsStops': { one: '{n} stop', other: '{n} stops' },

  // Map (pages/MapPage.tsx, components/MiniMap.tsx)
  'map.title': 'Map',
  'map.loadingVehicles': 'Loading vehicles…',
  'map.vehiclesInView': { one: '{n} vehicle in view', other: '{n} vehicles in view' },
  'map.showMyLocation': 'Show my location',
  'map.unknownDestination': 'Unknown destination',
  'map.openTrip': 'Open trip →',
  'map.openFullScreen': 'Open the map full screen',
  'map.tapToExplore': 'Tap to explore',
  'map.close': 'Close map',
} satisfies Record<string, Message>

export type MessageKey = keyof typeof en

const hu: Record<MessageKey, Message> = {
  'app.name': 'Menetrend',
  'app.city': 'Budapest',
  'nav.home': 'Kezdőlap',
  'nav.routes': 'Járatok',
  'nav.allStops': 'Összes megálló',
  'nav.nearby': 'Közelben',
  'nav.map': 'Térkép',
  'nav.settings': 'Beállítások',
  'nav.mainMenu': 'Főmenü',
  'nav.openMenu': 'Menü megnyitása',
  'nav.closeMenu': 'Menü bezárása',

  'common.retry': 'Újra',
  'common.done': 'Kész',
  'common.close': 'Bezárás',
  'common.clear': 'Törlés',
  'common.loading': 'Betöltés…',
  'common.back': 'Vissza',
  'common.favourites': 'Kedvencek',
  'common.map': 'Térkép',
  'common.stops': 'Megállók',
  'common.towards': '{to} felé',
  'common.wheelchair': 'Akadálymentes',
  'common.bikes': 'Kerékpár szállítható',
  'search.placeholder': 'Keresés',
  'search.stops': 'Megálló keresése',
  'search.noStopMatch': 'Nincs ilyen megálló: „{q}”.',

  'category.metro': 'Metró',
  'category.tram': 'Villamos',
  'category.trolley': 'Trolibusz',
  'category.bus': 'Busz',
  'category.night': 'Éjszakai',
  'category.boat': 'Hajó',
  'category.other': 'Egyéb',

  'unit.sec': 'mp',
  'unit.min': 'perc',
  'unit.minAgo': 'perce',
  'short.seconds': '{n} mp',
  'short.minutes': "{n}'",
  'day.today': 'Ma',
  'day.tomorrow': 'Holnap',
  'delay.onTime': 'időben',
  'delay.late': '{n} percet késik',
  'delay.early': '{n} percet siet',

  'status.scheduled': 'Menetrend szerint',
  'status.onTime': 'Élő, időben',
  'status.early': 'Élő, siet',
  'status.late': 'Élő, késik',

  'geo.unsupported': 'Ebben a böngészőben nem érhető el a helymeghatározás',
  'geo.denied': 'A helymeghatározás nincs engedélyezve',
  'geo.timeout': 'A helymeghatározás túl sokáig tartott (még nincs GPS-jel)',
  'geo.unavailable': 'A helyzeted nem érhető el',
  'geo.unavailableDetail': 'A helyzeted nem érhető el: {detail}',

  'settings.appearance': 'Megjelenés',
  'settings.theme': 'Téma',
  'settings.theme.system': 'Rendszer',
  'settings.theme.light': 'Világos',
  'settings.theme.dark': 'Sötét',
  'settings.language': 'Nyelv',
  'settings.language.auto': 'Automatikus',
  'settings.language.en': 'English',
  'settings.language.hu': 'Magyar',
  'settings.favourites': 'Kedvencek',
  'settings.favouriteCount': '{n} kedvenc',
  'settings.storedLocally': 'Csak ebben a böngészőben tárolva',
  'settings.about': 'Névjegy',
  'settings.aboutText':
    'Menetrendek a BKK, a MÁV és a Volán GTFS-adataiból, ahol elérhető, valós idejű adatokkal. Térképadatok © az OpenStreetMap közreműködői.',

  'home.empty': 'Koppints a csillagra egy járatnál vagy megállónál, és ide kerül.',
  'home.browseLines': 'Járatok böngészése',
  'home.lines': 'Járatok',
  'home.linesFromStops': 'Járatok megállókból',
  'home.stops': 'Megállók',
  'home.nearbyStops': 'Megállók a közelben',
  'home.seeAll': 'Összes',

  'timeMode.label': 'Időpontok',
  'timeMode.hint': 'Egy 5 perc múlva induló járat:',
  'timeMode.relative': 'Hátralévő idő',
  'timeMode.absolute': 'Pontos idő',

  'view.showTimetable': 'Menetrend mutatása',
  'view.showDepartures': 'Indulások mutatása',

  'after.now': 'Most',
  'after.from': '{time} után',
  'after.earlierNote': '(korábbiak is)',
  'after.dialog': 'Indulások ettől',
  'after.later': 'Később',
  'after.stepEarlier': 'Korábban',
  'after.plusMinutes': "+{n}'",
  'after.plusHour': '+1 óra',
  'after.show': 'Mutasd',
  'after.earlier': 'Korábbiak',
  'after.showEarlier': 'Korábbi indulások mutatása',

  'alerts.today': 'ma',
  'alerts.tomorrow': 'holnap',
  'alerts.from': 'kezdete: {when}',
  'alerts.since': '{when} óta',
  'alerts.until': '{when}-ig',
  'alerts.ongoing': 'visszavonásig',
  'alerts.planned': 'Tervezett',
  'alerts.openInBrowser': 'Megnyitás böngészőben',
  'alerts.noDetails': 'Nincs részletes leírás.',

  'departures.title': 'Indulások',
  'departures.empty': 'A következő órákban nincs több indulás.',
  'departures.loadError': 'Nem sikerült betölteni az indulásokat.',
  'departures.yourTrip': 'Ezzel jöttél',

  'fav.add': 'Hozzáadás a kedvencekhez',
  'fav.saved': 'Mentve',
  'fav.addShort': 'Hozzáadás',
  'fav.kind.line': 'Csak a járat',
  'fav.kind.lineStop': 'Ez a járat ebből a megállóból',
  'fav.kind.stop': 'Az egész megálló',
  'fav.kind.lines': 'Ezek a járatok innen',
  'fav.lineCount': '{n} járat',

  'nearby.iphoneHint':
    'iPhone-on ellenőrizd mindkettőt: Beállítások → Adatvédelem és biztonság → Helymeghatározás → Safari-webhelyek (Az app használata közben), valamint Beállítások → Appok → Safari → Helyzet (Kérdezzen vagy Engedélyezés). Utána koppints a Helyzetem gombra.',
  'nearby.tryAgain': 'Koppints a Helyzetem gombra az újrapróbáláshoz.',
  'nearby.finding': 'Helyzeted meghatározása…',
  'nearby.loadingStops': 'Megállók betöltése…',
  'nearby.loadError': 'Nem sikerült betölteni a megállókat.',
  'nearby.none': 'Nincs megálló {n} m-en belül.',
  'nearby.using': 'A helyzeted alapján',
  'nearby.off': 'Helymeghatározás kikapcsolva',
  'nearby.update': 'Frissítés',
  'nearby.useMyLocation': 'Helyzetem',

  'stations.stopsHere': 'Megállóhelyek itt',
  'stations.showAll': 'Összes',
  'station.loadError': 'Nem sikerült betölteni a megállót.',
  'station.platformsNote': '{n} megállóhely, általában irányonként egy · koppints egyre lent a szűkítéshez',
  'station.samePlatform': 'Ezek a járatok mind ugyanarról a megállóhelyről indulnak',
  'station.groupNote': '{n} megállóhely tartozik ide · koppints egyre lent az indulások szűkítéséhez',
  'stop.everythingAt': 'Minden járat itt: {name}',
  'stop.noLines': 'Itt nem áll meg járat.',

  'picker.from': 'Honnan',
  'picker.choose': 'Válassz megállót',

  'timetable.loadError': 'Nem sikerült betölteni a menetrendet.',
  'timetable.none': 'Ma és holnap nincs indulás.',

  'lines.title': 'Közös megállók',
  'lines.pickTwo': 'Válassz legalább két járatot a Járatok oldalon (nyomd hosszan a járatot).',
  'lines.loadError': 'Nem sikerült betölteni a közös megállókat.',
  'lines.never': 'Ezek a járatok sehol sem állnak meg ugyanott, így nincs közös indulási táblájuk.',
  'lines.bothStopAt': 'Mindkét járat megáll itt',
  'lines.allStopAt': 'Mind a(z) {n} járat megáll itt',
  'lines.someOfLines': 'Néhány járat',
  'lines.onlySomeMeet': 'Csak néhány járat találkozik',
  'lines.samePlatform': 'Közös megállóhely',
  'lines.differentPlatforms': 'Külön megállóhelyek · {n} megállóhely ebben a csoportban',

  'route.nearest': 'Legközelebbi megálló · {d}',
  'route.terminus': 'Nincs megálló a közelben, ezért a végállomás látszik · {d}',
  'route.finding': 'Legközelebbi megálló keresése…',
  'route.loadError': 'Nem sikerült betölteni a járatot.',
  'route.nearestStop': 'Legközelebbi megálló',
  'route.towards': 'Irány',
  'route.swap': 'Irányváltás',
  'route.empty': 'A következő 90 percben nincs indulás.',

  'routes.locationEnabled': 'Helymeghatározás bekapcsolva',
  'routes.all': 'Mind',
  'routes.loadError': 'Nem sikerült betölteni a járatokat.',
  'routes.bestMatches': 'Legjobb találatok',
  'routes.none': 'Nincs ilyen járat',
  'routes.tip': 'Tipp: nyomj hosszan egy járatot, válassz ki többet, és megnézheted, hol találkoznak',
  'routes.remove': '{line} eltávolítása',
  'routes.pickOneMore': 'Még egyet',

  'trip.loadError': 'Nem sikerült betölteni a járatot.',
  'trip.gone': 'Ez a járat már nem létezik.',
  'trip.towards': 'irány',
  'trip.live': 'ÉLŐ',
  'trip.scheduled': 'Menetrend szerint',
  'trip.via': 'érintve: {stops}',
  'trip.finished': 'A járat beérkezett.',
  'trip.startsAt': 'Indul: {time}',
  'trip.onItsWay': 'Úton',
  'trip.vehicle': 'Jármű',
  'trip.number': 'Rendszám: {n}',
  'trip.nextStop': 'Következő megálló:',
  'trip.positionSecs': 'Pozíció frissítve {n} mp-e',
  'trip.positionMins': 'Pozíció frissítve {n} perce',
  'trip.positionUnknown': 'A pozíció ideje ismeretlen',
  'trip.minutes': '{n} perc',
  'trip.vehicleHere': 'Itt jár a jármű',
  'trip.realtime': 'Élő adat',
  'trip.updatedSecs': ' · frissítve {n} mp-e',
  'trip.updatedMins': ' · frissítve {n} perce',
  'trip.onTime': 'Időben',
  'trip.late': '{n} percet késik',
  'trip.early': '{n} percet siet',
  'trip.statsMinutes': '{n} perc',
  'trip.statsStops': '{n} megálló',

  'map.title': 'Térkép',
  'map.loadingVehicles': 'Járművek betöltése…',
  'map.vehiclesInView': '{n} jármű látható',
  'map.showMyLocation': 'Saját helyzet mutatása',
  'map.unknownDestination': 'Ismeretlen úti cél',
  'map.openTrip': 'Járat megnyitása →',
  'map.openFullScreen': 'Térkép teljes képernyőn',
  'map.tapToExplore': 'Koppints a nagyításhoz',
  'map.close': 'Térkép bezárása',
}

const CATALOGS: Record<Locale, Record<MessageKey, Message>> = { en, hu }

// ---- Locale store (like timeMode.ts / favorites.ts) ----

const KEY = 'locale'
const listeners = new Set<() => void>()

function readSetting(): LocaleSetting {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'en' || v === 'hu' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function browserLocale(): Locale {
  try {
    return (navigator.language ?? '').toLowerCase().startsWith('hu') ? 'hu' : 'en'
  } catch {
    return 'en'
  }
}

/** The language actually shown. */
export function getLocale(): Locale {
  const s = readSetting()
  return s === 'auto' ? browserLocale() : s
}

/** BCP 47 tag for Intl / toLocale* formatting. */
export function intlLocale(locale: Locale = getLocale()) {
  return locale === 'hu' ? 'hu-HU' : 'en-GB'
}

/** Sets <html lang>; call once at startup. Also follows browser language changes in 'auto'. */
export function initLocale() {
  const apply = () => {
    document.documentElement.lang = getLocale()
  }
  apply()
  listeners.add(apply)
  window.addEventListener('languagechange', () => listeners.forEach((l) => l()))
}

export function setLocaleSetting(s: LocaleSetting) {
  try {
    if (s === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, s)
  } catch {
    // Storage blocked: nothing persists, the default (auto) stays
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLocaleSetting(): [LocaleSetting, (s: LocaleSetting) => void] {
  const setting = useSyncExternalStore(subscribe, readSetting, () => 'auto' as LocaleSetting)
  const set = useCallback((s: LocaleSetting) => setLocaleSetting(s), [])
  return [setting, set]
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => 'en' as Locale)
}

// ---- Formatting ----

type Params = Record<string, string | number>

const pluralRules = new Map<Locale, Intl.PluralRules>()
function pick(locale: Locale, msg: Message, n: number | undefined): string {
  if (typeof msg === 'string') return msg
  let rules = pluralRules.get(locale)
  if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(intlLocale(locale))))
  return rules.select(n ?? 0) === 'one' ? msg.one : msg.other
}

function raw(locale: Locale, key: MessageKey, n: number | undefined) {
  return pick(locale, CATALOGS[locale][key] ?? en[key] ?? key, n)
}

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const text = raw(locale, key, typeof params?.n === 'number' ? params.n : undefined)
  return params ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : text
}

export type TFunction = {
  (key: MessageKey, params?: Params): string
  /** Like t(), but params can be React nodes (e.g. a styled name). `count` picks the plural form. */
  rich: (key: MessageKey, params: Record<string, ReactNode>, count?: number) => ReactNode
  locale: Locale
}

function makeT(locale: Locale): TFunction {
  const t = ((key: MessageKey, params?: Params) => translate(locale, key, params)) as TFunction
  t.rich = (key, params, count) =>
    raw(locale, key, count)
      .split(/(\{\w+\})/)
      .filter((part) => part !== '')
      .map((part, i) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1]
        return createElement(Fragment, { key: i }, name && name in params ? params[name] : part)
      })
  t.locale = locale
  return t
}

/** `t(key, params?)` in the current language; re-renders when it changes. */
export function useT(): TFunction {
  const locale = useLocale()
  return useMemo(() => makeT(locale), [locale])
}

/** Locale-aware number, e.g. 12.4 → "12,4" in Hungarian. */
export function formatNumber(n: number, options?: Intl.NumberFormatOptions) {
  return n.toLocaleString(intlLocale(), options)
}
