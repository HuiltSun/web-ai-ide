import type { GraphData, GraphNode, GuideResponse, ProgressEntry } from "../../../../opencode/src/neural-map/types"

export type { GraphData, GraphNode, GuideResponse, ProgressEntry }

export interface PositionedNode extends GraphNode {
  x: number
  y: number
}

async function apiFetch(serverUrl: string, path: string, init?: RequestInit) {
  const res = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

export async function fetchGraph(
  serverUrl: string,
  projectRoot: string,
  src?: string,
): Promise<GraphData> {
  const params = new URLSearchParams({ directory: projectRoot })
  if (src) params.set("src", src)
  return apiFetch(serverUrl, `/neural-map/graph?${params}`)
}

export async function fetchGuide(
  serverUrl: string,
  payload: {
    node: GraphNode
    allNodeIds: string[]
    understoodNodeIds: string[]
    userAnswer?: string
    sessionId: string
  },
): Promise<GuideResponse> {
  return apiFetch(serverUrl, "/neural-map/guide", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function fetchProgress(serverUrl: string, sessionId: string): Promise<ProgressEntry[]> {
  return apiFetch(serverUrl, `/neural-map/progress/${sessionId}`)
}

export async function markUnderstood(
  serverUrl: string,
  sessionId: string,
  nodeId: string,
  notes = "",
): Promise<void> {
  await apiFetch(serverUrl, `/neural-map/progress/${sessionId}/${nodeId}`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  })
}

export async function unmarkUnderstood(
  serverUrl: string,
  sessionId: string,
  nodeId: string,
): Promise<void> {
  await apiFetch(serverUrl, `/neural-map/progress/${sessionId}/${nodeId}`, {
    method: "DELETE",
  })
}
