import { createSignal, Show } from "solid-js"
import type { NeuralMapStore } from "./store"
import { fetchGuide } from "./api"
import { NM_THEME } from "./theme"

export default function GuidePanel(props: {
  store: NeuralMapStore
  serverUrl: string
  directory: string
  onMarkUnderstood: () => Promise<void>
  onNavigateNext: () => void
}) {
  const { state } = props.store
  const node = () => props.store.selectedNode()
  const isUnderstood = () =>
    state.selectedNodeId ? state.understoodNodeIds.has(state.selectedNodeId) : false

  const [intro, setIntro] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  let prevNodeId: string | undefined
  const resetIfNodeChanged = () => {
    const id = state.selectedNodeId
    if (id !== prevNodeId) {
      prevNodeId = id
      setIntro("")
      setError(null)
    }
  }

  async function startGuide() {
    resetIfNodeChanged()
    const n = node()
    if (!n) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchGuide(props.serverUrl, props.directory, n)
      setIntro(res.intro)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const btnStyle = () => ({
    background: loading() ? NM_THEME.border : "#0d419d",
    "border-radius": "8px",
    padding: "8px 10px",
    "font-size": "10px",
    color: loading() ? NM_THEME.textMuted : NM_THEME.accent,
    border: "none",
    cursor: loading() ? "default" : "pointer",
    "font-family": "monospace",
    width: "100%",
    "line-height": "1.5",
  })

  return (
    <div
      style={{
        width: "260px",
        "border-left": `1px solid ${NM_THEME.border}`,
        display: "flex",
        "flex-direction": "column",
        background: NM_THEME.bg,
        "font-family": "monospace",
        "flex-shrink": "0",
      }}
    >
      <Show
        when={node()}
        fallback={
          <div
            style={{
              padding: "20px",
              color: "#484f58",
              "font-size": "12px",
              "text-align": "center",
              "margin-top": "40px",
            }}
          >
            点击左侧节点
            <br />
            开始探索
          </div>
        }
      >
        {/* Node metadata */}
        <div style={{ padding: "12px", "border-bottom": `1px solid ${NM_THEME.border}`, "flex-shrink": "0" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-bottom": "8px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                "border-radius": "50%",
                background: NM_THEME.accent,
                "box-shadow": `0 0 6px ${NM_THEME.accent}`,
              }}
            />
            <div
              style={{
                "font-size": "11px",
                color: NM_THEME.textPrimary,
                "font-weight": "bold",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
            >
              {node()!.id}
            </div>
          </div>
          <div style={{ "font-size": "9px", color: NM_THEME.textMuted, "line-height": "1.6", "margin-bottom": "8px" }}>
            {node()!.fileCount} 个文件 · {node()!.lineCount} 行
          </div>
          <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
            {node()!.activity > 60 && (
              <span style={{ background: "#2d1d04", "border-radius": "3px", padding: "2px 6px", "font-size": "8px", color: NM_THEME.active }}>
                高活跃
              </span>
            )}
            <span style={{ background: NM_THEME.border, "border-radius": "3px", padding: "2px 6px", "font-size": "8px", color: NM_THEME.textMuted }}>
              活跃度 {node()!.activity}
            </span>
          </div>
        </div>

        {/* Guide content */}
        <div style={{ flex: 1, "min-height": "0", overflow: "auto", padding: "10px", display: "flex", "flex-direction": "column", gap: "8px" }}>
          <div style={{ "font-size": "9px", color: NM_THEME.textMuted, "text-transform": "uppercase", "letter-spacing": "0.5px" }}>
            📖 模块介绍
          </div>

          <Show when={intro()}>
            <div style={{ "font-size": "10px", color: NM_THEME.textPrimary, "line-height": "1.7", "white-space": "pre-wrap" }}>
              {intro()}
            </div>
          </Show>

          <Show when={error()}>
            <div style={{ "font-size": "9px", color: NM_THEME.danger }}>{error()}</div>
          </Show>

          <button style={btnStyle()} disabled={loading()} onClick={() => void startGuide()}>
            {loading() ? "加载中..." : intro() ? "重新生成" : "生成介绍"}
          </button>
        </div>

        {/* Bottom actions */}
        <div
          style={{
            padding: "10px",
            "border-top": `1px solid ${NM_THEME.border}`,
            display: "flex",
            gap: "6px",
            "flex-shrink": "0",
          }}
        >
          <button
            style={{
              flex: 1,
              background: isUnderstood() ? "#0a2618" : NM_THEME.border,
              "border-radius": "6px",
              padding: "5px",
              "text-align": "center",
              "font-size": "9px",
              color: isUnderstood() ? NM_THEME.understood : NM_THEME.textMuted,
              border: "none",
              cursor: "pointer",
              "font-family": "monospace",
            }}
            onClick={() => void props.onMarkUnderstood()}
          >
            {isUnderstood() ? "✓ 已理解" : "标记已懂"}
          </button>
          <button
            style={{
              flex: 1,
              background: "#0d419d",
              "border-radius": "6px",
              padding: "5px",
              "text-align": "center",
              "font-size": "9px",
              color: NM_THEME.accent,
              border: "none",
              cursor: "pointer",
              "font-family": "monospace",
            }}
            onClick={props.onNavigateNext}
          >
            → 下一站
          </button>
        </div>
      </Show>
    </div>
  )
}
