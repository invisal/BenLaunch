import { useCallback, useEffect, useState } from "react";
import { cn } from "cnfast";
import type {
  QuickValueDef,
  QuickValueTestResult,
} from "../../../../shared/types";
import { Breadcrumb, Layout, WindowFrame } from "@renderer/shared/ui";
import CodeEditor from "./CodeEditor";

type Route =
  | { name: "list" }
  | { name: "create" }
  | { name: "meta"; id: string }
  | { name: "code"; id: string };

const DEFAULT_CODE = `// TypeScript. Return an object shaped { value: string | number | null }.
// This runs in a background Node process, so fetch() and require() are available.
module.exports = async function (): Promise<{ value: number }> {
  const res = await fetch("https://api.github.com/repos/nodejs/node")
  const data = (await res.json()) as { stargazers_count: number }
  return { value: data.stargazers_count }
}
`;

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, "");
  if (raw === "create") return { name: "create" };
  if (raw.startsWith("edit/")) {
    const rest = raw.slice("edit/".length);
    if (rest.endsWith("/code")) {
      return {
        name: "code",
        id: decodeURIComponent(rest.slice(0, -"/code".length)),
      };
    }
    return { name: "meta", id: decodeURIComponent(rest) };
  }
  return { name: "list" };
}

function hashFor(route: Route): string {
  switch (route.name) {
    case "meta":
      return `edit/${encodeURIComponent(route.id)}`;
    case "code":
      return `edit/${encodeURIComponent(route.id)}/code`;
    default:
      return route.name;
  }
}

function navigate(route: Route): void {
  const hash = hashFor(route);
  if (window.location.hash.replace(/^#/, "") !== hash) {
    window.location.hash = hash;
  }
}

function QuickValue() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHashChange = (): void => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <WindowFrame title="Quick Values">
      {route.name === "list" ? (
        <ListView
          onEdit={(id) => navigate({ name: "meta", id })}
          onCreate={() => navigate({ name: "create" })}
        />
      ) : route.name === "code" ? (
        <CodeView
          id={route.id}
          onBack={() => navigate({ name: "meta", id: route.id })}
        />
      ) : (
        <MetaForm
          id={route.name === "meta" ? route.id : null}
          onDone={() => navigate({ name: "list" })}
          onEditCode={(id) => navigate({ name: "code", id })}
        />
      )}
    </WindowFrame>
  );
}

/* ------------------------------- list view -------------------------------- */

function ListView({
  onEdit,
  onCreate,
}: {
  onEdit: (id: string) => void;
  onCreate: () => void;
}) {
  const [items, setItems] = useState<QuickValueDef[] | null>(null);

  const reload = useCallback(() => {
    void window.api.quickValue.list().then(setItems);
  }, []);

  useEffect(reload, [reload]);

  async function toggleExposed(item: QuickValueDef): Promise<void> {
    await window.api.quickValue.setExposed(item.id, !item.exposed);
    reload();
  }

  async function remove(item: QuickValueDef): Promise<void> {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    await window.api.quickValue.delete(item.id);
    reload();
  }

  return (
    <div className="flex h-full flex-col p-6">
      <WindowFrame.Title>
        <Breadcrumb>
          <Breadcrumb.Current>Quick Values</Breadcrumb.Current>
        </Breadcrumb>
      </WindowFrame.Title>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCreate}
          className="rounded bg-item-selected px-3 py-1.5 text-sm text-foreground hover:brightness-125"
        >
          New QuickValue
        </button>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto">
        {items === null ? (
          <p className="text-sm text-foreground-subtle">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-foreground-subtle">
            No QuickValues yet. Create one to get started.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{item.name}</div>
                  <div className="truncate text-xs text-foreground-subtle">
                    {item.id}
                  </div>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs text-foreground-subtle">
                  <input
                    type="checkbox"
                    checked={item.exposed}
                    onChange={() => void toggleExposed(item)}
                  />
                  Exposed
                </label>
                <button
                  type="button"
                  onClick={() => onEdit(item.id)}
                  className="shrink-0 rounded px-2 py-1 text-sm text-foreground-subtle hover:bg-item-hover hover:text-foreground"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  className="shrink-0 rounded px-2 py-1 text-sm text-foreground-subtle hover:bg-item-hover hover:text-foreground"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- metadata form ----------------------------- */

/**
 * Name + "expose as command" for a QuickValue — the code lives on its own
 * screen (`CodeView`). Creating persists immediately (with `DEFAULT_CODE`) so
 * the code editor has a real id to save against; editing saves the metadata
 * before handing off to the code editor.
 */
function MetaForm({
  id,
  onDone,
  onEditCode,
}: {
  id: string | null;
  onDone: () => void;
  onEditCode: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [exposed, setExposed] = useState(true);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [loaded, setLoaded] = useState(id === null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    void window.api.quickValue.get(id).then((def) => {
      if (cancelled || !def) return;
      setName(def.name);
      setExposed(def.exposed);
      setCode(def.code);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Persist the current metadata (keeping the existing code) and return the id. */
  async function persist(): Promise<string> {
    const saved = await window.api.quickValue.save({
      id: id ?? undefined,
      name: name.trim(),
      code,
      exposed,
    });
    return saved.id;
  }

  async function saveAndClose(): Promise<void> {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await persist();
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function saveAndEditCode(): Promise<void> {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      onEditCode(await persist());
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return <p className="px-6 py-8 text-sm text-foreground-subtle">Loading…</p>;
  }

  return (
    <Layout>
      <WindowFrame.Title>
        <Breadcrumb>
          <Breadcrumb.Item>Quick Values</Breadcrumb.Item>
          <Breadcrumb.Current>
            {id === null ? "Create" : name || "Edit"}
          </Breadcrumb.Current>
        </Breadcrumb>
      </WindowFrame.Title>

      <Layout.Content className="flex flex-col gap-6">
        <h2 className="text-base text-foreground">
          {id === null ? "New QuickValue" : "Edit QuickValue"}
        </h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-foreground-subtle">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Node stars"
            autoFocus
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground-subtle">
          <input
            type="checkbox"
            checked={exposed}
            onChange={(e) => setExposed(e.target.checked)}
          />
          Expose as a launcher command
        </label>
      </Layout.Content>

      <Layout.Footer>
        <button
          type="button"
          onClick={onDone}
          className="shrink-0 text-sm text-foreground-subtle hover:text-foreground"
        >
          Cancel
        </button>

        <div className="ml-auto flex items-center gap-3">
          {id !== null ? (
            <button
              type="button"
              onClick={() => void saveAndClose()}
              disabled={busy || !name.trim()}
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-item-hover disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void saveAndEditCode()}
            disabled={busy || !name.trim()}
            className="rounded bg-item-selected px-3 py-1.5 text-sm text-foreground hover:brightness-125 disabled:opacity-50"
          >
            {id === null ? "Continue to code →" : "Edit code →"}
          </button>
        </div>
      </Layout.Footer>
    </Layout>
  );
}

/* ------------------------------- code view ------------------------------- */

/** The CodeMirror editor for one QuickValue, plus Test / Save. Metadata
 * (name, exposed) is owned by `MetaForm` and preserved verbatim on save. */
function CodeView({ id, onBack }: { id: string; onBack: () => void }) {
  const [def, setDef] = useState<QuickValueDef | null>(null);
  const [missing, setMissing] = useState(false);
  const [code, setCode] = useState("");
  const [test, setTest] = useState<QuickValueTestResult | "running" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.api.quickValue.get(id).then((loaded) => {
      if (cancelled) return;
      if (!loaded) {
        setMissing(true);
        return;
      }
      setDef(loaded);
      setCode(loaded.code);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function runTest(): Promise<void> {
    setTest("running");
    setTest(await window.api.quickValue.test(code));
  }

  async function save(): Promise<void> {
    if (!def || saving) return;
    setSaving(true);
    try {
      await window.api.quickValue.save({
        id: def.id,
        name: def.name,
        code,
        exposed: def.exposed,
      });
      onBack();
    } finally {
      setSaving(false);
    }
  }

  if (missing) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <p className="text-sm text-foreground-subtle">
          This QuickValue no longer exists.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="self-start text-sm text-foreground-subtle hover:text-foreground"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (!def) {
    return <p className="px-6 py-8 text-sm text-foreground-subtle">Loading…</p>;
  }

  return (
    <Layout>
      <WindowFrame.Title>
        <Breadcrumb>
          <Breadcrumb.Item>Quick Values</Breadcrumb.Item>
          <Breadcrumb.Item>{def.name}</Breadcrumb.Item>
          <Breadcrumb.Current>Code</Breadcrumb.Current>
        </Breadcrumb>
      </WindowFrame.Title>

      <Layout.Content className="overflow-hidden p-2">
        <CodeEditor value={code} onChange={setCode} />
      </Layout.Content>

      <Layout.Footer>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-sm text-foreground-subtle hover:text-foreground"
        >
          Cancel
        </button>

        <div className="ml-auto flex min-w-0 items-center gap-3">
          <TestResult result={test} />
          <button
            type="button"
            onClick={() => void runTest()}
            disabled={test === "running"}
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-item-hover disabled:opacity-50"
          >
            {test === "running" ? "Running…" : "Test"}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded bg-item-selected px-3 py-1.5 text-sm text-foreground hover:brightness-125 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Layout.Footer>
    </Layout>
  );
}

function TestResult({
  result,
}: {
  result: QuickValueTestResult | "running" | null;
}) {
  if (!result || result === "running") return null;
  return (
    <span
      className={cn(
        "min-w-0 truncate text-sm",
        result.ok ? "text-foreground" : "text-foreground-subtle",
      )}
      title={result.ok ? undefined : result.error}
    >
      {result.ok
        ? `→ ${result.value === null ? "—" : result.value}`
        : `⚠ ${result.error}`}
    </span>
  );
}

export default QuickValue;
