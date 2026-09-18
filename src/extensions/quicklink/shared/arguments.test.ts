import assert from "node:assert/strict";
import { test } from "node:test";

import {
  distribute,
  hasPlaceholder,
  parseArguments,
  pendingArguments,
  previewLinkText,
  resolveLink,
  splitValues,
} from "./arguments.ts";

const GITHUB =
  'https://github.com/{argument name="org"}/{argument name="repo"}';
const TRANSLATE =
  'https://translate.google.com/?sl={argument name="from" default="auto"}' +
  '&tl={argument name="to" default="en"}&text={argument name="text"}';

test("parseArguments reads names in the order the link asks for them", () => {
  assert.deepEqual(parseArguments(GITHUB), [
    { name: "org", named: true },
    { name: "repo", named: true },
  ]);
});

test("parseArguments treats the bare forms as one unnamed argument", () => {
  for (const link of [
    "https://x.com/s?q={query}",
    "https://x.com/s?q={argument}",
    "https://x.com/s?q={arg}",
    "https://x.com/s?q={}",
    "https://x.com/s?q={ argument }",
  ]) {
    assert.deepEqual(parseArguments(link), [{ name: "query", named: false }]);
  }
});

test("parseArguments ignores the dynamic placeholders", () => {
  assert.deepEqual(parseArguments("https://x.com/{clipboard}/{uuid}"), []);
  assert.equal(hasPlaceholder("https://x.com/{date}"), false);
});

test("parseArguments reads default= and de-duplicates repeated names", () => {
  assert.deepEqual(parseArguments(TRANSLATE), [
    { name: "from", named: true, default: "auto" },
    { name: "to", named: true, default: "en" },
    { name: "text", named: true },
  ]);
  // The same name twice is one value used in both places.
  assert.deepEqual(
    parseArguments(
      'https://x.com/{argument name="id"}/edit/{argument name="id"}',
    ),
    [{ name: "id", named: true }],
  );
});

test("splitValues gives the last slot the rest of the text", () => {
  assert.deepEqual(splitValues("a b c", 3), ["a", "b", "c"]);
  assert.deepEqual(splitValues("a b c d", 2), ["a", "b c d"]);
  assert.deepEqual(splitValues("  one   two  ", 1), ["one   two"]);
  assert.deepEqual(splitValues("", 2), []);
});

test("splitValues keeps a quoted value together", () => {
  assert.deepEqual(splitValues('"two words" tail', 2), ["two words", "tail"]);
  assert.deepEqual(splitValues("'a b' c d", 3), ["a b", "c", "d"]);
  // An unterminated quote still yields the rest rather than nothing.
  assert.deepEqual(splitValues('"unclosed', 2), ["unclosed"]);
});

test("resolveLink fills several named arguments in order", () => {
  assert.equal(
    resolveLink(GITHUB, "anthropics claude-code"),
    "https://github.com/anthropics/claude-code",
  );
});

test("resolveLink still takes a whole single argument, spaces and all", () => {
  assert.equal(
    resolveLink("https://www.google.com/search?q={query}", "a & b"),
    "https://www.google.com/search?q=a%20%26%20b",
  );
});

test("a defaulted argument answers for itself until it is named", () => {
  const link =
    'https://github.com/{argument name="org" default="anthropics"}/{argument name="repo"}';
  // Typed text goes to the argument that has no default of its own.
  assert.equal(
    resolveLink(link, "claude-code"),
    "https://github.com/anthropics/claude-code",
  );
  // Naming it overrides the default; the rest still fills `repo`.
  assert.equal(
    resolveLink(link, "org=openai whisper"),
    "https://github.com/openai/whisper",
  );
  assert.equal(
    resolveLink(link, 'org="open ai" whisper'),
    "https://github.com/open%20ai/whisper",
  );
});

test("a name= prefix is only honoured for an argument this link asks for", () => {
  // `a` is not an argument of a plain {query} link — it is part of the search.
  assert.equal(
    resolveLink("https://www.google.com/search?q={query}", "a=b c"),
    "https://www.google.com/search?q=a%3Db%20c",
  );
});

test("the last required argument takes the whole sentence", () => {
  assert.equal(
    resolveLink(TRANSLATE, "hello there world"),
    "https://translate.google.com/?sl=auto&tl=en&text=hello%20there%20world",
  );
  assert.equal(
    resolveLink(TRANSLATE, "from=en to=km hello there"),
    "https://translate.google.com/?sl=en&tl=km&text=hello%20there",
  );
});

test("resolveLink accepts already-named values", () => {
  assert.equal(
    resolveLink(GITHUB, { org: "anthropics", repo: "claude-code" }),
    "https://github.com/anthropics/claude-code",
  );
});

test("resolveLink tidies the path an unfilled argument leaves behind", () => {
  assert.equal(
    resolveLink(GITHUB, "anthropics"),
    "https://github.com/anthropics",
  );
});

test("resolveLink with nothing typed opens the origin", () => {
  assert.equal(
    resolveLink("https://www.google.com/search?q={query}", ""),
    "https://www.google.com",
  );
  assert.equal(resolveLink(GITHUB, "   "), "https://github.com");
});

test("resolveLink leaves a placeholder-free link untouched", () => {
  assert.equal(
    resolveLink("https://mail.google.com", "ignored"),
    "https://mail.google.com",
  );
});

test("resolveLink does not url-encode a file path", () => {
  assert.equal(
    resolveLink("/Users/me/Projects/{query}", "my app"),
    "/Users/me/Projects/my app",
  );
  assert.equal(
    resolveLink("C:\\Projects\\{query}", "my app"),
    "C:\\Projects\\my app",
  );
});

test("previewLinkText shows what is still wanted", () => {
  assert.equal(previewLinkText(GITHUB, ""), "https://github.com/{org}/{repo}");
  assert.equal(
    previewLinkText(GITHUB, "anthropics"),
    "https://github.com/anthropics/{repo}",
  );
  assert.equal(
    previewLinkText("https://www.google.com/search?q={query}", ""),
    "https://www.google.com/search?q=…",
  );
});

test("distribute and pendingArguments agree on what is left to type", () => {
  assert.deepEqual(distribute("anthropics", parseArguments(GITHUB)), {
    org: "anthropics",
  });
  assert.deepEqual(
    pendingArguments(GITHUB, "anthropics").map((one) => one.name),
    ["repo"],
  );
  assert.deepEqual(pendingArguments(GITHUB, "anthropics claude-code"), []);
  // A defaulted argument is never pending — it can answer for itself.
  assert.deepEqual(
    pendingArguments(TRANSLATE, "").map((one) => one.name),
    ["text"],
  );
});
