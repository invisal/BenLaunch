/**
 * Pure region/display geometry for window management — no Electron, no OS calls,
 * so it's usable from both the Windows and macOS control modules (and unit-testable
 * with plain `node --test`). Callers fetch a work-area rect and, where needed, the
 * window's current rect from whatever platform API they have, then hand the numbers
 * here to get back a target rect.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** A 1D position as a fraction of an axis — both in `[0, 1]`. */
export interface FractionSpan {
  start: number
  size: number
}

const FULL_SPAN: FractionSpan = { start: 0, size: 1 }

const HALF = 1 / 2
const THIRD = 1 / 3
const TWO_THIRDS = 2 / 3
const THREE_FOURTHS = 3 / 4

/**
 * A span of `size` (as a fraction of the axis) anchored at the start, the
 * end, or centered. `first`/`last` sit flush against the axis's edges;
 * `center` splits the leftover room evenly on both sides — which, for a
 * fraction that evenly divides the axis (thirds, sixths), also happens to
 * land exactly on the middle tile, so this one function covers both "center
 * third of three" and "two-thirds, centered" alike.
 */
type EdgePosition = 'first' | 'center' | 'last'
function edgeSpan(size: number, position: EdgePosition): FractionSpan {
  const start = position === 'first' ? 0 : position === 'last' ? 1 - size : (1 - size) / 2
  return { start, size }
}

/** One quarter-width tile, evenly spaced — unlike `edgeSpan`, all four are named ordinally (no "left/right"). */
type QuarterPosition = 'first' | 'second' | 'third' | 'last'
const QUARTER_INDEX: Record<QuarterPosition, number> = { first: 0, second: 1, third: 2, last: 3 }
function quarterSpan(position: QuarterPosition): FractionSpan {
  return { start: QUARTER_INDEX[position] / 4, size: 1 / 4 }
}

function spanRect(workArea: Rect, col: FractionSpan, row: FractionSpan): Rect {
  return round({
    x: workArea.x + col.start * workArea.width,
    y: workArea.y + row.start * workArea.height,
    width: col.size * workArea.width,
    height: row.size * workArea.height
  })
}

/**
 * Every region whose target rect is a fixed `{ col, row }` fraction of the
 * work area, fed straight to `spanRect` — halves, quarters, thirds/two-thirds
 * (as a column, full height), the equivalent top/bottom row fractions,
 * fourths, three-fourths, and the sixths/fourths grids (a row half crossed
 * with a column third/fourth). `SnapRegion` is derived from this table's keys
 * plus the handful of regions below that aren't a fixed fraction (`center*`,
 * `almost-maximize`, `maximize*` — they depend on `currentRect` or fill
 * everything), so every new grid region only needs one line here.
 */
const GRID_REGIONS = {
  'left-half': { col: edgeSpan(HALF, 'first'), row: FULL_SPAN },
  'right-half': { col: edgeSpan(HALF, 'last'), row: FULL_SPAN },
  'top-half': { col: FULL_SPAN, row: edgeSpan(HALF, 'first') },
  'bottom-half': { col: FULL_SPAN, row: edgeSpan(HALF, 'last') },

  'top-left': { col: edgeSpan(HALF, 'first'), row: edgeSpan(HALF, 'first') },
  'top-right': { col: edgeSpan(HALF, 'last'), row: edgeSpan(HALF, 'first') },
  'bottom-left': { col: edgeSpan(HALF, 'first'), row: edgeSpan(HALF, 'last') },
  'bottom-right': { col: edgeSpan(HALF, 'last'), row: edgeSpan(HALF, 'last') },

  'first-third': { col: edgeSpan(THIRD, 'first'), row: FULL_SPAN },
  'center-third': { col: edgeSpan(THIRD, 'center'), row: FULL_SPAN },
  'last-third': { col: edgeSpan(THIRD, 'last'), row: FULL_SPAN },
  'first-two-thirds': { col: edgeSpan(TWO_THIRDS, 'first'), row: FULL_SPAN },
  'center-two-thirds': { col: edgeSpan(TWO_THIRDS, 'center'), row: FULL_SPAN },
  'last-two-thirds': { col: edgeSpan(TWO_THIRDS, 'last'), row: FULL_SPAN },

  'first-fourth': { col: quarterSpan('first'), row: FULL_SPAN },
  'second-fourth': { col: quarterSpan('second'), row: FULL_SPAN },
  'third-fourth': { col: quarterSpan('third'), row: FULL_SPAN },
  'last-fourth': { col: quarterSpan('last'), row: FULL_SPAN },

  'first-three-fourths': { col: edgeSpan(THREE_FOURTHS, 'first'), row: FULL_SPAN },
  'center-three-fourths': { col: edgeSpan(THREE_FOURTHS, 'center'), row: FULL_SPAN },
  'last-three-fourths': { col: edgeSpan(THREE_FOURTHS, 'last'), row: FULL_SPAN },

  'top-third': { col: FULL_SPAN, row: edgeSpan(THIRD, 'first') },
  'bottom-third': { col: FULL_SPAN, row: edgeSpan(THIRD, 'last') },
  'top-two-thirds': { col: FULL_SPAN, row: edgeSpan(TWO_THIRDS, 'first') },
  'bottom-two-thirds': { col: FULL_SPAN, row: edgeSpan(TWO_THIRDS, 'last') },
  'top-three-fourths': { col: FULL_SPAN, row: edgeSpan(THREE_FOURTHS, 'first') },
  'bottom-three-fourths': { col: FULL_SPAN, row: edgeSpan(THREE_FOURTHS, 'last') },

  'top-left-sixth': { col: edgeSpan(THIRD, 'first'), row: edgeSpan(HALF, 'first') },
  'top-center-sixth': { col: edgeSpan(THIRD, 'center'), row: edgeSpan(HALF, 'first') },
  'top-right-sixth': { col: edgeSpan(THIRD, 'last'), row: edgeSpan(HALF, 'first') },
  'bottom-left-sixth': { col: edgeSpan(THIRD, 'first'), row: edgeSpan(HALF, 'last') },
  'bottom-center-sixth': { col: edgeSpan(THIRD, 'center'), row: edgeSpan(HALF, 'last') },
  'bottom-right-sixth': { col: edgeSpan(THIRD, 'last'), row: edgeSpan(HALF, 'last') },

  'top-first-fourth': { col: quarterSpan('first'), row: edgeSpan(HALF, 'first') },
  'top-second-fourth': { col: quarterSpan('second'), row: edgeSpan(HALF, 'first') },
  'top-third-fourth': { col: quarterSpan('third'), row: edgeSpan(HALF, 'first') },
  'top-last-fourth': { col: quarterSpan('last'), row: edgeSpan(HALF, 'first') },
  'bottom-first-fourth': { col: quarterSpan('first'), row: edgeSpan(HALF, 'last') },
  'bottom-second-fourth': { col: quarterSpan('second'), row: edgeSpan(HALF, 'last') },
  'bottom-third-fourth': { col: quarterSpan('third'), row: edgeSpan(HALF, 'last') },
  'bottom-last-fourth': { col: quarterSpan('last'), row: edgeSpan(HALF, 'last') },

  'top-center-two-thirds': { col: edgeSpan(TWO_THIRDS, 'center'), row: edgeSpan(HALF, 'first') },
  'bottom-center-two-thirds': { col: edgeSpan(TWO_THIRDS, 'center'), row: edgeSpan(HALF, 'last') }
} satisfies Record<string, { col: FractionSpan; row: FractionSpan }>

export type GridRegion = keyof typeof GRID_REGIONS

/**
 * Every grid region's id, in the order they're declared above — the
 * authoritative list `WindowManagementSource` builds its commands from, so a
 * new region only ever needs one line in `GRID_REGIONS` and shows up
 * everywhere (search, icon, and — since ids and titles are generated
 * together from this same list — its title) with nothing to keep in sync by
 * hand.
 */
export const GRID_REGION_IDS = Object.keys(GRID_REGIONS) as GridRegion[]

/**
 * Looks up a grid region's `{ col, row }` fraction span — exported so
 * `WindowManagementSource` can derive each command's icon from the same
 * geometry it snaps to, instead of a separately hand-maintained rect. `null`
 * for the non-fraction regions (`center*`, `almost-maximize`, `maximize*`).
 */
export function regionSpan(region: SnapRegion): { col: FractionSpan; row: FractionSpan } | null {
  return (GRID_REGIONS as Record<string, { col: FractionSpan; row: FractionSpan } | undefined>)[region] ?? null
}

/**
 * The handful of regions that aren't a fixed fraction of the work area —
 * `center`/`center-half` re-center a window, `almost-maximize` is a fixed 90%,
 * and the `maximize*` variants fill an axis while preserving the other one
 * from `currentRect`. Everything else is a `GridRegion`.
 */
type SpecialRegion = 'center' | 'center-half' | 'almost-maximize' | 'maximize' | 'maximize-width' | 'maximize-height'

/**
 * Halves, quarters, thirds/two-thirds/three-fourths/fourths (as a column,
 * full height), the equivalent top/bottom row fractions, and the
 * sixths/fourths grids (a row half crossed with a column third/fourth) —
 * ordinal naming ("First/Last Third", not "Left/Right Third" — Left/Right is
 * reserved for the halves) — plus `almost-maximize`, a 90%-size centered
 * window.
 */
export type SnapRegion = GridRegion | SpecialRegion

export type EdgeDirection = 'up' | 'down' | 'left' | 'right'

export interface LayoutInput {
  workArea: Rect
  /**
   * Current frame of the window being moved. Used by `center` (preserves size),
   * `maximize-width` (preserves height/y), and `maximize-height` (preserves
   * width/x).
   */
  currentRect?: Rect
}

/** Size `center` falls back to when no `currentRect` is known. */
const DEFAULT_CENTER_FRACTION = 0.8

/** Fraction of `workArea`'s width/height `almost-maximize` fills. */
const ALMOST_MAXIMIZE_FRACTION = 0.9

function round(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}

/** Clamps `size` to fit within `max`, preserving it unchanged if it already fits. */
function clampSize(size: number, max: number): number {
  return Math.min(size, max)
}

function centeredIn(workArea: Rect, width: number, height: number): Rect {
  const w = clampSize(width, workArea.width)
  const h = clampSize(height, workArea.height)
  return {
    x: workArea.x + (workArea.width - w) / 2,
    y: workArea.y + (workArea.height - h) / 2,
    width: w,
    height: h
  }
}

/** Clamps `pos` so a span of `size` starting there stays within `[areaStart, areaStart + areaSize]`. */
function clampPosition(pos: number, size: number, areaStart: number, areaSize: number): number {
  return Math.min(Math.max(pos, areaStart), areaStart + areaSize - size)
}

/** Computes the target rect for `region` within `input.workArea`. */
export function computeTargetRect(region: SnapRegion, input: LayoutInput): Rect {
  const { workArea, currentRect } = input
  const { x, y, width, height } = workArea

  const grid = regionSpan(region)
  if (grid) return spanRect(workArea, grid.col, grid.row)

  switch (region as SpecialRegion) {
    case 'center':
      return round(
        centeredIn(
          workArea,
          currentRect ? clampSize(currentRect.width, width) : width * DEFAULT_CENTER_FRACTION,
          currentRect ? clampSize(currentRect.height, height) : height * DEFAULT_CENTER_FRACTION
        )
      )
    case 'center-half':
      return round(centeredIn(workArea, width * HALF, height * HALF))
    case 'almost-maximize':
      return round(
        centeredIn(workArea, width * ALMOST_MAXIMIZE_FRACTION, height * ALMOST_MAXIMIZE_FRACTION)
      )
    case 'maximize':
      return round({ x, y, width, height })
    case 'maximize-width': {
      const h = currentRect ? clampSize(currentRect.height, height) : height
      const yPos = currentRect ? clampPosition(currentRect.y, h, y, height) : y
      return round({ x, y: yPos, width, height: h })
    }
    case 'maximize-height': {
      const w = currentRect ? clampSize(currentRect.width, width) : width
      const xPos = currentRect ? clampPosition(currentRect.x, w, x, width) : x
      return round({ x: xPos, y, width: w, height })
    }
    default:
      // Unreachable for a real `SnapRegion` — every member is either a `GridRegion`
      // (handled above) or one of the `SpecialRegion` cases above. Only reachable if
      // a caller building an id from a string template (`WindowManagementSource`'s
      // `gridRegion()`) passes one that doesn't match an actual `GRID_REGIONS` entry;
      // failing loudly here beats a window silently not moving.
      throw new Error(`computeTargetRect: unknown region "${region}"`)
  }
}

/**
 * Slides `currentRect` (unchanged size) until it touches `workArea`'s edge in
 * `direction` — the "Move Left/Right/Up/Down" commands, distinct from the halves:
 * these only reposition, never resize. The perpendicular axis and the size are
 * clamped into the work area too, in case the window started partly off-screen.
 */
export function computeEdgeMove(
  direction: EdgeDirection,
  workArea: Rect,
  currentRect: Rect
): Rect {
  const width = clampSize(currentRect.width, workArea.width)
  const height = clampSize(currentRect.height, workArea.height)
  let x = clampPosition(currentRect.x, width, workArea.x, workArea.width)
  let y = clampPosition(currentRect.y, height, workArea.y, workArea.height)

  switch (direction) {
    case 'left':
      x = workArea.x
      break
    case 'right':
      x = workArea.x + workArea.width - width
      break
    case 'up':
      y = workArea.y
      break
    case 'down':
      y = workArea.y + workArea.height - height
      break
  }

  return round({ x, y, width, height })
}

export interface DisplayInfo {
  id: number
  workArea: Rect
}

/**
 * The display adjacent to `currentDisplayId` in left-to-right order (by
 * `workArea.x`), wrapping around at the ends. Returns `null` if `currentDisplayId`
 * isn't found or there's only one display (nothing to move to).
 */
export function pickAdjacentDisplay(
  displays: DisplayInfo[],
  currentDisplayId: number,
  direction: 'next' | 'previous'
): DisplayInfo | null {
  if (displays.length < 2) return null
  const sorted = [...displays].sort((a, b) => a.workArea.x - b.workArea.x)
  const index = sorted.findIndex((display) => display.id === currentDisplayId)
  if (index === -1) return null
  const offset = direction === 'next' ? 1 : -1
  const target = sorted[(index + offset + sorted.length) % sorted.length]
  return target
}

/**
 * Maps `rect` from `fromWorkArea` to the equivalent position/size on `toWorkArea`,
 * preserving its position and size as fractions of the work area (so e.g. a window
 * snapped to the left half of one monitor lands on the left half of the next), and
 * clamping the result so it never spills past the destination work area.
 */
export function mapRectToDisplay(rect: Rect, fromWorkArea: Rect, toWorkArea: Rect): Rect {
  const relX = fromWorkArea.width === 0 ? 0 : (rect.x - fromWorkArea.x) / fromWorkArea.width
  const relY = fromWorkArea.height === 0 ? 0 : (rect.y - fromWorkArea.y) / fromWorkArea.height
  const relW = fromWorkArea.width === 0 ? 1 : rect.width / fromWorkArea.width
  const relH = fromWorkArea.height === 0 ? 1 : rect.height / fromWorkArea.height

  // Round width/height first so the max-x/max-y clamps below (and the final
  // assertion that x + width never exceeds the work area) use the same rounded
  // width the caller will actually receive — clamping unrounded then rounding
  // independently can push x + width one pixel past the edge.
  const width = Math.round(clampSize(relW * toWorkArea.width, toWorkArea.width))
  const height = Math.round(clampSize(relH * toWorkArea.height, toWorkArea.height))
  const maxX = toWorkArea.x + toWorkArea.width - width
  const maxY = toWorkArea.y + toWorkArea.height - height

  return {
    x: Math.round(Math.min(Math.max(toWorkArea.x + relX * toWorkArea.width, toWorkArea.x), maxX)),
    y: Math.round(Math.min(Math.max(toWorkArea.y + relY * toWorkArea.height, toWorkArea.y), maxY)),
    width,
    height
  }
}
