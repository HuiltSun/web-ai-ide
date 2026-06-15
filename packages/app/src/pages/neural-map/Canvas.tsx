import { For, onMount, onCleanup } from "solid-js"
import type { NeuralMapStore } from "./store"
import type { GraphNode } from "./api"
import { NM_THEME, NODE_COLORS, NODE_DEFAULT_COLOR } from "./theme"
import { nodeRadius } from "./layout"

function nodeColor(id: string) {
  for (const [key, val] of Object.entries(NODE_COLORS)) {
    if (id.toLowerCase().includes(key)) return val
  }
  return NODE_DEFAULT_COLOR
}

export default function NeuralMapCanvas(props: {
  store: NeuralMapStore
  width: number
  height: number
  onDrillDown: (node: GraphNode) => void
}) {
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
        <For each={props.store.currentLevel()?.graph.edges ?? []}>
          {(edge) => {
            const a = props.store.currentLevel()?.positions.get(edge.source)
            const b = props.store.currentLevel()?.positions.get(edge.target)
            if (!a || !b) return null
            const cx = (a.x + b.x) / 2 + (b.y - a.y) * 0.25
            const cy = (a.y + b.y) / 2 - (b.x - a.x) * 0.25
            return (
              <path
                d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`}
                fill="none"
                stroke={NM_THEME.accent}
                stroke-width="1.5"
                opacity="0.25"
              />
            )
          }}
        </For>

        {/* Nodes */}
        <For each={props.store.currentLevel()?.graph.nodes ?? []}>
          {(node) => {
            const pos = props.store.currentLevel()?.positions.get(node.id)
            if (!pos) return null
            const isSelected = () => state.selectedNodeId === node.id
            const isUnderstood = () => state.understoodNodeIds.has(node.id)
            const color = nodeColor(node.id)
            const r = nodeRadius(node.activity, node.fileCount)
            const strokeColor = () => isSelected() ? "#ffffff" : isUnderstood() ? NM_THEME.understood : color.stroke
            const fillColor = () => isUnderstood() ? "#0a2618" : color.fill

            return (
              <g
                data-node={node.id}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => selectNode(node.id)}
                onDblClick={() => {
                  if (node.hasChildren) props.onDrillDown(node)
                }}
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
                  fill={isUnderstood() ? NM_THEME.understood : NM_THEME.textPrimary}
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
                {/* ⊕ drill-down badge */}
                {node.hasChildren && (
                  <g transform={`translate(${r - 4},${-(r - 4)})`} pointer-events="none">
                    <circle r={8} fill={NM_THEME.bg} stroke={NM_THEME.accent} stroke-width="1.5" />
                    <text text-anchor="middle" dominant-baseline="middle" fill={NM_THEME.accent} font-size="11" font-family="monospace">⊕</text>
                  </g>
                )}
              </g>
            )
          }}
        </For>
      </g>
    </svg>
  )
}
