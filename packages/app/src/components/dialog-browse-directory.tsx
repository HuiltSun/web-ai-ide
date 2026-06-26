import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Button } from "@opencode-ai/ui/button"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"

type DirEntry = { name: string; absolute: string }

const DRIVES = "__DRIVES__"
const isDriveRoot = (path: string) => /^[A-Za-z]:[\\/]$/.test(path)
const driveLetter = (path: string) => (isDriveRoot(path) ? path.charAt(0).toUpperCase() + ":\\" : null)

const DRIVE_LETTERS = "CDEFGHIJKLMNOPQRSTUVWXYZ".split("")

export const DialogBrowseDirectory = (props: {
  title?: string
  onSelect: (result: string | string[] | null) => void
}) => {
  const sdk = useGlobalSDK()
  const sync = useGlobalSync()
  const dialog = useDialog()
  const language = useLanguage()

  // Fallback path lookup in case sync.data hasn't loaded yet
  const missingBase = createMemo(() => !(sync.data.path.home || sync.data.path.directory))
  const [fallbackPath] = createResource(
    () => (missingBase() ? true : undefined),
    async () =>
      sdk.client.path
        .get()
        .then((x) => x.data)
        .catch(() => undefined),
    { initialValue: undefined },
  )

  const homedir = createMemo(() => sync.data.path.home || sync.data.path.directory || fallbackPath()?.home || fallbackPath()?.directory || "")

  // Path stack: start at drive selection view
  const [stack, setStack] = createSignal<string[]>([DRIVES])
  const current = createMemo(() => {
    const s = stack()
    return s[s.length - 1] ?? ""
  })

  const showDrives = createMemo(() => stack().length === 1 && stack()[0] === DRIVES)

  // Enumerate available drives by probing each letter
  const [drives] = createResource(
    () => showDrives(),
    async () => {
      const results = await Promise.all(
        DRIVE_LETTERS.map(async (letter) => {
          const drive = letter + ":\\"
          try {
            const res = await sdk.client.file.list({ directory: drive, path: "" })
            // Drive exists only if it returns at least one entry
            return (res.data && res.data.length > 0) ? drive : null
          } catch {
            return null
          }
        }),
      )
      return results.filter(Boolean) as string[]
    },
  )

  const resolved = createMemo(() => {
    const dir = current()
    if (dir === DRIVES) return null
    const home = homedir()
    if (!dir && home) return home
    if (!dir) return null
    return dir
  })

  const [entries] = createResource(
    () => resolved(),
    async (dir): Promise<DirEntry[]> => {
      const result = await sdk.client.file
        .list({ directory: dir, path: "" })
        .then((x) => x.data ?? [])
        .catch((err) => {
          console.error("DialogBrowseDirectory: failed to list directory", dir, err)
          return []
        })
      return result
        .filter((n) => n.type === "directory")
        .map((n) => ({
          name: n.name,
          absolute: n.absolute || dir + (dir.endsWith("/") ? "" : "/") + n.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  )

  const driveLabel = (path: string) => {
    if (path === DRIVES) return language.t("dialog.browse.thisPc")
    const dl = driveLetter(path)
    if (dl) return dl
    const home = homedir()
    if (home && path === home) return "~"
    return path.split(/[\\/]/).filter(Boolean).pop() || path
  }

  const displayPath = () => {
    const dir = resolved()
    if (showDrives()) return language.t("dialog.browse.thisPc")
    if (!dir) return language.t("common.loading.ellipsis")
    if (isDriveRoot(dir)) return dir
    const home = homedir()
    if (home && dir.startsWith(home)) return "~" + dir.slice(home.length) || "~"
    return dir
  }

  const navigateTo = (dir: string) => {
    setStack((prev) => [...prev, dir])
  }

  const navigateUp = () => {
    setStack((prev) => {
      if (prev.length === 0) return prev
      const curr = prev[prev.length - 1]
      if (curr === DRIVES) return prev
      if (isDriveRoot(curr)) return [DRIVES]
      if (prev.length === 1) {
        const home = homedir()
        for (const letter of DRIVE_LETTERS) {
          const drive = letter + ":\\"
          if (home.startsWith(drive)) return [drive]
        }
        return [DRIVES]
      }
      return prev.slice(0, -1)
    })
  }

  const navigateToIndex = (index: number) => {
    setStack((prev) => prev.slice(0, index + 1))
  }

  const select = () => {
    const dir = resolved()
    if (!dir) return
    props.onSelect([dir])
    dialog.close()
  }

  const cancel = () => {
    props.onSelect(null)
    dialog.close()
  }

  return (
    <Dialog title={props.title ?? language.t("command.project.open")} size="large">
      <div class="flex flex-col gap-3 min-h-0">
        {/* Breadcrumb */}
        <div class="flex items-center gap-1 px-1 py-0.5 overflow-x-auto text-13-regular text-text-weak">
          <For each={stack()}>
            {(segment, index) => {
              const isLast = index() === stack().length - 1
              const label = driveLabel(segment)

              return (
                <>
                  {index() > 0 && <span class="text-text-weakest mx-0.5">/</span>}
                  <button
                    classList={{
                      "hover:text-text-strong hover:underline whitespace-nowrap shrink-0": true,
                      "text-text-strong font-medium": isLast,
                    }}
                    onClick={() => navigateToIndex(index())}
                  >
                    {label}
                  </button>
                </>
              )
            }}
          </For>
        </div>

        {/* Directory listing */}
        <div class="min-h-[200px] max-h-[320px] overflow-y-auto border border-border-weak rounded-md">
          {/* Drives view */}
          <Show when={showDrives()}>
            <Show
              when={!drives.loading}
              fallback={
                <div class="flex items-center justify-center h-32 text-text-weak text-13-regular">
                  {language.t("common.loading")}
                </div>
              }
            >
              <Show
                when={drives() && drives()!.length > 0}
                fallback={
                  <div class="flex items-center justify-center h-32 text-text-weak text-13-regular">
                    {language.t("dialog.directory.empty")}
                  </div>
                }
              >
                <For each={drives()!}>
                  {(drive) => (
                    <button
                      class="w-full flex items-center gap-x-3 px-3 py-1.5 hover:bg-surface-hover rounded-none text-left transition-colors"
                      onClick={() => navigateTo(drive)}
                      onDblClick={() => {
                        navigateTo(drive)
                      }}
                    >
                      <FileIcon node={{ path: drive, type: "directory" }} class="shrink-0 size-4" />
                      <span class="text-13-regular text-text-strong truncate">{drive}</span>
                    </button>
                  )}
                </For>
              </Show>
            </Show>
          </Show>

          {/* Normal directory view */}
          <Show when={!showDrives()}>
            <Show
              when={resolved() && !entries.loading}
              fallback={
                <div class="flex items-center justify-center h-32 text-text-weak text-13-regular">
                  {language.t("common.loading")}
                </div>
              }
            >
              <Show
                when={entries() && entries()!.length > 0}
                fallback={
                  <div class="flex items-center justify-center h-32 text-text-weak text-13-regular">
                    {language.t("dialog.directory.empty")}
                  </div>
                }
              >
                <For each={entries()!}>
                  {(entry) => (
                    <button
                      class="w-full flex items-center gap-x-3 px-3 py-1.5 hover:bg-surface-hover rounded-none text-left transition-colors"
                      onClick={() => navigateTo(entry.absolute)}
                      onDblClick={() => {
                        navigateTo(entry.absolute)
                        select()
                      }}
                    >
                      <FileIcon node={{ path: entry.absolute, type: "directory" }} class="shrink-0 size-4" />
                      <span class="text-13-regular text-text-strong truncate">{entry.name}</span>
                    </button>
                  )}
                </For>
              </Show>
            </Show>
          </Show>
        </div>

        {/* Actions */}
        <div class="flex items-center justify-between gap-2 pt-1">
          <div class="flex items-center gap-1">
            <IconButton
              icon="arrow-left"
              size="small"
              variant="ghost"
              disabled={showDrives()}
              onClick={navigateUp}
              aria-label={language.t("dialog.browse.back")}
            />
            <span class="text-12-regular text-text-weak truncate max-w-[300px]">{displayPath()}</span>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="small" onClick={cancel}>
              {language.t("common.cancel")}
            </Button>
            <Button size="small" disabled={!resolved()} onClick={select}>
              {language.t("dialog.browse.select")}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
