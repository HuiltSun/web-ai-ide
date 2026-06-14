import { SearchCursor, SearchQuery, setSearchQuery } from "@codemirror/search"
import { EditorView } from "@codemirror/view"
import { createSignal, onCleanup, onMount } from "solid-js"
import { Icon } from "./icon"
import { IconButton } from "./icon-button"

type CodeEditorFindProps = {
  view: () => EditorView | undefined
  class?: string
}

export function CodeEditorFind(props: CodeEditorFindProps) {
  let input!: HTMLInputElement
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [replaceText, setReplaceText] = createSignal("")
  const [replacing, setReplacing] = createSignal(false)
  const [matchCount, setMatchCount] = createSignal(0)
  const [currentMatch, setCurrentMatch] = createSignal(0)
  const [caseSensitive, setCaseSensitive] = createSignal(false)

  const view = () => props.view()

  const runSearch = (q: string, cs: boolean) => {
    const v = view()
    if (!v) return
    if (!q) {
      v.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "" })) })
      setMatchCount(0)
      setCurrentMatch(0)
      return
    }
    v.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: q, caseSensitive: cs })) })

    let count = 0
    const cursor = new SearchCursor(v.state.doc, q, 0, v.state.doc.length, cs ? undefined : (x) => x.toLowerCase())
    while (!cursor.next().done) count++
    setMatchCount(count)
    setCurrentMatch(count > 0 ? 1 : 0)
  }

  const findNext = () => {
    const v = view()
    if (!v) return
    const q = query()
    if (!q) return

    const cursor = new SearchCursor(v.state.doc, q, v.state.selection.main.to, v.state.doc.length,
      caseSensitive() ? undefined : (x) => x.toLowerCase())
    if (!cursor.next().done) {
      v.dispatch({ selection: { anchor: cursor.value.from, head: cursor.value.to }, scrollIntoView: true })
      setCurrentMatch((c) => (c < matchCount() ? c + 1 : 1))
    }
  }

  const findPrev = () => {
    const v = view()
    if (!v) return
    const q = query()
    if (!q) return

    const cursor = new SearchCursor(v.state.doc, q, 0, v.state.selection.main.from,
      caseSensitive() ? undefined : (x) => x.toLowerCase())
    let last: { from: number; to: number } | undefined
    let value = cursor.next()
    while (!value.done) {
      last = cursor.value
      value = cursor.next()
    }
    if (last) {
      v.dispatch({ selection: { anchor: last.from, head: last.to }, scrollIntoView: true })
      setCurrentMatch((c) => (c > 1 ? c - 1 : matchCount()))
    }
  }

  const replaceCurrent = () => {
    const v = view()
    if (!v) return
    const sel = v.state.selection.main
    if (sel.empty) return
    v.dispatch({ changes: { from: sel.from, to: sel.to, insert: replaceText() } })
    findNext()
  }

  const replaceAll = () => {
    const v = view()
    if (!v) return
    const q = query()
    if (!q) return

    const cursor = new SearchCursor(v.state.doc, q, 0, v.state.doc.length,
      caseSensitive() ? undefined : (x) => x.toLowerCase())
    const changes: { from: number; to: number; insert: string }[] = []
    while (!cursor.next().done) {
      changes.push({ from: cursor.value.from, to: cursor.value.to, insert: replaceText() })
    }
    if (changes.length > 0) {
      v.dispatch({ changes })
      setMatchCount(0)
      setCurrentMatch(0)
    }
  }

  const openFind = () => {
    setOpen(true)
    requestAnimationFrame(() => input?.focus())
  }

  const closeFind = () => {
    const v = view()
    if (v) {
      v.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "" })) })
    }
    setOpen(false)
    setQuery("")
    setReplaceText("")
    setReplacing(false)
    setMatchCount(0)
    setCurrentMatch(0)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (e.shiftKey) findPrev()
      else findNext()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      closeFind()
    }
  }

  onMount(() => {
    if (typeof window === "undefined") return

    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === "f") {
        e.preventDefault()
        openFind()
        const v = view()
        if (v) {
          const sel = v.state.selection.main
          if (!sel.empty) {
            const text = v.state.sliceDoc(sel.from, sel.to)
            if (text) {
              setQuery(text)
              runSearch(text, caseSensitive())
            }
          }
        }
      }
      if (mod && e.key === "h" && replacing()) {
        e.preventDefault()
        setReplacing(false)
      }
    }

    window.addEventListener("keydown", handler, true)
    onCleanup(() => window.removeEventListener("keydown", handler, true))
  })

  return (
    <>
      {open() && (
        <div
          data-component="code-editor-find"
          class="flex items-center gap-1 px-2 py-1 border-b border-border-weak-base bg-surface-raised-base text-12-regular"
          classList={{ [props.class ?? ""]: !!props.class }}
        >
          <div class="flex items-center gap-1 flex-1 min-w-0">
            <Icon name="magnifying-glass" size="small" class="text-icon-weak shrink-0" />
            <input
              ref={input}
              type="text"
              value={query()}
              placeholder="Find"
              class="bg-transparent border-none outline-none text-text-base flex-1 min-w-0"
              onInput={(e) => {
                setQuery(e.currentTarget.value)
                runSearch(e.currentTarget.value, caseSensitive())
              }}
              onKeyDown={handleKeyDown}
            />
            <span class="text-text-weak shrink-0 tabular-nums">
              {matchCount() > 0 ? `${currentMatch()}/${matchCount()}` : query() ? "0/0" : ""}
            </span>
          </div>

          {replacing() && (
            <div class="flex items-center gap-1 flex-1 min-w-0 border-l border-border-weak-base pl-2">
              <input
                type="text"
                value={replaceText()}
                placeholder="Replace"
                class="bg-transparent border-none outline-none text-text-base flex-1 min-w-0"
                onInput={(e) => setReplaceText(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    replaceCurrent()
                  }
                  if (e.key === "Escape") {
                    e.preventDefault()
                    closeFind()
                  }
                }}
              />
            </div>
          )}

          <div class="flex items-center gap-0.5 shrink-0">
            <IconButton
              icon="arrow-up"
              size="small"
              variant="ghost"
              aria-label="Previous match"
              onClick={findPrev}
            />
            <IconButton
              icon="chevron-down"
              size="small"
              variant="ghost"
              aria-label="Next match"
              onClick={findNext}
            />
            <button
              type="button"
              class="px-1 rounded text-11-medium hover:bg-surface-raised-base-hover"
              classList={{ "text-icon-warning-base": caseSensitive() }}
              onClick={() => {
                setCaseSensitive(!caseSensitive())
                runSearch(query(), !caseSensitive())
              }}
            >
              Aa
            </button>
            <button
              type="button"
              class="px-1 rounded text-11-medium hover:bg-surface-raised-base-hover"
              classList={{ "text-text-strong": replacing() }}
              onClick={() => setReplacing(!replacing())}
            >
              AB
            </button>
            {replacing() && (
              <>
                <button
                  type="button"
                  class="px-1 rounded text-11-medium hover:bg-surface-raised-base-hover"
                  onClick={replaceCurrent}
                >
                  Replace
                </button>
                <button
                  type="button"
                  class="px-1 rounded text-11-medium hover:bg-surface-raised-base-hover"
                  onClick={replaceAll}
                >
                  All
                </button>
              </>
            )}
            <IconButton icon="close" size="small" variant="ghost" aria-label="Close find" onClick={closeFind} />
          </div>
        </div>
      )}
    </>
  )
}
