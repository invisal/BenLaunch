import { useEffect, useRef, useState } from "react";
import { Breadcrumb, Layout, WindowFrame } from "@renderer/shared/ui";
import { useShortcut } from "@renderer/lib/use-shortcut";
import type { QuickValueDef, QuickValueTestResult } from "../shared/types";
import CodeEditor, { type CodeEditorHandle } from "./CodeEditor";

/**
 * The CodeMirror editor for one QuickValue, living in its own framed window
 * (the launcher's `user-select: none` would make the editor's contenteditable
 * impossible to type into — see the renderer-user-select-scope note). Metadata
 * (name, description, exposed) is owned by the launcher's `MetaScreen`
 * and preserved verbatim on save (the store keeps existing `code` untouched when
 * a draft omits it, and vice-versa).
 *
 * Run Test / Format / Save all live in the footer's actions menu (⌘K).
 */
function CodeScreen({ id }: { id: string }) {
  const [def, setDef] = useState<QuickValueDef | null>(null);
  const [missing, setMissing] = useState(false);
  const [code, setCode] = useState("");
  const [test, setTest] = useState<QuickValueTestResult | "running" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const editor = useRef<CodeEditorHandle>(null);

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
        description: def.description,
        code,
        exposed: def.exposed,
      });
      window.api.windowControls.close();
    } finally {
      setSaving(false);
    }
  }

  useShortcut({
    "CommandOrControl+S": () => editor.current?.format(),
    "CommandOrControl+Enter": () => void save(),
  });

  if (missing) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <p className="text-sm text-foreground-subtle">
          This QuickValue no longer exists.
        </p>
        <button
          type="button"
          onClick={() => window.api.windowControls.close()}
          className="self-start text-sm text-foreground-subtle hover:text-foreground"
        >
          Close
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
          <Breadcrumb.Item>{def.name}</Breadcrumb.Item>
          <Breadcrumb.Current>Code</Breadcrumb.Current>
        </Breadcrumb>
      </WindowFrame.Title>

      <Layout.Content className="overflow-hidden p-2">
        <CodeEditor ref={editor} value={code} onChange={setCode} />
      </Layout.Content>

      <Layout.Footer>
        <Layout.Footer.Left>
          <Layout.Footer.Button
            onClick={() => window.api.windowControls.close()}
          >
            Cancel
          </Layout.Footer.Button>
        </Layout.Footer.Left>

        <Layout.Footer.Right>
          <TestResult result={test} />
          <Layout.Footer.Menu
            items={[
              {
                id: "test",
                label: test === "running" ? "Running…" : "Run Test",
                disabled: test === "running",
                onSelect: () => void runTest(),
              },
              {
                id: "format",
                label: "Format",
                shortcut: "CommandOrControl+S",
                onSelect: () => editor.current?.format(),
              },
              {
                id: "save",
                label: saving ? "Saving…" : "Save",
                shortcut: "CommandOrControl+Enter",
                disabled: saving,
                onSelect: () => void save(),
              },
            ]}
          />
        </Layout.Footer.Right>
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
    <Layout.Footer.Label
      className={result.ok ? "text-foreground" : undefined}
      title={result.ok ? undefined : result.error}
    >
      {result.ok
        ? `→ ${result.value === null ? "—" : result.value}`
        : `⚠ ${result.error}`}
    </Layout.Footer.Label>
  );
}

export default CodeScreen;
