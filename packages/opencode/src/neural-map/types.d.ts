export interface GraphNode {
    id: string;
    label: string;
    path: string;
    fileCount: number;
    lineCount: number;
    activity: number;
    understood: boolean;
    hasChildren: boolean;
}
export interface GraphEdge {
    source: string;
    target: string;
}
export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}
export interface GuideResponse {
    intro: string;
    quiz: string;
    feedback?: string;
    nextNodeId?: string;
}
export interface ProgressEntry {
    nodeId: string;
    understoodAt: number | null;
    notes: string;
}
