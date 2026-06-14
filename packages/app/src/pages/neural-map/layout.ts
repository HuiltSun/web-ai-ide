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

  // Deterministic seed: place nodes in a circle
  const count = nodes.length
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count
    positions.set(nodes[i].id, {
      x: width / 2 + (width / 3) * Math.cos(angle),
      y: height / 2 + (height / 3) * Math.sin(angle),
    })
  }

  const REST = 180   // spring rest length
  const KR = 12000   // repulsion constant
  const KS = 0.04    // spring stiffness
  const DAMP = 0.75  // velocity damping

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

    // Attraction: spring along edges
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

    // Apply forces with clamping to viewport
    for (const id of ids) {
      const pos = positions.get(id)!
      const f = forces.get(id)!
      pos.x = Math.max(80, Math.min(width - 80, pos.x + f.x * DAMP))
      pos.y = Math.max(80, Math.min(height - 80, pos.y + f.y * DAMP))
    }
  }

  return positions
}
