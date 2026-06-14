import { createSignal, createMemo, batch } from "solid-js"
import { createStore, produce, reconcile } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { useParams } from "@solidjs/router"
import { useSDK } from "./sdk"
import { useFile } from "./file"
import { useLanguage } from "./language"
import { Persist, persisted } from "@/utils/persist"
import { showToast } from "@opencode-ai/ui/toast"
import { useLayout } from "./layout"

type EditorFileState = {
  path: string
  dirty: boolean
  originalValue?: string
  currentValue?: string
  scrollTop: number
  scrollLeft: number
  cursorPos: number
  language?: string
}

type EditorViewState = {
  editors: Record<string, EditorFileState>
  activeEditor?: string
  activeLine?: number
  activeColumn?: number
}

const DEFAULT_EDITOR_WIDTH = 450

export const { use: useEditor, provider: EditorProvider } = createSimpleContext({
  name: "Editor",
  gate: false,
  init: () => {
    const sdk = useSDK()
    const file = useFile()
    const language = useLanguage()
    const layout = useLayout()
    const params = useParams()

    const scope = createMemo(() => sdk.directory)

    const target = Persist.global("editor", ["editor.v1"])
    const [store, setStore, persistStore, ready] = persisted(
      { ...target },
      createStore<EditorViewState>({
        editors: {},
      }),
    )

    const activeEditor = createMemo(() => {
      const active = store.activeEditor
      if (active && store.editors[active]) return active
      const keys = Object.keys(store.editors)
      return keys.length > 0 ? keys[0] : undefined
    })

    const activeFileState = createMemo(() => {
      const key = activeEditor()
      if (!key) return undefined
      return store.editors[key]
    })

    const open = (path: string) => {
      if (!path) return
      const normalized = file.normalize(path)
      ensure(normalized)

      file.load(normalized).then(() => {
        const state = file.get(normalized)
        const content = state?.content
        if (content && content.type === "text") {
          setStore(
            "editors",
            normalized,
            produce((draft) => {
              draft.originalValue = content.content
              draft.currentValue = content.content
              draft.dirty = false
            }),
          )
        }
      })

      setStore("activeEditor", normalized)
    }

    const close = (path: string) => {
      const normalized = file.normalize(path)
      const editorKeys = Object.keys(store.editors)
      const index = editorKeys.indexOf(normalized)
      const remaining = editorKeys.filter((k) => k !== normalized)

      setStore(
        "editors",
        produce((draft) => {
          delete draft[normalized]
        }),
      )

      if (store.activeEditor === normalized) {
        if (index >= 0 && index < remaining.length) {
          setStore("activeEditor", remaining[index])
        } else if (remaining.length > 0) {
          setStore("activeEditor", remaining[remaining.length - 1])
        } else {
          setStore("activeEditor", undefined)
        }
      }
    }

    const ensure = (path: string) => {
      if (!path) return
      if (store.editors[path]) return
      setStore("editors", path, {
        path,
        dirty: false,
        scrollTop: 0,
        scrollLeft: 0,
        cursorPos: 0,
      })
    }

    const markDirty = (path: string, value: string) => {
      setStore(
        "editors",
        path,
        produce((draft) => {
          draft.dirty = value !== draft.originalValue
          draft.currentValue = value
        }),
      )
    }

    const isDirty = (path: string) => store.editors[path]?.dirty ?? false

    const save = async (path?: string) => {
      const target = path ?? activeEditor()
      if (!target) return
      const state = store.editors[target]
      if (!state?.dirty || !state.currentValue) return

      try {
        // Route save through the session — compute diff and send as edit tool
        const original = state.originalValue ?? ""
        const current = state.currentValue

        // For now, we send the full file content as a write operation
        // In the future, this could compute a proper diff
        const sessionID = params.id
        if (sessionID) {
          await sdk.client.session.send({
            sessionID,
            parts: [
              {
                type: "text",
                text: `Write the file ${target} with the following content:\n\n\`\`\`\n${current}\n\`\`\``,
              },
            ],
          })
        }

        setStore(
          "editors",
          target,
          produce((draft) => {
            draft.originalValue = current
            draft.dirty = false
          }),
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        showToast({
          variant: "error",
          title: language.t("toast.file.saveFailed.title"),
          description: msg,
        })
      }
    }

    const discardChanges = (path: string) => {
      setStore(
        "editors",
        path,
        produce((draft) => {
          draft.currentValue = draft.originalValue
          draft.dirty = false
        }),
      )
    }

    const setScrollPos = (path: string, top: number, left: number) => {
      setStore(
        "editors",
        path,
        produce((draft) => {
          draft.scrollTop = top
          draft.scrollLeft = left
        }),
      )
    }

    const setCursorPos = (path: string, pos: number) => {
      setStore("editors", path, "cursorPos", pos)
    }

    const setCursorLineColumn = (line: number, column: number) => {
      setStore("activeLine", line)
      setStore("activeColumn", column)
    }

    const hasAnyDirty = createMemo(() => {
      return Object.values(store.editors).some((e) => e.dirty)
    })

    return {
      ready,
      store,
      activeEditor,
      activeFileState,
      open,
      close,
      markDirty,
      isDirty,
      save,
      discardChanges,
      setScrollPos,
      setCursorPos,
      setCursorLineColumn,
      hasAnyDirty,
    }
  },
})

export type { EditorFileState, EditorViewState }
