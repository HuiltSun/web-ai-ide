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
