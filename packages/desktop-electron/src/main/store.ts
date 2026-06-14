import Store from "electron-store"

import { SETTINGS_STORE } from "./constants"

const storeCache = new Map<string, Store>()
const valueCache = new Map<string, unknown>()

// We cannot instantiate the electron-store at module load time because
// module import hoisting causes this to run before app.setPath("userData", ...)
// in index.ts has executed, which would result in files being written to the default directory
// (e.g. bad: %APPDATA%\@opencode-ai\desktop-electron\opencode.settings vs good: %APPDATA%\ai.opencode.desktop.dev\opencode.settings).
export function getStore(name = SETTINGS_STORE) {
  const cached = storeCache.get(name)
  if (cached) return cached

  const raw = new Store({ name, fileExtension: "", accessPropertiesByDotNotation: false })

  // Wrap with in-memory read cache to avoid disk IO on repeated reads
  const proxied = new Proxy(raw, {
    get(target, prop, receiver) {
      if (prop === "get") {
        return (key: string) => {
          const cacheKey = `${name}:${key}`
          if (valueCache.has(cacheKey)) return valueCache.get(cacheKey)
          const value = target.get(key)
          valueCache.set(cacheKey, value)
          return value
        }
      }
      if (prop === "set") {
        return (key: string, value: unknown) => {
          valueCache.delete(`${name}:${key}`)
          return target.set(key, value)
        }
      }
      if (prop === "delete") {
        return (key: string) => {
          valueCache.delete(`${name}:${key}`)
          return target.delete(key)
        }
      }
      if (prop === "clear") {
        return () => {
          for (const k of valueCache.keys()) {
            if (k.startsWith(`${name}:`)) valueCache.delete(k)
          }
          return target.clear()
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  }) as Store<Record<string, unknown>>

  storeCache.set(name, proxied)
  return proxied
}
