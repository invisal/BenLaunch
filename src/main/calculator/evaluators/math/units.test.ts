import assert from 'node:assert/strict'
import { test } from 'node:test'

import { rewriteUnits } from './units.ts'

const cases: ReadonlyArray<{ raw: string; expected: string }> = [
  // in-as-connector fix.
  { raw: '5 in ft', expected: '5 to ft' },
  { raw: '10 ft in m', expected: '10 ft to m' },
  { raw: '3 teaspoon in ml', expected: '3 teaspoon to ml' },
  // "in" at end-of-string still means inches.
  { raw: '5 in', expected: '5 in' },
  { raw: '5in', expected: '5in' },

  // Bare temperature letters.
  { raw: '23C to F', expected: '23 degC to degF' },
  { raw: '23c to f', expected: '23 degC to degF' },
  { raw: '23 F to C', expected: '23 degF to degC' },
  { raw: '-5C to F', expected: '-5 degC to degF' },
  // Untouched — not the "convert a bare temperature" shape.
  { raw: '23 F', expected: '23 F' },
  { raw: '23F + 1', expected: '23F + 1' },

  // Word/abbreviation aliases.
  { raw: '180 pounds to kg', expected: '180 lbs to kg' },
  { raw: '1 pound to kg', expected: '1 lbs to kg' },
  { raw: '2 tbsp in ml', expected: '2 tablespoon to ml' },
  { raw: '2 tsp in ml', expected: '2 teaspoon to ml' },
  { raw: '100 kmh in mph', expected: '100 km/h to mi/h' },
  { raw: '100 kph in mph', expected: '100 km/h to mi/h' },

  // Passthrough.
  { raw: '10 cm in mm', expected: '10 cm to mm' },
  { raw: '128 GB to MB', expected: '128 GB to MB' },
]

for (const { raw, expected } of cases) {
  test(`rewriteUnits(${JSON.stringify(raw)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(rewriteUnits(raw), expected)
  })
}
