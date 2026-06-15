import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { Effect } from "effect"
import { z } from "zod"
import { Provider } from "@/provider/provider"
import { Database } from "@/storage/db"
import { NeuralMapProgressTable } from "@/neural-map/neural-map.sql"
import { buildGraph } from "@/neural-map/graph"
import { generateGuide } from "@/neural-map/guide"
import { runRequest } from "./trace"
import path from "path"
import { eq, and } from "drizzle-orm"

const nodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  path: z.string(),
  fileCount: z.number(),
  lineCount: z.number(),
  activity: z.number(),
  understood: z.boolean(),
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
          allNodeIds: z.array(z.string()),
          understoodNodeIds: z.array(z.string()),
          userAnswer: z.string().optional(),
          sessionId: z.string(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        const response = await runRequest(
          "NeuralMap.guide",
          c,
          Effect.gen(function* () {
            const provider = yield* Provider.Service
            const modelRef = yield* provider.defaultModel()
            const model = yield* provider.getModel(modelRef.providerID, modelRef.modelID)
            const language = yield* provider.getLanguage(model)
            return yield* Effect.promise(() =>
              generateGuide(language as any, {
                node: body.node,
                allNodeIds: body.allNodeIds,
                understoodNodeIds: body.understoodNodeIds,
                userAnswer: body.userAnswer,
              }),
            )
          }),
        )
        return c.json(response)
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
}
