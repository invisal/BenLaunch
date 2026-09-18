import assert from "node:assert/strict";
import { test } from "node:test";
import { arrange, buildItems, matchesPort } from "./items.ts";
import type { ProcessRow } from "./types.ts";

const row = (pid: number, over: Partial<ProcessRow> = {}): ProcessRow => ({
  pid,
  name: `proc${pid}`,
  cpuPercent: 0,
  memoryBytes: 0,
  ...over,
});

test("groups processes sharing an app bundle under its main executable", () => {
  const app = "/Applications/Chrome.app";
  const items = buildItems(
    [
      row(30, {
        appPath: app,
        path: `${app}/Contents/Frameworks/H.app/Contents/MacOS/H`,
        cpuPercent: 2,
      }),
      row(20, {
        appPath: app,
        path: `${app}/Contents/MacOS/Chrome`,
        cpuPercent: 3,
      }),
      row(5),
    ],
    true,
  );
  assert.equal(items.length, 2);
  const group = items.find((i) => i.id === `g:${app}`)!;
  assert.equal(group.name, "Chrome");
  assert.equal(group.mainPid, 20);
  assert.deepEqual(group.pids, [20, 30]);
  assert.equal(group.cpuPercent, 5);
});

test("grouping off keeps every process separate", () => {
  const app = "/Applications/A.app";
  const rows = [row(1, { appPath: app }), row(2, { appPath: app })];
  assert.equal(buildItems(rows, false).length, 2);
});

test("arrange without resort keeps order, drops gone, appends new", () => {
  const prev = buildItems(
    [row(1, { cpuPercent: 9 }), row(2, { cpuPercent: 5 })],
    true,
  );
  const fresh = buildItems(
    [
      row(2, { cpuPercent: 50 }),
      row(3, { cpuPercent: 7 }),
      row(1, { cpuPercent: 1 }),
    ],
    true,
  );
  assert.deepEqual(
    arrange(prev, fresh, "cpu", false).map((i) => i.mainPid),
    [1, 2, 3],
  );
  assert.deepEqual(
    arrange(prev, fresh, "cpu", true).map((i) => i.mainPid),
    [2, 3, 1],
  );
});

test("matches a port by number, colon form or prefix, across a group", () => {
  const app = "/Applications/Dev.app";
  const [item] = buildItems(
    [
      row(1, { appPath: app, ports: [8080] }),
      row(2, { appPath: app, ports: [3000, 8080] }),
    ],
    true,
  );
  assert.deepEqual(item.ports, [3000, 8080]);
  assert.ok(matchesPort(item, "3000"));
  assert.ok(matchesPort(item, ":80"));
  assert.ok(!matchesPort(item, "9000"));
  assert.ok(!matchesPort(item, "dev"));
});
