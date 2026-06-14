import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __d = dirname(fileURLToPath(import.meta.url))
const shellEnv = readFileSync(join(__d, "shell-env.ts"), "utf-8")
const index = readFileSync(join(__d, "index.ts"), "utf-8")
const server = readFileSync(join(__d, "server.ts"), "utf-8")
const store = readFileSync(join(__d, "store.ts"), "utf-8")
const windows = readFileSync(join(__d, "windows.ts"), "utf-8")
const ipc = readFileSync(join(__d, "ipc.ts"), "utf-8")
const preloadIndex = readFileSync(join(__d, "../preload/index.ts"), "utf-8")
const preloadTypes = readFileSync(join(__d, "../preload/types.ts"), "utf-8")
const migrate = readFileSync(join(__d, "migrate.ts"), "utf-8")

let passed = 0
let failed = 0

function check(name, condition) {
  if (condition) { passed++; return true }
  console.log("  FAIL:", name)
  failed++
  return false
}

function contains(file, name, str) {
  check(name, file.includes(str))
}

// A. Shell env cache
console.log("\nA. Shell env cache")
contains(shellEnv, "A1: imports getStore", 'import { getStore }')
contains(shellEnv, "A2: reads cached shell env", '"shellEnv"')
const cacheIdx = shellEnv.indexOf('"shellEnv"')
const probeIdx = shellEnv.indexOf("probe(shell,")
check("A3: cache before probe", cacheIdx > 0 && probeIdx > 0 && cacheIdx < probeIdx)
contains(shellEnv, "A4: writes interactive result", "interactive.value")
contains(shellEnv, "A5: writes login result", "login.value")

// B. contextMenu deferral
console.log("\nB. contextMenu deferral")
const whenReady = index.indexOf("app.whenReady()")
const cmIdx = index.indexOf("contextMenu({")
check("B1: contextMenu after whenReady", cmIdx > whenReady)
const afterReady = index.substring(whenReady)
check("B2: contextMenu inside whenReady", afterReady.includes("contextMenu({"))

// C. Health check
console.log("\nC. Health check interval")
contains(server, "C1: 250ms interval", "setTimeout(resolve, 250)")
check("C2: no 100ms interval", !server.includes("setTimeout(resolve, 100)"))

// D. Store cache
console.log("\nD. Store memory cache")
contains(store, "D1: valueCache map", "valueCache")
contains(store, "D2: Proxy wrapper", "new Proxy(raw")
contains(store, "D3: cache has check", "valueCache.has")
contains(store, "D4: cache set", "valueCache.set")
contains(store, "D5: cache delete", "valueCache.delete")
contains(store, "D6: Reflect fallthrough", "Reflect.get")

// F. CORS
console.log("\nF. CORS filter")
contains(windows, "F1: rendererProtocol filter", "rendererProtocol}://")
contains(windows, "F2: early return callback", "callback({})")

// H. Store batch IPC
console.log("\nH. Store batch IPC")
contains(ipc, "H1: store-batch handler", "store-batch")
for (const action of ['"get"', '"set"', '"delete"', '"clear"', '"keys"', '"length"']) {
  check("H2: action " + action, ipc.includes("case " + action))
}
contains(preloadIndex, "H3: preload storeBatch", "storeBatch")
check("H4: preload types StoreBatchOp", preloadTypes.includes("StoreBatchOp"))
check("H5: preload types StoreBatchResult", preloadTypes.includes("StoreBatchResult"))
check("H6: preload types storeBatch", preloadTypes.includes("storeBatch"))

// Integration
console.log("\nIntegration")
contains(shellEnv, "I1: shell-env uses getStore", "getStore()")

// No regressions
console.log("\nNo regressions")
contains(migrate, "R1: TAURI_MIGRATED_KEY", "TAURI_MIGRATED_KEY")
contains(index, "R2: killSidecar present", "killSidecar")
contains(server, "R3: checkHealth present", "checkHealth")

console.log("\n=== Results: " + passed + " passed, " + failed + " failed ===")
if (failed > 0) process.exit(1)
