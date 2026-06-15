import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"
import type { NeuralMapStore } from "./store"
import { NM_THEME } from "./theme"

type ChatMsg = { role: "user" | "assistant"; text: string }

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

  const [sessionId, setSessionId] = createSignal<string | null>(null)
  const [chatMessages, setChatMessages] = createSignal<ChatMsg[]>([])
  const [inputText, setInputText] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [chatOpen, setChatOpen] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let knownMsgCount = 0
  let chatRef: HTMLDivElement | undefined

  function stopPolling() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }
  onCleanup(stopPolling)

  // Close chat when the selected node changes
  createEffect(() => {
    const _nodeId = state.selectedNodeId
    if (chatOpen()) {
      stopPolling()
      setSessionId(null)
      setChatMessages([])
      setChatOpen(false)
      setLoading(false)
      setError(null)
      knownMsgCount = 0
    }
  })

  function scrollToBottom() {
    if (chatRef) chatRef.scrollTop = chatRef.scrollHeight
  }

  async function pollMessages(sid: string) {
    try {
      const dirParam = encodeURIComponent(props.directory)
      const res = await fetch(`${props.serverUrl}/session/${sid}/message?directory=${dirParam}`)
      if (!res.ok) {
        if (loading()) pollTimer = setTimeout(() => void pollMessages(sid), 2000)
        return
      }
      const raw = (await res.json()) as Array<{
        info: { role: string }
        parts: Array<{ type: string; text?: string }>
      }>
      const msgs: ChatMsg[] = raw
        .map((m) => ({
          role: m.info.role as "user" | "assistant",
          text: m.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join(""),
        }))
        .filter((m) => m.text.trim())

      if (msgs.length > knownMsgCount) {
        knownMsgCount = msgs.length
        setChatMessages(msgs)
        setTimeout(scrollToBottom, 50)
        const last = msgs[msgs.length - 1]
        if (last?.role === "assistant") {
          setLoading(false)
          return
        }
      }

      if (loading()) pollTimer = setTimeout(() => void pollMessages(sid), 1500)
    } catch {
      if (loading()) pollTimer = setTimeout(() => void pollMessages(sid), 2000)
    }
  }

  async function startChat() {
    const n = node()
    if (!n) return
    stopPolling()
    knownMsgCount = 0
    setChatMessages([])
    setLoading(true)
    setChatOpen(true)
    setError(null)

    try {
      const dirParam = encodeURIComponent(props.directory)
      const createRes = await fetch(`${props.serverUrl}/session?directory=${dirParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `探索: ${n.id}` }),
      })
      if (!createRes.ok) throw new Error("创建会话失败")
      const session = (await createRes.json()) as { id: string }
      setSessionId(session.id)

      const prompt = `请帮我理解 \`${n.id}\` 这个代码模块的功能和职责。\n\n该模块包含 ${n.fileCount} 个文件，共 ${n.lineCount} 行代码，活跃度评分为 ${n.activity}。`
      await fetch(`${props.serverUrl}/session/${session.id}/prompt_async?directory=${dirParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts: [{ type: "text", text: prompt }] }),
      })

      pollTimer = setTimeout(() => void pollMessages(session.id), 1500)
    } catch (e) {
      setLoading(false)
      setChatOpen(false)
      setError(String(e))
    }
  }

  async function sendFollowUp() {
    const sid = sessionId()
    const text = inputText().trim()
    if (!sid || !text || loading()) return
    setInputText("")
    setLoading(true)
    const dirParam = encodeURIComponent(props.directory)
    await fetch(`${props.serverUrl}/session/${sid}/prompt_async?directory=${dirParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts: [{ type: "text", text }] }),
    })
    pollTimer = setTimeout(() => void pollMessages(sid), 1500)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendFollowUp()
    }
  }

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
          <div
            style={{
              "font-size": "9px",
              color: NM_THEME.textMuted,
              "line-height": "1.6",
              "margin-bottom": "8px",
            }}
          >
            {node()!.fileCount} 个文件 · {node()!.lineCount} 行
          </div>
          <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
            {node()!.activity > 60 && (
              <span
                style={{
                  background: "#2d1d04",
                  "border-radius": "3px",
                  padding: "2px 6px",
                  "font-size": "8px",
                  color: NM_THEME.active,
                }}
              >
                高活跃
              </span>
            )}
            <span
              style={{
                background: NM_THEME.border,
                "border-radius": "3px",
                padding: "2px 6px",
                "font-size": "8px",
                color: NM_THEME.textMuted,
              }}
            >
              活跃度 {node()!.activity}
            </span>
          </div>
        </div>

        {/* Chat area or start button */}
        <Show
          when={chatOpen()}
          fallback={
            <div
              style={{
                flex: 1,
                padding: "10px",
                display: "flex",
                "flex-direction": "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  "font-size": "9px",
                  color: NM_THEME.textMuted,
                  "text-transform": "uppercase",
                  "letter-spacing": "0.5px",
                }}
              >
                💬 AI 对话
              </div>
              <button
                style={{
                  background: "#0d419d",
                  "border-radius": "8px",
                  padding: "10px",
                  "font-size": "10px",
                  color: NM_THEME.accent,
                  border: "none",
                  cursor: "pointer",
                  "font-family": "monospace",
                  width: "100%",
                  "line-height": "1.5",
                }}
                onClick={() => void startChat()}
              >
                在此了解此模块
              </button>
              <Show when={error()}>
                <div style={{ "font-size": "9px", color: NM_THEME.danger }}>{error()}</div>
              </Show>
            </div>
          }
        >
          {/* Inline chat UI */}
          <div
            style={{
              flex: 1,
              display: "flex",
              "flex-direction": "column",
              overflow: "hidden",
              "min-height": "0",
            }}
          >
            {/* Message list */}
            <div
              ref={chatRef}
              style={{
                flex: 1,
                overflow: "auto",
                padding: "8px",
                display: "flex",
                "flex-direction": "column",
                gap: "8px",
                "min-height": "0",
              }}
            >
              <For each={chatMessages()}>
                {(msg) => (
                  <div
                    style={{
                      "font-size": "9px",
                      "line-height": "1.5",
                      ...(msg.role === "user"
                        ? {
                            background: "#0d419d33",
                            "border-radius": "6px",
                            padding: "6px 8px",
                            color: NM_THEME.accent,
                            "align-self": "flex-end",
                            "max-width": "90%",
                          }
                        : {
                            color: NM_THEME.textPrimary,
                            "align-self": "flex-start",
                            "max-width": "100%",
                          }),
                    }}
                  >
                    {msg.text}
                  </div>
                )}
              </For>
              <Show when={loading()}>
                <div
                  style={{
                    "font-size": "9px",
                    color: NM_THEME.textMuted,
                    "font-style": "italic",
                  }}
                >
                  AI 正在思考...
                </div>
              </Show>
            </div>

            {/* Input */}
            <div
              style={{
                padding: "8px",
                "border-top": `1px solid ${NM_THEME.border}`,
                display: "flex",
                gap: "4px",
                "flex-shrink": "0",
              }}
            >
              <textarea
                rows={2}
                placeholder="继续提问..."
                value={inputText()}
                onInput={(e) => setInputText(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                disabled={loading()}
                style={{
                  flex: 1,
                  background: NM_THEME.surface,
                  border: `1px solid ${NM_THEME.border}`,
                  "border-radius": "4px",
                  padding: "4px 6px",
                  "font-size": "9px",
                  color: NM_THEME.textPrimary,
                  "font-family": "monospace",
                  resize: "none",
                  outline: "none",
                }}
              />
              <button
                disabled={loading() || !inputText().trim()}
                onClick={() => void sendFollowUp()}
                style={{
                  background: loading() || !inputText().trim() ? NM_THEME.border : "#0d419d",
                  border: "none",
                  "border-radius": "4px",
                  color: NM_THEME.accent,
                  "font-size": "11px",
                  cursor: loading() || !inputText().trim() ? "default" : "pointer",
                  padding: "0 6px",
                  "align-self": "stretch",
                }}
              >
                ↑
              </button>
            </div>
          </div>
        </Show>

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
