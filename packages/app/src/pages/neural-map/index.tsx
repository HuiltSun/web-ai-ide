import { createSignal, onMount, Show } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { useServer } from "@/context/server"
import { decode64 } from "@/utils/base64"
import { createNeuralMapStore } from "./store"
import { fetchGraph, fetchGuide, fetchProgress, markUnderstood, unmarkUnderstood } from "./api"
import NeuralMapCanvas from "./Canvas"
import GuidePanel from "./GuidePanel"

const SESSION_ID = "neural-map-global"
const CANVAS_WIDTH = 1400
const CANVAS_HEIGHT = 800

export default function NeuralMapPage() {
  const server = useServer()
  const navigate = useNavigate()
  const params = useParams()
  const store = createNeuralMapStore()
  const { state, loadGraph, selectNode, setGuideLoading, setGuideResponse, showFeedback, markUnderstood: markLocal, unmarkUnderstood: unmarkLocal, setLoading, setError } = store

  const serverUrl = () => server.current?.http.url ?? ""
  const directory = () => decode64(params.dir)

  onMount(async () => {
    setLoading(true)
    try {
      const [graph, progress] = await Promise.all([
        fetchGraph(serverUrl(), directory()),
        fetchProgress(serverUrl(), SESSION_ID),
      ])
      loadGraph(graph, CANVAS_WIDTH, CANVAS_HEIGHT)
      for (const entry of progress) {
        if (entry.understoodAt) markLocal(entry.nodeId)
      }
    } catch (e) {
      setError(String(e))
    }
  })

  async function handleAskGuide(userAnswer?: string) {
    const node = store.selectedNode()
    if (!node || !state.graph) return
    setGuideLoading(true)
    try {
      const response = await fetchGuide(serverUrl(), {
        node,
        allNodeIds: state.graph.nodes.map((n) => n.id),
        understoodNodeIds: [...state.understoodNodeIds],
        userAnswer,
        sessionId: SESSION_ID,
      })
      setGuideResponse(response)
      if (userAnswer) showFeedback()
    } catch {
      setGuideLoading(false)
    }
  }

  async function handleMarkUnderstood() {
    const nodeId = state.selectedNodeId
    if (!nodeId) return
    if (state.understoodNodeIds.has(nodeId)) {
      await unmarkUnderstood(serverUrl(), SESSION_ID, nodeId)
      unmarkLocal(nodeId)
    } else {
      await markUnderstood(serverUrl(), SESSION_ID, nodeId)
      markLocal(nodeId)
    }
  }

  function handleNavigateNext() {
    const nextId = state.guide.response?.nextNodeId
    if (nextId && state.graph) {
      const found = state.graph.nodes.find((n) => n.id === nextId)
      if (found) {
        selectNode(nextId)
        void handleAskGuide()
      }
    }
  }

  const total = () => state.graph?.nodes.length ?? 0
  const understood = () => state.understoodNodeIds.size
  const pct = () => total() > 0 ? Math.round((understood() / total()) * 100) : 0

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100vh", background: "#0d1117", color: "#cdd9e5" }}>
      {/* Top bar */}
      <div style={{ background: "#161b22", "border-bottom": "1px solid #21262d", padding: "6px 16px", display: "flex", "align-items": "center", gap: "12px", "flex-shrink": 0 }}>
        <div style={{ "font-size": "11px", color: "#8b949e", "font-family": "monospace" }}>web-ai-ide</div>
        <div style={{ "font-size": "10px", color: "#8b949e" }}>›</div>
        <div style={{ background: "#0d419d", "border-radius": "4px", padding: "3px 10px", "font-size": "10px", color: "#58a6ff", "font-family": "monospace", "font-weight": "bold" }}>
          ⬡ NEURAL MAP
        </div>
        <div style={{ "margin-left": "auto", display: "flex", "align-items": "center", gap: "10px" }}>
          <Show when={total() > 0}>
            <div style={{ "font-size": "10px", color: "#3fb950", "font-family": "monospace" }}>
              ● 已理解 {understood()} / {total()} ({pct()}%)
            </div>
            <div style={{ background: "#21262d", "border-radius": "12px", height: "6px", width: "80px", overflow: "hidden" }}>
              <div style={{ width: `${pct()}%`, height: "100%", background: "linear-gradient(90deg,#3fb950,#58a6ff)", "border-radius": "12px", transition: "width 0.3s" }} />
            </div>
          </Show>
          <div style={{ width: "1px", height: "16px", background: "#21262d" }} />
          <button
            style={{ "font-size": "10px", color: "#8b949e", background: "none", border: "none", cursor: "pointer", "font-family": "monospace" }}
            onClick={() => navigate(-1)}
          >
            ✕ 退出模式
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Show when={state.loading}>
          <div style={{ flex: 1, display: "flex", "align-items": "center", "justify-content": "center", color: "#8b949e", "font-size": "14px" }}>
            正在构建代码神经图...
          </div>
        </Show>
        <Show when={state.error}>
          <div style={{ flex: 1, display: "flex", "align-items": "center", "justify-content": "center", color: "#f78166", "font-size": "14px" }}>
            {state.error}
          </div>
        </Show>
        <Show when={!state.loading && !state.error && state.graph}>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <NeuralMapCanvas store={store} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
          </div>
          <GuidePanel
            store={store}
            onAskGuide={handleAskGuide}
            onMarkUnderstood={handleMarkUnderstood}
            onNavigateNext={handleNavigateNext}
          />
        </Show>
      </div>
    </div>
  )
}
