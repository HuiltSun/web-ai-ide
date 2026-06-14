import { createStore } from "solid-js/store"
import type { GraphData, GraphNode, GuideResponse } from "./api"
import { computeLayout } from "./layout"

export interface GuideState {
  loading: boolean
  response: GuideResponse | null
  answer: string
  showFeedback: boolean
}

export interface NeuralMapState {
  graph: GraphData | null
  positions: Map<string, { x: number; y: number }>
  selectedNodeId: string | null
  understoodNodeIds: Set<string>
  guide: GuideState
  loading: boolean
  error: string | null
}

const initialGuide: GuideState = {
  loading: false,
  response: null,
  answer: "",
  showFeedback: false,
}

export function createNeuralMapStore() {
  const [state, setState] = createStore<NeuralMapState>({
    graph: null,
    positions: new Map(),
    selectedNodeId: null,
    understoodNodeIds: new Set(),
    guide: { ...initialGuide },
    loading: false,
    error: null,
  })

  function loadGraph(graph: GraphData, width: number, height: number) {
    const positions = computeLayout(graph.nodes, graph.edges, width, height)
    setState({ graph, positions, loading: false, error: null })
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

  function setError(error: string | null) {
    setState({ error, loading: false })
  }

  function selectedNode(): GraphNode | null {
    if (!state.selectedNodeId || !state.graph) return null
    return state.graph.nodes.find((n) => n.id === state.selectedNodeId) ?? null
  }

  return {
    state,
    loadGraph,
    selectNode,
    setGuideLoading,
    setGuideResponse,
    setAnswer,
    showFeedback,
    markUnderstood,
    unmarkUnderstood,
    setLoading,
    setError,
    selectedNode,
  }
}

export type NeuralMapStore = ReturnType<typeof createNeuralMapStore>
