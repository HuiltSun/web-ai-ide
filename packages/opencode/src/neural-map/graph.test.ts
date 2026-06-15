import { test, expect } from "bun:test"
import { buildGraph, computeHasChildren, isDirectoryGroup } from "./graph"
import path from "path"

test("buildGraph returns nodes for each top-level src directory", async () => {
  const srcDir = path.join(import.meta.dirname, "../")
  const cwd = path.join(import.meta.dirname, "../../")
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
  const srcDir = path.join(import.meta.dirname, "../")
  const cwd = path.join(import.meta.dirname, "../../")
  const { nodes } = await buildGraph(srcDir, cwd)
  for (const node of nodes) {
    expect(node.activity).toBeGreaterThanOrEqual(0)
    expect(node.activity).toBeLessThanOrEqual(100)
  }
})

test("buildGraph edges reference valid node ids", async () => {
  const srcDir = path.join(import.meta.dirname, "../")
  const cwd = path.join(import.meta.dirname, "../../")
  const { nodes, edges } = await buildGraph(srcDir, cwd)
  const ids = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    expect(ids.has(edge.source)).toBe(true)
  }
})

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
