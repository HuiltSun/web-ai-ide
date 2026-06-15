import { Show, createSignal } from "solid-js"
import type { NeuralMapStore } from "./store"
import { NM_THEME } from "./theme"

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
      "border-left": `1px solid ${NM_THEME.border}`,
      display: "flex",
      "flex-direction": "column",
      background: NM_THEME.bg,
      "font-family": "monospace",
    }}>
      <Show when={node()} fallback={
        <div style={{ padding: "20px", color: "#484f58", "font-size": "12px", "text-align": "center", "margin-top": "40px" }}>
          点击左侧节点<br />开始探索
        </div>
      }>
        {/* Node metadata */}
        <div style={{ padding: "12px", "border-bottom": `1px solid ${NM_THEME.border}` }}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-bottom": "8px" }}>
            <div style={{ width: "8px", height: "8px", "border-radius": "50%", background: NM_THEME.accent, "box-shadow": `0 0 6px ${NM_THEME.accent}` }} />
            <div style={{ "font-size": "11px", color: NM_THEME.textPrimary, "font-weight": "bold" }}>{node()!.id}</div>
          </div>
          <div style={{ "font-size": "9px", color: NM_THEME.textMuted, "line-height": "1.6", "margin-bottom": "8px" }}>
            {node()!.fileCount} 个文件 · {node()!.lineCount} 行
          </div>
          <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
            {node()!.activity > 60 && (
              <span style={{ background: "#2d1d04", "border-radius": "3px", padding: "2px 6px", "font-size": "8px", color: NM_THEME.active }}>高活跃</span>
            )}
            <span style={{ background: NM_THEME.border, "border-radius": "3px", padding: "2px 6px", "font-size": "8px", color: NM_THEME.textMuted }}>
              活跃度 {node()!.activity}
            </span>
          </div>
        </div>

        {/* AI conversation */}
        <div style={{ flex: 1, padding: "10px", display: "flex", "flex-direction": "column", gap: "8px", "overflow-y": "auto" }}>
          <div style={{ "font-size": "9px", color: NM_THEME.textMuted, "text-transform": "uppercase", "letter-spacing": "0.5px" }}>🤖 AI 向导</div>

          {/* Initial state: node selected, no guide yet */}
          <Show when={!guide().loading && !guide().response}>
            <button
              style={{ background: "#0d419d", "border-radius": "8px", padding: "10px", "font-size": "10px", color: NM_THEME.accent, border: "none", cursor: "pointer", "font-family": "monospace", width: "100%" }}
              onClick={() => void props.onAskGuide()}
            >
              🤖 开始解读这个模块
            </button>
          </Show>

          <Show when={guide().loading}>
            <div style={{ background: NM_THEME.surface, "border-radius": "8px", padding: "8px", "font-size": "10px", color: NM_THEME.textMuted, "border-left": "2px solid #30363d" }}>
              正在思考...
            </div>
          </Show>

          <Show when={guide().response && !guide().loading}>
            {/* Intro */}
            <div style={{ background: NM_THEME.surface, "border-radius": "8px", padding: "8px", "font-size": "10px", color: NM_THEME.textPrimary, "line-height": "1.5", "border-left": `2px solid ${NM_THEME.accent}` }}>
              {guide().response!.intro}
            </div>

            {/* Quiz */}
            <Show when={!guide().showFeedback}>
              <div style={{ background: NM_THEME.surface, "border-radius": "8px", padding: "8px", "font-size": "10px", color: NM_THEME.textPrimary, "line-height": "1.5", "border-left": `2px solid ${NM_THEME.active}` }}>
                🎯 <strong style={{ color: NM_THEME.active }}>猜一猜</strong><br />
                {guide().response!.quiz}
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <input
                  style={{
                    flex: 1,
                    background: NM_THEME.surface,
                    border: "1px solid #30363d",
                    "border-radius": "6px",
                    padding: "6px 8px",
                    "font-size": "9px",
                    color: NM_THEME.textPrimary,
                    outline: "none",
                    "font-family": "monospace",
                  }}
                  placeholder="输入你的答案..."
                  value={guide().answer}
                  onInput={(e) => setAnswer(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void submitAnswer() }}
                />
                <button
                  style={{ background: "#0d419d", "border-radius": "6px", padding: "6px 8px", "font-size": "9px", color: NM_THEME.accent, border: "none", cursor: "pointer" }}
                  onClick={() => void submitAnswer()}
                  disabled={submitting()}
                >
                  ↵
                </button>
              </div>
            </Show>

            {/* Feedback */}
            <Show when={guide().showFeedback && guide().response?.feedback}>
              <div style={{ background: "#0a2618", "border-radius": "8px", padding: "8px", "font-size": "10px", color: NM_THEME.understood, "line-height": "1.5" }}>
                ✓ {guide().response!.feedback}
              </div>
            </Show>
          </Show>
        </div>

        {/* Actions */}
        <div style={{ padding: "10px", "border-top": `1px solid ${NM_THEME.border}`, display: "flex", "flex-direction": "column", gap: "6px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
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
          <Show when={guide().response?.nextNodeId}>
            <div style={{ background: "#1c1f06", "border-radius": "6px", padding: "6px", "font-size": "9px", color: NM_THEME.active, "text-align": "center" }}>
              🎯 推荐: {guide().response!.nextNodeId}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
