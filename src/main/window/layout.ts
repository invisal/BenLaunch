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

/**
 * The Raycast-documented set (https://www.raycast.com/core-features/window-management),
 * including its naming ("First/Last Third", not "Left/Right Third" — Raycast reserves
 * Left/Right for the halves) — plus `almost-maximize`, a useful extra Raycast's own app
 * also ships (a 90%-size centered window) that just isn't called out on that page.
 */
export type SnapRegion =
  | 'left-half'
  | 'right-half'
  | 'top-half'
  | 'bottom-half'
  | 'center-half'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'first-third'
  | 'center-third'
  | 'last-third'
  | 'first-two-thirds'
  | 'last-two-thirds'
  | 'center'
  | 'almost-maximize'
  | 'maximize'
  | 'maximize-width'
  | 'maximize-height'

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
  const halfW = width / 2
  const halfH = height / 2
  const thirdW = width / 3
  const twoThirdsW = (width * 2) / 3

  switch (region) {
    case 'left-half':
      return round({ x, y, width: halfW, height })
    case 'right-half':
      return round({ x: x + halfW, y, width: width - halfW, height })
    case 'top-half':
      return round({ x, y, width, height: halfH })
    case 'bottom-half':
      return round({ x, y: y + halfH, width, height: height - halfH })
    case 'top-left':
      return round({ x, y, width: halfW, height: halfH })
    case 'top-right':
      return round({ x: x + halfW, y, width: width - halfW, height: halfH })
    case 'bottom-left':
      return round({ x, y: y + halfH, width: halfW, height: height - halfH })
    case 'bottom-right':
      return round({ x: x + halfW, y: y + halfH, width: width - halfW, height: height - halfH })
    case 'first-third':
      return round({ x, y, width: thirdW, height })
    case 'center-third':
      return round({ x: x + thirdW, y, width: thirdW, height })
    case 'last-third':
      return round({ x: x + twoThirdsW, y, width: width - twoThirdsW, height })
    case 'first-two-thirds':
      return round({ x, y, width: twoThirdsW, height })
    case 'last-two-thirds':
      return round({ x: x + thirdW, y, width: width - thirdW, height })
    case 'center':
      return round(
        centeredIn(
          workArea,
          currentRect ? clampSize(currentRect.width, width) : width * DEFAULT_CENTER_FRACTION,
          currentRect ? clampSize(currentRect.height, height) : height * DEFAULT_CENTER_FRACTION
        )
      )
    case 'center-half':
      return round(centeredIn(workArea, halfW, halfH))
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
