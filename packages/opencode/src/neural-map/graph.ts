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

  // Get git activity per top-level directory in one call each
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
