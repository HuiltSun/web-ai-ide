import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { Effect } from "effect"
import { File } from "@/file"
import { Ripgrep } from "@/file/ripgrep"
import { LSP } from "@/lsp/lsp"
import { Instance } from "@/project/instance"
import { lazy } from "@/util/lazy"
import { jsonRequest, runRequest } from "./trace"

export const FileRoutes = lazy(() =>
  new Hono()
    .get(
      "/find",
      describeRoute({
        summary: "Find text",
        description: "Search for text patterns across files in the project using ripgrep.",
        operationId: "find.text",
        responses: {
          200: {
            description: "Matches",
            content: {
              "application/json": {
                schema: resolver(Ripgrep.SearchMatch.zod.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          pattern: z.string(),
          limit: z.coerce.number().int().min(1).max(200).optional(),
        }),
      ),
      async (c) =>
        jsonRequest("FileRoutes.findText", c, function* () {
          const { pattern, limit } = c.req.valid("query")
          const svc = yield* Ripgrep.Service
          const result = yield* svc.search({ cwd: Instance.directory, pattern, limit: limit ?? 50 })
          return result.items
        }),
    )
    .get(
      "/search/context",
      describeRoute({
        summary: "Search as agent context",
        description: "Search for text patterns and return results formatted as Markdown for AI agent context.",
        operationId: "find.text.context",
        responses: {
          200: { description: "Markdown-formatted search results", content: { "text/plain": { schema: { type: "string" } } } },
        },
      }),
      validator("query", z.object({ pattern: z.string(), limit: z.coerce.number().int().min(1).max(200).optional() })),
      async (c) => {
        const { pattern, limit } = c.req.valid("query")
        const result = await runRequest(
          "FileRoutes.searchContext",
          c,
          Effect.gen(function* () {
            const svc = yield* Ripgrep.Service
            return yield* svc.search({ cwd: Instance.directory, pattern, limit: limit ?? 100 })
          }),
        )

        if (result.items.length === 0) {
          return c.text(`# Search Results: "${pattern}"\n\nNo matches found.`)
        }

        const byFile = new Map<string, typeof result.items>()
        for (const item of result.items) {
          const file = item.path.text
          if (!byFile.has(file)) byFile.set(file, [])
          byFile.get(file)!.push(item)
        }

        const lines: string[] = [
          `# Search Results: "${pattern}"`,
          `> ${result.items.length} match${result.items.length === 1 ? "" : "es"} across ${byFile.size} file${byFile.size === 1 ? "" : "s"}${result.partial ? " (results truncated)" : ""}`,
          "",
        ]
        for (const [file, items] of byFile) {
          lines.push(`## ${file}`)
          for (const item of items) {
            lines.push(`- Line ${item.line_number}: \`${item.lines.text.trimEnd()}\``)
          }
          lines.push("")
        }

        return c.text(lines.join("\n"))
      },
    )
    .get(
      "/find/file",
      describeRoute({
        summary: "Find files",
        description: "Search for files or directories by name or pattern in the project directory.",
        operationId: "find.files",
        responses: {
          200: {
            description: "File paths",
            content: {
              "application/json": {
                schema: resolver(z.string().array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          query: z.string(),
          dirs: z.enum(["true", "false"]).optional(),
          type: z.enum(["file", "directory"]).optional(),
          limit: z.coerce.number().int().min(1).max(200).optional(),
        }),
      ),
      async (c) =>
        jsonRequest("FileRoutes.findFile", c, function* () {
          const query = c.req.valid("query")
          const svc = yield* File.Service
          return yield* svc.search({
            query: query.query,
            limit: query.limit ?? 10,
            dirs: query.dirs !== "false",
            type: query.type,
          })
        }),
    )
    .get(
      "/find/symbol",
      describeRoute({
        summary: "Find symbols",
        description: "Search for workspace symbols like functions, classes, and variables using LSP.",
        operationId: "find.symbols",
        responses: {
          200: {
            description: "Symbols",
            content: {
              "application/json": {
                schema: resolver(LSP.Symbol.zod.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          query: z.string(),
        }),
      ),
      async (c) => {
        return c.json([])
      },
    )
    .get(
      "/file",
      describeRoute({
        summary: "List files",
        description: "List files and directories in a specified path.",
        operationId: "file.list",
        responses: {
          200: {
            description: "Files and directories",
            content: {
              "application/json": {
                schema: resolver(File.Node.zod.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) =>
        jsonRequest("FileRoutes.list", c, function* () {
          const svc = yield* File.Service
          return yield* svc.list(c.req.valid("query").path)
        }),
    )
    .get(
      "/file/content",
      describeRoute({
        summary: "Read file",
        description: "Read the content of a specified file.",
        operationId: "file.read",
        responses: {
          200: {
            description: "File content",
            content: {
              "application/json": {
                schema: resolver(File.Content.zod),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) =>
        jsonRequest("FileRoutes.read", c, function* () {
          const svc = yield* File.Service
          return yield* svc.read(c.req.valid("query").path)
        }),
    )
    .get(
      "/file/status",
      describeRoute({
        summary: "Get file status",
        description: "Get the git status of all files in the project.",
        operationId: "file.status",
        responses: {
          200: {
            description: "File status",
            content: {
              "application/json": {
                schema: resolver(File.Info.zod.array()),
              },
            },
          },
        },
      }),
      async (c) =>
        jsonRequest("FileRoutes.status", c, function* () {
          const svc = yield* File.Service
          return yield* svc.status()
        }),
    ),
)
