import { For, Show, createMemo } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import type { EditorFileState } from "@/context/editor"

export type EditorTabsProps = {
  tabs: EditorFileState[]
  activePath?: string
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

export function EditorTabs(props: EditorTabsProps) {
  return (
    <div
      data-component="editor-tabs"
      class="flex items-stretch shrink-0 overflow-x-auto bg-background-stronger border-b border-border-weaker-base"
      style={{ "min-height": "34px" }}
    >
      <For each={props.tabs}>
        {(tab) => {
          const basename = () => tab.path.split(/[\\/]/).pop() ?? tab.path
          const isActive = () => tab.path === props.activePath

          return (
            <div
              data-active={isActive() ? "" : undefined}
              class="group relative flex items-center gap-1.5 px-3 cursor-pointer select-none whitespace-nowrap min-w-0 border-r border-border-weaker-base"
              classList={{
                "bg-background-base text-text-strong": isActive(),
                "bg-background-stronger text-text-weak hover:text-text-base hover:bg-background-weak": !isActive(),
              }}
              style={{ "padding-top": "7px", "padding-bottom": "7px" }}
              onClick={() => props.onSelect(tab.path)}
            >
              {/* Active accent line at top */}
              <Show when={isActive()}>
                <div
                  class="absolute inset-x-0 top-0 h-[2px] bg-border-selected"
                  style={{ "border-radius": "0 0 1px 1px" }}
                />
              </Show>

              <FileIcon node={{ path: tab.path, type: "file" }} />

              <span
                class="truncate max-w-[140px] text-[11px] leading-none"
                style={{ "font-family": "var(--font-family-mono)", "letter-spacing": "-0.01em" }}
              >
                {basename()}
              </span>

              {/* Dirty dot */}
              <Show when={tab.dirty}>
                <span
                  class="shrink-0 w-[5px] h-[5px] rounded-full"
                  style={{ background: "var(--icon-warning-base)" }}
                />
              </Show>

              {/* Close button */}
              <span
                class="shrink-0 ml-0.5 flex items-center justify-center w-4 h-4 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-raised-base-hover transition-opacity"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation()
                  props.onClose(tab.path)
                }}
              >
                <Icon name="close" size="small" class="text-icon-weak" />
              </span>
            </div>
          )
        }}
      </For>

      <Show when={props.tabs.length === 0}>
        <div
          class="flex items-center px-3 text-[11px] text-text-weaker"
          style={{ "font-family": "var(--font-family-mono)" }}
        >
          no open files
        </div>
      </Show>

      {/* Fills remaining tab bar width */}
      <div class="flex-1 border-0" />
    </div>
  )
}
