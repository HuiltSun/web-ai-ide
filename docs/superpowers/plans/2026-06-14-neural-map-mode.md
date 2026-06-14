# Code Neural Map Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Neural Map" mode to the Electron client that renders the codebase as an interactive force-directed neural graph, with an AI guide panel that actively teaches users by asking Socratic questions about each module.

**Architecture:** A new backend module (`packages/opencode/src/neural-map/`) parses import statements to build a directed graph, runs a git-commit-frequency activity score, and exposes three HTTP endpoints (`/neural-map/graph`, `/neural-map/guide`, `/neural-map/progress`). The frontend (`packages/app/src/pages/neural-map/`) renders a pure-SVG force-directed canvas in SolidJS, a right-side AI guide panel with conversation bubbles, and stores understanding progress in SQLite via the existing migration system.

**Tech Stack:** Bun Glob + Bun Shell for graph building; Drizzle ORM + SQLite for progress; Hono routes via `lazy()` pattern; SolidJS signals/stores + SVG for canvas; Vercel AI SDK `generateText` for the guide; `useServer()` + `fetch` for frontend API calls.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `packages/opencode/src/neural-map/types.ts` | Shared TypeScript interfaces: `GraphNode`, `GraphEdge`, `GraphData`, `GuideResponse`, `ProgressEntry` |
| `packages/opencode/src/neural-map/neural-map.sql.ts` | Drizzle table definition for `neural_map_progress` |
| `packages/opencode/src/neural-map/graph.ts` | Walk directory → parse imports → compute activity scores → return `GraphData` |
| `packages/opencode/src/neural-map/guide.ts` | Build AI prompt from node metadata + call `generateText` → return `GuideResponse` |
| `packages/opencode/src/server/routes/instance/neural-map.ts` | Hono route handlers: GET `/neural-map/graph`, POST `/neural-map/guide`, GET/POST/DELETE `/neural-map/progress/:nodeId` |
| `packages/opencode/migration/20260614000000_neural_map/migration.sql` | CREATE TABLE for `neural_map_progress` |
| `packages/app/src/pages/neural-map/types.ts` | Frontend-only types (re-exports backend types, adds `x`/`y` position fields) |
| `packages/app/src/pages/neural-map/api.ts` | Thin fetch wrappers for the three backend endpoints |
| `packages/app/src/pages/neural-map/layout.ts` | Pure-TS spring force-directed layout algorithm |
| `packages/app/src/pages/neural-map/store.ts` | SolidJS store: graph data, selected node, positions, progress, guide state |
| `packages/app/src/pages/neural-map/Canvas.tsx` | SVG canvas: nodes, organic Bézier edges, glow filters, flow particles |
| `packages/app/src/pages/neural-map/GuidePanel.tsx` | Right panel: node metadata, AI conversation bubbles, answer input, action buttons |
| `packages/app/src/pages/neural-map/index.tsx` | Top-level page: layout shell, progress bar, mode exit button |

### Files to modify

| File | Change |
|------|--------|
| `packages/opencode/src/storage/schema.ts` | Add export of `NeuralMapProgressTable` |
| `packages/opencode/src/server/routes/instance/index.ts` | Add `.route("/neural-map", NeuralMapRoutes())` |
| `packages/app/src/app.tsx` | Add `<Route path="/:dir/neural-map" component={NeuralMapPage} />` |

---

## Task 1: Shared Types

**Files:**
- Create: `packages/opencode/src/neural-map/types.ts`

- [ ] **Step 1: Write the types file**

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

- [ ] **Step 2: Commit**

```bash
git add packages/opencode/src/neural-map/types.ts
git commit -m "feat(neural-map): add shared TypeScript types"
```

---

## Task 2: Database Migration + Schema

**Files:**
- Create: `packages/opencode/migration/20260614000000_neural_map/migration.sql`
- Create: `packages/opencode/src/neural-map/neural-map.sql.ts`
- Modify: `packages/opencode/src/storage/schema.ts`

- [ ] **Step 1: Create migration SQL**

```sql
-- packages/opencode/migration/20260614000000_neural_map/migration.sql
CREATE TABLE IF NOT EXISTS `neural_map_progress` (
  `session_id` text NOT NULL,
  `node_id` text NOT NULL,
  `understood_at` integer,
  `notes` text NOT NULL DEFAULT '',
  PRIMARY KEY (`session_id`, `node_id`)
);
```

- [ ] **Step 2: Create Drizzle table definition**

```typescript
// packages/opencode/src/neural-map/neural-map.sql.ts
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core"

export const NeuralMapProgressTable = sqliteTable(
  "neural_map_progress",
  {
    session_id: text().notNull(),
    node_id: text().notNull(),
    understood_at: integer(),
    notes: text().notNull().default(""),
  },
  (table) => [primaryKey({ columns: [table.session_id, table.node_id] })],
)
```

- [ ] **Step 3: Export from storage schema**

In `packages/opencode/src/storage/schema.ts`, add this line at the end:

```typescript
export { NeuralMapProgressTable } from "../neural-map/neural-map.sql"
```

- [ ] **Step 4: Commit**

```bash
git add packages/opencode/migration/20260614000000_neural_map/ \
        packages/opencode/src/neural-map/neural-map.sql.ts \
        packages/opencode/src/storage/schema.ts
git commit -m "feat(neural-map): add neural_map_progress DB migration and schema"
```

---

## Task 3: Graph Builder

**Files:**
- Create: `packages/opencode/src/neural-map/graph.ts`
- Create: `packages/opencode/src/neural-map/graph.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/opencode/src/neural-map/graph.test.ts
import { test, expect } from "bun:test"
import { buildGraph } from "./graph"
import path from "path"

test("buildGraph returns nodes for each top-level src directory", async () => {
  const srcDir = path.join(import.meta.dirname, "../../../src")
  const cwd = path.join(import.meta.dirname, "../../..")
  const { nodes, edges } = await buildGraph(srcDir, cwd)

  expect(nodes.length).toBeGreaterThan(0)
  expect(nodes[0]).toMatchObject({
    id: expect.any(String),
    label: expect.any(String),
    fileCount: expect.any(Number),
    lineCount: expect.any(Number),
    activity: expect.any(Number),
    understood: false,
  })
})

test("buildGraph activity score is capped at 100", async () => {
  const srcDir = path.join(import.meta.dirname, "../../../src")
  const cwd = path.join(import.meta.dirname, "../../..")
  const { nodes } = await buildGraph(srcDir, cwd)
  for (const node of nodes) {
    expect(node.activity).toBeGreaterThanOrEqual(0)
    expect(node.activity).toBeLessThanOrEqual(100)
  }
})

test("buildGraph edges reference valid node ids", async () => {
  const srcDir = path.join(import.meta.dirname, "../../../src")
  const cwd = path.join(import.meta.dirname, "../../..")
  const { nodes, edges } = await buildGraph(srcDir, cwd)
  const ids = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    expect(ids.has(edge.source)).toBe(true)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/opencode && bun test src/neural-map/graph.test.ts
```
Expected: FAIL with `Cannot find module './graph'`

- [ ] **Step 3: Implement graph builder**

```typescript
// packages/opencode/src/neural-map/graph.ts
import path from "path"
import { Glob } from "bun"
import { $ } from "bun"
import type { GraphData, GraphNode, GraphEdge } from "./types"

const IMPORT_RE = /^(?:import|export)[^;'"]*from\s+['"]([^'"]+)['"]/gm
const REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm

function extractRelativeImports(content: string, filePath: string, srcDir: string): string[] {
  const results: string[] = []
  IMPORT_RE.lastIndex = 0
  REQUIRE_RE.lastIndex = 0

  for (const re of [IMPORT_RE, REQUIRE_RE]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
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

export async function buildGraph(srcDir: string, cwd: string): Promise<GraphData> {
  const glob = new Glob("**/*.{ts,tsx,js,jsx}")
  const files: string[] = []

  for await (const f of glob.scan({ cwd: srcDir, absolute: false })) {
    if (!f.includes("node_modules") && !f.endsWith(".d.ts")) {
      files.push(f)
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

  for (const [group, groupFiles] of groups) {
    let totalLines = 0
    let totalCommits = 0

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

      const result = await $`git log --oneline -- ${f}`.cwd(cwd).quiet().nothrow()
      totalCommits += result.stdout.toString().split("\n").filter(Boolean).length
    }

    lineMap.set(group, totalLines)
    activityMap.set(group, Math.min(totalCommits, 100))
  }

  const nodes: GraphNode[] = [...groups.entries()].map(([id, files]) => ({
    id,
    label: id,
    path: path.join(srcDir, id),
    fileCount: files.length,
    lineCount: lineMap.get(id) ?? 0,
    activity: activityMap.get(id) ?? 0,
    understood: false,
  }))

  const edges: GraphEdge[] = [...edgeSet].map((key) => {
    const sep = key.indexOf("→")
    return { source: key.slice(0, sep), target: key.slice(sep + 1) }
  })

  return { nodes, edges }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/opencode && bun test src/neural-map/graph.test.ts
```
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/opencode/src/neural-map/graph.ts \
        packages/opencode/src/neural-map/graph.test.ts
git commit -m "feat(neural-map): add static-import graph builder"
```

---

## Task 4: Force Layout Algorithm

**Files:**
- Create: `packages/app/src/pages/neural-map/layout.ts`
- Create: `packages/app/src/pages/neural-map/layout.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/app/src/pages/neural-map/layout.test.ts
import { test, expect } from "bun:test"
import { computeLayout } from "./layout"

const nodes = [
  { id: "a" },
  { id: "b" },
  { id: "c" },
]
const edges = [
  { source: "a", target: "b" },
  { source: "b", target: "c" },
]

test("computeLayout returns a position for every node", () => {
  const positions = computeLayout(nodes, edges, 800, 600)
  expect(positions.size).toBe(3)
  for (const id of ["a", "b", "c"]) {
    const pos = positions.get(id)!
    expect(pos).toBeDefined()
    expect(typeof pos.x).toBe("number")
    expect(typeof pos.y).toBe("number")
  }
})

test("computeLayout keeps nodes within viewport bounds", () => {
  const positions = computeLayout(nodes, edges, 800, 600)
  for (const [, pos] of positions) {
    expect(pos.x).toBeGreaterThanOrEqual(40)
    expect(pos.x).toBeLessThanOrEqual(760)
    expect(pos.y).toBeGreaterThanOrEqual(40)
    expect(pos.y).toBeLessThanOrEqual(560)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/app && bun test src/pages/neural-map/layout.test.ts
```
Expected: FAIL with `Cannot find module './layout'`

- [ ] **Step 3: Implement force layout**

```typescript
// packages/app/src/pages/neural-map/layout.ts
export interface Position {
  x: number
  y: number
}

export function computeLayout(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
  width: number,
  height: number,
): Map<string, Position> {
  const positions = new Map<string, Position>()

  // Deterministic seed positions in a circle
  const count = nodes.length
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count
    positions.set(nodes[i].id, {
      x: width / 2 + (width / 3) * Math.cos(angle),
      y: height / 2 + (height / 3) * Math.sin(angle),
    })
  }

  const REST = 100   // spring rest length
  const KR = 8000    // repulsion constant
  const KS = 0.05    // spring stiffness
  const DAMP = 0.8   // velocity damping

  const ids = nodes.map((n) => n.id)

  for (let iter = 0; iter < 200; iter++) {
    const forces = new Map<string, Position>()
    for (const id of ids) forces.set(id, { x: 0, y: 0 })

    // Repulsion: every pair
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positions.get(ids[i])!
        const b = positions.get(ids[j])!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const f = KR / (dist * dist)
        const fx = (dx / dist) * f
        const fy = (dy / dist) * f
        const fa = forces.get(ids[i])!
        const fb = forces.get(ids[j])!
        fa.x -= fx; fa.y -= fy
        fb.x += fx; fb.y += fy
      }
    }

    // Attraction: edges
    for (const { source, target } of edges) {
      const a = positions.get(source)
      const b = positions.get(target)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const f = (dist - REST) * KS
      const fx = (dx / dist) * f
      const fy = (dy / dist) * f
      const fa = forces.get(source)!
      const fb = forces.get(target)!
      fa.x += fx; fa.y += fy
      fb.x -= fx; fb.y -= fy
    }

    // Apply
    for (const id of ids) {
      const pos = positions.get(id)!
      const f = forces.get(id)!
      pos.x = Math.max(40, Math.min(width - 40, pos.x + f.x * DAMP))
      pos.y = Math.max(40, Math.min(height - 40, pos.y + f.y * DAMP))
    }
  }

  return positions
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/app && bun test src/pages/neural-map/layout.test.ts
```
Expected: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/pages/neural-map/layout.ts \
        packages/app/src/pages/neural-map/layout.test.ts
git commit -m "feat(neural-map): add spring force-directed layout algorithm"
```

---

## Task 5: AI Guide Service

**Files:**
- Create: `packages/opencode/src/neural-map/guide.ts`

- [ ] **Step 1: Implement guide service**

```typescript
// packages/opencode/src/neural-map/guide.ts
import { generateText } from "ai"
import type { LanguageModelV1 } from "@ai-sdk/provider"
import type { GraphNode } from "./types"

export interface GuideRequest {
  node: GraphNode
  allNodeIds: string[]
  understoodNodeIds: string[]
  userAnswer?: string
}

export interface GuideResponse {
  intro: string
  quiz: string
  feedback: string
  nextNodeId: string | null
}

function buildSystemPrompt(): string {
  return `You are an expert software architecture guide helping a developer understand a codebase.
Your role is to:
1. Briefly explain what a code module does (2-3 sentences max)
2. Ask a Socratic question to test understanding
3. If the user answered, give brief feedback (1-2 sentences)
4. Suggest the most logical next module to explore

Always respond with valid JSON matching this exact shape:
{
  "intro": "string",
  "quiz": "string",
  "feedback": "string (empty string if no user answer)",
  "nextNodeId": "string or null"
}`
}

function buildUserPrompt(req: GuideRequest): string {
  const { node, allNodeIds, understoodNodeIds, userAnswer } = req
  const remaining = allNodeIds.filter((id) => !understoodNodeIds.includes(id) && id !== node.id)

  return JSON.stringify({
    module: {
      id: node.id,
      label: node.label,
      fileCount: node.fileCount,
      lineCount: node.lineCount,
      activity: node.activity,
    },
    userAnswer: userAnswer ?? null,
    availableNextModules: remaining.slice(0, 5),
    alreadyUnderstood: understoodNodeIds,
  })
}

export async function generateGuide(model: LanguageModelV1, req: GuideRequest): Promise<GuideResponse> {
  const { text } = await generateText({
    model,
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(req),
    temperature: 0.3,
    maxTokens: 400,
  })

  try {
    const parsed = JSON.parse(text) as GuideResponse
    return {
      intro: parsed.intro ?? "",
      quiz: parsed.quiz ?? "",
      feedback: parsed.feedback ?? "",
      nextNodeId: parsed.nextNodeId ?? null,
    }
  } catch {
    // Fallback if JSON parse fails
    return {
      intro: text.slice(0, 200),
      quiz: "你认为这个模块最重要的职责是什么？",
      feedback: "",
      nextNodeId: null,
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/opencode/src/neural-map/guide.ts
git commit -m "feat(neural-map): add AI guide service with structured prompt"
```

---

## Task 6: Backend HTTP Routes

**Files:**
- Create: `packages/opencode/src/server/routes/instance/neural-map.ts`
- Modify: `packages/opencode/src/server/routes/instance/index.ts`

- [ ] **Step 1: Create route file**

```typescript
// packages/opencode/src/server/routes/instance/neural-map.ts
import { Hono } from "hono"
import { lazy } from "@/util/lazy"
import { Effect } from "effect"
import z from "zod"
import { validator } from "hono-openapi"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { Database } from "@/storage/db"
import { NeuralMapProgressTable } from "@/neural-map/neural-map.sql"
import { buildGraph } from "@/neural-map/graph"
import { generateGuide } from "@/neural-map/guide"
import { runRequest } from "./trace"
import path from "path"
import { eq, and } from "drizzle-orm"

export const NeuralMapRoutes = lazy(() =>
  new Hono()
    // GET /neural-map/graph?src=<relative-src-path>
    .get("/graph", async (c) => {
      const src = c.req.query("src") ?? "packages/opencode/src"
      const dir = Instance.directory
      const srcDir = path.join(dir, src)
      const graph = await buildGraph(srcDir, dir)
      return c.json(graph)
    })

    // POST /neural-map/guide
    .post(
      "/guide",
      validator(
        "json",
        z.object({
          node: z.object({
            id: z.string(),
            label: z.string(),
            path: z.string(),
            fileCount: z.number(),
            lineCount: z.number(),
            activity: z.number(),
            understood: z.boolean(),
          }),
          allNodeIds: z.array(z.string()),
          understoodNodeIds: z.array(z.string()),
          userAnswer: z.string().optional(),
          sessionId: z.string(),
        }),
      ),
      async (c) =>
        runRequest("NeuralMap.guide", c,
          Effect.gen(function* () {
            const body = c.req.valid("json")
            const provider = yield* Provider.Service
            const model = yield* provider.defaultModel()
            const language = yield* provider.getLanguage(model)
            const response = await generateGuide(language as any, {
              node: body.node,
              allNodeIds: body.allNodeIds,
              understoodNodeIds: body.understoodNodeIds,
              userAnswer: body.userAnswer,
            })
            return response
          }),
        ),
    )

    // GET /neural-map/progress/:sessionId
    .get("/progress/:sessionId", (c) => {
      const { sessionId } = c.req.param()
      const rows = Database.use((db) =>
        db
          .select()
          .from(NeuralMapProgressTable)
          .where(eq(NeuralMapProgressTable.session_id, sessionId))
          .all(),
      )
      return c.json(
        rows.map((r) => ({
          nodeId: r.node_id,
          understoodAt: r.understood_at,
          notes: r.notes,
        })),
      )
    })

    // POST /neural-map/progress/:sessionId/:nodeId
    .post(
      "/progress/:sessionId/:nodeId",
      validator("json", z.object({ notes: z.string().optional() })),
      (c) => {
        const { sessionId, nodeId } = c.req.param()
        const { notes = "" } = c.req.valid("json")
        Database.use((db) =>
          db
            .insert(NeuralMapProgressTable)
            .values({
              session_id: sessionId,
              node_id: nodeId,
              understood_at: Date.now(),
              notes,
            })
            .onConflictDoUpdate({
              target: [NeuralMapProgressTable.session_id, NeuralMapProgressTable.node_id],
              set: { understood_at: Date.now(), notes },
            })
            .run(),
        )
        return c.json({ ok: true })
      },
    )

    // DELETE /neural-map/progress/:sessionId/:nodeId
    .delete("/progress/:sessionId/:nodeId", (c) => {
      const { sessionId, nodeId } = c.req.param()
      Database.use((db) =>
        db
          .delete(NeuralMapProgressTable)
          .where(
            and(
              eq(NeuralMapProgressTable.session_id, sessionId),
              eq(NeuralMapProgressTable.node_id, nodeId),
            ),
          )
          .run(),
      )
      return c.json({ ok: true })
    }),
)
```

- [ ] **Step 2: Register route in instance/index.ts**

In `packages/opencode/src/server/routes/instance/index.ts`, add the import at the top:

```typescript
import { NeuralMapRoutes } from "./neural-map"
```

Then add `.route("/neural-map", NeuralMapRoutes())` to the return chain (after the last `.route()` line before the `.post("/instance/dispose", ...)` block):

```typescript
  return app
    .route("/project", ProjectRoutes())
    .route("/pty", PtyRoutes(upgrade))
    .route("/config", ConfigRoutes())
    .route("/experimental", ExperimentalRoutes())
    .route("/session", SessionRoutes())
    .route("/permission", PermissionRoutes())
    .route("/question", QuestionRoutes())
    .route("/provider", ProviderRoutes())
    .route("/sync", SyncRoutes())
    .route("/", FileRoutes())
    .route("/", EventRoutes())
    .route("/mcp", McpRoutes())
    .route("/tui", TuiRoutes())
    .route("/neural-map", NeuralMapRoutes())   // ← add this line
    .post(
      "/instance/dispose",
      // ...existing code unchanged
```

- [ ] **Step 3: Typecheck**

```bash
cd packages/opencode && bun typecheck
```
Expected: 0 errors relating to neural-map files

- [ ] **Step 4: Commit**

```bash
git add packages/opencode/src/server/routes/instance/neural-map.ts \
        packages/opencode/src/server/routes/instance/index.ts
git commit -m "feat(neural-map): add backend HTTP routes for graph, guide, and progress"
```

---

## Task 7: Frontend API Client + Store

**Files:**
- Create: `packages/app/src/pages/neural-map/api.ts`
- Create: `packages/app/src/pages/neural-map/store.ts`

- [ ] **Step 1: Create API client**

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

export async function fetchGraph(serverUrl: string, src?: string): Promise<GraphData> {
  const qs = src ? `?src=${encodeURIComponent(src)}` : ""
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

- [ ] **Step 2: Create SolidJS store**

```typescript
// packages/app/src/pages/neural-map/store.ts
import { createStore } from "solid-js/store"
import type { GraphData, GraphNode, GuideResponse, PositionedNode } from "./api"
import { computeLayout } from "./layout"

export interface GuideState {
  loading: boolean
  response: GuideResponse | null
  answer: string
  showFeedback: boolean
}

export interface NeuralMapState {
  graph: GraphData | null
  positions: Map<string, { x: number; y: number }>
  selectedNodeId: string | null
  understoodNodeIds: Set<string>
  guide: GuideState
  loading: boolean
  error: string | null
}

const initialGuide: GuideState = {
  loading: false,
  response: null,
  answer: "",
  showFeedback: false,
}

export function createNeuralMapStore() {
  const [state, setState] = createStore<NeuralMapState>({
    graph: null,
    positions: new Map(),
    selectedNodeId: null,
    understoodNodeIds: new Set(),
    guide: { ...initialGuide },
    loading: false,
    error: null,
  })

  function loadGraph(graph: GraphData, width: number, height: number) {
    const positions = computeLayout(graph.nodes, graph.edges, width, height)
    setState({ graph, positions, loading: false, error: null })
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

  function setError(error: string | null) {
    setState({ error, loading: false })
  }

  function selectedNode(): GraphNode | null {
    if (!state.selectedNodeId || !state.graph) return null
    return state.graph.nodes.find((n) => n.id === state.selectedNodeId) ?? null
  }

  return { state, loadGraph, selectNode, setGuideLoading, setGuideResponse, setAnswer, showFeedback, markUnderstood, unmarkUnderstood, setLoading, setError, selectedNode }
}

export type NeuralMapStore = ReturnType<typeof createNeuralMapStore>
```

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/pages/neural-map/api.ts \
        packages/app/src/pages/neural-map/store.ts
git commit -m "feat(neural-map): add frontend API client and SolidJS store"
```

---

## Task 8: SVG Canvas Component

**Files:**
- Create: `packages/app/src/pages/neural-map/Canvas.tsx`

- [ ] **Step 1: Create Canvas component**

```tsx
// packages/app/src/pages/neural-map/Canvas.tsx
import { For, createSignal, onMount, onCleanup } from "solid-js"
import type { NeuralMapStore } from "./store"

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  agent:    { fill: "#0d2040", stroke: "#58a6ff" },
  auth:     { fill: "#0a2618", stroke: "#3fb950" },
  provider: { fill: "#2d1d04", stroke: "#d29922" },
  storage:  { fill: "#1a0a2e", stroke: "#bc8cff" },
  server:   { fill: "#2d0f0f", stroke: "#f78166" },
  session:  { fill: "#0d1b2e", stroke: "#79c0ff" },
}

function nodeColor(id: string) {
  for (const [key, val] of Object.entries(NODE_COLORS)) {
    if (id.includes(key)) return val
  }
  return { fill: "#161b22", stroke: "#8b949e" }
}

function nodeRadius(activity: number, fileCount: number): number {
  const base = 14
  const actBonus = Math.sqrt(activity) * 0.8
  const sizeBonus = Math.min(fileCount, 10) * 0.6
  return Math.round(base + actBonus + sizeBonus)
}

export default function NeuralMapCanvas(props: { store: NeuralMapStore; width: number; height: number }) {
  const { state, selectNode } = props.store
  const [transform, setTransform] = createSignal({ x: 0, y: 0, scale: 1 })
  let svgRef!: SVGSVGElement
  let dragStart: { x: number; y: number; tx: number; ty: number } | null = null

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.2, Math.min(4, t.scale * delta)),
    }))
  }

  function onMouseDown(e: MouseEvent) {
    if ((e.target as Element).closest("[data-node]")) return
    const t = transform()
    dragStart = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y }
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragStart) return
    setTransform((t) => ({
      ...t,
      x: dragStart!.tx + (e.clientX - dragStart!.x),
      y: dragStart!.ty + (e.clientY - dragStart!.y),
    }))
  }

  function onMouseUp() {
    dragStart = null
  }

  onMount(() => {
    svgRef.addEventListener("wheel", onWheel, { passive: false })
  })
  onCleanup(() => {
    svgRef.removeEventListener("wheel", onWheel)
  })

  return (
    <svg
      ref={svgRef!}
      width={props.width}
      height={props.height}
      style={{ background: "radial-gradient(ellipse at 50% 50%, #0d1b2e 0%, #060d19 100%)", cursor: "grab" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <defs>
        <filter id="nm-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nm-glow-sm">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform={`translate(${transform().x},${transform().y}) scale(${transform().scale})`}>
        {/* Edges */}
        <For each={state.graph?.edges ?? []}>
          {(edge) => {
            const a = () => state.positions.get(edge.source)
            const b = () => state.positions.get(edge.target)
            return (
              <>
                {a() && b() && (
                  <path
                    d={`M${a()!.x},${a()!.y} Q${(a()!.x + b()!.x) / 2 + 30},${(a()!.y + b()!.y) / 2 - 30} ${b()!.x},${b()!.y}`}
                    fill="none"
                    stroke="#58a6ff"
                    stroke-width="1.5"
                    opacity="0.3"
                  />
                )}
              </>
            )
          }}
        </For>

        {/* Nodes */}
        <For each={state.graph?.nodes ?? []}>
          {(node) => {
            const pos = () => state.positions.get(node.id)
            const isSelected = () => state.selectedNodeId === node.id
            const isUnderstood = () => state.understoodNodeIds.has(node.id)
            const color = nodeColor(node.id)
            const r = nodeRadius(node.activity, node.fileCount)

            return (
              <>
                {pos() && (
                  <g
                    data-node={node.id}
                    transform={`translate(${pos()!.x},${pos()!.y})`}
                    style={{ cursor: "pointer" }}
                    onClick={() => selectNode(node.id)}
                  >
                    {/* Pulse ring */}
                    <circle
                      r={r + 8}
                      fill="none"
                      stroke={color.stroke}
                      stroke-width="0.5"
                      opacity={isSelected() ? 0.6 : 0.15}
                    />
                    {/* Selected ring */}
                    {isSelected() && (
                      <circle
                        r={r + 4}
                        fill="none"
                        stroke={color.stroke}
                        stroke-width="1.5"
                        stroke-dasharray="4,3"
                        opacity="0.8"
                      />
                    )}
                    {/* Main node */}
                    <circle
                      r={r}
                      fill={color.fill}
                      stroke={isUnderstood() ? "#3fb950" : color.stroke}
                      stroke-width={isSelected() ? 2.5 : 1.5}
                      filter="url(#nm-glow)"
                    />
                    {/* Label */}
                    <text
                      text-anchor="middle"
                      dominant-baseline="middle"
                      fill={isUnderstood() ? "#3fb950" : color.stroke}
                      font-size={Math.max(7, Math.min(10, r * 0.6))}
                      font-family="monospace"
                      pointer-events="none"
                    >
                      {node.label.length > 10 ? node.label.slice(0, 9) + "…" : node.label}
                    </text>
                    {/* Understood badge */}
                    {isUnderstood() && (
                      <text
                        x={r - 4}
                        y={-(r - 4)}
                        text-anchor="middle"
                        font-size="10"
                        pointer-events="none"
                      >
                        ✓
                      </text>
                    )}
                    {/* Hot badge (activity > 60) */}
                    {node.activity > 60 && !isUnderstood() && (
                      <circle cx={r - 3} cy={-(r - 3)} r={5} fill="#d29922" filter="url(#nm-glow-sm)" />
                    )}
                  </g>
                )}
              </>
            )
          }}
        </For>
      </g>

      {/* Hint */}
      <text x={10} y={props.height - 12} fill="#484f58" font-size="10" font-family="monospace">
        滚轮缩放 · 拖拽平移 · 点击节点探索
      </text>
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/pages/neural-map/Canvas.tsx
git commit -m "feat(neural-map): add SVG neural map canvas component"
```

---

## Task 9: Guide Panel Component

**Files:**
- Create: `packages/app/src/pages/neural-map/GuidePanel.tsx`

- [ ] **Step 1: Create GuidePanel component**

```tsx
// packages/app/src/pages/neural-map/GuidePanel.tsx
import { Show, createSignal } from "solid-js"
import type { NeuralMapStore } from "./store"

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
  const isUnderstood = () => state.selectedNodeId ? state.understoodNodeIds.has(state.selectedNodeId) : false

  return (
    <div style={{
      width: "220px",
      "border-left": "1px solid #21262d",
      display: "flex",
      "flex-direction": "column",
      background: "#0d1117",
      "font-family": "monospace",
    }}>
      <Show when={node()} fallback={
        <div style={{ padding: "20px", color: "#484f58", "font-size": "12px", "text-align": "center", "margin-top": "40px" }}>
          点击左侧节点<br />开始探索
        </div>
      }>
        {/* Node metadata */}
        <div style={{ padding: "12px", "border-bottom": "1px solid #21262d" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-bottom": "8px" }}>
            <div style={{ width: "8px", height: "8px", "border-radius": "50%", background: "#58a6ff", "box-shadow": "0 0 6px #58a6ff" }} />
            <div style={{ "font-size": "11px", color: "#cdd9e5", "font-weight": "bold" }}>{node()!.id}</div>
          </div>
          <div style={{ "font-size": "9px", color: "#8b949e", "line-height": "1.6", "margin-bottom": "8px" }}>
            {node()!.fileCount} 个文件 · {node()!.lineCount} 行
          </div>
          <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
            {node()!.activity > 60 && (
              <span style={{ background: "#2d1d04", "border-radius": "3px", padding: "2px 6px", "font-size": "8px", color: "#d29922" }}>高活跃</span>
            )}
            <span style={{ background: "#21262d", "border-radius": "3px", padding: "2px 6px", "font-size": "8px", color: "#8b949e" }}>
              活跃度 {node()!.activity}
            </span>
          </div>
        </div>

        {/* AI conversation */}
        <div style={{ flex: 1, padding: "10px", display: "flex", "flex-direction": "column", gap: "8px", "overflow-y": "auto" }}>
          <div style={{ "font-size": "9px", color: "#8b949e", "text-transform": "uppercase", "letter-spacing": "0.5px" }}>🤖 AI 向导</div>

          {/* Initial state: node selected, no guide yet */}
          <Show when={!guide().loading && !guide().response}>
            <button
              style={{ background: "#0d419d", "border-radius": "8px", padding: "10px", "font-size": "10px", color: "#58a6ff", border: "none", cursor: "pointer", "font-family": "monospace", width: "100%" }}
              onClick={() => void props.onAskGuide()}
            >
              🤖 开始解读这个模块
            </button>
          </Show>

          <Show when={guide().loading}>
            <div style={{ background: "#161b22", "border-radius": "8px", padding: "8px", "font-size": "10px", color: "#8b949e", "border-left": "2px solid #30363d" }}>
              正在思考...
            </div>
          </Show>

          <Show when={guide().response && !guide().loading}>
            {/* Intro */}
            <div style={{ background: "#161b22", "border-radius": "8px", padding: "8px", "font-size": "10px", color: "#cdd9e5", "line-height": "1.5", "border-left": "2px solid #58a6ff" }}>
              {guide().response!.intro}
            </div>

            {/* Quiz */}
            <Show when={!guide().showFeedback}>
              <div style={{ background: "#161b22", "border-radius": "8px", padding: "8px", "font-size": "10px", color: "#cdd9e5", "line-height": "1.5", "border-left": "2px solid #d29922" }}>
                🎯 <strong style={{ color: "#d29922" }}>猜一猜</strong><br />
                {guide().response!.quiz}
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <input
                  style={{
                    flex: 1,
                    background: "#161b22",
                    border: "1px solid #30363d",
                    "border-radius": "6px",
                    padding: "6px 8px",
                    "font-size": "9px",
                    color: "#cdd9e5",
                    outline: "none",
                    "font-family": "monospace",
                  }}
                  placeholder="输入你的答案..."
                  value={guide().answer}
                  onInput={(e) => setAnswer(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void submitAnswer() }}
                />
                <button
                  style={{ background: "#0d419d", "border-radius": "6px", padding: "6px 8px", "font-size": "9px", color: "#58a6ff", border: "none", cursor: "pointer" }}
                  onClick={() => void submitAnswer()}
                  disabled={submitting()}
                >
                  ↵
                </button>
              </div>
            </Show>

            {/* Feedback */}
            <Show when={guide().showFeedback && guide().response?.feedback}>
              <div style={{ background: "#0a2618", "border-radius": "8px", padding: "8px", "font-size": "10px", color: "#3fb950", "line-height": "1.5" }}>
                ✓ {guide().response!.feedback}
              </div>
            </Show>
          </Show>
        </div>

        {/* Actions */}
        <div style={{ padding: "10px", "border-top": "1px solid #21262d", display: "flex", "flex-direction": "column", gap: "6px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              style={{
                flex: 1,
                background: isUnderstood() ? "#0a2618" : "#21262d",
                "border-radius": "6px",
                padding: "5px",
                "text-align": "center",
                "font-size": "9px",
                color: isUnderstood() ? "#3fb950" : "#8b949e",
                border: "none",
                cursor: "pointer",
                "font-family": "monospace",
              }}
              onClick={() => void props.onMarkUnderstood()}
            >
              {isUnderstood() ? "✓ 已理解" : "标记已懂"}
            </button>
            <button
              style={{
                flex: 1,
                background: "#0d419d",
                "border-radius": "6px",
                padding: "5px",
                "text-align": "center",
                "font-size": "9px",
                color: "#58a6ff",
                border: "none",
                cursor: "pointer",
                "font-family": "monospace",
              }}
              onClick={props.onNavigateNext}
            >
              → 下一站
            </button>
          </div>
          <Show when={guide().response?.nextNodeId}>
            <div style={{ background: "#1c1f06", "border-radius": "6px", padding: "6px", "font-size": "9px", color: "#d29922", "text-align": "center" }}>
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
git commit -m "feat(neural-map): add AI guide panel component"
```

---

## Task 10: Neural Map Page + Routing

**Files:**
- Create: `packages/app/src/pages/neural-map/index.tsx`
- Modify: `packages/app/src/app.tsx`

- [ ] **Step 1: Create the top-level page**

```tsx
// packages/app/src/pages/neural-map/index.tsx
import { createSignal, onMount, Show } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { useServer } from "@/context/server"
import { createNeuralMapStore } from "./store"
import { fetchGraph, fetchGuide, fetchProgress, markUnderstood, unmarkUnderstood } from "./api"
import NeuralMapCanvas from "./Canvas"
import GuidePanel from "./GuidePanel"

const SESSION_ID = "neural-map-global"
const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 600

export default function NeuralMapPage() {
  const server = useServer()
  const navigate = useNavigate()
  const params = useParams()
  const store = createNeuralMapStore()
  const { state, loadGraph, selectNode, setGuideLoading, setGuideResponse, showFeedback, markUnderstood: markLocal, unmarkUnderstood: unmarkLocal, setLoading, setError } = store

  const serverUrl = () => server.current?.http.url ?? ""

  onMount(async () => {
    setLoading(true)
    try {
      const [graph, progress] = await Promise.all([
        fetchGraph(serverUrl()),
        fetchProgress(serverUrl(), SESSION_ID),
      ])
      loadGraph(graph, CANVAS_WIDTH, CANVAS_HEIGHT)
      for (const entry of progress) {
        if (entry.understoodAt) markLocal(entry.nodeId)
      }
    } catch (e) {
      setError(String(e))
    }
  })

  async function handleAskGuide(userAnswer?: string) {
    const node = store.selectedNode()
    if (!node || !state.graph) return
    setGuideLoading(true)
    try {
      const response = await fetchGuide(serverUrl(), {
        node,
        allNodeIds: state.graph.nodes.map((n) => n.id),
        understoodNodeIds: [...state.understoodNodeIds],
        userAnswer,
        sessionId: SESSION_ID,
      })
      setGuideResponse(response)
      if (userAnswer) showFeedback()
    } catch {
      setGuideLoading(false)
    }
  }

  async function handleMarkUnderstood() {
    const nodeId = state.selectedNodeId
    if (!nodeId) return
    if (state.understoodNodeIds.has(nodeId)) {
      await unmarkUnderstood(serverUrl(), SESSION_ID, nodeId)
      unmarkLocal(nodeId)
    } else {
      await markUnderstood(serverUrl(), SESSION_ID, nodeId)
      markLocal(nodeId)
    }
  }

  function handleNavigateNext() {
    const nextId = state.guide.response?.nextNodeId
    if (nextId && state.graph) {
      const found = state.graph.nodes.find((n) => n.id === nextId)
      if (found) {
        selectNode(nextId)
        void handleAskGuide()
      }
    }
  }

  const total = () => state.graph?.nodes.length ?? 0
  const understood = () => state.understoodNodeIds.size
  const pct = () => total() > 0 ? Math.round((understood() / total()) * 100) : 0

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100vh", background: "#0d1117", color: "#cdd9e5" }}>
      {/* Top bar */}
      <div style={{ background: "#161b22", "border-bottom": "1px solid #21262d", padding: "6px 16px", display: "flex", "align-items": "center", gap: "12px", "flex-shrink": 0 }}>
        <div style={{ "font-size": "11px", color: "#8b949e", "font-family": "monospace" }}>web-ai-ide</div>
        <div style={{ "font-size": "10px", color: "#8b949e" }}>›</div>
        <div style={{ background: "#0d419d", "border-radius": "4px", padding: "3px 10px", "font-size": "10px", color: "#58a6ff", "font-family": "monospace", "font-weight": "bold" }}>
          ⬡ NEURAL MAP
        </div>
        <div style={{ "margin-left": "auto", display: "flex", "align-items": "center", gap: "10px" }}>
          <Show when={total() > 0}>
            <div style={{ "font-size": "10px", color: "#3fb950", "font-family": "monospace" }}>
              ● 已理解 {understood()} / {total()} ({pct()}%)
            </div>
            <div style={{ background: "#21262d", "border-radius": "12px", height: "6px", width: "80px", overflow: "hidden" }}>
              <div style={{ width: `${pct()}%`, height: "100%", background: "linear-gradient(90deg,#3fb950,#58a6ff)", "border-radius": "12px", transition: "width 0.3s" }} />
            </div>
          </Show>
          <div style={{ width: "1px", height: "16px", background: "#21262d" }} />
          <button
            style={{ "font-size": "10px", color: "#8b949e", background: "none", border: "none", cursor: "pointer", "font-family": "monospace" }}
            onClick={() => navigate(-1)}
          >
            ✕ 退出模式
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Show when={state.loading}>
          <div style={{ flex: 1, display: "flex", "align-items": "center", "justify-content": "center", color: "#8b949e", "font-size": "14px" }}>
            正在构建代码神经图...
          </div>
        </Show>
        <Show when={state.error}>
          <div style={{ flex: 1, display: "flex", "align-items": "center", "justify-content": "center", color: "#f78166", "font-size": "14px" }}>
            {state.error}
          </div>
        </Show>
        <Show when={!state.loading && !state.error && state.graph}>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <NeuralMapCanvas store={store} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
          </div>
          <GuidePanel
            store={store}
            onAskGuide={handleAskGuide}
            onMarkUnderstood={handleMarkUnderstood}
            onNavigateNext={handleNavigateNext}
          />
        </Show>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Register route in app.tsx**

In `packages/app/src/app.tsx`, add the lazy import near the top (after the other lazy imports):

```typescript
const NeuralMapPage = lazy(() => import("@/pages/neural-map"))
```

Then add a route inside the `<Dynamic component={props.router ?? Router} ...>` block, alongside the existing routes:

```tsx
<Route path="/:dir/neural-map" component={NeuralMapPage} />
```

The full routes section should look like:

```tsx
<Dynamic
  component={props.router ?? Router}
  root={(routerProps) => <RouterRoot appChildren={props.children}>{routerProps.children}</RouterRoot>}
>
  <Route path="/" component={HomeRoute} />
  <Route path="/:dir" component={DirectoryLayout}>
    <Route path="/" component={SessionIndexRoute} />
    <Route path="/session/:id?" component={SessionRoute} />
  </Route>
  <Route path="/:dir/neural-map" component={NeuralMapPage} />
</Dynamic>
```

- [ ] **Step 3: Typecheck frontend**

```bash
cd packages/app && bun typecheck
```
Expected: 0 errors in neural-map files

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/pages/neural-map/index.tsx \
        packages/app/src/app.tsx
git commit -m "feat(neural-map): add top-level page and register route"
```

---

## Task 11: End-to-End Smoke Test

- [ ] **Step 1: Start the server**

```bash
cd packages/opencode && bun run src/index.ts serve --port 4096
```

- [ ] **Step 2: Start the web app**

In a second terminal:
```bash
cd packages/app && bun run dev
```

- [ ] **Step 3: Verify graph endpoint**

```bash
curl http://localhost:4096/neural-map/graph | bun -e "const d = await Bun.stdin.json(); console.log('nodes:', d.nodes.length, 'edges:', d.edges.length)"
```
Expected: output shows `nodes: <N> edges: <M>` with N > 0

- [ ] **Step 4: Open the Neural Map page in browser**

Navigate to: `http://localhost:5173/<dir>/neural-map`

Where `<dir>` is a base64-encoded project path (same format as normal session URLs). You can also start the Electron client and use the route.

Verify:
- The neural graph renders with colored nodes
- Clicking a node loads the AI guide panel
- "标记已懂" toggles the ✓ badge
- "→ 下一站" navigates to the AI-suggested next node
- Progress bar in top bar updates

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat(neural-map): complete Code Neural Map mode implementation"
```
