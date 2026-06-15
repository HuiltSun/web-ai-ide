# Neural Map — 目录聚类与下钻导航设计规格

**日期**: 2026-06-15
**项目**: Web AI IDE (Neural Map 模式)
**作者**: 孙以恒
**状态**: 待实现
**基于**: `docs/superpowers/specs/2026-06-14-neural-map-mode-design.md`

---

## 概述

在现有 Neural Map 的扁平力导向图基础上，引入**目录层级下钻**能力：用户双击任意目录节点即可进入其子目录视图，画布完整切换，面包屑记录导航路径，返回时直接从缓存恢复（无重复请求）。同时修复节点重叠问题，统一全局主题常量。

---

## 核心决策

| 决策项 | 选择 | 理由 |
|---|---|---|
| 展开交互模型 | 下钻子视图（切换画布） | 视图干净，无节点拥挤问题 |
| 子视图节点粒度 | 子目录（非单文件） | 保持架构层级感，与根视图一致 |
| 下钻深度 | 任意深度（递归） | 面包屑导航可处理任意层级 |
| 布局引擎 | 现有力导向为主，ELK 可选 | 避免 1.5MB 包体积，先跑通核心 |
| 节点重叠 | 碰撞力硬性约束（间距 ≥ 12px） | 用户明确要求 |
| 主题 | 集中 `NM_THEME` 常量，全局复用 | 杜绝层级间颜色漂移 |

---

## 数据结构

### NavigationLevel

```typescript
interface NavigationLevel {
  path: string                       // 相对项目根的路径，如 "packages/opencode/src/agent"
  label: string                      // 显示名，如 "agent"
  graph: GraphData                   // 该层节点/边（fetch 后缓存）
  positions: Map<string, Position>   // 该层布局结果
}
```

Store 中维护 `navigationStack: NavigationLevel[]`，栈顶为当前视图。`understoodNodeIds`、`selectedNodeId`、`guide` 为全局状态，跨层共享。

### GraphNode 新增字段

```typescript
interface GraphNode {
  // ... 现有字段不变 ...
  hasChildren: boolean   // 该目录内部还有子目录，可继续下钻
}
```

---

## 架构与数据流

### 下钻

```
用户双击节点 N（hasChildren=true）
  → Canvas.onDrillDown(N)
  → index.tsx: setDrillLoading(true)
  → api.fetchGraph(serverUrl, projectRoot, N.path)
      ← GET /neural-map/graph?directory=<root>&src=<N.path>
  → store.pushLevel({
      path: N.path,
      label: N.label,
      graph: responseData,
      positions: computeLayout(nodes+radii, edges, W, H)
    })
  → setDrillLoading(false)
  → Canvas 重渲染新层，面包屑追加 N.label
```

### 返回

```
用户点击面包屑某段或「← 返回」按钮
  → store.popLevel() × N 次（跳回对应层）
  → 画布立即切换（数据在内存，零网络请求）
```

---

## 组件改动清单

### 后端

**`packages/opencode/src/neural-map/types.ts`**
- `GraphNode` 新增 `hasChildren: boolean`

**`packages/opencode/src/neural-map/graph.ts`**
- 为每个节点组计算 `hasChildren`：`groupFiles.some(f => f.split('/').length > 2)`
- 过滤掉顶层散文件节点：若该组 `groupFiles` 中所有文件均直接位于 `srcDir`（路径不含 `/`），则跳过该组，避免单文件混入目录级视图

**`packages/opencode/src/server/routes/instance/neural-map.ts`**
- 无需改动。现有 `src` query 参数已支持任意相对路径

### 前端

**`packages/app/src/pages/neural-map/theme.ts`**（新建）
```typescript
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
```
`Canvas.tsx`、`GuidePanel.tsx`、`index.tsx` 中所有硬编码颜色改为引用此常量。

**`packages/app/src/pages/neural-map/layout.ts`**
- 节点类型改为 `{ id: string; radius?: number }`（radius 默认 40）
- 新增碰撞力：每轮迭代在弹力/排斥力之后执行碰撞修正，两节点圆心距 < `r1 + r2 + 12` 时互推
- 导出辅助函数 `nodeRadius(activity: number, fileCount: number): number`（从 Canvas.tsx 移入，供双方共用）

**`packages/app/src/pages/neural-map/store.ts`**
- 将 `graph: GraphData | null` 和 `positions: Map` 替换为 `navigationStack: NavigationLevel[]`
- 新增：`currentLevel(): NavigationLevel | null`（返回栈顶）
- 新增：`pushLevel(level: NavigationLevel): void`
- 新增：`popLevel(): void`
- 新增：`drillLoading: boolean`（下钻加载状态，区别于初始 `loading`）

**`packages/app/src/pages/neural-map/api.ts`**
- `fetchGraph(serverUrl, projectRoot, src)` 新增 `src` 参数（不再使用后端默认值）

**`packages/app/src/pages/neural-map/Canvas.tsx`**
- 双击节点 → `props.onDrillDown(node)`（单击仍触发选中 + guide）
- `hasChildren=true` 的节点右上角渲染 `⊕` SVG 图标（半径 8，使用 `NM_THEME.accent`）
- `nodeRadius` 改为从 `layout.ts` 导入，不再本地定义
- 所有颜色改为引用 `NM_THEME`

**`packages/app/src/pages/neural-map/index.tsx`**
- 顶部栏增加**面包屑导航**：`packages/opencode/src › agent › runtime`，每段可点击（popLevel 到对应深度）
- `handleDrillDown(node)` → 调用 `api.fetchGraph` → `store.pushLevel`，期间显示遮罩 `drillLoading`
- `handleBack()` → `store.popLevel()`
- 画布数据来源改为 `store.currentLevel()`

---

## 错误处理

| 场景 | 处理方式 |
|---|---|
| 下钻 fetch 失败 | Toast"加载子目录失败"，不 push 层级，当前视图不变 |
| 子目录无子模块（nodes 为空） | Toast"此目录无可展示的子模块"，不 push |
| `hasChildren=false` 节点被双击 | 忽略，单击仍触发 guide |
| 布局节点数 > 150 | 跳过碰撞修正迭代，Toast"布局已简化" |
| 下钻期间用户误触 | 遮罩阻断交互（`drillLoading=true` 时画布覆盖半透明层） |

---

## 主题一致性约束

- 所有颜色字面量（`#0d1117` 等）**禁止**直接出现在组件文件中，必须引用 `NM_THEME`
- 根视图与所有子视图共用同一份 `NM_THEME` 导入，不得各自定义局部颜色
- 面包屑、遮罩、Toast 均使用 `NM_THEME` 颜色

---

## 测试验收标准

| 场景 | 标准 |
|---|---|
| 大目录下钻（> 30 子节点） | 节点无重叠，布局 < 500ms |
| 任意深度递归（≥ 3 层） | 面包屑正确追加，返回后父层数据完整恢复 |
| `hasChildren=false` 双击 | 无网络请求，无副作用 |
| 空子目录下钻 | Toast 提示，层级不变 |
| 跨层 `understoodNodeIds` | 根层标记的节点在子视图中同 `id` 节点显示 ✓ |
| 主题一致性 | 全部颜色引用 `NM_THEME`，无硬编码字面量 |
| 碰撞约束 | 任意两节点边缘间距 ≥ 12px |
| 返回导航 | 返回时无网络请求，画布立刻切换 |

---

## 不在范围内（本期不做）

- ELK Worker 集成（可选后续迭代）
- 同时展开多个目录（导航栈同一时间只有一条路径）
- 子视图内搜索/过滤节点
- 节点拖拽重排（只读探索模式）
