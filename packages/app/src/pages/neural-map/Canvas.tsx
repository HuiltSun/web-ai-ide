import { For, onMount, onCleanup } from "solid-js"
import type { NeuralMapStore } from "./store"

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  agent:    { fill: "#0d2040", stroke: "#58a6ff" },
  auth:     { fill: "#0a2618", stroke: "#3fb950" },
  provider: { fill: "#2d1d04", stroke: "#d29922" },
  storage:  { fill: "#1a0a2e", stroke: "#bc8cff" },
  server:   { fill: "#2d0f0f", stroke: "#f78166" },
  session:  { fill: "#0d1b2e", stroke: "#79c0ff" },
  neural:   { fill: "#1a0a2e", stroke: "#bc8cff" },
  lsp:      { fill: "#0a1a2e", stroke: "#79c0ff" },
  format:   { fill: "#1a1a0a", stroke: "#d29922" },
}

function nodeColor(id: string) {
  for (const [key, val] of Object.entries(NODE_COLORS)) {
    if (id.toLowerCase().includes(key)) return val
  }
  return { fill: "#161b22", stroke: "#8b949e" }
}

function nodeRadius(activity: number, fileCount: number): number {
  const base = 28
  const actBonus = Math.sqrt(activity) * 1.5
  const sizeBonus = Math.min(fileCount, 20) * 0.8
  return Math.round(base + actBonus + sizeBonus)
}

export default function NeuralMapCanvas(props: { store: NeuralMapStore; width: number; height: number }) {
  const { state, selectNode } = props.store
  let svgRef!: SVGSVGElement
  let panX = 0
  let panY = 0
  let scale = 1
  let dragStart: { x: number; y: number; px: number; py: number } | null = null

  function applyTransform() {
    const g = svgRef?.querySelector("g.nm-root") as SVGGElement | null
    if (g) g.setAttribute("transform", `translate(${panX},${panY}) scale(${scale})`)
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const rect = svgRef.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (props.width / rect.width)
    const my = (e.clientY - rect.top) * (props.height / rect.height)
    const delta = e.deltaY > 0 ? 0.88 : 1.14
    const newScale = Math.max(0.15, Math.min(5, scale * delta))
    panX = mx - (mx - panX) * (newScale / scale)
    panY = my - (my - panY) * (newScale / scale)
    scale = newScale
    applyTransform()
  }

  function onMouseDown(e: MouseEvent) {
    if ((e.target as Element).closest("[data-node]")) return
    dragStart = { x: e.clientX, y: e.clientY, px: panX, py: panY }
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragStart) return
    const rect = svgRef.getBoundingClientRect()
    const scaleX = props.width / rect.width
    const scaleY = props.height / rect.height
    panX = dragStart.px + (e.clientX - dragStart.x) * scaleX
    panY = dragStart.py + (e.clientY - dragStart.y) * scaleY
    applyTransform()
  }

  function onMouseUp() { dragStart = null }

  onMount(() => {
    svgRef.addEventListener("wheel", onWheel, { passive: false })
  })
  onCleanup(() => {
    svgRef.removeEventListener("wheel", onWheel)
  })

  return (
    <svg
      ref={svgRef!}
      width="100%"
      height="100%"
      viewBox={`0 0 ${props.width} ${props.height}`}
      style={{ background: "radial-gradient(ellipse at 50% 50%, #0d1b2e 0%, #060d19 100%)", cursor: "grab", display: "block" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <defs>
        <filter id="nm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nm-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g class="nm-root">
        {/* Edges */}
        <For each={state.graph?.edges ?? []}>
          {(edge) => {
            const a = state.positions.get(edge.source)
            const b = state.positions.get(edge.target)
            if (!a || !b) return null
            const cx = (a.x + b.x) / 2 + (b.y - a.y) * 0.25
            const cy = (a.y + b.y) / 2 - (b.x - a.x) * 0.25
            return (
              <path
                d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`}
                fill="none"
                stroke="#58a6ff"
                stroke-width="1.5"
                opacity="0.25"
              />
            )
          }}
        </For>

        {/* Nodes */}
        <For each={state.graph?.nodes ?? []}>
          {(node) => {
            const pos = state.positions.get(node.id)
            if (!pos) return null
            const isSelected = () => state.selectedNodeId === node.id
            const isUnderstood = () => state.understoodNodeIds.has(node.id)
            const color = nodeColor(node.id)
            const r = nodeRadius(node.activity, node.fileCount)
            const strokeColor = () => isSelected() ? "#ffffff" : isUnderstood() ? "#3fb950" : color.stroke
            const fillColor = () => isUnderstood() ? "#0a2618" : color.fill

            return (
              <g
                data-node={node.id}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => selectNode(node.id)}
              >
                {/* Outer pulse ring */}
                <circle r={r + 12} fill="none" stroke={strokeColor()} stroke-width="0.8" opacity="0.2" />
                {/* Glow base */}
                <circle r={r} fill={fillColor()} stroke={strokeColor()} stroke-width="2" filter="url(#nm-glow-sm)" />
                {/* Node label */}
                <text
                  text-anchor="middle"
                  dominant-baseline="middle"
                  y="-6"
                  fill={isUnderstood() ? "#3fb950" : "#e6edf3"}
                  font-size="14"
                  font-family="monospace"
                  font-weight="bold"
                  pointer-events="none"
                >
                  {isUnderstood() ? `✓ ${node.label}` : node.label}
                </text>
                {/* Sub-label: file count */}
                <text
                  text-anchor="middle"
                  dominant-baseline="middle"
                  y="10"
                  fill={color.stroke}
                  font-size="10"
                  font-family="monospace"
                  opacity="0.7"
                  pointer-events="none"
                >
                  {node.fileCount}f · {node.lineCount > 999 ? `${Math.round(node.lineCount / 1000)}k` : node.lineCount}L
                </text>
              </g>
            )
          }}
        </For>
      </g>
    </svg>
  )
}
