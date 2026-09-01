/** Points added when a matched character starts a new word ("code" → the "C" in "VS Code"). */
const WORD_START_BONUS = 1;
/** Points added when a matched character immediately follows the previous match. */
const CONSECUTIVE_BONUS = 1;
/** Points charged for every haystack character skipped between matches. */
const GAP_PENALTY = -0.01;
/**
 * Points charged per haystack character, applied to the whole score. Far
 * smaller than any bonus, so it only breaks ties between otherwise-equal
 * alignments: for "vi", "Vim" edges out "Visual Studio", which edges out
 * "Visual Studio Code". It never overturns a word-start or consecutive bonus.
 */
const LENGTH_PENALTY = -0.0005;
/** Score for an exact (case-insensitive) match of the whole string. */
const EXACT_MATCH_SCORE = Infinity;
/** Score for a pair that cannot be aligned at all; also the DP's unreachable-cell sentinel. */
const NO_MATCH_SCORE = -Infinity;

export interface MatchResult {
  /** Whether `needle` is a (fuzzy) subsequence of `haystack`. */
  match: boolean;
  /** Higher is better. `NO_MATCH_SCORE` when there is no match. */
  score: number;
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
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();

  // An empty query matches everything, with a neutral score.
  if (n.length === 0) return { match: true, score: 0 };
  // A longer needle can never be a subsequence of a shorter haystack.
  if (n.length > h.length) return { match: false, score: NO_MATCH_SCORE };
  if (!isSubsequence(n, h)) return { match: false, score: NO_MATCH_SCORE };

  // The DP matches on the lowercased strings, but word-start detection needs the
  // original casing (to see camelCase boundaries), so the raw haystack is passed too.
  return { match: true, score: computeScore(n, h, haystack) };
}

/** Score for an action whose keyword is exactly the query's first word. */
const KEYWORD_EXACT_SCORE = 100
/** Score for an action whose keyword the query's first word fuzzy-matches. */
const KEYWORD_FUZZY_SCORE = 10
/** Score when a tag equals the whole query — a deliberate "show me everything tagged X". */
const TAG_EXACT_SCORE = 20
/** Score when a tag equals one word of a multi-word query. */
const TAG_WORD_SCORE = 3

/**
 * Match `query` against an action, considering its title, its optional `keyword`
 * alias, and its optional `tags`. A keyword lets `"g cats"` surface the "Google"
 * quicklink even though the title never fuzzy-matches the whole query; an exact
 * keyword hit is scored well above any fuzzy title match so a deliberately-typed
 * alias wins. A tag equal to the whole query surfaces everything sharing it
 * (`"work"` → every quicklink tagged `work`); a tag matching just one word of a
 * longer query is only a weak nudge.
 */
export function matchAction(
  query: string,
  action: { title: string; keyword?: string; tags?: string[] },
): MatchResult {
  const titleMatch = fuzzyMatch(query, action.title)
  let best = titleMatch

  const keyword = action.keyword?.trim()
  if (keyword) {
    const firstWord = query.trim().split(/\s+/, 1)[0] ?? ""
    if (fuzzyMatch(firstWord, keyword).match) {
      const keywordScore =
        firstWord.toLowerCase() === keyword.toLowerCase()
          ? KEYWORD_EXACT_SCORE
          : KEYWORD_FUZZY_SCORE
      best = { match: true, score: Math.max(best.score, keywordScore) }
    }
  }

  if (action.tags?.length) {
    const normalized = query.trim().toLowerCase()
    const words = new Set(normalized.split(/\s+/).filter(Boolean))
    const tags = action.tags.map((tag) => tag.toLowerCase())
    if (tags.includes(normalized)) {
      best = { match: true, score: Math.max(best.score, TAG_EXACT_SCORE) }
    } else if (!best.match && tags.some((tag) => words.has(tag))) {
      best = { match: true, score: TAG_WORD_SCORE }
    }
  }

  return best
}

/** Is every character of `needle` present in `haystack`, in order? */
function isSubsequence(needle: string, haystack: string): boolean {
  for (let i = 0, j = 0; i < needle.length; i += 1) {
    j = haystack.indexOf(needle[i], j) + 1;
    if (j === 0) return false;
  }
  return true;
}

const isLower = (ch: string): boolean =>
  ch.toUpperCase() !== ch && ch.toLowerCase() === ch;
const isUpper = (ch: string): boolean =>
  ch.toLowerCase() !== ch && ch.toUpperCase() === ch;

/**
 * For each haystack position, the bonus it earns for starting a new word.
 *
 * A word starts after a separator (`" "`, `"."`, `"/"`) or at a camelCase hump
 * (a lowercase character followed by an uppercase one, e.g. the "W" in "HelloWorld").
 * `haystack` must keep its original casing.
 */
function computeWordStartBonus(haystack: string): Float64Array {
  const bonus = new Float64Array(haystack.length);

  let prev = " ";
  for (let i = 0; i < bonus.length; i++) {
    const current = haystack[i];
    if (
      prev === " " ||
      prev === "." ||
      prev === "/" ||
      (isLower(prev) && isUpper(current))
    ) {
      bonus[i] = WORD_START_BONUS;
    }
    prev = current;
  }

  return bonus;
}

/**
 * Smith–Waterman-style fuzzy scoring (a trimmed-down port of fzy's algorithm).
 *
 * Precondition: `needle` is a non-empty subsequence of `haystack`, and `needle`
 * and `haystack` are already lowercase (`rawHaystack` is the same text with its
 * original casing, used only for camelCase word-start detection). Callers must
 * go through `fuzzyMatch()`, which enforces this.
 */
function computeScore(
  needle: string,
  haystack: string,
  rawHaystack: string,
): number {
  const n = needle.length;
  const m = haystack.length;

  // Given the precondition, an equal-length subsequence is the identical string.
  if (n === m) {
    return EXACT_MATCH_SCORE;
  }

  const wordStartBonus = computeWordStartBonus(rawHaystack);

  const D = new Float64Array(n * m);
  const M = new Float64Array(n * m);

  // Best score for aligning the whole needle, taken over every position its
  // last character could land on. Using this instead of the bottom-right cell
  // means haystack characters *after* the final match are free, so a long
  // unmatched tail ("Visual Studio" for "vi") is not punished against a short
  // one ("Event Viewer"). Gaps between matched characters, and the leading
  // gap, are still charged.
  let result = NO_MATCH_SCORE;

  let k = 0;
  for (let i = 0; i < n; i++) {
    let prevScore = NO_MATCH_SCORE;
    const needleChar = needle[i];
    const lastRow = i === n - 1;

    for (let j = 0; j < m; j++) {
      if (needleChar === haystack[j]) {
        let cellScore = NO_MATCH_SCORE;

        if (i === 0) {
          cellScore = GAP_PENALTY * j + wordStartBonus[j];
        } else if (j > 0) {
          cellScore = Math.max(
            M[k - m - 1] + wordStartBonus[j],
            D[k - m - 1] + CONSECUTIVE_BONUS,
          );
        }

        D[k] = cellScore;
        M[k] = Math.max(cellScore, prevScore + GAP_PENALTY);
        prevScore = M[k];
      } else {
        prevScore += GAP_PENALTY;
        D[k] = NO_MATCH_SCORE;
        M[k] = prevScore;
      }

      if (lastRow && M[k] > result) result = M[k];

      k++;
    }
  }

  return result + LENGTH_PENALTY * m;
}
