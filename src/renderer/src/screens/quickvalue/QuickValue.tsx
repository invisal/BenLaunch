import { useCallback, useEffect, useState } from 'react'
import { cn } from 'cnfast'
import type { QuickValueDef, QuickValueTestResult } from '../../../../shared/types'
import CodeEditor from './CodeEditor'

type Route = { name: 'list' } | { name: 'create' } | { name: 'edit'; id: string }

const DEFAULT_CODE = `// Return an object shaped { value: string | number | null }.
// This runs in a background Node process, so fetch() and require() are available.
module.exports = async function () {
  const res = await fetch("https://api.github.com/repos/nodejs/node")
  const data = await res.json()
  return { value: data.stargazers_count }
}
`

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '')
  if (raw === 'create') return { name: 'create' }
  if (raw.startsWith('edit/')) {
    return { name: 'edit', id: decodeURIComponent(raw.slice('edit/'.length)) }
  }
  return { name: 'list' }
}

function navigate(route: Route): void {
  const hash =
    route.name === 'edit' ? `edit/${encodeURIComponent(route.id)}` : route.name
  if (window.location.hash.replace(/^#/, '') !== hash) {
    window.location.hash = hash
  }
}

function QuickValue() {
  const [route, setRoute] = useState<Route>(parseHash)

  useEffect(() => {
    const onHashChange = (): void => setRoute(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      {route.name === 'list' ? (
        <ListView onEdit={(id) => navigate({ name: 'edit', id })} onCreate={() => navigate({ name: 'create' })} />
      ) : (
        <EditorView
          id={route.name === 'edit' ? route.id : null}
          onDone={() => navigate({ name: 'list' })}
        />
      )}
    </div>
  )
}

/* ------------------------------- list view -------------------------------- */

function ListView({ onEdit, onCreate }: { onEdit: (id: string) => void; onCreate: () => void }) {
  const [items, setItems] = useState<QuickValueDef[] | null>(null)

  const reload = useCallback(() => {
    void window.api.quickValue.list().then(setItems)
  }, [])

  useEffect(reload, [reload])

  async function toggleExposed(item: QuickValueDef): Promise<void> {
    await window.api.quickValue.setExposed(item.id, !item.exposed)
    reload()
  }

  async function remove(item: QuickValueDef): Promise<void> {
    if (!window.confirm(`Delete "${item.name}"?`)) return
    await window.api.quickValue.delete(item.id)
    reload()
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">QuickValues</h1>
          <p className="mt-1 text-sm text-foreground-subtle">
            Snippets that fetch a value. Expose one to add it to the launcher.
          </p>
        </div>
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
              <li key={item.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{item.name}</div>
                  <div className="truncate text-xs text-foreground-subtle">{item.id}</div>
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
  )
}

/* ------------------------------ editor view ------------------------------- */

function EditorView({ id, onDone }: { id: string | null; onDone: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(DEFAULT_CODE)
  const [exposed, setExposed] = useState(true)
  const [loaded, setLoaded] = useState(id === null)
  const [test, setTest] = useState<QuickValueTestResult | 'running' | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id === null) return
    let cancelled = false
    void window.api.quickValue.get(id).then((def) => {
      if (cancelled || !def) return
      setName(def.name)
      setCode(def.code)
      setExposed(def.exposed)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  async function runTest(): Promise<void> {
    setTest('running')
    setTest(await window.api.quickValue.test(code))
  }

  async function save(): Promise<void> {
    if (!name.trim()) return
    setSaving(true)
    try {
      await window.api.quickValue.save({ id: id ?? undefined, name: name.trim(), code, exposed })
      onDone()
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return <p className="px-6 py-8 text-sm text-foreground-subtle">Loading…</p>
  }

  return (
    <div className="flex h-full flex-col px-6 py-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDone}
          className="rounded px-2 py-1 text-sm text-foreground-subtle hover:bg-item-hover hover:text-foreground"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold">{id === null ? 'New QuickValue' : 'Edit QuickValue'}</h1>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Node stars)"
          className="flex-1 rounded border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-foreground-subtle"
        />
        <label className="flex shrink-0 items-center gap-2 text-sm text-foreground-subtle">
          <input type="checkbox" checked={exposed} onChange={(e) => setExposed(e.target.checked)} />
          Expose as command
        </label>
      </div>

      <div className="mt-3 min-h-0 flex-1">
        <CodeEditor value={code} onChange={setCode} />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={test === 'running'}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-item-hover disabled:opacity-50"
        >
          {test === 'running' ? 'Running…' : 'Test'}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !name.trim()}
          className="rounded bg-item-selected px-3 py-1.5 text-sm text-foreground hover:brightness-125 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <TestResult result={test} />
      </div>
    </div>
  )
}

function TestResult({ result }: { result: QuickValueTestResult | 'running' | null }) {
  if (!result || result === 'running') return null
  return (
    <span
      className={cn(
        'min-w-0 truncate text-sm',
        result.ok ? 'text-foreground' : 'text-foreground-subtle'
      )}
      title={result.ok ? undefined : result.error}
    >
      {result.ok ? `→ ${result.value === null ? '—' : result.value}` : `⚠ ${result.error}`}
    </span>
  )
}

export default QuickValue
