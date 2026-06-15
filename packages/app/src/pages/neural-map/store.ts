// packages/app/src/pages/neural-map/store.ts
import { createStore } from "solid-js/store"
import type { GraphData, GraphNode, GuideResponse } from "./api"
import { computeLayout, nodeRadius } from "./layout"

export interface NavigationLevel {
  path: string                              // src relative path used for API call
  label: string                             // display name (last segment)
  graph: GraphData
  positions: Map<string, { x: number; y: number }>
}

export interface GuideState {
  loading: boolean
  response: GuideResponse | null
  answer: string
  showFeedback: boolean
}

export interface NeuralMapState {
  navigationStack: NavigationLevel[]
  selectedNodeId: string | null
  understoodNodeIds: Set<string>
  guide: GuideState
  loading: boolean
  drillLoading: boolean
  error: string | null
}

const initialGuide: GuideState = {
  loading: false,
  response: null,
  answer: "",
  showFeedback: false,
}

function buildLevel(
  path: string,
  label: string,
  graph: GraphData,
  width: number,
  height: number,
): NavigationLevel {
  const nodesWithRadius = graph.nodes.map(n => ({
    id: n.id,
    radius: nodeRadius(n.activity, n.fileCount),
  }))
  const positions = computeLayout(nodesWithRadius, graph.edges, width, height)
  return { path, label, graph, positions }
}

export function createNeuralMapStore() {
  const [state, setState] = createStore<NeuralMapState>({
    navigationStack: [],
    selectedNodeId: null,
    understoodNodeIds: new Set(),
    guide: { ...initialGuide },
    loading: false,
    drillLoading: false,
    error: null,
  })

  function currentLevel(): NavigationLevel | null {
    return state.navigationStack[state.navigationStack.length - 1] ?? null
  }

  function loadGraph(path: string, label: string, graph: GraphData, width: number, height: number) {
    const level = buildLevel(path, label, graph, width, height)
    setState({ navigationStack: [level], loading: false, error: null })
  }

  function pushLevel(path: string, label: string, graph: GraphData, width: number, height: number) {
    const level = buildLevel(path, label, graph, width, height)
    setState("navigationStack", (prev) => [...prev, level])
    setState({ drillLoading: false, selectedNodeId: null, guide: { ...initialGuide } })
  }

  // targetIndex: keep stack[0..targetIndex] inclusive; defaults to going back one level
  function popLevel(targetIndex?: number) {
    const target = targetIndex ?? state.navigationStack.length - 2
    if (target < 0) return
    setState("navigationStack", (prev) => prev.slice(0, target + 1))
    setState({ selectedNodeId: null, guide: { ...initialGuide } })
  }

  function selectNode(nodeId: string | null) {
    setState({ selectedNodeId: nodeId, guide: { ...initialGuide } })
  }

  function setGuideLoading(loading: boolean) {
    setState("guide", "loading", loading)
  }

  function setGuideResponse(response: GuideResponse) {
    setState("guide", { response, loading: false, showFeedback: false })
  }

  function setAnswer(answer: string) {
    setState("guide", "answer", answer)
  }

  function showFeedback() {
    setState("guide", "showFeedback", true)
  }

  function markUnderstood(nodeId: string) {
    setState("understoodNodeIds", (prev) => new Set([...prev, nodeId]))
  }

  function unmarkUnderstood(nodeId: string) {
    setState("understoodNodeIds", (prev) => {
      const next = new Set(prev)
      next.delete(nodeId)
      return next
    })
  }

  function setLoading(loading: boolean) {
    setState({ loading })
  }

  function setDrillLoading(loading: boolean) {
    setState("drillLoading", loading)
  }

  function setError(error: string | null) {
    setState({ error, loading: false })
  }

  function selectedNode(): GraphNode | null {
    const level = currentLevel()
    if (!state.selectedNodeId || !level) return null
    return level.graph.nodes.find((n) => n.id === state.selectedNodeId) ?? null
  }

  return {
    state,
    currentLevel,
    loadGraph,
    pushLevel,
    popLevel,
    selectNode,
    setGuideLoading,
    setGuideResponse,
    setAnswer,
    showFeedback,
    markUnderstood,
    unmarkUnderstood,
    setLoading,
    setDrillLoading,
    setError,
    selectedNode,
  }
}

export type NeuralMapStore = ReturnType<typeof createNeuralMapStore>
