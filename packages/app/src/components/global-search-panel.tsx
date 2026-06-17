import { createSignal, For, Show, onMount, onCleanup } from "solid-js"
import { useServer } from "@/context/server"

interface SearchMatch {
  path: { text: string }
  lines: { text: string }
  line_number: number
  submatches: Array<{ match: { text: string }; start: number; end: number }>
}

interface GroupedResult {
  file: string
  matches: SearchMatch[]
}

async function fetchMatches(serverUrl: string, pattern: string): Promise<SearchMatch[]> {
  const params = new URLSearchParams({ pattern, limit: "50" })
  const res = await fetch(`${serverUrl}/file/find?${params}`)
  if (!res.ok) return []
  return res.json()
}

async function fetchContext(serverUrl: string, pattern: string): Promise<string> {
  const params = new URLSearchParams({ pattern, limit: "100" })
  const res = await fetch(`${serverUrl}/file/search/context?${params}`)
  if (!res.ok) return ""
  return res.text()
}

function highlight(line: string, submatches: SearchMatch["submatches"]): string {
  // Return plain text — we highlight via CSS mark trick in the DOM
  return line.trimEnd()
}

function groupByFile(items: SearchMatch[]): GroupedResult[] {
  const map = new Map<string, SearchMatch[]>()
  for (const item of items) {
    const f = item.path.text
    if (!map.has(f)) map.set(f, [])
    map.get(f)!.push(item)
  }
  return [...map.entries()].map(([file, matches]) => ({ file, matches }))
}

export function GlobalSearchPanel(props: { open: boolean; onClose: () => void }) {
  const server = useServer()
  const serverUrl = () => server.current?.http.url ?? ""

  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<GroupedResult[]>([])
  const [totalMatches, setTotalMatches] = createSignal(0)
  const [loading, setLoading] = createSignal(false)
  const [copied, setCopied] = createSignal(false)

  let inputRef!: HTMLInputElement
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose()
    }
    document.addEventListener("keydown", onKey)
    onCleanup(() => document.removeEventListener("keydown", onKey))
  })

  function handleInput(e: InputEvent) {
    const val = (e.target as HTMLInputElement).value
    setQuery(val)
    clearTimeout(debounceTimer)
    if (!val.trim()) {
      setResults([])
      setTotalMatches(0)
      return
    }
    debounceTimer = setTimeout(async () => {
      setLoading(true)
      try {
        const items = await fetchMatches(serverUrl(), val.trim())
        setTotalMatches(items.length)
        setResults(groupByFile(items))
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  async function copyAsContext() {
    if (!query().trim()) return
    const md = await fetchContext(serverUrl(), query().trim())
    if (!md) return
    await navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Show when={props.open}>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "9998",
          background: "rgba(0,0,0,0.5)",
        }}
        onClick={props.onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(720px, 90vw)",
          "max-height": "70vh",
          "z-index": "9999",
          display: "flex",
          "flex-direction": "column",
          background: "var(--background-base)",
          border: "1px solid var(--border-base)",
          "border-radius": "8px",
          overflow: "hidden",
          "box-shadow": "0 24px 64px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input row */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "10px",
            padding: "12px 16px",
            "border-bottom": "1px solid var(--border-base)",
            "flex-shrink": "0",
          }}
        >
          <span style={{ color: "var(--text-weaker)", "font-size": "14px" }}>⌕</span>
          <input
            ref={inputRef}
            autofocus
            type="text"
            placeholder="在项目中搜索..."
            value={query()}
            onInput={handleInput}
            style={{
              flex: "1",
              background: "none",
              border: "none",
              outline: "none",
              color: "var(--text-base)",
              "font-size": "14px",
              "font-family": "var(--font-family-mono, monospace)",
            }}
          />
          <Show when={query() && results().length > 0}>
            <button
              onClick={copyAsContext}
              title="复制为 Markdown（Agent 上下文）"
              style={{
                background: copied() ? "var(--color-green-600, #16a34a)" : "var(--background-stronger)",
                border: "1px solid var(--border-base)",
                "border-radius": "4px",
                color: "var(--text-base)",
                "font-size": "11px",
                "font-family": "var(--font-family-mono, monospace)",
                padding: "3px 8px",
                cursor: "pointer",
                "white-space": "nowrap",
                transition: "background 0.15s",
              }}
            >
              {copied() ? "✓ 已复制" : "复制为 Markdown"}
            </button>
          </Show>
          <button
            onClick={props.onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-weaker)",
              cursor: "pointer",
              "font-size": "16px",
              "line-height": "1",
              padding: "0 2px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Status bar */}
        <Show when={query().trim()}>
          <div
            style={{
              padding: "4px 16px",
              "font-size": "11px",
              color: "var(--text-weaker)",
              "font-family": "var(--font-family-mono, monospace)",
              "flex-shrink": "0",
              "border-bottom": "1px solid var(--border-base)",
              background: "var(--background-stronger)",
            }}
          >
            <Show when={loading()} fallback={
              <Show when={totalMatches() > 0} fallback="无匹配结果">
                {totalMatches()} 个匹配，共 {results().length} 个文件
                {totalMatches() >= 50 ? "（仅显示前 50 个）" : ""}
              </Show>
            }>
              搜索中...
            </Show>
          </div>
        </Show>

        {/* Results */}
        <div style={{ overflow: "auto", flex: "1" }}>
          <For each={results()}>
            {(group) => (
              <div>
                {/* File header */}
                <div
                  style={{
                    padding: "6px 16px",
                    "font-size": "11px",
                    "font-family": "var(--font-family-mono, monospace)",
                    color: "var(--text-link, #60a5fa)",
                    background: "var(--background-stronger)",
                    position: "sticky",
                    top: "0",
                    "z-index": "1",
                    "border-bottom": "1px solid var(--border-weaker-base)",
                  }}
                >
                  {group.file}
                </div>
                {/* Match rows */}
                <For each={group.matches}>
                  {(match) => (
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        padding: "3px 16px",
                        "font-size": "12px",
                        "font-family": "var(--font-family-mono, monospace)",
                        "border-bottom": "1px solid var(--border-weaker-base)",
                        "align-items": "baseline",
                      }}
                    >
                      <span style={{ color: "var(--text-weaker)", "min-width": "36px", "text-align": "right", "flex-shrink": "0" }}>
                        {match.line_number}
                      </span>
                      <span style={{ color: "var(--text-base)", "white-space": "pre", overflow: "hidden", "text-overflow": "ellipsis" }}>
                        {match.lines.text.trimEnd()}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}
