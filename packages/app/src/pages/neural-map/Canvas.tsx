import { For, createSignal, onMount, onCleanup } from "solid-js"
import type { NeuralMapStore } from "./store"

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  agent:    { fill: "#0d2040", stroke: "#58a6ff" },
  auth:     { fill: "#0a2618", stroke: "#3fb950" },
  provider: { fill: "#2d1d04", stroke: "#d29922" },
  storage:  { fill: "#1a0a2e", stroke: "#bc8cff" },
  server:   { fill: "#2d0f0f", stroke: "#f78166" },
  session:  { fill: "#0d1b2e", stroke: "#79c0ff" },
}

function nodeColor(id: string) {
  for (const [key, val] of Object.entries(NODE_COLORS)) {
    if (id.includes(key)) return val
  }
  return { fill: "#161b22", stroke: "#8b949e" }
}

function nodeRadius(activity: number, fileCount: number): number {
  const base = 14
  const actBonus = Math.sqrt(activity) * 0.8
  const sizeBonus = Math.min(fileCount, 10) * 0.6
  return Math.round(base + actBonus + sizeBonus)
}

export default function NeuralMapCanvas(props: { store: NeuralMapStore; width: number; height: number }) {
  const { state, selectNode } = props.store
  const [transform, setTransform] = createSignal({ x: 0, y: 0, scale: 1 })
  let svgRef!: SVGSVGElement
  let dragStart: { x: number; y: number; tx: number; ty: number } | null = null

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.2, Math.min(4, t.scale * delta)),
    }))
  }

  function onMouseDown(e: MouseEvent) {
    if ((e.target as Element).closest("[data-node]")) return
    const t = transform()
    dragStart = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y }
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragStart) return
    setTransform((t) => ({
      ...t,
      x: dragStart!.tx + (e.clientX - dragStart!.x),
      y: dragStart!.ty + (e.clientY - dragStart!.y),
    }))
  }

  function onMouseUp() {
    dragStart = null
  }

  onMount(() => {
    svgRef.addEventListener("wheel", onWheel, { passive: false })
  })
  onCleanup(() => {
    svgRef.removeEventListener("wheel", onWheel)
  })

  return (
    <svg
      ref={svgRef!}
      width={props.width}
      height={props.height}
      style={{ background: "radial-gradient(ellipse at 50% 50%, #0d1b2e 0%, #060d19 100%)", cursor: "grab" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <defs>
        <filter id="nm-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nm-glow-sm">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform={`translate(${transform().x},${transform().y}) scale(${transform().scale})`}>
        {/* Edges */}
        <For each={state.graph?.edges ?? []}>
          {(edge) => {
            const a = () => state.positions.get(edge.source)
            const b = () => state.positions.get(edge.target)
            return (
              <>
                {a() && b() && (
                  <path
                    d={`M${a()!.x},${a()!.y} Q${(a()!.x + b()!.x) / 2 + 30},${(a()!.y + b()!.y) / 2 - 30} ${b()!.x},${b()!.y}`}
                    fill="none"
                    stroke="#58a6ff"
                    stroke-width="1.5"
                    opacity="0.3"
                  />
                )}
              </>
            )
          }}
        </For>

        {/* Nodes */}
        <For each={state.graph?.nodes ?? []}>
          {(node) => {
            const pos = () => state.positions.get(node.id)
            const isSelected = () => state.selectedNodeId === node.id
            const isUnderstood = () => state.understoodNodeIds.has(node.id)
            const color = nodeColor(node.id)
            const r = nodeRadius(node.activity, node.fileCount)

            return (
              <>
                {pos() && (
                  <g
                    data-node={node.id}
                    transform={`translate(${pos()!.x},${pos()!.y})`}
                    style={{ cursor: "pointer" }}
                    onClick={() => selectNode(node.id)}
                  >
                    {/* Pulse ring */}
                    <circle
                      r={r + 8}
                      fill="none"
                      stroke={isUnderstood() ? "#3fb950" : color.stroke}
                      stroke-width="0.5"
                      opacity="0.3"
                    />
                    {/* Main node circle */}
                    <circle
                      r={r}
                      fill={isUnderstood() ? "#0a2618" : color.fill}
                      stroke={isSelected() ? "#ffffff" : isUnderstood() ? "#3fb950" : color.stroke}
                      stroke-width={isSelected() ? 2.5 : 1.5}
                      filter="url(#nm-glow-sm)"
                    />
                    {/* Label */}
                    <text
                      text-anchor="middle"
                      dominant-baseline="middle"
                      fill={isUnderstood() ? "#3fb950" : color.stroke}
                      font-size={Math.max(8, Math.min(11, r * 0.7))}
                      font-family="monospace"
                      pointer-events="none"
                    >
                      {isUnderstood() ? `✓ ${node.label}` : node.label}
                    </text>
                  </g>
                )}
              </>
            )
          }}
        </For>
      </g>
    </svg>
  )
}
