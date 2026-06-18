// packages/opencode/src/neural-map/types.ts
export interface GraphNode {
  id: string
  label: string
  path: string
  fileCount: number
  lineCount: number
  activity: number  // 0-100, based on git commit frequency
  understood: boolean
  hasChildren: boolean  // true if this directory contains sub-directories
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GuideResponse {
  intro: string
}

export interface ProgressEntry {
  nodeId: string
  understoodAt: number | null
  notes: string
}