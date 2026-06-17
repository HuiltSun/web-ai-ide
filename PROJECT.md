# Web AI IDE — 项目说明

## 项目概述

Web AI IDE 是一个开源的 AI 编程代理（AI Coding Agent），采用终端优先（TUI-first）的设计理念，同时提供 Web 界面和桌面应用。它支持多种 AI 模型提供商（Claude、OpenAI、Google 及本地模型），内置 LSP（语言服务器协议）支持，采用客户端/服务器架构。

- **官网**: https://opencode.ai
- **仓库**: https://github.com/anomalyco/opencode
- **许可证**: MIT
- **版本**: 1.14.28
- **包管理器**: Bun 1.3+

---

## 技术架构

### 整体架构

Web AI IDE 采用 **客户端/服务器** 架构：

```
┌─────────────────────────────────────────────────────┐
│                    客户端层                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ TUI 界面 │  │ Web 界面 │  │ Desktop (Electron │  │
│  │ (终端)   │  │ (浏览器) │  │   / Tauri)        │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │             │                 │             │
│       └─────────────┼─────────────────┘             │
│                     │                               │
│              ┌──────┴──────┐                        │
│              │   SDK 层    │  (@opencode-ai/sdk)    │
│              └──────┬──────┘                        │
├─────────────────────┼───────────────────────────────┤
│                     │                   服务端层    │
│  ┌──────────────────┴───────────────────────────┐   │
│  │              Hono HTTP Server                │   │
│  ├──────────┬──────────┬──────────┬─────────────┤   │
│  │ Agent    │ Config   │ Storage  │ Auth        │   │
│  │ Runtime  │ Manager  │ (SQLite) │ (OAuth)     │   │
│  └──────────┴──────────┴──────────┴─────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 核心设计理念

- **模型无关**: 不绑定特定 AI 提供商，支持 Anthropic、OpenAI、Google 及本地模型
- **终端优先**: 由 Neovim 用户打造，追求终端体验的极致
- **客户端/服务器分离**: 服务端在本地运行，客户端可以是 TUI、Web 或移动端
- **LSP 原生支持**: 开箱即用的语言服务器协议集成
- **插件系统**: 可通过插件扩展工具、钩子、认证等功能

---

## Monorepo 包结构

项目使用 Bun workspaces 管理，包含以下核心包：

### 核心应用

| 包名 | 目录 | 说明 |
|------|------|------|
| `opencode` | `packages/opencode` | **主 CLI 应用**，包含 CLI 命令、Agent 运行时、TUI、配置管理、数据库存储、认证、HTTP 服务端、AI 提供商集成 |
| `@opencode-ai/app` | `packages/app` | **Web GUI 应用**，基于 SolidJS + Vite 的 SPA，提供浏览器端会话界面 |
| `@opencode-ai/desktop-electron` | `packages/desktop-electron` | **Electron 桌面壳**，将 Web 界面封装为原生桌面应用 |
| `@opencode-ai/desktop` | `packages/desktop` | **Tauri 桌面壳**，基于 Rust 的轻量级原生桌面应用封装 |

### 共享库

| 包名 | 目录 | 说明 |
|------|------|------|
| `@opencode-ai/core` | `packages/core` | **共享核心工具库**，提供文件系统、npm 工具、Effect 运行时、日志、通用工具函数 |
| `@opencode-ai/ui` | `packages/ui` | **共享 UI 组件库**，SolidJS 组件，包含 Markdown 渲染、Diff 查看器、CodeMirror 编辑器、主题系统、国际化等 |
| `@opencode-ai/sdk` | `packages/sdk/js` | **TypeScript SDK**，提供客户端/服务端编程接口，支持 v1 和 v2 API |
| `@opencode-ai/plugin` | `packages/plugin` | **插件类型定义**，提供构建 Web AI IDE 插件的类型接口 |
| `@opencode-ai/script` | `packages/script` | **构建/CI 脚本工具库** |

### 平台与集成

| 包名 | 目录 | 说明 |
|------|------|------|
| `@opencode-ai/web` | `packages/web` | **营销/文档网站**，基于 Astro + Starlight，多语言文档支持（17+ 语言），部署到 Cloudflare |
| `@opencode-ai/slack` | `packages/slack` | **Slack 机器人集成**，将 Slack 消息桥接到 Web AI IDE 会话 |
| `@opencode-ai/enterprise` | `packages/enterprise` | **企业/团队服务端**，基于 SolidStart/Nitro 的多用户部署方案 |
| `@opencode-ai/storybook` | `packages/storybook` | **Storybook 组件预览**，开发环境下浏览 UI 组件 |

### 云控制台 (Console)

| 包名 | 目录 | 说明 |
|------|------|------|
| `@opencode-ai/console-app` | `packages/console/app` | 云控制台前端（账单、账户管理、模型目录） |
| `@opencode-ai/console-core` | `packages/console/core` | 云控制台后端（数据库模式、Stripe 集成、认证） |
| `@opencode-ai/console-function` | `packages/console/function` | 云控制台无服务器函数（AI 提供商代理） |
| `@opencode-ai/console-mail` | `packages/console/mail` | 事务邮件模板 |
| `@opencode-ai/console-resource` | `packages/console/resource` | 云基础设施资源定义（SST/Cloudflare） |

### 开发工具与资产

| 包名 | 目录 | 说明 |
|------|------|------|
| `@opencode-ai/containers` | `packages/containers` | **CI 容器镜像**，预构建 Docker 镜像（base, bun-node, rust, tauri-linux, publish），用于加速 GitHub Actions |
| `@opencode-ai/function` | `packages/function` | **无服务器函数**，Cloudflare Workers，运行 GitHub OAuth 代理等边缘函数 |
| `@opencode-ai/identity` | `packages/identity` | **品牌标识资源**，包含 Logo 的多种格式变体（SVG, PNG） |
| `@opencode-ai/docs` | `packages/docs` | **文档内容源**，Mintlify 格式的文档源文件，部署到 docs.opencode.ai |
| `@opencode-ai/extensions` | `packages/extensions` | **编辑器扩展**（当前包含 Zed 编辑器扩展） |

### 包依赖关系图

```
opencode (CLI)
├── @opencode-ai/core
├── @opencode-ai/sdk
├── @opencode-ai/plugin
└── @opencode-ai/script

@opencode-ai/app (Web GUI)
├── @opencode-ai/core
├── @opencode-ai/ui
└── @opencode-ai/sdk

@opencode-ai/desktop / @opencode-ai/desktop-electron
└── @opencode-ai/app

@opencode-ai/ui
├── @opencode-ai/core
└── @opencode-ai/sdk

@opencode-ai/enterprise
├── @opencode-ai/core
└── @opencode-ai/ui
```

---

## 核心技术栈

### 运行时与语言

| 技术 | 用途 |
|------|------|
| **Bun** | JavaScript/TypeScript 运行时，包管理器，构建工具 |
| **TypeScript 5.8** | 主要开发语言 |
| **Rust** | Tauri 桌面应用后端 |

### 前端技术

| 技术 | 用途 |
|------|------|
| **SolidJS 1.9** | Web UI 框架（TUI 和 Web 界面） |
| **Vite 7** | 前端构建工具 |
| **TailwindCSS 4** | 样式方案 |
| **@kobalte/core** | SolidJS 无样式 UI 原语 |
| **CodeMirror** | 代码编辑器组件 |
| **Shiki** | 语法高亮 |

### 后端技术

| 技术 | 用途 |
|------|------|
| **Hono 4** | HTTP 服务端框架 |
| **Effect 4.0-beta** | 函数式编程运行时（错误处理、依赖注入、可观测性） |
| **Drizzle ORM** | 数据库 ORM（SQLite） |
| **Zod 4** | 数据验证 |

### 桌面应用

| 技术 | 用途 |
|------|------|
| **Electron** | 桌面应用方案 A |
| **Tauri v2** | 桌面应用方案 B（更轻量） |

### AI/LLM

| 技术 | 用途 |
|------|------|
| **Vercel AI SDK** (`ai` 6.0) | AI 模型统一接口 |
| **OpenTelemetry** | 可观测性（追踪、指标、日志） |

### 基础设施

| 技术 | 用途 |
|------|------|
| **Cloudflare Workers** | 文档站和企业版部署 |
| **SST 3** | 基础设施即代码 |
| **AWS S3** | 对象存储 |
| **PlanetScale / PostgreSQL** | 云数据库 |

---

## 开发环境搭建

### 前置要求

- **Bun** >= 1.3
- (可选) **Rust 工具链** — 仅桌面应用开发需要

### 快速开始

```bash
# 安装依赖
bun install

# 启动开发模式（TUI 界面）
bun dev

# 在指定目录启动
bun dev <directory>
```

### 核心开发命令

```bash
# 类型检查
bun typecheck

# 运行测试（需在具体包目录下）
cd packages/opencode && bun test

# 代码检查
bun lint

# 启动 API 服务端（无头模式）
bun dev serve --port 4096

# 启动 Web 界面
bun dev web

# 启动 Web 开发服务器（需先启动 serve）
bun run --cwd packages/app dev

# 启动桌面应用
bun run --cwd packages/desktop tauri dev

# 构建独立可执行文件
./packages/opencode/script/build.ts --single

# 重新生成 SDK
./packages/sdk/js/script/build.ts
```

### 调试

```bash
# 调试服务端
bun run --inspect=ws://localhost:6499/ --cwd packages/opencode ./src/index.ts serve --port 4096

# 调试 TUI
bun run --inspect=ws://localhost:6499/ --cwd packages/opencode --conditions=browser ./src/index.ts
```

---

## 关键概念

### Agent 系统

Web AI IDE 内置两种 Agent，可通过 `Tab` 键切换：

- **build** — 默认 Agent，拥有完整文件系统访问权限，用于开发工作
- **plan** — 只读 Agent，用于分析和代码探索，默认禁止文件编辑，执行命令前需确认
- **general** — 内部子 Agent，用于复杂搜索和多步骤任务，通过 `@general` 调用

### 配置系统

配置管理位于 `packages/opencode/src/config/`，采用自导出模式：

```
src/config/
├── agent.ts      # Agent 配置
├── command.ts    # 自定义命令
├── mcp.ts        # MCP 协议配置
├── models.ts     # 模型配置
├── providers.ts  # AI 提供商配置
├── themes.ts     # 主题配置
└── ...
```

### 存储层

使用 SQLite（通过 Drizzle ORM），位于 `packages/opencode/src/storage/`。`packages/opencode` 的 `package.json` 中定义了条件导出：

```json
"imports": {
  "#db": {
    "bun": "./src/storage/db.bun.ts",
    "node": "./src/storage/db.node.ts"
  }
}
```

### 插件系统

插件类型定义在 `@opencode-ai/plugin` 中，支持：

- 自定义工具（Tool）
- 生命周期钩子（Hooks）
- 认证流程扩展
- 提供商自定义
- TUI 组件扩展

---

## 代码风格指南

项目有明确的代码风格约定（详见 `AGENTS.md`）：

- 尽量保持逻辑在单一函数内，除非提取后带来明确的复用价值
- 避免不必要的解构，使用点号访问保留上下文
- 避免 `else` 语句，优先使用提前返回
- 避免 `try/catch`，优先使用 `.catch()`
- 优先使用 `const`，避免 `let`
- 优先使用 `flatMap`/`filter`/`map` 等函数式数组方法
- 使用精确类型，避免 `any`
- 尽量使用 Bun 原生 API（如 `Bun.file()`）
- Drizzle schema 字段名使用 snake_case
- 测试避免 mock，测试实际实现

---

## 分支与发布

- **默认分支**: `dev`
- PR 标题遵循 Conventional Commits 规范：`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- PR 必须关联已有 Issue
- PR 需要通过 vouch 系统的信任验证

---

## 社区

- [Discord](https://discord.gg/opencode)
- [X.com](https://x.com/opencode)
- [文档](./docs/DOCS.md)

---

## Neural Map 技术实现

本节深入讲解 Neural Map 模式的七个核心技术模块，对应源码路径一一标注。

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

**节点渲染：** 每个节点渲染为 SVG `<circle>` + `<text>`，按模块名关键字染色（`session` → 蓝，`provider` → 紫，等），双击节点触发"钻取"（drill-down），加载子目录图谱并压入导航栈。

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

`understoodNodeIds` 使用 `Set<string>` 存储，`markUnderstood`/`unmarkUnderstood` 通过函数式更新 (`prev => new Set(...)`) 触发 SolidJS 的细粒度响应。

---

### 5. SQLite 进度持久化

**源码：** `packages/opencode/src/neural-map/neural-map.sql.ts` · `packages/opencode/src/server/routes/instance/neural-map.ts`

学习进度通过 Drizzle ORM 存入 SQLite：

```sql
neural_map_progress (
  session_id    TEXT NOT NULL,
  node_id       TEXT NOT NULL,
  understood_at INTEGER,          -- Unix 时间戳
  notes         TEXT DEFAULT '',
  PRIMARY KEY (session_id, node_id)
)
```

写入使用 `INSERT ... ON CONFLICT DO UPDATE`，确保幂等。

| 方法 | 路由 | 说明 |
|---|---|---|
| `GET` | `/neural-map/graph` | 构建并返回图谱 |
| `GET` | `/neural-map/progress/:sessionId` | 读取该 session 所有进度 |
| `POST` | `/neural-map/progress/:sessionId/:nodeId` | 标记节点已理解 |
| `DELETE` | `/neural-map/progress/:sessionId/:nodeId` | 取消标记 |

---

### 6. 内联 AI 对话

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

**节点切换自动重置：** `createEffect` 监听 `selectedNodeId` 变化，切换节点时立即停止轮询并清空对话历史。

---

### 7. 图谱快照与 Agent 上下文

**源码：** `packages/opencode/src/neural-map/neural-map.sql.ts` · `packages/opencode/src/server/routes/instance/neural-map.ts` · `packages/app/src/pages/neural-map/api.ts`

**解决的核心痛点**

AI Agent 在回答代码相关问题前，必须先理解代码库的整体结构。现有路径各有缺陷：

| 路径 | 问题 |
|---|---|
| 把整个代码库塞进 context | token 爆炸，大型项目根本放不下 |
| 让 Agent 自己 `ls` + 读文件探索 | 需要十几次 tool call，慢且容易遗漏 |

`/neural-map/context` 提供**预计算好的拓扑摘要**：模块划分、依赖关系、文件规模、Git 活跃度，单次 API 调用即可让 Agent 获得代码库全貌。

同时解决构建性能问题：`buildGraph()` 需要扫描全部源文件并对每个模块并发执行 `git log`，中等规模仓库耗时 800ms–3s。快照缓存使后续加载降至 10ms 以内（约快 100–300 倍），24 小时 TTL 保证数据不过期失效。

**数据库表**

```sql
-- 迁移：20260617000000_neural_map_snapshot
neural_map_snapshot (
  directory     TEXT NOT NULL,    -- 项目根目录（绝对路径）
  src           TEXT NOT NULL,    -- 相对源码路径，如 "packages/opencode/src"
  snapshot_json TEXT NOT NULL,    -- JSON：{ nodes: GraphNode[], edges: GraphEdge[] }
  saved_at      INTEGER NOT NULL, -- 保存时间（Unix ms），用于 TTL 判断
  PRIMARY KEY (directory, src)
)
```

快照只存节点与边的语义数据，**不存布局坐标**——坐标由布局算法从节点集合确定性地重新计算，对 Agent 无语义价值。

**REST API**

| 方法 | 路由 | 说明 |
|---|---|---|
| `POST` | `/neural-map/snapshot` | 保存或更新图谱快照 |
| `GET` | `/neural-map/snapshot?directory=&src=` | 读取快照，不存在时返回 `null` |
| `GET` | `/neural-map/context?directory=&src=` | 以 Markdown 格式返回图谱摘要，用于 Agent 上下文 |

**缓存策略**

`onMount` 阶段并发请求快照与进度。快照存在且在 24 小时内则直接渲染；过期或不存在则重新构建，完成后后台异步保存（不阻塞 UI）：

```
打开 Neural Map
    ↓
Promise.all([loadSnapshot(), fetchProgress()])
    ↓ 快照存在且未过期（< 24h）      ↓ 不存在或已过期
直接渲染（< 10ms）            fetchGraph() → 渲染 → saveSnapshot()（后台）
```

TTL 常量：`const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000`

**Agent 上下文格式（/neural-map/context）**

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
```

每个模块包含：路径、文件数、行数、Git 活跃度、是否可钻取、直接依赖列表。若快照尚未生成或已过期，接口返回 404 并提示先打开 Neural Map 视图触发重建。

---

## 全局搜索面板（Global Search Panel）

### 功能概述

全局搜索面板是一个键盘优先的全文代码搜索界面，通过 `Ctrl+Shift+F` 唤起，在整个项目中实时搜索文本并展示匹配结果。**所有搜索结果可一键格式化为 Markdown，直接作为 Agent 上下文注入 AI 会话。**

核心解决的问题：AI Agent 无法感知"某个符号在哪些文件中被引用"——全局搜索结果提供了精确的代码定位数据，配合格式化输出可消除 Agent 在代码定位上的盲区。

---

### 架构与组件

```
packages/
├── opencode/src/server/routes/instance/file.ts   # 后端搜索路由
└── app/src/
    ├── components/global-search-panel.tsx         # 搜索面板 UI 组件
    └── pages/layout.tsx                           # 全局布局，注册快捷键与命令
```

**数据流：**

```
用户输入（防抖 300ms）
  → GET /file/find?pattern=&limit=50          # ripgrep 全文搜索
  → SearchMatch[]                             # 按文件分组渲染
  → "复制为 Markdown" 按钮
  → GET /file/search/context?pattern=&limit=100  # 同一搜索的 Markdown 格式
  → navigator.clipboard.writeText(markdown)  # 写入剪贴板
```

---

### 后端 API

#### `GET /file/find`

使用 ripgrep 搜索项目中所有文件的文本内容，返回 JSON 数组。

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `pattern` | `string` | 搜索正则表达式或关键词 |
| `limit` | `number?` | 最大返回条数（默认 50，最大 200） |

**响应格式（`SearchMatch[]`）：**

```typescript
interface SearchMatch {
  path: { text: string }          // 文件路径
  lines: { text: string }         // 匹配的整行内容
  line_number: number             // 行号（1-based）
  submatches: Array<{
    match: { text: string }
    start: number
    end: number
  }>
}
```

**实现来源：** `Ripgrep.Service.search()` —— `packages/opencode/src/file/ripgrep.ts`

#### `GET /file/search/context`

与 `/file/find` 使用相同的 ripgrep 搜索，但返回 Markdown 纯文本，专为 AI Agent 上下文设计。

**响应格式（`text/plain` Markdown）：**

```markdown
# Search Results: "useServer"
> 12 matches across 5 files

## packages/app/src/components/global-search-panel.tsx
- Line 46: `  const server = useServer()`

## packages/app/src/pages/neural-map/index.tsx
- Line 15: `  const server = useServer()`
```

**实现细节：**

此路由使用 `runRequest()`（非 `jsonRequest()`），因为 Hono 的 `jsonRequest` 辅助函数会强制将响应包装为 JSON，无法返回纯文本。

```typescript
const result = await runRequest("FileRoutes.searchContext", c, Effect.gen(function* () {
  const svc = yield* Ripgrep.Service
  return yield* svc.search({ cwd: Instance.directory, pattern, limit: limit ?? 100 })
}))
return c.text(lines.join("\n"))
```

---

### 前端组件（`global-search-panel.tsx`）

**组件接口：**

```typescript
function GlobalSearchPanel(props: { open: boolean; onClose: () => void }): JSX.Element
```

**核心状态：**

```typescript
const [query, setQuery] = createSignal("")
const [results, setResults] = createSignal<GroupedResult[]>([])
const [totalMatches, setTotalMatches] = createSignal(0)
const [loading, setLoading] = createSignal(false)
const [copied, setCopied] = createSignal(false)
```

**交互设计：**

- 防抖输入：300ms 延迟后发起请求，避免每次按键都触发网络请求
- `Escape` 键关闭（通过 `onMount` / `onCleanup` 绑定到 `document` 上）
- 点击遮罩（backdrop）关闭
- 搜索结果按文件分组，文件名作为 sticky header
- 每个匹配行显示行号 + 完整行内容

**Agent 上下文复制：**

```typescript
async function copyAsContext() {
  const md = await fetchContext(serverUrl(), query().trim())
  await navigator.clipboard.writeText(md)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
```

按钮仅在有搜索结果时显示，复制后 2 秒内显示"✓ 已复制"反馈。

---

### 快捷键注册

在 `packages/app/src/pages/layout.tsx` 中通过命令系统注册：

```typescript
const [searchOpen, setSearchOpen] = createSignal(false)

command.register("layout", {
  // ...其他命令
  {
    id: "global.search",
    title: "全局搜索",
    category: "...",
    keybind: "ctrl+shift+f",
    onSelect: () => setSearchOpen(true),
  }
})
```

同时在命令面板（`Ctrl+K`）中可搜索"全局搜索"来触发。

---

### 样式约定

全部使用 CSS 变量而非硬编码颜色，与应用主题（亮色/暗色模式）自动适配：

| 变量 | 用途 |
|------|------|
| `--background-base` | 面板背景 |
| `--background-stronger` | 文件头、状态栏背景 |
| `--border-base` | 边框、分隔线 |
| `--text-base` | 主要文字 |
| `--text-weaker` | 行号、辅助文字 |
| `--text-link` | 文件路径颜色 |
| `--font-family-mono` | 等宽字体（代码内容） |
