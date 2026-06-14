import { Match, Show, Switch, createMemo } from "solid-js"
import { Tabs } from "@opencode-ai/ui/tabs"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import type { SnapshotFileDiff, VcsFileDiff } from "@opencode-ai/sdk/v2"
import FileTree from "@/components/file-tree"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"

export type FileTreePanelProps = {
  diffs: () => (SnapshotFileDiff | VcsFileDiff)[]
  diffsReady: () => boolean
  reviewCount: () => number
  hasReview: () => boolean
  activeDiff?: string
  focusReviewDiff: (path: string) => void
  onFileDoubleClick?: (path: string) => void
  onFileClickAllTab?: (path: string) => void
  sizeActive: () => boolean
  onSizeStart: () => void
  onSizeTouch: () => void
}

export function FileTreePanel(props: FileTreePanelProps) {
  const layout = useLayout()
  const file = useFile()
  const language = useLanguage()

  const fileOpen = () => layout.fileTree.opened()
  const fileTreeTab = () => layout.fileTree.tab()

  const diffFiles = createMemo(() => props.diffs().map((d) => d.file))
  const kinds = createMemo(() => {
    const merge = (a: "add" | "del" | "mix" | undefined, b: "add" | "del" | "mix") => {
      if (!a) return b
      if (a === b) return a
      return "mix" as const
    }
    const normalize = (p: string) => p.replaceAll("\\\\", "/").replace(/\/+$/, "")
    const out = new Map<string, "add" | "del" | "mix">()
    for (const diff of props.diffs()) {
      const f = normalize(diff.file)
      const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"
      out.set(f, kind)
      const parts = f.split("/")
      for (const [idx] of parts.slice(0, -1).entries()) {
        const dir = parts.slice(0, idx + 1).join("/")
        if (!dir) continue
        out.set(dir, merge(out.get(dir), kind))
      }
    }
    return out
  })

  const nofiles = createMemo(() => {
    const state = file.tree.state("")
    if (!state?.loaded) return false
    return file.tree.children("").length === 0
  })

  const empty = (msg: string) => (
    <div class="h-full flex flex-col">
      <div class="h-6 shrink-0" aria-hidden />
      <div class="flex-1 pb-64 flex items-center justify-center text-center">
        <div class="text-12-regular text-text-weak">{msg}</div>
      </div>
    </div>
  )

  const setFileTreeTabValue = (value: string) => {
    if (value !== "changes" && value !== "all") return
    layout.fileTree.setTab(value)
  }

  const onFileClickAll = props.onFileClickAllTab ?? (() => {})

  return (
    <div
      data-component="file-tree-panel"
      class="relative min-w-0 h-full shrink-0 overflow-hidden bg-background-base"
      classList={{
        "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
          !props.sizeActive(),
      }}
      style={{ width: `${layout.fileTree.width()}px` }}
    >
      <div class="h-full flex flex-col overflow-hidden group/filetree">
        <Tabs
          variant="pill"
          value={fileTreeTab()}
          onChange={setFileTreeTabValue}
          class="h-full"
          data-scope="filetree"
        >
          <Tabs.List>
            <Tabs.Trigger value="changes" class="flex-1" classes={{ button: "w-full" }}>
              {props.reviewCount()}{" "}
              {language.t(
                props.reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other",
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
              {language.t("session.files.all")}
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="changes" class="bg-background-stronger px-3 py-0">
            <Switch>
              <Match when={props.hasReview() || !props.diffsReady()}>
                <Show
                  when={props.diffsReady()}
                  fallback={
                    <div class="px-2 py-2 text-12-regular text-text-weak">
                      {language.t("common.loading")}
                      {language.t("common.loading.ellipsis")}
                    </div>
                  }
                >
                  <FileTree
                    path=""
                    class="pt-3"
                    allowed={diffFiles()}
                    kinds={kinds()}
                    draggable={false}
                    active={props.activeDiff}
                    onFileClick={(node) => props.focusReviewDiff(node.path)}
                    onFileDoubleClick={props.onFileDoubleClick ? (node) => props.onFileDoubleClick!(node.path) : undefined}
                  />
                </Show>
              </Match>
            </Switch>
          </Tabs.Content>
          <Tabs.Content value="all" class="bg-background-stronger px-3 py-0">
            <Switch>
              <Match when={nofiles()}>{empty(language.t("session.files.empty"))}</Match>
              <Match when={true}>
                <FileTree
                  path=""
                  class="pt-3"
                  modified={diffFiles()}
                  kinds={kinds()}
                  onFileClick={(node) => onFileClickAll(node.path)}
                  onFileDoubleClick={props.onFileDoubleClick ? (node) => props.onFileDoubleClick!(node.path) : undefined}
                />
              </Match>
            </Switch>
          </Tabs.Content>
        </Tabs>
      </div>
      <Show when={fileOpen()}>
        <div onPointerDown={() => props.onSizeStart()}>
          <ResizeHandle
            direction="horizontal"
            edge="end"
            size={layout.fileTree.width()}
            min={160}
            max={400}
            onResize={(width) => {
              props.onSizeTouch()
              layout.fileTree.resize(width)
            }}
          />
        </div>
      </Show>
    </div>
  )
}
