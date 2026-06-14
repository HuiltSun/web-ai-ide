import { createEffect, onCleanup, onMount, untrack } from "solid-js"
import {
  createAiDiffField,
  parsePatchHunks,
  applyHunkContent,
  injectDiffStyles,
} from "@opencode-ai/ui/code-editor-diff"
import type { CodeEditorHandle } from "@opencode-ai/ui/code-editor"
import type { FileContent } from "@opencode-ai/sdk/v2"

export type AiDecorationHandle = {
  readonly extensions: ReturnType<typeof createAiDiffField>["extensions"]
  acceptAll(): void
  rejectAll(): void
}

export function useAiDecorations(input: {
  editorHandle: () => CodeEditorHandle | undefined
  fileContent: () => FileContent | undefined
  onHunkApplied?: (accepted: number, total: number) => void
}): AiDecorationHandle {
  const rejected = new Set<number>()

  const field = createAiDiffField({
    onAccept: (index, hunk) => {
      const handle = input.editorHandle()
      const view = handle?.view
      if (!view) return
      view.dispatch({
        changes: {
          from: hunk.oldStart - 1,
          to: hunk.oldStart + hunk.oldLines - 1,
          insert: hunk.lines.filter((l) => l.startsWith("+") || l.startsWith(" ")).map((l) => l.slice(1)).join("\n"),
        },
      })
      const content = input.fileContent()
      const hunks = parsePatchHunks(content?.patch)
      rejected.clear()
      input.onHunkApplied?.(hunks.length - rejected.size, hunks.length)
    },
    onReject: (index) => {
      rejected.add(index)
      const content = input.fileContent()
      const hunks = parsePatchHunks(content?.patch)
      input.onHunkApplied?.(hunks.length - rejected.size, hunks.length)
    },
  })

  onMount(() => {
    injectDiffStyles()
  })

  createEffect(() => {
    const content = input.fileContent()
    const handle = untrack(() => input.editorHandle())
    const view = handle?.view
    if (!view || !content?.patch) return

    const hunks = parsePatchHunks(content.patch)
    if (hunks.length > 0) {
      field.setHunks(hunks, view)
    }
  })

  onCleanup(() => {
    const handle = input.editorHandle()
    const view = handle?.view
    if (view) field.clear(view)
  })

  return {
    get extensions() {
      return field.extensions
    },
    acceptAll() {
      const handle = input.editorHandle()
      const view = handle?.view
      if (!view) return
      const content = untrack(() => input.fileContent())
      const hunks = parsePatchHunks(content?.patch)
      let newContent = view.state.doc.toString()
      for (const hunk of hunks) {
        newContent = applyHunkContent(newContent, hunk)
      }
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newContent },
      })
      field.clear(view)
    },
    rejectAll() {
      const handle = input.editorHandle()
      const view = handle?.view
      if (!view) return
      field.clear(view)
    },
  }
}
