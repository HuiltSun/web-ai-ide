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
  const count = nodes.length
  if (count === 0) return positions

  const cx = width / 2
  const cy = height / 2
  // Seed nodes on a circle sized to fill ~70% of the smaller dimension
  const initR = Math.min(width, height) * 0.35
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count
    positions.set(nodes[i].id, {
      x: cx + initR * Math.cos(angle),
      y: cy + initR * Math.sin(angle),
    })
  }

  const REST = 240      // ideal edge length between connected nodes
  const KR = 80000      // repulsion strength
  const KS = 0.015      // spring stiffness (weaker = more spread)
  const ITERS = 600     // more iterations for convergence
  const PAD = 110       // keep nodes away from edges

  const ids = nodes.map((n) => n.id)

  for (let iter = 0; iter < ITERS; iter++) {
    // Cooling: max displacement shrinks from 60→4 as simulation settles
    const temp = 1 - iter / ITERS
    const maxStep = 4 + 56 * temp

    const fx = new Float64Array(count)
    const fy = new Float64Array(count)

    // Repulsion between every pair
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

    // Spring attraction along edges
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

    // Apply with per-node step clamping
    for (let i = 0; i < count; i++) {
      const pos = positions.get(ids[i])!
      const mag = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i])
      const scale = mag > maxStep ? maxStep / mag : 1
      pos.x = Math.max(PAD, Math.min(width - PAD, pos.x + fx[i] * scale))
      pos.y = Math.max(PAD, Math.min(height - PAD, pos.y + fy[i] * scale))
    }
  }

  return positions
}
