// packages/app/src/pages/neural-map/theme.ts
export const NM_THEME = {
  bg:          "#0d1117",
  surface:     "#161b22",
  border:      "#21262d",
  textPrimary: "#cdd9e5",
  textMuted:   "#8b949e",
  accent:      "#58a6ff",
  understood:  "#3fb950",
  active:      "#d29922",
  danger:      "#f78166",
  purple:      "#bc8cff",
} as const

export interface NodeColor { fill: string; stroke: string }

export const NODE_COLORS: Record<string, NodeColor> = {
  agent:    { fill: "#0d2040", stroke: NM_THEME.accent },
  auth:     { fill: "#0a2618", stroke: NM_THEME.understood },
  provider: { fill: "#2d1d04", stroke: NM_THEME.active },
  storage:  { fill: "#1a0a2e", stroke: NM_THEME.purple },
  server:   { fill: "#2d0f0f", stroke: NM_THEME.danger },
  session:  { fill: "#0d1b2e", stroke: "#79c0ff" },
  neural:   { fill: "#1a0a2e", stroke: NM_THEME.purple },
  lsp:      { fill: "#0a1a2e", stroke: "#79c0ff" },
  format:   { fill: "#1a1a0a", stroke: NM_THEME.active },
}

export const NODE_DEFAULT_COLOR: NodeColor = {
  fill:   NM_THEME.surface,
  stroke: NM_THEME.textMuted,
}
