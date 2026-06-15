import { test, expect } from "bun:test"
import { computeLayout, nodeRadius } from "./layout"

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
  const { positions } = computeLayout(nodes, edges, 800, 600)
  expect(positions.size).toBe(3)
  for (const id of ["a", "b", "c"]) {
    const pos = positions.get(id)!
    expect(pos).toBeDefined()
    expect(typeof pos.x).toBe("number")
    expect(typeof pos.y).toBe("number")
  }
})

test("computeLayout keeps nodes within viewport bounds", () => {
  const { positions } = computeLayout(nodes, edges, 800, 600)
  for (const [, pos] of positions) {
    expect(pos.x).toBeGreaterThanOrEqual(40)
    expect(pos.x).toBeLessThanOrEqual(760)
    expect(pos.y).toBeGreaterThanOrEqual(40)
    expect(pos.y).toBeLessThanOrEqual(560)
  }
})

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
  const { positions } = computeLayout(nodes, [], 800, 600)
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

test("computeLayout returns simplified=true when node count > 150", () => {
  const nodes = Array.from({ length: 151 }, (_, i) => ({ id: `n${i}` }))
  const { simplified } = computeLayout(nodes, [], 1000, 800)
  expect(simplified).toBe(true)
})

test("computeLayout returns simplified=false when node count <= 150", () => {
  const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}` }))
  const { simplified } = computeLayout(nodes, [], 1000, 800)
  expect(simplified).toBe(false)
})
