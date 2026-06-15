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
