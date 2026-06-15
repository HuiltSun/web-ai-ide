# Neural Map 目录聚类与下钻导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Neural Map 中实现按目录层级下钻（子视图切换）、节点不重叠、全局主题常量。

**Architecture:** 导航栈模型——`store.navigationStack: NavigationLevel[]` 记录每一层视图，下钻时 push、返回时 pop，各层 graph+positions 独立缓存。`layout.ts` 增加碰撞消除后处理保证间距 ≥ 12px。所有颜色收归 `theme.ts`。

**Tech Stack:** SolidJS + SVG、Bun runtime、Hono API、Drizzle ORM（不变）

---

## File Map

| 文件 | 变更类型 | 职责 |
|---|---|---|
| `packages/opencode/src/neural-map/types.ts` | 修改 | 新增 `hasChildren: boolean` |
| `packages/opencode/src/neural-map/types.d.ts` | 修改 | 同步新增 `hasChildren: boolean` |
| `packages/opencode/src/neural-map/graph.ts` | 修改 | 计算 `hasChildren`，过滤散文件组，导出纯函数供测试 |
| `packages/opencode/src/neural-map/graph.test.ts` | 修改 | 新增 `hasChildren` 与过滤逻辑单元测试 |
| `packages/app/src/pages/neural-map/theme.ts` | 新建 | `NM_THEME` + `NODE_COLORS` 常量 |
| `packages/app/src/pages/neural-map/layout.ts` | 修改 | 导出 `nodeRadius`，增加碰撞后处理，节点接受 `radius` 参数 |
| `packages/app/src/pages/neural-map/layout.test.ts` | 修改 | 新增 `nodeRadius` 与碰撞消除测试 |
| `packages/app/src/pages/neural-map/store.ts` | 修改 | 导航栈替换扁平 graph/positions，新增 `drillLoading` |
| `packages/app/src/pages/neural-map/api.ts` | 修改 | `fetchGraph` 新增 `src` 参数 |
| `packages/app/src/pages/neural-map/Canvas.tsx` | 修改 | 下钻交互、⊕图标、从 theme.ts 引入颜色、从 layout.ts 引入 nodeRadius |
| `packages/app/src/pages/neural-map/GuidePanel.tsx` | 修改 | 所有硬编码颜色改为引用 `NM_THEME` |
| `packages/app/src/pages/neural-map/index.tsx` | 修改 | 面包屑导航、`handleDrillDown`、`handleBack`、引用 `NM_THEME` |

---

## Task 1: 类型层——新增 `hasChildren`

**Files:**
- Modify: `packages/opencode/src/neural-map/types.ts`
- Modify: `packages/opencode/src/neural-map/types.d.ts`

- [ ] **Step 1: 更新 `types.ts`**

```typescript
// packages/opencode/src/neural-map/types.ts
export interface GraphNode {
  id: string
  label: string
  path: string
  fileCount: number
  lineCount: number
  activity: number  // 0-100, based on git commit frequency
  understood: boolean
  hasChildren: boolean  // true if this directory contains sub-directories
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GuideResponse {
  intro: string
  quiz: string
  feedback?: string
  nextNodeId?: string
}

export interface ProgressEntry {
  nodeId: string
  understoodAt: number | null
  notes: string
}
```

- [ ] **Step 2: 同步更新 `types.d.ts`**

```typescript
// packages/opencode/src/neural-map/types.d.ts
export interface GraphNode {
    id: string;
    label: string;
    path: string;
    fileCount: number;
    lineCount: number;
    activity: number;
    understood: boolean;
    hasChildren: boolean;
}
export interface GraphEdge {
    source: string;
    target: string;
}
export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}
export interface GuideResponse {
    intro: string;
    quiz: string;
    feedback?: string;
    nextNodeId?: string;
}
export interface ProgressEntry {
    nodeId: string;
    understoodAt: number | null;
    notes: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/opencode/src/neural-map/types.ts packages/opencode/src/neural-map/types.d.ts
git commit -m "feat(neural-map): add hasChildren field to GraphNode type"
```

---

## Task 2: Graph Builder——`hasChildren` 与散文件过滤

**Files:**
- Modify: `packages/opencode/src/neural-map/graph.ts`
- Modify: `packages/opencode/src/neural-map/graph.test.ts`

- [ ] **Step 1: 写失败测试（纯函数）**

在 `graph.test.ts` 末尾追加：

```typescript
import { computeHasChildren, isDirectoryGroup } from "./graph"

test("computeHasChildren: returns true when group contains sub-directories", () => {
  // "agent/runtime/index.ts" → split('/').length === 3 > 2
  expect(computeHasChildren(["agent/runtime/index.ts", "agent/types.ts"])).toBe(true)
})

test("computeHasChildren: returns false when all files are direct children", () => {
  // "agent/index.ts" → split('/').length === 2, not > 2
  expect(computeHasChildren(["agent/index.ts", "agent/types.ts"])).toBe(false)
})

test("isDirectoryGroup: returns false for root-level file groups", () => {
  // file directly in srcDir, no slash: ["index.ts"]
  expect(isDirectoryGroup(["index.ts"])).toBe(false)
})

test("isDirectoryGroup: returns true for directory groups", () => {
  expect(isDirectoryGroup(["agent/index.ts", "agent/types.ts"])).toBe(true)
})

test("buildGraph nodes include hasChildren field", async () => {
  const srcDir = path.join(import.meta.dirname, "../")
  const cwd = path.join(import.meta.dirname, "../../")
  const { nodes } = await buildGraph(srcDir, cwd)
  for (const node of nodes) {
    expect(typeof node.hasChildren).toBe("boolean")
  }
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/opencode && bun test src/neural-map/graph.test.ts
```

Expected: FAIL — `computeHasChildren is not a function` (或类似)

- [ ] **Step 3: 在 `graph.ts` 中导出纯函数并更新 `buildGraph`**

完整替换 `packages/opencode/src/neural-map/graph.ts`：

```typescript
import path from "path"
import { Glob } from "bun"
import { $ } from "bun"
import type { GraphData, GraphNode, GraphEdge } from "./types"

function extractRelativeImports(content: string, filePath: string, srcDir: string): string[] {
  const results: string[] = []
  const patterns = [
    /(?:import|export)[^;'"]*from\s+['"]([^'"]+)['"]/gm,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ]
  for (const re of patterns) {
    for (const m of content.matchAll(re)) {
      const spec = m[1]
      if (!spec.startsWith(".")) continue
      const abs = path.resolve(path.dirname(filePath), spec)
      results.push(path.relative(srcDir, abs).replace(/\\/g, "/"))
    }
  }
  return results
}

function topLevel(relPath: string): string {
  return relPath.split("/")[0]
}

// Exported for unit testing
export function computeHasChildren(groupFiles: string[]): boolean {
  return groupFiles.some(f => f.split("/").length > 2)
}

// Exported for unit testing
export function isDirectoryGroup(groupFiles: string[]): boolean {
  return groupFiles.some(f => f.includes("/"))
}

export async function buildGraph(srcDir: string, cwd: string): Promise<GraphData> {
  const glob = new Glob("**/*.{ts,tsx,js,jsx}")
  const files: string[] = []

  for await (const f of glob.scan({ cwd: srcDir, absolute: false })) {
    const normalized = f.replace(/\\/g, "/")
    if (!normalized.includes("node_modules") && !normalized.endsWith(".d.ts")) {
      files.push(normalized)
    }
  }

  // Group files by top-level directory (= "module node")
  const groups = new Map<string, string[]>()
  for (const f of files) {
    const key = topLevel(f)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(f)
  }

  const edgeSet = new Set<string>()
  const activityMap = new Map<string, number>()
  const lineMap = new Map<string, number>()

  const activityPromises = [...groups.keys()].map(async (group) => {
    const dirPath = path.join(srcDir, group)
    const result = await $`git log --oneline -- ${dirPath}`.cwd(cwd).quiet().nothrow()
    const commits = result.stdout.toString().split("\n").filter(Boolean).length
    return [group, Math.min(commits, 100)] as [string, number]
  })

  const activityEntries = await Promise.all(activityPromises)
  for (const [group, activity] of activityEntries) {
    activityMap.set(group, activity)
  }

  for (const [group, groupFiles] of groups) {
    let totalLines = 0

    for (const f of groupFiles) {
      const abs = path.join(srcDir, f)
      const content = await Bun.file(abs).text().catch(() => "")
      totalLines += content.split("\n").length

      const imports = extractRelativeImports(content, abs, srcDir)
      for (const imp of imports) {
        const target = topLevel(imp)
        if (target && target !== group && groups.has(target)) {
          edgeSet.add(`${group}→${target}`)
        }
      }
    }

    lineMap.set(group, totalLines)
  }

  // Filter out root-level file groups (all files sit directly in srcDir with no sub-path)
  // then compute hasChildren for the remaining directory groups
  const nodes: GraphNode[] = [...groups.entries()]
    .filter(([, files]) => isDirectoryGroup(files))
    .map(([id, files]) => ({
      id,
      label: id,
      path: path.join(srcDir, id),
      fileCount: files.length,
      lineCount: lineMap.get(id) ?? 0,
      activity: activityMap.get(id) ?? 0,
      understood: false,
      hasChildren: computeHasChildren(files),
    }))

  const nodeIds = new Set(nodes.map(n => n.id))

  const edges: GraphEdge[] = [...edgeSet]
    .filter(key => {
      const sep = key.indexOf("→")
      return nodeIds.has(key.slice(0, sep)) && nodeIds.has(key.slice(sep + 1))
    })
    .map((key) => {
      const sep = key.indexOf("→")
      return { source: key.slice(0, sep), target: key.slice(sep + 1) }
    })

  return { nodes, edges }
}
```

- [ ] **Step 4: 运行测试确认全部通过**

```bash
cd packages/opencode && bun test src/neural-map/graph.test.ts
```

Expected: 所有测试 PASS（包括原有的 3 个集成测试和新增的 5 个）

- [ ] **Step 5: Commit**

```bash
git add packages/opencode/src/neural-map/graph.ts packages/opencode/src/neural-map/graph.test.ts
git commit -m "feat(neural-map): implement hasChildren and filter root-level file groups"
```

---

## Task 3: 主题常量——创建 `theme.ts`

**Files:**
- Create: `packages/app/src/pages/neural-map/theme.ts`

- [ ] **Step 1: 创建文件**

```typescript
// packages/app/src/pages/neural-map/theme.ts
export const NM_THEME = {
  bg:          "#0d1117",
  surface:     "#161b22",
  border:      "#21262d",
  textPrimary: "#cdd9e5",
  textMuted:   "#8b949e",
  accent:      "#58a6ff",
  understood:  "#3fb950",
  active:      "#d29922",
  danger:      "#f78166",
  purple:      "#bc8cff",
} as const

export interface NodeColor { fill: string; stroke: string }

export const NODE_COLORS: Record<string, NodeColor> = {
  agent:    { fill: "#0d2040", stroke: NM_THEME.accent },
  auth:     { fill: "#0a2618", stroke: NM_THEME.understood },
  provider: { fill: "#2d1d04", stroke: NM_THEME.active },
  storage:  { fill: "#1a0a2e", stroke: NM_THEME.purple },
  server:   { fill: "#2d0f0f", stroke: NM_THEME.danger },
  session:  { fill: "#0d1b2e", stroke: "#79c0ff" },
  neural:   { fill: "#1a0a2e", stroke: NM_THEME.purple },
  lsp:      { fill: "#0a1a2e", stroke: "#79c0ff" },
  format:   { fill: "#1a1a0a", stroke: NM_THEME.active },
}

export const NODE_DEFAULT_COLOR: NodeColor = {
  fill:   NM_THEME.surface,
  stroke: NM_THEME.textMuted,
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/pages/neural-map/theme.ts
git commit -m "feat(neural-map): add NM_THEME and NODE_COLORS constants"
```

---

## Task 4: Layout——导出 `nodeRadius` + 碰撞消除

**Files:**
- Modify: `packages/app/src/pages/neural-map/layout.ts`
- Modify: `packages/app/src/pages/neural-map/layout.test.ts`

- [ ] **Step 1: 写失败测试**

在 `layout.test.ts` 末尾追加：

```typescript
import { nodeRadius } from "./layout"

test("nodeRadius returns base value for zero activity and single file", () => {
  // base=28, actBonus=sqrt(0)*1.5=0, sizeBonus=min(1,20)*0.8=0.8 → round(28.8)=29
  expect(nodeRadius(0, 1)).toBe(29)
})

test("nodeRadius increases with activity and file count", () => {
  // base=28, actBonus=sqrt(100)*1.5=15, sizeBonus=min(20,20)*0.8=16 → round(59)=59
  expect(nodeRadius(100, 20)).toBe(59)
  expect(nodeRadius(100, 20)).toBeGreaterThan(nodeRadius(0, 1))
})

test("computeLayout avoids node overlap with explicit radii", () => {
  const r = 30
  const gap = 12
  const nodes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, radius: r }))
  const positions = computeLayout(nodes, [], 800, 600)
  const posArray = [...positions.values()]
  for (let i = 0; i < posArray.length; i++) {
    for (let j = i + 1; j < posArray.length; j++) {
      const dx = posArray[j].x - posArray[i].x
      const dy = posArray[j].y - posArray[i].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      // Allow 1px floating point tolerance
      expect(dist).toBeGreaterThanOrEqual(r + r + gap - 1)
    }
  }
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/app && bun test src/pages/neural-map/layout.test.ts
```

Expected: FAIL — `nodeRadius is not a function`

- [ ] **Step 3: 重写 `layout.ts`**

```typescript
// packages/app/src/pages/neural-map/layout.ts
export interface Position {
  x: number
  y: number
}

const DEFAULT_RADIUS = 40
const COLLISION_GAP = 12
const MAX_COLLISION_PASSES = 80

export function nodeRadius(activity: number, fileCount: number): number {
  const base = 28
  const actBonus = Math.sqrt(activity) * 1.5
  const sizeBonus = Math.min(fileCount, 20) * 0.8
  return Math.round(base + actBonus + sizeBonus)
}

export function computeLayout(
  nodes: Array<{ id: string; radius?: number }>,
  edges: { source: string; target: string }[],
  width: number,
  height: number,
): Map<string, Position> {
  const positions = new Map<string, Position>()
  const count = nodes.length
  if (count === 0) return positions

  const cx = width / 2
  const cy = height / 2
  const initR = Math.min(width, height) * 0.35
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count
    positions.set(nodes[i].id, {
      x: cx + initR * Math.cos(angle),
      y: cy + initR * Math.sin(angle),
    })
  }

  const REST = 240
  const KR = 80000
  const KS = 0.015
  const ITERS = 600
  const PAD = 110

  const ids = nodes.map((n) => n.id)
  const radii = nodes.map(n => n.radius ?? DEFAULT_RADIUS)

  for (let iter = 0; iter < ITERS; iter++) {
    const temp = 1 - iter / ITERS
    const maxStep = 4 + 56 * temp

    const fx = new Float64Array(count)
    const fy = new Float64Array(count)

    for (let i = 0; i < count; i++) {
      const a = positions.get(ids[i])!
      for (let j = i + 1; j < count; j++) {
        const b = positions.get(ids[j])!
        let dx = b.x - a.x
        let dy = b.y - a.y
        if (dx === 0 && dy === 0) { dx = 0.1; dy = 0.1 }
        const distSq = Math.max(dx * dx + dy * dy, 1)
        const dist = Math.sqrt(distSq)
        const f = KR / distSq
        const ffx = (dx / dist) * f
        const ffy = (dy / dist) * f
        fx[i] -= ffx; fy[i] -= ffy
        fx[j] += ffx; fy[j] += ffy
      }
    }

    for (const { source, target } of edges) {
      const si = ids.indexOf(source)
      const ti = ids.indexOf(target)
      if (si < 0 || ti < 0) continue
      const a = positions.get(source)!
      const b = positions.get(target)!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const f = (dist - REST) * KS
      const ffx = (dx / dist) * f
      const ffy = (dy / dist) * f
      fx[si] += ffx; fy[si] += ffy
      fx[ti] -= ffx; fy[ti] -= ffy
    }

    for (let i = 0; i < count; i++) {
      const pos = positions.get(ids[i])!
      const mag = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i])
      const scale = mag > maxStep ? maxStep / mag : 1
      pos.x = Math.max(PAD, Math.min(width - PAD, pos.x + fx[i] * scale))
      pos.y = Math.max(PAD, Math.min(height - PAD, pos.y + fy[i] * scale))
    }
  }

  // Post-pass: Gauss-Seidel collision resolution — guarantees gap ≥ COLLISION_GAP
  for (let pass = 0; pass < MAX_COLLISION_PASSES; pass++) {
    let anyOverlap = false
    for (let i = 0; i < count; i++) {
      const a = positions.get(ids[i])!
      for (let j = i + 1; j < count; j++) {
        const b = positions.get(ids[j])!
        const minDist = radii[i] + radii[j] + COLLISION_GAP
        let dx = b.x - a.x
        let dy = b.y - a.y
        if (dx === 0 && dy === 0) { dx = 0.1; dy = 0.1 }
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < minDist) {
          anyOverlap = true
          const push = (minDist - dist) / 2 + 0.5
          const nx = dx / dist
          const ny = dy / dist
          a.x = Math.max(PAD, Math.min(width - PAD, a.x - nx * push))
          a.y = Math.max(PAD, Math.min(height - PAD, a.y - ny * push))
          b.x = Math.max(PAD, Math.min(width - PAD, b.x + nx * push))
          b.y = Math.max(PAD, Math.min(height - PAD, b.y + ny * push))
        }
      }
    }
    if (!anyOverlap) break
  }

  return positions
}
```

- [ ] **Step 4: 运行测试确认全部通过**

```bash
cd packages/app && bun test src/pages/neural-map/layout.test.ts
```

Expected: 所有测试 PASS（原有 2 个 + 新增 3 个）

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/pages/neural-map/layout.ts packages/app/src/pages/neural-map/layout.test.ts
git commit -m "feat(neural-map): export nodeRadius, add collision avoidance post-pass"
```

---

## Task 5: Store——导航栈

**Files:**
- Modify: `packages/app/src/pages/neural-map/store.ts`

- [ ] **Step 1: 完整替换 `store.ts`**

```typescript
// packages/app/src/pages/neural-map/store.ts
import { createStore } from "solid-js/store"
import type { GraphData, GraphNode, GuideResponse } from "./api"
import { computeLayout, nodeRadius } from "./layout"

export interface NavigationLevel {
  path: string                              // src relative path used for API call
  label: string                             // display name (last segment)
  graph: GraphData
  positions: Map<string, { x: number; y: number }>
}

export interface GuideState {
  loading: boolean
  response: GuideResponse | null
  answer: string
  showFeedback: boolean
}

export interface NeuralMapState {
  navigationStack: NavigationLevel[]
  selectedNodeId: string | null
  understoodNodeIds: Set<string>
  guide: GuideState
  loading: boolean
  drillLoading: boolean
  error: string | null
}

const initialGuide: GuideState = {
  loading: false,
  response: null,
  answer: "",
  showFeedback: false,
}

function buildLevel(
  path: string,
  label: string,
  graph: GraphData,
  width: number,
  height: number,
): NavigationLevel {
  const nodesWithRadius = graph.nodes.map(n => ({
    id: n.id,
    radius: nodeRadius(n.activity, n.fileCount),
  }))
  const positions = computeLayout(nodesWithRadius, graph.edges, width, height)
  return { path, label, graph, positions }
}

export function createNeuralMapStore() {
  const [state, setState] = createStore<NeuralMapState>({
    navigationStack: [],
    selectedNodeId: null,
    understoodNodeIds: new Set(),
    guide: { ...initialGuide },
    loading: false,
    drillLoading: false,
    error: null,
  })

  function currentLevel(): NavigationLevel | null {
    return state.navigationStack[state.navigationStack.length - 1] ?? null
  }

  function loadGraph(path: string, label: string, graph: GraphData, width: number, height: number) {
    const level = buildLevel(path, label, graph, width, height)
    setState({ navigationStack: [level], loading: false, error: null })
  }

  function pushLevel(path: string, label: string, graph: GraphData, width: number, height: number) {
    const level = buildLevel(path, label, graph, width, height)
    setState("navigationStack", (prev) => [...prev, level])
    setState({ drillLoading: false, selectedNodeId: null, guide: { ...initialGuide } })
  }

  // targetIndex: keep stack[0..targetIndex] inclusive; defaults to going back one level
  function popLevel(targetIndex?: number) {
    const target = targetIndex ?? state.navigationStack.length - 2
    if (target < 0) return
    setState("navigationStack", (prev) => prev.slice(0, target + 1))
    setState({ selectedNodeId: null, guide: { ...initialGuide } })
  }

  function selectNode(nodeId: string | null) {
    setState({ selectedNodeId: nodeId, guide: { ...initialGuide } })
  }

  function setGuideLoading(loading: boolean) {
    setState("guide", "loading", loading)
  }

  function setGuideResponse(response: GuideResponse) {
    setState("guide", { response, loading: false, showFeedback: false })
  }

  function setAnswer(answer: string) {
    setState("guide", "answer", answer)
  }

  function showFeedback() {
    setState("guide", "showFeedback", true)
  }

  function markUnderstood(nodeId: string) {
    setState("understoodNodeIds", (prev) => new Set([...prev, nodeId]))
  }

  function unmarkUnderstood(nodeId: string) {
    setState("understoodNodeIds", (prev) => {
      const next = new Set(prev)
      next.delete(nodeId)
      return next
    })
  }

  function setLoading(loading: boolean) {
    setState({ loading })
  }

  function setDrillLoading(loading: boolean) {
    setState("drillLoading", loading)
  }

  function setError(error: string | null) {
    setState({ error, loading: false })
  }

  function selectedNode(): GraphNode | null {
    const level = currentLevel()
    if (!state.selectedNodeId || !level) return null
    return level.graph.nodes.find((n) => n.id === state.selectedNodeId) ?? null
  }

  return {
    state,
    currentLevel,
    loadGraph,
    pushLevel,
    popLevel,
    selectNode,
    setGuideLoading,
    setGuideResponse,
    setAnswer,
    showFeedback,
    markUnderstood,
    unmarkUnderstood,
    setLoading,
    setDrillLoading,
    setError,
    selectedNode,
  }
}

export type NeuralMapStore = ReturnType<typeof createNeuralMapStore>
```

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/pages/neural-map/store.ts
git commit -m "feat(neural-map): replace flat graph state with navigation stack"
```

---

## Task 6: API——新增 `src` 参数

**Files:**
- Modify: `packages/app/src/pages/neural-map/api.ts`

- [ ] **Step 1: 更新 `fetchGraph` 签名**

完整替换 `packages/app/src/pages/neural-map/api.ts`：

```typescript
// packages/app/src/pages/neural-map/api.ts
import type { GraphData, GraphNode, GuideResponse, ProgressEntry } from "../../../../opencode/src/neural-map/types"

export type { GraphData, GraphNode, GuideResponse, ProgressEntry }

export interface PositionedNode extends GraphNode {
  x: number
  y: number
}

async function apiFetch(serverUrl: string, path: string, init?: RequestInit) {
  const res = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

export async function fetchGraph(
  serverUrl: string,
  directory?: string,
  src?: string,
): Promise<GraphData> {
  const params = new URLSearchParams()
  if (directory) params.set("directory", directory)
  if (src) params.set("src", src)
  const qs = params.size > 0 ? `?${params.toString()}` : ""
  return apiFetch(serverUrl, `/neural-map/graph${qs}`)
}

export async function fetchGuide(
  serverUrl: string,
  payload: {
    node: GraphNode
    allNodeIds: string[]
    understoodNodeIds: string[]
    userAnswer?: string
    sessionId: string
  },
): Promise<GuideResponse> {
  return apiFetch(serverUrl, "/neural-map/guide", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function fetchProgress(serverUrl: string, sessionId: string): Promise<ProgressEntry[]> {
  return apiFetch(serverUrl, `/neural-map/progress/${sessionId}`)
}

export async function markUnderstood(
  serverUrl: string,
  sessionId: string,
  nodeId: string,
  notes = "",
): Promise<void> {
  await apiFetch(serverUrl, `/neural-map/progress/${sessionId}/${nodeId}`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  })
}

export async function unmarkUnderstood(
  serverUrl: string,
  sessionId: string,
  nodeId: string,
): Promise<void> {
  await apiFetch(serverUrl, `/neural-map/progress/${sessionId}/${nodeId}`, {
    method: "DELETE",
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/pages/neural-map/api.ts
git commit -m "feat(neural-map): add src parameter to fetchGraph for sub-directory queries"
```

---

## Task 7: Canvas——下钻交互 + ⊕图标 + 主题

**Files:**
- Modify: `packages/app/src/pages/neural-map/Canvas.tsx`

- [ ] **Step 1: 完整替换 `Canvas.tsx`**

```typescript
// packages/app/src/pages/neural-map/Canvas.tsx
import { For, onMount, onCleanup } from "solid-js"
import type { NeuralMapStore } from "./store"
import type { GraphNode } from "./api"
import { NM_THEME, NODE_COLORS, NODE_DEFAULT_COLOR } from "./theme"
import { nodeRadius } from "./layout"

function nodeColor(id: string) {
  for (const [key, val] of Object.entries(NODE_COLORS)) {
    if (id.toLowerCase().includes(key)) return val
  }
  return NODE_DEFAULT_COLOR
}

export default function NeuralMapCanvas(props: {
  store: NeuralMapStore
  width: number
  height: number
  onDrillDown: (node: GraphNode) => void
}) {
  const { state } = props.store
  let svgRef!: SVGSVGElement
  let panX = 0
  let panY = 0
  let scale = 1
  let dragStart: { x: number; y: number; px: number; py: number } | null = null

  function applyTransform() {
    const g = svgRef?.querySelector("g.nm-root") as SVGGElement | null
    if (g) g.setAttribute("transform", `translate(${panX},${panY}) scale(${scale})`)
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const rect = svgRef.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (props.width / rect.width)
    const my = (e.clientY - rect.top) * (props.height / rect.height)
    const delta = e.deltaY > 0 ? 0.88 : 1.14
    const newScale = Math.max(0.15, Math.min(5, scale * delta))
    panX = mx - (mx - panX) * (newScale / scale)
    panY = my - (my - panY) * (newScale / scale)
    scale = newScale
    applyTransform()
  }

  function onMouseDown(e: MouseEvent) {
    if ((e.target as Element).closest("[data-node]")) return
    dragStart = { x: e.clientX, y: e.clientY, px: panX, py: panY }
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragStart) return
    const rect = svgRef.getBoundingClientRect()
    const scaleX = props.width / rect.width
    const scaleY = props.height / rect.height
    panX = dragStart.px + (e.clientX - dragStart.x) * scaleX
    panY = dragStart.py + (e.clientY - dragStart.y) * scaleY
    applyTransform()
  }

  function onMouseUp() { dragStart = null }

  onMount(() => {
    svgRef.addEventListener("wheel", onWheel, { passive: false })
  })
  onCleanup(() => {
    svgRef.removeEventListener("wheel", onWheel)
  })

  const level = () => props.store.currentLevel()

  return (
    <svg
      ref={svgRef!}
      width="100%"
      height="100%"
      viewBox={`0 0 ${props.width} ${props.height}`}
      style={{
        background: `radial-gradient(ellipse at 50% 50%, #0d1b2e 0%, ${NM_THEME.bg} 100%)`,
        cursor: "grab",
        display: "block",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <defs>
        <filter id="nm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nm-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g class="nm-root">
        {/* Edges */}
        <For each={level()?.graph.edges ?? []}>
          {(edge) => {
            const pos = level()?.positions
            const a = pos?.get(edge.source)
            const b = pos?.get(edge.target)
            if (!a || !b) return null
            const cx = (a.x + b.x) / 2 + (b.y - a.y) * 0.25
            const cy = (a.y + b.y) / 2 - (b.x - a.x) * 0.25
            return (
              <path
                d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`}
                fill="none"
                stroke={NM_THEME.accent}
                stroke-width="1.5"
                opacity="0.25"
              />
            )
          }}
        </For>

        {/* Nodes */}
        <For each={level()?.graph.nodes ?? []}>
          {(node) => {
            const pos = level()?.positions.get(node.id)
            if (!pos) return null
            const isSelected = () => state.selectedNodeId === node.id
            const isUnderstood = () => state.understoodNodeIds.has(node.id)
            const color = nodeColor(node.id)
            const r = nodeRadius(node.activity, node.fileCount)
            const strokeColor = () =>
              isSelected() ? NM_THEME.textPrimary
              : isUnderstood() ? NM_THEME.understood
              : color.stroke
            const fillColor = () => isUnderstood() ? "#0a2618" : color.fill

            return (
              <g
                data-node={node.id}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => props.store.selectNode(node.id)}
                onDblClick={(e) => {
                  e.stopPropagation()
                  if (node.hasChildren) props.onDrillDown(node)
                }}
              >
                {/* Outer pulse ring */}
                <circle r={r + 12} fill="none" stroke={strokeColor()} stroke-width="0.8" opacity="0.2" />
                {/* Glow base */}
                <circle r={r} fill={fillColor()} stroke={strokeColor()} stroke-width="2" filter="url(#nm-glow-sm)" />
                {/* Node label */}
                <text
                  text-anchor="middle"
                  dominant-baseline="middle"
                  y="-6"
                  fill={isUnderstood() ? NM_THEME.understood : NM_THEME.textPrimary}
                  font-size="14"
                  font-family="monospace"
                  font-weight="bold"
                  pointer-events="none"
                >
                  {isUnderstood() ? `✓ ${node.label}` : node.label}
                </text>
                {/* Sub-label: file count */}
                <text
                  text-anchor="middle"
                  dominant-baseline="middle"
                  y="10"
                  fill={color.stroke}
                  font-size="10"
                  font-family="monospace"
                  opacity="0.7"
                  pointer-events="none"
                >
                  {node.fileCount}f · {node.lineCount > 999 ? `${Math.round(node.lineCount / 1000)}k` : node.lineCount}L
                </text>
                {/* Drill-down badge for directories with children */}
                {node.hasChildren && (
                  <g transform={`translate(${r - 4},${-(r - 4)})`} pointer-events="none">
                    <circle r="8" fill={NM_THEME.bg} stroke={NM_THEME.accent} stroke-width="1.5" />
                    <text
                      text-anchor="middle"
                      dominant-baseline="middle"
                      fill={NM_THEME.accent}
                      font-size="10"
                      font-weight="bold"
                    >
                      ⊕
                    </text>
                  </g>
                )}
              </g>
            )
          }}
        </For>
      </g>
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/pages/neural-map/Canvas.tsx
git commit -m "feat(neural-map): add drill-down on dblclick, hasChildren badge, theme constants"
```

---

## Task 8: GuidePanel——主题颜色

**Files:**
- Modify: `packages/app/src/pages/neural-map/GuidePanel.tsx`

- [ ] **Step 1: 完整替换 `GuidePanel.tsx`**

```typescript
// packages/app/src/pages/neural-map/GuidePanel.tsx
import { Show, createSignal } from "solid-js"
import type { NeuralMapStore } from "./store"
import { NM_THEME } from "./theme"

export default function GuidePanel(props: {
  store: NeuralMapStore
  onAskGuide: (answer?: string) => Promise<void>
  onMarkUnderstood: () => Promise<void>
  onNavigateNext: () => void
}) {
  const { state, setAnswer } = props.store
  const [submitting, setSubmitting] = createSignal(false)

  async function submitAnswer() {
    setSubmitting(true)
    await props.onAskGuide(state.guide.answer)
    setSubmitting(false)
  }

  const node = () => props.store.selectedNode()
  const guide = () => state.guide
  const isUnderstood = () =>
    state.selectedNodeId ? state.understoodNodeIds.has(state.selectedNodeId) : false

  return (
    <div style={{
      width: "220px",
      "border-left": `1px solid ${NM_THEME.border}`,
      display: "flex",
      "flex-direction": "column",
      background: NM_THEME.bg,
      "font-family": "monospace",
    }}>
      <Show when={node()} fallback={
        <div style={{
          padding: "20px",
          color: NM_THEME.border,
          "font-size": "12px",
          "text-align": "center",
          "margin-top": "40px",
        }}>
          点击左侧节点<br />开始探索
        </div>
      }>
        {/* Node metadata */}
        <div style={{ padding: "12px", "border-bottom": `1px solid ${NM_THEME.border}` }}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-bottom": "8px" }}>
            <div style={{
              width: "8px", height: "8px", "border-radius": "50%",
              background: NM_THEME.accent, "box-shadow": `0 0 6px ${NM_THEME.accent}`,
            }} />
            <div style={{ "font-size": "11px", color: NM_THEME.textPrimary, "font-weight": "bold" }}>
              {node()!.id}
            </div>
          </div>
          <div style={{ "font-size": "9px", color: NM_THEME.textMuted, "line-height": "1.6", "margin-bottom": "8px" }}>
            {node()!.fileCount} 个文件 · {node()!.lineCount} 行
          </div>
          <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
            {node()!.activity > 60 && (
              <span style={{
                background: "#2d1d04", "border-radius": "3px",
                padding: "2px 6px", "font-size": "8px", color: NM_THEME.active,
              }}>高活跃</span>
            )}
            <span style={{
              background: NM_THEME.border, "border-radius": "3px",
              padding: "2px 6px", "font-size": "8px", color: NM_THEME.textMuted,
            }}>
              活跃度 {node()!.activity}
            </span>
          </div>
        </div>

        {/* AI conversation */}
        <div style={{
          flex: 1, padding: "10px", display: "flex",
          "flex-direction": "column", gap: "8px", "overflow-y": "auto",
        }}>
          <div style={{
            "font-size": "9px", color: NM_THEME.textMuted,
            "text-transform": "uppercase", "letter-spacing": "0.5px",
          }}>🤖 AI 向导</div>

          <Show when={!guide().loading && !guide().response}>
            <button
              style={{
                background: "#0d419d", "border-radius": "8px", padding: "10px",
                "font-size": "10px", color: NM_THEME.accent,
                border: "none", cursor: "pointer", "font-family": "monospace", width: "100%",
              }}
              onClick={() => void props.onAskGuide()}
            >
              🤖 开始解读这个模块
            </button>
          </Show>

          <Show when={guide().loading}>
            <div style={{
              background: NM_THEME.surface, "border-radius": "8px", padding: "8px",
              "font-size": "10px", color: NM_THEME.textMuted,
              "border-left": `2px solid ${NM_THEME.border}`,
            }}>
              正在思考...
            </div>
          </Show>

          <Show when={guide().response && !guide().loading}>
            <div style={{
              background: NM_THEME.surface, "border-radius": "8px", padding: "8px",
              "font-size": "10px", color: NM_THEME.textPrimary, "line-height": "1.5",
              "border-left": `2px solid ${NM_THEME.accent}`,
            }}>
              {guide().response!.intro}
            </div>

            <Show when={!guide().showFeedback}>
              <div style={{
                background: NM_THEME.surface, "border-radius": "8px", padding: "8px",
                "font-size": "10px", color: NM_THEME.textPrimary, "line-height": "1.5",
                "border-left": `2px solid ${NM_THEME.active}`,
              }}>
                🎯 <strong style={{ color: NM_THEME.active }}>猜一猜</strong><br />
                {guide().response!.quiz}
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <input
                  style={{
                    flex: 1, background: NM_THEME.surface,
                    border: `1px solid ${NM_THEME.border}`, "border-radius": "6px",
                    padding: "6px 8px", "font-size": "9px", color: NM_THEME.textPrimary,
                    outline: "none", "font-family": "monospace",
                  }}
                  placeholder="输入你的答案..."
                  value={guide().answer}
                  onInput={(e) => setAnswer(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void submitAnswer() }}
                />
                <button
                  style={{
                    background: "#0d419d", "border-radius": "6px", padding: "6px 8px",
                    "font-size": "9px", color: NM_THEME.accent, border: "none", cursor: "pointer",
                  }}
                  onClick={() => void submitAnswer()}
                  disabled={submitting()}
                >
                  ↵
                </button>
              </div>
            </Show>

            <Show when={guide().showFeedback && guide().response?.feedback}>
              <div style={{
                background: "#0a2618", "border-radius": "8px", padding: "8px",
                "font-size": "10px", color: NM_THEME.understood, "line-height": "1.5",
              }}>
                ✓ {guide().response!.feedback}
              </div>
            </Show>
          </Show>
        </div>

        {/* Actions */}
        <div style={{
          padding: "10px", "border-top": `1px solid ${NM_THEME.border}`,
          display: "flex", "flex-direction": "column", gap: "6px",
        }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              style={{
                flex: 1, background: isUnderstood() ? "#0a2618" : NM_THEME.border,
                "border-radius": "6px", padding: "5px", "text-align": "center",
                "font-size": "9px",
                color: isUnderstood() ? NM_THEME.understood : NM_THEME.textMuted,
                border: "none", cursor: "pointer", "font-family": "monospace",
              }}
              onClick={() => void props.onMarkUnderstood()}
            >
              {isUnderstood() ? "✓ 已理解" : "标记已懂"}
            </button>
            <button
              style={{
                flex: 1, background: "#0d419d", "border-radius": "6px", padding: "5px",
                "text-align": "center", "font-size": "9px", color: NM_THEME.accent,
                border: "none", cursor: "pointer", "font-family": "monospace",
              }}
              onClick={props.onNavigateNext}
            >
              → 下一站
            </button>
          </div>
          <Show when={guide().response?.nextNodeId}>
            <div style={{
              background: "#1c1f06", "border-radius": "6px", padding: "6px",
              "font-size": "9px", color: NM_THEME.active, "text-align": "center",
            }}>
              🎯 推荐: {guide().response!.nextNodeId}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/pages/neural-map/GuidePanel.tsx
git commit -m "feat(neural-map): replace hardcoded colors with NM_THEME in GuidePanel"
```

---

## Task 9: Index——面包屑 + 下钻处理 + 主题

**Files:**
- Modify: `packages/app/src/pages/neural-map/index.tsx`

- [ ] **Step 1: 完整替换 `index.tsx`**

```typescript
// packages/app/src/pages/neural-map/index.tsx
import { createSignal, onMount, Show, For } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { useServer } from "@/context/server"
import { decode64 } from "@/utils/base64"
import { createNeuralMapStore } from "./store"
import { fetchGraph, fetchGuide, fetchProgress, markUnderstood, unmarkUnderstood } from "./api"
import type { GraphNode } from "./api"
import NeuralMapCanvas from "./Canvas"
import GuidePanel from "./GuidePanel"
import { NM_THEME } from "./theme"

const SESSION_ID = "neural-map-global"
const CANVAS_WIDTH = 1400
const CANVAS_HEIGHT = 800
const INITIAL_SRC = "packages/opencode/src"

export default function NeuralMapPage() {
  const server = useServer()
  const navigate = useNavigate()
  const params = useParams()
  const store = createNeuralMapStore()
  const [toast, setToast] = createSignal("")

  const serverUrl = () => server.current?.http.url ?? ""
  const directory = () => decode64(params.dir)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  onMount(async () => {
    store.setLoading(true)
    try {
      const [graph, progress] = await Promise.all([
        fetchGraph(serverUrl(), directory(), INITIAL_SRC),
        fetchProgress(serverUrl(), SESSION_ID),
      ])
      store.loadGraph(INITIAL_SRC, "src", graph, CANVAS_WIDTH, CANVAS_HEIGHT)
      for (const entry of progress) {
        if (entry.understoodAt) store.markUnderstood(entry.nodeId)
      }
    } catch (e) {
      store.setError(String(e))
    }
  })

  async function handleDrillDown(node: GraphNode) {
    if (!node.hasChildren) return
    const level = store.currentLevel()
    if (!level) return
    const newSrc = `${level.path}/${node.id}`
    store.setDrillLoading(true)
    try {
      const graph = await fetchGraph(serverUrl(), directory(), newSrc)
      if (graph.nodes.length === 0) {
        showToast("此目录无可展示的子模块")
        store.setDrillLoading(false)
        return
      }
      store.pushLevel(newSrc, node.id, graph, CANVAS_WIDTH, CANVAS_HEIGHT)
    } catch {
      store.setDrillLoading(false)
      showToast("加载子目录失败，请重试")
    }
  }

  async function handleAskGuide(userAnswer?: string) {
    const node = store.selectedNode()
    const level = store.currentLevel()
    if (!node || !level) return
    store.setGuideLoading(true)
    try {
      const response = await fetchGuide(serverUrl(), {
        node,
        allNodeIds: level.graph.nodes.map((n) => n.id),
        understoodNodeIds: [...store.state.understoodNodeIds],
        userAnswer,
        sessionId: SESSION_ID,
      })
      store.setGuideResponse(response)
      if (userAnswer) store.showFeedback()
    } catch {
      store.setGuideLoading(false)
    }
  }

  async function handleMarkUnderstood() {
    const nodeId = store.state.selectedNodeId
    if (!nodeId) return
    if (store.state.understoodNodeIds.has(nodeId)) {
      await unmarkUnderstood(serverUrl(), SESSION_ID, nodeId)
      store.unmarkUnderstood(nodeId)
    } else {
      await markUnderstood(serverUrl(), SESSION_ID, nodeId)
      store.markUnderstood(nodeId)
    }
  }

  function handleNavigateNext() {
    const nextId = store.state.guide.response?.nextNodeId
    const level = store.currentLevel()
    if (nextId && level) {
      const found = level.graph.nodes.find((n) => n.id === nextId)
      if (found) {
        store.selectNode(nextId)
        void handleAskGuide()
      }
    }
  }

  const total = () => store.currentLevel()?.graph.nodes.length ?? 0
  const understood = () => store.state.understoodNodeIds.size
  const pct = () => total() > 0 ? Math.round((understood() / total()) * 100) : 0

  return (
    <div style={{
      position: "fixed", inset: "0", "z-index": "9999",
      display: "flex", "flex-direction": "column",
      background: NM_THEME.bg, color: NM_THEME.textPrimary,
    }}>
      {/* Top bar */}
      <div style={{
        background: NM_THEME.surface,
        "border-bottom": `1px solid ${NM_THEME.border}`,
        padding: "6px 16px", display: "flex",
        "align-items": "center", gap: "8px", "flex-shrink": 0,
      }}>
        <div style={{ "font-size": "10px", color: NM_THEME.bg, "font-family": "monospace",
          background: "#0d419d", "border-radius": "4px", padding: "3px 10px",
          "font-weight": "bold", color: NM_THEME.accent, "flex-shrink": 0,
        }}>
          ⬡ NEURAL MAP
        </div>

        {/* Breadcrumb */}
        <div style={{
          display: "flex", "align-items": "center", gap: "4px",
          "font-size": "11px", "font-family": "monospace", overflow: "hidden",
        }}>
          <For each={store.state.navigationStack}>
            {(level, i) => (
              <>
                {i() > 0 && (
                  <span style={{ color: NM_THEME.textMuted, "flex-shrink": 0 }}>›</span>
                )}
                <span
                  style={{
                    color: i() === store.state.navigationStack.length - 1
                      ? NM_THEME.accent
                      : NM_THEME.textMuted,
                    cursor: i() < store.state.navigationStack.length - 1 ? "pointer" : "default",
                    "white-space": "nowrap",
                  }}
                  onClick={() => {
                    if (i() < store.state.navigationStack.length - 1) {
                      store.popLevel(i())
                    }
                  }}
                >
                  {level.label}
                </span>
              </>
            )}
          </For>
        </div>

        <div style={{ "margin-left": "auto", display: "flex", "align-items": "center", gap: "10px" }}>
          <Show when={total() > 0}>
            <div style={{ "font-size": "10px", color: NM_THEME.understood, "font-family": "monospace" }}>
              ● 已理解 {understood()} / {total()} ({pct()}%)
            </div>
            <div style={{
              background: NM_THEME.border, "border-radius": "12px",
              height: "6px", width: "80px", overflow: "hidden",
            }}>
              <div style={{
                width: `${pct()}%`, height: "100%",
                background: `linear-gradient(90deg,${NM_THEME.understood},${NM_THEME.accent})`,
                "border-radius": "12px", transition: "width 0.3s",
              }} />
            </div>
          </Show>
          <div style={{ width: "1px", height: "16px", background: NM_THEME.border }} />
          <button
            style={{
              "font-size": "10px", color: NM_THEME.textMuted,
              background: "none", border: "none", cursor: "pointer", "font-family": "monospace",
            }}
            onClick={() => navigate(-1)}
          >
            ✕ 退出模式
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <Show when={store.state.loading}>
          <div style={{
            flex: 1, display: "flex", "align-items": "center",
            "justify-content": "center", color: NM_THEME.textMuted, "font-size": "14px",
          }}>
            正在构建代码神经图...
          </div>
        </Show>
        <Show when={store.state.error}>
          <div style={{
            flex: 1, display: "flex", "align-items": "center",
            "justify-content": "center", color: NM_THEME.danger, "font-size": "14px",
          }}>
            {store.state.error}
          </div>
        </Show>
        <Show when={!store.state.loading && !store.state.error && store.currentLevel()}>
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <NeuralMapCanvas
              store={store}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onDrillDown={handleDrillDown}
            />
            {/* Drill loading overlay */}
            <Show when={store.state.drillLoading}>
              <div style={{
                position: "absolute", inset: "0",
                background: "rgba(13,17,23,0.75)",
                display: "flex", "align-items": "center", "justify-content": "center",
                color: NM_THEME.textMuted, "font-size": "13px", "font-family": "monospace",
              }}>
                正在加载子目录...
              </div>
            </Show>
          </div>
          <GuidePanel
            store={store}
            onAskGuide={handleAskGuide}
            onMarkUnderstood={handleMarkUnderstood}
            onNavigateNext={handleNavigateNext}
          />
        </Show>

        {/* Toast notification */}
        <Show when={toast()}>
          <div style={{
            position: "absolute", bottom: "20px", left: "50%",
            transform: "translateX(-50%)",
            background: NM_THEME.surface, border: `1px solid ${NM_THEME.border}`,
            "border-radius": "8px", padding: "8px 16px",
            "font-size": "12px", "font-family": "monospace",
            color: NM_THEME.textMuted, "pointer-events": "none",
            "z-index": "10",
          }}>
            {toast()}
          </div>
        </Show>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/pages/neural-map/index.tsx
git commit -m "feat(neural-map): add breadcrumb navigation, drill-down handler, NM_THEME, toast"
```

---

---

## Gap Fix: 大节点数布局简化（> 150 节点）

**规格要求**: 节点数 > 150 时跳过碰撞迭代，Toast"布局已简化"。此修复分布在 Task 4、5、9。

### 4-A: `layout.ts` — 动态碰撞迭代数

在 `computeLayout` 函数体内，将：
```typescript
  for (let pass = 0; pass < MAX_COLLISION_PASSES; pass++) {
```
替换为：
```typescript
  const collisionPasses = count > 150 ? 10 : MAX_COLLISION_PASSES
  for (let pass = 0; pass < collisionPasses; pass++) {
```

### 5-A: `store.ts` — `NavigationLevel` 新增 `layoutSimplified`

1. `NavigationLevel` 接口新增字段：
```typescript
  layoutSimplified: boolean
```

2. `buildLevel` 函数末尾改为：
```typescript
  const layoutSimplified = graph.nodes.length > 150
  const positions = computeLayout(nodesWithRadius, graph.edges, width, height)
  return { path, label, graph, positions, layoutSimplified }
```

### 9-A: `index.tsx` — 初始加载与下钻后检查并 Toast

在 `store.loadGraph(...)` 调用后添加：
```typescript
      store.loadGraph(INITIAL_SRC, "src", graph, CANVAS_WIDTH, CANVAS_HEIGHT)
      if (store.currentLevel()?.layoutSimplified) showToast("布局已简化（节点数超过 150）")
```

在 `store.pushLevel(...)` 调用后添加：
```typescript
      store.pushLevel(newSrc, node.id, graph, CANVAS_WIDTH, CANVAS_HEIGHT)
      if (store.currentLevel()?.layoutSimplified) showToast("布局已简化（节点数超过 150）")
```

- [ ] **应用以上三处修改后 commit**

```bash
git add packages/app/src/pages/neural-map/layout.ts \
        packages/app/src/pages/neural-map/store.ts \
        packages/app/src/pages/neural-map/index.tsx
git commit -m "feat(neural-map): limit collision passes for large graphs, show simplification toast"
```

---

## 验收检查

完成所有 Task 后，手动验证以下场景（无自动化测试覆盖 UI 层）：

- [ ] 启动应用，进入 Neural Map 模式：图谱在 10 秒内渲染，无节点重叠
- [ ] 双击一个 `hasChildren=true` 的节点（带 ⊕ 图标）：画布切换，面包屑追加新段
- [ ] 继续下钻 ≥ 3 层：面包屑正确显示路径
- [ ] 点击面包屑中间某段：画布返回至该层，无网络请求（观察 Network tab）
- [ ] 点击「← 返回」（导航 -1）退出 Neural Map 模式
- [ ] 标记某节点为"已理解"，退出再进入：绿色 ✓ 保留
- [ ] 双击 `hasChildren=false` 节点：无任何反应（不切换视图）
- [ ] 下钻一个空子目录：Toast 提示"此目录无可展示的子模块"，画布不变
- [ ] 检查根视图和所有子视图背景色、文字色一致（均来自 `NM_THEME`）
