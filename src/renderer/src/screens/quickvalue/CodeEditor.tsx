import { useEffect, useRef } from 'react'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { color as oneDarkColor, oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import * as prettier from 'prettier/standalone'
import prettierTypescript from 'prettier/plugins/typescript'
import prettierEstree from 'prettier/plugins/estree'
import type * as TS from 'typescript'
import typescriptScriptUrl from 'virtual:typescript-runtime-url'
import {
  createSystem,
  createVirtualTypeScriptEnvironment,
  type VirtualTypeScriptEnvironment
} from '@typescript/vfs'
import { tsAutocomplete, tsFacet, tsHover, tsLinter, tsSync } from '@valtown/codemirror-ts'

type TSModule = typeof TS

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
}

/**
 * typescript.js is loaded as a same-origin classic `<script>` tag (populating
 * `window.ts`) rather than a normal `import ts from 'typescript'`. Bundling
 * this 9MB self-referential CJS module through Rollup's ESM interop leaves
 * the checker with corrupted per-file binder state (`file.locals` ends up
 * `undefined` for some source files, crashing `initializeTypeChecker`) —
 * loading the file untransformed sidesteps that. A `new Function(...)` eval
 * would too, but the app's CSP is `script-src 'self'` with no `unsafe-eval`.
 */
let typescriptLoadPromise: Promise<TSModule> | null = null

function loadTypescript(): Promise<TSModule> {
  if (!typescriptLoadPromise) {
    typescriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = typescriptScriptUrl
      script.onload = () => resolve((window as unknown as { ts: TSModule }).ts)
      script.onerror = () => reject(new Error('Failed to load typescript.js'))
      document.head.appendChild(script)
    })
  }
  return typescriptLoadPromise
}

/**
 * lib.*.d.ts text bundled straight from the installed `typescript` package
 * (rather than @typescript/vfs's CDN-fetching helper) so the language service
 * works fully offline. Loaded eagerly as raw strings by Vite; only paid for
 * once the QuickValue editor chunk actually runs `getTsEnv()`.
 */
// Relative, not `/`-rooted: electron.vite.config.ts sets the renderer's Vite
// root to `src/renderer`, so a `/`-prefixed glob would resolve against that
// instead of the real project root and silently match nothing.
const TS_LIB_SOURCES = import.meta.glob('../../../../../node_modules/typescript/lib/lib*.d.ts', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>

const TS_ENTRY_PATH = 'index.ts'

// The sandbox `runUserCode` runs QuickValue snippets in (see
// src/main/sources/quickvalue/run-user-code.ts): a bare `new Function('module',
// 'exports', 'require', code)` call, not a real CommonJS loader. These globals
// are what's actually in scope there — modeled here so the editor's type
// checking matches reality instead of flagging `module`/`require` as undefined.
const SANDBOX_GLOBALS_PATH = 'globals.d.ts'
const SANDBOX_GLOBALS_SOURCE = `declare const module: { exports: any }
declare const exports: any
declare function require(id: string): any
`

let tsEnvPromise: Promise<VirtualTypeScriptEnvironment> | null = null

/** Builds (once, lazily) the shared virtual TypeScript environment powering
 * autocomplete/hover/diagnostics for every CodeEditor instance. */
function getTsEnv(): Promise<VirtualTypeScriptEnvironment> {
  if (!tsEnvPromise) {
    tsEnvPromise = loadTypescript().then((ts) => {
      const fsMap = new Map<string, string>()
      for (const [path, content] of Object.entries(TS_LIB_SOURCES)) {
        fsMap.set('/' + path.slice(path.lastIndexOf('/') + 1), content)
      }
      fsMap.set(SANDBOX_GLOBALS_PATH, SANDBOX_GLOBALS_SOURCE)

      const compilerOptions: TS.CompilerOptions = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS,
        lib: ['ESNext', 'DOM'],
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false
      }

      const system = createSystem(fsMap)
      return createVirtualTypeScriptEnvironment(system, [SANDBOX_GLOBALS_PATH], ts, compilerOptions)
    })
  }
  return tsEnvPromise
}

async function formatCode(source: string): Promise<string> {
  return prettier.format(source, {
    parser: 'typescript',
    plugins: [prettierTypescript, prettierEstree],
    semi: false,
    singleQuote: true
  })
}

/**
 * Ctrl/Cmd-S handler: format-in-place only (best effort — a snippet that
 * doesn't currently parse is left untouched). Saving stays a separate,
 * explicit action so this doesn't double as a "close the editor" shortcut.
 * Cursor position is preserved by character offset, clamped to the
 * reformatted length.
 */
async function formatInPlace(view: EditorView): Promise<void> {
  const current = view.state.doc.toString()
  let formatted = current
  try {
    formatted = await formatCode(current)
  } catch {
    return
  }

  if (formatted === current) return

  const cursor = Math.min(view.state.selection.main.head, formatted.length)
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: formatted },
    selection: { anchor: cursor }
  })
}

/**
 * A thin CodeMirror 6 wrapper. Built once on mount (once the shared
 * TypeScript environment is ready); external `value` changes (e.g. loading a
 * different QuickValue into the editor) are reconciled via a dispatch rather
 * than a rebuild.
 */
function CodeEditor({ value, onChange }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  onChangeRef.current = onChange
  valueRef.current = value

  useEffect(() => {
    let cancelled = false

    void getTsEnv().then((env) => {
      if (cancelled || !host.current) return

      const editor = new EditorView({
        parent: host.current,
        state: EditorState.create({
          doc: valueRef.current,
          extensions: [
            lineNumbers(),
            history(),
            keymap.of([
              {
                key: 'Mod-s',
                run: (v) => {
                  void formatInPlace(v)
                  return true
                }
              },
              indentWithTab,
              ...defaultKeymap,
              ...historyKeymap,
              ...completionKeymap
            ]),
            javascript({ typescript: true }),
            tsFacet.of({ env, path: TS_ENTRY_PATH }),
            tsSync(),
            tsLinter(),
            autocompletion({ override: [tsAutocomplete()] }),
            tsHover(),
            // Only One Dark's *syntax* colors — not its editor theme, whose
            // opaque `#282c34` panel would hide the window's glass. The theme
            // below supplies transparent surfaces with One Dark's palette.
            syntaxHighlighting(oneDarkHighlightStyle),
            EditorView.theme(
              {
                '&': {
                  height: '100%',
                  fontSize: '13px',
                  backgroundColor: 'transparent',
                  color: oneDarkColor.ivory
                },
                '&.cm-focused': { outline: 'none' },
                '.cm-content': { caretColor: oneDarkColor.cursor },
                '.cm-cursor, .cm-dropCursor': { borderLeftColor: oneDarkColor.cursor },
                '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
                  { backgroundColor: oneDarkColor.selection },
                '.cm-scroller': {
                  overflow: 'auto',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace'
                },
                '.cm-gutters': {
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: oneDarkColor.stone
                },
                '.cm-activeLine': { backgroundColor: 'rgb(255 255 255 / 4%)' },
                '.cm-activeLineGutter': { backgroundColor: 'rgb(255 255 255 / 4%)' },
                // Popups stay opaque so text over them is readable.
                '.cm-tooltip': {
                  backgroundColor: oneDarkColor.tooltipBackground,
                  border: '1px solid rgb(255 255 255 / 12%)'
                },
                '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
                  backgroundColor: oneDarkColor.selection,
                  color: oneDarkColor.ivory
                }
              },
              { dark: true }
            ),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) onChangeRef.current(update.state.doc.toString())
            })
          ]
        })
      })
      view.current = editor
    })

    return () => {
      cancelled = true
      view.current?.destroy()
      view.current = null
    }
    // Built once; `value` sync is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const editor = view.current
    if (editor && value !== editor.state.doc.toString()) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={host} className="h-full overflow-hidden rounded" />
}

export default CodeEditor
