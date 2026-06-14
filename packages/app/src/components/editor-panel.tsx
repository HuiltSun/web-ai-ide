import { Show, createMemo } from "solid-js"
import { useEditor } from "@/context/editor"
import { EditorTabs } from "./editor-tabs"
import { EditorTabContent } from "./editor-tab-content"

export type EditorPanelProps = {
  class?: string
}

function EditorEmptyState() {
  return (
    <div
      class="relative flex flex-col items-center justify-center h-full overflow-hidden"
      style={{ background: "var(--background-stronger)" }}
    >
      {/* Dot grid background */}
      <svg
        class="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: "0.35" }}
      >
        <defs>
          <pattern id="editor-dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="var(--border-base)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#editor-dot-grid)" />
      </svg>

      {/* Center content */}
      <div class="relative flex flex-col items-center gap-5 px-8 text-center">
        {/* Crosshair icon frame */}
        <div
          class="relative flex items-center justify-center w-14 h-14"
          style={{
            border: "1px solid var(--border-base)",
            background: "var(--background-base)",
          }}
        >
          {/* Corner marks */}
          <span class="absolute top-[-1px] left-[-1px] w-2 h-2 border-t-2 border-l-2" style={{ "border-color": "var(--border-selected)" }} />
          <span class="absolute top-[-1px] right-[-1px] w-2 h-2 border-t-2 border-r-2" style={{ "border-color": "var(--border-selected)" }} />
          <span class="absolute bottom-[-1px] left-[-1px] w-2 h-2 border-b-2 border-l-2" style={{ "border-color": "var(--border-selected)" }} />
          <span class="absolute bottom-[-1px] right-[-1px] w-2 h-2 border-b-2 border-r-2" style={{ "border-color": "var(--border-selected)" }} />

          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-weak)"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>

        <div class="flex flex-col gap-1.5">
          <span
            class="text-[13px] text-text-base"
            style={{ "font-family": "var(--font-family-mono)", "letter-spacing": "-0.02em" }}
          >
            no file open
          </span>
          <span class="text-[11px] text-text-weaker" style={{ "line-height": "1.5" }}>
            double-click a file in the explorer
          </span>
        </div>
      </div>
    </div>
  )
}

export function EditorPanel(props: EditorPanelProps) {
  const editor = useEditor()

  const tabs = createMemo(() => Object.values(editor.store.editors))

  const handleSelect = (path: string) => {
    editor.open(path)
  }

  const handleClose = (path: string) => {
    editor.close(path)
  }

  return (
    <div
      data-component="editor-panel"
      class="flex flex-col min-w-0 flex-1 min-h-0 self-stretch border-r border-border-weaker-base overflow-hidden"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <EditorTabs
        tabs={tabs()}
        activePath={editor.activeEditor()}
        onSelect={handleSelect}
        onClose={handleClose}
      />

      <div class="flex-1 min-h-0 overflow-hidden">
        <Show
          when={editor.activeEditor()}
          fallback={<EditorEmptyState />}
        >
          {(path) => <EditorTabContent path={path()} />}
        </Show>
      </div>
    </div>
  )
}
