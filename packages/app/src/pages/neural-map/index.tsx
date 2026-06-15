import { createSignal, For, onMount, Show } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { useServer } from "@/context/server"
import { decode64 } from "@/utils/base64"
import { createNeuralMapStore } from "./store"
import { fetchGraph, fetchGuide, fetchProgress, markUnderstood, unmarkUnderstood } from "./api"
import type { GraphNode } from "./api"
import NeuralMapCanvas from "./Canvas"
import GuidePanel from "./GuidePanel"
import { NM_THEME } from "./theme"

const SESSION_ID = "neural-map-global"
const CANVAS_WIDTH = 1400
const CANVAS_HEIGHT = 800
const INITIAL_SRC = "packages/opencode/src"

export default function NeuralMapPage() {
  const server = useServer()
  const navigate = useNavigate()
  const params = useParams()
  const store = createNeuralMapStore()
  const { state, loadGraph, selectNode, setGuideLoading, setGuideResponse, showFeedback, markUnderstood: markLocal, unmarkUnderstood: unmarkLocal, setLoading, setError } = store

  const serverUrl = () => server.current?.http.url ?? ""
  const directory = () => decode64(params.dir)

  const [toast, setToast] = createSignal<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  onMount(async () => {
    setLoading(true)
    try {
      const [graph, progress] = await Promise.all([
        fetchGraph(serverUrl(), directory(), INITIAL_SRC),
        fetchProgress(serverUrl(), SESSION_ID),
      ])
      loadGraph(INITIAL_SRC, "root", graph, CANVAS_WIDTH, CANVAS_HEIGHT)
      for (const entry of progress) {
        if (entry.understoodAt) markLocal(entry.nodeId)
      }
    } catch (e) {
      setError(String(e))
    }
  })

  async function handleDrillDown(node: GraphNode) {
    store.setDrillLoading(true)
    try {
      const graph = await fetchGraph(serverUrl(), directory(), node.path)
      if (graph.nodes.length === 0) {
        showToast("此目录无可展示的子模块")
        store.setDrillLoading(false)
        return
      }
      store.pushLevel(node.path, node.label, graph, CANVAS_WIDTH, CANVAS_HEIGHT)
    } catch {
      showToast("加载子目录失败")
      store.setDrillLoading(false)
    }
  }

  async function handleAskGuide(userAnswer?: string) {
    const node = store.selectedNode()
    if (!node || !store.currentLevel()) return
    setGuideLoading(true)
    try {
      const response = await fetchGuide(serverUrl(), {
        node,
        allNodeIds: store.currentLevel()!.graph.nodes.map((n) => n.id),
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
    if (nextId && store.currentLevel()) {
      const found = store.currentLevel()!.graph.nodes.find((n) => n.id === nextId)
      if (found) {
        selectNode(nextId)
        void handleAskGuide()
      }
    }
  }

  const total = () => store.currentLevel()?.graph.nodes.length ?? 0
  const understood = () => state.understoodNodeIds.size
  const pct = () => total() > 0 ? Math.round((understood() / total()) * 100) : 0

  return (
    <div style={{ position: "fixed", inset: "0", "z-index": "9999", display: "flex", "flex-direction": "column", background: NM_THEME.bg, color: NM_THEME.textPrimary }}>
      {/* Top bar */}
      <div style={{ background: NM_THEME.surface, "border-bottom": `1px solid ${NM_THEME.border}`, padding: "6px 16px", display: "flex", "align-items": "center", gap: "12px", "flex-shrink": 0 }}>
        <div style={{ "font-size": "11px", color: NM_THEME.textMuted, "font-family": "monospace" }}>web-ai-ide</div>
        <div style={{ "font-size": "10px", color: NM_THEME.textMuted }}>›</div>
        <div style={{ background: "#0d419d", "border-radius": "4px", padding: "3px 10px", "font-size": "10px", color: NM_THEME.accent, "font-family": "monospace", "font-weight": "bold" }}>
          ⬡ NEURAL MAP
        </div>
        {/* Breadcrumb */}
        <Show when={state.navigationStack.length > 0}>
          <div style={{ display: "flex", "align-items": "center", gap: "4px", "font-size": "10px", "font-family": "monospace" }}>
            <For each={state.navigationStack}>
              {(level, i) => (
                <>
                  <Show when={i() > 0}>
                    <span style={{ color: NM_THEME.textMuted }}>›</span>
                  </Show>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: i() < state.navigationStack.length - 1 ? "pointer" : "default",
                      color: i() < state.navigationStack.length - 1 ? NM_THEME.accent : NM_THEME.textPrimary,
                      "font-family": "monospace",
                      "font-size": "10px",
                      padding: "0 2px",
                    }}
                    onClick={() => {
                      if (i() < state.navigationStack.length - 1) {
                        store.popLevel(i())
                      }
                    }}
                  >
                    {level.label}
                  </button>
                </>
              )}
            </For>
          </div>
        </Show>
        <div style={{ "margin-left": "auto", display: "flex", "align-items": "center", gap: "10px" }}>
          <Show when={total() > 0}>
            <div style={{ "font-size": "10px", color: NM_THEME.understood, "font-family": "monospace" }}>
              ● 已理解 {understood()} / {total()} ({pct()}%)
            </div>
            <div style={{ background: NM_THEME.border, "border-radius": "12px", height: "6px", width: "80px", overflow: "hidden" }}>
              <div style={{ width: `${pct()}%`, height: "100%", background: `linear-gradient(90deg,${NM_THEME.understood},${NM_THEME.accent})`, "border-radius": "12px", transition: "width 0.3s" }} />
            </div>
          </Show>
          <div style={{ width: "1px", height: "16px", background: NM_THEME.border }} />
          <button
            style={{ "font-size": "10px", color: NM_THEME.textMuted, background: "none", border: "none", cursor: "pointer", "font-family": "monospace" }}
            onClick={() => navigate(-1)}
          >
            ✕ 退出模式
          </button>
        </div>
      </div>

      {/* Toast */}
      <Show when={toast()}>
        <div style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          background: NM_THEME.surface,
          border: `1px solid ${NM_THEME.border}`,
          "border-radius": "8px",
          padding: "8px 16px",
          "font-size": "12px",
          color: NM_THEME.textPrimary,
          "font-family": "monospace",
          "z-index": "10000",
        }}>
          {toast()}
        </div>
      </Show>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Show when={state.loading}>
          <div style={{ flex: 1, display: "flex", "align-items": "center", "justify-content": "center", color: NM_THEME.textMuted, "font-size": "14px" }}>
            正在构建代码神经图...
          </div>
        </Show>
        <Show when={state.error}>
          <div style={{ flex: 1, display: "flex", "align-items": "center", "justify-content": "center", color: NM_THEME.danger, "font-size": "14px" }}>
            {state.error}
          </div>
        </Show>
        <Show when={!state.loading && !state.error && store.currentLevel()}>
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <NeuralMapCanvas store={store} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onDrillDown={handleDrillDown} />
            <Show when={state.drillLoading}>
              <div style={{
                position: "absolute",
                inset: "0",
                background: "rgba(13,17,23,0.7)",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                color: NM_THEME.textMuted,
                "font-size": "14px",
                "font-family": "monospace",
              }}>
                正在加载子目录...
              </div>
            </Show>
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
