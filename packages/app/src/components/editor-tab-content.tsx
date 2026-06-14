import { createMemo, Show } from "solid-js"
import { CodeEditor, type CodeEditorHandle } from "@opencode-ai/ui/code-editor"
import { CodeEditorToolbar } from "@opencode-ai/ui/code-editor-toolbar"
import { Button } from "@opencode-ai/ui/button"
import { useEditor } from "@/context/editor"
import { useFile } from "@/context/file"
import { useSDK } from "@/context/sdk"

export type EditorTabContentProps = {
  path: string
  class?: string
}

export function EditorTabContent(props: EditorTabContentProps) {
  const editor = useEditor()
  const file = useFile()
  const sdk = useSDK()

  const fileState = createMemo(() => file.get(props.path))
  const editorState = createMemo(() => editor.store.editors[props.path])

  let editorHandle: CodeEditorHandle | undefined

  const content = createMemo(() => {
    const state = fileState()
    if (state?.content && state.content.type === "text") {
      return state.content.content
    }
    return ""
  })

  const language = createMemo(() => {
    const ext = props.path.split(".").pop()?.toLowerCase()
    return ext ?? "text"
  })

  const relPath = createMemo(() => {
    const root = sdk.directory
    const abs = props.path
    if (!root) return abs.replace(/\\/g, "/")
    const stripped = abs.startsWith(root) ? abs.slice(root.length) : abs
    return stripped.replace(/\\/g, "/").replace(/^\//, "")
  })

  const fileChanged = createMemo(() => {
    const current = fileState()?.content
    if (!current || current.type !== "text") return false
    const s = editorState()
    if (!s || !s.dirty) return false
    return current.content !== s.originalValue
  })

  const revertToDisk = () => {
    const current = fileState()?.content
    if (current && current.type === "text") {
      editor.markDirty(props.path, current.content)
      editorHandle?.setValue(current.content)
    }
  }

  const handleSave = () => {
    editor.save(props.path)
  }

  return (
    <div data-component="editor-tab-content" class="flex flex-col size-full">
      <CodeEditorToolbar
        filename={relPath()}
        language={language()}
        dirty={editorState()?.dirty}
        onSave={handleSave}
      />

      <Show when={fileChanged()}>
        <div class="flex items-center gap-2 px-3 py-1.5 bg-surface-warning-base/20 border-b border-border-warning-base text-12-regular text-text-base">
          <span>File changed on disk</span>
          <Button size="small" variant="secondary" onClick={revertToDisk}>
            Reload
          </Button>
        </div>
      </Show>

      <div class="flex-1 min-h-0 overflow-hidden">
        <CodeEditor
          value={content()}
          path={props.path}
          handleRef={(handle) => {
            editorHandle = handle
          }}
          onChange={(value) => {
            editor.markDirty(props.path, value)
          }}
          onSave={handleSave}
          autoFocus
          class="size-full"
          style={{ height: "100%" }}
        />
      </div>
    </div>
  )
}
