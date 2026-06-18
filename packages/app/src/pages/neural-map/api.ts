import type { GraphData, GraphNode, GuideResponse, ProgressEntry } from "../../../../opencode/src/neural-map/types"

export type { GraphData, GraphNode, GuideResponse, ProgressEntry }

export interface GraphSnapshot extends GraphData {
  savedAt: number
}

async function apiFetch(serverUrl: string, path: string, init?: RequestInit) {
  const res = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json() as { error?: string; message?: string }
      detail = body.error ?? body.message ?? ""
    } catch {}
    throw new Error(detail || `API ${path} failed: ${res.status}`)
  }
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
  directory: string,
  node: GraphNode,
): Promise<GuideResponse> {
  const params = new URLSearchParams({ directory })
  return apiFetch(serverUrl, `/neural-map/guide?${params}`, {
    method: "POST",
    body: JSON.stringify({ node }),
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

export async function saveSnapshot(
  serverUrl: string,
  directory: string,
  src: string,
  graph: GraphData,
): Promise<void> {
  await apiFetch(serverUrl, "/neural-map/snapshot", {
    method: "POST",
    body: JSON.stringify({ directory, src, nodes: graph.nodes, edges: graph.edges }),
  })
}

export async function loadSnapshot(
  serverUrl: string,
  directory: string,
  src: string,
): Promise<GraphSnapshot | null> {
  const params = new URLSearchParams({ directory, src })
  return apiFetch(serverUrl, `/neural-map/snapshot?${params}`)
}
