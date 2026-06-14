import {
  StateField,
  StateEffect,
  RangeSet,
  type Range,
} from "@codemirror/state"
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  type DecorationSet,
} from "@codemirror/view"

export type DiffHunk = {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

type HunkMeta = {
  index: number
  accepted: boolean
  rejected: boolean
}

const addHunks = StateEffect.define<{ hunks: DiffHunk[] }>()
const acceptHunk = StateEffect.define<{ index: number }>()
const rejectHunk = StateEffect.define<{ index: number }>()
const clearHunks = StateEffect.define()

const addMark = Decoration.mark({ class: "cm-ai-addition" })
const delMark = Decoration.mark({ class: "cm-ai-deletion" })

class AcceptWidget extends GutterMarker {
  constructor(readonly index: number, readonly onClick: (index: number) => void) {
    super()
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span")
    el.className = "cm-ai-accept-btn"
    el.textContent = "+"
    el.title = "Accept"
    el.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onClick(this.index)
    })
    return el
  }

  eq(other: GutterMarker): boolean {
    return other instanceof AcceptWidget && other.index === this.index
  }

  destroy(): void {}
}

class RejectWidget extends GutterMarker {
  constructor(readonly index: number, readonly onClick: (index: number) => void) {
    super()
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span")
    el.className = "cm-ai-reject-btn"
    el.textContent = "x"
    el.title = "Reject"
    el.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onClick(this.index)
    })
    return el
  }

  eq(other: GutterMarker): boolean {
    return other instanceof RejectWidget && other.index === this.index
  }

  destroy(): void {}
}

function buildDecorations(
  hunks: DiffHunk[],
  meta: Map<number, HunkMeta>,
): DecorationSet {
  const marks: Range<Decoration>[] = []

  for (let i = 0; i < hunks.length; i++) {
    const hunk = hunks[i]
    const m = meta.get(i)
    if (m?.accepted || m?.rejected) continue

    let oldLine = hunk.oldStart
    let newLine = hunk.newStart

    for (const line of hunk.lines) {
      if (line.startsWith("-")) {
        const from = oldLine - 1
        marks.push(delMark.range(from, oldLine))
        oldLine++
      } else if (line.startsWith("+")) {
        const from = newLine - 1
        marks.push(addMark.range(from, newLine))
        newLine++
      } else {
        oldLine++
        newLine++
      }
    }
  }

  return RangeSet.of(marks, true)
}

function buildGutterMarkers(
  hunks: DiffHunk[],
  meta: Map<number, HunkMeta>,
  onAccept?: (index: number) => void,
  onReject?: (index: number) => void,
): RangeSet<GutterMarker> {
  const markers: Range<GutterMarker>[] = []

  for (let i = 0; i < hunks.length; i++) {
    const m = meta.get(i)
    if (m?.accepted || m?.rejected) continue

    const gutterLine = Math.max(1, hunks[i].newStart)
    if (onAccept) {
      markers.push(new AcceptWidget(i, onAccept).range(gutterLine))
    }
    if (onReject) {
      markers.push(new RejectWidget(i, onReject).range(gutterLine))
    }
  }

  return RangeSet.of(markers, true)
}

type DiffFieldState = {
  hunks: DiffHunk[]
  meta: Map<number, HunkMeta>
}

export function createAiDiffField(config?: {
  onAccept?: (index: number, hunk: DiffHunk) => void
  onReject?: (index: number, hunk: DiffHunk) => void
}) {
  const fieldState: DiffFieldState = {
    hunks: [],
    meta: new Map(),
  }

  const decoField = StateField.define<DecorationSet>({
    create() {
      return RangeSet.of([], true)
    },
    update(decos, tr) {
      let changed = false

      for (const e of tr.effects) {
        if (e.is(addHunks)) {
          fieldState.hunks = e.value.hunks
          fieldState.meta = new Map()
          changed = true
        }
        if (e.is(acceptHunk)) {
          const hunk = fieldState.hunks[e.value.index]
          if (hunk) {
            fieldState.meta.set(e.value.index, { index: e.value.index, accepted: true, rejected: false })
            config?.onAccept?.(e.value.index, hunk)
          }
          changed = true
        }
        if (e.is(rejectHunk)) {
          const hunk = fieldState.hunks[e.value.index]
          if (hunk) {
            fieldState.meta.set(e.value.index, { index: e.value.index, accepted: false, rejected: true })
            config?.onReject?.(e.value.index, hunk)
          }
          changed = true
        }
        if (e.is(clearHunks)) {
          fieldState.hunks = []
          fieldState.meta = new Map()
          changed = true
        }
      }

      if (!changed) return decos
      if (tr.docChanged) return decos.map(tr.changes)
      return buildDecorations(fieldState.hunks, fieldState.meta)
    },
    provide: (f) => EditorView.decorations.from(f),
  })

  const gutterField = StateField.define<RangeSet<GutterMarker>>({
    create() {
      return RangeSet.of([], true)
    },
    update(gutterSet, tr) {
      let changed = false

      for (const e of tr.effects) {
        if (e.is(addHunks)) changed = true
        if (e.is(acceptHunk)) changed = true
        if (e.is(rejectHunk)) changed = true
        if (e.is(clearHunks)) changed = true
      }

      if (!changed) return gutterSet
      if (tr.docChanged) return gutterSet.map(tr.changes)

      const onAccept = config?.onAccept
        ? (index: number) => {
            const hunk = fieldState.hunks[index]
            if (hunk) config.onAccept?.(index, hunk)
          }
        : undefined

      const onReject = config?.onReject
        ? (index: number) => {
            const hunk = fieldState.hunks[index]
            if (hunk) config.onReject?.(index, hunk)
          }
        : undefined

      return buildGutterMarkers(fieldState.hunks, fieldState.meta, onAccept, onReject)
    },
  })

class SpacerMarker extends GutterMarker {
  toDOM(): HTMLElement {
    const el = document.createElement("span")
    el.style.width = "20px"
    return el
  }
  eq(_other: GutterMarker): boolean { return false }
  destroy(): void {}
}

  const diffGutter = gutter({
    class: "cm-ai-diff-gutter",
    markers: (view: EditorView): RangeSet<GutterMarker> => {
      const field = view.state.field(gutterField, false)
      return field ?? RangeSet.of([], true)
    },
    lineMarker(_view: EditorView, _line: { from: number }, _otherMarkers: readonly GutterMarker[]): GutterMarker | null {
      return null
    },
    initialSpacer: () => new SpacerMarker(),
  })

  const extensions = [decoField, gutterField, diffGutter]

  const api = {
    setHunks(hunks: DiffHunk[], view: EditorView) {
      view.dispatch({ effects: [addHunks.of({ hunks })] })
    },
    accept(index: number, view: EditorView) {
      view.dispatch({ effects: [acceptHunk.of({ index })] })
    },
    reject(index: number, view: EditorView) {
      view.dispatch({ effects: [rejectHunk.of({ index })] })
    },
    clear(view: EditorView) {
      view.dispatch({ effects: [clearHunks.of(null)] })
    },
    get extensions() {
      return extensions
    },
  }

  return api
}

export function parsePatchHunks(
  patch: { hunks: DiffHunk[] } | undefined,
): DiffHunk[] {
  if (!patch?.hunks) return []
  return patch.hunks
}

export function applyHunkContent(
  currentContent: string,
  hunk: DiffHunk,
): string {
  const lines = currentContent.split("\n")

  const before: string[] = lines.slice(0, hunk.oldStart - 1)
  const after: string[] = lines.slice(hunk.oldStart + hunk.oldLines - 1)

  const newLines: string[] = []
  for (const line of hunk.lines) {
    if (line.startsWith("+") || line.startsWith(" ")) {
      newLines.push(line.slice(1))
    }
  }

  return [...before, ...newLines, ...after].join("\n")
}

const DIFF_CSS = `
.cm-ai-addition {
  background-color: rgb(from var(--surface-success-base) r g b / 0.2);
}
.cm-ai-deletion {
  background-color: rgb(from var(--surface-danger-base) r g b / 0.2);
  text-decoration: line-through;
}
.cm-ai-accept-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-success-base, #22c55e);
  cursor: pointer;
  border-radius: 3px;
}
.cm-ai-accept-btn:hover {
  background-color: rgb(from var(--text-success-base, #22c55e) r g b / 0.15);
}
.cm-ai-reject-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-danger-base, #ef4444);
  cursor: pointer;
  border-radius: 3px;
}
.cm-ai-reject-btn:hover {
  background-color: rgb(from var(--text-danger-base, #ef4444) r g b / 0.15);
}
.cm-ai-diff-gutter {
  width: 20px;
}
`

let cssInjected = false

export function injectDiffStyles() {
  if (cssInjected) return
  if (typeof document === "undefined") return
  const style = document.createElement("style")
  style.textContent = DIFF_CSS
  style.id = "opencode-ai-diff-styles"
  document.head.appendChild(style)
  cssInjected = true
}
