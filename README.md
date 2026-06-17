<p align="center">
  <picture>
    <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
    <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Web AI IDE logo" width="200">
  </picture>
</p>

<p align="center">
  <strong>WEB 课程大作业 —— Web AI IDE</strong><br>
  基于 <a href="https://github.com/anomalyco/opencode">anomalyco/opencode</a> 的 Fork，新增功能与性能优化
</p>

<p align="center">
  <a href="https://github.com/HuiltSun/web-ai-ide"><img alt="GitHub" src="https://img.shields.io/badge/github-HuiltSun%2Fweb--ai--ide-6B8E7D?style=flat-square&logo=github" /></a>
  <a href="https://github.com/HuiltSun/web-ai-ide/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-6B8E7D?style=flat-square" /></a>
</p>

---

## 项目简介

本项目 **Web AI IDE** 基于 [opencode](https://github.com/anomalyco/opencode) 开发，作为 WEB 课程期末大作业提交。Web AI IDE 是一个终端优先的多客户端 AI Coding Agent，支持 TUI、Web、Desktop（Electron / Tauri）多种客户端，后端基于 Hono HTTP Server + SQLite + OAuth。

> **小组成员：** 孙以恒、魏征征

---

## 我们的贡献

### 01 全局搜索面板 `[新增功能]`

VS Code 风格的 `Ctrl+Shift+F` 全局搜索，直接集成于 Electron 客户端。

- 跨文件内容实时检索
- 支持正则表达式与文件名双模式搜索
- 结果高亮 + 快速跳转

### 02 Electron 性能优化 `[工程优化]`

针对 Electron 客户端的 7 项专项性能改进：

- 约 100 行代码改动
- 32 个回归验证测试全覆盖
- 启动速度、渲染响应、内存占用全面提升

### 03 Bun Shell 原生迁移 `[底层重构]`

将 143 处 `child_process` 调用全部迁移至 Bun Shell API：

- 消除 Node.js child_process 依赖
- 性能与跨平台兼容性双提升
- 为后续 Bun 原生部署打下基础

### 04 Neural Map 代码神经图 `[新增功能]`

将代码仓库可视化为力导向神经图，并内置 AI 对话引导用户逐模块学习：

- 自动分析目录结构、依赖关系与 Git 活跃度，生成带权有向图
- 自研力导向布局算法，无第三方依赖，支持平移/缩放交互
- 内联 AI 对话面板（不跳转页面），多轮问答均在图旁完成
- SQLite 持久化学习进度，支持钻取子目录、"已理解"标记与进度条

---

## 仓库地址

```
https://github.com/HuiltSun/web-ai-ide
```

---

## 项目架构

分布式 C/S 架构，AI 代理运行环境与用户交互界面物理隔离，通过 RPC/WebSocket 实现跨地域指令分发。

| 层级 | 组件 |
| --- | --- |
| **客户端层** | TUI 终端、Web 浏览器、Desktop (Electron)、Desktop (Tauri) |
| **SDK 层** | `@opencode-ai/sdk` · TypeScript SDK · v1/v2 API |
| **服务端层** | Hono HTTP Server · Agent Runtime · SQLite · OAuth |

---

## 主要包结构

| 包 | 路径 | 说明 |
| --- | --- | --- |
| `opencode` | `packages/opencode` | 核心 CLI：agent 运行时、TUI、存储、认证、HTTP 服务、AI 提供商 |
| `@opencode-ai/app` | `packages/app` | Web GUI（SolidJS + Vite） |
| `@opencode-ai/desktop` | `packages/desktop` | 桌面应用（Tauri） |
| `@opencode-ai/desktop-electron` | `packages/desktop-electron` | 桌面应用（Electron）|
| `@opencode-ai/ui` | `packages/ui` | 共享 UI 组件（SolidJS） |
| `@opencode-ai/sdk` | `packages/sdk/js` | TypeScript SDK |

---

## 本地开发

```bash
# 依赖安装（需要 Bun）
bun install

# 启动 TUI
bun run --cwd packages/opencode dev

# 启动 Web GUI
bun run --cwd packages/app dev

# 启动 Electron
bun run --cwd packages/desktop-electron dev
```

---

## Neural Map 核心技术详解

本节深入讲解 Neural Map 模式的六个核心技术模块，对应源码路径一一标注。

---

### 1. 图谱构建引擎

**源码：** `packages/opencode/src/neural-map/graph.ts`

图谱构建在服务端运行，入口是 `buildGraph(srcDir, cwd)`，分三个阶段：

**① 文件扫描与模块分组**

使用 `Bun.Glob("**/*.{ts,tsx,js,jsx}")` 扫描源目录，过滤掉 `.d.ts` 声明文件后，以文件路径第一级目录名作为"模块节点"键，将所有文件归组：

```
packages/opencode/src/
├── session/   → 节点 "session"（含 message-v2.ts 等）
├── provider/  → 节点 "provider"
└── server/    → 节点 "server"
```

`IGNORED_DIRS`（`node_modules`、`.git`、`dist`、`build`、`.turbo`、`coverage`、`.next`、`out`）在此阶段被排除。只有"目录组"（至少包含一个含 `/` 的文件路径）才会成为节点，根目录散落文件被过滤。

**② 依赖关系提取（边的构建）**

逐文件读取内容，通过两条正则匹配 ES Module 导入和 CommonJS require：

```
/(?:import|export)[^;'"]*from\s+['"]([^'"]+)['"]/gm
/require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm
```

仅保留相对路径导入（以 `.` 开头），将其解析为绝对路径后再转回相对路径，取第一级目录得到目标模块名。若源模块和目标模块均存在于节点集合中，则记录一条有向边 `source→target`（用 Set 去重）。

**③ Git 活跃度评分**

对每个模块目录并发执行：

```bash
git log --oneline -- <dirPath>
```

统计提交行数，取值上限 100，作为该节点的 `activity` 分值。activity 同时影响节点半径和颜色深度。

**Windows 路径修复：** URL 参数解码后 `E:web-ai-ide`（缺少反斜杠）会导致路径错误，服务端入口处通过正则 `/^[A-Za-z]:[^/\\]/` 检测并自动补全为 `E:\web-ai-ide`。

---

### 2. 自研力导向布局算法

**源码：** `packages/app/src/pages/neural-map/layout.ts`

不依赖 D3.js，完全自实现 Fruchterman-Reingold 风格的力导向布局，分两个阶段：

**① 力模拟（600 次迭代）**

初始化：节点均匀分布在以画布中心为圆心、半径 35% 的圆上。

每次迭代同时施加两种力：

| 力 | 公式 | 作用 |
|---|---|---|
| **斥力**（所有节点对） | `F = KR / dist²`，`KR = 80000` | 节点互相排开，防止重叠 |
| **弹簧引力**（相连节点） | `F = (dist - REST) × KS`，`REST = 240`，`KS = 0.015` | 有依赖关系的模块靠近 |

温度退火控制步长：`maxStep = 4 + 56 × (1 - iter/600)`，早期步长大（快速收敛），后期步长小（精细调整）。位置始终夹在 `[PAD, width-PAD]` 范围内。

**② 碰撞消解（Gauss-Seidel，最多 80 次）**

力模拟结束后进行后处理，遍历所有节点对，若两节点圆心距小于 `r_i + r_j + 12px`，则沿连线方向各自推开至恰好不重叠。早退出优化：一轮无碰撞则提前结束。节点超过 150 个时碰撞轮数降至 10（`layoutSimplified: true`），同时弹出 Toast 提示。

**节点半径公式：**

```
radius = 28 + sqrt(activity) × 1.5 + min(fileCount, 20) × 0.8
```

活跃度高、文件多的模块在图中显得更大。

---

### 3. 交互式 SVG 画布

**源码：** `packages/app/src/pages/neural-map/Canvas.tsx`

画布用纯 SVG 实现，无 Canvas 2D API，所有变换通过操作根 `<g>` 元素的 `transform` 属性完成：

```
transform="translate(panX, panY) scale(s)"
```

**平移：** 鼠标按下非节点区域开始拖拽，`onMouseMove` 实时更新 `panX/panY`，换算时乘以 `width/rect.width` 适配 SVG 与 DOM 尺寸差。

**缩放（以鼠标为中心）：** `onWheel` 处理滚轮事件，缩放比 `[0.15, 5]`，以鼠标当前位置为不动点推导新 pan 值：

```
panX = mx - (mx - panX) × (newScale / scale)
panY = my - (my - panY) × (newScale / scale)
```

**节点渲染：** 每个节点渲染为 SVG `<circle>` + `<text>`，按模块名关键字染色（`session` → 蓝，`provider` → 紫，等），活跃度 > 60 的节点加辉光效果（`filter: drop-shadow`）。双击节点触发"钻取"（drill-down），加载子目录图谱并压入导航栈。

---

### 4. SolidJS 响应式状态管理

**源码：** `packages/app/src/pages/neural-map/store.ts`

使用 SolidJS 的 `createStore` 管理全局状态，核心数据结构：

```typescript
interface NeuralMapState {
  navigationStack: NavigationLevel[]   // 钻取路径栈
  selectedNodeId: string | null        // 当前选中节点
  understoodNodeIds: Set<string>       // 已理解节点集合
  loading: boolean                     // 图谱加载中
  drillLoading: boolean                // 子目录加载中
  error: string | null
}
```

**导航栈（drill-down）：** 每次钻取子目录时，调用 `pushLevel()` 将新的 `NavigationLevel`（含子图谱和已计算好的布局坐标）压入栈顶；顶部面包屑点击时调用 `popLevel(targetIndex)` 回到指定层级。布局坐标（`positions: Map<string, {x,y}>`）在 `pushLevel` 时一次性计算并缓存，切换层级无需重算。

**`understoodNodeIds`** 使用 `Set<string>` 存储，`markUnderstood`/`unmarkUnderstood` 通过函数式更新 (`prev => new Set(...)`) 触发 SolidJS 的细粒度响应。

---

### 5. SQLite 进度持久化

**源码：** `packages/opencode/src/neural-map/neural-map.sql.ts` + `packages/opencode/src/server/routes/instance/neural-map.ts`

学习进度通过 Drizzle ORM 存入 SQLite：

```typescript
// 表结构
neural_map_progress(
  session_id TEXT NOT NULL,
  node_id    TEXT NOT NULL,
  understood_at INTEGER,        // Unix 时间戳
  notes      TEXT DEFAULT '',
  PRIMARY KEY (session_id, node_id)
)
```

**写入（upsert）：** 标记已理解时调用 `INSERT ... ON CONFLICT DO UPDATE`，确保重复操作幂等。

**REST API：**

| 方法 | 路由 | 说明 |
|---|---|---|
| `GET` | `/neural-map/progress/:sessionId` | 读取该 session 所有进度 |
| `POST` | `/neural-map/progress/:sessionId/:nodeId` | 标记节点已理解 |
| `DELETE` | `/neural-map/progress/:sessionId/:nodeId` | 取消标记 |
| `GET` | `/neural-map/graph` | 构建并返回图谱 |

---

### 6. 内联 AI 对话（不跳转页面）

**源码：** `packages/app/src/pages/neural-map/GuidePanel.tsx`

GuidePanel 自管理对话生命周期，与父组件完全解耦，只需传入 `serverUrl` 和 `directory`。

**对话流程：**

```
用户点击"在此了解此模块"
    ↓
POST /session?directory=...          → 创建会话，得到 sessionId
    ↓
POST /session/{id}/prompt_async      → 发送初始 prompt（含模块文件数/行数/活跃度），立即返回 204
    ↓
每 1.5s 轮询 GET /session/{id}/message
    ↓
发现新 assistant 消息 → 更新 chatMessages，停止轮询
    ↓
用户输入追问 → 再次 prompt_async + 轮询
```

**初始 Prompt 模板：**

```
请帮我理解 `{moduleId}` 这个代码模块的功能和职责。

该模块包含 {fileCount} 个文件，共 {lineCount} 行代码，活跃度评分为 {activity}。
```

**节点切换自动重置：** `createEffect(() => { const _nodeId = state.selectedNodeId; ... })` 监听 `selectedNodeId` 变化，切换节点时立即停止轮询、清空对话历史，下次点击按钮为新节点开启全新会话。

**消息解析：** `GET /session/{id}/message` 返回 `MessageV2.WithParts[]`，取其中 `parts` 数组中 `type === "text"` 的部分拼接为展示文本，`info.role` 区分用户气泡与 AI 回复样式。

---

### 7. 图谱快照与 Agent 上下文

**源码：** `packages/opencode/src/neural-map/neural-map.sql.ts` · `packages/opencode/src/server/routes/instance/neural-map.ts` · `packages/app/src/pages/neural-map/api.ts`

**解决的核心痛点**

AI Agent 在回答代码相关问题前，必须先理解代码库的整体结构。现有路径各有缺陷：

| 路径 | 问题 |
|---|---|
| 把整个代码库塞进 context | token 爆炸，大型项目根本放不下 |
| 让 Agent 自己 `ls` + 读文件探索 | 需要十几次 tool call，慢且容易遗漏 |

本模块提供**预计算好的拓扑摘要**：模块划分、依赖关系、文件规模、Git 活跃度，通过单次 API 调用即可让 Agent 获得代码库全貌，无需自行扫描文件系统。

同时解决了另一个工程问题：图谱构建本身需要扫描全部源文件并对每个模块并发执行 `git log`，中等规模仓库耗时 800ms–3s。快照缓存使后续加载降至 10ms 以内（约快 100–300 倍），24 小时 TTL 保证数据不过期失效。

**① 数据库表**

```sql
-- 迁移：20260617000000_neural_map_snapshot
neural_map_snapshot (
  directory     TEXT NOT NULL,   -- 项目根目录（绝对路径）
  src           TEXT NOT NULL,   -- 相对源码路径，如 "packages/opencode/src"
  snapshot_json TEXT NOT NULL,   -- JSON：{ nodes: GraphNode[], edges: GraphEdge[] }
  saved_at      INTEGER NOT NULL, -- 保存时间（Unix ms），用于 TTL 判断
  PRIMARY KEY (directory, src)
)
```

快照只存节点与边的语义数据，**不存布局坐标**——坐标由布局算法从节点集合确定性地重新计算，对 Agent 无语义价值。

**② REST API**

| 方法 | 路由 | 说明 |
|---|---|---|
| `POST` | `/neural-map/snapshot` | 保存或更新指定路径的图谱快照 |
| `GET` | `/neural-map/snapshot?directory=&src=` | 读取快照，不存在时返回 `null` |
| `GET` | `/neural-map/context?directory=&src=` | 以 Markdown 格式返回图谱摘要，用于 Agent 上下文 |

**POST /neural-map/snapshot 请求体：**

```typescript
{
  directory: string       // 项目根目录
  src: string             // 相对源码路径
  nodes: GraphNode[]      // 节点数组（含 id、path、fileCount、lineCount、activity、hasChildren）
  edges: GraphEdge[]      // 有向边数组（source → target）
}
```

**③ 前端集成与 TTL 缓存策略**

`index.tsx` 的 `onMount` 阶段并发请求快照与进度。快照存在且在 24 小时内则直接使用；过期或不存在则重新构建，完成后后台异步保存（不阻塞 UI）：

```
打开 Neural Map
    ↓
Promise.all([loadSnapshot(), fetchProgress()])
    ↓ 快照存在且未过期（< 24h）      ↓ 不存在或已过期
直接渲染（< 10ms）            fetchGraph() → 渲染 → saveSnapshot()（后台）
```

钻取子目录（drill-down）遵循相同策略。TTL 常量定义于 `index.tsx`：

```typescript
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000 // 24 小时
```

**④ Agent 上下文格式（/neural-map/context）**

`GET /neural-map/context` 返回纯文本 Markdown，可直接注入 Agent 的 system prompt 或 tool result：

```markdown
# Codebase Neural Map — packages/opencode/src
> Generated: 2026-06-17T10:00:00.000Z

## Modules

### `neural-map`
- **Path**: /project/packages/opencode/src/neural-map
- **Files**: 6  **Lines**: 800  **Activity**: 42/100
- Has sub-modules (drillable)
- **Imports**: server, storage

### `server`
- **Path**: /project/packages/opencode/src/server
- **Files**: 23  **Lines**: 3100  **Activity**: 88/100
- Has sub-modules (drillable)
- **Imports**: session, provider, storage
...
```

每个模块包含：路径、文件数、行数、Git 活跃度、是否可钻取、直接依赖列表。若快照尚未生成或已过期，接口返回 404 并提示先打开 Neural Map 视图触发重建。

---

## 致谢

本项目基于 [anomalyco/opencode](https://github.com/anomalyco/opencode) 开发，遵循原项目 MIT 许可证。感谢原作者的开源贡献。
