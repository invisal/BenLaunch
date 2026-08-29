/** Points added when a matched character starts a new word ("code" → the "C" in "VS Code"). */
const WORD_START_BONUS = 1
/** Points added when a matched character immediately follows the previous match. */
const CONSECUTIVE_BONUS = 1
/** Points charged for every haystack character skipped between matches. */
const GAP_PENALTY = -0.01
/** Score for an exact (case-insensitive) match of the whole string. */
const EXACT_MATCH_SCORE = Infinity
/** Score for a pair that cannot be aligned at all; also the DP's unreachable-cell sentinel. */
const NO_MATCH_SCORE = -Infinity

export interface MatchResult {
  /** Whether `needle` is a (fuzzy) subsequence of `haystack`. */
  match: boolean
  /** Higher is better. `NO_MATCH_SCORE` when there is no match. */
  score: number
}

/**
 * Fuzzy-match `needle` against `haystack` and return both whether it matched
 * and how good the match is. Matching is case-insensitive.
 *
 * The subsequence test is done here so callers can never feed a non-matching
 * pair into the scoring DP (which assumes a match and would otherwise return
 * nonsense).
 */
export function fuzzyMatch(needle: string, haystack: string): MatchResult {
  const n = needle.toLowerCase()
  const h = haystack.toLowerCase()

  // An empty query matches everything, with a neutral score.
  if (n.length === 0) return { match: true, score: 0 }
  // A longer needle can never be a subsequence of a shorter haystack.
  if (n.length > h.length) return { match: false, score: NO_MATCH_SCORE }
  if (!isSubsequence(n, h)) return { match: false, score: NO_MATCH_SCORE }

  // The DP matches on the lowercased strings, but word-start detection needs the
  // original casing (to see camelCase boundaries), so the raw haystack is passed too.
  return { match: true, score: computeScore(n, h, haystack) }
}

/** Is every character of `needle` present in `haystack`, in order? */
function isSubsequence(needle: string, haystack: string): boolean {
  for (let i = 0, j = 0; i < needle.length; i += 1) {
    j = haystack.indexOf(needle[i], j) + 1
    if (j === 0) return false
  }
  return true
}

const isLower = (ch: string): boolean => ch.toUpperCase() !== ch && ch.toLowerCase() === ch
const isUpper = (ch: string): boolean => ch.toLowerCase() !== ch && ch.toUpperCase() === ch

/**
 * For each haystack position, the bonus it earns for starting a new word.
 *
 * A word starts after a separator (`" "`, `"."`, `"/"`) or at a camelCase hump
 * (a lowercase character followed by an uppercase one, e.g. the "W" in "HelloWorld").
 * `haystack` must keep its original casing.
 */
function computeWordStartBonus(haystack: string): Float64Array {
  const bonus = new Float64Array(haystack.length)

  let prev = " "
  for (let i = 0; i < bonus.length; i++) {
    const current = haystack[i]
    if (
      prev === " " ||
      prev === "." ||
      prev === "/" ||
      (isLower(prev) && isUpper(current))
    ) {
      bonus[i] = WORD_START_BONUS
    }
    prev = current
  }

  return bonus
}

/**
 * Smith–Waterman-style fuzzy scoring (a trimmed-down port of fzy's algorithm).
 *
 * Precondition: `needle` is a non-empty subsequence of `haystack`, and `needle`
 * and `haystack` are already lowercase (`rawHaystack` is the same text with its
 * original casing, used only for camelCase word-start detection). Callers must
 * go through `fuzzyMatch()`, which enforces this.
 */
function computeScore(needle: string, haystack: string, rawHaystack: string): number {
  const n = needle.length
  const m = haystack.length

  // Given the precondition, an equal-length subsequence is the identical string.
  if (n === m) {
    return EXACT_MATCH_SCORE
  }

  const wordStartBonus = computeWordStartBonus(rawHaystack)

  const D = new Float64Array(n * m)
  const M = new Float64Array(n * m)

  let k = 0
  for (let i = 0; i < n; i++) {
    let prevScore = NO_MATCH_SCORE
    const needleChar = needle[i]

    for (let j = 0; j < m; j++) {
      if (needleChar === haystack[j]) {
        let cellScore = NO_MATCH_SCORE

        if (i === 0) {
          cellScore = GAP_PENALTY * j + wordStartBonus[j]
        } else if (j > 0) {
          cellScore = Math.max(
            M[k - m - 1] + wordStartBonus[j],
            D[k - m - 1] + CONSECUTIVE_BONUS,
          )
        }

        D[k] = cellScore
        M[k] = Math.max(cellScore, prevScore + GAP_PENALTY)
        prevScore = M[k]
      } else {
        prevScore += GAP_PENALTY
        D[k] = NO_MATCH_SCORE
        M[k] = prevScore
      }

      k++
    }
  }

  return M[n * m - 1]
}
