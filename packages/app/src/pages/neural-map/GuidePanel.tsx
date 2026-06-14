import { Show, createSignal } from "solid-js"
import type { NeuralMapStore } from "./store"

export default function GuidePanel(props: {
  store: NeuralMapStore
  onAskGuide: (answer?: string) => Promise<void>
  onMarkUnderstood: () => Promise<void>
  onNavigateNext: () => void
}) {
  const { state, setAnswer } = props.store
  const [submitting, setSubmitting] = createSignal(false)

  async function submitAnswer() {
    setSubmitting(true)
    await props.onAskGuide(state.guide.answer)
    setSubmitting(false)
  }

  const node = () => props.store.selectedNode()
  const guide = () => state.guide
  const isUnderstood = () => state.selectedNodeId ? state.understoodNodeIds.has(state.selectedNodeId) : false

  return (
    <div style={{
      width: "220px",
      "border-left": "1px solid #21262d",
      display: "flex",
      "flex-direction": "column",
      background: "#0d1117",
      "font-family": "monospace",
    }}>
      <Show when={node()} fallback={
        <div style={{ padding: "20px", color: "#484f58", "font-size": "12px", "text-align": "center", "margin-top": "40px" }}>
          点击左侧节点<br />开始探索
        </div>
      }>
        {/* Node metadata */}
        <div style={{ padding: "12px", "border-bottom": "1px solid #21262d" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-bottom": "8px" }}>
            <div style={{ width: "8px", height: "8px", "border-radius": "50%", background: "#58a6ff", "box-shadow": "0 0 6px #58a6ff" }} />
            <div style={{ "font-size": "11px", color: "#cdd9e5", "font-weight": "bold" }}>{node()!.id}</div>
          </div>
          <div style={{ "font-size": "9px", color: "#8b949e", "line-height": "1.6", "margin-bottom": "8px" }}>
            {node()!.fileCount} 个文件 · {node()!.lineCount} 行
          </div>
          <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
            {node()!.activity > 60 && (
              <span style={{ background: "#2d1d04", "border-radius": "3px", padding: "2px 6px", "font-size": "8px", color: "#d29922" }}>高活跃</span>
            )}
            <span style={{ background: "#21262d", "border-radius": "3px", padding: "2px 6px", "font-size": "8px", color: "#8b949e" }}>
              活跃度 {node()!.activity}
            </span>
          </div>
        </div>

        {/* AI conversation */}
        <div style={{ flex: 1, padding: "10px", display: "flex", "flex-direction": "column", gap: "8px", "overflow-y": "auto" }}>
          <div style={{ "font-size": "9px", color: "#8b949e", "text-transform": "uppercase", "letter-spacing": "0.5px" }}>🤖 AI 向导</div>

          {/* Initial state: node selected, no guide yet */}
          <Show when={!guide().loading && !guide().response}>
            <button
              style={{ background: "#0d419d", "border-radius": "8px", padding: "10px", "font-size": "10px", color: "#58a6ff", border: "none", cursor: "pointer", "font-family": "monospace", width: "100%" }}
              onClick={() => void props.onAskGuide()}
            >
              🤖 开始解读这个模块
            </button>
          </Show>

          <Show when={guide().loading}>
            <div style={{ background: "#161b22", "border-radius": "8px", padding: "8px", "font-size": "10px", color: "#8b949e", "border-left": "2px solid #30363d" }}>
              正在思考...
            </div>
          </Show>

          <Show when={guide().response && !guide().loading}>
            {/* Intro */}
            <div style={{ background: "#161b22", "border-radius": "8px", padding: "8px", "font-size": "10px", color: "#cdd9e5", "line-height": "1.5", "border-left": "2px solid #58a6ff" }}>
              {guide().response!.intro}
            </div>

            {/* Quiz */}
            <Show when={!guide().showFeedback}>
              <div style={{ background: "#161b22", "border-radius": "8px", padding: "8px", "font-size": "10px", color: "#cdd9e5", "line-height": "1.5", "border-left": "2px solid #d29922" }}>
                🎯 <strong style={{ color: "#d29922" }}>猜一猜</strong><br />
                {guide().response!.quiz}
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <input
                  style={{
                    flex: 1,
                    background: "#161b22",
                    border: "1px solid #30363d",
                    "border-radius": "6px",
                    padding: "6px 8px",
                    "font-size": "9px",
                    color: "#cdd9e5",
                    outline: "none",
                    "font-family": "monospace",
                  }}
                  placeholder="输入你的答案..."
                  value={guide().answer}
                  onInput={(e) => setAnswer(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void submitAnswer() }}
                />
                <button
                  style={{ background: "#0d419d", "border-radius": "6px", padding: "6px 8px", "font-size": "9px", color: "#58a6ff", border: "none", cursor: "pointer" }}
                  onClick={() => void submitAnswer()}
                  disabled={submitting()}
                >
                  ↵
                </button>
              </div>
            </Show>

            {/* Feedback */}
            <Show when={guide().showFeedback && guide().response?.feedback}>
              <div style={{ background: "#0a2618", "border-radius": "8px", padding: "8px", "font-size": "10px", color: "#3fb950", "line-height": "1.5" }}>
                ✓ {guide().response!.feedback}
              </div>
            </Show>
          </Show>
        </div>

        {/* Actions */}
        <div style={{ padding: "10px", "border-top": "1px solid #21262d", display: "flex", "flex-direction": "column", gap: "6px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              style={{
                flex: 1,
                background: isUnderstood() ? "#0a2618" : "#21262d",
                "border-radius": "6px",
                padding: "5px",
                "text-align": "center",
                "font-size": "9px",
                color: isUnderstood() ? "#3fb950" : "#8b949e",
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
                color: "#58a6ff",
                border: "none",
                cursor: "pointer",
                "font-family": "monospace",
              }}
              onClick={props.onNavigateNext}
            >
              → 下一站
            </button>
          </div>
          <Show when={guide().response?.nextNodeId}>
            <div style={{ background: "#1c1f06", "border-radius": "6px", padding: "6px", "font-size": "9px", color: "#d29922", "text-align": "center" }}>
              🎯 推荐: {guide().response!.nextNodeId}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
