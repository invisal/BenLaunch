import { getAllCountries, getCountryForTimezone } from 'countries-and-timezones'
import { getTimezoneOffset } from 'date-fns-tz'
import { fuzzyMatch } from '../../../search.ts'

export interface PlaceEntry {
  /** Display name, e.g. "New York". */
  name: string
  /** Extra lookup keys: abbreviations, alternate spellings, airport codes. */
  aliases: string[]
  /** IANA zone, e.g. "America/New_York". */
  timezone: string
  country: string
}

/** Strip accents so "São Paulo" and "sao paulo" hit the same index key. */
function foldKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function countryOf(timezone: string): string {
  return getCountryForTimezone(timezone)?.name ?? ''
}

/**
 * `"America/New_York"` → `"New York"`. IANA deliberately names each zone
 * after "the largest city in the region", so this alone turns the runtime's
 * own zone list into a place name for (almost) free.
 */
function displayName(timezone: string): string {
  return timezone.split('/').pop()!.replace(/_/g, ' ')
}

/**
 * A handful of zones `Intl.supportedValuesOf('timeZone')` only exposes under
 * an older/less-recognizable canonical spelling (tzdb keeps the historical
 * name as the canonical id and links the modern one to it) — confirmed by
 * checking each's `Intl.DateTimeFormat(...).resolvedOptions().timeZone`
 * against the runtime's own canonical set. The old spelling still works
 * identically as a zone id (kept below as an alias); this just picks the
 * name people actually type today as the *display* name.
 */
const RENAME: Record<string, string> = {
  'Asia/Calcutta': 'Kolkata',
  'Asia/Katmandu': 'Kathmandu',
  'Asia/Saigon': 'Ho Chi Minh City',
  'Europe/Kiev': 'Kyiv',
  'America/Godthab': 'Nuuk',
}

/** Extra searchable words layered onto an auto-generated zone entry — abbreviations, airport codes, old names, and cities a zone's own name doesn't surface. */
const ALIASES: Record<string, string[]> = {
  'Asia/Calcutta': ['calcutta'],
  'Asia/Katmandu': ['katmandu'],
  'Asia/Saigon': ['saigon', 'hcmc', 'ho chi minh'],
  'Europe/Kiev': ['kiev'],
  'America/Godthab': ['godthab'],
  'Asia/Jerusalem': ['tel aviv', 'telaviv'],
  'America/New_York': ['nyc', 'ny', 'jfk'],
  'America/Los_Angeles': ['la', 'lax'],
  'America/Chicago': ['ord'],
  'America/Denver': ['den'],
  'America/Phoenix': ['phx'],
  'Pacific/Honolulu': ['hnl', 'hawaii'],
  'America/Anchorage': ['alaska'],
  'America/Toronto': ['yyz'],
  'America/Vancouver': ['yvr'],
  'America/Mexico_City': ['cdmx', 'mexico'],
  'America/Buenos_Aires': ['bsas'],
  'Europe/London': ['ldn', 'uk'],
  'Asia/Dubai': ['dxb', 'uae'],
  'Asia/Qatar': ['doha'],
  'Asia/Hong_Kong': ['hkg'],
  'Asia/Tokyo': ['nrt', 'hnd'],
  'Asia/Seoul': ['icn'],
  'Asia/Shanghai': ['pek'],
  'Asia/Taipei': ['tpe'],
  'Asia/Singapore': ['sin', 'sg'],
  'Asia/Kuala_Lumpur': ['kl'],
  'Asia/Bangkok': ['bkk'],
  'Asia/Jakarta': ['cgk'],
  'Asia/Manila': ['mnl'],
  'Australia/Sydney': ['syd'],
  'Australia/Melbourne': ['mel'],
  'Australia/Brisbane': ['bne'],
  'Australia/Perth': ['per'],
  'Pacific/Auckland': ['akl'],
  'Europe/Paris': ['cdg'],
  'Europe/Amsterdam': ['ams'],
  'Europe/Moscow': ['msk'],
  'Asia/Vladivostok': ['vvo'],
}

/**
 * One entry per real IANA zone — `Intl.supportedValuesOf('timeZone')`, the
 * same ~418 identifiers `date-fns-tz`/`Intl.DateTimeFormat` already accept.
 * No dataset to bundle or keep in sync: this is the runtime's own ICU data,
 * so every IANA zone (including old names tzdb kept as pure aliases, like
 * `Asia/Phnom_Penh`) is resolvable by its own name for free.
 */
const BASE_PLACES: readonly PlaceEntry[] = Intl.supportedValuesOf('timeZone').map((timezone) => ({
  name: RENAME[timezone] ?? displayName(timezone),
  aliases: ALIASES[timezone] ?? [],
  timezone,
  country: countryOf(timezone),
}))

/**
 * Cities that share another city's zone — IANA only creates a new zone id
 * when a region's offset/DST rules genuinely differ, so e.g. San Francisco
 * has no zone of its own (it's `America/Los_Angeles`, same as Seattle,
 * Portland, Las Vegas, …). These can't come from `BASE_PLACES` at all; the
 * `timezone` on each must be one already present there.
 */
const EXTRA_PLACES: readonly PlaceEntry[] = (
  [
    ['San Francisco', ['sf', 'sfo', 'bay area'], 'America/Los_Angeles'],
    ['Seattle', ['sea'], 'America/Los_Angeles'],
    ['Portland', ['pdx'], 'America/Los_Angeles'],
    ['Las Vegas', ['vegas', 'las'], 'America/Los_Angeles'],
    ['Austin', [], 'America/Chicago'],
    ['Dallas', ['dfw'], 'America/Chicago'],
    ['Houston', ['iah'], 'America/Chicago'],
    ['Miami', ['mia'], 'America/New_York'],
    ['Boston', ['bos'], 'America/New_York'],
    ['Washington DC', ['dc', 'washington'], 'America/New_York'],
    ['Atlanta', ['atl'], 'America/New_York'],
    ['Montreal', ['yul'], 'America/Toronto'],
    ['Rio de Janeiro', ['rio'], 'America/Sao_Paulo'],
    ['Munich', [], 'Europe/Berlin'],
    ['Frankfurt', ['fra'], 'Europe/Berlin'],
    ['Barcelona', ['bcn'], 'Europe/Madrid'],
    ['Milan', [], 'Europe/Rome'],
    ['Geneva', [], 'Europe/Zurich'],
    ['Abu Dhabi', [], 'Asia/Dubai'],
    ['Cape Town', [], 'Africa/Johannesburg'],
    ['Mumbai', ['bombay'], 'Asia/Calcutta'],
    ['Delhi', ['new delhi'], 'Asia/Calcutta'],
    ['Bengaluru', ['bangalore', 'blr'], 'Asia/Calcutta'],
    ['Hyderabad', [], 'Asia/Calcutta'],
    ['Chennai', ['madras'], 'Asia/Calcutta'],
    ['Pune', [], 'Asia/Calcutta'],
    ['Osaka', [], 'Asia/Tokyo'],
    ['Beijing', [], 'Asia/Shanghai'],
    ['Shenzhen', [], 'Asia/Shanghai'],
    ['Guangzhou', [], 'Asia/Shanghai'],
    // Not an Area/City zone, so `Intl.supportedValuesOf` never lists it,
    // even though it's always a valid `timeZone` value.
    ['UTC', ['gmt'], 'UTC'],
  ] as const
).map(([name, aliases, timezone]) => ({
  name,
  aliases: [...aliases],
  timezone,
  country: timezone === 'UTC' ? '' : countryOf(timezone),
}))

export const PLACES: readonly PlaceEntry[] = [...BASE_PLACES, ...EXTRA_PLACES]

/**
 * Zones flagged elsewhere in this file as worth recognizing by their own
 * name — either a hand-curated abbreviation (`ALIASES`) or the target of an
 * `EXTRA_PLACES` satellite city (e.g. Rio de Janeiro pointing at São Paulo's
 * zone marks that zone as significant, even though "São Paulo" itself has no
 * abbreviation). Used only to pick a recognizable representative when
 * several zones tie on the same current offset — see `resolveCountryZones`.
 */
const WELL_KNOWN_ZONES = new Set<string>([
  ...Object.keys(ALIASES),
  ...EXTRA_PLACES.map((entry) => entry.timezone),
])

const INDEX = new Map<string, PlaceEntry>()
for (const entry of PLACES) {
  for (const key of [entry.name, ...entry.aliases]) INDEX.set(foldKey(key), entry)
}

/**
 * `BASE_PLACES` grouped by the country each zone actually belongs to
 * (`entry.country`, from `getCountryForTimezone` — the zone's own tzdb
 * attribution). This is deliberately *not* `countries-and-timezones`'
 * per-country zone list: that list is "every zone this country's territory
 * observes", which for a country whose own zone is a pure alias of a
 * neighbor's (Norway's only zone is literally `Europe/Berlin`; Cambodia's is
 * `Asia/Bangkok`) never mentions the country's *own* zone id at all —
 * `Europe/Oslo` and `Asia/Phnom_Penh` are both real, separately-listed
 * aliases that `getCountryForTimezone` correctly attributes back to Norway
 * and Cambodia respectively, even though they're not what `getCountry('NO')`
 * or `getCountry('KH')` reports. Grouping this way is what makes "time in
 * norway" say Oslo instead of Frankfurt (Berlin's own zone belongs to
 * Germany, not Norway, in this grouping).
 */
const ZONES_BY_COUNTRY = new Map<string, PlaceEntry[]>()
for (const entry of BASE_PLACES) {
  if (!entry.country) continue
  if (!ZONES_BY_COUNTRY.has(entry.country)) ZONES_BY_COUNTRY.set(entry.country, [])
  ZONES_BY_COUNTRY.get(entry.country)!.push(entry)
}

/** `BASE_PLACES` keyed by zone id — for resolving a capital-zone override to its entry. */
const ENTRY_BY_ZONE = new Map(BASE_PLACES.map((entry) => [entry.timezone, entry]))

/**
 * Countries with more than one *own* zone (per `ZONES_BY_COUNTRY` above) —
 * these genuinely split across offsets (United States, Russia, Australia, …)
 * or are a mainland + a remote territory (Portugal + the Azores, Spain + the
 * Canaries). There's no deriving a right answer, so this is a hand-picked
 * "what most people mean" zone — the capital's, almost always. Antarctica
 * (no capital) and the uninhabited US Minor Outlying Islands are left out
 * on purpose.
 */
const CAPITAL_ZONE_OVERRIDES: Record<string, string> = {
  US: 'America/New_York',
  RU: 'Europe/Moscow',
  CA: 'America/Toronto',
  BR: 'America/Sao_Paulo',
  AR: 'America/Buenos_Aires',
  MX: 'America/Mexico_City',
  AU: 'Australia/Sydney',
  KZ: 'Asia/Almaty',
  CL: 'America/Santiago',
  GL: 'America/Godthab', // Nuuk
  ID: 'Asia/Jakarta',
  ES: 'Europe/Madrid',
  PT: 'Europe/Lisbon',
  KI: 'Pacific/Tarawa',
  PF: 'Pacific/Tahiti',
  FM: 'Pacific/Ponape', // Pohnpei — capital Palikir
  CD: 'Africa/Kinshasa',
  EC: 'America/Guayaquil',
  CY: 'Asia/Nicosia',
  PS: 'Asia/Hebron',
  MN: 'Asia/Ulaanbaatar',
  MY: 'Asia/Kuala_Lumpur',
  UZ: 'Asia/Tashkent',
  CN: 'Asia/Shanghai',
  DE: 'Europe/Berlin',
  NZ: 'Pacific/Auckland',
  PG: 'Pacific/Port_Moresby',
  MH: 'Pacific/Majuro',
}

/** Common short/alternate forms of a `countries-and-timezones` country name. */
const COUNTRY_NAME_ALIASES: Record<string, string[]> = {
  'United States of America': ['united states', 'usa', 'us', 'america'],
  'United Kingdom': ['uk', 'britain', 'great britain'],
  'South Korea': ['korea'],
  'United Arab Emirates': ['uae'],
}

const COUNTRY_INDEX = new Map<string, PlaceEntry>()
for (const country of Object.values(getAllCountries())) {
  const owned = ZONES_BY_COUNTRY.get(country.name) ?? []
  const entry =
    owned.length === 1
      ? owned[0]
      : owned.length > 1
        ? ENTRY_BY_ZONE.get(CAPITAL_ZONE_OVERRIDES[country.id] ?? '')
        : undefined
  if (!entry) continue

  for (const key of [country.name, ...(COUNTRY_NAME_ALIASES[country.name] ?? [])]) {
    COUNTRY_INDEX.set(foldKey(key), entry)
  }
}

/** Country name/alias → *every* zone it owns (not just the capital) — for `resolveCountryZones`. */
const COUNTRY_ZONES_INDEX = new Map<string, { country: string; zones: PlaceEntry[] }>()
for (const country of Object.values(getAllCountries())) {
  const owned = ZONES_BY_COUNTRY.get(country.name)
  if (!owned || owned.length < 2) continue

  for (const key of [country.name, ...(COUNTRY_NAME_ALIASES[country.name] ?? [])]) {
    COUNTRY_ZONES_INDEX.set(foldKey(key), { country: country.name, zones: owned })
  }
}

export interface CountryZones {
  /** The country's display name, e.g. "United States of America". */
  country: string
  /** One entry per *distinct current offset* the country spans, west to east. */
  zones: readonly PlaceEntry[]
}

/**
 * `text` matched a country by exact name/alias (see `COUNTRY_INDEX`) that
 * genuinely spans more than one *currently distinct* UTC offset — rather
 * than silently picking the capital (what `resolvePlace` does), list every
 * one. Offsets are computed at `now` and de-duplicated by their current
 * value, not by raw zone id: the United States' 29 zone ids collapse to the
 * ~6-7 offsets actually in use right now (many, like the Indiana/Kentucky
 * county zones, already share Eastern or Central time).
 *
 * Returns `null` for a single-zone country (nothing to list), an unknown
 * country, or a multi-zone country that happens to share one offset across
 * all its zones at this particular moment — `resolvePlace`'s single-entry
 * answer covers all of those already.
 */
export function resolveCountryZones(text: string, now: Date): CountryZones | null {
  const key = foldKey(text)
  const found = COUNTRY_ZONES_INDEX.get(key)
  if (!found) return null

  const byOffset = new Map<number, PlaceEntry[]>()
  for (const entry of found.zones) {
    const offset = getTimezoneOffset(entry.timezone, now)
    if (!byOffset.has(offset)) byOffset.set(offset, [])
    byOffset.get(offset)!.push(entry)
  }
  if (byOffset.size < 2) return null

  // Same-offset zones happen a lot (the US's 29 ids resolve to ~7 offsets),
  // and picking whichever sorts first (`Adak`, `Boise`, `Detroit`) reads far
  // less recognizably than the zone people actually mean (`Anchorage`,
  // `Denver`, `New York`). Prefer whichever candidate is already flagged
  // elsewhere in this file as well-known (see `WELL_KNOWN_ZONES`) — that's
  // existing signal, not a second list to maintain.
  const distinct = [...byOffset.values()].map(
    (candidates) => candidates.find((c) => WELL_KNOWN_ZONES.has(c.timezone)) ?? candidates[0],
  )

  distinct.sort((a, b) => getTimezoneOffset(a.timezone, now) - getTimezoneOffset(b.timezone, now))
  return { country: found.country, zones: distinct }
}

/**
 * Resolves free-text place input to a `PlaceEntry`: exact name/alias match
 * first (accent-insensitive), then a country-name match (see
 * `COUNTRY_INDEX`), then a `fuzzyMatch` fallback (only applied to this
 * already-isolated substring, never to a whole query) for a partially-typed
 * name.
 *
 * The fuzzy fallback requires at least 3 characters — a 2-letter needle
 * (`ft`, `in`, `kg`, …) is trivially a subsequence of countless city names
 * (`frankfurt` contains `f`…`t`) and would otherwise turn ordinary unit
 * abbreviations into bogus place matches. Every real alias this short (`sf`,
 * `la`, `kl`) is already in the exact-match table above, so this costs
 * nothing for legitimate input.
 */
export function resolvePlace(text: string, opts: { fuzzy?: boolean } = {}): PlaceEntry | null {
  const key = foldKey(text)
  if (key.length < 2) return null

  const exact = INDEX.get(key) ?? COUNTRY_INDEX.get(key)
  if (exact) return exact
  if (opts.fuzzy === false || key.length < 3) return null

  let best: { entry: PlaceEntry; score: number } | null = null
  for (const [indexKey, entry] of [...INDEX, ...COUNTRY_INDEX]) {
    const result = fuzzyMatch(key, indexKey)
    if (result.match && (!best || result.score > best.score)) best = { entry, score: result.score }
  }
  return best?.entry ?? null
}
