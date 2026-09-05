import { useEffect, useRef } from 'react'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import * as prettier from 'prettier/standalone'
import prettierTypescript from 'prettier/plugins/typescript'
import prettierEstree from 'prettier/plugins/estree'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
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
 * A thin CodeMirror 6 wrapper. Built once on mount; external `value` changes
 * (e.g. loading a different QuickValue into the editor) are reconciled via a
 * dispatch rather than a rebuild.
 */
function CodeEditor({ value, onChange }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!host.current) return

    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
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
            ...historyKeymap
          ]),
          javascript({ typescript: true }),
          oneDark,
          EditorView.theme({
            '&': { height: '100%', fontSize: '13px' },
            '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          })
        ]
      })
    })
    view.current = editor

    return () => {
      editor.destroy()
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

  return <div ref={host} className="h-full overflow-hidden rounded border border-border" />
}

export default CodeEditor
