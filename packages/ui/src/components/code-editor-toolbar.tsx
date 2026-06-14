import { Show } from "solid-js"
import { Icon } from "./icon"
import { IconButton } from "./icon-button"
import type { CodeEditorHandle } from "./code-editor"

type CodeEditorToolbarProps = {
  filename?: string
  language?: string
  cursorLine?: number
  cursorColumn?: number
  dirty?: boolean
  readOnly?: boolean
  aiHunkCount?: number
  aiHunkAccepted?: number
  onSave?: () => void
  onAcceptAll?: () => void
  onRejectAll?: () => void
  editorHandle?: () => CodeEditorHandle | undefined
  class?: string
}

export function CodeEditorToolbar(props: CodeEditorToolbarProps) {
  const parts = () => {
    const name = props.filename ?? "untitled"
    const segments = name.split(/[\\/]/)
    return {
      dir: segments.slice(0, -1).join("/"),
      file: segments.at(-1) ?? name,
    }
  }

  return (
    <div
      data-component="code-editor-toolbar"
      class="flex items-center gap-2 px-3 border-b border-border-weaker-base bg-background-stronger shrink-0"
      style={{ "min-height": "30px", "padding-top": "5px", "padding-bottom": "5px" }}
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      {/* File path — monospace, dim dir + bright filename */}
      <div class="flex items-center gap-0 flex-1 min-w-0 overflow-hidden">
        <Show when={parts().dir}>
          <span
            class="text-text-weaker truncate shrink"
            style={{ "font-family": "var(--font-family-mono)", "font-size": "11px", "letter-spacing": "-0.01em" }}
          >
            {parts().dir}/
          </span>
        </Show>
        <span
          class="text-text-base shrink-0"
          style={{ "font-family": "var(--font-family-mono)", "font-size": "11px", "letter-spacing": "-0.01em", "font-weight": "500" }}
        >
          {parts().file}
        </span>

        <Show when={props.dirty}>
          <span
            class="ml-2 shrink-0 w-[5px] h-[5px] rounded-full"
            style={{ background: "var(--icon-warning-base)" }}
            title="Unsaved changes"
          />
        </Show>

        <Show when={props.readOnly}>
          <span
            class="ml-2 shrink-0 text-text-weaker"
            style={{ "font-family": "var(--font-family-mono)", "font-size": "10px", "letter-spacing": "0.04em", "text-transform": "uppercase" }}
          >
            readonly
          </span>
        </Show>
      </div>

      {/* Right side: lang + cursor pos + actions */}
      <div class="flex items-center gap-2 shrink-0">
        <Show when={props.language}>
          <span
            class="text-text-weaker"
            style={{ "font-family": "var(--font-family-mono)", "font-size": "10px", "letter-spacing": "0.04em", "text-transform": "uppercase" }}
          >
            {props.language}
          </span>
        </Show>

        <Show when={props.cursorLine !== undefined}>
          <span
            class="text-text-weaker tabular-nums"
            style={{ "font-family": "var(--font-family-mono)", "font-size": "10px" }}
          >
            {props.cursorLine ?? 1}:{props.cursorColumn ?? 1}
          </span>
        </Show>

        <Show when={props.aiHunkCount !== undefined && props.aiHunkCount > 0}>
          <div class="flex items-center gap-1">
            <span
              class="text-text-weaker tabular-nums"
              style={{ "font-family": "var(--font-family-mono)", "font-size": "10px" }}
            >
              {props.aiHunkAccepted ?? 0}/{props.aiHunkCount}
            </span>
            <Show when={props.onAcceptAll}>
              <button
                type="button"
                class="px-1.5 py-0.5 text-icon-success-base hover:bg-surface-raised-base-hover rounded"
                style={{ "font-family": "var(--font-family-mono)", "font-size": "10px", "letter-spacing": "0.02em" }}
                onClick={props.onAcceptAll}
              >
                accept all
              </button>
            </Show>
            <Show when={props.onRejectAll}>
              <button
                type="button"
                class="px-1.5 py-0.5 text-icon-danger-base hover:bg-surface-raised-base-hover rounded"
                style={{ "font-family": "var(--font-family-mono)", "font-size": "10px", "letter-spacing": "0.02em" }}
                onClick={props.onRejectAll}
              >
                reject all
              </button>
            </Show>
          </div>
        </Show>

        <Show when={props.onSave}>
          <IconButton
            icon="download"
            size="small"
            variant="ghost"
            aria-label="Save file"
            onClick={props.onSave}
          />
        </Show>
      </div>
    </div>
  )
}
