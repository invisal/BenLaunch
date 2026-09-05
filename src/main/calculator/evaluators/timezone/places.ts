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

/**
 * A hand-curated table of major cities + common abbreviations + a handful of
 * busy airports — not an exhaustive geo dataset (that would mean bundling a
 * few thousand rows from GeoNames/OurAirports). This covers the large
 * majority of realistic "time in X" queries; extend it as gaps show up.
 */
export const PLACES: readonly PlaceEntry[] = [
  // --- North America ---
  { name: 'New York', aliases: ['nyc', 'ny', 'jfk', 'new york city'], timezone: 'America/New_York', country: 'United States' },
  { name: 'Los Angeles', aliases: ['la', 'lax'], timezone: 'America/Los_Angeles', country: 'United States' },
  { name: 'San Francisco', aliases: ['sf', 'sfo', 'bay area'], timezone: 'America/Los_Angeles', country: 'United States' },
  { name: 'Chicago', aliases: ['ord'], timezone: 'America/Chicago', country: 'United States' },
  { name: 'Seattle', aliases: ['sea'], timezone: 'America/Los_Angeles', country: 'United States' },
  { name: 'Austin', aliases: [], timezone: 'America/Chicago', country: 'United States' },
  { name: 'Dallas', aliases: ['dfw'], timezone: 'America/Chicago', country: 'United States' },
  { name: 'Houston', aliases: ['iah'], timezone: 'America/Chicago', country: 'United States' },
  { name: 'Denver', aliases: ['den'], timezone: 'America/Denver', country: 'United States' },
  { name: 'Phoenix', aliases: ['phx'], timezone: 'America/Phoenix', country: 'United States' },
  { name: 'Miami', aliases: ['mia'], timezone: 'America/New_York', country: 'United States' },
  { name: 'Boston', aliases: ['bos'], timezone: 'America/New_York', country: 'United States' },
  { name: 'Washington DC', aliases: ['dc', 'washington'], timezone: 'America/New_York', country: 'United States' },
  { name: 'Atlanta', aliases: ['atl'], timezone: 'America/New_York', country: 'United States' },
  { name: 'Portland', aliases: ['pdx'], timezone: 'America/Los_Angeles', country: 'United States' },
  { name: 'Las Vegas', aliases: ['vegas', 'las'], timezone: 'America/Los_Angeles', country: 'United States' },
  { name: 'Honolulu', aliases: ['hnl', 'hawaii'], timezone: 'Pacific/Honolulu', country: 'United States' },
  { name: 'Anchorage', aliases: ['alaska'], timezone: 'America/Anchorage', country: 'United States' },
  { name: 'Toronto', aliases: ['yyz'], timezone: 'America/Toronto', country: 'Canada' },
  { name: 'Vancouver', aliases: ['yvr'], timezone: 'America/Vancouver', country: 'Canada' },
  { name: 'Montreal', aliases: ['yul'], timezone: 'America/Toronto', country: 'Canada' },
  { name: 'Mexico City', aliases: ['cdmx', 'mexico'], timezone: 'America/Mexico_City', country: 'Mexico' },

  // --- South America ---
  { name: 'São Paulo', aliases: ['sao paulo', 'saopaulo'], timezone: 'America/Sao_Paulo', country: 'Brazil' },
  { name: 'Rio de Janeiro', aliases: ['rio'], timezone: 'America/Sao_Paulo', country: 'Brazil' },
  { name: 'Buenos Aires', aliases: ['bsas'], timezone: 'America/Argentina/Buenos_Aires', country: 'Argentina' },
  { name: 'Santiago', aliases: [], timezone: 'America/Santiago', country: 'Chile' },
  { name: 'Bogotá', aliases: ['bogota'], timezone: 'America/Bogota', country: 'Colombia' },
  { name: 'Lima', aliases: [], timezone: 'America/Lima', country: 'Peru' },

  // --- Europe ---
  { name: 'London', aliases: ['ldn', 'uk'], timezone: 'Europe/London', country: 'United Kingdom' },
  { name: 'Paris', aliases: ['cdg'], timezone: 'Europe/Paris', country: 'France' },
  { name: 'Berlin', aliases: [], timezone: 'Europe/Berlin', country: 'Germany' },
  { name: 'Munich', aliases: [], timezone: 'Europe/Berlin', country: 'Germany' },
  { name: 'Frankfurt', aliases: ['fra'], timezone: 'Europe/Berlin', country: 'Germany' },
  { name: 'Madrid', aliases: [], timezone: 'Europe/Madrid', country: 'Spain' },
  { name: 'Barcelona', aliases: ['bcn'], timezone: 'Europe/Madrid', country: 'Spain' },
  { name: 'Rome', aliases: [], timezone: 'Europe/Rome', country: 'Italy' },
  { name: 'Milan', aliases: [], timezone: 'Europe/Rome', country: 'Italy' },
  { name: 'Amsterdam', aliases: ['ams'], timezone: 'Europe/Amsterdam', country: 'Netherlands' },
  { name: 'Brussels', aliases: [], timezone: 'Europe/Brussels', country: 'Belgium' },
  { name: 'Zurich', aliases: [], timezone: 'Europe/Zurich', country: 'Switzerland' },
  { name: 'Geneva', aliases: [], timezone: 'Europe/Zurich', country: 'Switzerland' },
  { name: 'Vienna', aliases: [], timezone: 'Europe/Vienna', country: 'Austria' },
  { name: 'Dublin', aliases: [], timezone: 'Europe/Dublin', country: 'Ireland' },
  { name: 'Lisbon', aliases: [], timezone: 'Europe/Lisbon', country: 'Portugal' },
  { name: 'Stockholm', aliases: [], timezone: 'Europe/Stockholm', country: 'Sweden' },
  { name: 'Oslo', aliases: [], timezone: 'Europe/Oslo', country: 'Norway' },
  { name: 'Copenhagen', aliases: [], timezone: 'Europe/Copenhagen', country: 'Denmark' },
  { name: 'Helsinki', aliases: [], timezone: 'Europe/Helsinki', country: 'Finland' },
  { name: 'Warsaw', aliases: [], timezone: 'Europe/Warsaw', country: 'Poland' },
  { name: 'Prague', aliases: [], timezone: 'Europe/Prague', country: 'Czechia' },
  { name: 'Budapest', aliases: [], timezone: 'Europe/Budapest', country: 'Hungary' },
  { name: 'Athens', aliases: [], timezone: 'Europe/Athens', country: 'Greece' },
  { name: 'Bucharest', aliases: [], timezone: 'Europe/Bucharest', country: 'Romania' },
  { name: 'Kyiv', aliases: ['kiev'], timezone: 'Europe/Kyiv', country: 'Ukraine' },
  { name: 'Moscow', aliases: [], timezone: 'Europe/Moscow', country: 'Russia' },
  { name: 'Istanbul', aliases: [], timezone: 'Europe/Istanbul', country: 'Turkey' },

  // --- Middle East ---
  { name: 'Dubai', aliases: ['dxb', 'uae'], timezone: 'Asia/Dubai', country: 'United Arab Emirates' },
  { name: 'Abu Dhabi', aliases: [], timezone: 'Asia/Dubai', country: 'United Arab Emirates' },
  { name: 'Doha', aliases: ['qatar'], timezone: 'Asia/Qatar', country: 'Qatar' },
  { name: 'Riyadh', aliases: [], timezone: 'Asia/Riyadh', country: 'Saudi Arabia' },
  { name: 'Tel Aviv', aliases: ['telaviv'], timezone: 'Asia/Tel_Aviv', country: 'Israel' },
  { name: 'Jerusalem', aliases: [], timezone: 'Asia/Jerusalem', country: 'Israel' },

  // --- Africa ---
  { name: 'Cairo', aliases: [], timezone: 'Africa/Cairo', country: 'Egypt' },
  { name: 'Lagos', aliases: [], timezone: 'Africa/Lagos', country: 'Nigeria' },
  { name: 'Nairobi', aliases: [], timezone: 'Africa/Nairobi', country: 'Kenya' },
  { name: 'Johannesburg', aliases: ['joburg'], timezone: 'Africa/Johannesburg', country: 'South Africa' },
  { name: 'Cape Town', aliases: [], timezone: 'Africa/Johannesburg', country: 'South Africa' },
  { name: 'Casablanca', aliases: [], timezone: 'Africa/Casablanca', country: 'Morocco' },

  // --- South & Central Asia ---
  { name: 'Mumbai', aliases: ['bombay'], timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Delhi', aliases: ['new delhi'], timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Bengaluru', aliases: ['bangalore', 'blr'], timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Hyderabad', aliases: [], timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Chennai', aliases: ['madras'], timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Kolkata', aliases: ['calcutta'], timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Pune', aliases: [], timezone: 'Asia/Kolkata', country: 'India' },
  { name: 'Karachi', aliases: [], timezone: 'Asia/Karachi', country: 'Pakistan' },
  { name: 'Islamabad', aliases: [], timezone: 'Asia/Karachi', country: 'Pakistan' },
  { name: 'Dhaka', aliases: [], timezone: 'Asia/Dhaka', country: 'Bangladesh' },
  { name: 'Kathmandu', aliases: [], timezone: 'Asia/Kathmandu', country: 'Nepal' },
  { name: 'Almaty', aliases: [], timezone: 'Asia/Almaty', country: 'Kazakhstan' },
  { name: 'Tashkent', aliases: [], timezone: 'Asia/Tashkent', country: 'Uzbekistan' },

  // --- East & Southeast Asia ---
  { name: 'Tokyo', aliases: ['nrt', 'hnd'], timezone: 'Asia/Tokyo', country: 'Japan' },
  { name: 'Osaka', aliases: [], timezone: 'Asia/Tokyo', country: 'Japan' },
  { name: 'Seoul', aliases: ['icn'], timezone: 'Asia/Seoul', country: 'South Korea' },
  { name: 'Beijing', aliases: ['pek'], timezone: 'Asia/Shanghai', country: 'China' },
  { name: 'Shanghai', aliases: ['pvg'], timezone: 'Asia/Shanghai', country: 'China' },
  { name: 'Shenzhen', aliases: [], timezone: 'Asia/Shanghai', country: 'China' },
  { name: 'Guangzhou', aliases: [], timezone: 'Asia/Shanghai', country: 'China' },
  { name: 'Hong Kong', aliases: ['hkg', 'hongkong'], timezone: 'Asia/Hong_Kong', country: 'China' },
  { name: 'Taipei', aliases: ['tpe'], timezone: 'Asia/Taipei', country: 'Taiwan' },
  { name: 'Singapore', aliases: ['sin', 'sg'], timezone: 'Asia/Singapore', country: 'Singapore' },
  { name: 'Kuala Lumpur', aliases: ['kl'], timezone: 'Asia/Kuala_Lumpur', country: 'Malaysia' },
  { name: 'Bangkok', aliases: ['bkk'], timezone: 'Asia/Bangkok', country: 'Thailand' },
  { name: 'Jakarta', aliases: ['cgk'], timezone: 'Asia/Jakarta', country: 'Indonesia' },
  { name: 'Manila', aliases: ['mnl'], timezone: 'Asia/Manila', country: 'Philippines' },
  { name: 'Ho Chi Minh City', aliases: ['saigon', 'hcmc'], timezone: 'Asia/Ho_Chi_Minh', country: 'Vietnam' },
  { name: 'Hanoi', aliases: [], timezone: 'Asia/Ho_Chi_Minh', country: 'Vietnam' },

  // --- Oceania ---
  { name: 'Sydney', aliases: ['syd'], timezone: 'Australia/Sydney', country: 'Australia' },
  { name: 'Melbourne', aliases: ['mel'], timezone: 'Australia/Melbourne', country: 'Australia' },
  { name: 'Brisbane', aliases: ['bne'], timezone: 'Australia/Brisbane', country: 'Australia' },
  { name: 'Perth', aliases: ['per'], timezone: 'Australia/Perth', country: 'Australia' },
  { name: 'Auckland', aliases: ['akl'], timezone: 'Pacific/Auckland', country: 'New Zealand' },

  // --- UTC ---
  { name: 'UTC', aliases: ['gmt', 'utc'], timezone: 'UTC', country: '' },
] as const

/** Strip accents so "São Paulo" and "sao paulo" hit the same index key. */
function foldKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

const INDEX = new Map<string, PlaceEntry>()
for (const entry of PLACES) {
  for (const key of [entry.name, ...entry.aliases]) INDEX.set(foldKey(key), entry)
}

/**
 * Resolves free-text place input to a `PlaceEntry`: exact name/alias match
 * first (accent-insensitive), then a `fuzzyMatch` fallback (only applied to
 * this already-isolated substring, never to a whole query) for a partially-
 * typed name.
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

  const exact = INDEX.get(key)
  if (exact) return exact
  if (opts.fuzzy === false || key.length < 3) return null

  let best: { entry: PlaceEntry; score: number } | null = null
  for (const [indexKey, entry] of INDEX) {
    const result = fuzzyMatch(key, indexKey)
    if (result.match && (!best || result.score > best.score)) best = { entry, score: result.score }
  }
  return best?.entry ?? null
}
