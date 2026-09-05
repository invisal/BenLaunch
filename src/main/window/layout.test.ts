import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeEdgeMove,
  computeTargetRect,
  GRID_REGION_IDS,
  mapRectToDisplay,
  pickAdjacentDisplay,
  regionSpan,
  type Rect,
  type SnapRegion,
} from "./layout.ts";

test("GRID_REGION_IDS has no duplicates", () => {
  assert.equal(new Set(GRID_REGION_IDS).size, GRID_REGION_IDS.length);
});

test("GRID_REGION_IDS includes every grid region added alongside the original halves/quarters/thirds set", () => {
  const ids = new Set(GRID_REGION_IDS);
  for (const id of [
    "top-left-sixth",
    "bottom-right-sixth",
    "first-fourth",
    "last-fourth",
    "top-first-fourth",
    "bottom-last-fourth",
    "center-two-thirds",
    "top-center-two-thirds",
    "first-three-fourths",
    "top-third",
    "bottom-two-thirds",
  ] satisfies SnapRegion[]) {
    assert.ok(ids.has(id), id);
  }
});

test("regionSpan resolves every id in GRID_REGION_IDS, and only those", () => {
  for (const id of GRID_REGION_IDS) {
    assert.ok(regionSpan(id), id);
  }
  for (const id of ["center", "center-half", "almost-maximize", "maximize", "maximize-width", "maximize-height"] satisfies SnapRegion[]) {
    assert.equal(regionSpan(id), null, id);
  }
});

const WORK_AREA: Rect = { x: 0, y: 0, width: 1920, height: 1000 };

const regionCases: ReadonlyArray<{ region: SnapRegion; rect: Rect }> = [
  { region: "left-half", rect: { x: 0, y: 0, width: 960, height: 1000 } },
  { region: "right-half", rect: { x: 960, y: 0, width: 960, height: 1000 } },
  { region: "top-half", rect: { x: 0, y: 0, width: 1920, height: 500 } },
  { region: "bottom-half", rect: { x: 0, y: 500, width: 1920, height: 500 } },
  { region: "center-half", rect: { x: 480, y: 250, width: 960, height: 500 } },
  { region: "top-left", rect: { x: 0, y: 0, width: 960, height: 500 } },
  { region: "top-right", rect: { x: 960, y: 0, width: 960, height: 500 } },
  { region: "bottom-left", rect: { x: 0, y: 500, width: 960, height: 500 } },
  { region: "bottom-right", rect: { x: 960, y: 500, width: 960, height: 500 } },
  { region: "first-third", rect: { x: 0, y: 0, width: 640, height: 1000 } },
  { region: "center-third", rect: { x: 640, y: 0, width: 640, height: 1000 } },
  { region: "last-third", rect: { x: 1280, y: 0, width: 640, height: 1000 } },
  { region: "first-two-thirds", rect: { x: 0, y: 0, width: 1280, height: 1000 } },
  { region: "last-two-thirds", rect: { x: 640, y: 0, width: 1280, height: 1000 } },
  { region: "center-two-thirds", rect: { x: 320, y: 0, width: 1280, height: 1000 } },
  { region: "almost-maximize", rect: { x: 96, y: 50, width: 1728, height: 900 } },
  { region: "maximize", rect: { x: 0, y: 0, width: 1920, height: 1000 } },
  { region: "maximize-width", rect: { x: 0, y: 0, width: 1920, height: 1000 } },
  { region: "maximize-height", rect: { x: 0, y: 0, width: 1920, height: 1000 } },

  // Fourths (standalone column, full height).
  { region: "first-fourth", rect: { x: 0, y: 0, width: 480, height: 1000 } },
  { region: "second-fourth", rect: { x: 480, y: 0, width: 480, height: 1000 } },
  { region: "third-fourth", rect: { x: 960, y: 0, width: 480, height: 1000 } },
  { region: "last-fourth", rect: { x: 1440, y: 0, width: 480, height: 1000 } },

  // Three-fourths (standalone column, full height).
  { region: "first-three-fourths", rect: { x: 0, y: 0, width: 1440, height: 1000 } },
  { region: "center-three-fourths", rect: { x: 240, y: 0, width: 1440, height: 1000 } },
  { region: "last-three-fourths", rect: { x: 480, y: 0, width: 1440, height: 1000 } },

  // Row equivalents of third/two-thirds/three-fourths, anchored top/bottom.
  { region: "top-third", rect: { x: 0, y: 0, width: 1920, height: 333 } },
  { region: "bottom-third", rect: { x: 0, y: 667, width: 1920, height: 333 } },
  { region: "top-two-thirds", rect: { x: 0, y: 0, width: 1920, height: 667 } },
  { region: "bottom-two-thirds", rect: { x: 0, y: 333, width: 1920, height: 667 } },
  { region: "top-three-fourths", rect: { x: 0, y: 0, width: 1920, height: 750 } },
  { region: "bottom-three-fourths", rect: { x: 0, y: 250, width: 1920, height: 750 } },

  // Sixths: a row half crossed with a column third.
  { region: "top-left-sixth", rect: { x: 0, y: 0, width: 640, height: 500 } },
  { region: "top-center-sixth", rect: { x: 640, y: 0, width: 640, height: 500 } },
  { region: "top-right-sixth", rect: { x: 1280, y: 0, width: 640, height: 500 } },
  { region: "bottom-left-sixth", rect: { x: 0, y: 500, width: 640, height: 500 } },
  { region: "bottom-center-sixth", rect: { x: 640, y: 500, width: 640, height: 500 } },
  { region: "bottom-right-sixth", rect: { x: 1280, y: 500, width: 640, height: 500 } },

  // Fourths grid: a row half crossed with a column fourth.
  { region: "top-first-fourth", rect: { x: 0, y: 0, width: 480, height: 500 } },
  { region: "top-second-fourth", rect: { x: 480, y: 0, width: 480, height: 500 } },
  { region: "top-third-fourth", rect: { x: 960, y: 0, width: 480, height: 500 } },
  { region: "top-last-fourth", rect: { x: 1440, y: 0, width: 480, height: 500 } },
  { region: "bottom-first-fourth", rect: { x: 0, y: 500, width: 480, height: 500 } },
  { region: "bottom-second-fourth", rect: { x: 480, y: 500, width: 480, height: 500 } },
  { region: "bottom-third-fourth", rect: { x: 960, y: 500, width: 480, height: 500 } },
  { region: "bottom-last-fourth", rect: { x: 1440, y: 500, width: 480, height: 500 } },

  // Centered two-thirds, crossed with a row half.
  { region: "top-center-two-thirds", rect: { x: 320, y: 0, width: 1280, height: 500 } },
  { region: "bottom-center-two-thirds", rect: { x: 320, y: 500, width: 1280, height: 500 } },
];

for (const { region, rect } of regionCases) {
  test(`computeTargetRect(${region}) fits its share of the work area`, () => {
    assert.deepEqual(computeTargetRect(region, { workArea: WORK_AREA }), rect);
  });
}

test("computeTargetRect throws on an id that isn't a real region", () => {
  assert.throws(() => computeTargetRect("not-a-region" as SnapRegion, { workArea: WORK_AREA }));
});

test("computeTargetRect(center) preserves the window's current size", () => {
  const currentRect: Rect = { x: 500, y: 500, width: 800, height: 600 };
  assert.deepEqual(computeTargetRect("center", { workArea: WORK_AREA, currentRect }), {
    x: 560,
    y: 200,
    width: 800,
    height: 600,
  });
});

test("computeTargetRect(center) falls back to 80% size with no current rect", () => {
  const result = computeTargetRect("center", { workArea: WORK_AREA });
  assert.equal(result.width, 1536);
  assert.equal(result.height, 800);
  assert.equal(result.x, 192);
  assert.equal(result.y, 100);
});

test("computeTargetRect(center) clamps a current rect larger than the work area", () => {
  const currentRect: Rect = { x: 0, y: 0, width: 3000, height: 2000 };
  const result = computeTargetRect("center", { workArea: WORK_AREA, currentRect });
  assert.equal(result.width, WORK_AREA.width);
  assert.equal(result.height, WORK_AREA.height);
  assert.equal(result.x, 0);
  assert.equal(result.y, 0);
});

test("computeTargetRect(maximize-width) fills the width, keeping the current height/y", () => {
  const currentRect: Rect = { x: 200, y: 300, width: 400, height: 250 };
  assert.deepEqual(computeTargetRect("maximize-width", { workArea: WORK_AREA, currentRect }), {
    x: 0,
    y: 300,
    width: 1920,
    height: 250,
  });
});

test("computeTargetRect(maximize-height) fills the height, keeping the current width/x", () => {
  const currentRect: Rect = { x: 200, y: 300, width: 400, height: 250 };
  assert.deepEqual(computeTargetRect("maximize-height", { workArea: WORK_AREA, currentRect }), {
    x: 200,
    y: 0,
    width: 400,
    height: 1000,
  });
});

test("computeTargetRect(maximize-width) clamps a y that would push the window off the bottom", () => {
  const currentRect: Rect = { x: 0, y: 900, width: 400, height: 250 };
  const result = computeTargetRect("maximize-width", { workArea: WORK_AREA, currentRect });
  assert.equal(result.y, 750); // 1000 - 250
});

const HOME: Rect = { x: 800, y: 400, width: 400, height: 300 };

const edgeMoveCases: ReadonlyArray<{
  direction: "up" | "down" | "left" | "right";
  rect: Rect;
}> = [
  { direction: "left", rect: { x: 0, y: 400, width: 400, height: 300 } },
  { direction: "right", rect: { x: 1520, y: 400, width: 400, height: 300 } },
  { direction: "up", rect: { x: 800, y: 0, width: 400, height: 300 } },
  { direction: "down", rect: { x: 800, y: 700, width: 400, height: 300 } },
];

for (const { direction, rect } of edgeMoveCases) {
  test(`computeEdgeMove(${direction}) slides to the edge without resizing`, () => {
    assert.deepEqual(computeEdgeMove(direction, WORK_AREA, HOME), rect);
  });
}

test("computeEdgeMove clamps a window that started partly off-screen", () => {
  const offscreen: Rect = { x: -100, y: -50, width: 400, height: 300 };
  const result = computeEdgeMove("up", WORK_AREA, offscreen);
  assert.equal(result.x, 0); // pulled back on-screen on the perpendicular axis too
  assert.equal(result.y, 0);
});

test("computeEdgeMove clamps a window larger than the work area", () => {
  const huge: Rect = { x: 0, y: 0, width: 3000, height: 2000 };
  const result = computeEdgeMove("right", WORK_AREA, huge);
  assert.equal(result.width, WORK_AREA.width);
  assert.equal(result.height, WORK_AREA.height);
  assert.equal(result.x, 0);
});

const A = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1000 } };
const B = { id: 2, workArea: { x: 1920, y: 0, width: 1920, height: 1000 } };
const C = { id: 3, workArea: { x: 3840, y: 0, width: 1920, height: 1000 } };

test("pickAdjacentDisplay walks left-to-right by workArea.x, wrapping at the ends", () => {
  const displays = [C, A, B]; // deliberately out of order
  assert.equal(pickAdjacentDisplay(displays, 1, "next"), B);
  assert.equal(pickAdjacentDisplay(displays, 2, "next"), C);
  assert.equal(pickAdjacentDisplay(displays, 3, "next"), A); // wraps
  assert.equal(pickAdjacentDisplay(displays, 1, "previous"), C); // wraps
  assert.equal(pickAdjacentDisplay(displays, 3, "previous"), B);
});

test("pickAdjacentDisplay returns null with only one display", () => {
  assert.equal(pickAdjacentDisplay([A], 1, "next"), null);
});

test("pickAdjacentDisplay returns null for an unknown display id", () => {
  assert.equal(pickAdjacentDisplay([A, B], 999, "next"), null);
});

test("mapRectToDisplay preserves position/size as a fraction of the work area", () => {
  const rect: Rect = { x: 0, y: 0, width: 960, height: 1000 }; // left half of A
  const result = mapRectToDisplay(rect, A.workArea, B.workArea);
  assert.deepEqual(result, { x: 1920, y: 0, width: 960, height: 1000 });
});

test("mapRectToDisplay clamps when the destination work area is smaller", () => {
  const rect: Rect = { x: 1000, y: 500, width: 1800, height: 900 }; // near the far edge of A
  const smaller: Rect = { x: 5000, y: 0, width: 1000, height: 600 };
  const result = mapRectToDisplay(rect, A.workArea, smaller);
  assert.ok(result.width <= smaller.width);
  assert.ok(result.height <= smaller.height);
  assert.ok(result.x >= smaller.x && result.x + result.width <= smaller.x + smaller.width);
  assert.ok(result.y >= smaller.y && result.y + result.height <= smaller.y + smaller.height);
});
