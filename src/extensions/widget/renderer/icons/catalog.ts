import { brandIcon } from "@renderer/lib/icon";
import { BRAND_ICONS } from "./brand-icons";

/** One pickable icon. `value` is what gets stored on the Widget: an emoji, a
 *  `brand:<id>` reference, or (for uploads) a `data:` image URI. */
export interface IconEntry {
  value: string;
  /** Accessible label; also searched. */
  name: string;
  /** Extra search terms. */
  keywords?: string;
}

export interface IconCategory {
  id: string;
  label: string;
  icons: IconEntry[];
}

/** Predefined icons — plain emoji, since launcher rows already render them. */
const EMOJI_ICONS: IconEntry[] = [
  { value: "⚡", name: "Lightning", keywords: "bolt power fast energy" },
  { value: "📈", name: "Chart up", keywords: "graph growth stocks increase" },
  {
    value: "📉",
    name: "Chart down",
    keywords: "graph decline stocks decrease",
  },
  { value: "💰", name: "Money bag", keywords: "cash finance price" },
  { value: "💵", name: "Dollar", keywords: "currency cash finance" },
  { value: "🪙", name: "Coin", keywords: "crypto bitcoin currency" },
  { value: "⭐", name: "Star", keywords: "favorite github stars rating" },
  { value: "🔥", name: "Fire", keywords: "hot trending streak" },
  { value: "☀️", name: "Sun", keywords: "weather sunny day" },
  { value: "🌧️", name: "Rain", keywords: "weather cloud" },
  { value: "🌡️", name: "Thermometer", keywords: "temperature weather" },
  { value: "🕒", name: "Clock", keywords: "time hour" },
  { value: "📅", name: "Calendar", keywords: "date schedule day" },
  { value: "⏱️", name: "Stopwatch", keywords: "timer duration" },
  { value: "🔔", name: "Bell", keywords: "notification alert" },
  { value: "📬", name: "Mailbox", keywords: "email inbox mail" },
  { value: "💻", name: "Laptop", keywords: "computer dev" },
  { value: "🖥️", name: "Desktop", keywords: "computer monitor server" },
  { value: "🧠", name: "Brain", keywords: "ai memory think" },
  { value: "📦", name: "Package", keywords: "npm box delivery release" },
  { value: "🐙", name: "Octopus", keywords: "github git" },
  { value: "🐛", name: "Bug", keywords: "issue error defect" },
  { value: "🚀", name: "Rocket", keywords: "launch deploy ship" },
  { value: "🛰️", name: "Satellite", keywords: "space network" },
  { value: "🔋", name: "Battery", keywords: "power charge" },
  { value: "📶", name: "Signal", keywords: "network wifi connection" },
  { value: "🔒", name: "Lock", keywords: "security private" },
  { value: "🔑", name: "Key", keywords: "password auth token" },
  { value: "🌐", name: "Globe", keywords: "web internet world" },
  { value: "📊", name: "Bar chart", keywords: "graph stats analytics" },
  { value: "🎯", name: "Target", keywords: "goal bullseye" },
  { value: "🧪", name: "Test tube", keywords: "experiment lab test" },
];

const BRAND_ENTRIES: IconEntry[] = BRAND_ICONS.map((brand) => ({
  // A reference, not the SVG — the file is a static asset (see `lib/icon.ts`).
  value: brandIcon(brand.id),
  name: brand.name,
  keywords: brand.keywords,
}));

export const ICON_CATEGORIES: IconCategory[] = [
  { id: "emoji", label: "Emoji", icons: EMOJI_ICONS },
  { id: "brands", label: "Brands", icons: BRAND_ENTRIES },
];

/** The catalog entry for a stored icon value, if it came from the catalog. */
export function findIcon(value: string): IconEntry | undefined {
  for (const category of ICON_CATEGORIES) {
    const found = category.icons.find((entry) => entry.value === value);
    if (found) return found;
  }
  return undefined;
}
