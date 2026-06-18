import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { Effect } from "effect"
import { z } from "zod"
import { Provider } from "@/provider/provider"
import { Database } from "@/storage/db"
import { NeuralMapProgressTable, NeuralMapSnapshotTable } from "@/neural-map/neural-map.sql"
import { buildGraph } from "@/neural-map/graph"
import { generateGuide } from "@/neural-map/guide"
import { runRequest } from "./trace"
import path from "path"
import { eq, and } from "drizzle-orm"

const snapshotBodySchema = z.object({
  directory: z.string(),
  src: z.string(),
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    path: z.string(),
    fileCount: z.number(),
    lineCount: z.number(),
    activity: z.number(),
    understood: z.boolean(),
    hasChildren: z.boolean(),
  })),
  edges: z.array(z.object({ source: z.string(), target: z.string() })),
})

const nodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  path: z.string(),
  fileCount: z.number(),
  lineCount: z.number(),
  activity: z.number(),
  understood: z.boolean(),
  hasChildren: z.boolean().optional().default(false),
})

export function NeuralMapRoutes() {
  return new Hono()
    // GET /neural-map/graph?directory=<project-root>&src=<relative-src-path>
    .get("/graph", async (c) => {
      const src = c.req.query("src") ?? "packages/opencode/src"
      let dir = c.req.query("directory") ?? process.cwd()
      // Normalize Windows drive-relative paths: "E:path" → "E:\path"
      if (/^[A-Za-z]:[^/\\]/.test(dir)) dir = dir[0] + ":\\" + dir.slice(2)
      const srcDir = path.join(dir, src)
      const graph = await buildGraph(srcDir, dir)
      return c.json(graph)
    })

    // POST /neural-map/guide
    .post(
      "/guide",
      zValidator(
        "json",
        z.object({
          node: nodeSchema,
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        try {
          const response = await runRequest(
            "NeuralMap.guide",
            c,
            Effect.gen(function* () {
              const provider = yield* Provider.Service
              const modelRef = yield* provider.defaultModel()
              const model = yield* provider.getModel(modelRef.providerID, modelRef.modelID)
              const language = yield* provider.getLanguage(model)
              return yield* Effect.tryPromise({
                try: () => generateGuide(language as any, { node: body.node }),
                catch: (e) => new Error(e instanceof Error ? e.message : String(e)),
              })
            }),
          )
          return c.json(response)
        } catch (err) {
          console.error("[neural-map/guide] handler error:", err)
          const message = err instanceof Error ? err.message : String(err)
          return c.json({ error: message }, { status: 500 })
        }
      },
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
      zValidator("json", z.object({ notes: z.string().optional() })),
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
    })

    // POST /neural-map/snapshot — save rendered graph (nodes + edges, no positions)
    .post(
      "/snapshot",
      zValidator("json", snapshotBodySchema),
      (c) => {
        const { directory, src, nodes, edges } = c.req.valid("json")
        const snapshotJson = JSON.stringify({ nodes, edges })
        Database.use((db) =>
          db
            .insert(NeuralMapSnapshotTable)
            .values({ directory, src, snapshot_json: snapshotJson, saved_at: Date.now() })
            .onConflictDoUpdate({
              target: [NeuralMapSnapshotTable.directory, NeuralMapSnapshotTable.src],
              set: { snapshot_json: snapshotJson, saved_at: Date.now() },
            })
            .run(),
        )
        return c.json({ ok: true })
      },
    )

    // GET /neural-map/snapshot?directory=&src= — load saved graph
    .get("/snapshot", (c) => {
      const directory = c.req.query("directory") ?? ""
      const src = c.req.query("src") ?? ""
      const row = Database.use((db) =>
        db
          .select()
          .from(NeuralMapSnapshotTable)
          .where(
            and(
              eq(NeuralMapSnapshotTable.directory, directory),
              eq(NeuralMapSnapshotTable.src, src),
            ),
          )
          .get(),
      )
      if (!row) return c.json(null)
      return c.json({ ...(JSON.parse(row.snapshot_json) as { nodes: unknown; edges: unknown }), savedAt: row.saved_at })
    })

    // GET /neural-map/context?directory=&src= — markdown summary for agent use
    .get("/context", (c) => {
      const directory = c.req.query("directory") ?? ""
      const src = c.req.query("src") ?? ""
      const row = Database.use((db) =>
        db
          .select()
          .from(NeuralMapSnapshotTable)
          .where(
            and(
              eq(NeuralMapSnapshotTable.directory, directory),
              eq(NeuralMapSnapshotTable.src, src),
            ),
          )
          .get(),
      )
      if (!row) {
        return c.text("No snapshot found. Load the Neural Map view first to generate one.", 404)
      }
      const { nodes, edges } = JSON.parse(row.snapshot_json) as {
        nodes: Array<{ id: string; path: string; fileCount: number; lineCount: number; activity: number; hasChildren: boolean }>
        edges: Array<{ source: string; target: string }>
      }
      const edgeMap = new Map<string, string[]>()
      for (const e of edges) {
        if (!edgeMap.has(e.source)) edgeMap.set(e.source, [])
        edgeMap.get(e.source)!.push(e.target)
      }
      const lines: string[] = [
        `# Codebase Neural Map — ${src}`,
        `> Generated: ${new Date(row.saved_at).toISOString()}`,
        "",
        "## Modules",
        "",
      ]
      for (const n of nodes) {
        lines.push(`### \`${n.id}\``)
        lines.push(`- **Path**: ${n.path}`)
        lines.push(`- **Files**: ${n.fileCount}  **Lines**: ${n.lineCount}  **Activity**: ${n.activity}/100`)
        if (n.hasChildren) lines.push(`- Has sub-modules (drillable)`)
        const deps = edgeMap.get(n.id)
        if (deps && deps.length > 0) lines.push(`- **Imports**: ${deps.join(", ")}`)
        lines.push("")
      }
      return c.text(lines.join("\n"))
    })
}
