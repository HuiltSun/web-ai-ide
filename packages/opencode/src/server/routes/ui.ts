import { Flag } from "@opencode-ai/core/flag/flag"
import { Hono } from "hono"
import { proxy } from "hono/proxy"
import { getMimeType } from "hono/utils/mime"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"

const embeddedUIPromise = Flag.OPENCODE_DISABLE_EMBEDDED_WEB_UI
  ? Promise.resolve(null)
  : // @ts-expect-error - generated file at build time
    import("opencode-web-ui.gen.ts").then((module) => module.default as Record<string, string>).catch(() => null)

const DEFAULT_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; media-src 'self' data:; connect-src 'self' data:"

const csp = (hash = "") =>
  `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'${hash ? ` 'sha256-${hash}'` : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; media-src 'self' data:; connect-src 'self' data:`

export const UIRoutes = (): Hono =>
  new Hono().all("/*", async (c) => {
    const embeddedWebUI = await embeddedUIPromise
    const path = c.req.path

    if (embeddedWebUI) {
      const match = embeddedWebUI[path.replace(/^\//, "")] ?? embeddedWebUI["index.html"] ?? null
      if (!match) return c.json({ error: "Not Found" }, 404)

      if (await fs.exists(match)) {
        const mime = getMimeType(match) ?? "text/plain"
        c.header("Content-Type", mime)
        if (mime.startsWith("text/html")) {
          c.header("Content-Security-Policy", DEFAULT_CSP)
        }
        return c.body(new Uint8Array(await fs.readFile(match)))
      } else {
        return c.json({ error: "Not Found" }, 404)
      }
    } else {
      const response = await proxy(`https://app.opencode.ai${path}`, {
        raw: c.req.raw,
        headers: {
          ...Object.fromEntries(c.req.raw.headers.entries()),
          host: "app.opencode.ai",
        },
      })
      const isHTML = response.headers.get("content-type")?.includes("text/html")
      let body: string | undefined
      if (isHTML) {
        body = await response.clone().text()
        body = body.replace(/<title>OpenCode<\/title>/g, "<title>Web AI IDE</title>")
      }
      const match = body?.match(
        /<script\b(?![^>]*\bsrc\s*=)[^>]*\bid=(['"])oc-theme-preload-script\1[^>]*>([\s\S]*?)<\/script>/i,
      )
      const hash = match ? createHash("sha256").update(match[2]).digest("base64") : ""
      if (body) {
        return c.html(body, 200, { "Content-Security-Policy": csp(hash) })
      }
      response.headers.set("Content-Security-Policy", csp(hash))
      return response
    }
  })
