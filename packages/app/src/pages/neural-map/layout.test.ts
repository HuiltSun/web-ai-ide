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
