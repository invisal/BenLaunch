/**
 * The argument placeholders a quicklink's link may carry, and how typed text is
 * distributed into them.
 *
 * A link can ask for several values, each with a name:
 *
 *     https://github.com/{argument name="org"}/{argument name="repo"}
 *
 * so `gh anthropics claude-code` opens that repo, and the launcher can tell the
 * user *which* value it is waiting for rather than an anonymous "query". A bare
 * `{query}` / `{argument}` / `{arg}` / `{}` is the same thing without a name,
 * and stays exactly as fast to type as it was when one value was all a link
 * could take.
 *
 * An argument may carry `default="…"`, which makes it optional: it is filled
 * only when named (`tr to=km hello there world`). See `distribute` for the
 * rule that decides where typed values land.
 *
 * Nothing here may import `node:*` or `electron`: the Create form, the detail
 * pane and the main-process store all read this file.
 */

/** One argument slot in a link — `{argument name="org"}`, `{query}`, `{}`. */
export interface QuicklinkArgument {
  /** What to prompt with. An unnamed slot is called `query`. */
  name: string;
  /** False for a bare `{query}` / `{}`, which has no label of its own. */
  named: boolean;
  /** Value used when nothing is typed for it, from `default="…"`. */
  default?: string;
}

/**
 * An argument placeholder: the `{query}` / `{argument}` / `{arg}` / `{}` forms,
 * each optionally carrying `name="…"` / `default="…"` attributes (Raycast's
 * syntax, and any other attribute is tolerated and ignored).
 *
 * Deliberately narrow: `{clipboard}` and the other dynamic tokens must *not*
 * match, since those are filled from the environment by `expandDynamic`, not
 * from what the user types.
 */
const ARGUMENT_SOURCE =
  '\\{\\s*(?:query|arg(?:ument)?)?((?:\\s*[a-z]+\\s*=\\s*"[^"}]*")*)\\s*\\}';
/** Non-global, for `test` — a `/g` regex carries `lastIndex` between calls. */
const ARGUMENT = new RegExp(ARGUMENT_SOURCE, "i");
const ARGUMENT_GLOBAL = new RegExp(ARGUMENT_SOURCE, "gi");
/** `name="org"` inside a placeholder's attribute run. */
const ATTRIBUTE = /([a-z]+)\s*=\s*"([^"]*)"/gi;

/** Does this link take a typed argument at all? */
export function hasPlaceholder(link: string): boolean {
  return ARGUMENT.test(link);
}

/** The name an unnamed `{query}` / `{}` slot answers to. */
const DEFAULT_NAME = "query";

/** Read `name="…" default="…"` off one placeholder's attribute run. */
function attributesOf(run: string): { name?: string; default?: string } {
  const out: { name?: string; default?: string } = {};
  for (const [, key, value] of run.matchAll(ATTRIBUTE)) {
    const attribute = key.toLowerCase();
    if (attribute === "name" && value.trim()) out.name = value.trim();
    else if (attribute === "default") out.default = value;
  }
  return out;
}

/**
 * Every argument `link` asks for, in the order it asks for them, de-duplicated
 * by name — a link that mentions `{argument name="repo"}` twice wants one value
 * in both places, not two.
 */
export function parseArguments(link: string): QuicklinkArgument[] {
  const out: QuicklinkArgument[] = [];
  const seen = new Set<string>();

  for (const [, run] of link.matchAll(ARGUMENT_GLOBAL)) {
    const { name, default: fallback } = attributesOf(run ?? "");
    const argument: QuicklinkArgument = {
      name: name ?? DEFAULT_NAME,
      named: name !== undefined,
      ...(fallback === undefined ? {} : { default: fallback }),
    };
    const key = argument.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(argument);
  }
  return out;
}

/** Strip one layer of matching quotes from a value typed as `"a b"`. */
function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/s.exec(value);
  return quoted ? quoted[2] : value;
}

/**
 * Split typed text into at most `slots` values on whitespace, honouring quotes
 * (`"two words"` is one value) — and giving the **last** slot everything that
 * is left, unsplit, so the final argument can be a sentence without the user
 * having to quote it.
 */
export function splitValues(text: string, slots: number): string[] {
  const source = text.trim();
  const out: string[] = [];
  let i = 0;

  while (i < source.length && out.length < slots) {
    while (i < source.length && /\s/.test(source[i])) i += 1;
    if (i >= source.length) break;

    // The last slot takes the remainder verbatim: "hello there world" into
    // `{from} {text}` is `from=hello`, `text=there world`.
    if (out.length === slots - 1) {
      out.push(unquote(source.slice(i).trim()));
      break;
    }

    const quote = source[i] === '"' || source[i] === "'" ? source[i] : null;
    if (quote) {
      i += 1;
      const end = source.indexOf(quote, i);
      out.push(source.slice(i, end === -1 ? undefined : end));
      i = end === -1 ? source.length : end + 1;
    } else {
      const start = i;
      while (i < source.length && !/\s/.test(source[i])) i += 1;
      out.push(source.slice(start, i));
    }
  }
  return out;
}

/** A leading `to=km` / `to="two words"` token addressing one argument by name. */
const NAMED_VALUE = /^([a-z][a-z0-9_-]*)=("[^"]*"|'[^']*'|\S*)\s*/i;

/**
 * Work out which typed value belongs to which argument.
 *
 * The rule, in two halves:
 *  - **the arguments without a `default` are filled in order** by what is
 *    typed, and the last of them takes everything that is left, so the text of
 *    a translation or the body of a search stays one value without quoting;
 *  - **an argument with a `default` is only filled by naming it** up front —
 *    `tr to=km hello there world` — because it already has an answer and
 *    guessing that a leading word was meant for it is how "translate hello
 *    there world" silently becomes "translate world from hello into there".
 *
 * A `name=` prefix is only honoured when the name is one this link actually
 * asks for, so a genuine `a=b` in a search query is left alone.
 */
export function distribute(
  text: string,
  args: readonly QuicklinkArgument[],
): Record<string, string> {
  const values: Record<string, string> = {};
  if (!args.length) return values;

  const byName = new Map(args.map((arg) => [arg.name.toLowerCase(), arg]));
  let rest = text.trim();
  for (;;) {
    const named = NAMED_VALUE.exec(rest);
    const argument = named && byName.get(named[1].toLowerCase());
    if (!named || !argument) break;
    const value = unquote(named[2]);
    if (value) values[argument.name.toLowerCase()] = value;
    rest = rest.slice(named[0].length);
  }

  const unfilled = args.filter(
    (arg) => values[arg.name.toLowerCase()] === undefined,
  );
  // Only the arguments that have no answer of their own take positional text —
  // unless every one of them has a default, in which case dropping what was
  // typed would be worse than filling them in order.
  const required = unfilled.filter((arg) => arg.default === undefined);
  const slots = required.length ? required : unfilled;

  splitValues(rest, slots.length).forEach((value, index) => {
    const argument = slots[index];
    if (argument && value !== "") values[argument.name.toLowerCase()] = value;
  });

  for (const argument of args) {
    const key = argument.name.toLowerCase();
    if (values[key] === undefined && argument.default !== undefined)
      values[key] = argument.default;
  }
  return values;
}

/**
 * Should values substituted into `link` be URL-encoded? Only for a real URL:
 * percent-encoding the spaces in `~/Projects/{query}` would hand the shell a
 * path that doesn't exist.
 */
function isUrlLink(link: string): boolean {
  return (
    !/^[a-z]:[\\/]/i.test(link) && // a Windows drive letter isn't a scheme
    /^[a-z][a-z0-9+.-]*:/i.test(link) &&
    !/^file:/i.test(link)
  );
}

/**
 * Tidy what an unfilled argument leaves behind: `github.com//claude-code` or a
 * dangling `github.com/anthropics/`. Only the path is touched — a query string
 * with an empty parameter is still a valid, working URL.
 */
function tidy(target: string): string {
  const url = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)(.*)$/i.exec(target);
  if (!url) return target.replace(/([^:])\/{2,}/g, "$1/").replace(/\/+$/, "");

  const [, origin, rest] = url;
  const tail = rest.search(/[?#]/);
  const path = tail === -1 ? rest : rest.slice(0, tail);
  return (
    origin +
    path.replace(/\/{2,}/g, "/").replace(/\/+$/, "") +
    (tail === -1 ? "" : rest.slice(tail))
  );
}

/** Replace every placeholder in `link` using `render`. */
function fill(
  link: string,
  render: (arg: QuicklinkArgument) => string,
): string {
  const seen = parseArguments(link);
  return link.replace(ARGUMENT_GLOBAL, (_, run: string) => {
    const { name } = attributesOf(run ?? "");
    const key = (name ?? DEFAULT_NAME).toLowerCase();
    const argument = seen.find((one) => one.name.toLowerCase() === key);
    return argument ? render(argument) : "";
  });
}

/**
 * `link` with its arguments filled from `typed` — the text the user entered,
 * either after the alias or into the launcher's argument chip. A
 * `Record` may be passed instead when the values are already named.
 *
 * With nothing typed and no defaults the link's *origin* is returned, so a
 * quicklink whose whole point is its argument ("g") still opens somewhere
 * sensible when Enter is pressed on its own.
 */
export function resolveLink(
  link: string,
  typed: string | Readonly<Record<string, string>>,
): string {
  const args = parseArguments(link);
  if (!args.length) return link;

  const values =
    typeof typed === "string" ? distribute(typed, args) : { ...typed };
  const encode = isUrlLink(link);

  if (!Object.values(values).some((value) => value.trim() !== "")) {
    const bare = fill(link, () => "");
    try {
      return new URL(bare).origin;
    } catch {
      return bare;
    }
  }

  let empty = false;
  const filled = fill(link, (argument) => {
    const value = (values[argument.name.toLowerCase()] ?? "").trim();
    if (!value) empty = true;
    return encode ? encodeURIComponent(value) : value;
  });
  return empty ? tidy(filled) : filled;
}

/**
 * `link` with what has been typed so far substituted and everything still
 * wanted left legible — `github.com/anthropics/{repo}` — for the launcher row's
 * subtitle as the user types. An unnamed argument has nothing to call itself,
 * so it shows as an ellipsis, exactly as it did when one value was all a link
 * could take.
 */
export function previewLinkText(link: string, typed: string): string {
  const args = parseArguments(link);
  if (!args.length) return link;

  const values = distribute(typed, args);
  return fill(link, (argument) => {
    const value = values[argument.name.toLowerCase()];
    if (value) return value;
    return argument.named ? `{${argument.name}}` : "…";
  });
}

/**
 * The arguments `link` still wants, given what has been typed — what the
 * launcher's chip prompts for. Empty once everything has a value.
 */
export function pendingArguments(
  link: string,
  typed: string,
): QuicklinkArgument[] {
  const args = parseArguments(link);
  const values = distribute(typed, args);
  return args.filter((argument) => !values[argument.name.toLowerCase()]);
}
